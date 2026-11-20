// Prüfung der Oberfläche im Browser: Wegvorschau gegen Klick, Klick-Abläufe, Einstiegstipps.
// Braucht das laufende Spiel (ui.js) – deshalb nicht in tools/test.js. Aufruf im Entwicklungs-Browser (http://localhost:8765):
//   eval(await (await fetch('tools/test-ui.js')).text()); await UiTest.run()
// Ergebnis: { bestanden, fehlgeschlagen: [...] }. ACHTUNG: ersetzt die laufende Partie und stellt die Tipps um – nur zum Testen.
// Grundgedanke der Matrix: Für jede Einheit und jedes Ziel muss die Vorschau unter der Maus zu dem passen, was der Klick dann tut
// („Weg“ → Marsch, „geht nicht“ → abgelehnt, nichts → der Klick wählt aus). Gehört nicht zum Spiel und nicht in den Release.
window.UiTest = (() => {
  const fails = []; let passed = 0;
  const check = (cond, what) => { if (cond) passed++; else fails.push(what); };
  let save = null, base = null, scene = null;

  const seen = (x, y) => S.players[0].seen[idx(x, y)] === 1, land = (x, y) => S.terrain[idx(x, y)] === 1;
  const free = (x, y) => !topUnitsAt(x, y).length && !cityAt(x, y);
  const all = test => { const o = []; for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (test(x, y)) o.push([x, y]); return o; };
  function reset() {
    deserialize(save); S.log = []; replay = 'off';
    for (const v of S.units.slice()) killUnit(v);
    sel = null; selCity = null; gotoPreview = null; computeVision(0);
  }
  function preview(u, x, y) {
    select(u, false); hover = [x, y]; hoverPath = null;
    const h = hoverRoute(u);
    if (!h) return 'nichts';
    if (h.none) return 'NEIN';
    const fs = fuelState(u, x, y, h.path.length);
    return 'Weg' + (h.board ? '+Bord' : h.shiftGo ? '+Umschalt' : '') + (fs ? '[' + fs + ']' : '');
  }
  function click(u, x, y, shift = false) {
    const at = [u.x, u.y]; select(u, false); gotoPreview = null; $('toast').textContent = '';
    try { onTileClick(x, y, shift); } catch (e) { return 'FEHLER ' + e.message; }
    skipAnim(); closeModals();
    const msg = $('toast').textContent, s = selUnit();
    if (!alive(u)) return 'Angriff';
    if (gotoPreviewFor(u)) return 'festgehalten';
    if (u.carrier != null) return 'an Bord';
    if (u.x !== at[0] || u.y !== at[1] || (u.order && u.order.type === 'goto')) return 'Marsch';
    if (s && s !== u) return 'wählt';
    return msg ? 'abgelehnt' : 'nichts';
  }
  const startOf = type => { const d = UT[type].domain; return d === 'land' ? base.l : d === 'sea' ? base.s : base.c; };

  // Stellung: Heimatstadt mit Land- und Seefeld daneben, dazu 15 Zielarten in der Ferne
  function build() {
    reset();
    for (const c of S.cities.filter(c => c.owner === 0)) {
      const n = DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).filter(([x, y]) => inb(x, y) && free(x, y));
      const l = n.filter(([x, y]) => land(x, y)), s = n.filter(([x, y]) => !land(x, y));
      if (l.length && s.length) { base = { c: [c.x, c.y], l: l[0], s: s[0] }; break; }
    }
    const o = base.c, d = (x, y) => cheb(o[0], o[1], x, y);
    const pi = createUnit('inf', 0, ...base.l), ps = createUnit('dst', 0, ...base.s);
    const rl = (x, y) => { const p = findPath(pi, x, y, false, true); return !!(p && p.length); };
    const rs = (x, y) => { const p = findPath(ps, x, y, false, true); return !!(p && p.length); };
    const near = (test, lo = 3, hi = 8) => all((x, y) => d(x, y) >= lo && d(x, y) <= hi && test(x, y)).sort((a, b) => d(...a) - d(...b));
    const coast = near((x, y) => seen(x, y) && !land(x, y) && free(x, y) && rs(x, y) && DIRS.some(([dx, dy]) => inb(x + dx, y + dy) && land(x + dx, y + dy) && free(x + dx, y + dy) && rl(x + dx, y + dy)));
    const open = near((x, y) => seen(x, y) && !land(x, y) && free(x, y) && rs(x, y) && !DIRS.some(([dx, dy]) => inb(x + dx, y + dy) && land(x + dx, y + dy)));
    const same = near((x, y) => seen(x, y) && land(x, y) && free(x, y) && rl(x, y));
    const other = near((x, y) => seen(x, y) && land(x, y) && free(x, y) && !rl(x, y), 3, 25);
    const fog = near((x, y) => !seen(x, y), 3, 40);
    const own = S.cities.filter(c => c.owner === 0 && (c.x !== o[0] || c.y !== o[1])).sort((a, b) => d(a.x, a.y) - d(b.x, b.y));
    const xy = c => c && [c.x, c.y], nearest = l => l.sort((a, b) => d(a.x, a.y) - d(b.x, b.y))[0];
    scene = {
      'Land frei, selbe Insel': [same[0]], 'Land frei, andere Insel': [other[0]], 'Meer frei': [open[0]], 'unerforscht': [fog[0]],
      'eigene Stadt, selbe Insel': [xy(own.find(c => d(c.x, c.y) >= 2 && rl(c.x, c.y)))], 'eigene Stadt, andere Insel': [xy(own.find(c => !rl(c.x, c.y)))],
      'Stadt des Gegners': [xy(nearest(S.cities.filter(c => c.owner > 0 && seen(c.x, c.y))))], 'neutrale Stadt': [xy(nearest(S.cities.filter(c => c.owner < 0 && seen(c.x, c.y))))],
      'eigene Infanterie': [same[1], ['inf', 0]], 'Gegner an Land': [same[2], ['tank', 1]],
      'eigener Zerstörer': [open[1], ['dst', 0]], 'Gegner auf See': [open[2], ['crs', 1]],
      'eig. Transporter, Platz': [coast[0], ['trn', 0]], 'eig. Transporter, voll': [coast[1], ['trn', 0, 'voll']], 'eigener Träger': [open[3], ['car', 0]],
    };
    killUnit(pi); killUnit(ps);
  }
  function place() {
    for (const [t, obj] of Object.values(scene)) {
      if (!t || !obj) continue;
      const u = createUnit(obj[0], obj[1], ...t);
      if (obj[2] === 'voll') for (let k = 0; k < UT[obj[0]].capacity; k++) createUnit('inf', 0, ...t).carrier = u.id;
    }
  }

  // 1) Fernziele: 9 Einheitentypen × 15 Ziele
  function farMatrix() {
    for (const [name, [t]] of Object.entries(scene)) {
      if (!t) { fails.push('Stellung: kein Ziel „' + name + '“'); continue; }
      for (const ty of UNIT_ORDER) {
        reset(); place();
        const u = createUnit(ty, 0, ...startOf(ty)); computeVision(0);
        const pv = preview(u, ...t), ck = click(u, ...t);
        const fits = pv.startsWith('Weg+') ? ck === 'wählt'                    // Hinweis auf Umschalt + Klick: der einfache Klick wählt aus
          : pv.includes('[far]') ? ck === 'abgelehnt'
          : pv.startsWith('Weg') ? ['Marsch', 'festgehalten', 'Angriff'].includes(ck)
          : pv === 'NEIN' ? ['abgelehnt', 'wählt'].includes(ck)
          : ck === 'wählt';
        check(fits, `fern: ${UT[ty].name} → ${name}: Vorschau „${pv}“, Klick „${ck}“`);
      }
    }
  }
  // 2) Nachbarfelder: „geht nicht“ nur, wenn der Klick die Einheit wirklich nicht bewegt
  function nearMatrix() {
    const o = base.c;
    const pair = (uLand, tLand) => {
      for (let r = 1; r < 9; r++) for (let y = o[1] - r; y <= o[1] + r; y++) for (let x = o[0] - r; x <= o[0] + r; x++) {
        if (!inb(x, y) || !seen(x, y) || !free(x, y) || land(x, y) !== uLand) continue;
        for (const [dx, dy] of DIRS) { const a = x + dx, b = y + dy; if (inb(a, b) && seen(a, b) && free(a, b) && land(a, b) === tLand) return [[x, y], [a, b]]; }
      }
      return null;
    };
    const cases = [['Land frei', true, null], ['Meer frei', false, null], ['eigene Infanterie', true, ['inf', 0]], ['Gegner an Land', true, ['tank', 1]],
      ['eig. Transporter, Platz', false, ['trn', 0]], ['eig. Transporter, voll', false, ['trn', 0, 'voll']], ['eigener Träger', false, ['car', 0]],
      ['eigener Zerstörer', false, ['dst', 0]], ['Gegner auf See', false, ['crs', 1]]];
    for (const [name, tLand, obj] of cases) for (const ty of UNIT_ORDER) {
      reset();
      const p = pair(UT[ty].domain !== 'sea', tLand);
      if (!p) { fails.push('Stellung: kein Platz für ' + name); continue; }
      if (obj) { const t = createUnit(obj[0], obj[1], ...p[1]); if (obj[2] === 'voll') for (let k = 0; k < UT[obj[0]].capacity; k++) createUnit('inf', 0, ...p[1]).carrier = t.id; }
      const u = createUnit(ty, 0, ...p[0]); computeVision(0);
      const pv = preview(u, ...p[1]), ck = click(u, ...p[1]);
      check(pv === 'NEIN' ? ['abgelehnt', 'nichts', 'wählt'].includes(ck) : pv === 'nichts', `nah: ${UT[ty].name} → ${name}: Vorschau „${pv}“, Klick „${ck}“`);
      // was die Einheit betreten kann, darf nie „geht nicht“ heißen
      if (canEnterTerrain(u, ...p[1]) && !obj) check(pv === 'nichts', `nah: ${UT[ty].name} → ${name}: betretbar, aber Vorschau „${pv}“`);
    }
  }
  // 3) Klick-Abläufe
  function flows() {
    const [cx, cy] = scene['eigene Stadt, selbe Insel'][0], [fx, fy] = scene['Land frei, selbe Insel'][0];
    const fresh = () => { reset(); const u = createUnit('inf', 0, ...base.l); computeVision(0); select(u, false); return u; };
    const moved = u => u.x !== base.l[0] || u.y !== base.l[1] || !!(u.order && u.order.type === 'goto');
    let u = fresh(); onTileClick(cx, cy, false);
    check(!moved(u) && !!gotoPreviewFor(u), 'Stadt, erster Klick: Einheit bleibt stehen, Weg festgehalten');
    check(selCity != null && S.cities[selCity].x === cx, 'Stadt, erster Klick: Stadtkarte in der Seitenleiste');
    onTileClick(cx, cy, false); skipAnim();
    check(moved(u) && !gotoPreview, 'Stadt, zweiter Klick: Einheit marschiert');
    u = fresh(); onTileClick(cx, cy, false); rightClickAction(null);
    check(!gotoPreview && sel === u.id && !u.order, 'Rechtsklick verwirft den festgehaltenen Weg, Einheit bleibt gewählt');
    u = fresh(); onTileClick(cx, cy, false); onTileClick(fx, fy, false); skipAnim();
    check(!gotoPreview && moved(u), 'Klick auf ein anderes Feld marschiert dorthin statt zur Stadt');
    u = fresh(); onTileClick(cx, cy, true); skipAnim();
    check(!gotoPreview && moved(u), 'Umschalt + Klick auf die Stadt marschiert sofort');
    u = fresh(); onTileClick(fx, fy, false); skipAnim();
    check(moved(u), 'freies Feld: ein Klick genügt');
    u = fresh(); const v = createUnit('tank', 0, fx, fy); onTileClick(fx, fy, false);
    check(selUnit() === v && !u.order, 'Klick auf eine eigene Einheit wählt sie aus');
    select(u, false); onTileClick(fx, fy, true); skipAnim();
    check(!!(u.order && u.order.type === 'goto') || moved(u), 'Umschalt + Klick auf eine eigene Einheit marschiert dorthin');
    u = fresh(); const wasOn = showRoute; showRoute = false; hover = [fx, fy]; hoverPath = null;
    check(hoverRoute(u) != null, 'Vorschau abgeschaltet: die Wegsuche für den Klick läuft weiter');
    showRoute = wasOn;
  }
  // 4) Einstiegstipps: jeder Auslöser einzeln
  function tipsCheck() {
    const wasOn = tips.on, done0 = [...tips.done];
    const fresh = keep => { startNew('klein', 'normal', 'inseln', 4711, 1); replay = 'off'; setTips(true); for (const t of TIPS) if (!keep.includes(t.id)) tips.done.add(t.id); $('tipBox').dataset.id = ''; refresh(); return S.cities.find(c => c.owner === 0); };
    const cur = () => (tips.cur && !$('tipBox').hidden ? tips.cur.id : null);
    let c = fresh(['start']); check(cur() === 'start', 'Tipp „start“ in Runde 1');
    document.querySelector('#tipBox [data-tip="ok"]').click(); check(cur() === null && tips.done.has('start'), '„Verstanden“ blendet den Tipp aus');
    c = fresh(['mouse']); check(cur() === null, 'Tipp „mouse“ noch nicht in Runde 1'); S.turn = 2; refresh(); check(cur() === 'mouse', 'Tipp „mouse“ ab Runde 2');
    for (const k of UNIT_ORDER.filter(k => k !== 'inf')) { c = fresh(['u-' + k]); const before = cur(); createUnit(k, 0, c.x, c.y); refresh(); check(before === null && cur() === 'u-' + k, 'Tipp zur ersten Einheit: ' + UT[k].name); }
    c = fresh(['won']); killUnit(createUnit('inf', 1, c.x + 1, c.y), 0); refresh(); check(cur() === 'won', 'Tipp „Erster Sieg“');
    c = fresh(['lost']); killUnit(createUnit('ftr', 0, c.x, c.y), -1); refresh(); check(cur() === null, 'Jägerabsturz ist kein „Erster Verlust“');
    killUnit(createUnit('inf', 0, c.x, c.y), 1); refresh(); check(cur() === 'lost', 'Tipp „Erster Verlust“');
    c = fresh(['crash']); killUnit(createUnit('ftr', 0, c.x, c.y), -1); refresh(); check(cur() === 'crash', 'Tipp „Jäger abgestürzt“');
    c = fresh(['sunk', 'lost']); const sea = DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => inb(x, y) && !S.terrain[idx(x, y)]);
    let t = createUnit('trn', 0, ...sea); createUnit('inf', 0, ...sea).carrier = t.id; refresh(); killUnit(t, 1); refresh(); check(cur() === 'sunk', 'Tipp „Transporter versenkt“');
    document.querySelector('#tipBox [data-tip="ok"]').click(); check(tips.done.has('lost') && cur() === null, '… gilt zugleich als „Erster Verlust“');
    c = fresh(['sunk', 'lost']); t = createUnit('trn', 0, ...sea); refresh(); killUnit(t, 1); refresh(); check(cur() === 'lost', 'leerer Transporter: nur „Erster Verlust“');
    c = fresh(['citylost']); let n = S.cities.filter(k => k.owner < 0)[0]; captureCity(n, 0, createUnit('inf', 0, n.x, n.y)); closeModals(); refresh(); captureCity(n, 1, createUnit('inf', 1, n.x, n.y)); closeModals(); refresh(); check(cur() === 'citylost', 'Tipp „Stadt verloren“');
    c = fresh(['foecity']); n = S.cities.filter(k => k.owner < 0)[0]; captureCity(n, 0, createUnit('inf', 0, n.x, n.y)); closeModals(); refresh(); check(cur() === null, 'neutrale Stadt ist keine „Stadt des Gegners“');
    n = S.cities.filter(k => k.owner < 0)[0]; captureCity(n, 1, createUnit('inf', 1, n.x, n.y)); closeModals(); refresh(); captureCity(n, 0, createUnit('inf', 0, n.x, n.y)); closeModals(); refresh(); check(cur() === 'foecity', 'Tipp „Stadt des Gegners erobert“');
    c = fresh(['home']); const f = createUnit('ftr', 0, c.x, c.y); refresh(); check(cur() === null, 'voller Jäger in der Stadt: kein Tipp');
    let far = null; for (let r = 9; r > 3 && !far; r--) for (const [dx, dy] of DIRS) { const x = c.x + dx * r, y = c.y + dy * r; if (inb(x, y) && !cityAt(x, y)) { far = [x, y]; break; } }
    f.x = far[0]; f.y = far[1]; f.fuel = distHome(0, f.x, f.y) + 2; refresh(); check(cur() === 'home', 'Tipp „Treibstoff wird knapp“');
    c = fresh(['sentry']); for (let k = 0; k < 4; k++) createUnit('inf', 0, c.x, c.y); refresh(); check(cur() === null, 'Wache-Tipp nicht vor Runde 8'); S.turn = 8; refresh(); check(cur() === 'sentry', 'Tipp „Viele Einheiten warten“');
    c = fresh(['rally', 'plan']); const got = [];
    for (const k of S.cities.filter(k => k.owner < 0).slice(0, 5)) { captureCity(k, 0, createUnit('inf', 0, k.x, k.y)); closeModals(); refresh(); got.push(cur()); const b = document.querySelector('#tipBox [data-tip="ok"]'); if (b && !$('tipBox').hidden) b.click(); }
    check(got.join() === ',,rally,,plan', 'Marschziel ab 4, Überblick ab 6 Städten (' + got.join() + ')');
    // unbeachteter Tipp macht nach drei Runden Platz
    c = fresh(['mouse', 'sentry']); S.turn = 8; for (let k = 0; k < 4; k++) createUnit('inf', 0, c.x, c.y); refresh(); const first = cur(); S.turn = 11; refresh();
    check(first === 'mouse' && cur() === 'sentry', 'unbeachteter Tipp macht nach drei Runden Platz');
    document.querySelector('#tipBox [data-tip="off"]').click(); check(!tips.on && $('tipBox').hidden, '„Tipps ausschalten“ schaltet ab');
    tips.on = wasOn; tips.done = new Set(done0); $('tipsChk').checked = wasOn; saveTips(); $('tipBox').dataset.id = ''; refresh();
  }

  async function run() {
    fails.length = 0; passed = 0;
    save = await (await fetch('docs/spielstaende/beispiel-2-inselreich-seekrieg.json')).text();
    deserialize(save); afterLoad(); closeModals();
    const keepReplay = replay;
    build(); farMatrix(); nearMatrix(); flows(); tipsCheck();
    replay = keepReplay; skipAnim(); closeModals(); refresh();
    return { bestanden: passed, fehlgeschlagen: fails };
  }
  return { run };
})();
