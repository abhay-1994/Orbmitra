const patterns = [
  { intent: 'selenium', keywords: ['selenium', 'webdriver', 'xpath', 'css', 'locator', 'browser', 'driver', 'wait', 'pom', 'grid', 'action', 'click', 'element'] },
  { intent: 'testng', keywords: ['testng', 'annotation', 'dataprovider', 'suite', 'beforeclass', 'beforemethod', 'aftermethod', 'listener', 'parallel', 'group'] },
  { intent: 'api', keywords: ['api', 'rest', 'http', 'get', 'post', 'put', 'delete', 'status', 'json', 'xml', 'restassured', 'postman', 'endpoint', 'request', 'response', 'oauth'] },
  { intent: 'java', keywords: ['java', 'class', 'interface', 'abstract', 'hashmap', 'arraylist', 'exception', 'thread', 'string', 'lambda', 'stream', 'collection'] },
  { intent: 'agile', keywords: ['agile', 'scrum', 'sprint', 'kanban', 'standup', 'retrospective', 'backlog', 'velocity', 'story', 'epic', 'bdd', 'tdd', 'ci', 'cd', 'jenkins'] },
  { intent: 'interview', keywords: ['test', 'testing', 'bug', 'defect', 'smoke', 'sanity', 'regression', 'boundary', 'equivalence', 'severity', 'priority', 'coverage', 'plan', 'strategy'] }
];

function detectIntent(tokens) {
  const scores = {};
  patterns.forEach(pattern => {
    scores[pattern.intent] = tokens.filter(token => pattern.keywords.some(keyword => token.includes(keyword) || keyword.includes(token))).length;
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0] && sorted[0][1] > 0 ? sorted[0][0] : 'general';
}

module.exports = {
  patterns,
  detectIntent
};
