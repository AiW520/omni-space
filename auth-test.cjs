const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const port = 4189;
const base = `http://127.0.0.1:${port}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-auth-'));
let child;

async function start() {
  child = spawn(process.execPath, ['server.cjs'], {
    cwd: __dirname,
    env: { ...process.env, OMNI_PORT: String(port), OMNI_DB_DRIVER: 'json', OMNI_DATA_DIR: dataDir, OMNI_DAILY_IMAGE_LIMIT: '1', OMNI_IMAGE_SCRIPT: path.join(dataDir, 'missing-generator.py') },
    stdio: 'ignore', windowsHide: true,
  });
  for (let i = 0; i < 40; i++) {
    try { const response = await fetch(`${base}/api/auth/me`); if (response.ok) return; } catch { /* Wait for startup. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Test server did not start');
}

async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await ended;
}

function client() {
  let cookie = '';
  return {
    async request(route, method = 'GET', payload, extraHeaders = {}) {
      const headers = { ...extraHeaders };
      if (cookie) headers.Cookie = cookie;
      if (payload) headers['Content-Type'] = 'application/json';
      const response = await fetch(base + route, { method, headers, body: payload ? JSON.stringify(payload) : undefined });
      const nextCookie = response.headers.get('set-cookie');
      if (nextCookie) cookie = nextCookie.split(';')[0];
      return { status: response.status, body: await response.json(), cookie: nextCookie };
    },
  };
}

(async () => {
  try {
    await start();
    const admin = client();
    const adminSecond = client();
    const member = client();
    const guest = client();
    let result = await guest.request('/api/images', 'POST', { prompt: 'test' });
    assert.equal(result.status, 401);
    result = await admin.request('/api/auth/register', 'POST', { email: 'admin@example.com', name: 'Admin', password: 'firstPassword123' });
    assert.equal(result.status, 200);
    assert.equal(result.body.account.role, 'admin');
    assert.match(result.cookie, /HttpOnly; SameSite=Lax/);
    result = await adminSecond.request('/api/auth/login', 'POST', { email: 'admin@example.com', password: 'firstPassword123' });
    assert.equal(result.status, 200);
    result = await admin.request('/api/auth/me');
    assert.equal(result.body.account.role, 'admin');
    result = await admin.request('/api/images', 'POST', { prompt: 'quota check' });
    assert.equal(result.status, 502);
    result = await admin.request('/api/images', 'POST', { prompt: 'quota check' });
    assert.equal(result.status, 429);
    result = await member.request('/api/auth/register', 'POST', { email: 'member@example.com', name: 'Member', password: 'secondPassword123' });
    assert.equal(result.body.account.role, 'member');
    const memberId = result.body.account.id;
    result = await member.request(`/api/auth/members/${memberId}`, 'PATCH', { role: 'admin' });
    assert.equal(result.status, 403);
    result = await admin.request(`/api/auth/members/${memberId}`, 'PATCH', { role: 'admin' }, { Origin: 'https://evil.example' });
    assert.equal(result.status, 403);
    result = await admin.request(`/api/auth/members/${memberId}`, 'PATCH', { role: 'admin' });
    assert.equal(result.body.members.find(item => item.id === memberId).role, 'admin');
    result = await admin.request('/api/auth/profile', 'PATCH', { name: 'Admin', currentPassword: 'wrongPassword', password: 'changedPassword123' });
    assert.equal(result.status, 401);
    result = await admin.request('/api/auth/profile', 'PATCH', { name: 'Updated Admin', currentPassword: 'firstPassword123', password: 'changedPassword123' });
    assert.equal(result.body.account.name, 'Updated Admin');
    result = await adminSecond.request('/api/auth/me');
    assert.equal(result.body.account, null);
    result = await admin.request('/api/auth/me');
    assert.equal(result.body.account.name, 'Updated Admin');
    result = await admin.request('/api/images', 'POST', { prompt: 'quota check' });
    assert.equal(result.status, 429);
    await stop();
    await start();
    result = await admin.request('/api/auth/me');
    assert.equal(result.body.account.name, 'Updated Admin');
    result = await admin.request(`/api/auth/members/${memberId}`, 'DELETE');
    assert.equal(result.body.members.some(item => item.id === memberId), false);
    result = await member.request('/api/auth/me');
    assert.equal(result.body.account, null);
    result = await admin.request('/api/auth/logout', 'POST');
    assert.equal(result.status, 200);
    result = await admin.request('/api/auth/me');
    assert.equal(result.body.account, null);
    console.log('PASS: server accounts, roles, sessions, password rotation, CSRF, image auth, restart');
  } finally {
    await stop();
    if (path.resolve(dataDir).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
