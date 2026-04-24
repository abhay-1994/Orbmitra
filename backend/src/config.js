const path = require('path');
const backendRoot = path.join(__dirname, '..');

function resolveBackendPath(value, fallback) {
  const raw = value || fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(backendRoot, raw);
}

const config = {
  port: Number(process.env.PORT || 3000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || `http://localhost:${Number(process.env.FRONTEND_PORT || 5173)}`,
  dataDir: resolveBackendPath(process.env.DATA_DIR, 'data'),
  databaseUrl: process.env.DATABASE_URL || '',
  postgresHost: process.env.POSTGRES_HOST || 'localhost',
  postgresPort: Number(process.env.POSTGRES_PORT || 5432),
  postgresUser: process.env.POSTGRES_USER || '',
  postgresPassword: process.env.POSTGRES_PASSWORD || '',
  postgresDatabase: process.env.POSTGRES_DB || '',
  usePostgres: String(process.env.USE_POSTGRES || '').toLowerCase() === 'true',
  enableAnalytics: String(process.env.ENABLE_ANALYTICS || 'true').toLowerCase() !== 'false',
  vectorTable: process.env.VECTOR_TABLE || 'knowledge_embeddings',
  feedbackTable: process.env.FEEDBACK_TABLE || 'chat_feedback',
  questionTable: process.env.QUESTION_TABLE || 'chat_questions',
  eventsFile: resolveBackendPath(process.env.EVENTS_FILE, path.join('data', 'events.jsonl')),
  adminJwtSecret: process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || '',
  adminCookieName: process.env.ADMIN_COOKIE_NAME || 'orbmitra_admin_token',
  adminCookieSameSite: process.env.ADMIN_COOKIE_SAME_SITE || 'Strict',
  adminTokenTtlSeconds: Number(process.env.ADMIN_TOKEN_TTL_SECONDS || 60 * 60 * 8),
  adminLoginMaxAttempts: Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 5),
  adminLoginWindowSeconds: Number(process.env.ADMIN_LOGIN_WINDOW_SECONDS || 15 * 60),
  adminLoginLockoutSeconds: Number(process.env.ADMIN_LOGIN_LOCKOUT_SECONDS || 15 * 60),
  adminPasswordIterations: Number(process.env.ADMIN_PASSWORD_ITERATIONS || 310000),
  adminTable: process.env.ADMIN_TABLE || '',
  adminUsernameColumn: process.env.ADMIN_USERNAME_COLUMN || '',
  adminPasswordColumn: process.env.ADMIN_PASSWORD_COLUMN || '',
  adminNameColumn: process.env.ADMIN_NAME_COLUMN || '',
  adminRoleColumn: process.env.ADMIN_ROLE_COLUMN || '',
  adminActiveColumn: process.env.ADMIN_ACTIVE_COLUMN || '',
  adminIdColumn: process.env.ADMIN_ID_COLUMN || ''
};

module.exports = { config };
