let chatMode = 'qa';
let currentTopic = 'all';
let isTyping = false;
let quizQueue = [];
let quizIndex = 0;
let voiceActive = false;
let recognition = null;

const RELATED_BY_TOPIC = {
  selenium: ['What is XPath?', 'How to handle iframes?', 'What is Selenium Grid?', 'What is POM?', 'How to take screenshot?'],
  testng: ['What is @DataProvider?', 'How to run parallel tests?', 'What is soft assertion?', 'What are TestNG annotations?'],
  api: ['What HTTP status codes are important?', 'What is RestAssured?', 'Difference between SOAP and REST?', 'What is OAuth 2.0?'],
  java: ['What is HashMap?', 'Java 8 features?', 'ArrayList vs LinkedList?', 'What is OOP?'],
  agile: ['What is Scrum?', 'What is CI/CD?', 'What is TDD?', 'What is BDD?'],
  interview: ['What is test plan?', 'Severity vs priority?', 'What is UAT?', 'What is the test pyramid?'],
  general: ['What is Selenium?', 'What is API testing?', 'What is Agile?', 'What is TestNG?']
};

const API_BASE = (typeof window !== 'undefined' && window.API_BASE)
  ? window.API_BASE
  : 'http://localhost:3000';

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function loadStats() {
  try {
    const stats = await apiRequest('/api/stats');
    updateTopicCounts(stats.topics || {});
  } catch {
    updateTopicCounts({});
  }
}

window.addEventListener('DOMContentLoaded', () => {
  loadStats();
});

function updateTopicCounts(counts) {
  const source = counts && Object.keys(counts).length ? counts : {};
  Object.keys(source).forEach(topic => {
    const el = document.getElementById(`cnt-${topic}`);
    if (el) el.textContent = source[topic];
  });
}

function filterTopic(topic) {
  currentTopic = topic;
  document.querySelectorAll('.topic-btn').forEach(btn => btn.classList.remove('active'));
  if (typeof event !== 'undefined' && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }
}

function setMode(mode) {
  chatMode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  const active = document.getElementById(`mode-${mode}`);
  if (active) active.classList.add('active');

  const indicators = {
    qa: '💬 Q&A Mode',
    interview: '🎯 Interview Mode',
    quiz: '⚡ Quiz Mode'
  };
  const indicator = document.getElementById('modeIndicator');
  if (indicator) indicator.textContent = indicators[mode] || indicators.qa;

  if (mode === 'quiz') {
    startQuiz();
  } else if (mode === 'interview') {
    addBotMessage(
      "Interview Mode activated. I'll ask you a question and then give you a model answer. Ready? Here's your first question:\n\nWhat is the difference between smoke testing and sanity testing? Explain with examples.",
      'interview',
      0.95
    );
  }
}

async function startQuiz() {
  try {
    const quiz = await apiRequest(`/api/quiz?topic=${encodeURIComponent(currentTopic)}`);
    quizQueue = [quiz];
    quizIndex = 0;
    addBotMessage(
      `Quiz Mode is active. Here is your question:\n\nQ1: ${quiz.question}`,
      'quiz',
      1,
      null,
      { question: quiz.question },
      []
    );
  } catch {
    addBotMessage('Quiz questions are not available right now.', 'general', 0.4);
  }
}

async function sendMessage() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text || isTyping) return;

  hideWelcome();
  addUserMessage(text);
  input.value = '';
  autoResize(input);
  setTyping(true);

  try {
    const response = await apiRequest('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: text,
        topic: currentTopic,
        mode: chatMode
      })
    });

    addBotMessage(
      response.reply,
      response.topic || 'general',
      typeof response.confidence === 'number' ? response.confidence : 1,
      response.processed || null,
      response.match || null,
      response.related || []
    );
  } catch {
    addBotMessage('The backend API is unavailable right now. Please try again in a moment.', 'general', 0.1);
  } finally {
    setTyping(false);
  }
}

function sendQuick(text) {
  const input = document.getElementById('userInput');
  if (input) {
    input.value = text;
  }
  sendMessage();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function hideWelcome() {
  const welcome = document.getElementById('welcomeScreen');
  if (welcome) welcome.style.display = 'none';
}

function addUserMessage(text) {
  const msgs = document.getElementById('messages');
  if (!msgs) return;
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="avatar user">👤</div>
    <div class="bubble user">${escHtml(text)}</div>
  `;
  msgs.appendChild(row);
  scrollBottom();
}

function addBotMessage(text, topic = 'general', confidence = 1, nlpInfo = null, match = null, related = []) {
  const msgs = document.getElementById('messages');
  if (!msgs) return;

  const row = document.createElement('div');
  row.className = 'msg-row bot';

  const topicLabels = {
    selenium: 'Selenium',
    testng: 'TestNG',
    api: 'API',
    java: 'Java',
    agile: 'Agile',
    interview: 'Interview',
    general: 'General',
    quiz: 'Quiz'
  };

  const label = topicLabels[topic] || 'General';
  const confPct = Math.round(confidence * 100);
  const confColor = confidence > 0.6 ? '#10b981' : confidence > 0.35 ? '#f59e0b' : '#ef4444';
  const formatted = escHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

  const relatedQuestions = related.length
    ? related.map(item => item.question)
    : (RELATED_BY_TOPIC[topic] || RELATED_BY_TOPIC.general).slice(0, 3);

  const relatedHtml = relatedQuestions.length
    ? `<div class="related-questions">
        <div class="related-label">RELATED QUESTIONS</div>
        <div class="related-chips">
          ${relatedQuestions.slice(0, 3).map((question, index) => `<button type="button" class="related-chip" data-related-chip="${index}">${escHtml(question)}</button>`).join('')}
        </div>
      </div>`
    : '';

  const matchLabel = match && match.question
    ? `<div class="tag-row"><span class="tag">📌 ${escHtml(match.question.slice(0, 40))}${match.question.length > 40 ? '...' : ''}</span></div>`
    : '';

  row.innerHTML = `
    <div class="avatar bot">🤖</div>
    <div class="bubble bot">
      <div class="bubble-meta">
        <span class="bubble-name">OrbMitra AI</span>
        <span class="bubble-phase">${label}</span>
      </div>
      <div>${formatted}</div>
      ${confidence > 0.1 ? `
      <div class="confidence-bar">
        <span class="conf-label">CONFIDENCE</span>
        <div class="conf-track"><div class="conf-fill" style="width:0%;background:linear-gradient(90deg,${confColor},${confColor}88)"></div></div>
        <span class="conf-val">${confPct}%</span>
      </div>` : ''}
      ${matchLabel}
      ${relatedHtml}
    </div>
  `;

  msgs.appendChild(row);

  row.querySelectorAll('[data-related-chip]').forEach((chip, index) => {
    chip.addEventListener('click', () => {
      sendQuick(relatedQuestions[index]);
    });
  });

  if (confidence > 0.1) {
    setTimeout(() => {
      const fill = row.querySelector('.conf-fill');
      if (fill) fill.style.width = confPct + '%';
    }, 100);
  }

  scrollBottom();
}

function setTyping(show) {
  isTyping = show;
  const msgs = document.getElementById('messages');
  const existing = document.getElementById('typingIndicator');
  if (existing) existing.remove();

  if (show && msgs) {
    const row = document.createElement('div');
    row.id = 'typingIndicator';
    row.className = 'typing-row';
    row.innerHTML = `
      <div class="avatar bot">🤖</div>
      <div class="typing-bubble">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        <span style="font-family:'Space Mono',monospace;font-size:9px;color:var(--text-muted);margin-left:8px">Processing...</span>
      </div>
    `;
    msgs.appendChild(row);
    scrollBottom();
  }

  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.disabled = show;
}

function scrollBottom() {
  const msgs = document.getElementById('messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearChat() {
  const msgs = document.getElementById('messages');
  if (!msgs) return;

  msgs.innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <div class="welcome-orbit">
        <div class="orbit-ring"></div>
        <div class="orbit-center">🤖</div>
      </div>
      <div>
        <div class="welcome-title">OrbMitra AI Assistant</div>
        <div class="welcome-sub" style="margin-top:8px">Your intelligent QA companion powered by an API-backed knowledge base.</div>
      </div>
      <div class="quick-chips">
        <div class="chip" onclick="sendQuick('What is Selenium?')">What is Selenium?</div>
        <div class="chip" onclick="sendQuick('Explain implicit vs explicit wait')">Implicit vs Explicit wait</div>
        <div class="chip" onclick="sendQuick('What is API testing?')">What is API testing?</div>
        <div class="chip" onclick="sendQuick('What is TestNG?')">What is TestNG?</div>
        <div class="chip" onclick="sendQuick('Difference between smoke and sanity testing')">Smoke vs Sanity</div>
        <div class="chip" onclick="sendQuick('What is a test case?')">What is a test case?</div>
      </div>
    </div>`;
}

function toggleVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Voice input is not supported in your browser.');
    return;
  }

  const btn = document.getElementById('voiceBtn');
  if (voiceActive) {
    if (recognition) recognition.stop();
    voiceActive = false;
    if (btn) {
      btn.classList.remove('listening');
      btn.textContent = '🎤';
    }
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.onstart = () => {
    voiceActive = true;
    if (btn) {
      btn.classList.add('listening');
      btn.textContent = '🔴';
    }
  };
  recognition.onresult = e => {
    const transcript = Array.from(e.results).map(result => result[0].transcript).join('');
    const input = document.getElementById('userInput');
    if (input) input.value = transcript;
  };
  recognition.onend = () => {
    voiceActive = false;
    if (btn) {
      btn.classList.remove('listening');
      btn.textContent = '🎤';
    }
    const input = document.getElementById('userInput');
    const value = input ? input.value.trim() : '';
    if (value) sendMessage();
  };
  recognition.onerror = () => {
    voiceActive = false;
    if (btn) {
      btn.classList.remove('listening');
      btn.textContent = '🎤';
    }
  };
  recognition.start();
}
