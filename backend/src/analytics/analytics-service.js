const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class AnalyticsService {
  constructor({ enabled, enableAnalytics, dataDir, eventsFile, pool, feedbackTable }) {
    this.enabled = typeof enabled === 'boolean' ? enabled : Boolean(enableAnalytics);
    this.dataDir = dataDir;
    this.eventsFile = path.isAbsolute(eventsFile)
      ? eventsFile
      : path.join(dataDir, eventsFile);
    this.eventsDir = path.dirname(this.eventsFile);
    this.pool = pool;
    this.feedbackTable = feedbackTable;
    this.questionTable = null;
    this.memoryEvents = [];
    this.memoryQuestions = [];
    this.emitter = new EventEmitter();
  }

  ensureDir() {
    fs.mkdirSync(this.eventsDir, { recursive: true });
  }

  async init(questionTable = 'chat_questions') {
    this.questionTable = questionTable;
    if (this.pool) {
      if (this.enabled) {
        this.ensureDir();
      }
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.feedbackTable} (
          id BIGSERIAL PRIMARY KEY,
          message TEXT NOT NULL,
          reply TEXT,
          topic TEXT,
          rating INTEGER,
          helpful BOOLEAN,
          comment TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${this.questionTable} (
          id BIGSERIAL PRIMARY KEY,
          message TEXT NOT NULL,
          reply TEXT NOT NULL,
          topic TEXT NOT NULL DEFAULT 'general',
          confidence NUMERIC,
          mode TEXT NOT NULL DEFAULT 'qa',
          source TEXT,
          match_question TEXT,
          match_id INTEGER,
          status TEXT NOT NULL DEFAULT 'pending',
          corrected_answer TEXT,
          corrected_by TEXT,
          corrected_at TIMESTAMPTZ,
          reviewed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      const recentQuestions = await this.pool.query(`
        SELECT *
        FROM ${this.questionTable}
        ORDER BY created_at DESC
        LIMIT 200
      `);
      this.memoryQuestions = recentQuestions.rows.map(normalizeDbQuestion).reverse();
      return;
    }

    if (this.enabled) {
      this.ensureDir();
    }
  }

  async recordEvent(event) {
    if (!this.enabled) {
      return;
    }

    const payload = {
      id: Date.now() + Math.random(),
      ...event,
      createdAt: new Date().toISOString()
    };

    this.memoryEvents.push(payload);
    if (this.memoryEvents.length > 500) {
      this.memoryEvents.shift();
    }
    this.ensureDir();
    fs.appendFileSync(this.eventsFile, `${JSON.stringify(payload)}\n`, 'utf8');
    this.emitter.emit('event', payload);
  }

  async recordFeedback(feedback) {
    if (!this.enabled) {
      return;
    }

    await this.recordEvent({
      type: 'feedback',
      ...feedback
    });

    if (this.pool) {
      await this.pool.query(
        `
        INSERT INTO ${this.feedbackTable} (message, reply, topic, rating, helpful, comment)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          feedback.message || '',
          feedback.reply || '',
          feedback.topic || 'general',
          Number.isFinite(feedback.rating) ? feedback.rating : null,
          typeof feedback.helpful === 'boolean' ? feedback.helpful : null,
          feedback.comment || null
        ]
      );
    }
  }

  async recordQuestion(question) {
    const payload = {
      type: 'question',
      message: String(question.message || ''),
      reply: String(question.reply || ''),
      topic: String(question.topic || 'general'),
      confidence: Number.isFinite(question.confidence) ? question.confidence : null,
      mode: String(question.mode || 'qa'),
      source: String(question.source || 'vector'),
      matchQuestion: question.matchQuestion || null,
      matchId: Number.isFinite(question.matchId) ? question.matchId : null,
      status: String(question.status || 'pending'),
      correctedAnswer: question.correctedAnswer || null,
      correctedBy: question.correctedBy || null,
      correctedAt: question.correctedAt || null,
      reviewedAt: question.reviewedAt || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.pool && this.questionTable) {
      const result = await this.pool.query(
        `
        INSERT INTO ${this.questionTable}
          (message, reply, topic, confidence, mode, source, match_question, match_id, status, corrected_answer, corrected_by, corrected_at, reviewed_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
        `,
        [
          payload.message,
          payload.reply,
          payload.topic,
          payload.confidence,
          payload.mode,
          payload.source,
          payload.matchQuestion,
          payload.matchId,
          payload.status,
          payload.correctedAnswer,
          payload.correctedBy,
          payload.correctedAt,
          payload.reviewedAt
        ]
      );

      const stored = normalizeDbQuestion(result.rows[0]);
      this.memoryQuestions = [
        ...this.memoryQuestions.filter(item => Number(item.id) !== Number(stored.id)),
        stored
      ].slice(-1000);
      this.emitter.emit('event', stored);
      return stored;
    }

    payload.id = Date.now() + Math.random();
    this.memoryQuestions.push(payload);
    if (this.memoryQuestions.length > 1000) {
      this.memoryQuestions.shift();
    }
    this.emitter.emit('event', payload);
    return payload;
  }

  async updateQuestion(id, updates = {}) {
    const questionId = Number(id);
    if (!Number.isFinite(questionId)) {
      return null;
    }

    const existing = this.memoryQuestions.find(item => Number(item.id) === questionId) || null;
    const next = existing ? { ...existing } : null;

    if (next) {
      if (updates.message !== undefined) next.message = String(updates.message);
      if (updates.reply !== undefined) next.reply = String(updates.reply);
      if (updates.topic !== undefined) next.topic = String(updates.topic || 'general');
      if (updates.confidence !== undefined) next.confidence = Number.isFinite(updates.confidence) ? updates.confidence : next.confidence;
      if (updates.mode !== undefined) next.mode = String(updates.mode || 'qa');
      if (updates.source !== undefined) next.source = String(updates.source || next.source || 'vector');
      if (updates.matchQuestion !== undefined) next.matchQuestion = updates.matchQuestion;
      if (updates.matchId !== undefined) next.matchId = Number.isFinite(updates.matchId) ? updates.matchId : next.matchId;
      if (updates.status !== undefined) next.status = String(updates.status || 'pending');
      if (updates.correctedAnswer !== undefined) next.correctedAnswer = updates.correctedAnswer || null;
      if (updates.correctedBy !== undefined) next.correctedBy = updates.correctedBy || null;
      if (updates.correctedAt !== undefined) next.correctedAt = updates.correctedAt || null;
      if (updates.reviewedAt !== undefined) next.reviewedAt = updates.reviewedAt || null;
      next.updatedAt = new Date().toISOString();
      this.memoryQuestions = this.memoryQuestions.map(item => (Number(item.id) === questionId ? next : item));
    }

    if (this.pool && this.questionTable) {
      const columns = [];
      const values = [];
      const add = (column, value) => {
        columns.push(`${column} = $${values.length + 1}`);
        values.push(value);
      };

      if (updates.message !== undefined) add('message', String(updates.message));
      if (updates.reply !== undefined) add('reply', String(updates.reply));
      if (updates.topic !== undefined) add('topic', String(updates.topic || 'general'));
      if (updates.confidence !== undefined) add('confidence', Number.isFinite(updates.confidence) ? updates.confidence : null);
      if (updates.mode !== undefined) add('mode', String(updates.mode || 'qa'));
      if (updates.source !== undefined) add('source', String(updates.source || 'vector'));
      if (updates.matchQuestion !== undefined) add('match_question', updates.matchQuestion || null);
      if (updates.matchId !== undefined) add('match_id', Number.isFinite(updates.matchId) ? updates.matchId : null);
      if (updates.status !== undefined) add('status', String(updates.status || 'pending'));
      if (updates.correctedAnswer !== undefined) add('corrected_answer', updates.correctedAnswer || null);
      if (updates.correctedBy !== undefined) add('corrected_by', updates.correctedBy || null);
      if (updates.correctedAt !== undefined) add('corrected_at', updates.correctedAt || null);
      if (updates.reviewedAt !== undefined) add('reviewed_at', updates.reviewedAt || null);
      columns.push(`updated_at = NOW()`);

      if (columns.length > 0) {
        values.push(questionId);
        const result = await this.pool.query(
          `
          UPDATE ${this.questionTable}
          SET ${columns.join(', ')}
          WHERE id = $${values.length}
          RETURNING *
          `,
          values
        );
        const row = normalizeDbQuestion(result.rows[0]);
        this.memoryQuestions = this.memoryQuestions.map(item => (Number(item.id) === questionId ? row : item));
        return row;
      }
    }

    return next;
  }

  recentQuestions(limit = 50) {
    const safeLimit = Math.max(1, Number(limit) || 1);
    return this.memoryQuestions.slice(-safeLimit).reverse();
  }

  stats() {
    return {
      totalEvents: this.memoryEvents.length,
      totalQuestions: this.memoryQuestions.length
    };
  }

  recentEvents(limit = 50) {
    return this.memoryEvents.slice(-Math.max(1, limit));
  }

  subscribe(handler) {
    this.emitter.on('event', handler);
    return () => this.emitter.off('event', handler);
  }
}

module.exports = {
  AnalyticsService
};

function normalizeDbQuestion(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    type: 'question',
    message: row.message,
    reply: row.reply,
    topic: row.topic,
    confidence: row.confidence !== undefined && row.confidence !== null ? Number(row.confidence) : null,
    mode: row.mode,
    source: row.source,
    matchQuestion: row.match_question || row.matchQuestion || null,
    matchId: row.match_id || row.matchId || null,
    status: row.status,
    correctedAnswer: row.corrected_answer || row.correctedAnswer || null,
    correctedBy: row.corrected_by || row.correctedBy || null,
    correctedAt: row.corrected_at || row.correctedAt || null,
    reviewedAt: row.reviewed_at || row.reviewedAt || null,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null
  };
}
