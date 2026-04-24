let PgPool = null;

try {
  // Optional dependency: install `pg` only when you want a live Postgres connection.
  ({ Pool: PgPool } = require('pg'));
} catch {
  PgPool = null;
}

function createPostgresPool(config) {
  const connectionString = resolveConnectionString(config);
  if (!connectionString || !PgPool) {
    return null;
  }

  return new PgPool({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') || connectionString.includes('[::1]')
      ? false
      : { rejectUnauthorized: false }
  });
}

function resolveConnectionString(config = {}) {
  if (config.databaseUrl) {
    return String(config.databaseUrl);
  }

  const host = String(config.postgresHost || '').trim();
  const user = String(config.postgresUser || '').trim();
  const password = String(config.postgresPassword || '');
  const database = String(config.postgresDatabase || '').trim();
  const port = Number(config.postgresPort || 5432);

  if (!host || !user || !database) {
    return '';
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

module.exports = {
  createPostgresPool
};
