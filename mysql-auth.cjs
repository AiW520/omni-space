const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACCOUNTS = 100;
const MAX_BODY = 4096;
const COOKIE_NAME = 'omni_session';

function createMysqlAuth({ database, secureCookies = false, allowFirstAdmin = false }) {
  const pool = mysql.createPool({ ...database, waitForConnections: true, connectionLimit: 10, queueLimit: 0, charset: 'utf8mb4' });
  const attempts = new Map();
  const ready = initSchema();

  async function initSchema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS accounts (
      id CHAR(36) NOT NULL PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE,
      name VARCHAR(40) NOT NULL,
      role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
      salt CHAR(32) NOT NULL,
      password_hash CHAR(128) NOT NULL,
      created_at BIGINT NOT NULL,
      INDEX accounts_role_idx (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      account_id CHAR(36) NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      CONSTRAINT sessions_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      INDEX sessions_account_idx (account_id),
      INDEX sessions_expiry_idx (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.query(`CREATE TABLE IF NOT EXISTS image_usage (
      account_id CHAR(36) NOT NULL PRIMARY KEY,
      usage_day CHAR(10) NOT NULL,
      usage_count INT UNSIGNED NOT NULL DEFAULT 0,
      CONSTRAINT image_usage_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  function publicAccount(account) {
    return account && { id: account.id, email: account.email, name: account.name, role: account.role, createdAt: Number(account.createdAt) };
  }

  function mapAccount(row) {
    return row && { id: row.id, email: row.email, name: row.name, role: row.role, salt: row.salt, hash: row.password_hash, createdAt: Number(row.created_at) };
  }

  function cookieToken(request) {
    const raw = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
    return raw ? raw.slice(COOKIE_NAME.length + 1) : '';
  }

  async function sessionAccount(request) {
    const token = cookieToken(request);
    if (!/^[a-f\d]{64}$/.test(token)) return null;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.execute('SELECT a.id, a.email, a.name, a.role, a.salt, a.password_hash, a.created_at FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ?', [tokenHash, Date.now()]);
    return mapAccount(rows[0]);
  }

  async function setSession(response, account, connection = pool) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    await connection.execute('DELETE FROM sessions WHERE expires_at <= ?', [now]);
    const [countRows] = await connection.execute('SELECT COUNT(*) AS count FROM sessions WHERE account_id = ?', [account.id]);
    if (Number(countRows[0].count) >= 5) await connection.execute('DELETE FROM sessions WHERE token_hash = (SELECT token_hash FROM (SELECT token_hash FROM sessions WHERE account_id = ? ORDER BY created_at ASC LIMIT 1) oldest)', [account.id]);
    await connection.execute('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [crypto.createHash('sha256').update(token).digest('hex'), account.id, now, now + SESSION_MS]);
    response.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secureCookies ? '; Secure' : ''}`);
  }

  async function clearSession(request, response) {
    const token = cookieToken(request);
    if (token) await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [crypto.createHash('sha256').update(token).digest('hex')]);
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

  async function members() {
    const [rows] = await pool.execute('SELECT id, email, name, role, created_at FROM accounts ORDER BY created_at ASC');
    return rows.map(mapAccount).map(publicAccount);
  }

  async function handle(request, response, pathname) {
    await ready;
    const method = request.method;
    if (pathname === '/api/auth/me' && method === 'GET') {
      const account = await sessionAccount(request);
      return { account: publicAccount(account), members: account?.role === 'admin' ? await members() : [], hasAccounts: (await pool.execute('SELECT COUNT(*) AS count FROM accounts'))[0][0].count > 0 };
    }
    if (method === 'POST' && pathname === '/api/auth/register') {
      if (rateLimited(request, 'register')) throw error(429, 'Too many attempts. Try again later.');
      const body = await readBody(request); const email = validateEmail(body.email); const name = String(body.name || '').trim(); const password = String(body.password || '');
      if (!email || !name || name.length > 40 || password.length < 10 || password.length > 128) throw error(400, 'Enter a valid email, name and password of at least 10 characters.');
      const salt = crypto.randomBytes(16).toString('hex'); const hash = await passwordHash(password, salt); const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [countRows] = await connection.execute('SELECT COUNT(*) AS count FROM accounts FOR UPDATE');
        if (Number(countRows[0].count) >= MAX_ACCOUNTS) throw error(409, 'Account limit reached.');
        const [existing] = await connection.execute('SELECT id FROM accounts WHERE email = ?', [email]);
        if (existing.length) throw error(409, 'Email already registered.');
        const account = { id: crypto.randomUUID(), email, name, role: Number(countRows[0].count) === 0 && allowFirstAdmin ? 'admin' : 'member', salt, hash, createdAt: Date.now() };
        await connection.execute('INSERT INTO accounts (id, email, name, role, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [account.id, account.email, account.name, account.role, account.salt, account.hash, account.createdAt]);
        await setSession(response, account, connection); await connection.commit();
        return { account: publicAccount(account), members: account.role === 'admin' ? await members() : [] };
      } catch (cause) { await connection.rollback(); throw cause; } finally { connection.release(); }
    }
    if (method === 'POST' && pathname === '/api/auth/login') {
      if (rateLimited(request, 'login')) throw error(429, 'Too many attempts. Try again later.');
      const body = await readBody(request); const email = validateEmail(body.email); const [rows] = await pool.execute('SELECT id, email, name, role, salt, password_hash, created_at FROM accounts WHERE email = ?', [email]); const account = mapAccount(rows[0]);
      const salt = account?.salt || '00000000000000000000000000000000'; const hash = await passwordHash(String(body.password || ''), salt);
      if (!account || !crypto.timingSafeEqual(Buffer.from(account.hash, 'hex'), Buffer.from(hash, 'hex'))) throw error(401, 'Email or password is incorrect.');
      await setSession(response, account); return { account: publicAccount(account), members: account.role === 'admin' ? await members() : [] };
    }
    if (method === 'POST' && pathname === '/api/auth/logout') { await clearSession(request, response); return { ok: true }; }
    const actor = await sessionAccount(request);
    if (!actor) throw error(401, 'Sign in required.');
    if (method === 'PATCH' && pathname === '/api/auth/profile') {
      const body = await readBody(request); const name = String(body.name || '').trim(); const password = String(body.password || '');
      if (!name || name.length > 40 || (password && (password.length < 10 || password.length > 128))) throw error(400, 'Invalid profile. Password must be at least 10 characters.');
      if (password) { const currentHash = await passwordHash(String(body.currentPassword || ''), actor.salt); if (!crypto.timingSafeEqual(Buffer.from(actor.hash, 'hex'), Buffer.from(currentHash, 'hex'))) throw error(401, 'Current password is incorrect.'); }
      const credentials = password ? { salt: crypto.randomBytes(16).toString('hex') } : null; if (credentials) credentials.hash = await passwordHash(password, credentials.salt);
      const connection = await pool.getConnection();
      try { await connection.beginTransaction(); await connection.execute('UPDATE accounts SET name = ?' + (credentials ? ', salt = ?, password_hash = ?' : '') + ' WHERE id = ?', credentials ? [name, credentials.salt, credentials.hash, actor.id] : [name, actor.id]); if (credentials) { await connection.execute('DELETE FROM sessions WHERE account_id = ?', [actor.id]); } const target = { ...actor, name, ...(credentials || {}) }; if (credentials) await setSession(response, target, connection); await connection.commit(); return { account: publicAccount(target), members: target.role === 'admin' ? await members() : [] }; } catch (cause) { await connection.rollback(); throw cause; } finally { connection.release(); }
    }
    const memberMatch = pathname.match(/^\/api\/auth\/members\/([a-f\d-]{36})$/);
    if (memberMatch && ['PATCH', 'DELETE'].includes(method)) {
      if (actor.role !== 'admin') throw error(403, 'Admin role required.'); const body = method === 'PATCH' ? await readBody(request) : null; if (body && !['admin', 'member'].includes(body.role)) throw error(400, 'Invalid role.'); if (memberMatch[1] === actor.id) throw error(400, 'Cannot change your own membership.');
      const [targetRows] = await pool.execute('SELECT id FROM accounts WHERE id = ?', [memberMatch[1]]); if (!targetRows.length) throw error(404, 'Member not found.');
      if (method === 'DELETE') await pool.execute('DELETE FROM accounts WHERE id = ?', [memberMatch[1]]); else await pool.execute('UPDATE accounts SET role = ? WHERE id = ?', [body.role, memberMatch[1]]);
      return { members: await members() };
    }
    throw error(404, 'Not found');
  }

  async function bootstrapAdmin(email, password) {
    await ready; const [rows] = await pool.execute('SELECT COUNT(*) AS count FROM accounts'); if (Number(rows[0].count)) return; const normalizedEmail = validateEmail(email); if (!normalizedEmail || typeof password !== 'string' || password.length < 12) throw Error('OMNI_ADMIN_EMAIL and OMNI_ADMIN_PASSWORD (12+ characters) are required for public binding'); const salt = crypto.randomBytes(16).toString('hex'); const hash = await passwordHash(password, salt); await pool.execute('INSERT INTO accounts (id, email, name, role, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), normalizedEmail, 'Admin', 'admin', salt, hash, Date.now()]);
  }

  async function consumeImageQuota(account, limit) {
    await ready; const connection = await pool.getConnection(); const day = new Date().toISOString().slice(0, 10);
    try { await connection.beginTransaction(); const [rows] = await connection.execute('SELECT usage_day, usage_count FROM image_usage WHERE account_id = ? FOR UPDATE', [account.id]); const count = rows[0]?.usage_day === day ? Number(rows[0].usage_count) : 0; if (count >= limit) throw error(429, 'Daily image limit reached.'); if (rows.length) await connection.execute('UPDATE image_usage SET usage_day = ?, usage_count = ? WHERE account_id = ?', [day, count + 1, account.id]); else await connection.execute('INSERT INTO image_usage (account_id, usage_day, usage_count) VALUES (?, ?, ?)', [account.id, day, 1]); await connection.commit(); return limit - count - 1; } catch (cause) { await connection.rollback(); throw cause; } finally { connection.release(); }
  }

  return { ready, handle, sessionAccount, publicAccount, readBody, bootstrapAdmin, consumeImageQuota, close: () => pool.end() };
}

module.exports = { createMysqlAuth };
