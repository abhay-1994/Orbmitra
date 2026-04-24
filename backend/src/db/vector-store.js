const { EmbeddingModel } = require('../semantic/embedder');
const { preprocess } = require('../semantic/text');

class InMemoryVectorStore {
  constructor(embedder = new EmbeddingModel()) {
    this.embedder = embedder;
    this.documents = [];
  }

  async init(documents = []) {
    this.documents = documents.map(doc => normalizeDocument(doc, this.embedder));
  }

  async upsert(documents = []) {
    const nextDocs = new Map(this.documents.map(doc => [String(doc.id), doc]));
    for (const doc of documents) {
      const normalized = normalizeDocument(doc, this.embedder);
      nextDocs.set(String(normalized.id), normalized);
    }
    this.documents = Array.from(nextDocs.values());
  }

  async search(query, { topK = 5, topic = 'all' } = {}) {
    const queryEmbedding = this.embedder.embed(query);
    const queryTerms = preprocess(query).stemmed;
    const queryLower = normalizeText(query);
    const scored = this.documents.map(doc => {
      const similarity = this.embedder.similarity(queryEmbedding, doc.embedding);
      const combinedOverlap = overlapScore(queryTerms, doc.terms);
      const questionOverlap = overlapScore(queryTerms, doc.questionTerms);
      const exactBoost = doc.questionLower === queryLower ? 0.7 : (doc.questionLower.includes(queryLower) ? 0.35 : 0);
      const topicBonus = topic !== 'all' && doc.topic === topic ? 0.1 : 0;
      return {
        ...doc,
        score: Math.min((similarity * 0.45) + (combinedOverlap * 0.25) + (questionOverlap * 0.15) + exactBoost + topicBonus, 1)
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async all() {
    return this.documents.slice();
  }
}

function overlapScore(left, right) {
  if (!left.length || !right.length) {
    return 0;
  }

  const rightSet = new Set(right);
  const matches = left.filter(token => rightSet.has(token)).length;
  return matches / Math.max(left.length, right.length);
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

class PostgresVectorStore {
  constructor(pool, embedder = new EmbeddingModel(), config = {}) {
    this.pool = pool;
    this.embedder = embedder;
    this.config = config;
  }

  async init(documents = []) {
    if (!this.pool) {
      return false;
    }

    await this.pool.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE TABLE IF NOT EXISTS ${this.config.vectorTable} (
        id INTEGER PRIMARY KEY,
        topic TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        embedding vector(64) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const doc of documents) {
      const embedding = this.embedder.embed(`${doc.question} ${doc.answer}`);
      await this.pool.query(
        `
        INSERT INTO ${this.config.vectorTable} (id, topic, question, answer, embedding)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE
        SET topic = EXCLUDED.topic,
            question = EXCLUDED.question,
            answer = EXCLUDED.answer,
            embedding = EXCLUDED.embedding
        `,
        [doc.id, doc.topic, doc.question, doc.answer, JSON.stringify(embedding)]
      );
    }

    return true;
  }

  async upsert(documents = []) {
    return this.init(documents);
  }

  async all({ limit = 500 } = {}) {
    const safeLimit = Math.max(1, Number(limit) || 1);
    const result = await this.pool.query(
      `
      SELECT id, topic, question, answer, embedding, created_at
      FROM ${this.config.vectorTable}
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [safeLimit]
    );

    return result.rows.map(row => ({
      id: row.id,
      topic: row.topic,
      question: row.question,
      answer: row.answer,
      score: 1,
      embedding: row.embedding,
      createdAt: row.created_at
    }));
  }

  async search(query, { topK = 5, topic = 'all' } = {}) {
    if (!this.pool) {
      return [];
    }

    const embedding = this.embedder.embed(query);
    const params = [JSON.stringify(embedding)];
    const whereClause = topic !== 'all' ? 'WHERE topic = $2' : '';
    const limitClause = topic !== 'all' ? 'LIMIT $3' : 'LIMIT $2';
    if (topic !== 'all') {
      params.push(topic);
      params.push(topK);
    } else {
      params.push(topK);
    }

    const candidates = await this.pool.query(
      `
      SELECT id, topic, question, answer, embedding
      FROM ${this.config.vectorTable}
      ${whereClause}
      ORDER BY embedding <-> $1::vector
      ${limitClause}
      `,
      params
    );

    return candidates.rows.map(row => ({
      id: row.id,
      topic: row.topic,
      question: row.question,
      answer: row.answer,
      score: 1,
      embedding: row.embedding
    }));
  }
}

function createVectorStore({ pool, embedder, config }) {
  if (pool) {
    return new PostgresVectorStore(pool, embedder, config);
  }
  return new InMemoryVectorStore(embedder);
}

function normalizeDocument(doc, embedder) {
  return {
    ...doc,
    embedding: embedder.embed(`${doc.question} ${doc.answer}`),
    terms: preprocess(`${doc.question} ${doc.answer}`).stemmed,
    questionTerms: preprocess(doc.question).stemmed,
    questionLower: normalizeText(doc.question)
  };
}

module.exports = {
  InMemoryVectorStore,
  PostgresVectorStore,
  createVectorStore
};
