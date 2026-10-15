const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { createAuth } = require('./auth.cjs');
const { createMysqlAuth } = require('./mysql-auth.cjs');

const root = __dirname;
const outputDir = path.join(root, 'generated-media');
const port = Number(process.env.OMNI_PORT || 4175);
const host = process.env.OMNI_HOST || '127.0.0.1';
const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(host);
const secureCookies = process.env.OMNI_HTTPS === '1';
const dailyImageLimit = Math.max(1, Math.min(100, Number(process.env.OMNI_DAILY_IMAGE_LIMIT) || 20));
const script = process.env.OMNI_IMAGE_SCRIPT || 'C:/Users/ZhuanZ1/.codex/skills/tuzi-image-generation/scripts/generate_image.py';
function databaseConfig() {
  const configPath = process.env.OMNI_DB_CONFIG || path.join(root, 'data', 'db-config.json');
  let file = {};
  try { file = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { /* Environment variables may provide the configuration. */ }
  return { host: process.env.OMNI_DB_HOST || file.host || '127.0.0.1', port: Number(process.env.OMNI_DB_PORT || file.port || 3306), user: process.env.OMNI_DB_USER || file.user || 'root', password: process.env.OMNI_DB_PASSWORD ?? file.password, database: process.env.OMNI_DB_NAME || file.database || 'omni_space' };
}
const useMysql = process.env.OMNI_DB_DRIVER !== 'json';
const auth = useMysql ? createMysqlAuth({ database: databaseConfig(), secureCookies, allowFirstAdmin: isLocal }) : createAuth({ dataDir: process.env.OMNI_DATA_DIR || path.join(root, 'data'), secureCookies, allowFirstAdmin: isLocal });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
let generating = false;

function headers(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function send(response, status, body) {
  if (response.writableEnded) return;
  headers(response);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function serveFile(request, response, pathname) {
  const generated = /^\/generated-media\/(?:([a-f\d-]{36})\/)?([a-zA-Z0-9._-]+\.(?:png|jpe?g|webp))$/.exec(pathname);
  if (!['/', '/index.html', '/app.js', '/styles.css'].includes(pathname) && !generated) return send(response, 404, { error: 'Not found' });
  if (generated) {
    const account = await auth.sessionAccount(request);
    if (!account || (generated[1] ? generated[1] !== account.id : account.role !== 'admin')) return send(response, 403, { error: 'Access denied' });
  }
  const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return send(response, 404, { error: 'Not found' });
  headers(response);
  response.writeHead(200, { 'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': generated ? 'private, max-age=3600' : 'no-cache' });
  fs.createReadStream(target).pipe(response);
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (request.headers['sec-fetch-site'] === 'cross-site') return false;
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.host && ['http:', 'https:'].includes(new URL(origin).protocol); }
  catch { return false; }
}

async function generateImage(request, response) {
  const account = await auth.sessionAccount(request);
  if (!account) return send(response, 401, { error: 'Sign in before generating images.' });
  if (generating) return send(response, 429, { error: 'Another image is generating.' });
  let body;
  try { body = await auth.readBody(request); }
  catch (error) { return send(response, error.status || 400, { error: error.error || 'Invalid request' }); }
  const prompt = String(body.prompt || '').trim();
  const size = ['1024x1024', '1536x1024', '1024x1536'].includes(body.size) ? body.size : '1536x1024';
  if (!prompt || Buffer.byteLength(prompt, 'utf8') > 4000) return send(response, 400, { error: 'Invalid image prompt.' });
  generating = true;
  try {
    await auth.consumeImageQuota(account, dailyImageLimit);
    const accountDir = path.join(outputDir, account.id);
    fs.mkdirSync(accountDir, { recursive: true });
    const name = `omni-${Date.now()}`;
    const child = spawn('python', [script, '--prompt', prompt, '--size', size, '--output-format', 'webp', '--output-dir', accountDir, '--filename', name], { windowsHide: true });
    let result = '', error = '', settled = false;
    const timeout = setTimeout(() => { child.kill(); finish(504, { error: 'Image generation timed out.' }); }, 180000);
    const finish = (status, payload) => { if (settled) return; settled = true; clearTimeout(timeout); generating = false; send(response, status, payload); };
    child.stdout.on('data', chunk => { result += chunk.toString(); });
    child.stderr.on('data', chunk => { error += chunk.toString(); });
    child.on('error', () => finish(502, { error: 'Image generator unavailable.' }));
    child.on('close', code => {
      if (settled) return;
      try {
        const payload = JSON.parse(code === 0 ? result : error);
        if (code !== 0 || !payload.saved_files?.length) throw Error(payload.message || 'Image generation failed');
        const file = path.resolve(payload.saved_files[0]);
        if (!file.startsWith(accountDir + path.sep) || !fs.statSync(file).size) throw Error('Invalid generated file');
        finish(200, { url: `/generated-media/${account.id}/${path.basename(file)}`, model: 'gpt-image-2' });
      } catch (err) { finish(502, { error: String(err.message).slice(0, 250) }); }
    });
  } catch (error) { generating = false; send(response, error.status || 500, { error: error.error || 'Image generation unavailable.' }); }
}

const server = http.createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname); }
  catch { return send(response, 400, { error: 'Invalid URL' }); }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !sameOrigin(request)) return send(response, 403, { error: 'Invalid origin' });
  if (pathname === '/api/health' && request.method === 'GET') {
    const status = spawnSync('python', [script, '--status'], { windowsHide: true, encoding: 'utf8', timeout: 5000 });
    return send(response, 200, { imageModel: 'gpt-image-2', imageReady: status.status === 0, videoReady: false });
  }
  if (pathname.startsWith('/api/auth/')) {
    try { return send(response, 200, await auth.handle(request, response, pathname)); }
    catch (error) { return send(response, error.status || 500, { error: error.error || 'Server error' }); }
  }
  if (pathname === '/api/images') {
    if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed' });
    return generateImage(request, response);
  }
  if (request.method !== 'GET') return send(response, 405, { error: 'Method not allowed' });
  return serveFile(request, response, pathname);
});

async function start() {
  if (auth.ready) await auth.ready;
  if (!isLocal) {
    if (!secureCookies) throw Error('OMNI_HTTPS=1 is required for public binding behind HTTPS');
    await auth.bootstrapAdmin(process.env.OMNI_ADMIN_EMAIL, process.env.OMNI_ADMIN_PASSWORD);
  }
  server.listen(port, host, () => console.log(`OMNI SPACE: http://${host}:${port}/`));
}

if (require.main === module) start().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { server, start };
