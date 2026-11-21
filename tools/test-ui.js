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
  // Befehle: Knopf der Seitenleiste, Rechtsklick-Menü, Tastenlegende und Taste müssen sich einig sein (orderCheck).
  // Grauer Knopf = die Taste meldet denselben Grund und ändert nichts; aktiver Knopf = die Taste bewirkt etwas.
  function orders() {
    const KEYS = { skip: ' ', sentry: 's', patrol: 'p', explore: 'r', home: 'b', load: 'l' };
    const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const port = () => S.cities.find(c => c.owner === 0 && c.coastal);
    const lagen = { 'in der eigenen Stadt': t => createUnit(t, 0, ...base.c) };
    for (const t of UNIT_ORDER) lagen['frei: ' + t] = (tt => () => createUnit(tt, 0, ...startOf(tt)))(t);
    Object.assign(lagen, {
      'Infanterie in der Stadt': () => createUnit('inf', 0, ...base.c),
      'Zerstörer im Hafen': () => { const c = port(); return createUnit('dst', 0, c.x, c.y); },
      'Infanterie an Bord': () => { const t = createUnit('trn', 0, ...base.s), u = createUnit('inf', 0, ...base.s); u.carrier = t.id; return u; },
      'Transporter mit Ladung': () => { const t = createUnit('trn', 0, ...base.s); createUnit('inf', 0, ...base.s).carrier = t.id; return t; },
      'Transporter voll': () => { const t = createUnit('trn', 0, ...base.s); for (let k = 0; k < UT.trn.capacity; k++) createUnit('inf', 0, ...base.s).carrier = t.id; return t; },
      'Transporter lädt': () => { const t = createUnit('trn', 0, ...base.s); t.order = { type: 'load' }; return t; },
      'ohne Züge': () => { const u = createUnit('tank', 0, ...base.l); u.moves = 0; return u; },
      'auf Wache': () => { const u = createUnit('inf', 0, ...base.l); u.order = { type: 'sentry' }; return u; },
      'alles erkundet': () => { S.players[0].real = null; const u = createUnit('dst', 0, ...base.s); return u; },
      'Jäger fast leer, fern': () => { const u = createUnit('ftr', 0, ...scene['unerforscht'][0]); u.fuel = 2; return u; },
    });
    delete lagen['in der eigenen Stadt'];
    let grau = 0, aktiv = 0;
    const auto0 = autoEnd; autoEnd = false;   // sonst beendet der letzte Befehl die Runde, und die nächste Taste bricht nur den Countdown ab
    for (const [name, make] of Object.entries(lagen)) {
      for (const act of Object.keys(KEYS)) {
        reset();
        const u = make(); computeVision(0);
        if (name === 'alles erkundet') S.players[0].seen.fill(1);
        if (act === 'load' && UT[u.type].carries !== 'land') continue;
        select(u, false); refresh();
        const why = orderCheck(u)[act], b = document.querySelector('#panel [data-act="' + act + '"]'), tag = 'Befehle: ' + name + ' / ' + act;
        check(!!b, tag + ' – Knopf fehlt');
        if (!b) continue;
        check(b.disabled === !!why, tag + ' – Knopf ' + (b.disabled ? 'grau' : 'aktiv') + ', Prüfung sagt: ' + (why || 'möglich'));
        if (why) check(b.title === why, tag + ' – Hinweistext nennt nicht den Grund');
        if (u.carrier == null && !cityAt(u.x, u.y) && openCtx(u.x, u.y, 200, 200)) {
          const m = document.querySelector('#ctxMenu [data-cact="' + act + '"]');
          check(!!m && m.disabled === !!why, tag + ' – Rechtsklick-Menü weicht ab');
          closeCtx();
        }
        const before = JSON.stringify([u.x, u.y, u.order, u.skip, !!patrolMode]);
        $('toast').textContent = ''; autoEndAt = 0; key(KEYS[act]); skipAnim(); closeModals();
        const after = alive(u) ? JSON.stringify([u.x, u.y, u.order, u.skip, !!patrolMode]) : 'weg';
        if (why) { grau++; check(after === before && (act === 'skip' || $('toast').textContent === why), tag + ' – Taste: erwartet Meldung „' + why + '“, kam „' + $('toast').textContent + '“' + (after === before ? '' : ', und es hat sich etwas geändert')); }
        else { aktiv++; check(after !== before, tag + ' – Knopf aktiv, aber die Taste bewirkt nichts (Meldung: „' + $('toast').textContent + '“)'); }
        patrolMode = null;
      }
    }
    autoEnd = auto0;
    check(grau > 12 && aktiv > 40, 'Befehle: zu wenige Fälle (' + grau + ' grau, ' + aktiv + ' aktiv)');
  }
  // Reichweite der Gegner (Taste K): was die Ebene zeigt – und was sie nicht verraten darf
  function threat() {
    const z = () => { computeVision(0); return buildThreatMap(); }, v = (m, p) => m[idx(p[0], p[1])];
    const nbs = p => DIRS.map(([dx, dy]) => [p[0] + dx, p[1] + dy]).filter(([x, y]) => inb(x, y));
    reset(); check(z().every(x => x === 0), 'Reichweite: ohne sichtbare Gegner ist nichts markiert');
    // Infanterie neben der eigenen Stadt: alle erforschten Nachbarfelder (Land und Ufer), nicht weiter
    reset(); createUnit('inf', 1, ...base.l); let m = z();
    check(nbs(base.l).filter(([x, y]) => seen(x, y)).every(p => v(m, p) === 1), 'Reichweite: Infanterie bedroht alle Nachbarfelder');
    check(m.every((x, i) => !x || cheb(i % S.W, (i / S.W) | 0, ...base.l) <= 1), 'Reichweite: Infanterie reicht genau ein Feld weit');
    check(v(m, base.c) === 1, 'Reichweite: die eigene Stadt daneben ist bedroht');
    // Zerstörer: Wasser ja, Land nein; Kreuzer: auch das Land am Ufer
    reset(); createUnit('dst', 1, ...base.s); m = z();
    check(m.every((x, i) => !x || S.terrain[i] === 0), 'Reichweite: Zerstörer bedroht kein Landfeld');
    check(m.some(x => x === 1), 'Reichweite: Zerstörer bedroht Wasserfelder');
    reset(); createUnit('crs', 1, ...base.s); m = z();
    check(nbs(base.s).filter(([x, y]) => seen(x, y) && land(x, y)).every(p => v(m, p) === 1), 'Reichweite: Kreuzer bedroht das Land am Ufer');
    // Transporter: nur das Land daneben (Sturm vom Schiff), Träger gar nichts
    reset(); createUnit('trn', 1, ...base.s); m = z();
    check(m.some(x => x === 1) && m.every((x, i) => !x || S.terrain[i] === 1), 'Reichweite: Transporter bedroht nur Land');
    reset(); createUnit('car', 1, ...base.s); check(z().every(x => x === 0), 'Reichweite: Träger bedroht nichts');
    // Jäger: schraffiert (2), sechs Felder weit; Bodentruppen überschreiben mit 1
    reset(); createUnit('ftr', 1, ...base.l); m = z();
    check(m.some(x => x === 2) && !m.some(x => x === 1), 'Reichweite: Jäger allein = nur schraffiert');
    check(m.every((x, i) => !x || cheb(i % S.W, (i / S.W) | 0, ...base.l) <= UT.ftr.move), 'Reichweite: Jäger höchstens ' + UT.ftr.move + ' Felder');
    // nichts im Unerforschten, nichts von Einheiten, die man nicht sieht, keine Ladung
    check(m.every((x, i) => !x || S.players[0].seen[i]), 'Reichweite: nichts im Unerforschten');
    reset(); const far = all((x, y) => land(x, y) && free(x, y) && !S.players[0].vis[idx(x, y)] && seen(x, y))[0];
    if (far) { createUnit('tank', 1, ...far); check(z().every(x => x === 0), 'Reichweite: Einheit außer Sicht zählt nicht'); }
    reset(); const t = createUnit('trn', 1, ...base.s); createUnit('tank', 1, ...base.s).carrier = t.id; m = z();
    check(m.every((x, i) => !x || cheb(i % S.W, (i / S.W) | 0, ...base.s) <= UT.trn.move), 'Reichweite: Ladung an Bord zählt nicht eigens');
    // Taste K schaltet, Zeichnen läuft
    const k0 = threatView; setThreatView(false); select(null);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true }));
    check(threatView === true, 'Reichweite: Taste K schaltet ein');
    try { render(performance.now()); check(true, ''); } catch (e) { fails.push('Reichweite: Zeichnen stürzt ab – ' + e.message); }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true }));
    check(threatView === false, 'Reichweite: Taste K schaltet aus');
    setThreatView(k0);
  }
  // Lupe (Taste O halten): erscheint nur über der Karte, verschwindet beim Loslassen – und zeigt dieselbe Landschaft wie die Karte
  function lupe() {
    reset(); createUnit('tank', 0, ...base.l); computeVision(0); refresh(); select(null);
    const key = (type, k) => document.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
    const r = cv.getBoundingClientRect(), wr = wrap.getBoundingClientRect(), el = $('loupe');
    focusOn(base.l[0], base.l[1]); camStep(performance.now() + 5000); applyPad && applyPad();
    const at = (x, y) => { const q = cv.getBoundingClientRect(); return [q.left + (x + 0.5) * TS, q.top + (y + 0.5) * TS]; };
    loupeXY = at(...base.l);
    const over = loupeXY[0] > wr.left && loupeXY[0] < wr.right && loupeXY[1] > wr.top && loupeXY[1] < wr.bottom;
    key('keydown', 'o');
    check(loupeOn, 'Lupe: Taste O schaltet ein');
    if (over) {
      check(!el.hidden && el.width === el.height && el.width >= LOUPE_D, 'Lupe: sichtbar und rund (quadratische Leinwand)');
      const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 90) n++;
      check(n > el.width * el.height * 0.3, 'Lupe: zeigt ein Bild (' + n + ' helle Punkte)');
      check(Math.abs(parseFloat(el.style.left) + LOUPE_D / 2 - loupeXY[0]) <= 1, 'Lupe: sitzt unter der Maus');
    }
    loupeXY = [wr.right + 60, wr.top + 60]; drawLoupe(); check(el.hidden, 'Lupe: außerhalb der Karte unsichtbar');
    loupeXY = at(...base.l); key('keyup', 'o');
    check(!loupeOn && el.hidden, 'Lupe: Loslassen schließt sie');
    // Ein Ausschnitt muss genauso aussehen wie dieselbe Stelle der ganzen Karte (Zufall je Feld, nicht der Reihe nach)
    const ts = 32, full = buildTerrain(ts), [bx, by] = base.l, x0 = Math.max(0, bx - 2), y0 = Math.max(0, by - 2), w = Math.min(S.W - x0, 5), h = Math.min(S.H - y0, 5);
    const sub = (src, T) => { const a = new T(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = src[idx(x0 + x, y0 + y)]; return a; };
    const part = buildTerrain(ts, { W: w, H: h, ox: x0, oy: y0, over: false, terrain: sub(S.terrain, Uint8Array), depth: sub(S.depth, Uint8Array), elev: sub(S.elev, Float32Array), cityGrid: sub(S.cityGrid, Int16Array) });
    const A = full.getContext('2d').getImageData(bx * ts + 4, by * ts + 4, ts - 8, ts - 8).data, B = part.getContext('2d').getImageData((bx - x0) * ts + 4, (by - y0) * ts + 4, ts - 8, ts - 8).data;
    let diff = 0; for (let i = 0; i < A.length; i++) diff += Math.abs(A[i] - B[i]);
    check(diff / A.length < 6, 'Lupe: Ausschnitt weicht von der Karte ab (mittlere Abweichung ' + (diff / A.length).toFixed(1) + ' von 255)');
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

  // 5) Ladereihenfolge: Die Skripte werden nacheinander geladen. Code, der beim Laden sofort läuft, darf keine Funktion aus einem
  // späteren Skript aufrufen – innerhalb eines try/catch bliebe das ohne Fehlermeldung (so wären beim Aufteilen von ui.js Tipps und
  // Tastenlegende beim allerersten Besuch stillschweigend aus geblieben). Die Seite wird in einem unsichtbaren Rahmen neu aufgebaut;
  // vor jedem Skript stehen Attrappen für alle Funktionen der späteren, die jeden Aufruf melden. Geprüft in vier Ausgangslagen.
  async function loadOrder() {
    let html = await (await fetch('index.html', { cache: 'no-store' })).text();
    const files = [...html.matchAll(/<script src="(js\/[\w-]+\.js)"><\/script>/g)].map(m => m[1]);
    const fnOf = {};
    for (const f of files) for (const m of (await (await fetch(f, { cache: 'no-store' })).text()).matchAll(/^(?:async )?function (\w+)/gm)) fnOf[m[1]] = f;
    html = html.replace(/<script src="js\/[\w-]+\.js"><\/script>\s*/g, '');
    let tags = '<script>window.__fwd = []; window.__err = []; window.addEventListener("error", e => window.__err.push(e.message));<\/script>';
    files.forEach((f, k) => {
      const later = Object.keys(fnOf).filter(n => files.indexOf(fnOf[n]) > k);
      tags += '<script>' + later.map(n => `var ${n} = function () { window.__fwd.push(${JSON.stringify(f + ' ruft beim Laden ' + n + '() aus ' + fnOf[n])}); throw new ReferenceError(${JSON.stringify(n)}); };`).join('') + '<\/script>';
      tags += `<script src="${f}"><\/script>`;
    });
    html = html.replace('</body>', tags + '</body>');
    const once = async name => {
      const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-3000px;width:1200px;height:900px';
      document.body.append(fr); fr.srcdoc = html;
      await new Promise(r => { fr.onload = r; }); await new Promise(r => setTimeout(r, 1200));
      const w = fr.contentWindow, fwd = [...new Set(w.__fwd)];
      check(!fwd.length, `Ladereihenfolge (${name}): ${fwd.join('; ')}`);
      check(!w.__err.length, `Fehler beim Laden (${name}): ${w.__err.join('; ')}`);
      check(w.eval('typeof S !== "undefined" && !!S && S.turn >= 1'), `nach dem Laden läuft keine Partie (${name})`);
      const state = { tipps: w.eval('tips.on'), legende: w.eval('showKeys'), willkommen: w.eval('!document.getElementById("mWelcome").hidden') };
      fr.remove();
      return state;
    };
    const keep = Object.entries(localStorage);
    try {
      await once('gewohnter Start');
      localStorage.clear();
      const first = await once('allererster Besuch');
      check(first.tipps && first.legende && first.willkommen, 'allererster Besuch: Tipps, Tastenlegende und Willkommensfenster sind an');
      localStorage.clear(); localStorage.setItem('archipel-welcome', '1'); localStorage.setItem('archipel-lang', 'en');
      const known = await once('bekannter Besucher, Englisch');
      check(!known.tipps && !known.willkommen, 'bekannter Besucher: keine Tipps, kein Willkommensfenster');
      localStorage.clear(); localStorage.setItem('archipel-welcome', '1'); localStorage.setItem('archipel-save-v1', '{kaputt'); localStorage.setItem('archipel-tips', 'kein json');
      await once('kaputte gespeicherte Daten');
    } finally {
      localStorage.clear();
      for (const [k, v] of keep) localStorage.setItem(k, v);
    }
  }

  // 6) Durchlauf: jedes Fenster, jede Taste, Kontextmenü, Ansichten und das Zeichnen einmal auslösen. Geprüft wird, dass nichts
  // abstürzt und das Erwartete da ist – der häufigste Fehler nach einem Umbau ist ein Absturz an einer selten benutzten Stelle.
  async function walkthrough() {
    const step = (name, fn) => { try { const r = fn(); check(r !== false, 'Durchlauf: ' + name); } catch (e) { fails.push('Durchlauf: ' + name + ' – Absturz: ' + e.message); } };
    const shown = id => !$(id).hidden, filled = id => $(id).textContent.trim().length > 20;
    const key = (k, more = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...more }));
    const draw = () => { render(performance.now()); renderMini(); };
    const slots0 = localStorage.getItem('archipel-slots'), muted0 = Sfx.isMuted ? Sfx.isMuted() : null;
    deserialize(save); afterLoad(); closeModals(); replay = 'off';
    cancelAutoEnd(); skipAnim();   // ein laufender Countdown zum Rundenende oder eine Wiedergabe schluckt sonst den ersten Tastendruck (gewollt)
    const mine = () => S.units.filter(u => u.owner === 0 && u.carrier == null);

    // Fenster
    for (const [name, open, id] of [['Handbuch', () => openHelp(), 'mHelp'], ['Statistik', openStats, 'mStats'], ['Kräfteverhältnis', openPower, 'mPower'],
      ['Einstellungen', openSettings, 'mSettings'], ['Klangtest', openSoundTest, 'mSound'], ['Grafiken', openGfx, 'mGfx'], ['Spielstände', openSaves, 'mSaves'],
      ['Zeitraffer', () => openTimelapse(), 'mTime'], ['Produktion wählen', () => openProdDialog(S.cities.find(c => c.owner === 0)), 'mCapture'],
      ['Eroberungsfenster', () => openProdDialog(S.cities.find(c => c.owner === 0), true), 'mCapture'], ['Neues Spiel', () => openModal('mNew'), 'mNew'],
      ['Willkommen', () => openModal('mWelcome'), 'mWelcome']]) {
      step('Fenster ' + name + ' öffnet sich mit Inhalt', () => { open(); return shown(id) && filled(id); });
      step('Esc schließt ' + name, () => { key('Escape'); return !shown(id); });
    }
    for (const b of $('helpTabs').querySelectorAll('button[data-tab]')) step('Handbuch-Reiter ' + b.dataset.tab, () => { openHelp(b.dataset.tab); const p = document.querySelector(`section[data-pane="${b.dataset.tab}"]`); return !p.hidden && p.textContent.trim().length > 100; });
    step('Handbuch: Tabelle „Wer schlägt wen“ in beiden Ansichten', () => { openHelp('combat'); const sw = [...$('matrixSw').querySelectorAll('button')], was = sw.find(b => b.classList.contains('on')); let cells = 99; for (const b of sw) { b.click(); cells = Math.min(cells, document.querySelectorAll('.help-matrix td').length); } was.click(); return sw.length === 2 && cells >= 49; });
    closeModals();
    for (const t of ['units', 'land', 'marks', 'anim']) step('Grafik-Reiter ' + t, () => { gfx.tab = t; openGfx(); return document.querySelectorAll('#gfxBody .gfx-card').length >= 5; });
    step('Grafiken: Animation abspielen und SVG-Code zeigen', () => { document.querySelector('[data-gplay="0"]').click(); gfx.tab = 'units'; renderGfx(); document.querySelector('[data-gsvg="tank"]').click(); return $('gfxSvg').querySelector('pre').textContent.startsWith('<svg'); });
    closeModals(); gfx.tab = 'units'; gfx.svg = null;
    step('Statistik: Produktion einer Stadt umstellen', () => { openStats(); const selEl = document.querySelector('#statCities select'); const c = S.cities[+selEl.dataset.prod]; selEl.value = c.prod === 'tank' ? 'inf' : 'tank'; selEl.dispatchEvent(new Event('change', { bubbles: true })); return c.prod === selEl.value; });
    closeModals();
    step('Menü öffnet und schließt', () => { openMenu(); const o = !$('menu').hidden; closeMenu(); return o && $('menu').hidden; });

    // Ansichten und Zeichnen
    step('Karte zeichnen', () => { draw(); return true; });
    step('Produktionsansicht (V) und zurück', () => { key('v'); const on = prodView; draw(); key('v'); return on && !prodView; });
    step('Wegeansicht (G) und zurück', () => { key('g'); const on = pathView; draw(); key('g'); return on && !pathView; });
    step('Zoom + und −', () => { const z0 = TS; setZoom(24); const t = TS; key('+'); const up = TS; key('-'); draw(); const ok = up > t && TS === t; setZoom(z0); return ok; });
    step('Zeichnen mit Auswahl, Mausfeld und Marschziel', () => { const u = mine().find(u => T(u).domain === 'land' && u.moves > 0); select(u); hover = [u.x + 1, u.y]; const c = S.cities.find(c => c.owner === 0); selCity = c.id; c.rally = [c.x + 1, c.y]; draw(); c.rally = null; return true; });
    step('Zeichnen während einer Wiedergabe (Explosion, Schriftzug)', () => { const u = mine()[0]; replay = 'normal'; animBegin(120); hooks.combat(u, { id: -5, type: 'inf', owner: 1, x: u.x, y: u.y, hp: 1 }, u.x, u.y, true); hooks.salvo(u, u.x, u.y); animEnd(); render(anim.t0 + 100); render(anim.t0 + 400); skipAnim(); replay = 'off'; return true; });

    // Tasten und Befehle
    const landU = () => mine().find(u => T(u).domain === 'land' && u.moves > 0 && !u.order && !cityAt(u.x, u.y)) || mine().find(u => T(u).domain === 'land' && u.moves > 0 && !u.order);
    step('F zentriert', () => { select(landU()); key('f'); return true; });
    step('S stellt auf Wache', () => { const u = landU(); select(u); key('s'); return !!(u.order && u.order.type === 'sentry'); });
    step('Leertaste überspringt', () => { const u = landU(); select(u); key(' '); return u.skip === true; });
    step('R schickt auf Erkundung', () => { const u = landU(), at = [u.x, u.y], top = S.log[0]; select(u); $('toast').textContent = ''; key('r'); skipAnim(); return !alive(u) || !!(u.order && u.order.type === 'explore') || u.x !== at[0] || u.y !== at[1] || S.log[0] !== top || $('toast').textContent.length > 5; });   // erkundet, zieht oder sagt, dass es nichts mehr zu erkunden gibt
    step('R ohne Unerforschtes: Meldung statt Befehl', () => { const u = landU(), keep = S.players[0].seen.slice(); S.players[0].seen.fill(1); select(u); $('toast').textContent = ''; key('r'); const r = !u.order && $('toast').textContent.length > 5; S.players[0].seen.set(keep); return r; });
    step('B in der eigenen Stadt: Meldung statt Befehl', () => { const c = S.cities.find(c => c.owner === 0); const u = createUnit('inf', 0, c.x, c.y); select(u); $('toast').textContent = ''; key('b'); const r = !u.order && $('toast').textContent.length > 5; killUnit(u); return r; });
    step('N wählt die nächste Einheit', () => { key('n'); return !!selUnit(); });
    step('P: Patrouille anlegen und mit Esc abbrechen', () => { const u = mine().find(u => u.moves > 0 && !u.order); select(u); key('p'); const on = !!patrolMode; patrolAddPoint(u.x + 2, u.y); draw(); key('Escape'); return on && !patrolMode; });
    step('P: Patrouille starten', () => { const u = mine().find(u => T(u).domain === 'sea' && u.moves > 0 && !u.order && canAttack(u.type)); if (!u) return true; select(u); key('p'); const t = DIRS.map(([dx, dy]) => [u.x + dx * 2, u.y + dy * 2]).find(([x, y]) => inb(x, y) && !S.terrain[idx(x, y)]); if (!t) { key('Escape'); return true; } patrolAddPoint(...t); key('Enter'); skipAnim(); return !patrolMode && (!alive(u) || !u.order || u.order.type === 'patrol'); });
    step('B schickt einen Jäger heim', () => { const c = S.cities.find(c => c.owner === 0); const f = createUnit('ftr', 0, c.x + 2, c.y); f.fuel = 12; select(f); key('b'); skipAnim(); const r = !alive(f) || !!f.order || isBase(f); if (alive(f)) killUnit(f); return r; });
    step('L und U am Transporter', () => { const c = S.cities.find(c => c.owner === 0 && c.coastal); const t = createUnit('trn', 0, c.x, c.y); createUnit('inf', 0, c.x, c.y); select(t); key('l'); const loading = !!(t.order && t.order.type === 'load') || cargoOf(t).length > 0; key('u'); skipAnim(); closeModals(); return loading; });
    step('Rechtsklick öffnet das Befehlsmenü', () => { const u = mine()[0]; const ok = openCtx(u.x, u.y, 200, 200); const o = ok && !$('ctxMenu').hidden && $('ctxMenu').textContent.length > 10; closeCtx(); return o && $('ctxMenu').hidden; });
    step('Rechtsklick auf eine eigene Stadt', () => { const c = S.cities.find(c => c.owner === 0); const ok = openCtx(c.x, c.y, 200, 200); closeCtx(); return ok; });
    step('H, I und T öffnen Handbuch, Statistik, Zeitraffer', () => { key('h'); const a = shown('mHelp'); closeModals(); key('i'); const b = shown('mStats'); closeModals(); key('t'); const c = shown('mTime'); closeModals(); return a && b && c; });
    step('M schaltet den Ton um und zurück', () => { key('m'); key('m'); return true; });
    step('Hinweiszeile zum Feld unter der Maus', () => { const u = mine()[0]; hover = [u.x, u.y]; updateHover(); return $('hover').textContent.length > 5; });
    step('Schummeln „Nebel aus“ und wieder an', () => { setCheatFog(true); draw(); const on = CHEAT_FOG; setCheatFog(false); return on && !CHEAT_FOG; });
    step('Einstellungen: vier Reiter, je genau einer sichtbar, jede Einstellung in einem Reiter', () => {
      openSettings('view'); let ok = true;
      const panes = [...$('mSettings').querySelectorAll('[data-setpane]')];
      for (const b of $('setTabs').querySelectorAll('button')) { b.click(); const vis = panes.filter(p => !p.hidden); ok = ok && vis.length === 1 && vis[0].dataset.setpane === b.dataset.settab && b.classList.contains('on'); }
      ok = ok && panes.length === 4 && [...$('mSettings').querySelectorAll('.set-row')].every(r => r.closest('[data-setpane]'));
      openSettings(); ok = ok && !panes.find(p => p.dataset.setpane === 'special').hidden === false;   // „Schummeln & Zurücksetzen“ wird nicht gemerkt
      closeModals(); return ok;
    });
    step('Landschaften: jede zeichnet anders, die Auswahl stimmt, zurück auf die Vorgabe', () => {
      const keep = S.land, px = () => { render(performance.now()); const c = S.cities.find(c => c.owner === 0); return [...terrainCache.getContext('2d').getImageData((c.x + 1) * TS + 2, (c.y + 1) * TS + 2, 1, 1).data].join(); };
      const seen = new Set(); let ok = true;
      for (const k of Object.keys(LANDSCAPES)) { setLandscape(k); ok = ok && S.land === k && $('landSel').value === k && !!LAND_NAMES[k]; seen.add(landscape().mini.join()); draw(); }
      setLandscape('gibtsnicht'); ok = ok && S.land === 'gruen' && JSON.stringify(Object.keys(LANDSCAPES)) === JSON.stringify(LAND_KEYS);
      setLandscape(keep); draw();
      return ok && seen.size === Object.keys(LANDSCAPES).length && $('landSel').options.length === seen.size;
    });
    step('Tastenlegende: am Griff verschieben, bleibt im Kartenbereich, Doppelklick legt zurück', () => {
      const keep = showKeys, pos0 = keyPos; setShowKeys(true); setKeyPos(null); refresh();
      const box = $('keyLegend'), col = $('mapCol'), ev = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
      const r0 = box.getBoundingClientRect(), g = box.querySelector('.kl-grip').getBoundingClientRect();
      ev(box.querySelector('.kl-grip'), 'pointerdown', g.left + 20, g.top + 5); ev(window, 'pointermove', g.left + 140, g.top - 115); ev(window, 'pointerup', g.left + 140, g.top - 115);
      const r1 = box.getBoundingClientRect();
      let ok = Math.abs(r1.left - r0.left - 120) <= 2 && Math.abs(r1.top - r0.top + 120) <= 2 && !!keyPos && !!localStorage.getItem('archipel-keys-pos');
      refresh(); const r2 = $('keyLegend').getBoundingClientRect(); ok = ok && Math.abs(r2.left - r1.left) <= 1 && Math.abs(r2.top - r1.top) <= 1;   // übersteht das Neuzeichnen
      setKeyPos({ x: 99999, y: -500 }); const r3 = box.getBoundingClientRect(), c = col.getBoundingClientRect();
      ok = ok && r3.right <= c.right + 1 && r3.top >= c.top && r3.left >= c.left && r3.bottom <= c.bottom + 1;
      box.querySelector('.kl-grip').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); const r4 = box.getBoundingClientRect();
      ok = ok && keyPos === null && Math.abs(r4.left - r0.left) <= 1 && Math.abs(r4.top - r0.top) <= 1 && !localStorage.getItem('archipel-keys-pos');
      setKeyPos(pos0); setShowKeys(keep); return ok;
    });
    step('Kopfzeile: „Ansicht“ – Schalter und Landschaften, bleibt offen, Esc schließt', () => {
      const keep = S.land, k0 = showKeys, m0 = keysMin, r0 = showRoute, p0 = showPower; $('bView').click();
      const items = () => [...$('viewMenu').querySelectorAll('[data-land]')], sw = k => $('viewMenu').querySelector('[data-view="' + k + '"]');
      let ok = !$('viewMenu').hidden && items().length === LAND_KEYS.length && items().filter(b => b.classList.contains('on')).length === 1 && $('viewMenu').querySelectorAll('[data-view]').length === 5 && !$('vPaths');
      items().find(b => b.dataset.land === 'lava').click(); draw();
      ok = ok && S.land === 'lava' && !$('viewMenu').hidden && items().find(b => b.dataset.land === 'lava').classList.contains('on');   // bleibt offen
      sw('route').click(); ok = ok && showRoute === !r0 && $('routeChk').checked === showRoute && sw('route').classList.contains('on') === showRoute; sw('route').click(); ok = ok && showRoute === r0;
      sw('power').click(); ok = ok && showPower === !p0 && $('powerChk').checked === showPower && ($('power').style.display === 'none') === !showPower; sw('power').click(); ok = ok && showPower === p0;
      setShowKeys(false); renderViewMenu(); sw('keys').click(); ok = ok && showKeys && !keysMin && !$('keyLegend').hidden && $('keysChk').checked; sw('keys').click(); ok = ok && !showKeys && $('keyLegend').hidden;
      const t0 = threatView; sw('threat').click(); ok = ok && threatView === !t0 && sw('threat').classList.contains('on') === threatView; draw(); sw('threat').click(); ok = ok && threatView === t0;
      sw('paths').click(); ok = ok && pathView && sw('paths').classList.contains('on') && !$('pathLegend').hidden; draw(); sw('paths').click(); ok = ok && !pathView && $('pathLegend').hidden;
      key('Escape'); ok = ok && $('viewMenu').hidden && S.land === 'lava';
      setLandscape(keep); setShowKeys(k0); setKeysMin(m0); draw(); return ok;
    });
    step('Tastenlegende: × klappt zum Schildchen ein, Klick klappt auf', () => {
      const k0 = showKeys, m0 = keysMin; setShowKeys(true); refresh();
      const box = $('keyLegend'); let ok = !box.hidden && !box.classList.contains('min') && !!box.querySelector('.kl-row');
      box.querySelector('.kl-x').click(); ok = ok && keysMin && showKeys && !box.hidden && box.classList.contains('min') && !!box.querySelector('.kl-open') && !box.querySelector('.kl-row');
      refresh(); ok = ok && !!$('keyLegend').querySelector('.kl-open');   // übersteht das Neuzeichnen
      const pos0 = keyPos, home = $('keyLegend').getBoundingClientRect(); setKeysMin(false); setKeyPos({ x: 300, y: 200 }); const moved = $('keyLegend').getBoundingClientRect();
      setKeysMin(true); const chip = $('keyLegend').getBoundingClientRect(); ok = ok && Math.abs(chip.left - home.left) <= 1 && Math.abs(chip.bottom - home.bottom) <= 1;   // Schildchen immer unten links
      setKeysMin(false); const back = $('keyLegend').getBoundingClientRect(); ok = ok && Math.abs(back.left - moved.left) <= 1 && Math.abs(back.top - moved.top) <= 1;   // aufgeklappt wieder an der gemerkten Stelle
      setKeyPos(pos0); setKeysMin(true);
      $('keyLegend').querySelector('.kl-open').click(); ok = ok && !keysMin && !!$('keyLegend').querySelector('.kl-row');
      setShowKeys(k0); setKeysMin(m0); return ok;
    });
    step('Neues Spiel: Landschaft vorgewählt aus den drei Startlandschaften, gewählte gilt', () => {
      let ok = true; const seen = new Set();
      for (let k = 0; k < 80; k++) { $('bNew').click(); ok = ok && shown('mNew') && START_LANDS.includes($('newLandSel').value); seen.add($('newLandSel').value); closeModals(); }
      ok = ok && seen.size === START_LANDS.length && $('newLandSel').options.length === LAND_KEYS.length;
      $('bNew').click(); $('sizeSel').value = 'klein'; $('newLandSel').value = 'alien'; $('bStart').click(); closeModals();
      ok = ok && S.land === 'alien' && S.turn === 1;
      $('bNew').click(); $('seedSame').click(); ok = ok && $('newLandSel').value === 'alien'; closeModals();
      return ok;
    });
    step('Zurücksetzen: Rückfrage, und was gelöscht würde', () => {
      saveSlot('Probe Zurücksetzen'); askReset();
      const ask = shown('mOffer') && !!$('resetSaves') && !$('resetSaves').checked; closeModals();
      const a = resetKeys(false), b = resetKeys(true);
      const r = ask && a.includes('archipel-save-v1') && !a.some(k => k.startsWith('archipel-slot')) && b.includes('archipel-slots') && b.length > a.length && b.every(k => k.startsWith('archipel-'));
      for (const m of listSlots()) if (m.name === 'Probe Zurücksetzen') deleteSlot(m.id);
      return r;
    });
    step('Enter beendet die Runde', () => { const t = S.turn; sel = null; key('Enter'); skipAnim(); closeModals(); return S.turn === t + 1 || !!S.over; });

    // Spielstände
    step('Spielstand anlegen, laden, löschen', () => { const turn = S.turn; if (!trySave('UiTest')) return false; const m = listSlots().find(s => s.name === 'UiTest'); openSaves(); const listed = $('saveList').textContent.includes('UiTest'); const okLoad = loadSlot(m.id); afterSlotLoad('geladen'); deleteSlot(m.id); return listed && okLoad && S.turn === turn && !listSlots().some(s => s.name === 'UiTest'); });
    step('Strg+S öffnet die Spielstände', () => { closeModals(); key('s', { ctrlKey: true }); const o = shown('mSaves'); closeModals(); return o; });
    if (slots0 == null) localStorage.removeItem('archipel-slots'); else localStorage.setItem('archipel-slots', slots0);

    // Spielende
    const won = await (await fetch('docs/spielstaende/beispiel-7-sieg-gegen-drei.json')).text();
    step('Abschlussfenster einer gewonnenen Partie mit Zeitraffer', () => { deserialize(won); afterSlotLoad('geladen'); const o = shown('mOver') && filled('mOver'); draw(); tlSet(Math.max(1, S.turn - 5)); closeModals(); return o; });
    step('Sprache anwenden', () => { applyLang(); return document.documentElement.lang === LANG; });
    if (muted0 != null && Sfx.isMuted && Sfx.isMuted() !== muted0) toggleSound();
    closeModals(); closeMenu(); closeCtx();
  }

  async function run() {
    fails.length = 0; passed = 0;
    await loadOrder();
    save = await (await fetch('docs/spielstaende/beispiel-2-inselreich-seekrieg.json')).text();
    deserialize(save); afterLoad(); closeModals();
    const keepReplay = replay;
    build(); farMatrix(); nearMatrix(); flows(); orders(); threat(); lupe(); tipsCheck();
    await walkthrough();
    replay = keepReplay; skipAnim(); closeModals(); startNew('klein'); closeModals(); refresh();   // am Ende eine frische Partie statt des Abschlussfensters
    return { bestanden: passed, fehlgeschlagen: fails };
  }
  return { run };
})();
