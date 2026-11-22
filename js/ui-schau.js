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
  const pv = Sfx.previewing(), cur = gfxSet(), kinds = Sfx.kinds();
  // nach Grafik-Sets gruppiert (Wunsch des Nutzers: Klänge der Sets nebeneinander anhören), das Set der Karte ist markiert
  $('sndRows').innerHTML = SET_KEYS.map(set => `<tr class="snd-set"><th colspan="3">${esc(SET_NAMES[set])}${set === cur ? ` <span class="muted">· ${tt('aktuelles Set', 'current set')}</span>` : ''}</th></tr>`
    + kinds.filter(k => k.set === set).map(k => `<tr>
    <td>${k.name}</td>
    <td><button data-loop="${k.kind}" class="${pv === k.kind ? 'on' : ''}">${pv === k.kind ? tt('■ Stopp', '■ Stop') : tt('▶ Schleife', '▶ Loop')}</button>
        <button data-move="${k.kind}">${tt('▶ Zug', '▶ Move')}</button></td>
    <td><input type="range" min="0" max="200" value="${Math.round(k.level * 100)}" data-level="${k.kind}"> <span class="muted">${Math.round(k.level * 100)} %</span></td>
  </tr>`).join('')).join('');
  $('sndFx').innerHTML = Sfx.effects().filter(n => FX_NAMES[n]).map(n => `<button data-fx="${n}">▶ ${FX_NAMES[n]}</button>`).join('');
}
function openSoundTest() { Sfx.unlock(); renderSoundTest(); openModal('mSound'); }
$('bSndTest').onclick = () => { closeModals(); openSoundTest(); };   // aus dem Fenster „Einstellungen“

// ------------------------------------------------------------------ Grafik-Übersicht
// Wie der Klangtest, nur für die Bilder (☰ Menü → Hilfe → Grafiken; Fenster „Aussehen der Karte“): Abzeichen in allen Farben samt Zeichen, Städte,
// Gelände, Markierungen und Animationen. Gezeichnet wird mit denselben Funktionen wie auf der Karte (drawToken, drawEffect,
// drawRoute, drawSupportMark …): drawOn leitet ctx und TS kurz auf eine kleine Leinwand um, buildTerrain und drawFog bekommen ein
// Kartenstück (gfxMap). Ändert sich eine Grafik im Spiel, ändert sie sich hier mit. SVG-Code gibt es für die Einheitensymbole
// (ICON_SRC → unitSvg) und die SVG-Symbole der Oberfläche; Städte, Gelände und Effekte entstehen aus Zeichenbefehlen.
function drawOn(g, ts, fn) {
  const c0 = ctx, t0 = TS;
  ctx = g; TS = ts;
  try { fn(); } finally { ctx = c0; TS = t0; }
}
const gfx = { tab: 'units', owner: 0, set: 'insel', svg: null, badge: true, raf: 0, live: [], scenes: [], appSvg: null };
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

// Was die Bilder der Grafik-Sets zeigen (Wunsch des Nutzers: nicht jedes Bild erklärt sich selbst – warum ein Heißluftballon, warum ein
// Piratenschiff). SET_PIC: Name des Bilds je Einheit; SET_WHY: kurzer Grund für die weniger offensichtlichen. Regeln und Namen bleiben gleich,
// Zahlen kommen aus UT. Angezeigt im Reiter „Einheiten“ der Grafik-Übersicht.
const SET_PIC = {
  weltraum: { inf: tt('Raumsoldat', 'Space trooper'), tank: tt('Rover', 'Rover'), ftr: tt('Raumjäger', 'Space fighter'), trn: tt('Frachter', 'Freighter'),
    dst: tt('Korvette', 'Corvette'), sub: tt('Tarnkappenschiff', 'Stealth ship'), crs: tt('Kreuzer', 'Cruiser'), car: tt('Mutterschiff', 'Mothership'), bat: tt('Schlachtschiff', 'Battleship') },
  segel: { inf: tt('Musketier', 'Musketeer'), tank: tt('Kavallerie', 'Cavalry'), ftr: tt('Heißluftballon', 'Hot-air balloon'), trn: tt('Handelsschiff', 'Merchant ship'),
    dst: tt('Schaluppe', 'Sloop'), sub: tt('Piratenschiff', 'Pirate ship'), crs: tt('Fregatte', 'Frigate'), car: tt('Ballonschiff', 'Balloon ship'), bat: tt('Linienschiff', 'Ship of the line') },
};
function setWhy(set) {
  const U = UT;
  return {
    weltraum: [
      ['sub', tt('Im All kann nichts abtauchen – an die Stelle des Tauchens tritt die Tarnung. Das flache, kantige Schiff mit den Facetten entzieht sich der Ortung; wie das U-Boot sieht man es erst aus nächster Nähe oder wenn es angreift.',
        'Nothing can dive in space – cloaking takes the place of diving. The flat, faceted ship evades detection; like the submarine it is only seen up close or when it attacks.')],
      ['tank', tt(`Auf Asteroiden fährt kein Kettenpanzer: Der Rover mit Geschützkuppel auf sechs Rädern ist das schwere Bodenfahrzeug und zieht wie der Panzer ${U.tank.move} Felder.`,
        `No tracked tank drives on asteroids: the six-wheeled rover with its gun turret is the heavy ground vehicle and moves ${U.tank.move} tiles like the tank.`)],
      ['dst', tt('Die schlanke Korvette jagt die Tarnschiffe – so wie der Zerstörer die U-Boote.', 'The slim corvette hunts the stealth ships – just as the destroyer hunts submarines.')],
      ['car', tt('Aus der Hangaröffnung am Bug starten die Raumjäger – das Mutterschiff trägt sie wie der Träger seine Flugzeuge.', 'The space fighters launch from the hangar opening at the bow – the mothership carries them as the carrier carries its aircraft.')],
    ],
    segel: [
      ['ftr', tt(`Das einzige Fluggerät der Segelzeit: Ballone stiegen ab 1783 auf und dienten bald zur Aufklärung, etwa 1794 in der Schlacht bei Fleurus. Schnell waren sie nicht – im Spiel gelten aber die Regeln des Jägers: ${U.ftr.move} Felder je Zug, Treibstoff für ${U.ftr.fuel} Felder (beim Ballon der Brennstoff für den Brenner).`,
        `The only flying craft of the age of sail: balloons rose from 1783 and soon served for reconnaissance, for example at the battle of Fleurus in 1794. They were not fast – but in the game the fighter's rules apply: ${U.ftr.move} tiles per turn, fuel for ${U.ftr.fuel} tiles (for the balloon, fuel for its burner).`)],
      ['sub', tt('U-Boote gab es in der Segelzeit nur als Versuch (die „Turtle“ von 1776). Ungesehen lauern und Handels- wie Kriegsschiffe überfallen – diese Rolle übernimmt deshalb der Pirat. Zu erkennen an den schrägen Lateinersegeln, wie sie die Korsaren im Mittelmeer fuhren, und an der schwarzen Flagge mit Totenkopf.',
        'Submarines existed in the age of sail only as an experiment (the “Turtle” of 1776). Lurking unseen and raiding merchant and warships – that role therefore goes to the pirate. Recognisable by the slanted lateen sails used by the Mediterranean corsairs and by the black flag with the skull.')],
      ['car', tt('Es trägt die Ballone wie der Träger seine Flugzeuge. Das gab es wirklich: 1849 ließ die österreichische Marine vor Venedig Ballone von einem Schiff aufsteigen, 1861 die Unionsarmee im Amerikanischen Bürgerkrieg von einem umgebauten Kahn.',
        'It carries the balloons as the carrier carries its aircraft. This really existed: in 1849 the Austrian navy launched balloons from a ship off Venice, and in 1861 the Union army did so from a converted barge in the American Civil War.')],
      ['tank', tt(`Vor den Panzern war die Reiterei die schnelle, schlagkräftige Truppe zu Land – die Kavallerie zieht wie der Panzer ${U.tank.move} Felder.`,
        `Before tanks, cavalry was the fast, hard-hitting force on land – it moves ${U.tank.move} tiles like the tank.`)],
      ['dst', tt('Ein kleines, schnelles Kriegsschiff mit einem Mast – die Schaluppe jagt die Piraten, so wie der Zerstörer die U-Boote.', 'A small, fast warship with a single mast – the sloop hunts the pirates, just as the destroyer hunts submarines.')],
    ],
  }[set] || [];
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
    const c = gfxCanvas(1, 1, 80), spr = unitSprite(k, gfx.owner, Math.round(c.ts * 0.8), gfx.set);
    c.getContext('2d').drawImage(spr, (c.width - spr.width) / 2, (c.height - spr.height) / 2);
    const on = gfx.svg && gfx.svg.kind === 'unit' && gfx.svg.type === k;
    const pic = (SET_PIC[gfx.set] || {})[k];   // in Weltraum und Segelzeit: was das Bild zeigt
    grid.append(gfxCard(c, UT[k].name, (pic ? tt('Bild: ', 'Picture: ') + pic + ' · ' : '') + UNIT_ROLE[k], gfxButton(tt('SVG-Code', 'SVG code'), { gsvg: k }, on)));
  }
  if (gfx.svg && gfx.svg.kind === 'unit') body.append(gfxSvgPanel());
  const why = setWhy(gfx.set);
  if (why.length) {   // Warum diese Bilder: die weniger offensichtlichen erklärt
    body.append(gfxEl('h3', null, tt('Warum diese Bilder?', 'Why these pictures?')),
      gfxEl('p', null, tt('Regeln und Namen sind in jedem Set gleich; die Bilder suchen für jede Rolle etwas Passendes aus der Welt des Sets. Wo das nicht auf den ersten Blick einleuchtet:',
        'Rules and names are the same in every set; the pictures find something fitting for each role from the world of the set. Where that is not obvious at first glance:')));
    const ul = gfxEl('ul', 'gfx-why');
    for (const [k, text] of why) {
      const li = gfxEl('li'), img = gfxEl('img'); img.src = lookIcon(gfx.set, k); img.alt = '';
      li.append(img, gfxEl('b', null, `${UT[k].name} → ${SET_PIC[gfx.set][k]}: `), text);
      ul.append(li);
    }
    body.append(ul);
  }

  const st = gfxSection(body, tt('Zeichen an der Marke', 'Marks on the badge'),
    tt('So zeigt die Karte, was mit einer Einheit los ist. Die Zahl steht nur an eigenen Einheiten – wie viel der Gegner an Bord hat, bleibt verborgen; in seinen Städten sogar, welche Einheit dort steht.',
      'How the map shows what is going on with a unit. The number only appears on your own units – how much the enemy has on board stays hidden; in his cities even which unit is there.'), 124);
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
  st.append(gfxCard(gfxPic(CITY, 58, () => drawGarrison(1, TS + TS * 0.36, TS + TS * 0.36, TS * 0.66), { crop: [1, 1, 1, 1], cities: [1] }),
    tt('Feindliche Stadt besetzt', 'Enemy city garrisoned'), tt('welche Einheit sie verteidigt, zeigt sich erst im Kampf', 'which unit defends it only shows in battle')));

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
    return { title: name, file: `archipel-${gfx.set === 'insel' ? '' : gfx.set + '-'}${s.type}${gfx.badge ? '-' + (EN ? ['blue', 'red', 'yellow', 'purple'] : ['blau', 'rot', 'gelb', 'violett'])[gfx.owner] : ''}.svg`,
      code: unitSvg(s.type, gfx.owner, gfx.badge, `Archipel – ${name}${gfx.badge ? ' (' + PLAYERS[gfx.owner].name + ')' : ''}`, gfx.set) };
  }
  if (s.id === 'focus') return { title: tt('Zentrieren', 'Centre'), file: 'archipel-zentrieren.svg', code: gfxFocusSvg() };
  gfxLoadAppSvg();
  return { title: tt('App-Symbol', 'App icon'), file: 'favicon.svg', code: gfx.appSvg || '',
    note: gfx.appSvg === false ? tt('Der Code lässt sich hier nicht lesen (Spiel aus einzelnen Dateien ohne Server gestartet) – es ist die Datei favicon.svg neben index.html.',
      'The code cannot be read here (game started from separate files without a server) – it is the file favicon.svg next to index.html.') : !gfx.appSvg ? tt('Lädt …', 'Loading …') : '' };
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
  const sp = !!landscape().space;   // Weltraum-Set: Raumstationen und Asteroiden – die Texte beschreiben, was zu sehen ist
  const sail = gfxSet() === 'segel';
  const cg = gfxSection(body, tt('Städte', 'Cities'), sp
    ? tt('Raumstationen: Sockel der Glaskuppeln und Fahne in der Farbe des Besitzers; zwei Anordnungen wechseln sich ab.', 'Space stations: dome bases and flag in the owner\'s colour; two layouts alternate.')
    : sail ? tt('Festungsstädte: Mauer mit Tor und Zinnen, Turm und Häuser; Dächer und Fahne in der Farbe des Besitzers, zwei Anordnungen wechseln sich ab.', 'Fortified towns: wall with gate and battlements, tower and houses; roofs and flag in the owner\'s colour, two layouts alternate.')
    : tt('Dächer und Fahne in der Farbe des Besitzers; zwei Anordnungen der Häuser wechseln sich ab.', 'Roofs and flag in the owner\'s colour; two layouts of the houses alternate.'));
  [[-1, tt('Neutral', 'Neutral')], ...PLAYERS.map((p, k) => [k, p.name])].forEach(([ow, name]) =>
    cg.append(gfxCard(gfxPic(['....', '.CC.', '....'], 56, null, { crop: [1, 1, 2, 1], cities: [ow, ow] }), name)));

  const tg = gfxSection(body, tt('Gelände', 'Terrain'), sail ? tt('Wie auf einer alten, von Hand kolorierten Karte: Wellen und Küsten in Tinte, Wald, Hügel und Berge umrandet. Alles folgt der Höhe und ist nur Bild – die Regeln sind dieselben.',
    'Like an old hand-coloured map: waves and coasts in ink, forest, hills and mountains outlined. Everything follows the height and is only a picture – the rules are the same.') : sp ? tt('Asteroiden im All: Licht von links oben, um die Felsen schimmert Staub, dazwischen Sterne und Nebelschleier. Krater, Hügel, Felsbrocken und Eiskristalle folgen der Höhe – sie sind nur Bild und ändern nichts an den Regeln.',
    'Asteroids in space: light from the top left, dust shimmering around the rocks, stars and nebulae in between. Craters, hills, boulders and ice crystals follow the height – they are only pictures and do not change the rules.') : tt('Das Wasser wird dunkler, je weiter das Land entfernt ist; an der Küste schimmert Flachwasser. Wald, Hügel und Berge folgen der Höhe – sie sind nur Bild und ändern nichts an den Regeln.',
    'The water gets darker the further away land is; shallow water shimmers along the coast. Forest, hills and mountains follow the height – they are only pictures and do not change the rules.'));
  const pano = gfxPic(['~~~~~..ffhhmmMM', '~~~~...ffhhmmMM', '~~~~~..ffhhmmMM', '~~~~~~.ffhhmmMM', '~~~~~..ffhhmmMM'], 40);
  const wrapP = gfxEl('div', 'gfx-card');
  const leg = gfxEl('div', 'gfx-legend');
  const cols = sp ? [[4, tt('All', 'Space')], [3, tt('Ufer und Ebene', 'Shore and plain')], [2, tt('Krater', 'Craters')], [2, tt('Hügel', 'Hills')], [2, tt('Felsbrocken', 'Boulders')], [2, tt('Eiskristalle', 'Ice crystals')]]
    : [[4, tt('Meer', 'Sea')], [3, tt('Küste und Wiese', 'Coast and meadow')], [2, tt('Wald', 'Forest')], [2, tt('Hügel', 'Hills')], [2, tt('Berge', 'Mountains')], [2, tt('Gipfel', 'Peaks')]];
  leg.style.gridTemplateColumns = cols.map(([n]) => n * 40 + 'px').join(' ');
  for (const [, t] of cols) leg.append(gfxEl('span', null, t));
  wrapP.append(pano, leg);
  tg.append(wrapP);
  tg.append(gfxCard(gfxPic(['..~~~', '..~~~', '~~...'], 40), sp ? tt('Röhre über Eck', 'Corner tube') : tt('Steg über Eck', 'Corner bridge'),
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

  const bd = gfxSection(body, tt('Kartenrand', 'Around the map'), tt('Was außerhalb der Karte liegt, wenn man an ihren Rand scrollt – wählbar unter „Ansicht“ → „Landschaft und Kartenrand“. Windrose und Seeungeheuer gehören zur alten Seekarte, im Weltall funkeln einige Sterne.',
    'What lies outside the map when you scroll to its edge – selectable under “View” → “Landscape and map border”. Compass rose and sea serpent belong to the old sea chart; in outer space some stars twinkle.'));
  for (const k of BORDER_KEYS) {
    const d = gfxEl('div'); borderVars(d, k); d.append(gfxEl('div', 'gfx-pad-map'));
    bd.append(gfxCard(d, BORDER_NAMES[k], k === curBorder() ? tt('eingestellt', 'selected') : ''));
  }
  for (const [src, t] of [[compassImg(), tt('Windrose', 'Compass rose')], [serpentImg(), tt('Seeungeheuer', 'Sea serpent')]]) {
    const d = gfxEl('div'); borderVars(d, 'seekarte');
    const i = document.createElement('img'); i.src = src; i.alt = ''; i.className = 'gfx-pad-deco'; d.append(i);
    bd.append(gfxCard(d, t, tt('Alte Seekarte', 'Old sea chart')));
  }
}

// Reiter „Markierungen“
function gfxMarks(body) {
  const P0 = PLAYERS[0].light, pct = v => Math.round(v * 100) + ' %';
  const sel = gfxSection(body, tt('Gewählte Einheit', 'Selected unit'));
  sel.append(gfxCard(gfxPic(['...', '...', '...'], 40, now => { drawToken(gu('tank'), TS, TS, TS); drawSelRing(1, 1, gfxPulse(now), now); }, { live: true }),
    tt('Auswahl', 'Selection'), tt('pulsierender Ring, alle paar Sekunden eine Welle', 'pulsing ring, a wave every few seconds')));
  sel.append(gfxCard(gfxPic(['.....', '.....', '.....', '.....', '.....'], 24, now => {
    drawToken(gu('tank'), 2 * TS, 2 * TS, TS); drawSelRing(2, 2, gfxPulse(now));
    drawSelPing(2, 2, (now % 1800) / PING_MS, TS * 2.4);
  }, { live: true }), tt('Suchring', 'Locator ring'), tt('wenn das Spiel zur nächsten Einheit wechselt', 'when the game moves on to the next unit')));
  sel.append(gfxCard(gfxPic(['...', '..~', '..~'], 40, now => {
    drawToken(gu('inf', 1), 0, 0, TS); drawToken(gu('trn'), 2 * TS, TS, TS);
    for (const [x, y, k] of [[0, 0, 'attack'], [1, 0, 'move'], [2, 0, 'move'], [0, 1, 'move'], [2, 1, 'board'], [0, 2, 'move'], [1, 2, 'move']]) drawHint(x, y, k);
    drawToken(gu('tank'), TS, TS, TS); drawSelRing(1, 1, gfxPulse(now), now);
  }, { live: true }), tt('Zugmarker', 'Move markers'), tt('Punkt: frei · gold: an Bord gehen · Fadenkreuz: angreifen', 'dot: free · gold: go aboard · crosshair: attack')));
  sel.append(gfxCard(gfxPic(['....', '..f.', '....'], 40, now => {
    drawGotoPath(0, 2, [[1, 1], [2, 1], [3, 0]], now); drawToken(gu('tank'), 0, 2 * TS, TS, { goto: true }); drawSelRing(0, 2, gfxPulse(now), now);
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
    drawToken(gu('trn'), 0, TS, TS, { badge: 3 }); drawSelRing(0, 1, gfxPulse(now), now); drawAssaultChance(1, 1, CAPTURE_BASE + SUPPORT_CAPTURE, gfxPulse(now));
  }, { live: true, cities: [1] }), tt('Sturm vom Schiff', 'Assault from the ship'), tt('Chance, die Stadt mit den Truppen an Bord zu nehmen', 'chance to take the city with the troops on board')));
  mouse.append(gfxCard(gfxPic(['~~..', '~C..', '~~..'], 40, now => {
    drawToken(gu('trn'), 0, TS, TS, { badge: 3 }); drawGarrison(1, TS + TS * 0.36, TS + TS * 0.36, TS * 0.66);
    drawSelRing(0, 1, gfxPulse(now), now); drawAssaultChance(1, 1, null, gfxPulse(now));
  }, { live: true, cities: [1] }), tt('Sturm auf besetzte Stadt', 'Assault on a garrisoned city'), tt('wer verteidigt, ist unbekannt: „?“ statt einer Chance', 'the defender is unknown: “?” instead of a chance')));

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
  withLandscape(SET_LAND[gfx.set], () => {   // laufende Bilder ebenfalls mit dem gewählten Set (auch die Klänge der Animationen)
    for (const f of gfx.live) f(now);
    for (const sc of gfx.scenes) if (!sc.done) sc.frame(now);
  });
  gfx.raf = requestAnimationFrame(gfxLoop);
}
function renderGfx() {
  const body = $('gfxBody'), keep = body.dataset.tab === gfx.tab ? body.scrollTop : 0;
  gfx.live = []; gfx.scenes = [];
  for (const b of $('gfxTabs').querySelectorAll('button')) b.classList.toggle('on', b.dataset.gtab === gfx.tab);
  body.textContent = '';
  body.dataset.tab = gfx.tab;
  // Grafik-Set oben im Fenster (Wunsch des Nutzers): gilt für alle Reiter – Einheiten, Städte und Gelände, Markierungen, Animationen. Gezeichnet wird
  // mit der gemischten Landschaft des Sets (withLandscape in gfx.js), die Partie bleibt unverändert. Beim Öffnen das Set der Partie.
  $('gfxSets').innerHTML = `<span class="muted">${tt('Grafik-Set:', 'Graphics set:')}</span>` + SET_KEYS.map(k =>
    `<button data-gset="${k}" class="${k === gfx.set ? 'on' : ''}"><i style="background:${landSwatch(SET_LAND[k])}"></i>${esc(SET_NAMES[k])}</button>`).join('');
  withLandscape(SET_LAND[gfx.set], () => ({ units: gfxUnits, land: gfxLand, marks: gfxMarks, anim: gfxAnims })[gfx.tab](body));
  body.scrollTop = keep;
  if (!gfx.raf) gfx.raf = requestAnimationFrame(gfxLoop);
}
function openGfx() { Sfx.unlock(); gfx.svg = null; gfx.set = gfxSet(); renderGfx(); openModal('mGfx'); }
// Aufruf (Wunsch des Nutzers: keine Einstellung, sondern Bildlegende – deshalb unter Hilfe statt in den Einstellungen): ☰ Menü → Hilfe → Grafiken und
// aus dem Fenster „Aussehen der Karte“ (dort mit dem Reiter Einheiten – man will sehen, wie das gewählte Set aussieht)
$('bGfxMenu').onclick = () => { closeMenu(); closeModals(); openGfx(); };
$('bLookGfx').onclick = () => { closeModals(); gfx.tab = 'units'; openGfx(); };
// Landschaft der laufenden Partie (S.land, LANDSCAPES in gfx.js): nur die Farben der Karte. Wird mit der Partie gespeichert.
const LAND_NAMES = { gruen: tt('Grüne Inseln', 'Green islands'), wueste: tt('Wüste', 'Desert'), schnee: tt('Schnee', 'Snow'), lava: tt('Lava', 'Lava'), alien: tt('Fremder Planet', 'Alien planet'), zonen: tt('Klimazonen', 'Climate zones'),
  asteroiden: tt('Asteroiden', 'Asteroids'), eis: tt('Eis-Asteroiden', 'Ice asteroids'), eisen: tt('Eisen-Asteroiden', 'Iron asteroids'),
  kristall: tt('Kristall-Asteroiden', 'Crystal asteroids'), guertel: tt('Asteroidengürtel', 'Asteroid belt'), altkarte: tt('Alte Karte', 'Old map'),
  altwueste: tt('Alte Karte · Wüste', 'Old map · desert'), altpolar: tt('Alte Karte · Eismeer', 'Old map · polar sea'), alttropen: tt('Alte Karte · Tropen', 'Old map · tropics'),
  altzonen: tt('Alte Karte · Klimazonen', 'Old map · climate zones') };
// Grafik-Sets (Wunsch des Nutzers: zu viele Möglichkeiten – man wählt vor allem eines der drei Sets): Ein Set bringt seine gemischte Landschaft
// (SET_LAND: Klimazonen, Asteroidengürtel, alte Karte mit Klimazonen) und seinen Kartenrand (BORDER_DEFAULT) mit – chooseSet. Einzelne Landschaften
// und andere Ränder stehen im Fenster „Aussehen der Karte“ (#mLook, openLook); unter „Ansicht“ und in den Einstellungen nur noch die drei Sets.
const SET_KEYS = ['insel', 'weltraum', 'segel'];
const SET_NAMES = { insel: tt('Inselwelt', 'Island world'), weltraum: tt('Weltraum', 'Space'), segel: tt('Segelzeit', 'Age of sail') };
const SET_DESC = {
  insel: tt('Schiffe, Panzer und Flugzeuge auf Inseln mit Klimazonen', 'Ships, tanks and aircraft on islands with climate zones'),
  weltraum: tt('Raumschiffe und Raumstationen im Asteroidengürtel', 'Spaceships and space stations in the asteroid belt'),
  segel: tt('Segelschiffe, Kavallerie und Festungen auf einer alten Karte', 'Sailing ships, cavalry and forts on an old map'),
};
const SET_LAND = { insel: 'zonen', weltraum: 'guertel', segel: 'altzonen' };
const landsOf = set => Object.keys(LANDSCAPES).filter(k => (LANDSCAPES[k].set || 'insel') === set);
// Farbfeld einer Landschaft (Liste „Ansicht“, Fenster „Aussehen der Karte“): Land und Meer der Übersichtskarte, gemischte als Streifen
function landSwatch(k) {
  const L = LANDSCAPES[k], m = L.mini, rgb = c => `rgb(${c.join()})`;
  return L.belt ? 'linear-gradient(90deg, #ffd59a 0 10%, #96624a 10% 37%, #8c8680 37% 64%, #c6d6e4 64% 90%, #79ffd4 90%)'   // Sonne, Eisen, Gestein, Eis, Kristall
    : L.zones && L.zoneKeys ? (([a, b, c]) => `linear-gradient(180deg, ${c} 0 22%, ${a} 22% 40%, ${b} 40% 60%, ${a} 60% 78%, ${c} 78%)`)(L.zoneKeys.map(z => rgb(LANDSCAPES[z].mini[0])))   // Zonen aus den Farbsätzen
    : L.zones ? 'linear-gradient(180deg, #eef3f8 0 22%, #6ea84e 22% 40%, #e2c27e 40% 60%, #6ea84e 60% 78%, #eef3f8 78%)'
    : (L.space ? 'radial-gradient(1px 1px at 15px 4px, #fff, transparent), radial-gradient(1px 1px at 19px 10px, #fff, transparent), ' : '') + `linear-gradient(135deg, ${rgb(m[0])} 0 55%, ${rgb(m[1])} 55%)`;
}
// Die Landschaft ist EINE Einstellung (Wunsch des Nutzers – eine für die laufende und eine für neue Partien war umständlich): Umschalten über
// „Ansicht“ oder die Einstellungen gilt sofort für die laufende Partie und bleibt für alle neuen eingestellt (archipel-landscape, Vorgabe
// DEFAULT_LAND). Gespeicherte Partien zeigen beim Laden die Landschaft, mit der sie gespeichert wurden (S.land) – das ändert die Einstellung nicht.
let landPref = DEFAULT_LAND;
try { const v = localStorage.getItem('archipel-landscape'); if (LAND_KEYS.includes(v)) landPref = v; } catch (e) {}
function setLandscape(v) {
  if (!LANDSCAPES[v]) v = DEFAULT_LAND;
  landPref = v;
  try { localStorage.setItem('archipel-landscape', v); } catch (e) {}
  if (S) { S.land = v; buildTerrainCache(); refresh(); }   // buildTerrainCache → applyBorder: wechselt das Set, wechselt der Rand mit
  else applyBorder();
  if (!$('mLook').hidden) renderLook();
}
// Set wählen: seine gemischte Landschaft und sein Kartenrand (auch wenn vorher im Fenster etwas anderes gewählt war – das Set ist die Vorgabe)
function chooseSet(set) {
  if (!SET_LAND[set]) return;
  setLandscape(SET_LAND[set]); setBorder(BORDER_DEFAULT[set]);
}
$('setSel').innerHTML = SET_KEYS.map(k => `<option value="${k}">${esc(SET_NAMES[k])}</option>`).join('');
try { localStorage.removeItem('archipel-land'); } catch (e) {}   // kurze Zwischenfassung: Landschaft als Einstellung
$('setSel').onchange = e => chooseSet(e.target.value);

// ------------------------------------------------------------------ Kartenrand
// Was außerhalb der Karte liegt (#mapPad, der Rand um die Leinwand – siehe pad in ui-karte.js). Gimmick wie die Landschaften (Wunsch des Nutzers):
// Schlicht (Streifen wie bisher), Offenes Meer (tiefes Wasser der gewählten Landschaft, nach außen dunkler – das Meer geht über den Kartenrand weiter),
// Alte Seekarte (Pergament mit Gitter, Windrose, Seeungeheuer), Holztisch (die Karte liegt wie ein Spielbrett darauf, mit Schatten), Weltall (Sterne
// und Nebel, einige funkeln). Nur Aussehen; eine Einstellung für alle Partien (archipel-border, Vorgabe meer), wählbar unter „Ansicht“ und in den
// Einstellungen → Anzeige. Alles im Code erzeugt (Verläufe in index.html, kleine Leinwände als Bild) – keine Bilddateien. Der Schmuck (Windrose,
// Ungeheuer, Schriftzug, funkelnde Sterne) liegt in #padDeco und wird in placeBorderDeco neben die Karte gelegt (aus applyPad und applyBorder).
const BORDER_KEYS = ['schlicht', 'meer', 'seekarte', 'holz', 'weltall'];
const BORDER_NAMES = { schlicht: tt('Schlicht', 'Plain'), meer: tt('Offenes Meer', 'Open sea'), seekarte: tt('Alte Seekarte', 'Old sea chart'), holz: tt('Holztisch', 'Wooden table'), weltall: tt('Weltall', 'Outer space') };
const BORDER_SW = {   // Farbfeld in der Liste „Ansicht“
  schlicht: 'repeating-linear-gradient(135deg, #2a3442 0 4px, #161c26 4px 8px)', meer: 'linear-gradient(180deg, #1d5a86, #0a2238)',
  seekarte: 'linear-gradient(135deg, #e2d0a6, #c4ad7e)', holz: 'repeating-linear-gradient(90deg, #6a4428 0 7px, #4a2e18 7px 8px)',
  weltall: 'radial-gradient(1px 1px at 6px 5px, #fff, transparent), radial-gradient(1px 1px at 18px 11px, #fff, transparent), linear-gradient(135deg, #1a1440, #04050b)',
};
// Der Rand wird je Grafik-Set gemerkt (Set = Einheitenbilder + Landschaft + Rand, Wunsch des Nutzers): Inselwelt in archipel-border (Vorgabe
// Offenes Meer), Weltraum in archipel-border-weltraum (Vorgabe Weltall). Wechselt die Landschaft das Set, wechselt der Rand mit; frei wählbar bleibt er.
const BORDER_DEFAULT = { insel: 'meer', weltraum: 'weltall', segel: 'seekarte' };
const borderPrefs = Object.assign({}, BORDER_DEFAULT);
const borderStore = set => (set === 'insel' ? 'archipel-border' : 'archipel-border-' + set);
try { for (const set in borderPrefs) { const v = localStorage.getItem(borderStore(set)); if (BORDER_KEYS.includes(v)) borderPrefs[set] = v; } } catch (e) {}
function curBorder() { return borderPrefs[gfxSet()] || 'meer'; }
const borderImg = {};   // erzeugte Bilder (data-Adressen), je eins
const INK = 'rgba(92,58,24,0.85)', PAPER = 'rgba(232,214,170,0.95)';
function borderCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c.toDataURL(); }
function paperImg() {   // Fasern und Flecken des Pergaments
  return borderImg.paper || (borderImg.paper = borderCanvas(256, 256, (g, w, h) => {
    const r = mulberry32(7);
    for (let k = 0; k < 3200; k++) { g.fillStyle = `rgba(110,75,35,${(0.02 + r() * 0.06).toFixed(3)})`; g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5); }
    g.strokeStyle = 'rgba(110,75,35,0.06)';
    for (let k = 0; k < 70; k++) { const x = r() * w, y = r() * h, a = r() * Math.PI, l = 6 + r() * 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }));
}
function starsImg() {   // Sternenfeld, nahtlos wiederholbar
  return borderImg.stars || (borderImg.stars = borderCanvas(512, 512, (g, w, h) => {
    const r = mulberry32(11), tints = [[255, 255, 255], [200, 215, 255], [255, 238, 205]];
    for (let k = 0; k < 230; k++) {
      const x = r() * w, y = r() * h, big = r() > 0.88, rad = big ? 1.1 + r() * 0.8 : 0.45 + r() * 0.55, t = tints[Math.floor(r() * 3)].join();
      g.fillStyle = `rgba(${t},${(0.35 + r() * 0.65).toFixed(2)})`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
      if (big) { const gr = g.createRadialGradient(x, y, 0, x, y, rad * 4); gr.addColorStop(0, `rgba(${t},0.3)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad * 4, 0, 7); g.fill(); }
    }
  }));
}
function compassImg() {   // Windrose wie auf alten Seekarten
  return borderImg.compass || (borderImg.compass = borderCanvas(240, 240, (g, w, h) => {
    const cx = w / 2, cy = h / 2 + 8, R = 92, T = Math.PI * 2;
    g.strokeStyle = INK; g.lineWidth = 1.6;
    g.beginPath(); g.arc(cx, cy, R, 0, T); g.stroke();
    g.beginPath(); g.arc(cx, cy, R - 7, 0, T); g.stroke();
    for (let k = 0; k < 64; k++) {
      const a = k / 64 * T, r1 = R - 7, r0 = k % 8 === 0 ? R - 17 : k % 2 === 0 ? R - 12 : R - 10;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    }
    g.save(); g.globalAlpha = 0.35;
    for (let k = 0; k < 16; k++) { const a = k / 16 * T; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 17), cy + Math.sin(a) * (R - 17)); g.stroke(); }
    g.restore();
    const point = (a, len, wid) => {   // Spitze: eine Hälfte gefüllt, eine hell
      const tx = cx + Math.cos(a) * len, ty = cy + Math.sin(a) * len;
      for (const [side, fill] of [[-1, INK], [1, PAPER]]) {
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(tx, ty);
        g.lineTo(cx + Math.cos(a + side * Math.PI / 2) * wid, cy + Math.sin(a + side * Math.PI / 2) * wid); g.closePath();
        g.fillStyle = fill; g.fill(); g.stroke();
      }
    };
    for (let k = 0; k < 4; k++) point(Math.PI / 4 + k * Math.PI / 2, R * 0.5, R * 0.09);
    for (let k = 0; k < 4; k++) point(-Math.PI / 2 + k * Math.PI / 2, R * 0.8, R * 0.14);
    g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, 4, 0, T); g.fill();
    g.font = 'bold 22px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.fillText('N', cx, cy - R - 6);
  }));
}
function serpentImg() {   // Seeungeheuer: Buckel über den Wellen, Schwanz links, Kopf rechts
  return borderImg.serpent || (borderImg.serpent = borderCanvas(300, 150, (g, w) => {
    const wl = 110, T = Math.PI * 2;
    g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 1.4;
    for (const [y, off] of [[wl + 2, 0], [wl + 14, 9], [wl + 26, 3]]) {
      g.beginPath(); for (let x = 8 + off; x < w - 12; x += 18) { g.moveTo(x, y); g.quadraticCurveTo(x + 4.5, y - 5, x + 9, y); } g.stroke();
    }
    const humps = [[84, 20], [142, 25], [198, 19]];
    g.lineWidth = 11; for (const [x, r] of humps) { g.beginPath(); g.arc(x, wl, r, Math.PI, 0); g.stroke(); }
    g.lineWidth = 2; g.strokeStyle = PAPER; for (const [x, r] of humps) { g.beginPath(); g.arc(x, wl, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(60, wl); g.bezierCurveTo(48, wl - 30, 24, wl - 24, 28, wl - 9); g.bezierCurveTo(31, wl + 1, 44, wl - 6, 38, wl - 15); g.stroke();
    g.lineWidth = 11; g.beginPath(); g.moveTo(222, wl); g.bezierCurveTo(226, wl - 40, 236, wl - 62, 254, wl - 60); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.ellipse(262, wl - 60, 16, 10, -0.15, 0, T); g.fill();
    g.lineWidth = 3; g.beginPath(); g.moveTo(272, wl - 57); g.lineTo(290, wl - 49); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(287, wl - 51); g.lineTo(297, wl - 55); g.moveTo(287, wl - 51); g.lineTo(297, wl - 47); g.stroke();
    g.fillStyle = PAPER; g.beginPath(); g.arc(264, wl - 63, 3, 0, T); g.fill();
    g.fillStyle = INK;
    for (let k = -2; k <= 2; k++) {   // Rückenkamm auf dem mittleren Buckel
      const a = Math.PI * 1.5 + k * 0.32, x = 142 + Math.cos(a) * 30, y = wl + Math.sin(a) * 30;
      g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.lineTo(x + 3, y + 2); g.fill();
    }
  }));
}
function setBorder(v) {
  const set = gfxSet();
  if (!BORDER_KEYS.includes(v)) v = BORDER_DEFAULT[set] || 'meer';
  borderPrefs[set] = v;
  try { localStorage.setItem(borderStore(set), v); } catch (e) {}
  applyBorder();
}
function borderVars(el, k) {   // Farben und erzeugte Bilder eines Kartenrands an ein Element hängen (Karte und Grafik-Übersicht)
  el.className = (el.id === 'mapPad' ? '' : 'gfx-pad ') + 'padbg b-' + k;
  const w = landscape().water, rgb = (c, f) => `rgb(${c.map(v => Math.round(v * f)).join()})`;
  el.style.setProperty('--sea1', rgb(w[w.length - 2], 0.95));   // Offenes Meer: tiefes Wasser der Landschaft
  el.style.setProperty('--sea2', rgb(w[w.length - 1], 0.7));
  el.style.setProperty('--paper', k === 'seekarte' ? `url(${paperImg()})` : 'none');
  el.style.setProperty('--stars', k === 'weltall' ? `url(${starsImg()})` : 'none');
}
function applyBorder() {
  $('setSel').value = gfxSet();
  borderVars($('mapPad'), curBorder());
  placeBorderDeco();
  if (!$('mLook').hidden) renderLook();
}
function placeBorderDeco() {
  const box = $('padDeco'), k = curBorder();
  box.textContent = '';
  if (k !== 'seekarte' && k !== 'weltall') return;
  const W = cv.width + pad.x * 2, H = cv.height + pad.y * 2, mx0 = pad.x, my0 = pad.y, mx1 = pad.x + cv.width, my1 = pad.y + cv.height;
  if (k === 'seekarte') {
    const s = Math.max(110, Math.min(230, Math.min(pad.x, pad.y) * 0.75));
    const img = (src, cx, cy, wd, flip) => { const i = document.createElement('img'); i.src = src; i.alt = ''; i.style.width = wd + 'px';
      i.style.left = (cx - wd / 2) + 'px'; i.style.top = (cy - wd / 4) + 'px'; if (flip) i.style.transform = 'scaleX(-1)'; box.append(i); return i; };
    const cap = (text, cx, cy) => { const d = document.createElement('div'); d.className = 'chart-cap'; d.textContent = text; d.style.left = cx + 'px'; d.style.top = cy + 'px'; box.append(d); };
    img(compassImg(), mx0 / 2, my0 / 2 - s / 4, s);                                // Ecke oben links
    img(compassImg(), mx1 + (W - mx1) / 2, my1 + (H - my1) / 2 - s * 0.3, s * 0.6);   // Ecke unten rechts, kleiner
    img(serpentImg(), mx1 + (W - mx1) / 2, my0 + cv.height * 0.45, s * 1.25);     // rechts neben der Karte
    cap('Hic sunt dracones', mx1 + (W - mx1) / 2, my0 + cv.height * 0.45 + s * 0.42);
    img(serpentImg(), mx0 / 2, my0 + cv.height * 0.7, s * 1.1, true);            // links, gespiegelt
    cap('Terra incognita', mx0 + cv.width / 2, my0 / 2);                          // über der Karte
  } else {
    if (S && landscape().sun) {   // Asteroidengürtel: Sonne auf ihrer Seite neben der Karte (dort liegen die Eisen-Asteroiden, gegenüber das Eis)
      const side = sunSide(), d = document.createElement('i'); d.className = 'sun';
      const size = Math.max(160, Math.min(420, (side < 2 ? pad.x : pad.y) * 1.1));
      const x = side === 0 ? mx0 * 0.42 : side === 1 ? mx1 + (W - mx1) * 0.58 : mx0 + cv.width / 2;
      const y = side === 2 ? my0 * 0.42 : side === 3 ? my1 + (H - my1) * 0.58 : my0 + cv.height / 2;
      d.style.cssText = `left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${size.toFixed(0)}px;height:${size.toFixed(0)}px`;
      box.append(d);
    }
    const r = mulberry32(5), n = Math.round(Math.min(60, (W * H - cv.width * cv.height) / 60000));
    for (let k2 = 0; k2 < n * 4 && box.childElementCount < n; k2++) {   // funkelnde Sterne, nur neben der Karte
      const x = r() * W, y = r() * H;
      if (x > mx0 - 20 && x < mx1 + 20 && y > my0 - 20 && y < my1 + 20) continue;
      const d = document.createElement('i'); d.className = 'twinkle';
      d.style.left = x.toFixed(0) + 'px'; d.style.top = y.toFixed(0) + 'px';
      d.style.animationDelay = (-r() * 3.4).toFixed(2) + 's'; d.style.animationDuration = (2.6 + r() * 2.4).toFixed(2) + 's';
      box.append(d);
    }
  }
}
applyBorder();
// Fenster „Aussehen der Karte“ (#mLook): oben die drei Sets (je fünf Einheitenbilder, Farbfeld, kurze Beschreibung), darunter die Landschaften des
// gewählten Sets (die gemischte als „Standard“) und alle Kartenränder (der des Sets als „passt zum Set“). Klicks gelten sofort, das Fenster bleibt offen.
const lookIcons = {};
function lookIcon(set, k) { const key = set + k; return lookIcons[key] || (lookIcons[key] = unitSprite(k, 0, 30, set).toDataURL()); }
function renderLook() {
  const set = gfxSet(), land = (S && S.land) || landPref, border = curBorder();
  $('lookSets').innerHTML = SET_KEYS.map(k => `<button class="look-set${k === set ? ' on' : ''}" data-lset="${k}">`
    + `<span class="ic">${['inf', 'tank', 'ftr', 'crs', 'bat'].map(t => `<img src="${lookIcon(k, t)}" alt="">`).join('')}</span>`
    + `<b>${esc(SET_NAMES[k])}</b><span class="sw" style="background:${landSwatch(SET_LAND[k])}"></span><small>${esc(SET_DESC[k])}</small></button>`).join('');
  $('lookLands').innerHTML = landsOf(set).map(k => `<button class="look-opt${k === land ? ' on' : ''}" data-lland="${k}"><span class="sw" style="background:${landSwatch(k)}"></span>`
    + `${esc(LAND_NAMES[k] || k)}${k === SET_LAND[set] ? `<small>${tt('Standard', 'default')}</small>` : ''}</button>`).join('');
  $('lookBorders').innerHTML = BORDER_KEYS.map(k => `<button class="look-opt${k === border ? ' on' : ''}" data-lborder="${k}"><span class="sw" style="background:${BORDER_SW[k]}"></span>`
    + `${esc(BORDER_NAMES[k])}${k === BORDER_DEFAULT[set] ? `<small>${tt('passt zum Set', 'matches the set')}</small>` : ''}</button>`).join('');
}
function openLook() { closeMenu(); closeCtx(); closeViewMenu(); renderLook(); openModal('mLook'); }
$('mLook').addEventListener('click', e => {
  const a = e.target.closest('[data-lset]'), l = e.target.closest('[data-lland]'), b = e.target.closest('[data-lborder]');
  if (a) chooseSet(a.dataset.lset); else if (l) setLandscape(l.dataset.lland); else if (b) setBorder(b.dataset.lborder); else return;
  Sfx.play('tick'); renderLook();
});
$('bLook').onclick = () => { closeModals(); openLook(); };   // aus dem Fenster „Einstellungen“
// Knopf „Ansicht“ in der Kopfzeile (bei Zoom und Zentrieren): EIN Symbol für alles, was die Anzeige der Karte betrifft – drei Schalter
// (Tastenkürzel, Wegvorschau, Kräfteverhältnis – dieselben wie in den Einstellungen –, dazu „Wege und Marschziele“ = Wegeansicht) und darunter die drei
// Grafik-Sets mit Farbfeld, zuletzt „Landschaft und Kartenrand …“ (Fenster #mLook). Wunsch des Nutzers: Landschaft mitten im Spiel wechseln als Gimmick, das überrascht; und statt je
// eines Symbols je Schalter ein Konzept für die Leiste – Menü | Karte (Zoom, Zentrieren, Ansicht) | Ton | Hilfe. Neue Anzeige-Optionen
// kommen in diese Liste, nicht als weiteres Symbol in die Leiste. Die Liste bleibt beim Klicken offen (ausprobieren), Esc oder ein Klick daneben schließt.
const viewMenu = $('viewMenu');
const VIEW_SW = [
  ['keys', tt('Tastenkürzel auf der Karte', 'Keyboard shortcuts on the map'), () => showKeys && !keysMin, on => setShowKeys(on)],
  ['route', tt('Weg beim Zeigen auf ein Feld', 'Route when pointing at a tile'), () => showRoute, on => setShowRoute(on)],
  ['power', tt('Kräfteverhältnis', 'Balance of power'), () => showPower, on => setShowPower(on)],
  ['paths', tt('Wege und Marschziele', 'Routes and rally points'), () => pathView, on => setPathView(on), 'G'],
  ['threat', tt('Reichweite der Gegner', 'Enemy reach'), () => threatView, on => setThreatView(on), 'K'],   // gilt für die laufende Partie, wird nicht gemerkt
];
function renderViewMenu() {
  const set = gfxSet(), land = (S && S.land) || landPref;
  viewMenu.innerHTML = `<h4>${tt('Anzeigen', 'Show')}</h4>`
    + VIEW_SW.map(([k, label, get, , kbd]) => `<button class="mi${get() ? ' on' : ''}" data-view="${k}" role="menuitemcheckbox" aria-checked="${get()}"><span class="ck">${get() ? '✓' : ''}</span>${label}${kbd ? `<kbd>${kbd}</kbd>` : ''}</button>`).join('')
    + `<h4>${tt('Grafik-Set', 'Graphics set')}</h4>` + SET_KEYS.map(k => `<button class="mi${k === set ? ' on' : ''}" data-set="${k}" title="${esc(SET_DESC[k])}">`
      + `<span class="sw" style="background:${landSwatch(SET_LAND[k])}"></span>${esc(SET_NAMES[k])}</button>`).join('')
    + `<button class="mi" data-look title="${esc(tt('Jetzt: ', 'Now: ') + (LAND_NAMES[land] || '') + ' · ' + BORDER_NAMES[curBorder()])}"><span class="ck"></span>${tt('Landschaft und Kartenrand …', 'Landscape and map border …')}</button>`;
}
function closeViewMenu() { if (viewMenu.hidden) return; viewMenu.hidden = true; $('bView').classList.remove('open'); $('bView').setAttribute('aria-expanded', 'false'); }
function openViewMenu() {
  closeMenu(); closeCtx(); renderViewMenu();
  viewMenu.hidden = false; $('bView').classList.add('open'); $('bView').setAttribute('aria-expanded', 'true');
  const r = $('bView').getBoundingClientRect();
  viewMenu.style.top = Math.round(r.bottom + 6) + 'px';
  viewMenu.style.left = Math.round(Math.max(8, Math.min(r.left, innerWidth - viewMenu.offsetWidth - 8))) + 'px';
}
$('bView').onclick = () => { if (viewMenu.hidden) openViewMenu(); else closeViewMenu(); };
viewMenu.addEventListener('click', e => {
  const t = e.target.closest('[data-set]'), v = e.target.closest('[data-view]');
  if (e.target.closest('[data-look]')) { openLook(); return; }
  if (t) chooseSet(t.dataset.set);
  else if (v) { const sw = VIEW_SW.find(s => s[0] === v.dataset.view); sw[3](!sw[2]()); }
  else return;
  Sfx.play('tick'); renderViewMenu();
});
document.addEventListener('mousedown', e => { if (!viewMenu.hidden && !e.target.closest('#viewMenu, #bView')) closeViewMenu(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !viewMenu.hidden) { closeViewMenu(); e.stopPropagation(); } }, true);
window.addEventListener('resize', closeViewMenu);

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
  if (d.gset) { gfx.set = d.gset; gfx.svg = null; renderGfx(); return; }
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
  $('setSel').value = gfxSet();   // zeigt, was die Karte gerade zeigt
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
$('bZoomIn').onclick = () => zoomBy(ZOOM_KEY, undefined, undefined, true);
$('bZoomOut').onclick = () => zoomBy(1 / ZOOM_KEY, undefined, undefined, true);
$('bFocus').onclick = actFocus;
