// Verpackt das Spiel für einen Release – zum Spielen und Entwickeln ist das NICHT nötig.
//   node tools/pack.js
// erzeugt im Ordner dist/ (nicht im Repository):
//   archipel.html        das ganze Spiel in einer einzigen Datei (Skripte und Symbol eingebettet)
//   archipel-offline/    das Spiel als Ordner (für das ZIP des Releases)
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
fs.mkdirSync(path.join(dist, 'archipel-offline', 'js'), { recursive: true });

// 1) Einzeldatei: Skripte und Symbol einbetten. Die App-Beschreibung (manifest.webmanifest) gibt es nur online –
//    aus der Offline-Fassung fliegt der Verweis heraus (sw.js meldet ui.js über file:// ohnehin nicht an)
const manifest = '<link rel="manifest" href="manifest.webmanifest">\n';
if (!read('index.html').includes(manifest)) throw new Error('Verweis auf manifest.webmanifest nicht gefunden');
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
fs.writeFileSync(path.join(dist, 'archipel.html'), single);

// 2) Ordner für das ZIP
const copy = f => fs.copyFileSync(path.join(root, f), path.join(dist, 'archipel-offline', f));
['favicon.svg', 'LICENSE', ...scripts].forEach(copy);
fs.writeFileSync(path.join(dist, 'archipel-offline', 'index.html'), html);   // ohne Manifest-Verweis
fs.writeFileSync(path.join(dist, 'archipel-offline', 'LIESMICH.txt'), `Archipel ${version} – Offline-Fassung
=====================================

Spielen: index.html doppelklicken. Es wird nichts installiert und keine Internetverbindung gebraucht.

Spielstände und Einstellungen liegen im Browser, getrennt von der Online-Version. Über
"Spielstände -> Export" und "Aus Datei laden" lassen sie sich zwischen beiden hin- und hertragen.

Online spielen: https://masa3418.github.io/archipel/
Quelltext:      https://github.com/masa3418/archipel
Lizenz:         MIT, siehe LICENSE


Archipel ${version} – offline copy
=================================

To play, double-click index.html. Nothing is installed and no internet connection is needed.
The language button (🌐) is at the top right.

Saved games and settings live in your browser, separate from the online version. Use
"Saved games -> Export" and "Load from file" to move them between the two.

Play online: https://masa3418.github.io/archipel/
Source code: https://github.com/masa3418/archipel
Licence:     MIT, see LICENSE
`);

// 3) Text des Releases
const log = read('CHANGELOG.md');
const start = log.indexOf(`## ${version}`);
if (start < 0) throw new Error(`Abschnitt "## ${version}" fehlt in CHANGELOG.md`);
const next = log.indexOf('\n## ', start + 3);
const section = log.slice(log.indexOf('\n', start) + 1, next < 0 ? undefined : next).trim();
fs.writeFileSync(path.join(dist, 'NOTES.md'), `**Offline spielen:** \`archipel.html\` herunterladen und doppelklicken – das ganze Spiel steckt in dieser einen Datei, ohne Installation und ohne Internet. Wer lieber einzelne Dateien hat, nimmt \`archipel-offline.zip\`, entpackt es und öffnet \`index.html\`. Die Offline-Fassung hat eigene Spielstände; über „Spielstände → Export“ und „Aus Datei laden“ lassen sie sich mit der [Online-Version](https://masa3418.github.io/archipel/) austauschen.

**Play offline:** download \`archipel.html\` and double-click it – the whole game is in this one file, no installation, no internet. If you prefer separate files, take \`archipel-offline.zip\`, unpack it and open \`index.html\`. The language button (🌐) is at the top right.

${section}
`);

const kb = f => Math.round(fs.statSync(path.join(dist, f)).size / 1024) + ' kB';
console.log(`Archipel ${version}: dist/archipel.html (${kb('archipel.html')}), dist/archipel-offline/ (${scripts.length} Skripte), dist/NOTES.md`);
