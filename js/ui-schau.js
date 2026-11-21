'use strict';
// ---------------------------------------------------------------------------
// Oberfläche, Teil 6 von 7 – Übersichten: Statistik, Klangtest, Grafik-Übersicht, Einstellungen, Beispiel-Spielstände.
// Die Teile ui-karte.js → ui-zug.js → ui-leiste.js → ui-fenster.js → ui-eingabe.js → ui-schau.js → ui-start.js werden in dieser Reihenfolge geladen und teilen sich
// den globalen Namensraum (wie alle Skripte). Was beim Laden sofort läuft, darf nur Funktionen aus diesem oder einem früheren Teil aufrufen.
// ---------------------------------------------------------------------------

// ------------------------------------------------------------------ Statistik
function renderStats() {
  const myCities = S.cities.filter(c => c.owner === 0).sort((a, b) => a.name.localeCompare(b.name, LANG));
  const myUnits = S.units.filter(u => u.owner === 0);
  const known = S.players[0].knownOwner;
  const enemyC = S.cities.filter(c => known[c.id] >= 1).length;
  const neutralC = S.cities.filter(c => known[c.id] === -1).length;
  const idle = myCities.filter(c => !c.prod).length;
  const box = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  // Welt und Kartennummer gleich nach der Schwierigkeit – zum Weitergeben oder für „Diese Welt noch einmal“; ältere Partien kennen keine Nummer
  const wd = WORLDS[S.world], sz = MAP_SIZES[S.size];
  $('statSummary').innerHTML = box(diff().label, tt('Schwierigkeit', 'Difficulty'))
    + box(esc(wd ? wd.label : '–'), tt('Welt', 'World') + (sz ? ' · ' + esc(sz.label.split(' ')[0]) : ''))
    + (S.seed != null ? box(fmtSeed(S.seed), tt('Kartennummer', 'Map number')) : box('–', tt('Kartennummer (älterer Spielstand)', 'Map number (older save)')))
    + box(S.turn, tt('Runde', 'Turn')) + box(myCities.length, tt('Deine Städte', 'Your cities')) + box(myUnits.length, tt('Deine Einheiten', 'Your units'))
    + box(enemyC, tt('Bekannte Feindstädte', 'Known enemy cities')) + box(neutralC, tt('Bekannte neutrale', 'Known neutral')) + box(S.cities.length, tt('Städte insgesamt', 'Cities in total'))
    + (idle ? box(idle, tt('Städte ohne Produktion', 'Cities without production')) : '');

  let total = [0, 0, 0];
  $('statUnits').innerHTML = UNIT_ORDER.map(k => {
    const t = UT[k];
    const list = myUnits.filter(u => u.type === k);
    const aboard = list.filter(u => u.carrier != null).length;
    const sentry = list.filter(u => u.order && u.order.type === 'sentry' && u.carrier == null).length;
    const patrol = list.filter(u => u.order && u.order.type === 'patrol').length;
    const builders = myCities.filter(c => c.prod === k);
    const next = builders.length ? Math.min(...builders.map(c => t.cost - c.progress)) : null;
    total[0] += list.length; total[1] += builders.length;
    const detail = [aboard ? `${aboard} ${tt('an Bord', 'on board')}` : '', sentry ? `${sentry} ${tt('Wache', 'sentry')}` : '', patrol ? `${patrol} ${tt('Patrouille', 'patrol')}` : ''].filter(Boolean).join(', ');
    return `<tr><td><span class="sym">${t.sym}</span>${t.name}</td>
      <td class="num ${list.length ? '' : 'zero'}">${list.length}</td>
      <td class="num muted">${detail || '–'}</td>
      <td class="num ${builders.length ? '' : 'zero'}">${builders.length}</td>
      <td class="num ${next == null ? 'zero' : ''}">${next == null ? '–' : next + (next === 1 ? tt(' Runde', ' turn') : tt(' Runden', ' turns'))}</td></tr>`;
  }).join('') + `<tr><td><b>${tt('Gesamt', 'Total')}</b></td><td class="num"><b>${total[0]}</b></td><td></td><td class="num"><b>${total[1]}</b></td><td></td></tr>`;

  // Zerstörte Einheiten: was du zerstört hast, was Gegner von dir zerstört haben (S.lost – bei mehreren Gegnern zählen
  // Kämpfe der Gegner untereinander hier nicht mit), was sonst verloren ging (siehe killUnit)
  const kMe = (S.kills && S.kills[0]) || {}, kEn = (S.lost && S.lost[0]) || {}, wMe = (S.wasted && S.wasted[0]) || {};
  const many = nPlayers() > 2;
  $('statKillsBy').textContent = many ? tt('Gegner haben zerstört', 'Enemies destroyed') : tt('Gegner hat zerstört', 'Enemy destroyed');
  $('statKillsBy').title = many ? tt('Deine Einheiten, die deine Gegner zerstört haben', 'Your units your enemies destroyed') : tt('Deine Einheiten, die der Gegner zerstört hat', 'Your units the enemy destroyed');
  const ksum = [0, 0, 0];
  const kcell = (n, b) => `<td class="num ${n ? '' : 'zero'}">${b ? '<b>' + n + '</b>' : n}</td>`;
  $('statKills').innerHTML = UNIT_ORDER.map(k => {
    const v = [kMe[k] || 0, kEn[k] || 0, wMe[k] || 0];
    v.forEach((n, i) => { ksum[i] += n; });
    return `<tr><td><span class="sym">${UT[k].sym}</span>${UT[k].name}</td>${v.map(n => kcell(n)).join('')}</tr>`;
  }).join('') + `<tr><td><b>${tt('Gesamt', 'Total')}</b></td>${ksum.map(n => kcell(n, true)).join('')}</tr>`;
  $('statKillsNote').textContent = tt('Mitgezählt wird auch die Ladung versenkter Schiffe und was mit einer eroberten Stadt untergeht. „Sonst verloren“: Jäger ohne Treibstoff und Angriffe auf neutrale Städte.',
      'Cargo of sunk ships and units lost with a captured city are counted too. “Lost otherwise”: fighters out of fuel and attacks on neutral cities.')
    + (S.killsFrom > 1 ? tt(` Gezählt wird in dieser Partie erst seit Runde ${S.killsFrom} (älterer Spielstand).`, ` In this game counting only started in turn ${S.killsFrom} (older save).`) : '');

  $('statCities').innerHTML = myCities.map(c => {
    const p = c.prod ? UT[c.prod] : null;
    const here = topUnitsAt(c.x, c.y).filter(u => u.owner === 0);
    const counts = {};
    for (const u of here) counts[u.type] = (counts[u.type] || 0) + 1;
    const inCity = Object.entries(counts).map(([k, n]) => `${n}× ${UT[k].name}`).join(', ');
    const opts = UNIT_ORDER.map(k => {
      const dis = UT[k].domain === 'sea' && !c.coastal;
      return `<option value="${k}" ${c.prod === k ? 'selected' : ''} ${dis ? 'disabled' : ''}>${UT[k].name} (${UT[k].cost})</option>`;
    }).join('');
    return `<tr><td><button class="citylink" data-city="${c.id}" title="${tt('Zur Stadt springen', 'Jump to city')}">${esc(c.name)}</button>${c.coastal ? ` <span class="muted" style="font-size:12px">${tt('Hafen', 'Port')}</span>` : ''}</td>
      <td><select data-prod="${c.id}">${opts}</select></td>
      <td class="num">${p ? (p.cost - c.progress) + (p.cost - c.progress === 1 ? tt(' Runde', ' turn') : tt(' Runden', ' turns')) : '–'}</td>
      <td class="num muted">${inCity || '–'}</td></tr>`;
  }).join('') || `<tr><td colspan="4" class="muted">${tt('Du hast keine Städte mehr.', 'You have no cities left.')}</td></tr>`;
}
function openStats() { if (!S) return; renderStats(); openModal('mStats'); }
$('bStats').onclick = openStats;
$('mStats').addEventListener('click', e => {
  const b = e.target.closest('[data-city]');
  if (!b) return;
  const c = S.cities[+b.dataset.city];
  closeModals();
  sel = null; selCity = c.id;
  centerOn(c.x, c.y, true);
  refresh();
});
$('mStats').addEventListener('change', e => {
  const id = e.target.dataset.prod;
  if (id == null) return;
  const c = S.cities[+id];
  if (changeProd(c, e.target.value)) Sfx.play('tick');
  renderStats(); refresh();
});

// ------------------------------------------------------------------ Klangtest
const FX_NAMES = EN ? { select: 'Select', tick: 'Click', error: 'Invalid', boom: 'Explosion', salvo: 'Battleship salvo', cover: 'Air cover', lost: 'Unit lost', capture: 'City captured',
  cityLost: 'City lost', built: 'Unit ready', clank: 'Load/unload', endTurn: 'End of turn', alarm: 'Enemy contact', start: 'Game start (Grieg)', victory: 'Victory', defeat: 'Defeat' }
  : { select: 'Auswahl', tick: 'Klick', error: 'Ungültig', boom: 'Explosion', salvo: 'Schlachtschiff-Salve', cover: 'Luftdeckung', lost: 'Einheit verloren', capture: 'Stadt erobert',
  cityLost: 'Stadt verloren', built: 'Einheit fertig', clank: 'Ein-/Ausladen', endTurn: 'Rundenende', alarm: 'Feindkontakt', start: 'Spielstart (Grieg)', victory: 'Sieg', defeat: 'Niederlage' };

function renderSoundTest() {
  const pv = Sfx.previewing();
  $('sndRows').innerHTML = Sfx.kinds().map(k => `<tr>
    <td>${k.name}</td>
    <td><button data-loop="${k.kind}" class="${pv === k.kind ? 'on' : ''}">${pv === k.kind ? tt('■ Stopp', '■ Stop') : tt('▶ Schleife', '▶ Loop')}</button>
        <button data-move="${k.kind}">${tt('▶ Zug', '▶ Move')}</button></td>
    <td><input type="range" min="0" max="200" value="${Math.round(k.level * 100)}" data-level="${k.kind}"> <span class="muted">${Math.round(k.level * 100)} %</span></td>
  </tr>`).join('');
  $('sndFx').innerHTML = Sfx.effects().filter(n => FX_NAMES[n]).map(n => `<button data-fx="${n}">▶ ${FX_NAMES[n]}</button>`).join('');
}
function openSoundTest() { Sfx.unlock(); renderSoundTest(); openModal('mSound'); }
$('bSndTest').onclick = () => { closeModals(); openSoundTest(); };   // aus dem Fenster „Einstellungen“

// ------------------------------------------------------------------ Grafik-Übersicht
// Wie der Klangtest, nur für die Bilder (Einstellungen → Anzeige → Grafiken): Abzeichen in allen Farben samt Zeichen, Städte,
// Gelände, Markierungen und Animationen. Gezeichnet wird mit denselben Funktionen wie auf der Karte (drawToken, drawEffect,
// drawRoute, drawSupportMark …): drawOn leitet ctx und TS kurz auf eine kleine Leinwand um, buildTerrain und drawFog bekommen ein
// Kartenstück (gfxMap). Ändert sich eine Grafik im Spiel, ändert sie sich hier mit. SVG-Code gibt es für die Einheitensymbole
// (ICON_SRC → unitSvg) und die SVG-Symbole der Oberfläche; Städte, Gelände und Effekte entstehen aus Zeichenbefehlen.
function drawOn(g, ts, fn) {
  const c0 = ctx, t0 = TS;
  ctx = g; TS = ts;
  try { fn(); } finally { ctx = c0; TS = t0; }
}
const gfx = { tab: 'units', owner: 0, svg: null, badge: true, raf: 0, live: [], scenes: [], appSvg: null };
const gfxEl = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
// Leinwand für w × h Felder zu je ts CSS-Pixeln, gezeichnet in Gerätepixeln (scharf auch auf hochauflösenden Bildschirmen)
function gfxCanvas(w, h, ts) {
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const c = document.createElement('canvas');
  c.width = Math.round(w * ts * dpr); c.height = Math.round(h * ts * dpr);
  c.style.width = w * ts + 'px'; c.style.height = h * ts + 'px';
  c.ts = ts * dpr;
  return c;
}
// Kartenstück aus Zeichen: ~ Wasser, . Wiese, f Wald, h Hügel, m Berg, M Gipfel, C Stadt (auf Wiese)
const GFX_ELEV = { '.': 0.08, f: 0.38, h: 0.62, m: 0.74, M: 0.9, C: 0.08 };
function gfxMap(rows) {
  const H = rows.length, W = rows[0].length, N = W * H;
  const st = { W, H, over: false, cities: [], terrain: new Uint8Array(N), depth: new Uint8Array(N).fill(255), elev: new Float32Array(N), cityGrid: new Int16Array(N).fill(-1) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = rows[y][x], i = y * W + x;
    if (ch === '~') continue;
    st.terrain[i] = 1; st.elev[i] = GFX_ELEV[ch] || 0.08;
    if (ch === 'C') { st.cityGrid[i] = st.cities.length; st.cities.push([x, y]); }
  }
  // Wassertiefe wie im Kartengenerator: Abstand zum nächsten Land, auch über Eck
  for (let i = 0; i < N; i++) {
    if (st.terrain[i]) { st.depth[i] = 0; continue; }
    for (let j = 0; j < N; j++) if (st.terrain[j]) st.depth[i] = Math.min(st.depth[i], Math.max(Math.abs(j % W - i % W), Math.abs(((j / W) | 0) - ((i / W) | 0))));
  }
  return st;
}
const gu = (type, owner = 0, more = {}) => Object.assign({ id: 0, type, owner, hp: UT[type].hp }, more);
// Bild aus einem Kartenstück: Gelände, Städte (o.cities: Besitzer je Stadt), dann draw(now) mit den Zeichenfunktionen der Karte.
// o.crop = [x, y, w, h]: nur dieser Ausschnitt (Ränder sehen so aus wie mitten auf der Karte); o.live: in jedem Bild neu zeichnen.
function gfxPic(rows, ts, draw, o = {}) {
  const st = gfxMap(rows), [x0, y0, w, h] = o.crop || [0, 0, st.W, st.H], c = gfxCanvas(w, h, ts);
  const bg = buildTerrain(c.ts, st), bgx = bg.getContext('2d');
  st.cities.forEach(([x, y], k) => { const ow = (o.cities || [])[k]; if (ow !== undefined) bgx.drawImage(citySprite(ow, c.ts, k % 2), x * c.ts, y * c.ts); });
  const frame = now => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(bg, -x0 * c.ts, -y0 * c.ts);
    if (!draw) return;
    g.save(); g.translate(-x0 * c.ts, -y0 * c.ts);
    drawOn(g, c.ts, () => draw(now, st));
    g.restore();
  };
  frame(performance.now());
  if (o.live) gfx.live.push(frame);
  return c;
}
const gfxPulse = now => (Math.sin(now / 260) + 1) / 2;   // wie auf der Karte
function gfxCard(pic, title, note, button) {
  const d = gfxEl('div', 'gfx-card');
  d.append(pic, gfxEl('div', 'gfx-t', title));
  if (note) d.append(gfxEl('div', 'gfx-n', note));
  if (button) d.append(button);
  return d;
}
function gfxSection(body, title, note, cw = 0) {   // cw: feste Breite der Karten in px
  body.append(gfxEl('h3', null, title));
  if (note) body.append(gfxEl('p', null, note));
  const grid = gfxEl('div', 'gfx-grid' + (cw ? ' fix' : ''));
  if (cw) grid.style.setProperty('--cw', cw + 'px');
  body.append(grid);
  return grid;
}
function gfxButton(text, data, on = false) {
  const b = gfxEl('button', on ? 'on' : '', text);
  Object.assign(b.dataset, data);
  return b;
}

// Reiter „Einheiten“: Abzeichen je Farbe mit SVG-Code, Zeichen an der Marke, SVG-Symbole der Oberfläche
function gfxUnits(body) {
  const bar = gfxEl('div', 'gfx-colors');
  bar.append(gfxEl('span', 'muted', tt('Farbe:', 'Colour:')));
  PLAYERS.forEach((p, k) => {
    const b = gfxButton('', { gowner: k }, k === gfx.owner), dot = gfxEl('i');
    dot.style.background = p.color;
    b.append(dot, p.name);
    bar.append(b);
  });
  body.append(bar);
  const grid = gfxEl('div', 'gfx-grid fix');
  grid.style.setProperty('--cw', '148px');
  body.append(grid);
  for (const k of UNIT_ORDER) {
    const c = gfxCanvas(1, 1, 80), spr = unitSprite(k, gfx.owner, Math.round(c.ts * 0.8));
    c.getContext('2d').drawImage(spr, (c.width - spr.width) / 2, (c.height - spr.height) / 2);
    const on = gfx.svg && gfx.svg.kind === 'unit' && gfx.svg.type === k;
    grid.append(gfxCard(c, UT[k].name, UNIT_ROLE[k], gfxButton(tt('SVG-Code', 'SVG code'), { gsvg: k }, on)));
  }
  if (gfx.svg && gfx.svg.kind === 'unit') body.append(gfxSvgPanel());

  const st = gfxSection(body, tt('Zeichen an der Marke', 'Marks on the badge'),
    tt('So zeigt die Karte, was mit einer Einheit los ist. Die Zahl steht nur an eigenen Einheiten – wie viel der Gegner an Bord oder in einer Stadt hat, bleibt verborgen.',
      'How the map shows what is going on with a unit. The number only appears on your own units – how much the enemy has on board or in a city stays hidden.'), 124);
  const LAND = ['...', '...', '...'], SEA = ['~~~', '~~~', '~~~'], CITY = ['...', '.C.', '...'];
  const marks = [
    [LAND, gu('tank'), {}, tt('Bereit', 'Ready'), tt('hat noch Züge', 'has moves left')],
    [LAND, gu('tank'), { dim: true }, tt('Fertig', 'Done'), tt('keine Züge mehr oder auf Wache: blasser', 'no moves left or on sentry: faded')],
    [SEA, gu('bat', 0, { hp: 9 }), {}, tt('Leicht beschädigt', 'Lightly damaged'), tt('Balken = Trefferpunkte', 'bar = hit points')],
    [SEA, gu('bat', 0, { hp: 5 }), {}, tt('Beschädigt', 'Damaged'), tt('unter der Hälfte gelb', 'yellow below half')],
    [SEA, gu('bat', 0, { hp: 2 }), {}, tt('Schwer beschädigt', 'Badly damaged'), tt('unter einem Viertel rot', 'red below a quarter')],
    [SEA, gu('trn'), { badge: 4 }, tt('Ladung', 'Cargo'), tt('Zahl = Einheiten an Bord', 'number = units on board')],
    [CITY, gu('inf'), { badge: 3 }, tt('In der Stadt', 'In a city'), tt('kleiner; Zahl = Einheiten in der Stadt', 'smaller; number = units in the city'), true],
    [LAND, gu('inf'), { sentry: true, dim: true }, tt('Wache', 'Sentry'), tt('auch „Laden bis voll“ beim Transporter', 'also “load until full” on a transport')],
    [LAND, gu('tank'), { explore: true }, tt('Erkunden', 'Explore')],
    [LAND, gu('ftr'), { patrol: true }, tt('Patrouille', 'Patrol')],
    [LAND, gu('tank'), { goto: true }, tt('Marsch', 'March')],
    [SEA, gu('trn'), { landing: true, badge: 2 }, tt('Ausladen, wenn möglich', 'Unload when possible')],
    [SEA, gu('sub'), {}, tt('U-Boot getaucht', 'Submarine submerged'), tt('der Normalfall, ohne Zeichen', 'the normal state, no mark')],
    [SEA, gu('sub', 0, { surf: true }), {}, tt('U-Boot aufgetaucht', 'Submarine surfaced'), tt('nach einem Angriff, für alle sichtbar', 'after an attack, visible to all')],
  ];
  for (const [rows, u, opts, title, note, inCity] of marks) {
    const pic = gfxPic(rows, 58, () => {
      if (inCity) drawToken(u, TS + TS * 0.36, TS + TS * 0.36, TS * 0.66, opts);
      else drawToken(u, TS, TS, TS, opts);
    }, { crop: [1, 1, 1, 1], cities: [0] });
    st.append(gfxCard(pic, title, note));
  }

  const ui = gfxSection(body, tt('Symbole der Oberfläche', 'Interface symbols'), tt('Ebenfalls SVG: das Symbol der App und der Knopf „Zentrieren“ oben in der Leiste.',
    'Also SVG: the app icon and the “Centre” button in the top bar.'));
  const icon = document.querySelector('link[rel="icon"]');
  const app = gfxEl('img'); app.src = icon ? icon.href : 'favicon.svg'; app.width = app.height = 64; app.alt = '';
  ui.append(gfxCard(app, tt('App-Symbol', 'App icon'), tt('Reiter des Browsers, installierte App', 'browser tab, installed app'),
    gfxButton(tt('SVG-Code', 'SVG code'), { gicon: 'app' }, !!gfx.svg && gfx.svg.id === 'app')));
  const foc = gfxEl('div'); foc.style.cssText = 'width:64px;height:64px;display:flex;align-items:center;justify-content:center;color:var(--text)';
  foc.innerHTML = gfxFocusSvg().replace(/width="\d+" height="\d+"/, 'width="40" height="40"');
  ui.append(gfxCard(foc, tt('Zentrieren', 'Centre'), tt('Knopf oben, Taste F', 'top button, key F'),
    gfxButton(tt('SVG-Code', 'SVG code'), { gicon: 'focus' }, !!gfx.svg && gfx.svg.id === 'focus')));
  if (gfx.svg && gfx.svg.kind === 'icon') body.append(gfxSvgPanel());
}
// SVG des Knopfs „Zentrieren“ (steht in index.html) als eigenständige Datei: mit xmlns, ohne Stil der Leiste, eine Zeile je Element
function gfxFocusSvg() {
  const s = $('bFocus').querySelector('svg').cloneNode(true);
  s.removeAttribute('style');
  return new XMLSerializer().serializeToString(s).replace(/></g, '>\n  <').replace(/\n {2}<\/svg>$/, '\n</svg>') + '\n';
}
// SVG des App-Symbols: in der Einzeldatei steht es als data:-Adresse im Kopf, sonst liegt es als favicon.svg daneben
function gfxLoadAppSvg() {
  if (gfx.appSvg != null) return;
  gfx.appSvg = '';
  const href = (document.querySelector('link[rel="icon"]') || {}).href || '';
  const m = /^data:image\/svg\+xml;base64,(.*)$/.exec(href);
  if (m) { gfx.appSvg = new TextDecoder().decode(Uint8Array.from(atob(m[1]), ch => ch.charCodeAt(0))); return; }
  fetch(href).then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then(t => { gfx.appSvg = t; }, () => { gfx.appSvg = false; })
    .then(() => { if (!$('mGfx').hidden && gfx.tab === 'units') renderGfx(); });
}
// Code, Vorschau und Knöpfe zum gewählten SVG
function gfxSvgCode() {
  const s = gfx.svg;
  if (s.kind === 'unit') {
    const name = UT[s.type].name;
    return { title: name, file: `archipel-${s.type}${gfx.badge ? '-' + (EN ? ['blue', 'red', 'yellow', 'purple'] : ['blau', 'rot', 'gelb', 'violett'])[gfx.owner] : ''}.svg`,
      code: unitSvg(s.type, gfx.owner, gfx.badge, `Archipel – ${name}${gfx.badge ? ' (' + PLAYERS[gfx.owner].name + ')' : ''}`) };
  }
  if (s.id === 'focus') return { title: tt('Zentrieren', 'Centre'), file: 'archipel-zentrieren.svg', code: gfxFocusSvg() };
  gfxLoadAppSvg();
  return { title: tt('App-Symbol', 'App icon'), file: 'favicon.svg', code: gfx.appSvg || '',
    note: gfx.appSvg === false ? tt('Der Code lässt sich hier nicht lesen (Offline-Ordner) – es ist die Datei favicon.svg neben index.html.',
      'The code cannot be read here (offline folder) – it is the file favicon.svg next to index.html.') : !gfx.appSvg ? tt('Lädt …', 'Loading …') : '' };
}
function gfxSvgPanel() {
  const { title, code, note } = gfxSvgCode();
  const p = gfxEl('div', 'gfx-svg');
  p.id = 'gfxSvg';
  const head = gfxEl('div', 'gfx-svg-head');
  head.append(gfxEl('b', null, tt(`SVG-Code: ${title}`, `SVG code: ${title}`)));
  if (gfx.svg.kind === 'unit') {
    const seg = gfxEl('span', 'gfx-seg');
    seg.append(gfxButton(tt('Abzeichen wie im Spiel', 'Badge as in the game'), { gmode: 'badge' }, gfx.badge),
      gfxButton(tt('Nur Symbol', 'Symbol only'), { gmode: 'symbol' }, !gfx.badge));
    head.append(seg);
  }
  const bodyEl = gfxEl('div', 'gfx-svg-body'), prev = gfxEl('div', 'gfx-svg-prev' + (gfx.svg.kind === 'unit' && !gfx.badge ? ' light' : ''));
  if (code) { const img = gfxEl('img'); img.alt = ''; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(code); prev.append(img); }
  bodyEl.append(prev, gfxEl('pre', null, code || note));
  const row = gfxEl('div', 'row');
  row.append(gfxButton(tt('Kopieren', 'Copy'), { gcopy: 1 }), gfxButton(tt('Als Datei speichern', 'Save as file'), { gsave: 1 }),
    gfxButton(tt('Schließen', 'Close'), { gclose: 1 }));
  if (!code) row.querySelectorAll('[data-gcopy], [data-gsave]').forEach(b => { b.disabled = true; });
  if (gfx.svg.kind === 'unit') row.append(gfxEl('span', 'muted', gfx.badge
    ? tt('Vorschau links: genau dieser Code. Die Pfade stammen aus dem Spiel, Kreis, Verlauf und Schatten sind nachgebaut.', 'Preview: exactly this code. The paths come from the game; circle, gradient and shadow are rebuilt.')
    : tt('Die Pfade im 100×100-Raster, so wie das Spiel sie zeichnet; Aussparungen als Maske, Farbe frei wählbar (currentColor).', 'The paths on the 100×100 grid as the game draws them; cut-outs as a mask, colour free to choose (currentColor).')));
  p.append(head, bodyEl, row);
  return p;
}
async function gfxCopy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  // ohne Zwischenablage-Schnittstelle (z. B. Offline-Datei): über eine unsichtbare Auswahl kopieren
  const ta = gfxEl('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove();
  return ok;
}

// Reiter „Städte und Gelände“
function gfxLand(body) {
  const cg = gfxSection(body, tt('Städte', 'Cities'), tt('Dächer und Fahne in der Farbe des Besitzers; zwei Anordnungen der Häuser wechseln sich ab.',
    'Roofs and flag in the owner\'s colour; two layouts of the houses alternate.'));
  [[-1, tt('Neutral', 'Neutral')], ...PLAYERS.map((p, k) => [k, p.name])].forEach(([ow, name]) =>
    cg.append(gfxCard(gfxPic(['....', '.CC.', '....'], 56, null, { crop: [1, 1, 2, 1], cities: [ow, ow] }), name)));

  const tg = gfxSection(body, tt('Gelände', 'Terrain'), tt('Das Wasser wird dunkler, je weiter das Land entfernt ist; an der Küste schimmert Flachwasser. Wald, Hügel und Berge folgen der Höhe – sie sind nur Bild und ändern nichts an den Regeln.',
    'The water gets darker the further away land is; shallow water shimmers along the coast. Forest, hills and mountains follow the height – they are only pictures and do not change the rules.'));
  const pano = gfxPic(['~~~~~..ffhhmmMM', '~~~~...ffhhmmMM', '~~~~~..ffhhmmMM', '~~~~~~.ffhhmmMM', '~~~~~..ffhhmmMM'], 40);
  const wrapP = gfxEl('div', 'gfx-card');
  const leg = gfxEl('div', 'gfx-legend');
  const cols = [[4, tt('Meer', 'Sea')], [3, tt('Küste und Wiese', 'Coast and meadow')], [2, tt('Wald', 'Forest')], [2, tt('Hügel', 'Hills')], [2, tt('Berge', 'Mountains')], [2, tt('Gipfel', 'Peaks')]];
  leg.style.gridTemplateColumns = cols.map(([n]) => n * 40 + 'px').join(' ');
  for (const [, t] of cols) leg.append(gfxEl('span', null, t));
  wrapP.append(pano, leg);
  tg.append(wrapP);
  tg.append(gfxCard(gfxPic(['..~~~', '..~~~', '~~...'], 40), tt('Steg über Eck', 'Corner bridge'),
    tt('Land, das sich nur an einer Ecke berührt: Bodentruppen gehen hinüber, Schiffe fahren darunter durch. Auf dem Festland sind das die Brücken über die Flüsse.',
      'Land touching only at a corner: land units cross, ships sail underneath. On the mainland these are the bridges over the rivers.')));

  const fg = gfxSection(body, tt('Nebel', 'Fog'), tt('Von links nach rechts: unerforscht, erforscht – aber gerade nicht in Sicht (dort zeigt die Karte den letzten bekannten Stand), in Sicht.',
    'Left to right: unexplored, explored but not in sight right now (the map shows the last known state there), in sight.'));
  const fogPic = gfxPic(['~~~..f...', '~~...C.f.', '~~~..h...'], 40, (now, st) => {
    const seen = new Uint8Array(st.W * st.H), vis = new Uint8Array(st.W * st.H);
    for (let i = 0; i < seen.length; i++) { const x = i % st.W; seen[i] = x >= 3 ? 1 : 0; vis[i] = x >= 6 ? 1 : 0; }
    drawFog({ seen, vis }, st);
  }, { cities: [1] });
  const fogCard = gfxEl('div', 'gfx-card'), fogLeg = gfxEl('div', 'gfx-legend');
  fogLeg.style.gridTemplateColumns = '120px 120px 120px';
  for (const t of [tt('unerforscht', 'unexplored'), tt('erforscht', 'explored'), tt('in Sicht', 'in sight')]) fogLeg.append(gfxEl('span', null, t));
  fogCard.append(fogPic, fogLeg);
  fg.append(fogCard);
}

// Reiter „Markierungen“
function gfxMarks(body) {
  const P0 = PLAYERS[0].light, pct = v => Math.round(v * 100) + ' %';
  const sel = gfxSection(body, tt('Gewählte Einheit', 'Selected unit'));
  sel.append(gfxCard(gfxPic(['...', '...', '...'], 40, now => { drawToken(gu('tank'), TS, TS, TS); drawSelRing(1, 1, gfxPulse(now)); }, { live: true }),
    tt('Auswahl', 'Selection'), tt('pulsierender Ring', 'pulsing ring')));
  sel.append(gfxCard(gfxPic(['...', '..~', '..~'], 40, now => {
    drawToken(gu('inf', 1), 0, 0, TS); drawToken(gu('trn'), 2 * TS, TS, TS);
    for (const [x, y, k] of [[0, 0, 'attack'], [1, 0, 'move'], [2, 0, 'move'], [0, 1, 'move'], [2, 1, 'board'], [0, 2, 'move'], [1, 2, 'move']]) drawHint(x, y, k);
    drawToken(gu('tank'), TS, TS, TS); drawSelRing(1, 1, gfxPulse(now));
  }, { live: true }), tt('Zugmarker', 'Move markers'), tt('Punkt: frei · gold: an Bord gehen · Fadenkreuz: angreifen', 'dot: free · gold: go aboard · crosshair: attack')));
  sel.append(gfxCard(gfxPic(['....', '..f.', '....'], 40, now => {
    drawGotoPath(0, 2, [[1, 1], [2, 1], [3, 0]], now); drawToken(gu('tank'), 0, 2 * TS, TS, { goto: true }); drawSelRing(0, 2, gfxPulse(now));
  }, { live: true }), tt('Marschweg', 'March route'), tt('laufende Striche bis zum Ziel', 'moving dashes to the destination')));
  sel.append(gfxCard(gfxPic(['....', '....', '~~..'], 40, now => {
    drawToken(gu('ftr'), 0, TS, TS, { patrol: true });
    drawPatrolRoute({ start: [0, 1], pts: [[2, 0], [3, 2]], editing: false }, now);
  }, { live: true }), tt('Patrouille', 'Patrol'), tt('S = Start, Zahlen = Wegpunkte', 'S = start, numbers = waypoints')));

  const mouse = gfxSection(body, tt('Maus und Chancen', 'Mouse and odds'));
  mouse.append(gfxCard(gfxPic(['...', '...', '...'], 40, () => drawHoverFrame(1, 1, false)), tt('Feld unter der Maus', 'Tile under the mouse')));
  mouse.append(gfxCard(gfxPic(['...', '...', '...'], 40, () => {
    drawToken(gu('tank'), 0, TS, TS); drawToken(gu('inf', 1), TS, TS, TS); drawHoverFrame(1, 1, true); drawOdds(1, 1, 0.72);
  }), tt('Siegchance', 'Odds of winning'), tt('grün ab 50 %', 'green from 50 %')));
  mouse.append(gfxCard(gfxPic(['...', '...', '...'], 40, () => {
    drawToken(gu('inf'), 0, TS, TS); drawToken(gu('tank', 1), TS, TS, TS); drawHoverFrame(1, 1, true); drawOdds(1, 1, 0.31);
  }), tt('Siegchance gering', 'Poor odds'), tt('rot unter 50 %', 'red below 50 %')));
  mouse.append(gfxCard(gfxPic(['~~..', '~C..', '~~..'], 40, now => {
    drawToken(gu('trn'), 0, TS, TS, { badge: 3 }); drawSelRing(0, 1, gfxPulse(now)); drawAssaultChance(1, 1, CAPTURE_BASE + SUPPORT_CAPTURE, gfxPulse(now));
  }, { live: true, cities: [1] }), tt('Sturm vom Schiff', 'Assault from the ship'), tt('Chance, die Stadt mit den Truppen an Bord zu nehmen', 'chance to take the city with the troops on board')));

  const sup = gfxSection(body, tt('Unterstützung', 'Support'), tt('In der Farbe des Schiffs, das unterstützt.', 'In the colour of the supporting ship.'));
  sup.append(gfxCard(gfxPic(['~~.', '~C.', '~..'], 44, () => { drawToken(gu('bat'), 0, TS, TS); drawSupportMark(1, 1, false, P0); }, { cities: [1] }),
    tt('Stadt unter Feuer', 'City under fire'), tt(`Schlachtschiff daneben: fällt zu ${pct(CAPTURE_BASE + SUPPORT_CAPTURE)}`, `battleship next to it: falls at ${pct(CAPTURE_BASE + SUPPORT_CAPTURE)}`)));
  sup.append(gfxCard(gfxPic(['~~.', '~C.', '~..'], 44, () => { drawToken(gu('bat'), 0, TS, TS); drawSupportMark(1, 1, true, P0); }, { cities: [0] }),
    tt('Feuerschutz', 'Fire cover'), tt(`eigene Stadt fällt nur zu ${pct(CAPTURE_BASE - SUPPORT_CAPTURE)}`, `own city falls only at ${pct(CAPTURE_BASE - SUPPORT_CAPTURE)}`)));
  sup.append(gfxCard(gfxPic(['~~~~', '~~~~', '~~~~'], 44, () => {
    drawSupportMark(1, 1, true, P0); drawSupportMark(2, 1, true, P0);
    drawToken(gu('car'), TS, TS, TS, { badge: 2 }); drawToken(gu('trn'), 2 * TS, TS, TS, { badge: 6 });
  }), tt('Luftdeckung', 'Air cover'), tt('Träger mit Jägern schützt die Schiffe nebenan', 'a carrier with fighters protects the ships next to it')));

  const rt = gfxSection(body, tt('Wegeansicht (Taste G)', 'Route view (key G)'), tt('Alle Befehle auf einen Blick – unterscheidbar auch ohne Farbe: Striche, Punkte, Strich-Punkt.',
    'All orders at a glance – distinguishable without colour too: dashes, dots, dash-dot.'));
  rt.append(gfxCard(gfxPic(['....', '..f.', '....'], 40, () => { drawRoute({ kind: 'goto', pts: [[0, 2], [1, 1], [2, 1], [3, 0]] }); drawToken(gu('tank'), 0, 2 * TS, TS, { goto: true }); }),
    tt('Marsch', 'March')));
  rt.append(gfxCard(gfxPic(['....', '....', '~~..'], 40, () => { drawRoute({ kind: 'patrol', pts: [[0, 1], [2, 0], [3, 2]], at: [1, 1], next: [2, 0] }); drawToken(gu('ftr'), TS, TS, TS, { patrol: true }); }),
    tt('Patrouille', 'Patrol')));
  rt.append(gfxCard(gfxPic(['....', 'C...', '....'], 40, () => drawRoute({ kind: 'rally', pts: [[0, 1], [1, 1], [2, 0], [3, 0]] }), { cities: [0] }),
    tt('Marschziel einer Stadt', 'Rally point of a city')));
  rt.append(gfxCard(gfxPic(['..~~', 'C.~~', '..~~'], 40, () => drawRoute({ kind: 'rally', pts: [[0, 1], [3, 1]], bad: true }), { cities: [0] }),
    tt('Marschziel ungültig', 'Rally point invalid'), tt('kein Weg dorthin', 'no way there')));

  const pv = gfxSection(body, tt('Produktionsansicht (Taste V)', 'Production view (key V)'), tt('Symbol der Einheit im Bau, Fortschritt als Ring, Restzeit in Runden.',
    'Symbol of the unit being built, progress as a ring, turns remaining.'));
  pv.append(gfxCard(gfxPic(['...', '.C.', '...'], 48, () => drawProdCity({ x: 1, y: 1, prod: 'tank', progress: 3 }, false), { cities: [0] }), UT.tank.name));
  pv.append(gfxCard(gfxPic(['~..', '~C.', '~..'], 48, () => drawProdCity({ x: 1, y: 1, prod: 'crs', progress: 26 }, true), { cities: [0] }), UT.crs.name,
    tt('mit der Maus darüber', 'with the mouse over it')));
}

// Reiter „Animationen“: kleine Zeitleisten mit denselben Ereignissen wie auf der Karte (anim.events), abgespielt mit drawEffect,
// animPos und eventSound. Zeiten wie in den hooks (Explosion 650 ms, Salve 560 ms …), Bewegung im Tempo „normal“.
function gfxAnimSpecs() {
  const MV = 120 * REPLAY.normal.f;
  const mv = (id, utype, owner, pts, t0 = 0) => pts.slice(1).map((p, k) => ({ type: 'move', id, utype, owner, fx: pts[k][0], fy: pts[k][1], tx: p[0], ty: p[1], t0: t0 + k * MV, dur: MV }));
  const boom = (x, y, t0, hl = false) => ({ type: 'boom', x, y, t0, dur: 650, hl });
  const label = (x, y, text, tone, t0) => ({ type: 'label', x, y, text, tone, t0, dur: LABEL_MS });
  const P0 = PLAYERS[0].light;
  return [
    { title: tt('Bewegung', 'Movement'), note: tt('Feld für Feld, mit dem Klang der Einheit', 'tile by tile, with the unit\'s sound'),
      rows: ['~..f.', '.....', '~~.h.'], units: [gu('tank', 0, { id: 1, x: 1, y: 1 })], events: mv(1, 'tank', 0, [[1, 1], [2, 1], [3, 1], [4, 0]]) },
    { title: tt('Angriff gewonnen', 'Attack won'), note: tt('Explosion, der Verlierer verschwindet, Schriftzug', 'explosion, the loser vanishes, label'),
      rows: ['..f..', '.....', 'f...h'], units: [gu('tank', 0, { id: 1, x: 1, y: 1 }), gu('inf', 1, { id: 2, x: 2, y: 1, gone: 280 })],
      events: [boom(2, 1, 0), label(2, 1, tt('Sieg!', 'Victory!'), 'good', 250)] },
    { title: tt('Angriff verloren', 'Attack lost'), note: tt('eigener Verlust: zusätzlicher Klang', 'own loss: an extra sound'),
      rows: ['..f..', '.....', 'f...h'], units: [gu('tank', 0, { id: 1, x: 1, y: 1, gone: 280 }), gu('inf', 1, { id: 2, x: 2, y: 1 })],
      events: [boom(2, 1, 0, true), label(2, 1, tt('Verloren', 'Lost'), 'bad', 250)] },
    { title: tt('Salve und Eroberung', 'Salvo and capture'), note: tt('Schlachtschiff feuert, dann fällt die Stadt', 'the battleship fires, then the city falls'),
      rows: ['~~~.f', '~~~C.', '~~~..'], cities: [{ owner: 1, to: 0, at: 560 }],
      units: [gu('bat', 0, { id: 1, x: 2, y: 1 }), gu('inf', 0, { id: 2, x: 4, y: 1, gone: 660 })],
      marks: rel => drawSupportMark(3, 1, rel >= 560, P0),
      events: [{ type: 'salvo', fx: 2, fy: 1, x: 3, y: 1, t0: 0, dur: 560 }, { type: 'capture', x: 3, y: 1, owner: 0, lost: false, t0: 560, dur: 900 }] },
    { title: tt('Luftdeckung', 'Air cover'), note: tt('Jäger vom Träger fangen den Angreifer ab', 'fighters from the carrier intercept the attacker'),
      rows: ['~~~~~', '~~~~~', '~~~~~'], units: [gu('car', 0, { id: 1, x: 1, y: 1 }), gu('trn', 0, { id: 2, x: 2, y: 1 }), gu('ftr', 1, { id: 3, x: 3, y: 0, gone: 800 })],
      marks: () => { drawSupportMark(1, 1, true, P0); drawSupportMark(2, 1, true, P0); },
      events: [{ type: 'cover', fx: 1, fy: 1, x: 3, y: 0, sx: 2, sy: 1, col: P0, t0: 0, dur: 700 }, boom(2, 1, 520), label(2, 1, tt('Abgewehrt!', 'Repelled!'), 'good', 770)] },
    { title: tt('Stadt erobert', 'City captured'), note: tt('der Eroberer geht in der Stadt auf', 'the conqueror merges into the city'),
      rows: ['..f..', '..C..', '~~..h'], cities: [{ owner: -1, to: 0, at: 0 }], units: [gu('inf', 0, { id: 1, x: 3, y: 1, gone: 100 })],
      events: [{ type: 'capture', x: 2, y: 1, owner: 0, lost: false, t0: 0, dur: 900 }] },
    { title: tt('Stadt verloren', 'City lost'), note: tt('der Gegner nimmt eine eigene Stadt', 'the enemy takes one of your cities'),
      rows: ['..f..', '..C..', '~~..h'], cities: [{ owner: 0, to: 1, at: 0 }], units: [gu('inf', 1, { id: 1, x: 3, y: 1, gone: 100 })],
      events: [{ type: 'capture', x: 2, y: 1, owner: 1, lost: true, t0: 0, dur: 900 }, label(2, 1, tt('Stadt verloren', 'City lost'), 'bad', 150)] },
  ];
}
function gfxScene(spec) {
  const st = gfxMap(spec.rows), c = gfxCanvas(st.W, st.H, 46), bg = buildTerrain(c.ts, st);
  const byUnit = new Map();
  for (const e of spec.events) if (e.type === 'move') { if (!byUnit.has(e.id)) byUnit.set(e.id, []); byUnit.get(e.id).push(e); }
  const sc = { c, t0: null, done: true, played: new Set(), end: Math.max(...spec.events.map(e => e.t0 + e.dur)) };
  sc.frame = now => {
    const rel = sc.t0 == null ? -1 : now - sc.t0;   // -1: Ausgangslage
    const g = c.getContext('2d');
    g.drawImage(bg, 0, 0);
    st.cities.forEach(([x, y], k) => { const cs = spec.cities[k]; g.drawImage(citySprite(rel >= cs.at ? cs.to : cs.owner, c.ts, k % 2), x * c.ts, y * c.ts); });
    drawOn(g, c.ts, () => {
      if (spec.marks) spec.marks(rel);
      for (const u of spec.units) {
        if (u.gone != null && rel >= u.gone) continue;
        const evs = byUnit.get(u.id), last = evs && evs[evs.length - 1];
        const [x, y] = animPos(u, rel, byUnit) || (last && rel >= 0 ? [last.tx, last.ty] : [u.x, u.y]);
        drawToken(u, x * TS, y * TS, TS);
      }
      if (rel >= 0) for (const e of spec.events) if (e.type !== 'move' && rel >= e.t0 && rel <= e.t0 + e.dur) drawEffect(e, (rel - e.t0) / e.dur);
    });
    if (rel >= 0) for (const e of spec.events) if (!sc.played.has(e) && rel >= e.t0) { sc.played.add(e); eventSound(e, byUnit); }
    if (rel > sc.end + 60) sc.done = true;
  };
  sc.frame(performance.now());
  return sc;
}
function gfxAnims(body) {
  body.append(gfxEl('p', null, tt('▶ spielt die Animation so ab wie auf der Karte, mit Ton (Lautstärke wie im Spiel). Die Zeitleiste der Karte nutzt dieselben Bausteine.',
    '▶ plays the animation as on the map, with sound (volume as in the game). The timeline on the map uses the same building blocks.')));
  const grid = gfxEl('div', 'gfx-grid');
  body.append(grid);
  gfxAnimSpecs().forEach((spec, k) => {
    const sc = gfxScene(spec);
    gfx.scenes.push(sc);
    grid.append(gfxCard(sc.c, spec.title, spec.note, gfxButton(tt('▶ Abspielen', '▶ Play'), { gplay: k })));
  });
}

function gfxLoop(now) {
  gfx.raf = 0;
  if ($('mGfx').hidden) return;
  for (const f of gfx.live) f(now);
  for (const sc of gfx.scenes) if (!sc.done) sc.frame(now);
  gfx.raf = requestAnimationFrame(gfxLoop);
}
function renderGfx() {
  const body = $('gfxBody'), keep = body.dataset.tab === gfx.tab ? body.scrollTop : 0;
  gfx.live = []; gfx.scenes = [];
  for (const b of $('gfxTabs').querySelectorAll('button')) b.classList.toggle('on', b.dataset.gtab === gfx.tab);
  body.textContent = '';
  body.dataset.tab = gfx.tab;
  ({ units: gfxUnits, land: gfxLand, marks: gfxMarks, anim: gfxAnims })[gfx.tab](body);
  body.scrollTop = keep;
  if (!gfx.raf) gfx.raf = requestAnimationFrame(gfxLoop);
}
function openGfx() { Sfx.unlock(); gfx.svg = null; renderGfx(); openModal('mGfx'); }
$('bGfx').onclick = () => { closeModals(); openGfx(); };   // aus dem Fenster „Einstellungen“
// Landschaft der laufenden Partie (S.land, LANDSCAPES in gfx.js): nur die Farben der Karte. Wird mit der Partie gespeichert.
const LAND_NAMES = { gruen: tt('Grüne Inseln', 'Green islands'), wueste: tt('Wüste', 'Desert'), schnee: tt('Schnee', 'Snow'), lava: tt('Lava', 'Lava'), alien: tt('Fremder Planet', 'Alien planet') };
function setLandscape(v) {
  if (!LANDSCAPES[v]) v = 'gruen';
  $('landSel').value = v;
  if (S) { S.land = v; buildTerrainCache(); refresh(); }
}
$('landSel').innerHTML = Object.keys(LANDSCAPES).map(k => `<option value="${k}">${esc(LAND_NAMES[k] || k)}</option>`).join('');
try { localStorage.removeItem('archipel-land'); } catch (e) {}   // kurze Zwischenfassung: Landschaft als Einstellung
$('landSel').onchange = e => setLandscape(e.target.value);

// ---------------------------------------------------------------------------
// Zurücksetzen (Einstellungen; Wunsch des Nutzers: mehrere teilen sich einen Rechner). Das Spiel merkt sich alles im Browser unter
// „archipel-…“ (keine Cookies): Einstellungen, gesehene Tipps, Willkommensfenster, die laufende Partie, benannte Spielstände.
// Zurücksetzen löscht alles davon und lädt die Seite neu – wie beim ersten Besuch. Benannte Spielstände bleiben, außer der Haken
// in der Rückfrage ist gesetzt (sie könnten jemand anderem gehören).
// ---------------------------------------------------------------------------
const isSlotKey = k => k === 'archipel-slots' || k.startsWith('archipel-slot-');
function resetKeys(alsoSaves) {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('archipel-') && (alsoSaves || !isSlotKey(k))) out.push(k); } } catch (e) {}
  return out;
}
function resetAll(alsoSaves) {
  resetting = true; clearTimeout(queueSave.t);
  try { for (const k of resetKeys(alsoSaves)) localStorage.removeItem(k); } catch (e) {}
  location.reload();
}
function askReset() {
  const n = listSlots().length;
  $('offerTitle').textContent = tt('Wirklich alles zurücksetzen?', 'Really reset everything?');
  $('offerText').innerHTML = tt('Alle Einstellungen, die gesehenen Tipps und die <b>laufende Partie</b> werden gelöscht. Danach beginnt das Spiel wie beim ersten Besuch.',
    'All settings, the tips you have seen and the <b>current game</b> will be deleted. The game then starts as on the first visit.')
    + (n ? `<br><br><label class="chk"><input type="checkbox" id="resetSaves"> ${tt(`Auch die gespeicherten Spielstände löschen (${n})`, `Also delete the saved games (${n})`)}</label>`
      : '') + '<br><br>' + tt('Das lässt sich nicht rückgängig machen.', 'This cannot be undone.');
  // der hervorgehobene Knopf ist die sichere Wahl
  $('offerYes').textContent = tt('Abbrechen', 'Cancel');
  $('offerNo').textContent = tt('Ja, zurücksetzen', 'Yes, reset');
  $('offerYes').onclick = () => closeModals();
  $('offerNo').onclick = () => resetAll(!!($('resetSaves') && $('resetSaves').checked));
  openModal('mOffer');
}
$('bReset').onclick = () => { closeModals(); askReset(); };
$('mGfx').addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.gtab) { if (gfx.tab !== d.gtab) { gfx.tab = d.gtab; gfx.svg = null; renderGfx(); } return; }
  if (d.gowner != null) { gfx.owner = +d.gowner; renderGfx(); return; }
  if (d.gsvg || d.gicon) {
    const next = d.gsvg ? { kind: 'unit', type: d.gsvg } : { kind: 'icon', id: d.gicon };
    const same = gfx.svg && gfx.svg.kind === next.kind && (gfx.svg.type || gfx.svg.id) === (next.type || next.id);
    gfx.svg = same ? null : next;   // noch einmal geklickt: zuklappen
    renderGfx();
    const p = $('gfxSvg');
    if (p) p.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (d.gmode) { gfx.badge = d.gmode === 'badge'; renderGfx(); return; }
  if (d.gclose) { gfx.svg = null; renderGfx(); return; }
  if (d.gcopy || d.gsave) {
    const { code, file } = gfxSvgCode();
    if (!code) return;
    if (d.gcopy) {
      const ok = await gfxCopy(code);
      toast(ok ? tt('SVG-Code kopiert', 'SVG code copied') : tt('Kopieren ging nicht – Code im Feld markieren und mit Strg+C kopieren', 'Copying failed – select the code in the box and press Ctrl+C'), 2200);
      Sfx.play(ok ? 'select' : 'error');
    } else {
      const url = URL.createObjectURL(new Blob([code], { type: 'image/svg+xml' }));
      const a = gfxEl('a'); a.href = url; a.download = file; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    return;
  }
  if (d.gplay != null) {
    const sc = gfx.scenes[+d.gplay];
    if (!sc) return;
    sc.t0 = performance.now(); sc.done = false; sc.played.clear();
    if (!gfx.raf) gfx.raf = requestAnimationFrame(gfxLoop);
  }
});
// Fenster „Einstellungen“ (☰ Menü → Einstellungen …): Ton, Anzeige, Spielablauf, Steuerung, Schummeln. Die Bedienelemente behalten
// ihre Kennungen (vol, replaySel, powerChk …) und werden an ihren bisherigen Stellen verdrahtet; neue Einstellungen gehören hierher.
// Reiter der Einstellungen (wie im Handbuch): view, flow, input, special. Der zuletzt geöffnete wird gemerkt – außer „Schummeln & Zurücksetzen“,
// dort soll niemand versehentlich landen.
function setTab(name) {
  const tabs = [...$('setTabs').querySelectorAll('button')];
  if (!tabs.some(b => b.dataset.settab === name)) name = 'view';
  for (const b of tabs) b.classList.toggle('on', b.dataset.settab === name);
  for (const p of $('mSettings').querySelectorAll('[data-setpane]')) p.hidden = p.dataset.setpane !== name;
  try { localStorage.setItem('archipel-settab', name === 'special' ? 'view' : name); } catch (e) {}
}
$('setTabs').addEventListener('click', e => { const b = e.target.closest('button[data-settab]'); if (b) setTab(b.dataset.settab); });
function openSettings(tab) {
  closeMenu(); closeCtx();
  if (typeof tab !== 'string') { tab = null; try { tab = localStorage.getItem('archipel-settab'); } catch (e) {} }
  $('landSel').value = (S && S.land) || 'gruen';
  setTab(tab); openModal('mSettings');
}
$('bSettings').onclick = openSettings;
$('bHelpMenu').onclick = () => { closeMenu(); openHelp(); };
// Erklärvideos: eigene Seite im Internet (GitHub Pages), auch aus der Offline-Fassung – deshalb überall als „online ↗“ gekennzeichnet
// und in einem neuen Reiter. Die Sprache wird mitgegeben (die Offline-Fassung teilt keinen localStorage mit der Seite).
const VIDEO_URL = 'https://masa3418.github.io/archipel/docs/videos/';
for (const a of document.querySelectorAll('a[data-videos]')) {
  a.href = VIDEO_URL + '?lang=' + (EN ? 'en' : 'de'); a.target = '_blank'; a.rel = 'noopener';
  a.addEventListener('click', () => closeMenu());
}
// Beispiel-Spielstände (docs/spielstaende/, erzeugt mit tools/beispiele.js; nicht im Release). Online liegen sie auf demselben Server
// wie das Spiel und lassen sich im Handbuch („Über das Spiel“) direkt laden. Die Offline-Fassung lädt nichts aus dem Internet – dort
// nur der Link zum Herunterladen (danach „Aus Datei laden“). Neue Beispiele hier und in der Tabelle im README eintragen.
// Je Beispiel: Datei, Titel, Eckdaten (Zeile zum Aufklappen), Schilderung der Lage (erst aufgeklappt, mit dem Laden-Knopf – Wunsch des
// Nutzers: Lust auf die Partie machen statt einer Liste von Knöpfen). Runden und Städte stehen auch im README – nach dem Neuerzeugen beides anpassen.
const EXAMPLES = [
  ['beispiel-1-inselreich-anfang', tt('Inselreich, Anfang', 'Archipelago, opening'), tt('Runde 43 · mittlere Karte · Normal', 'Turn 43 · medium map · Normal'),
    tt('Deine Heimatinsel gehört dir, die ersten Transporter sind gebaut – und ringsum liegt fast alles noch im Nebel. Irgendwo dort draußen tut der Gegner gerade dasselbe wie du. Wohin schickst du die ersten Truppen? Der ruhigste Einstieg: Hier ist noch nichts entschieden und nichts verloren.',
      'Your home island is yours, the first transports are built – and almost everything around you still lies in the fog. Somewhere out there the enemy is doing exactly what you are doing. Where do you send your first troops? The calmest way in: nothing is decided yet, and nothing is lost.')],
  ['beispiel-2-inselreich-seekrieg', tt('Inselreich, Seekrieg', 'Archipelago, naval war'), tt('Runde 108 · 11 : 11 Städte', 'Turn 108 · 11 : 11 cities'),
    tt('Elf Städte gegen elf, und zwischen euch nur Wasser. Wer die See beherrscht, bringt seine Truppen hinüber – wer sie verliert, sieht seine Transporter sinken. Jeder Kreuzer zählt, und ein einziges U-Boot vor dem Hafen kann eine ganze Landung kosten. Eine Partie auf Messers Schneide.',
      'Eleven cities against eleven, and nothing but water between you. Whoever rules the sea gets their troops across – whoever loses it watches their transports go down. Every cruiser counts, and a single submarine off the harbour can cost a whole landing. A game on a knife edge.')],
  ['beispiel-3-festland-front', tt('Festland, Front', 'Mainland, front line'), tt('Runde 90 · 22 : 17 Städte', 'Turn 90 · 22 : 17 cities'),
    tt('Kein Meer trennt euch: Die Front zieht sich quer durchs Land, über Flüsse, Brücken und Landengen. Du hast mehr Städte, aber an jeder Brücke kommt nur eine Einheit nach der anderen hinüber. Brichst du mit Masse durch – oder umgehst du die Front über die Binnenmeere und landest in seinem Rücken?',
      'No sea keeps you apart: the front runs right across the land, over rivers, bridges and narrow necks. You hold more cities, but at every bridge only one unit after another gets across. Do you break through by sheer numbers – or go round the front across the inland seas and land in the enemy’s rear?')],
  ['beispiel-4-drei-gegner', tt('Drei Gegner', 'Three opponents'), tt('Runde 90 · Gemischt · jeder gegen jeden', 'Turn 90 · Mixed · free-for-all'),
    tt('Rot, Gelb und Violett – und alle wollen dasselbe wie du. Noch bekämpfen sie sich auch gegenseitig. Stürzt du dich auf den Schwächsten, oder wartest du ab, bis sich zwei von ihnen aufgerieben haben? Wer hier zu früh zu groß wird, hat schnell drei Fronten.',
      'Red, Yellow and Purple – and they all want the same as you. For now they are also fighting each other. Do you pounce on the weakest, or wait until two of them have worn each other down? Grow too big too early here and you soon have three fronts.')],
  ['beispiel-5-kurz-vor-dem-sieg', tt('Kurz vor dem Sieg', 'Close to victory'), tt('Runde 179 · kleine Karte · 27 : 4 Städte', 'Turn 179 · small map · 27 : 4 cities'),
    tt('27 Städte gegen 4: Der Krieg ist gewonnen, aber noch nicht vorbei. Der Gegner hält sich auf seinen letzten Inseln. Zeit für das Finale – Truppen sammeln, übersetzen, die letzte Stadt nehmen. Genau das Richtige, wenn du einmal einen Sieg auskosten willst.',
      '27 cities against 4: the war is won, but not over. The enemy is holding out on its last islands. Time for the finale – gather your troops, cross over, take the last city. Just the thing if you want to savour a victory for once.')],
  ['beispiel-6-schwere-lage', tt('Schwere Lage', 'A tough spot'), tt('Runde 60 · Stufe Schwer · 9 : 15 Städte', 'Turn 60 · Hard · 9 : 15 cities'),
    tt('Neun Städte gegen fünfzehn, und der Gegner kennt jede Insel der Karte. Er spielt umsichtig und macht keine Fehler. Aufgeben würde dir niemand übel nehmen – aber noch ist nichts verloren. Schaffst du die Wende? Für alle, die es wissen wollen.',
      'Nine cities against fifteen, and the enemy knows every island on the map. It plays carefully and makes no mistakes. Nobody would blame you for giving up – but nothing is lost yet. Can you turn it around? For those who want to find out.')],
  ['beispiel-7-sieg-gegen-drei', tt('Sieg gegen drei', 'Victory over three'), tt('Runde 209 · gewonnen · zum Zuschauen', 'Turn 209 · won · just watch'),
    tt('209 Runden, drei Gegner, ein Sieger. Diese Partie ist schon entschieden: Lehn dich zurück und sieh im Zeitraffer zu, wie aus einer einzelnen Stadt ein Reich wird und Rot, Gelb und Violett von der Karte verschwinden. Hier gibt es nichts zu tun – nur zu staunen.',
      '209 turns, three opponents, one winner. This game is already decided: lean back and watch the timelapse as a single city grows into an empire and Red, Yellow and Purple vanish from the map. Nothing to do here – just to marvel.')],
];
const EXAMPLE_ONLINE = /^https?:$/.test(location.protocol);
function renderExamples() {
  const rows = EXAMPLES.map(([f, title, facts, story]) => `<details class="about-d ex-d"><summary><b>${title}</b><span class="about-g">${facts}</span></summary><p>${story}</p>`
    + (EXAMPLE_ONLINE ? `<p><button class="primary" data-example="${f}">${tt('Diese Partie laden', 'Load this game')}</button></p>` : '') + '</details>').join('');
  $('helpExamples').innerHTML = rows + (EXAMPLE_ONLINE ? ''
    : `<p class="ex-off muted">${tt('In der Offline-Fassung lassen sie sich hier nicht laden – sie liegen im Internet:', 'In the offline copy they cannot be loaded from here – they are on the internet:')}
      <a href="https://github.com/masa3418/archipel/tree/main/docs/spielstaende" target="_blank" rel="noopener">${tt('Beispiele auf GitHub', 'examples on GitHub')}</a> <span class="ext">online ↗</span>
      ${tt('Dort eine Datei öffnen, „Download raw file“ wählen und unter ☰ Menü → Spielstände → Aus Datei laden öffnen.', 'Open a file there, choose “Download raw file” and open it via ☰ Menu → Saved games → Load from file.')}</p>`);
}
renderExamples();
$('helpExamples').addEventListener('click', async e => {
  const b = e.target.closest('[data-example]');
  if (!b) return;
  const ex = EXAMPLES.find(x => x[0] === b.dataset.example);
  if (!ex) return;
  if (S && !S.over && !confirm(tt(`Beispiel „${ex[1]}“ laden? Deine laufende Partie (Runde ${S.turn}) wird dabei ersetzt – speichere sie vorher unter ☰ Menü → Spielstände, wenn du sie behalten willst.`,
    `Load the example “${ex[1]}”? Your current game (turn ${S.turn}) will be replaced – save it first under ☰ Menu → Saved games if you want to keep it.`))) return;
  b.disabled = true;   // kein zweiter Klick, solange die Datei kommt
  try {
    const r = await fetch(`docs/spielstaende/${ex[0]}.json`);
    if (!r.ok) throw new Error(String(r.status));
    const text = await r.text();
    const backup = S;
    try { deserialize(text); } catch (err) { S = backup; buildCityGrid(); throw err; }
    afterSlotLoad(tt(`Beispiel geladen: ${ex[1]}`, `Example loaded: ${ex[1]}`));
  } catch (err) { toast(tt('Beispiel konnte nicht geladen werden – dafür ist eine Internetverbindung nötig.', 'The example could not be loaded – this needs an internet connection.')); Sfx.play('error'); }
  finally { b.disabled = false; }
});

$('mSound').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.loop) { Sfx.preview(Sfx.previewing() === b.dataset.loop ? null : b.dataset.loop); renderSoundTest(); }
  else if (b.dataset.move) Sfx.previewMove(b.dataset.move);
  else if (b.dataset.fx) Sfx.play(b.dataset.fx);
});
$('mSound').addEventListener('input', e => {
  const k = e.target.dataset.level;
  if (!k) return;
  Sfx.setLevel(k, e.target.value / 100);
  e.target.nextElementSibling.textContent = e.target.value + ' %';
});
$('bZoomIn').onclick = () => setZoom(TS + 4);
$('bZoomOut').onclick = () => setZoom(TS - 4);
$('bFocus').onclick = actFocus;
