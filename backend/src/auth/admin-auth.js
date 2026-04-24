const crypto = require('crypto');

const DEFAULT_TABLE_CANDIDATES = [
  'admin_credentials',
  'admin_users',
  'admins',
  'users',
  'user_accounts'
];

const USERNAME_COLUMNS = ['username', 'user_name', 'login', 'email', 'user_email'];
const PASSWORD_COLUMNS = ['password', 'password_hash', 'hashed_password', 'passwd', 'secret'];
const NAME_COLUMNS = ['name', 'full_name', 'display_name'];
const ROLE_COLUMNS = ['role', 'user_role', 'type'];
const ACTIVE_COLUMNS = ['is_active', 'active', 'enabled', 'status'];
const ID_COLUMNS = ['id', 'admin_id', 'user_id'];
const PBKDF2_DIGEST = 'sha256';
const PBKDF2_KEYLEN = 32;

function createAdminAuth({ pool, config, sendJson }) {
  const secret = resolveAdminJwtSecret(config);
  const cookieName = String(config.adminCookieName || 'orbmitra_admin_token');
  const cookieSameSite = resolveCookieSameSite(config.adminCookieSameSite);
  const tokenTtlSeconds = Number(config.adminTokenTtlSeconds || 60 * 60 * 8);
  const passwordIterations = Math.max(100000, Number(config.adminPasswordIterations || 310000));
  const loginLimiter = createLoginLimiter({
    maxAttempts: Math.max(1, Number(config.adminLoginMaxAttempts || 5)),
    windowMs: Math.max(1, Number(config.adminLoginWindowSeconds || 15 * 60)) * 1000,
    lockoutMs: Math.max(1, Number(config.adminLoginLockoutSeconds || 15 * 60)) * 1000
  });
  const tableCandidates = normalizeCandidates(config.adminTable, DEFAULT_TABLE_CANDIDATES);
  const userColumns = normalizeCandidates(config.adminUsernameColumn, USERNAME_COLUMNS);
  const passwordColumns = normalizeCandidates(config.adminPasswordColumn, PASSWORD_COLUMNS);
  const nameColumns = normalizeCandidates(config.adminNameColumn, NAME_COLUMNS);
  const roleColumns = normalizeCandidates(config.adminRoleColumn, ROLE_COLUMNS);
  const activeColumns = normalizeCandidates(config.adminActiveColumn, ACTIVE_COLUMNS);
  const idColumns = normalizeCandidates(config.adminIdColumn, ID_COLUMNS);

  const tableCache = new Map();
  const sourceCache = new Map();

  async function login({ username, password }) {
    const normalizedUsername = String(username || '').trim();
    const normalizedPassword = String(password || '');

    if (!normalizedUsername || !normalizedPassword) {
      return null;
    }

    const source = await resolveCredentialSource(normalizedUsername);
    if (!source) {
      return null;
    }

    const storedValue = source.row[source.passwordColumn];
    const verification = verifyPassword(normalizedPassword, storedValue, passwordIterations);
    if (!verification.matched) {
      return null;
    }

    if (verification.needsUpgrade) {
      await upgradeStoredPassword(source, normalizedUsername, normalizedPassword, storedValue, passwordIterations);
    }

    const claims = buildClaims(source.row, source, normalizedUsername);
    const token = signJwt(
      {
        sub: String(claims.sub),
        username: claims.username,
        name: claims.name,
        role: claims.role
      },
      secret,
      tokenTtlSeconds
    );

    return {
      token,
      admin: claims,
      expiresAt: new Date(Date.now() + tokenTtlSeconds * 1000).toISOString()
    };
  }

  async function authenticateRequest(req) {
    const token = getTokenFromRequest(req, cookieName);
    if (!token) {
      return null;
    }

    const payload = verifyJwt(token, secret);
    if (!payload) {
      return null;
    }

    return {
      sub: payload.sub,
      username: payload.username || payload.sub || 'admin',
      name: payload.name || payload.username || payload.sub || 'Admin',
      role: payload.role || 'admin'
    };
  }

  async function requireAdmin(req, res) {
    const admin = await authenticateRequest(req);
    if (admin) {
      return admin;
    }

    sendJson(res, 401, { error: 'unauthorized' });
    return null;
  }

  function sessionCookieHeader(token) {
    const parts = [
      `${cookieName}=${token}`,
      'Path=/',
      'HttpOnly',
      `SameSite=${cookieSameSite}`
    ];

    if (cookieSameSite === 'None' || String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
      parts.push('Secure');
    }

    return parts.join('; ');
  }

  function clearSessionCookieHeader() {
    return `${cookieName}=; Path=/; HttpOnly; SameSite=${cookieSameSite}; Max-Age=0`;
  }

  function checkLoginRateLimit(req, username) {
    return loginLimiter.check(req, username);
  }

  function recordLoginFailure(req, username) {
    return loginLimiter.failure(req, username);
  }

  function recordLoginSuccess(req, username) {
    return loginLimiter.success(req, username);
  }

  async function resolveCredentialSource(username) {
    const cacheKey = String(username || '').toLowerCase();
    if (sourceCache.has(cacheKey)) {
      return sourceCache.get(cacheKey);
    }

    if (!pool) {
      sourceCache.set(cacheKey, null);
      return null;
    }

    for (const tableName of tableCandidates) {
      const columns = await loadTableColumns(tableName);
      if (!columns) {
        continue;
      }

      const usernameColumn = pickFirstAvailable(columns, userColumns);
      const passwordColumn = pickFirstAvailable(columns, passwordColumns);
      if (!usernameColumn || !passwordColumn) {
        continue;
      }

      const activeColumn = pickFirstAvailable(columns, activeColumns);
      const roleColumn = pickFirstAvailable(columns, roleColumns);
      const nameColumn = pickFirstAvailable(columns, nameColumns);
      const idColumn = pickFirstAvailable(columns, idColumns);
      const queryClauses = [quoteIdentifier(usernameColumn) + ' = $1'];

      for (const candidate of userColumns) {
        if (candidate !== usernameColumn && columns.includes(candidate)) {
          queryClauses.push(quoteIdentifier(candidate) + ' = $1');
        }
      }

      const sql = `
        SELECT *
        FROM ${quoteIdentifier(tableName)}
        WHERE ${queryClauses.join(' OR ')}
        LIMIT 1
      `;

      const result = await pool.query(sql, [username]);
      const row = result.rows[0];
      if (!row) {
        continue;
      }

      if (activeColumn && !isActiveValue(row[activeColumn])) {
        continue;
      }

      const source = {
        tableName,
        row,
        usernameColumn,
        passwordColumn,
        nameColumn,
        roleColumn,
        activeColumn,
        idColumn
      };
      sourceCache.set(cacheKey, source);
      return source;
    }

    sourceCache.set(cacheKey, null);
    return null;
  }

  async function loadTableColumns(tableName) {
    if (!pool) {
      return null;
    }

    const normalized = String(tableName || '').trim();
    if (!normalized || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
      return null;
    }

    if (tableCache.has(normalized)) {
      return tableCache.get(normalized);
    }

    const result = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
      `,
      [normalized]
    );

    const columns = result.rows.map(row => row.column_name);
    const value = columns.length > 0 ? columns : null;
    tableCache.set(normalized, value);
    return value;
  }

  function buildClaims(row, source, requestedUsername) {
    const username = String(row[source.usernameColumn] || requestedUsername || 'admin');
    const name = source.nameColumn ? String(row[source.nameColumn] || username) : username;
    const role = source.roleColumn ? String(row[source.roleColumn] || 'admin') : 'admin';
    const sub = source.idColumn ? String(row[source.idColumn] || username) : username;

    return {
      sub,
      username,
      name,
      role
    };
  }

  function verifyPassword(plainPassword, storedValue, iterations) {
    if (storedValue === null || storedValue === undefined) {
      return { matched: false, needsUpgrade: false };
    }

    const plain = String(plainPassword);
    const stored = String(storedValue);
    const normalized = stored.trim();

    if (normalized.startsWith('pbkdf2$')) {
      return verifyPbkdf2Password(plain, normalized);
    }

    if (normalized === plain) {
      return { matched: true, needsUpgrade: true };
    }

    const lower = normalized.toLowerCase();
    if (lower.startsWith('plain:')) {
      return { matched: stored.slice(6) === plain, needsUpgrade: true };
    }

    if (lower.startsWith('sha256$') || lower.startsWith('sha256:')) {
      return { matched: sha256Hex(plain) === lower.split(/[$:]/).pop(), needsUpgrade: true };
    }

    if (lower.startsWith('sha512$') || lower.startsWith('sha512:')) {
      return { matched: sha512Hex(plain) === lower.split(/[$:]/).pop(), needsUpgrade: true };
    }

    if (lower.startsWith('md5$') || lower.startsWith('md5:')) {
      return { matched: md5Hex(plain) === lower.split(/[$:]/).pop(), needsUpgrade: true };
    }

    if (/^[a-f0-9]{64}$/i.test(normalized)) {
      return { matched: sha256Hex(plain) === lower, needsUpgrade: true };
    }

    if (/^[a-f0-9]{128}$/i.test(normalized)) {
      return { matched: sha512Hex(plain) === lower, needsUpgrade: true };
    }

    if (/^[a-f0-9]{32}$/i.test(normalized)) {
      return { matched: md5Hex(plain) === lower, needsUpgrade: true };
    }

    return { matched: false, needsUpgrade: false };
  }

  async function upgradeStoredPassword(source, username, plainPassword, originalStoredValue, iterations) {
    if (!pool || !source || !source.tableName || !source.passwordColumn) {
      return false;
    }

    const hashedPassword = hashPbkdf2Password(plainPassword, iterations);
    const tableName = quoteIdentifier(source.tableName);
    const passwordColumn = quoteIdentifier(source.passwordColumn);
    const params = [hashedPassword];
    let whereClause = '';

    if (source.idColumn && source.row[source.idColumn] !== undefined && source.row[source.idColumn] !== null) {
      whereClause = `${quoteIdentifier(source.idColumn)} = $2`;
      params.push(source.row[source.idColumn]);
    } else if (source.usernameColumn) {
      whereClause = `${quoteIdentifier(source.usernameColumn)} = $2 AND ${passwordColumn} = $3`;
      params.push(username, originalStoredValue);
    } else {
      return false;
    }

    await pool.query(
      `
      UPDATE ${tableName}
      SET ${passwordColumn} = $1
      WHERE ${whereClause}
      `,
      params
    );

    source.row[source.passwordColumn] = hashedPassword;
    return true;
  }

  function getTokenFromRequest(req, cookieNameValue) {
    const cookies = parseCookies(req.headers.cookie || '');
    return cookies[cookieNameValue] || '';
  }

  return {
    login,
    authenticateRequest,
    requireAdmin,
    sessionCookieHeader,
    clearSessionCookieHeader,
    cookieName,
    checkLoginRateLimit,
    recordLoginFailure,
    recordLoginSuccess
  };
}

function resolveAdminJwtSecret(config) {
  const provided = String(config?.adminJwtSecret || config?.jwtSecret || '').trim();
  if (provided) {
    return provided;
  }

  throw new Error('ADMIN_JWT_SECRET is required');
}

function resolveCookieSameSite(value) {
  const normalized = String(value || 'Strict').trim().toLowerCase();
  if (normalized === 'none') {
    return 'None';
  }
  if (normalized === 'lax') {
    return 'Lax';
  }
  return 'Strict';
}

function verifyPbkdf2Password(plainPassword, storedValue) {
  const parts = String(storedValue || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return { matched: false, needsUpgrade: true };
  }

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expected = parts[3];
  if (!Number.isFinite(iterations) || iterations < 1 || !salt || !expected) {
    return { matched: false, needsUpgrade: true };
  }

  const expectedBytes = Buffer.from(expected, 'base64url');
  const derived = crypto
    .pbkdf2Sync(String(plainPassword), salt, iterations, expectedBytes.length || PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('base64url');

  return {
    matched: timingSafeEqual(derived, expected),
    needsUpgrade: false
  };
}

function hashPbkdf2Password(plainPassword, iterations) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derived = crypto
    .pbkdf2Sync(String(plainPassword), salt, Math.max(1, Number(iterations) || 0), PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('base64url');

  return `pbkdf2$${Math.max(1, Number(iterations) || 0)}$${salt}$${derived}`;
}

function createLoginLimiter({ windowMs, maxAttempts, lockoutMs }) {
  const ipBuckets = new Map();
  const usernameBuckets = new Map();

  function check(req, username) {
    const now = Date.now();
    const status = combineStatuses(
      evaluateBucket(ipBuckets, bucketKey('ip', getClientIp(req)), now, windowMs, maxAttempts, lockoutMs),
      evaluateBucket(usernameBuckets, bucketKey('user', username), now, windowMs, maxAttempts, lockoutMs)
    );

    cleanupBuckets(ipBuckets, now, windowMs);
    cleanupBuckets(usernameBuckets, now, windowMs);
    return status;
  }

  function failure(req, username) {
    const now = Date.now();
    const ipStatus = recordBucketFailure(ipBuckets, bucketKey('ip', getClientIp(req)), now, windowMs, maxAttempts, lockoutMs);
    const userStatus = recordBucketFailure(usernameBuckets, bucketKey('user', username), now, windowMs, maxAttempts, lockoutMs);
    cleanupBuckets(ipBuckets, now, windowMs);
    cleanupBuckets(usernameBuckets, now, windowMs);
    return combineStatuses(ipStatus, userStatus);
  }

  function success(req, username) {
    ipBuckets.delete(bucketKey('ip', getClientIp(req)));
    usernameBuckets.delete(bucketKey('user', username));
    return { locked: false, retryAfterSeconds: 0 };
  }

  return { check, failure, success };
}

function evaluateBucket(map, key, now, windowMs, maxAttempts, lockoutMs) {
  const bucket = ensureBucket(map, key);
  pruneBucket(bucket, now, windowMs);

  if (bucket.lockedUntil && bucket.lockedUntil > now) {
    return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000)) };
  }

  if (bucket.lockedUntil && bucket.lockedUntil <= now) {
    bucket.lockedUntil = 0;
  }

  if (bucket.attempts.length >= maxAttempts) {
    bucket.lockedUntil = now + lockoutMs;
    return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil(lockoutMs / 1000)) };
  }

  return { locked: false, retryAfterSeconds: 0 };
}

function recordBucketFailure(map, key, now, windowMs, maxAttempts, lockoutMs) {
  const bucket = ensureBucket(map, key);
  pruneBucket(bucket, now, windowMs);
  bucket.attempts.push(now);

  if (bucket.attempts.length >= maxAttempts) {
    bucket.lockedUntil = now + lockoutMs;
    return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil(lockoutMs / 1000)) };
  }

  return { locked: false, retryAfterSeconds: 0 };
}

function cleanupBuckets(map, now, windowMs) {
  for (const [key, bucket] of map.entries()) {
    pruneBucket(bucket, now, windowMs);
    if (bucket.attempts.length === 0 && (!bucket.lockedUntil || bucket.lockedUntil <= now)) {
      map.delete(key);
    }
  }
}

function pruneBucket(bucket, now, windowMs) {
  bucket.attempts = bucket.attempts.filter(attempt => now - attempt <= windowMs);
}

function ensureBucket(map, key) {
  if (!map.has(key)) {
    map.set(key, { attempts: [], lockedUntil: 0 });
  }
  return map.get(key);
}

function combineStatuses(...statuses) {
  return statuses.reduce((best, status) => {
    if (!status || !status.locked) {
      return best;
    }
    if (!best.locked || status.retryAfterSeconds > best.retryAfterSeconds) {
      return status;
    }
    return best;
  }, { locked: false, retryAfterSeconds: 0 });
}

function bucketKey(prefix, value) {
  return `${prefix}:${String(value || '').trim().toLowerCase()}`;
}

function getClientIp(req) {
  const remote = String(req.socket?.remoteAddress || req.connection?.remoteAddress || '');
  return remote.replace(/^::ffff:/, '').trim() || 'unknown';
}

function normalizeCandidates(value, fallback) {
  const candidates = [];
  if (Array.isArray(value)) {
    candidates.push(...value);
  } else if (value) {
    candidates.push(value);
  }
  candidates.push(...fallback);
  return [...new Set(candidates.map(item => String(item).trim()).filter(Boolean))];
}

function pickFirstAvailable(columns, candidates) {
  return candidates.find(candidate => columns.includes(candidate)) || null;
}

function isActiveValue(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === null || value === undefined) {
    return true;
  }

  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 't', 'yes', 'y', 'active', 'enabled'].includes(normalized);
}

function quoteIdentifier(value) {
  const name = String(value || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid database identifier: ${name}`);
  }
  return `"${name}"`;
}

function parseCookies(header) {
  return String(header || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf('=');
      if (index === -1) {
        return acc;
      }
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function signJwt(payload, secret, expiresInSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + Math.max(1, Number(expiresInSeconds) || 0)
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', String(secret || ''))
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${signature}`;
}

function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', String(secret || ''))
    .update(signingInput)
    .digest('base64url');

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function base64UrlEncode(value) {
  return Buffer.from(String(value), 'utf8').toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(String(value), 'base64url').toString('utf8');
}

function timingSafeEqual(left, right) {
  const leftBuf = Buffer.from(String(left || ''));
  const rightBuf = Buffer.from(String(right || ''));
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function sha512Hex(value) {
  return crypto.createHash('sha512').update(String(value)).digest('hex');
}

function md5Hex(value) {
  return crypto.createHash('md5').update(String(value)).digest('hex');
}

module.exports = {
  createAdminAuth
};
