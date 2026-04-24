const { preprocess } = require('./text');

class EmbeddingModel {
  constructor(dimension = 64) {
    this.dimension = dimension;
  }

  hashToken(token) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash) >>> 0;
  }

  embed(text) {
    const { stemmed } = preprocess(text);
    const vector = new Array(this.dimension).fill(0);

    stemmed.forEach(token => {
      const index = this.hashToken(token) % this.dimension;
      const weight = 1 + Math.min(token.length / 10, 1);
      vector[index] += weight;
    });

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map(value => value / magnitude);
  }

  similarity(a, b) {
    const length = Math.min(a.length, b.length);
    let dot = 0;
    for (let i = 0; i < length; i += 1) {
      dot += a[i] * b[i];
    }
    return dot;
  }
}

module.exports = {
  EmbeddingModel
};
