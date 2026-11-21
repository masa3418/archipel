// Verpackt das Spiel für einen Release – zum Spielen und Entwickeln ist das NICHT nötig.
//   node tools/pack.js
// erzeugt im Ordner dist/ (nicht im Repository):
//   archipel-offline.html  das ganze Spiel in einer einzigen Datei (Skripte und Symbol eingebettet)
// Ein eigenes ZIP mit den einzelnen Dateien gibt es seit 1.8.6 nicht mehr: GitHub hängt jedem Release den Quelltext
// ohnehin als „Source code (zip)“ an – darin läuft index.html per Doppelklick ebenfalls.
//   NOTES.md             Text des Releases: Hinweise zum Offline-Spielen + Abschnitt der Version aus CHANGELOG.md
// Die Versionsnummer steht in js/data.js (VERSION). Läuft das Skript auf GitHub für ein Tag vX.Y.Z,
// muss das Tag zur Versionsnummer passen.
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const version = (read('js/data.js').match(/const VERSION = '([^']+)'/) || [])[1];
if (!version) throw new Error('VERSION in js/data.js nicht gefunden');
const tag = process.env.GITHUB_REF_NAME || '';
if (/^v\d/.test(tag) && tag !== 'v' + version) {
  console.error(`Tag ${tag} passt nicht zur Versionsnummer ${version} in js/data.js`);
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// 1) Einzeldatei: Skripte und Symbol einbetten. Die App-Beschreibung (manifest.webmanifest) gibt es nur online –
//    aus der Offline-Fassung fliegt der Verweis heraus (sw.js meldet ui.js über file:// ohnehin nicht an)
//    (Zeilenende LF oder – nach einem Auschecken unter Windows – CR LF)
const manifest = /<link rel="manifest" href="manifest\.webmanifest">\r?\n/;
if (!manifest.test(read('index.html'))) throw new Error('Verweis auf manifest.webmanifest nicht gefunden');
const html = read('index.html').replace(manifest, '');
const scripts = [];
let single = html.replace(/<script src="(js\/[\w.-]+)"><\/script>/g, (m, src) => {
  scripts.push(src);
  return '<script>\n' + read(src).replace(/<\/script/gi, '<\\/script') + '\n</script>';
});
if (!scripts.length || /<script[^>]+src=/.test(single)) throw new Error('Skripte konnten nicht vollständig eingebettet werden');
const icon = '<link rel="icon" type="image/svg+xml" href="favicon.svg">';
if (!single.includes(icon)) throw new Error('Verweis auf favicon.svg nicht gefunden');
single = single.replace(icon, () => `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${Buffer.from(read('favicon.svg')).toString('base64')}">`);
fs.writeFileSync(path.join(dist, 'archipel-offline.html'), single);

// 2) Text des Releases
const log = read('CHANGELOG.md');
const start = log.indexOf(`## ${version}`);
if (start < 0) throw new Error(`Abschnitt "## ${version}" fehlt in CHANGELOG.md`);
const next = log.indexOf('\n## ', start + 3);
const raw = log.slice(log.indexOf('\n', start) + 1, next < 0 ? undefined : next).trim().replace(/\r\n/g, '\n');
// GitHub zeigt im Release-Text jeden Zeilenumbruch als Umbruch an – im CHANGELOG sind Absätze und Aufzählungspunkte aber nur der
// Lesbarkeit halber umgebrochen. Deshalb Folgezeilen an die vorige Zeile hängen (nicht: Leerzeile, Aufzählung, Überschrift, Tabelle).
const section = raw.split('\n').reduce((out, line) => {
  const prev = out[out.length - 1];
  if (prev !== undefined && prev.trim() && line.trim() && !/^\s*([-*+] |\d+\. |#|\||```)/.test(line)) out[out.length - 1] = prev + ' ' + line.trim();
  else out.push(line);
  return out;
}, []).join('\n');
fs.writeFileSync(path.join(dist, 'NOTES.md'), `**Offline spielen:** \`archipel-offline.html\` herunterladen und doppelklicken – das ganze Spiel steckt in dieser einen Datei, ohne Installation und ohne Internet. Die Offline-Fassung hat eigene Spielstände; über „Spielstände → Export“ und „Aus Datei laden“ lassen sie sich mit der [Online-Version](https://masa3418.github.io/archipel/) austauschen. Die einzelnen Dateien zum Hineinschauen liegen unter „Source code“.

**Play offline:** download \`archipel-offline.html\` and double-click it – the whole game is in this one file, no installation, no internet. The language button (🌐) is at the top right. If you want to look at the individual files, you will find them under “Source code”.

${section}
`);

const kb = f => Math.round(fs.statSync(path.join(dist, f)).size / 1024) + ' kB';
console.log(`Archipel ${version}: dist/archipel-offline.html (${kb('archipel-offline.html')}, ${scripts.length} Skripte eingebettet), dist/NOTES.md`);
