'use strict';
// ---------------------------------------------------------------------------
// Oberfläche, Teil 7 von 7 – Spielstände, Sprache, Willkommensfenster und der Start des Spiels (muss als Letztes geladen werden).
// Die Teile ui-karte.js → ui-zug.js → ui-leiste.js → ui-fenster.js → ui-eingabe.js → ui-schau.js → ui-start.js werden in dieser Reihenfolge geladen und teilen sich
// den globalen Namensraum (wie alle Skripte). Was beim Laden sofort läuft, darf nur Funktionen aus diesem oder einem früheren Teil aufrufen.
// ---------------------------------------------------------------------------

// ------------------------------------------------------------------ Spielstände
const SIZE_NAME = EN ? { klein: 'small', mittel: 'medium', gross: 'large' } : { klein: 'klein', mittel: 'mittel', gross: 'groß' };
function fmtDate(t) {
  const d = new Date(t);
  const loc = EN ? 'en-GB' : 'de-DE';
  return d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
function slotDesc(m, short = false) {   // short: ohne Karte und Stufe (stehen in der Überschrift der Partie)
  m = { ...m, turn: Math.trunc(Number(m.turn)) || 0, cities: Math.trunc(Number(m.cities)) || 0, units: Math.trunc(Number(m.units)) || 0,
    size: SIZE_NAME[m.size] ? m.size : '', over: ['win', 'lose'].includes(m.over) ? m.over : null };
  const end = m.over === 'win' ? tt(' · gewonnen', ' · won') : m.over === 'lose' ? tt(' · verloren', ' · lost') : '';
  const dl = m.difficulty && DIFFICULTY[m.difficulty] ? ' · ' + DIFFICULTY[m.difficulty].label : '';
  if (short) return EN ? `Turn ${m.turn} · ${plural(m.cities, 'city', 'cities')} · ${plural(m.units, 'unit', 'units')}${end}` : `Runde ${m.turn} · ${plural(m.cities, 'Stadt', 'Städte')} · ${plural(m.units, 'Einheit', 'Einheiten')}${end}`;
  return EN ? `Turn ${m.turn} · ${plural(m.cities, 'city', 'cities')} · ${plural(m.units, 'unit', 'units')} · ${SIZE_NAME[m.size] || '?'} map${dl}${end}`
    : `Runde ${m.turn} · ${plural(m.cities, 'Stadt', 'Städte')} · ${plural(m.units, 'Einheit', 'Einheiten')} · Karte ${SIZE_NAME[m.size] || '?'}${dl}${end}`;
}
// Spielstände nach Partie gruppiert (meta.game = S.gameId): die laufende Partie zuerst und aufgeklappt, die übrigen nach letztem
// Speicherdatum und zugeklappt; Spielstände ohne Kennung (ältere Versionen) unter „Ältere Spielstände“. Ab sieben Spielständen ein
// Suchfeld (Name). Je Zeile „Laden“ und kleine Knöpfe für Überschreiben, Export, Löschen; je Partie „Alle löschen“.
const saveOpen = new Set();   // aufgeklappte Partien (bleibt beim Neuzeichnen erhalten)
function saveGroupTitle(m) {
  const w = WORLDS[m.world] ? WORLDS[m.world].label : '';
  const sz = SIZE_NAME[m.size] || '';
  const dl = m.difficulty && DIFFICULTY[m.difficulty] ? DIFFICULTY[m.difficulty].label : '';
  const ais = Math.trunc(Number(m.ais)) || 1, ai = ais > 1 && ais < PLAYERS.length ? tt(`${ais} Gegner`, `${ais} opponents`) : '';
  return [w, sz, dl, ai].filter(Boolean).join(' · ') || tt('Partie', 'Game');
}
function renderSaves() {
  const slots = listSlots();
  const q = ($('saveFilter').value || '').trim().toLowerCase();
  $('saveFilterRow').hidden = slots.length < 7;
  const row = m => `<tr><td class="nm">${esc(m.name)}</td><td class="muted">${slotDesc(m, true)}</td><td class="muted dt">${fmtDate(m.date)}</td>
    <td class="acts"><button class="primary" data-load="${m.id}">${tt('Laden', 'Load')}</button><button class="ic" data-over="${m.id}" title="${tt('Mit dem aktuellen Spiel überschreiben', 'Overwrite with the current game')}">⟳</button><button class="ic" data-export="${m.id}" title="${tt('Als Datei herunterladen', 'Download as file')}">⤓</button><button class="ic danger" data-del="${m.id}" title="${tt('Löschen', 'Delete')}">✕</button></td></tr>`;
  let h = '';
  try {
    const j = localStorage.getItem(SAVE_KEY);
    if (j && !q) {
      const o = JSON.parse(j);
      const m = { turn: o.turn, size: o.size, cities: o.cities.filter(c => c.owner === 0).length, units: o.units.filter(u => u.owner === 0).length, over: o.over, difficulty: o.difficulty };
      h += `<table class="stat-table save-table"><tr class="auto"><td class="nm">${tt('Automatisch (aktueller Stand)', 'Autosave (current state)')}</td><td class="muted">${slotDesc(m)}</td><td class="muted dt" title="${tt('Wird nach jedem Zug und beim Schließen der Seite gespeichert', 'Saved after every move and when the page is closed')}">${tt('laufend', 'current')}</td>
        <td class="acts"><button class="primary" data-load="auto">${tt('Laden', 'Load')}</button><button class="ic" data-export="auto" title="${tt('Als Datei herunterladen', 'Download as file')}">⤓</button></td></tr></table>`;
    }
  } catch (e) {}
  // Gruppen bilden
  const groups = new Map();
  for (const m of slots) {
    if (q && !String(m.name).toLowerCase().includes(q)) continue;
    const k = typeof m.game === 'string' ? m.game : '_old';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  const cur = S && S.gameId;
  const keys = [...groups.keys()].sort((x, y) => (y === cur) - (x === cur) || (x === '_old') - (y === '_old') || groups.get(y)[0].date - groups.get(x)[0].date);
  for (const k of keys) {
    const list = groups.get(k), m0 = list[0];
    const open = q || k === cur || saveOpen.has(k) || keys.length === 1;
    const title = k === '_old' ? tt('Ältere Spielstände', 'Older saved games') : esc(saveGroupTitle(m0));
    const seed = k !== '_old' && Number.isFinite(m0.seed) ? ` · ${tt('Karte', 'map')} ${fmtSeed(m0.seed)}` : '';
    const now = k === cur ? `<span class="sg-cur">${tt('laufende Partie', 'current game')}</span>` : '';
    h += `<details class="sg" data-game="${esc(k)}" ${open ? 'open' : ''}><summary><span class="sg-t">${title}</span>${now}<span class="muted sg-i">${plural(list.length, tt('Spielstand', 'saved game'), tt('Spielstände', 'saved games'))} · ${tt('zuletzt', 'last')} ${fmtDate(m0.date)}${seed}</span>
      <button class="ic danger sg-del" data-delgame="${esc(k)}" title="${tt('Alle Spielstände dieser Partie löschen', 'Delete all saved games of this game')}">✕</button></summary>
      <table class="stat-table save-table">${list.map(row).join('')}</table></details>`;
  }
  if (!slots.length) h += `<p class="muted">${tt('Noch keine Spielstände.', 'No saved games yet.')}</p>`;
  else if (q && !groups.size) h += `<p class="muted">${tt('Kein Spielstand passt zur Suche.', 'No saved game matches the search.')}</p>`;
  $('saveList').innerHTML = h;
  let used = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('archipel')) used += (localStorage.getItem(k) || '').length; } } catch (e) {}
  const mb = used * 2 / 1024 / 1024, mbUsed = mb < 0.1 ? mb.toFixed(2) : mb.toFixed(1);   // gepackt sind kleine Werte üblich
  $('saveInfo').textContent = tt(`${slots.length} gespeicherte Spielstände · belegt etwa ${mbUsed} MB von ca. 5 MB Browserspeicher (benannte Spielstände werden gepackt, etwa zehnmal kleiner). Export (⤓) sichert einen Spielstand als Datei, ⟳ überschreibt ihn mit dem aktuellen Spiel.`,
    `${slots.length} saved game${slots.length === 1 ? '' : 's'} · using about ${mbUsed} MB of roughly 5 MB browser storage (named saved games are packed, about ten times smaller). Export (⤓) saves a game as a file, ⟳ overwrites it with the current game.`);
}
function openSaves() {
  if (!S) return;
  $('saveName').value = EN ? `Turn ${S.turn} – ${plural(S.cities.filter(c => c.owner === 0).length, 'city', 'cities')}`
    : `Runde ${S.turn} – ${plural(S.cities.filter(c => c.owner === 0).length, 'Stadt', 'Städte')}`;
  $('saveFilter').value = '';
  renderSaves(); openModal('mSaves');
  setTimeout(() => { $('saveName').focus(); $('saveName').select(); }, 30);
}
async function trySave(name, id) {
  // Erfolg: Fenster schließen (weiterspielen); bei vollem Speicher bleibt es offen, damit man alte Stände löschen kann. Benannte Stände werden gepackt (saveSlot).
  try { await saveSlot(name, id); closeModals(); toast(tt(`Gespeichert: „${name}“`, `Saved: “${name}”`), 2200); Sfx.play('select'); return true; }
  catch (e) { toast(tt('Speicher voll – bitte alte Spielstände löschen oder exportieren', 'Storage full – please delete or export old saved games')); Sfx.play('error'); return false; }
}
function afterSlotLoad(msg) {
  closeModals(); patrolMode = null; autoEndAt = 0;
  afterLoad(); saveGame();
  toast(msg); Sfx.play('select');
  if (S.over) showGameOver();
}
$('bSaves').onclick = openSaves;
$('saveNew').onclick = () => trySave($('saveName').value.trim() || `${tt('Runde', 'Turn')} ${S.turn}`);
$('saveName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('saveNew').click(); } });
$('mSaves').addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.delgame) {
    e.preventDefault();   // nicht auf-/zuklappen
    const list = listSlots().filter(m => (typeof m.game === 'string' ? m.game : '_old') === d.delgame);
    if (list.length && confirm(tt(`Alle ${list.length} Spielstände dieser Partie endgültig löschen?`, `Delete all ${list.length} saved games of this game for good?`))) {
      for (const m of list) deleteSlot(m.id);
      renderSaves(); toast(tt(`${list.length} Spielstände gelöscht`, `${list.length} saved games deleted`));
    }
    return;
  }
  if (d.load) {
    let ok = false;
    try { ok = d.load === 'auto' ? loadGame() : await loadSlot(d.load); } catch (err) { ok = false; }
    if (ok) afterSlotLoad(tt('Spielstand geladen', 'Game loaded')); else { toast(tt('Laden fehlgeschlagen', 'Loading failed')); Sfx.play('error'); }
  } else if (d.over) {
    const m = listSlots().find(x => x.id === d.over);
    if (m && confirm(tt(`„${m.name}“ mit dem aktuellen Spiel (Runde ${S.turn}) überschreiben?`, `Overwrite “${m.name}” with the current game (turn ${S.turn})?`))) await trySave(m.name, m.id);
  } else if (d.del) {
    const m = listSlots().find(x => x.id === d.del);
    if (m && confirm(tt(`Spielstand „${m.name}“ endgültig löschen?`, `Delete saved game “${m.name}” for good?`))) { deleteSlot(m.id); renderSaves(); toast(tt('Gelöscht', 'Deleted')); }
  } else if (d.export) {
    // Export: auch der automatische Stand wird für die Datei gepackt (Wunsch des Nutzers); Laden erkennt gepackte und ungepackte Dateien
    let data = null;
    try { data = await slotData(d.export); } catch (err) { data = null; }
    if (!data) { toast(tt('Export fehlgeschlagen', 'Export failed')); Sfx.play('error'); return; }
    const m = d.export === 'auto' ? { name: tt('automatisch', 'autosave') } : listSlots().find(x => x.id === d.export);
    const turn = (() => { try { return JSON.parse(data).turn; } catch (err) { return ''; } })();
    const fname = ('archipel-' + (m ? m.name : tt('spielstand', 'savegame')) + tt('-R', '-T') + turn).replace(/[^\w\-äöüÄÖÜß]+/g, '_') + '.json';
    const url = URL.createObjectURL(new Blob([await packFile(data)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
});
$('saveFilter').addEventListener('input', renderSaves);
$('saveList').addEventListener('toggle', e => { const g = e.target.dataset && e.target.dataset.game; if (g) { if (e.target.open) saveOpen.add(g); else saveOpen.delete(g); } }, true);
const importPick = document.createElement('input');
importPick.type = 'file'; importPick.accept = '.json,application/json';
importPick.onchange = async () => {
  const f = importPick.files[0]; importPick.value = '';
  if (!f) return;
  try {
    const text = await unpackFile(await f.text());   // gepackte Datei (ab 1.9.1) oder ungepackte früherer Versionen
    const backup = S;
    try { deserialize(text); } catch (err) { S = backup; buildCityGrid(); throw err; }
    afterSlotLoad(tt('Spielstand aus Datei geladen', 'Game loaded from file'));
  } catch (err) { toast(tt('Datei ist kein gültiger Spielstand', 'File is not a valid saved game')); Sfx.play('error'); }
};
$('saveImport').onclick = () => importPick.click();
// Ältere, ungepackte benannte Spielstände einmal nachträglich packen (kurz nach dem Start, im Hintergrund; mit Gegenprobe je Stand)
setTimeout(() => { packOldSlots().then(n => { if (n && !$('mSaves').hidden) renderSaves(); }, () => {}); }, 2500);
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModals);
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModals(); }));

// ------------------------------------------------------------------ Sprache
// Feste Texte der Seite: data-en (englischer Inhalt), data-en-title, data-en-placeholder, data-en-aria-label.
// Größere Abschnitte stehen doppelt da, mit data-lang="de" bzw. "en" (per CSS ausgeblendet).
function applyLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('.ver').forEach(el => { el.textContent = VERSION; });
  // Der Sprachknopf nennt die Sprache, in die er umschaltet – in dieser Sprache, damit man ihn auch ohne Deutsch findet
  $('bLangLbl').textContent = EN ? 'Deutsch' : 'English';
  $('bLang').title = EN ? 'Auf Deutsch umschalten' : 'Switch to English';
  $('wLang').textContent = EN ? '🌐 Auf Deutsch spielen' : '🌐 Play in English';
  if (!EN) return;
  document.querySelectorAll('[data-en]').forEach(el => { el.innerHTML = el.dataset.en; });
  for (const a of ['title', 'placeholder', 'aria-label'])
    document.querySelectorAll(`[data-en-${a}]`).forEach(el => el.setAttribute(a, el.getAttribute('data-en-' + a)));
}
// ------------------------------------------------------------------ Willkommensfenster
// Erscheint beim ersten Besuch (kein Spielstand, noch nie gesehen) und weist auf Handbuch und Sprachwahl hin.
function showWelcome() {
  try { localStorage.setItem('archipel-welcome', '1'); } catch (e) {}
  openModal('mWelcome');
}
// Beim ersten Besuch erklingt die Startmelodie (Grieg) mit dem ersten Klick im Fenster – vorher erlauben Browser keinen Ton.
// Nicht, wenn das Fenster über das Handbuch noch einmal geöffnet wurde.
let welcomeFirst = false;
const welcomeTune = () => { if (welcomeFirst) { welcomeFirst = false; Sfx.play('start'); } };
$('wStart').onclick = () => { closeModals(); welcomeTune(); };
$('wHelp').onclick = () => { closeModals(); welcomeTune(); openHelp('start'); };
$('wLang').onclick = () => {
  // nach dem Umschalten soll das Fenster in der anderen Sprache noch einmal erscheinen
  try { localStorage.removeItem('archipel-welcome'); } catch (e) {}
  $('bLang').onclick();
};
$('bWelcomeAgain').onclick = () => { closeModals(); showWelcome(); };

$('bLang').onclick = () => {
  try { if (S && !S.over) saveGame(); localStorage.setItem('archipel-lang', EN ? 'de' : 'en'); } catch (e) {}
  location.reload();
};

// ------------------------------------------------------------------ Start
(function init() {
  applyLang();
  let prefSize = 'mittel', prefDiff = 'normal';
  try { prefSize = localStorage.getItem('archipel-size') || 'mittel'; prefDiff = localStorage.getItem('archipel-diff') || 'normal'; } catch (e) {}
  $('sizeSel').innerHTML = Object.entries(MAP_SIZES).map(([k, v]) => `<option value="${k}" ${k === prefSize ? 'selected' : ''}>${v.label}</option>`).join('');
  $('diffSel').innerHTML = Object.entries(DIFFICULTY).map(([k, v]) => `<option value="${k}" ${k === prefDiff ? 'selected' : ''}>${v.label}</option>`).join('');
  $('diffDesc').textContent = DIFFICULTY[$('diffSel').value].desc;
  fillAiSel();
  let prefWorld = 'inseln';
  try { prefWorld = localStorage.getItem('archipel-world') || 'inseln'; } catch (e) {}
  // Inselreich ist die Hauptkarte (echter Seekrieg) – Vorgabe beim ersten Spiel und in der Auswahl als empfohlen markiert
  $('worldSel').innerHTML = Object.entries(WORLDS).map(([k, v]) => `<option value="${k}" ${k === prefWorld ? 'selected' : ''}>${v.label}${k === 'inseln' ? tt(' (empfohlen)', ' (recommended)') : ''}</option>`).join('');
  if (!WORLDS[$('worldSel').value]) $('worldSel').value = 'inseln';
  $('worldDesc').textContent = WORLDS[$('worldSel').value].desc;
  $('diffTable').innerHTML = Object.entries(DIFFICULTY).map(([dk, d]) => {
    const you = d.youStart.map(t => '+1 ' + UT[t].name);
    const ai = [...d.aiStart.map(t => '+1 ' + UT[t].name), ...(d.aiCities ? ['+' + d.aiCities + tt(' Stadt', ' city')] : [])];
    const start = [you.length ? tt('du: ', 'you: ') + you.join(', ') : '', ai.length ? tt('Gegner: ', 'enemy: ') + ai.join(', ') : ''].filter(Boolean).join('; ') || tt('gleich', 'equal');
    return `<tr data-k="${dk}"><td><b>${d.label}</b><span class="cur-note">${tt('diese Partie', 'this game')}</span></td><td>${d.skill ? tt('umsichtig', 'shrewd') : tt('einfach', 'simple')}</td><td>${d.aiKnowsMap ? tt('ja', 'yes') : tt('nein, erkundet', 'no, explores')}</td><td>${Math.round(d.aiMistake * 100)} %</td>
      <td>${Math.round(d.aiProd * 100)} %</td><td>${d.invadeAt} ${tt('Truppen', 'troops')}</td><td>${start}</td></tr>`;
  }).join('');
  try { const z = +localStorage.getItem('archipel-zoom'); if (z >= 14 && z <= 48) TS = z; } catch (e) {}
  if (loadGame()) { afterLoad(); addLog(tt('Spielstand fortgesetzt.', 'Game resumed.')); refresh(); }
  else startNew('mittel', null, null, null, 0, landPref);   // ohne Spielstand (erster Besuch, nach „Zurücksetzen“): die eingestellte Landschaft, Vorgabe Klimazonen
  if (!welcomeSeen()) { welcomeFirst = true; showWelcome(); }
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => renderMini());
})();
