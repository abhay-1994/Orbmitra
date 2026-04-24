const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { config } = require('./config');
const { KNOWLEDGE_BASE } = require('./data/knowledge-base');
const { EmbeddingModel } = require('./semantic/embedder');
const { createPostgresPool } = require('./db/postgres');
const { createVectorStore } = require('./db/vector-store');
const { AnalyticsService } = require('./analytics/analytics-service');
const { ChatService } = require('./services/chat-service');
const { createAdminRoutes } = require('./routes/admin');
const { createAdminAuth } = require('./auth/admin-auth');




function createApp() {
  const embedder = new EmbeddingModel();
  const pool = config.usePostgres ? createPostgresPool(config) : null;
  const vectorStore = createVectorStore({ pool, embedder, config });
  const analytics = new AnalyticsService({
    enabled: config.enableAnalytics,
    dataDir: config.dataDir,
    eventsFile: config.eventsFile,
    pool,
    feedbackTable: config.feedbackTable
  });
  const chatService = new ChatService({
    vectorStore,
    analytics,
    embedder,
    knowledgeBase: KNOWLEDGE_BASE
  });
  const auth = createAdminAuth({
    pool,
    config,
    sendJson: (res, statusCode, payload, extraHeaders = {}) => {
      sendJson(res, statusCode, payload, extraHeaders, config);
    }
  });
  const adminRoutes = createAdminRoutes({
    analytics,
    pool,
    config,
    knowledgeBase: KNOWLEDGE_BASE,
    auth,
    chatService
  });

  const initPromise = (async () => {
    await analytics.init(config.questionTable);
    await chatService.init();
  })();

  const swaggerUiPath = path.join(__dirname, '..', 'swagger', 'swagger-ui.html');

  async function handleApi(req, res, pathname) {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'OrbMitra API',
        architecture: {
          frontend: 'static-ui',
          api: 'node-http',
          embedding: 'local-semantic-model',
          vectorDb: pool ? 'postgres+pgvector' : 'in-memory',
          storage: pool ? 'postgres' : 'local-file',
          analytics: config.enableAnalytics ? 'enabled' : 'disabled'
        }
      }, {}, config);
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/stats') {
      sendJson(res, 200, chatService.stats(), {}, config);
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/chat') {
      const payload = await readBody(req);
      const message = String(payload.message || '').trim();
      const topic = String(payload.topic || 'all').toLowerCase();
      const mode = String(payload.mode || 'qa').toLowerCase();

      if (!message) {
        sendJson(res, 400, { error: 'message is required' }, {}, config);
        return true;
      }

      const response = await chatService.answer({ message, topic, mode });
      sendJson(res, 200, response, {}, config);
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/feedback') {
      const payload = await readBody(req);
      const response = await chatService.feedback(payload);
      sendJson(res, 200, response, {}, config);
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/admin/login') {
      const payload = await readBody(req);
      const username = String(payload.username || '').trim();
      const password = String(payload.password || '');
      const limit = auth.checkLoginRateLimit ? auth.checkLoginRateLimit(req, username) : { locked: false, retryAfterSeconds: 0 };
      if (limit?.locked) {
        sendJson(
          res,
          429,
          { error: 'too many login attempts', retryAfterSeconds: limit.retryAfterSeconds || 0 },
          limit.retryAfterSeconds ? { 'Retry-After': String(limit.retryAfterSeconds) } : {},
          config
        );
        return true;
      }

      const result = await auth.login({ username, password });

      if (!result) {
        if (auth.recordLoginFailure) {
          auth.recordLoginFailure(req, username);
        }
        sendJson(res, 401, { error: 'invalid credentials' }, {}, config);
        return true;
      }

      if (auth.recordLoginSuccess) {
        auth.recordLoginSuccess(req, username);
      }

      sendJson(
        res,
        200,
        {
          ok: true,
          admin: result.admin,
          expiresAt: result.expiresAt
        },
        {
          'Set-Cookie': auth.sessionCookieHeader(result.token)
        },
        config
      );
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/admin/session') {
      const admin = await auth.authenticateRequest(req);
      if (!admin) {
        sendJson(res, 401, { error: 'unauthorized' }, {}, config);
        return true;
      }

      sendJson(res, 200, { ok: true, admin }, {}, config);
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/admin/logout') {
      sendJson(
        res,
        200,
        { ok: true },
        {
          'Set-Cookie': auth.clearSessionCookieHeader()
        },
        config
      );
      return true;
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/api/quiz')) {
      const topic = String(new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.get('topic') || 'all').toLowerCase();
      const quiz = chatService.quizQuestion(topic);
      if (!quiz) {
        sendJson(res, 404, { error: 'No quiz questions available' }, {}, config);
        return true;
      }
      sendJson(res, 200, quiz, {}, config);
      return true;
    }

    return false;
  }

  const server = http.createServer(async (req, res) => {
    await initPromise;
    res._requestOrigin = req.headers.origin || '';

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const { pathname } = url;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(res, config));
      res.end();
      return;
    }

    try {
      if (req.method === 'GET' && pathname === '/swagger-ui.html') {
        const admin = await auth.authenticateRequest(req);
        if (!admin) {
          serveSwaggerLoginRequired(res, config);
          return;
        }

        serveSwaggerUi(res, swaggerUiPath, config);
        return;
      }

      if (req.method === 'GET' && pathname === '/openapi.json') {
        const admin = await auth.authenticateRequest(req);
        if (!admin) {
          sendJson(res, 401, { error: 'unauthorized' }, {}, config);
          return;
        }

        sendJson(res, 200, buildOpenApiSpec(req));
        return;
      }

      if (adminRoutes.handle(req, res, pathname)) {
        return;
      }

      if (pathname.startsWith('/api/')) {
        const handled = await handleApi(req, res, pathname);
        if (handled) {
          return;
        }
      }
      sendJson(res, 404, { error: 'Not found' }, {}, config);
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Internal server error' }, {}, config);
    }
  });

  return {
    listen(port, callback) {
      return server.listen(port, callback);
    },
    close(callback) {
      return server.close(callback);
    }
  };
}

function corsHeaders(res, config) {
  const origin = pickAllowedOrigin(res?._requestOrigin, config.frontendOrigin);
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function sendJson(res, statusCode, payload, extraHeaders = {}, config = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(res, config),
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html, config = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    ...corsHeaders(res, config)
  });
  res.end(html);
}

function serveSwaggerUi(res, filePath, config = {}) {
  if (!fs.existsSync(filePath)) {
    sendHtml(res, 404, '<h1>Swagger UI file not found</h1>', config);
    return;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  sendHtml(res, 200, html, config);
}

function serveSwaggerLoginRequired(res, config = {}) {
  const loginUrl = `${config.frontendOrigin || 'http://localhost:5173'}/admin/login`;
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>OrbMitra API Reference</title>
      <style>
        :root {
          color-scheme: dark;
          --bg: #07090e;
          --card: #111520;
          --border: #1a2035;
          --accent: #00e5ff;
          --text: #e2e8f0;
          --muted: #94a3b8;
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); font-family: Arial, sans-serif; }
        body { display: grid; place-items: center; padding: 24px; }
        .card {
          width: min(560px, 100%);
          background: linear-gradient(180deg, rgba(17,21,32,0.98), rgba(13,16,23,0.98));
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 28px 60px rgba(0,0,0,0.35);
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid rgba(0,229,255,0.18);
          color: var(--accent);
          background: rgba(0,229,255,0.08);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }
        h1 { margin: 16px 0 10px; font-size: 30px; line-height: 1.1; }
        p { margin: 0; color: var(--muted); line-height: 1.7; }
        .actions { margin-top: 22px; display: flex; gap: 12px; flex-wrap: wrap; }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 16px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 700;
        }
        .btn.primary { background: var(--accent); color: #021016; }
        .btn.secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .hint {
          margin-top: 18px;
          font-size: 13px;
          color: var(--muted);
          padding-top: 18px;
          border-top: 1px solid var(--border);
        }
      </style>
    </head>
    <body>
      <main class="card">
        <div class="badge">Admin login required</div>
        <h1>Swagger access is locked</h1>
        <p>
          Sign in to the admin panel first. Once you have a valid admin session, Swagger UI and the OpenAPI document will open normally and the admin endpoints will be available.
        </p>
        <div class="actions">
          <a class="btn primary" href="${loginUrl}">Go to admin login</a>
          <a class="btn secondary" href="${config.frontendOrigin || 'http://localhost:5173'}/admin">Open admin panel</a>
        </div>
        <div class="hint">This keeps the API docs and admin content private until you authenticate.</div>
      </main>
    </body>
    </html>
  `;

  sendHtml(res, 401, html, config);
}

function pickAllowedOrigin(origin, fallback) {
  const allowed = String(origin || '').trim();
  if (isLocalOrigin(allowed)) {
    return allowed;
  }
  return fallback || 'http://localhost:5173';
}

function isLocalOrigin(origin) {
  if (!origin) {
    return false;
  }

  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function buildOpenApiSpec(req) {
  const host = req.headers.host || 'localhost:3000';
  const baseUrl = `http://${host}`;

  return {
    openapi: '3.0.3',
    info: {
      title: 'OrbMitra API',
      version: '1.0.0',
      description: 'Swagger documentation for the OrbMitra backend API'
    },
    servers: [
      {
        url: baseUrl
      }
    ],
    paths: {
      '/api/health': {
        get: {
          summary: 'Health check',
          responses: {
            200: {
              description: 'API status'
            }
          }
        }
      },
      '/api/stats': {
        get: {
          summary: 'Get API stats',
          responses: {
            200: {
              description: 'Knowledge base and analytics stats'
            }
          }
        }
      },
      '/api/chat': {
        post: {
          summary: 'Ask the chatbot',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: {
                    message: { type: 'string', example: 'What is Selenium?' },
                    topic: { type: 'string', example: 'selenium' },
                    mode: { type: 'string', example: 'qa' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Chat response'
            }
          }
        }
      },
      '/api/feedback': {
        post: {
          summary: 'Submit feedback',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    reply: { type: 'string' },
                    topic: { type: 'string' },
                    rating: { type: 'integer' },
                    helpful: { type: 'boolean' },
                    comment: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Feedback saved'
            }
          }
        }
      },
      '/api/quiz': {
        get: {
          summary: 'Get a quiz question',
          parameters: [
            {
              name: 'topic',
              in: 'query',
              schema: { type: 'string', example: 'api' }
            }
          ],
          responses: {
            200: {
              description: 'Quiz question'
            }
          }
        }
      },
      '/api/admin/login': {
        post: {
          summary: 'Admin login',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'password'],
                  properties: {
                    username: { type: 'string', example: '<admin username>' },
                    password: { type: 'string', example: '<admin password>' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'JWT cookie issued' },
            401: { description: 'Invalid credentials' },
            429: { description: 'Too many login attempts' }
          }
        }
      },
      '/api/admin/session': {
        get: {
          summary: 'Current admin session',
          responses: {
            200: { description: 'Active session' },
            401: { description: 'No active session' }
          }
        }
      },
      '/api/admin/logout': {
        post: {
          summary: 'Admin logout',
          responses: {
            200: { description: 'Session cleared' }
          }
        }
      },
      '/api/admin/events': {
        get: {
          summary: 'Recent admin events',
          security: [
            { cookieAuth: [] }
          ],
          responses: {
            200: {
              description: 'Recent events'
            }
          }
        }
      },
      '/api/admin/questions': {
        get: {
          summary: 'Recent chat questions waiting for review',
          security: [
            { cookieAuth: [] }
          ],
          responses: {
            200: {
              description: 'Recent question submissions'
            }
          }
        }
      },
      '/api/admin/questions/{id}': {
        put: {
          summary: 'Update a question answer and promote it to knowledge base',
          security: [
            { cookieAuth: [] }
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer', example: 1 }
            }
          ],
          responses: {
            200: {
              description: 'Question updated'
            },
            404: {
              description: 'Question not found'
            }
          }
        }
      },
      '/api/admin/stream': {
        get: {
          summary: 'Live event stream',
          security: [
            { cookieAuth: [] }
          ],
          responses: {
            200: {
              description: 'Server-sent event stream'
            }
          }
        }
      },
      '/api/admin/database': {
        get: {
          summary: 'Database snapshot',
          security: [
            { cookieAuth: [] }
          ],
          responses: {
            200: {
              description: 'Table counts and recent rows'
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: config.adminCookieName || 'orbmitra_admin_token',
          description: 'HttpOnly admin session cookie issued after login'
        }
      }
    }
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  createApp
};
