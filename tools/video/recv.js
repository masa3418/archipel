// Empfänger für Erklärvideos (nur Entwicklung, nicht im Release).
// Start: node tools/video/recv.js   – dann im Browser (http://localhost:8765) tools/video/rec.js und eine Szene laden.
// Ablauf je Video: POST /start/<name>, /frame/<name>/<n> (PNG), /audio/<name> (WAV), /done/<name> → ffmpeg → docs/videos/<name>.mp4
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', '..');
const tmp = path.join(__dirname, 'out');
const dest = path.join(root, 'docs', 'videos');
fs.mkdirSync(dest, { recursive: true });
const dirOf = name => path.join(tmp, name.replace(/[^a-z0-9-]/gi, ''));

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks), [, cmd, name, n] = req.url.split('/');
    try {
      const dir = dirOf(name || '');
      if (cmd === 'start') {
        fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      } else if (cmd === 'frame') {
        fs.writeFileSync(path.join(dir, 'f' + String(+n).padStart(5, '0') + '.png'), body);
      } else if (cmd === 'audio') {
        fs.writeFileSync(path.join(dir, 'audio.wav'), body);
      } else if (cmd === 'done') {
        const { seconds } = JSON.parse(body.toString() || '{}');
        const out = path.join(dest, name + '.mp4');
        execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(dir, 'f%05d.png'), '-i', path.join(dir, 'audio.wav'),
          '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
          '-c:a', 'aac', '-b:a', '160k', '-af', `afade=t=out:st=${Math.max(0, seconds - 0.5)}:d=0.5`, '-t', String(seconds), out]);
        console.log('fertig:', path.relative(root, out), Math.round(fs.statSync(out).size / 1024) + ' kB');
        fs.rmSync(dir, { recursive: true, force: true });
      } else { res.statusCode = 404; }
    } catch (e) { res.statusCode = 500; console.error(e.message); }
    res.end('ok');
  });
}).listen(8766, () => console.log('Videoempfänger bereit auf Port 8766'));
