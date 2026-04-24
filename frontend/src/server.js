const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

loadEnvFile(path.join(__dirname, '..', '..', 'backend', '.env'));

const FRONTEND_DIR = path.join(__dirname, '..');
const PORT = Number(process.env.FRONTEND_PORT || 5173);
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(res, pathname) {
  const safePath = pathname === '/'
    ? '/index.html'
    : pathname === '/admin'
      ? '/admin/index.html'
      : pathname === '/admin/login'
        ? '/admin/index.html'
      : pathname;
  let filePath;

  try {
    filePath = path.normalize(path.join(FRONTEND_DIR, decodeURIComponent(safePath)));
  } catch {
    filePath = path.join(FRONTEND_DIR, 'index.html');
  }

  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(FRONTEND_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (ext === '.html' || ext === '.js' || ext === '.css' || ext === '.json' || ext === '.txt' || ext === '.svg') {
    let content = fs.readFileSync(filePath, 'utf8');

    if (ext === '.html' && !content.includes('window.API_BASE')) {
      content = content.replace(
        '</head>',
        `<script>window.API_BASE = ${JSON.stringify(API_BASE)};</script>\n</head>`
      );
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
    return;
  }

  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('API is served by the backend on port 3000');
    return;
  }

  try {
    serveStatic(res, url.pathname);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Failed to serve frontend: ${error.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`OrbMitra frontend running at http://localhost:${PORT}`);
});

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
