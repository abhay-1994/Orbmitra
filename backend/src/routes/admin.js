function createAdminRoutes({ analytics, pool, config, knowledgeBase = [], auth, chatService }) {
  async function getDatabaseSnapshot() {
    if (!pool) {
      const feedbackEvents = analytics.recentEvents(500).filter(event => event.type === 'feedback');
      const questions = analytics.recentQuestions(500);
      return {
        connected: false,
        mode: 'in-memory',
        updatedAt: new Date().toISOString(),
        tables: {
          knowledge_embeddings: {
            name: 'knowledge_embeddings',
            count: knowledgeBase.length,
            recent: knowledgeBase.slice(-5).reverse().map(mapKnowledgeRow)
          },
          chat_feedback: {
            name: 'chat_feedback',
            count: feedbackEvents.length,
            recent: feedbackEvents.slice(-5).reverse()
          },
          chat_questions: {
            name: 'chat_questions',
            count: questions.length,
            recent: questions.slice(-5).reverse()
          },
          chat_events: {
            name: 'chat_events',
            count: analytics.recentEvents(500).length,
            recent: analytics.recentEvents(5).slice().reverse()
          }
        }
      };
    }

    const tables = {};
    const definitions = [
      {
        key: 'knowledge_embeddings',
        table: config.vectorTable,
        recentQuery: `
          SELECT id, topic, question, answer, created_at
          FROM ${quoteIdentifier(config.vectorTable)}
          ORDER BY created_at DESC
          LIMIT 5
        `
      },
      {
        key: 'chat_feedback',
        table: config.feedbackTable,
        recentQuery: `
          SELECT id, message, reply, topic, rating, helpful, comment, created_at
          FROM ${quoteIdentifier(config.feedbackTable)}
          ORDER BY created_at DESC
          LIMIT 5
        `
      },
      {
        key: 'chat_questions',
        table: config.questionTable,
        recentQuery: `
          SELECT id, message, reply, topic, confidence, mode, source, match_question, match_id, status, corrected_answer, corrected_by, corrected_at, reviewed_at, created_at, updated_at
          FROM ${quoteIdentifier(config.questionTable)}
          ORDER BY created_at DESC
          LIMIT 5
        `
      },
      {
        key: 'chat_events',
        table: 'chat_events',
        recentQuery: `
          SELECT id, event_type, message, topic, source, confidence, payload, created_at
          FROM chat_events
          ORDER BY created_at DESC
          LIMIT 5
        `
      }
    ];

    for (const definition of definitions) {
      const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(definition.table)}`);
      const recentResult = await pool.query(definition.recentQuery);
      tables[definition.key] = {
        name: definition.table,
        count: countResult.rows[0]?.count || 0,
        recent: recentResult.rows
      };
    }

    return {
      connected: true,
      mode: 'postgres+pgvector',
      updatedAt: new Date().toISOString(),
      tables
    };
  }

  function handle(req, res, pathname) {
    if (req.method === 'GET' && pathname === '/api/admin/events') {
      guard(req, res, async () => {
        sendJson(res, 200, { events: analytics.recentEvents(100) }, config);
      });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/admin/questions') {
      guard(req, res, async () => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 100)));
        const status = String(url.searchParams.get('status') || 'all').toLowerCase();
        let questions = analytics.recentQuestions(limit);
        if (status !== 'all') {
          questions = questions.filter(item => String(item.status || '').toLowerCase() === status);
        }
        sendJson(res, 200, { questions }, config);
      });
      return true;
    }

    if (req.method === 'PUT' && /^\/api\/admin\/questions\/\d+$/.test(pathname)) {
      guard(req, res, async () => {
        const id = Number(pathname.split('/').pop());
        const payload = await readBody(req);
        const current = analytics.recentQuestions(1000).find(item => Number(item.id) === id);
        if (!current) {
          sendJson(res, 404, { error: 'Question not found' }, config);
          return;
        }

        const correctedAnswer = String(payload.correctedAnswer || payload.answer || '').trim();
        const topic = String(payload.topic || current.topic || 'general').trim() || 'general';
        const status = String(payload.status || (correctedAnswer ? 'corrected' : current.status || 'pending')).trim() || 'pending';
        const reviewRecord = await analytics.updateQuestion(id, {
          topic,
          status,
          correctedAnswer: correctedAnswer || current.correctedAnswer || null,
          reviewedAt: new Date().toISOString(),
          correctedBy: payload.correctedBy || 'admin'
        });

        const finalAnswer = correctedAnswer || current.correctedAnswer || current.reply;
        if (chatService && typeof chatService.upsertKnowledgeEntry === 'function' && finalAnswer) {
          const knowledgeId = Number.isFinite(current.matchId) ? Number(current.matchId) : Number(current.id);
          await chatService.upsertKnowledgeEntry({
            id: knowledgeId,
            topic,
            question: current.message,
            answer: finalAnswer
          });
        }

        sendJson(res, 200, {
          ok: true,
          question: reviewRecord || current,
          appliedAnswer: finalAnswer
        }, config);
      });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/admin/database') {
      guard(req, res, async () => {
        const snapshot = await getDatabaseSnapshot();
        sendJson(res, 200, snapshot, config);
      });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/admin/stream') {
      guard(req, res, () => {
        handleAdminStream(req, res, analytics, config);
      });
      return true;
    }

    return false;
  }

  function guard(req, res, handler) {
    if (!auth || typeof auth.requireAdmin !== 'function') {
      sendJson(res, 500, { error: 'Admin auth is not configured' }, config);
      return;
    }

    auth.requireAdmin(req, res)
      .then(admin => {
        if (!admin) {
          return;
        }
        return Promise.resolve(handler(admin));
      })
      .catch(error => {
        sendJson(res, 500, { error: error.message || 'Unable to load admin route' }, config);
      });
  }

  return { handle };
}

function handleAdminStream(req, res, analytics, config) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    ...corsHeaders(res, config)
  });

  const send = payload => {
    res.write('event: update\n');
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  analytics.recentEvents(25).forEach(event => send(event));
  analytics.recentQuestions(25).forEach(question => send(question));

  const unsubscribe = analytics.subscribe(send);
  const heartbeat = setInterval(() => {
    res.write('event: ping\n');
    res.write(`data: ${JSON.stringify({ ok: true, at: new Date().toISOString() })}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
}

function mapKnowledgeRow(item) {
  return {
    id: item.id,
    topic: item.topic,
    question: item.question,
    answer: item.answer
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

function quoteIdentifier(value) {
  const name = String(value || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid database identifier: ${name}`);
  }
  return `"${name}"`;
}

function corsHeaders(res, config = {}) {
  return corsHeadersForOrigin(config, res?._requestOrigin || '');
}

function corsHeadersForOrigin(config = {}, origin = '') {
  const allowedOrigin = pickAllowedOrigin(origin, config.frontendOrigin);
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function sendJson(res, statusCode, payload, config = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(res, config)
  });
  res.end(JSON.stringify(payload));
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

module.exports = {
  createAdminRoutes
};
