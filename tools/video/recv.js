// Empfänger für Erklärvideos (nur Entwicklung, nicht im Release).
// Start: node tools/video/recv.js   – dann im Browser (http://localhost:8765) tools/video/rec.js und eine Szene laden.
// Ablauf je Video: POST /start/<name>, /frame/<name>/<n> (PNG), /audio/<name> (WAV), /done/<name> → ffmpeg → docs/videos/<name>.mp4
// Sicherheit: Er lauscht nur auf diesem Rechner, nimmt nur Anfragen der Entwicklungsseite an (ORIGIN – sonst könnte jede
// Webseite, die man nebenher offen hat, ihm Aufträge schicken), Videonamen nur aus Buchstaben, Ziffern und Bindestrich, und jeder
// Dateipfad muss in seinem Ordner bleiben (inside).
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..', '..');
const tmp = path.resolve(__dirname, 'out');
const dest = path.resolve(root, 'docs', 'videos');
const ORIGIN = 'http://localhost:8765';
const NAME = /^[a-z0-9-]{1,40}$/i;
fs.mkdirSync(dest, { recursive: true });
// Pfad von file innerhalb von base – sonst Fehler (kein Ausbrechen mit ..\ oder Laufwerksangaben)
function inside(base, file) {
  const p = path.resolve(base, file);
  if (!p.startsWith(base + path.sep)) throw new Error('Pfad außerhalb von ' + base);
  return p;
}

http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && origin !== ORIGIN) { res.statusCode = 403; res.end(); return; }
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const [, cmd, name = '', n] = req.url.split('/');
  if (req.method !== 'POST' || !NAME.test(name)) { res.statusCode = 400; res.end(); return; }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    try {
      const dir = inside(tmp, name);
      if (cmd === 'start') {
        fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      } else if (cmd === 'frame') {
        const k = Math.floor(Number(n));
        if (!(k >= 0 && k < 1e5)) throw new Error('Bildnummer ungültig');
        fs.writeFileSync(inside(dir, 'f' + String(k).padStart(5, '0') + '.png'), body);
      } else if (cmd === 'audio') {
        fs.writeFileSync(inside(dir, 'audio.wav'), body);
      } else if (cmd === 'done') {
        const seconds = Number(JSON.parse(body.toString() || '{}').seconds);
        if (!(seconds > 0 && seconds < 3600)) throw new Error('Länge ungültig');
        const out = inside(dest, name + '.mp4');
        execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', inside(dir, 'f%05d.png'), '-i', inside(dir, 'audio.wav'),
          '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
          '-c:a', 'aac', '-b:a', '160k', '-af', `afade=t=out:st=${Math.max(0, seconds - 0.5)}:d=0.5`, '-t', String(seconds), out]);
        console.log('fertig:', path.relative(root, out), Math.round(fs.statSync(out).size / 1024) + ' kB');
        fs.rmSync(dir, { recursive: true, force: true });
      } else { res.statusCode = 404; }
    } catch (e) { res.statusCode = 500; console.error(e.message); }
    res.end('ok');
  });
}).listen(8766, '127.0.0.1', () => console.log('Videoempfänger bereit auf Port 8766 (nur dieser Rechner)'));
