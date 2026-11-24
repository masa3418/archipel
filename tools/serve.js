// Mini-Webserver für die Entwicklung: node tools/serve.js .   → http://localhost:8765
// Sicherheit (Prüfung nach 1.9.4): Er lauscht nur auf diesem Rechner – vorher auf allen Netzanschlüssen, mit der Firewall-Freigabe für Node
// konnte im selben (z. B. öffentlichen) Netz jeder den Projektordner samt .git lesen. Jede Datei muss im Ordner liegen (inside, wie in
// tools/video/recv.js – der bloße Vergleich des Anfangs ließ Nachbarordner mit gleichem Namensanfang durch, etwa „empg-alt“), und eine
// kaputte Adresse ergibt einen Fehler statt eines Absturzes.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || '.');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
// Pfad von file innerhalb von base – sonst null
function inside(base, file) {
  const p = path.join(base, file);
  return p === base || p.startsWith(base + path.sep) ? p : null;
}
http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  const f = !p.includes('\0') && inside(root, p);
  if (!f) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8765, '127.0.0.1', () => console.log('serving on http://localhost:8765 (nur dieser Rechner)'));
