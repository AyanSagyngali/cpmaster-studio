// Desktop test server: serves www/ like the phone does. /dev/keys gives the owner's keys to the test page on THIS computer only
// (it reads ../CPMaster/data/secrets.json; nothing of this is in the app).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const SECRETS = path.resolve(ROOT, '..', '..', 'CPMaster', 'data', 'secrets.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/dev/keys') {
    if (req.socket.remoteAddress !== '127.0.0.1' && req.socket.remoteAddress !== '::1' && req.socket.remoteAddress !== '::ffff:127.0.0.1') { res.writeHead(403); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(fs.existsSync(SECRETS) ? fs.readFileSync(SECRETS, 'utf8') : '');
  }
  if (u.pathname === '/dev/save' && req.method === 'POST') {                       // test videos -> Desktop (this computer only)
    const name = (u.searchParams.get('name') || 'test.mp4').replace(/[^\w.\-а-яА-Я]/g, '_');
    const out = fs.createWriteStream(path.join(process.env.USERPROFILE || '.', 'Desktop', name));
    req.pipe(out); out.on('finish', () => { res.writeHead(200); res.end('ok'); });
    return;
  }
  const file = path.normalize(path.join(ROOT, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname)));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(5178, '127.0.0.1', () => console.log('http://127.0.0.1:5178'));
