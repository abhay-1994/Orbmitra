const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but',
  'not', 'no', 'so', 'if', 'do', 'be', 'as', 'by', 'we', 'i', 'you', 'he', 'she', 'they',
  'this', 'that', 'these', 'those', 'are', 'was', 'were', 'has', 'have', 'had', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'what', 'which', 'who', 'how',
  'when', 'where', 'why', 'with', 'from', 'into', 'out', 'about', 'up', 'then', 'than',
  'there', 'here', 'some', 'any', 'all', 'its', 'my', 'your', 'our', 'their', 'between',
  'use', 'used', 'using', 'also', 'just', 'well', 'very', 'more', 'most', 'does', 'did',
  'tell', 'explain', 'define', 'difference', 'mean', 'means', 'know', 'understand'
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1);
}

function stem(word) {
  if (word.length <= 2) return word;
  let value = word.toLowerCase();
  value = value.replace(/ing$/, '').replace(/tion$/, 't')
    .replace(/tions$/, 't').replace(/ness$/, '')
    .replace(/ment$/, '').replace(/ments$/, '')
    .replace(/ings$/, '').replace(/ers$/, 'er')
    .replace(/ies$/, 'y').replace(/ed$/, '')
    .replace(/ly$/, '').replace(/ful$/, '')
    .replace(/ous$/, '').replace(/ive$/, '')
    .replace(/ize$/, '').replace(/ise$/, '')
    .replace(/able$/, '').replace(/ible$/, '');

  if (value.length > 4 && value.endsWith('s') && !value.endsWith('ss')) {
    value = value.slice(0, -1);
  }
  return value.length < 2 ? `${value}x` : value;
}

function preprocess(text) {
  const tokens = tokenize(text);
  const noStop = tokens.filter(token => !STOP_WORDS.has(token));
  const stemmed = noStop.map(stem).filter(token => token.length > 1);
  return {
    original: tokens,
    filtered: noStop,
    stemmed
  };
}

module.exports = {
  STOP_WORDS,
  tokenize,
  stem,
  preprocess
};
