const { KNOWLEDGE_BASE } = require('../data/knowledge-base');
const { preprocess } = require('../semantic/text');
const { detectIntent } = require('../semantic/intent-detector');
const { EmbeddingModel } = require('../semantic/embedder');
const { createVectorStore } = require('../db/vector-store');

class ChatService {
  constructor({ vectorStore, analytics, embedder = new EmbeddingModel(), knowledgeBase = KNOWLEDGE_BASE }) {
    this.vectorStore = vectorStore || createVectorStore({ embedder, pool: null, config: {} });
    this.analytics = analytics;
    this.embedder = embedder;
    this.knowledgeBase = knowledgeBase;
  }

  async init() {
    await this.vectorStore.init(this.knowledgeBase);
    if (typeof this.vectorStore.all === 'function') {
      const stored = await this.vectorStore.all();
      if (Array.isArray(stored) && stored.length > 0) {
        this.knowledgeBase = stored.map(item => ({
          id: item.id,
          topic: item.topic,
          question: item.question,
          answer: item.answer
        }));
      }
    }
  }

  stats() {
    const topics = this.knowledgeBase.reduce((acc, item) => {
      acc[item.topic] = (acc[item.topic] || 0) + 1;
      acc.all = (acc.all || 0) + 1;
      return acc;
    }, {});

    return {
      total: this.knowledgeBase.length,
      topics,
      analytics: this.analytics ? this.analytics.stats() : { totalEvents: 0 }
    };
  }

  buildRelated(topic, excludeId, items = []) {
    const matches = items
      .filter(item => item.topic === topic && item.id !== excludeId)
      .slice(0, 3)
      .map(item => ({
        id: item.id,
        topic: item.topic,
        question: item.question
      }));

    if (matches.length > 0) {
      return matches;
    }

    return this.knowledgeBase
      .filter(item => item.topic === topic && item.id !== excludeId)
      .slice(0, 3)
      .map(item => ({
        id: item.id,
        topic: item.topic,
        question: item.question
      }));
  }

  heuristicReply(message) {
    const lower = message.toLowerCase();

    if (/^(hi|hello|hey|howdy|namaste|sup)\b/.test(lower)) {
      return {
        reply: "Hello! I'm OrbMitra AI, your QA intelligence assistant. Ask me about Selenium, TestNG, API testing, Java, or interview prep.",
        topic: 'general',
        confidence: 1,
        intent: 'general'
      };
    }

    if (/^(thanks|thank you|thx|ty)\b/.test(lower)) {
      return {
        reply: "You're welcome. Keep learning and keep testing.",
        topic: 'general',
        confidence: 1,
        intent: 'general'
      };
    }

    if (/help/.test(lower) && lower.length < 15) {
      return {
        reply: [
          'I can help you with:',
          '- Selenium: locators, waits, POM, Grid',
          '- TestNG: annotations, DataProvider, parallel execution',
          '- API testing: REST, HTTP, RestAssured, Postman',
          '- Java: OOP, collections, exception handling',
          '- Agile: Scrum, CI/CD, BDD, TDD',
          '- Interview prep: common QA questions'
        ].join('\n'),
        topic: 'general',
        confidence: 1,
        intent: 'general'
      };
    }

    return null;
  }

  async answer({ message, topic = 'all', mode = 'qa' }) {
    const heuristic = this.heuristicReply(message);
    if (heuristic) {
      await this.analytics?.recordEvent({
        type: 'chat',
        message,
        topic: heuristic.topic,
        confidence: heuristic.confidence,
        mode,
        source: 'heuristic',
        reply: heuristic.reply
      });

      await this.analytics?.recordQuestion({
        message,
        reply: heuristic.reply,
        topic: heuristic.topic,
        confidence: heuristic.confidence,
        mode,
        source: 'heuristic',
        status: 'answered'
      });

      return {
        ...heuristic,
        mode,
        processed: preprocess(message),
        related: this.buildRelated(heuristic.topic, null)
      };
    }

    const exactMatch = this.findExactMatch(message, topic);
    if (exactMatch) {
      const related = this.buildRelated(exactMatch.topic, exactMatch.id);
      await this.analytics?.recordEvent({
        type: 'chat',
        message,
        topic: exactMatch.topic,
        confidence: 0.99,
        mode,
        source: 'exact-match',
        reply: exactMatch.answer
      });

      await this.analytics?.recordQuestion({
        message,
        reply: exactMatch.answer,
        topic: exactMatch.topic,
        confidence: 0.99,
        mode,
        source: 'exact-match',
        matchQuestion: exactMatch.question,
        matchId: exactMatch.id,
        status: 'answered'
      });

      return {
        reply: exactMatch.answer,
        topic: exactMatch.topic,
        confidence: 0.99,
        intent: exactMatch.topic,
        match: {
          id: exactMatch.id,
          topic: exactMatch.topic,
          question: exactMatch.question
        },
        related,
        mode,
        processed: preprocess(message)
      };
    }

    const processed = preprocess(message);
    const intent = detectIntent(processed.stemmed);
    const results = await this.vectorStore.search(message, { topK: 5, topic });
    const best = results[0];

    const lowConfidence = !best || typeof best.score !== 'number' || best.score < 0.08;
    const fallback = lowConfidence
      ? {
          reply: "I don't have a confident answer for that yet. Try rephrasing, or ask about Selenium, TestNG, API testing, Java, or interview prep topics.",
          topic: 'general',
          confidence: 0.1,
          intent
        }
      : {
          reply: best.answer,
          topic: best.topic,
          confidence: best.score,
          intent,
          match: {
            id: best.id,
            topic: best.topic,
            question: best.question
          },
          related: this.buildRelated(best.topic, best.id, results.slice(1))
        };

    await this.analytics?.recordEvent({
      type: 'chat',
      message,
      topic: fallback.topic,
      confidence: fallback.confidence,
      mode,
      source: lowConfidence ? 'fallback' : 'vector',
      reply: fallback.reply
    });

    await this.analytics?.recordQuestion({
      message,
      reply: fallback.reply,
      topic: fallback.topic,
      confidence: fallback.confidence,
      mode,
      source: lowConfidence ? 'fallback' : 'vector',
      matchQuestion: fallback.match?.question || null,
      matchId: fallback.match?.id || null,
      status: lowConfidence ? 'pending' : 'answered'
    });

    return {
      ...fallback,
      mode,
      processed,
      related: fallback.related || this.buildRelated(fallback.topic, fallback.match?.id, results.slice(1))
    };
  }

  async feedback(payload) {
    await this.analytics?.recordFeedback(payload);
    return { ok: true };
  }

  async upsertKnowledgeEntry(entry) {
    const normalized = {
      id: Number(entry.id),
      topic: String(entry.topic || 'general'),
      question: String(entry.question || '').trim(),
      answer: String(entry.answer || '').trim()
    };

    if (!normalized.question || !normalized.answer) {
      return null;
    }

    const existingIndex = this.knowledgeBase.findIndex(item => Number(item.id) === normalized.id);
    if (existingIndex >= 0) {
      this.knowledgeBase[existingIndex] = normalized;
    } else {
      const questionKey = normalizeText(normalized.question);
      const questionIndex = this.knowledgeBase.findIndex(item => normalizeText(item.question) === questionKey);
      if (questionIndex >= 0) {
        this.knowledgeBase[questionIndex] = {
          ...this.knowledgeBase[questionIndex],
          ...normalized
        };
      } else {
        this.knowledgeBase.push(normalized);
      }
    }

    if (this.vectorStore && typeof this.vectorStore.upsert === 'function') {
      await this.vectorStore.upsert([normalized]);
    }

    return normalized;
  }

  quizQuestion(topic = 'all') {
    const pool = topic !== 'all'
      ? this.knowledgeBase.filter(item => item.topic === topic)
      : this.knowledgeBase;

    const fallbackPool = pool.length > 0 ? pool : this.knowledgeBase;
    if (fallbackPool.length === 0) return null;

    const pick = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    return {
      id: pick.id,
      topic: pick.topic,
      question: pick.question,
      answer: pick.answer
    };
  }

  findExactMatch(message, topic) {
    const query = normalizeText(message);
    const candidates = topic !== 'all'
      ? this.knowledgeBase.filter(item => item.topic === topic)
      : this.knowledgeBase;

    return candidates.find(item => normalizeText(item.question) === query)
      || candidates.find(item => normalizeText(item.question).includes(query) && query.length >= 8)
      || null;
  }
}

module.exports = {
  ChatService
};

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
