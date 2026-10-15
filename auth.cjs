const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACCOUNTS = 100;
const MAX_BODY = 4096;
const COOKIE_NAME = 'omni_session';

function createAuth({ dataDir, secureCookies = false, allowFirstAdmin = false }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'accounts.json');
  let state = { accounts: [], sessions: [], imageUsage: {} };
  if (fs.existsSync(file)) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(parsed.accounts) || !Array.isArray(parsed.sessions)) throw Error('Invalid account database');
    state = { accounts: parsed.accounts, sessions: parsed.sessions, imageUsage: parsed.imageUsage && typeof parsed.imageUsage === 'object' ? parsed.imageUsage : {} };
  }
  let mutation = Promise.resolve();
  const attempts = new Map();

  function persist() {
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(temp, file);
  }

  function enqueue(work) {
    const result = mutation.then(work);
    mutation = result.catch(() => {});
    return result;
  }

  function publicAccount(account) {
    return account && { id: account.id, email: account.email, name: account.name, role: account.role, createdAt: account.createdAt };
  }

  function cookieToken(request) {
    const raw = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
    return raw ? raw.slice(COOKIE_NAME.length + 1) : '';
  }

  function sessionAccount(request) {
    const token = cookieToken(request);
    if (!/^[a-f\d]{64}$/.test(token)) return null;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = state.sessions.find(item => item.tokenHash === tokenHash && item.expiresAt > Date.now());
    return session ? state.accounts.find(item => item.id === session.accountId) || null : null;
  }

  function setSession(response, account) {
    const token = crypto.randomBytes(32).toString('hex');
    state.sessions = state.sessions.filter(item => item.expiresAt > Date.now());
    const current = state.sessions.filter(item => item.accountId === account.id);
    if (current.length >= 5) {
      const oldest = current.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
      state.sessions = state.sessions.filter(item => item !== oldest);
    }
    state.sessions.push({ tokenHash: crypto.createHash('sha256').update(token).digest('hex'), accountId: account.id, createdAt: Date.now(), expiresAt: Date.now() + SESSION_MS });
    persist();
    response.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secureCookies ? '; Secure' : ''}`);
  }

  function clearSession(request, response) {
    const token = cookieToken(request);
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      state.sessions = state.sessions.filter(item => item.tokenHash !== tokenHash);
      persist();
    }
    response.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookies ? '; Secure' : ''}`);
  }

  function rateLimited(request, key) {
    const id = `${request.socket.remoteAddress}:${key}`;
    const now = Date.now();
    const record = attempts.get(id) || { count: 0, until: now + 15 * 60 * 1000 };
    if (record.until <= now) { record.count = 0; record.until = now + 15 * 60 * 1000; }
    record.count++;
    attempts.set(id, record);
    if (attempts.size > 1000) for (const [entry, value] of attempts) if (value.until <= now) attempts.delete(entry);
    return record.count > 12;
  }

  async function passwordHash(password, salt) {
    return (await scrypt(password, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 })).toString('hex');
  }

  function validateEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  }

  function error(status, message) { return { status, error: message }; }

  async function readBody(request) {
    let raw = '';
    for await (const chunk of request) {
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY) throw error(413, 'Request too large');
    }
    try { return JSON.parse(raw || '{}'); } catch { throw error(400, 'Invalid JSON'); }
  }

  async function handle(request, response, pathname) {
    const method = request.method;
    if (pathname === '/api/auth/me' && method === 'GET') {
      const account = sessionAccount(request);
      return { account: publicAccount(account), members: account?.role === 'admin' ? state.accounts.map(publicAccount) : [], hasAccounts: state.accounts.length > 0 };
    }
    if (method === 'POST' && pathname === '/api/auth/register') {
      if (rateLimited(request, 'register')) throw error(429, 'Too many attempts. Try again later.');
      const body = await readBody(request);
      const email = validateEmail(body.email);
      const name = String(body.name || '').trim();
      const password = String(body.password || '');
      if (!email || !name || name.length > 40 || password.length < 10 || password.length > 128) throw error(400, 'Enter a valid email, name and password of at least 10 characters.');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await passwordHash(password, salt);
      return enqueue(() => {
        if (state.accounts.length >= MAX_ACCOUNTS) throw error(409, 'Account limit reached.');
        if (state.accounts.some(item => item.email === email)) throw error(409, 'Email already registered.');
        const account = { id: crypto.randomUUID(), email, name, role: state.accounts.length === 0 && allowFirstAdmin ? 'admin' : 'member', salt, hash, createdAt: Date.now() };
        state.accounts.push(account);
        setSession(response, account);
        return { account: publicAccount(account), members: account.role === 'admin' ? state.accounts.map(publicAccount) : [] };
      });
    }
    if (method === 'POST' && pathname === '/api/auth/login') {
      if (rateLimited(request, 'login')) throw error(429, 'Too many attempts. Try again later.');
      const body = await readBody(request);
      const email = validateEmail(body.email);
      const account = state.accounts.find(item => item.email === email);
      const salt = account?.salt || '00000000000000000000000000000000';
      const hash = await passwordHash(String(body.password || ''), salt);
      if (!account || !crypto.timingSafeEqual(Buffer.from(account.hash, 'hex'), Buffer.from(hash, 'hex'))) throw error(401, 'Email or password is incorrect.');
      return enqueue(() => { setSession(response, account); return { account: publicAccount(account), members: account.role === 'admin' ? state.accounts.map(publicAccount) : [] }; });
    }
    if (method === 'POST' && pathname === '/api/auth/logout') return enqueue(() => { clearSession(request, response); return { ok: true }; });
    const actor = sessionAccount(request);
    if (!actor) throw error(401, 'Sign in required.');
    if (method === 'PATCH' && pathname === '/api/auth/profile') {
      const body = await readBody(request);
      const name = String(body.name || '').trim();
      const password = String(body.password || '');
      if (!name || name.length > 40 || (password && (password.length < 10 || password.length > 128))) throw error(400, 'Invalid profile. Password must be at least 10 characters.');
      if (password) {
        const currentHash = await passwordHash(String(body.currentPassword || ''), actor.salt);
        if (!crypto.timingSafeEqual(Buffer.from(actor.hash, 'hex'), Buffer.from(currentHash, 'hex'))) throw error(401, 'Current password is incorrect.');
      }
      const credentials = password ? { salt: crypto.randomBytes(16).toString('hex') } : null;
      if (credentials) credentials.hash = await passwordHash(password, credentials.salt);
      return enqueue(() => {
        const target = state.accounts.find(item => item.id === actor.id);
        if (!target) throw error(401, 'Sign in required.');
        target.name = name;
        if (credentials) { Object.assign(target, credentials); state.sessions = state.sessions.filter(item => item.accountId !== target.id); setSession(response, target); }
        else persist();
        return { account: publicAccount(target), members: target.role === 'admin' ? state.accounts.map(publicAccount) : [] };
      });
    }
    const memberMatch = pathname.match(/^\/api\/auth\/members\/([a-f\d-]{36})$/);
    if (memberMatch && ['PATCH', 'DELETE'].includes(method)) {
      if (actor.role !== 'admin') throw error(403, 'Admin role required.');
      const body = method === 'PATCH' ? await readBody(request) : null;
      if (body && !['admin', 'member'].includes(body.role)) throw error(400, 'Invalid role.');
      return enqueue(() => {
        const admin = state.accounts.find(item => item.id === actor.id);
        const target = state.accounts.find(item => item.id === memberMatch[1]);
        if (admin?.role !== 'admin') throw error(403, 'Admin role required.');
        if (!target) throw error(404, 'Member not found.');
        if (target.id === actor.id) throw error(400, 'Cannot change your own membership.');
        if (method === 'DELETE') {
          state.accounts = state.accounts.filter(item => item.id !== target.id);
          state.sessions = state.sessions.filter(item => item.accountId !== target.id);
        } else target.role = body.role;
        persist();
        return { members: state.accounts.map(publicAccount) };
      });
    }
    throw error(404, 'Not found');
  }

  async function bootstrapAdmin(email, password) {
    if (state.accounts.length) return;
    const normalizedEmail = validateEmail(email);
    if (!normalizedEmail || typeof password !== 'string' || password.length < 12) throw Error('OMNI_ADMIN_EMAIL and OMNI_ADMIN_PASSWORD (12+ characters) are required for public binding');
    const salt = crypto.randomBytes(16).toString('hex');
    state.accounts.push({ id: crypto.randomUUID(), email: normalizedEmail, name: 'Admin', role: 'admin', salt, hash: await passwordHash(password, salt), createdAt: Date.now() });
    persist();
  }

  function consumeImageQuota(account, limit) {
    return enqueue(() => {
      const day = new Date().toISOString().slice(0, 10);
      const usage = state.imageUsage[account.id];
      const count = usage?.day === day ? usage.count : 0;
      if (count >= limit) throw error(429, 'Daily image limit reached.');
      state.imageUsage[account.id] = { day, count: count + 1 };
      persist();
      return limit - count - 1;
    });
  }

  return { handle, sessionAccount, publicAccount, readBody, bootstrapAdmin, consumeImageQuota };
}

module.exports = { createAuth };
