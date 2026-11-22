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
  // Suchring und Kamera: Wechselt das Spiel von selbst zur nächsten Einheit (oder Taste F), zeigt der Suchring auf sie (render),
  // nach einem Klick auf die Einheit nicht. Am Rand oder unter der Tastenlegende gilt eine Einheit nicht als gut sichtbar (wellInView).
  function locator() {
    reset();
    const a = createUnit('inf', 0, ...base.l), b = createUnit('dst', 0, ...base.s); computeVision(0);
    const frame = () => { dirty = true; render(performance.now()); };
    let t = ping.t0;
    sel = null; onTileClick(a.x, a.y, false); frame();
    check(sel === a.id && ping.t0 === t, 'Suchring: nach einem Klick auf die Einheit keiner');
    actNext(); frame();
    check(sel === b.id && ping.id === b.id && ping.t0 > t, 'Suchring: „Nächste Einheit“ zeigt auf die neue Einheit');
    t = ping.t0; frame();
    check(ping.t0 === t, 'Suchring: nur einmal je Auswahl');
    view.x += wrap.clientWidth; actFocus(); frame();
    check(ping.t0 > t && wellInView(b.x, b.y), 'Taste F: Karte auf die Einheit, Suchring noch einmal');
    // view begrenzt sich selbst auf den Rand um die Karte – deshalb an den Bildrand, der zur Kartenseite der Einheit passt
    const sx = b.x * TS + TS / 2, sy = b.y * TS + TS / 2;
    view.x = sx < S.W * TS / 2 ? sx - TS * 1.5 : sx - wrap.clientWidth + TS * 1.5;
    check(!wellInView(b.x, b.y), 'Einheit 1,5 Felder vor dem Rand: nicht gut sichtbar');
    const lg = $('keyLegend');
    if (!lg.hidden) {
      const r = lg.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      view.x = sx - (r.left - w.left + r.width / 2); view.y = sy - (r.top - w.top + r.height / 2);
      const px = w.left + sx - view.x, py = w.top + sy - view.y;
      if (px > r.left && px < r.right && py > r.top && py < r.bottom) check(!wellInView(b.x, b.y), 'Einheit unter der Tastenlegende: nicht gut sichtbar');
    }
    centerOn(b.x, b.y, true);
  }
  // Verborgene Besatzung: In einer fremden Stadt zeigt die Karte nur das Zeichen „besetzt“, die Hinweiszeile nennt weder Einheit noch
  // Siegchance, die Reichweite der Gegner färbt die Felder rundum; mit „Nebel aus“ ist alles offen.
  function garrison() {
    reset();
    const xy = scene['Stadt des Gegners'][0];
    if (!xy) { check(false, 'Besatzung: keine bekannte Stadt des Gegners im Spielstand'); return; }
    const [cx, cy] = xy, c = cityAt(cx, cy);
    const n = DIRS.map(([dx, dy]) => [cx + dx, cy + dy]).find(([x, y]) => inb(x, y) && free(x, y));
    const me = createUnit(land(...n) ? 'inf' : 'dst', 0, ...n);
    createUnit('crs', c.owner, cx, cy); createUnit('inf', c.owner, cx, cy);
    computeVision(0); select(me, false); hover = [cx, cy]; refresh(); updateHover();
    const txt = $('hover').textContent;
    check(garrisonHidden(cx, cy), 'Besatzung: fremde Stadt mit Einheiten gilt als verborgen');
    check(!txt.includes(UT.crs.name) && !txt.includes(UT.inf.name) && !txt.includes(tt('Siegchance', 'Win chance')), 'Besatzung: Hinweiszeile nennt weder Einheit noch Siegchance – ' + txt);
    check(txt.includes(tt('besetzt', 'garrisoned')), 'Besatzung: Hinweiszeile sagt „besetzt“');
    const dg = drawGarrison, dt = drawToken; let mark = 0, unit = 0;
    drawGarrison = function (o, px, py, s) { if (Math.floor(px / TS) === cx && Math.floor(py / TS) === cy) mark++; return dg(o, px, py, s); };
    drawToken = function (u, px, py, s, o) { if (Math.floor(px / TS) === cx && Math.floor(py / TS) === cy) unit++; return dt(u, px, py, s, o); };
    try { dirty = true; render(performance.now()); } finally { drawGarrison = dg; drawToken = dt; }
    check(mark === 1 && unit === 0, 'Besatzung: Karte zeigt nur das Zeichen „besetzt“');
    threatMapUi = null; const z = buildThreatMap();
    check(DIRS.every(([dx, dy]) => !inb(cx + dx, cy + dy) || !S.players[0].seen[idx(cx + dx, cy + dy)] || z[idx(cx + dx, cy + dy)] === 1), 'Besatzung: Reichweite der Gegner färbt die Felder rund um die Stadt');
    setCheatFog(true); updateHover();
    check(!garrisonHidden(cx, cy) && $('hover').textContent.includes(UT.crs.name), 'Besatzung: mit „Nebel aus“ ist alles offen');
    setCheatFog(false); hover = null; threatMapUi = null;
  }
  // Reihenfolge der Einheiten: „Nächste Einheit“ (N) nimmt die nächstgelegene, die in diesem Durchgang noch nicht dran war, und besucht alle;
  // fällt die gewählte Einheit, kommt die nächstgelegene zu ihrer letzten Stelle dran (vorher: die älteste wartende, irgendwo auf der Karte)
  function unitOrder() {
    reset();
    const [ax, ay] = base.l, d = (x, y) => cheb(ax, ay, x, y);
    const spots = all((x, y) => land(x, y) && free(x, y) && !(x === ax && y === ay)).sort((p, q) => d(...p) - d(...q));
    const near = spots.find(p => d(...p) <= 2), far = spots.find(p => d(...p) >= 6);
    if (!near || !far) { check(false, 'Reihenfolge: keine passenden Landfelder'); return; }
    const c = createUnit('inf', 0, ...far), a = createUnit('inf', 0, ax, ay), b = createUnit('inf', 0, ...near);   // c hat die kleinste Nummer
    computeVision(0); select(a, false); nextCycle = null;
    actNext(); check(sel === b.id, 'Reihenfolge: N nimmt die nächstgelegene Einheit, nicht die mit der kleinsten Nummer');
    actNext(); check(sel === c.id, 'Reihenfolge: N nimmt danach die übrige');
    actNext(); check(sel === b.id || sel === a.id, 'Reihenfolge: nach einem Durchgang beginnt N von vorn');
    select(b, false); killUnit(b, 1); afterAction(b); skipAnim(); closeModals();
    check(sel === a.id, 'Reihenfolge: fällt die Einheit, kommt die nächstgelegene zu ihrer letzten Stelle dran');
  }
  // Stufenloser Zoom: eine Raste vergrößert sofort per CSS, nach der Pause wird neu gezeichnet; der Punkt unter der Maus bleibt, wo er war.
  // Abgeschaltet: wie früher Viererschritte.
  function smoothZoomCheck() {
    const keep = smoothZoom, z0 = TS; smoothZoom = true; setZoom(30);
    const r = wrap.getBoundingClientRect(), mx = r.left + wrap.clientWidth * 0.4, my = r.top + wrap.clientHeight * 0.45;
    const at = () => { const c = cv.getBoundingClientRect(), ts = TS * (c.width / cv.width); return [(mx - c.left) / ts, (my - c.top) / ts]; };
    const wheel = dy => wrap.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, deltaMode: 0, clientX: mx, clientY: my, bubbles: true, cancelable: true }));
    const p0 = at();
    wheel(-100);
    check(TS === 30 && zoomG.s > 1.05 && Math.abs(at()[0] - p0[0]) < 0.02, 'Stufenloser Zoom: sofort per CSS vergrößert, Punkt unter der Maus bleibt');
    zoomCommit();
    const p1 = at();
    check(TS > 30 && TS < 36 && zoomG.s === 1 && Math.abs(p1[0] - p0[0]) < 0.05 && Math.abs(p1[1] - p0[1]) < 0.05, 'Stufenloser Zoom: neu gezeichnet, Punkt unter der Maus bleibt');
    // Kein Zurückfahren: Jede Raste endet auf genau der Größe, die danach gezeichnet wird (vorher bei der Hälfte der Stufen bis 2 % kleiner)
    const off = [];
    for (const dy of [-100, 100]) for (let ts = ZOOM_MIN; ts <= ZOOM_MAX; ts++) {
      setZoom(ts); wheel(dy); const end = TS * zoomG.s; zoomCommit();
      if (Math.abs(end - TS) > 1e-6) off.push(ts + (dy < 0 ? '+' : '−'));
    }
    check(!off.length, 'Stufenloser Zoom: Mausrad gleitet genau auf die gezeichnete Größe' + (off.length ? ' – nicht bei ' + off.join(' ') : ''));
    smoothZoom = false; setZoom(30); wheel(-100);
    check(TS === 34, 'Stufenloser Zoom aus: Viererschritte wie bisher');
    smoothZoom = keep; setZoom(z0);
  }
  // Kartenrand: jede Wahl setzt die Gestaltung, der Schmuck liegt neben der Karte (nie darauf), Auswahl unter „Ansicht“ und gemerkt
  function borderCheck() {
    const keep = curBorder(), mx0 = pad.x, my0 = pad.y, mx1 = pad.x + cv.width, my1 = pad.y + cv.height;
    const store = gfxSet() === 'insel' ? 'archipel-border' : 'archipel-border-' + gfxSet();
    for (const k of BORDER_KEYS) {
      setBorder(k);
      const deco = [...$('padDeco').children], onMap = deco.filter(d => { const x = parseFloat(d.style.left), y = parseFloat(d.style.top); return x > mx0 && x < mx1 && y > my0 && y < my1; });
      check($('mapPad').classList.contains('b-' + k) && localStorage.getItem(store) === k, `Kartenrand ${k}: gesetzt und gemerkt`);
      check(k === 'seekarte' ? deco.length >= 4 : k === 'weltall' ? deco.length > 0 : deco.length === 0, `Kartenrand ${k}: Schmuck (${deco.length})`);
      check(!onMap.length, `Kartenrand ${k}: kein Schmuck auf der Karte`);
    }
    openLook(); $('lookBorders').querySelector('[data-lborder="weltall"]').click();
    check(curBorder() === 'weltall' && $('lookBorders').querySelector('[data-lborder="weltall"]').classList.contains('on'), 'Kartenrand: Auswahl im Fenster „Aussehen der Karte“');
    closeModals(); setBorder(keep);
  }
  // Grafik-Sets: Die Landschaft „Asteroiden“ bringt Weltraum-Bilder für Einheiten und Städte mit; der Kartenrand wird je Set gemerkt,
  // die Partie speichert die Landschaft (und damit das Set) mit
  function spaceSet() {
    const keepLand = landPref, keepS = S.land, keepB = Object.assign({}, borderPrefs);
    const keepStore = ['archipel-border', 'archipel-border-weltraum', 'archipel-border-segel'].map(k => [k, localStorage.getItem(k)]);
    setLandscape('gruen');
    const ship = unitSprite('crs', 0, 30), city = citySprite(0, 30, 0), icon = iconUrl('u', 'crs');   // (Bildspeicher wird beim Neuzeichnen geleert: Bilder über toDataURL vergleichen)
    setLandscape('asteroiden');
    check(gfxSet() === 'weltraum' && S.land === 'asteroiden', 'Grafik-Set: Asteroiden gehören zum Weltraum');
    check(unitSprite('crs', 0, 30).toDataURL() !== ship.toDataURL() && citySprite(0, 30, 0).toDataURL() !== city.toDataURL() && iconUrl('u', 'crs') !== icon, 'Grafik-Set: eigene Bilder für Einheiten, Städte und Seitenleiste');
    check(UNIT_ORDER.every(k => ICON_SPACE[k] && unitSvg(k, 0, true, '', 'weltraum') !== unitSvg(k, 0, true, '', 'insel')), 'Grafik-Set: jede Einheit hat ein Weltraum-Bild (auch als SVG)');
    check(Sfx.kindOf('crs') === 'sdrive' && Sfx.kindOf('sub') === 'cloak' && Sfx.kindOf('ftr') === 'jet' && Sfx.kindOf('tank') === 'rover' && Sfx.kindOf('inf') === 'march', 'Grafik-Set: Weltraum-Klänge (Triebwerk, Tarnschiff, Raumjäger, Rover)');
    check($('mapPad').classList.contains('b-' + borderPrefs.weltraum) && $('setSel').value === 'weltraum', 'Grafik-Set: Kartenrand des Weltraums');
    setBorder('holz');
    check(localStorage.getItem('archipel-border-weltraum') === 'holz' && borderPrefs.insel === keepB.insel, 'Grafik-Set: Rand je Set gemerkt');
    setLandscape('gruen');
    check(gfxSet() === 'insel' && $('mapPad').classList.contains('b-' + keepB.insel) && $('setSel').value === 'insel' && unitSprite('crs', 0, 30).toDataURL() === ship.toDataURL(), 'Grafik-Set: zurück zur Inselwelt, Bilder und Rand wie vorher');
    openViewMenu();
    check(viewMenu.querySelectorAll('[data-set]').length === 3 && !viewMenu.querySelector('[data-land], [data-border]') && !!viewMenu.querySelector('[data-look]'), 'Grafik-Set: unter „Ansicht“ nur die drei Sets und der Weg ins Fenster');
    viewMenu.querySelector('[data-set="weltraum"]').click();
    check(gfxSet() === 'weltraum' && S.land === SET_LAND.weltraum && curBorder() === BORDER_DEFAULT.weltraum && viewMenu.querySelector('[data-set="weltraum"]').classList.contains('on'), 'Grafik-Set: Set unter „Ansicht“ wählt Klimazonen-Variante und passenden Rand');
    viewMenu.querySelector('[data-look]').click();
    check(!$('mLook').hidden && viewMenu.hidden && [...$('lookLands').querySelectorAll('[data-lland]')].map(b => b.dataset.lland).join() === landsOf('weltraum').join()
      && $('lookLands').querySelector('.on').dataset.lland === S.land && $('lookBorders').querySelector('.on').dataset.lborder === curBorder(), 'Grafik-Set: Fenster „Aussehen der Karte“ zeigt die Landschaften des Sets');
    $('lookLands').querySelector('[data-lland="eis"]').click(); $('lookBorders').querySelector('[data-lborder="holz"]').click();
    check(S.land === 'eis' && curBorder() === 'holz' && $('lookLands').querySelector('.on').dataset.lland === 'eis' && $('lookBorders').querySelector('.on').dataset.lborder === 'holz', 'Grafik-Set: im Fenster Landschaft und Rand einzeln wählbar');
    $('lookSets').querySelector('[data-lset="segel"]').click();
    check(S.land === SET_LAND.segel && curBorder() === BORDER_DEFAULT.segel && $('setSel').value === 'segel' && !!$('lookSets').querySelector('[data-lset="segel"].on'), 'Grafik-Set: Set im Fenster wählt Klimazonen-Variante und Rand');
    closeModals();
    for (const k of SET_KEYS) { $('setSel').value = k; $('setSel').onchange({ target: $('setSel') }); check(gfxSet() === k && S.land === SET_LAND[k] && curBorder() === BORDER_DEFAULT[k], `Grafik-Set: Einstellungen → ${k}`); }
    setLandscape('asteroiden');
    const save = serialize(); S.land = 'gruen'; deserialize(save);
    check(S.land === 'asteroiden', 'Grafik-Set: die Partie speichert die Landschaft mit');
    for (const k of ['land', 'units']) { gfx.tab = k; openGfx(); }
    check(gfx.set === 'weltraum' && !!$('mGfx').querySelector('[data-gset="weltraum"].on'), 'Grafik-Set: Grafik-Übersicht zeigt das Set der Partie');
    closeModals(); gfx.tab = 'units';
    // Asteroidengürtel: alle vier Arten auf einer Karte, Eisen nahe der Sonne, Eis gegenüber, gleiche Nummer = gleiches Bild; Sonne neben der Karte
    setLandscape('guertel'); setBorder('weltall');
    const z = beltMap(), n = [0, 0, 0, 0], d = [[], [], [], []];
    for (let i = 0; i < z.length; i++) if (S.terrain[i]) { n[z[i]]++; d[z[i]].push(sunDist(i % S.W, (i / S.W) | 0)); }
    const avg = a => a.reduce((p, q) => p + q, 0) / (a.length || 1);
    check(n.every(v => v > 0) && gfxSet() === 'weltraum', `Asteroidengürtel: alle Arten auf der Karte (Gestein/Eisen/Eis/Kristall ${n.join('/')})`);
    check(avg(d[1]) < avg(d[0]) && avg(d[0]) < avg(d[2]), 'Asteroidengürtel: Eisen nahe der Sonne, Eis weit weg');
    beltCache = null;
    check(beltMap().join() === z.join() && LANDSCAPES[BELT_KEYS[z[S.terrain.indexOf(1)]]].space, 'Asteroidengürtel: aus der Kartennummer, Farbsätze des Weltraums');
    const sun = $('padDeco').querySelector('.sun'), sx = sun && parseFloat(sun.style.left), sy = sun && parseFloat(sun.style.top);
    check(!!sun && !(sx > pad.x && sx < pad.x + cv.width && sy > pad.y && sy < pad.y + cv.height), 'Asteroidengürtel: Sonne neben der Karte');
    setLandscape('asteroiden');
    check(!$('padDeco').querySelector('.sun'), 'Asteroiden ohne Gürtel: keine Sonne');
    // Segelzeit: Alte Karte mit Segelschiffen, Kavallerie und Festungsstädten, Rand „Alte Seekarte“; eigene Bilder je Einheit
    setLandscape('altkarte');
    check(gfxSet() === 'segel' && curBorder() === (keepB.segel || 'seekarte') && $('mapPad').classList.contains('b-' + curBorder()), 'Segelzeit: Alte Karte gehört dazu, Rand der Segelzeit');
    check(UNIT_ORDER.every(k => ICON_SAIL[k] && unitSvg(k, 0, true, '', 'segel') !== unitSvg(k, 0, true, '', 'insel') && unitSvg(k, 0, true, '', 'segel') !== unitSvg(k, 0, true, '', 'weltraum')), 'Segelzeit: jede Einheit hat ein eigenes Bild');
    check(citySprite(-1, 30, 0).toDataURL() !== citySprite(-1, 30, 0, 'insel').toDataURL(), 'Segelzeit: Festungsstädte');
    check(Sfx.kindOf('tank') === 'hooves' && Sfx.kindOf('ftr') === 'burner' && Sfx.kindOf('bat') === 'sail' && Sfx.kindOf('sub') === 'sail', 'Segelzeit: eigene Klänge (Hufschlag, Ballon, Segelschiffe)');
    { const bad = Sfx.kinds().filter(k => { const b = Sfx.buffer(k.kind), d = b && b.getChannelData(0); if (!d) return true; let pk = 0; for (let i = 0; i < d.length; i += 7) { if (!isFinite(d[i])) return true; pk = Math.max(pk, Math.abs(d[i])); } return pk < 0.5; });
      openSoundTest(); check(!bad.length && $('sndRows').querySelectorAll('.snd-set').length === 3 && $('sndRows').querySelectorAll('[data-loop]').length === Sfx.kinds().length
        && $('sndRows').querySelector('.snd-set .muted').closest('tr').textContent.includes(SET_NAMES.segel), `Klangtest: alle Klänge erzeugt und nach Sets gruppiert${bad.length ? ' – fehlerhaft: ' + bad.map(k => k.kind).join(', ') : ''}`); closeModals(); }
    // Klimazonen der alten Karte: Verteilung wie bei den Inseln, aber mit den Farbsätzen der Segelzeit
    setLandscape('altzonen');
    const zk = new Set(); for (let i = 0; i < S.W * S.H; i++) if (S.terrain[i]) zk.add(tileLandscape(i));
    check(gfxSet() === 'segel' && [...zk].every(L => L.set === 'segel') && zk.has(LANDSCAPES.altpolar) && zk.has(LANDSCAPES.altwueste), `Segelzeit: Klimazonen mit Eismeer und Wüste (${zk.size} Arten)`);
    setLandscape('altkarte');
    openViewMenu(); check(!!viewMenu.querySelector('[data-set="segel"].on'), 'Segelzeit: unter „Ansicht“ als Set markiert'); closeViewMenu();
    setLandscape('asteroiden');
    Object.assign(borderPrefs, keepB); for (const [k, v] of keepStore) { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    setLandscape(keepLand); S.land = keepS; buildTerrainCache(); refresh();
  }
  // Gestauchte Wiedergabe (lange Gegnerzüge): Auch versenkte Einheiten verschwinden im gestauchten Takt – vorher blieben sie bis zu ihrem
  // ungestauchten Zeitpunkt stehen (ein Kreuzer fuhr auf das Feld des versenkten Zerstörers, der erst danach verschwand)
  function goneScale() {
    reset();
    const a = all((x, y) => !land(x, y) && free(x, y))[0], u = createUnit('dst', 0, ...a);
    replay = 'normal'; animBegin(ENEMY_STEP_MS, true);
    for (let i = 0; i < 60; i++) { anim.events.push({ type: 'move', id: -1, utype: 'dst', owner: 1, fx: a[0], fy: a[1], tx: a[0], ty: a[1], t0: anim.cursor, dur: anim.speed }); anim.cursor += anim.speed; }
    recGone(u, anim.cursor + 280);
    anim.events.push({ type: 'boom', x: a[0], y: a[1], t0: anim.cursor, dur: 650, win: 'att' });
    const boom = anim.events[anim.events.length - 1];
    animEnd(3500);
    check(anim.gone[0].until <= boom.t0 + boom.dur, 'Wiedergabe gestaucht: die versenkte Einheit verschwindet in der Explosion');
    skipAnim(); replay = 'off'; killUnit(u);
  }
  // Luftdeckung in der Wiedergabe: Der Ring folgt dem fahrenden Träger – vorher wartete er schon am Zielort (S.units kennt nur den Endstand)
  function coverRing() {
    reset();
    const water = (x, y) => inb(x, y) && !land(x, y) && free(x, y) && DIRS.every(([dx, dy]) => inb(x + dx, y + dy) && !land(x + dx, y + dy));
    const a = all((x, y) => water(x, y) && water(x + 1, y))[0];
    if (!a) { check(false, 'Luftdeckung: kein offenes Meer im Spielstand'); return; }
    const car = createUnit('car', 0, ...a); createUnit('ftr', 0, ...a).carrier = car.id;
    computeVision(0); select(car, false);
    replay = 'normal'; doMove(car, a[0] + 1, a[1]);
    const mv = anim.events.find(e => e.type === 'move'), o = drawSupportMark, at = [];
    drawSupportMark = function (x, y, ...r) { at.push([x, y]); return o(x, y, ...r); };
    const ringAt = t => { at.length = 0; render(anim.t0 + t); return at.map(p => p.join(',')).join(' '); };
    try {
      check(ringAt(mv.t0 - 5) === a.join(','), 'Luftdeckung: vor der Fahrt am Startfeld');
      check(ringAt(mv.t0 + mv.dur / 2) === (a[0] + 0.5) + ',' + a[1], 'Luftdeckung: unterwegs mit dem Träger');
      check(ringAt(mv.t0 + mv.dur + 5) === (a[0] + 1) + ',' + a[1], 'Luftdeckung: am Ziel');
    } finally { drawSupportMark = o; skipAnim(); replay = 'off'; }
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
  // Sicherer Anfang: Die Zeile über der Karte nennt 100 % und den richtigen Grund (nicht das Schlachtschiff)
  function safeStartLine() {
    reset();
    for (const c of S.cities) if (c.owner === 0 && S.cities.filter(k => k.owner === 0).length > 1) c.owner = -1;   // nur eine eigene Stadt
    const c = S.cities.filter(k => k.owner < 0).find(k => DIRS.some(([dx, dy]) => inb(k.x + dx, k.y + dy) && land(k.x + dx, k.y + dy) && free(k.x + dx, k.y + dy)));
    const spot = DIRS.map(([dx, dy]) => [c.x + dx, c.y + dy]).find(([x, y]) => inb(x, y) && land(x, y) && free(x, y));
    const u = createUnit('inf', 0, ...spot); computeVision(0); select(u, false); hover = [c.x, c.y]; updateHover();
    const t = $('hover').textContent;
    check(/100 %/.test(t) && /ersten beiden neutralen Städte/.test(t) && !/Schlachtschiff/.test(t), 'Sicherer Anfang: Hinweiszeile nennt 100 % und den Grund – „' + t + '“');
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
  // Die Attrappen enthalten keinen eingesetzten Text, nur ihren eigenen Namen als Bezeichner und die Nummer des Skripts: Sie melden [Nummer, Name],
  // den Meldungstext baut once() hier draußen zusammen. Vorher wurde Text mit JSON.stringify in den Skriptcode gesetzt – CodeQL bemängelte die
  // Maskierung (#7, #8 „Improper code sanitization“, danach #9 „Incomplete string escaping“); ohne eingesetzten Text gibt es nichts zu maskieren.
  async function loadOrder() {
    let html = await (await fetch('index.html', { cache: 'no-store' })).text();
    const files = [...html.matchAll(/<script src="(js\/[\w-]+\.js)"><\/script>/g)].map(m => m[1]);
    const fnOf = {};
    for (const f of files) for (const m of (await (await fetch(f, { cache: 'no-store' })).text()).matchAll(/^(?:async )?function (\w+)/gm)) fnOf[m[1]] = f;
    html = html.replace(/<script src="js\/[\w-]+\.js"><\/script>\s*/g, '');
    let tags = '<script>window.__fwd = []; window.__err = []; window.addEventListener("error", e => window.__err.push(e.message));<\/script>';
    files.forEach((f, k) => {
      const later = Object.keys(fnOf).filter(n => files.indexOf(fnOf[n]) > k);
      tags += '<script>' + later.map(n => `var ${n} = function ${n}() { window.__fwd.push([${k}, ${n}.name]); throw new ReferenceError(${n}.name); };`).join('') + '<' + '/script>';
      tags += `<script src="${f}"><\/script>`;
    });
    html = html.replace('</body>', tags + '</body>');
    const once = async name => {
      const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-3000px;width:1200px;height:900px';
      document.body.append(fr); fr.srcdoc = html;
      await new Promise(r => { fr.onload = r; }); await new Promise(r => setTimeout(r, 1200));
      const w = fr.contentWindow, fwd = [...new Set(w.__fwd.map(([k, n]) => files[k] + ' ruft beim Laden ' + n + '() aus ' + fnOf[n]))];
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
    step('Zoom + und − (stufenlos: Neuzeichnen nach der Pause, hier sofort mit zoomCommit)', () => { const z0 = TS; setZoom(24); const t = TS; key('+'); zoomCommit(); const up = TS; key('-'); zoomCommit(); draw(); const ok = up > t && TS === t; setZoom(z0); return ok; });
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
      for (const k of Object.keys(LANDSCAPES)) { setLandscape(k); ok = ok && S.land === k && !!LAND_NAMES[k]; seen.add(landscape().mini.join()); draw(); }
      setLandscape('gibtsnicht'); ok = ok && S.land === DEFAULT_LAND && JSON.stringify(Object.keys(LANDSCAPES)) === JSON.stringify(LAND_KEYS);
      setLandscape(keep); draw();
      return ok && seen.size === Object.keys(LANDSCAPES).length && SET_KEYS.reduce((n, k) => n + landsOf(k).length, 0) === seen.size;
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
    step('Kopfzeile: „Ansicht“ – Schalter und Grafik-Sets, bleibt offen, Esc schließt', () => {
      const keep = S.land, b0 = Object.assign({}, borderPrefs), s0 = localStorage.getItem('archipel-border-segel'), k0 = showKeys, m0 = keysMin, r0 = showRoute, p0 = showPower; $('bView').click();
      const items = () => [...$('viewMenu').querySelectorAll('[data-set]')], sw = k => $('viewMenu').querySelector('[data-view="' + k + '"]');
      let ok = !$('viewMenu').hidden && items().length === SET_KEYS.length && items().filter(b => b.classList.contains('on')).length === 1 && $('viewMenu').querySelectorAll('[data-view]').length === 5 && !$('vPaths');
      items().find(b => b.dataset.set === 'segel').click(); draw();
      ok = ok && S.land === SET_LAND.segel && !$('viewMenu').hidden && items().find(b => b.dataset.set === 'segel').classList.contains('on');   // bleibt offen
      sw('route').click(); ok = ok && showRoute === !r0 && $('routeChk').checked === showRoute && sw('route').classList.contains('on') === showRoute; sw('route').click(); ok = ok && showRoute === r0;
      sw('power').click(); ok = ok && showPower === !p0 && $('powerChk').checked === showPower && ($('power').style.display === 'none') === !showPower; sw('power').click(); ok = ok && showPower === p0;
      setShowKeys(false); renderViewMenu(); sw('keys').click(); ok = ok && showKeys && !keysMin && !$('keyLegend').hidden && $('keysChk').checked; sw('keys').click(); ok = ok && !showKeys && $('keyLegend').hidden;
      const t0 = threatView; sw('threat').click(); ok = ok && threatView === !t0 && sw('threat').classList.contains('on') === threatView; draw(); sw('threat').click(); ok = ok && threatView === t0;
      sw('paths').click(); ok = ok && pathView && sw('paths').classList.contains('on') && !$('pathLegend').hidden; draw(); sw('paths').click(); ok = ok && !pathView && $('pathLegend').hidden;
      key('Escape'); ok = ok && $('viewMenu').hidden && S.land === SET_LAND.segel;
      Object.assign(borderPrefs, b0); if (s0 === null) localStorage.removeItem('archipel-border-segel'); else localStorage.setItem('archipel-border-segel', s0); setLandscape(keep); setShowKeys(k0); setKeysMin(m0); draw(); return ok;
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
    step('Vorzeitiges Ende: kein Angebot, solange die meisten Städte neutral sind oder der Gegner unentdeckt ist', () => {
      const keepS = serialize(), pct0 = offerPct; offerPct = 20; closeModals();
      const P = S.players[0], own = S.cities.map(c => c.owner), known0 = P.knownOwner.slice();
      const arm = () => { S.turn = Math.max(S.turn, 40); S.offerPause = 0; S.over = null; S.hist = Array.from({ length: 6 }, (_, k) => ({ t: S.turn - 5 + k, c: S.players.map((_, p) => (p === 0 ? 9 : p === 1 ? 1 : 0)), n: 0 })); closeModals(); };
      const offered = () => { maybeOfferEnd(); const o = shown('mEnd'); closeModals(); return o; };
      // 1) fast alles neutral (wie im Spielstand des Nutzers: Runde 38, 84 %, 47 von 56 Städten neutral)
      S.cities.forEach((c, k) => { c.owner = k < 3 ? 0 : k === 3 ? 1 : -1; }); P.knownOwner.fill(-1); arm();
      let ok = !offered();
      // 2) genug Städte vergeben, aber der Gegner ist noch nicht gefunden
      S.cities.forEach((c, k) => { c.owner = k % 3 === 0 ? 1 : 0; }); arm(); ok = ok && !offered();
      // 3) Gegner bekannt: jetzt kommt das Angebot
      const foe = S.cities.find(c => c.owner === 1); P.knownOwner[foe.id] = 1; arm(); ok = ok && offered();
      // 4) Aufgeben braucht keine Entdeckung, aber dieselbe Grenze bei den neutralen Städten
      const lose = () => S.hist.forEach(e => { e.c = S.players.map((_, p) => (p === 0 ? 1 : p === 1 ? 9 : 0)); });
      P.knownOwner.fill(-1); arm(); lose(); ok = ok && offered();
      S.cities.forEach((c, k) => { c.owner = k < 3 ? 1 : k === 3 ? 0 : -1; }); arm(); lose(); ok = ok && !offered();
      S.cities.forEach((c, k) => { c.owner = own[k]; }); deserialize(keepS); afterLoad(); closeModals(); offerPct = pct0; replay = 'off';
      return ok;
    });
    step('Kräfteverhältnis: Balken öffnet das Kräftefenster, Kurve und Knopf darin den Zeitraffer', () => {
      closeModals(); if (S.over) return true;
      $('powerFoot').click(); let ok = !$('mTime').hidden && $('mPower').hidden; closeModals();
      $('power').querySelector('.power-bar').click(); ok = ok && !$('mPower').hidden && $('mTime').hidden;
      $('powerCalc').querySelector('[data-tl]').click(); ok = ok && !$('mTime').hidden && $('mPower').hidden; closeModals();
      return ok;
    });
    step('Kräfteverhältnis: Balken nach Städten, neutrale grau, alter Spielstand bekommt seinen Verlauf aus dem Zeitraffer', () => {
      const keep = serialize(); closeModals();
      const segs = () => [...$('powerSegs').children].map(i => i.style.width ? parseFloat(i.style.width) : 0);
      updatePower(); const cc = cityCounts(), w = segs();
      let ok = w.length >= 2 && Math.abs(w.reduce((a, b) => a + b, 0) - 100) < 0.5 && /repeating-linear-gradient/.test($('powerSegs').lastElementChild.style.background) === (cc.n > 0);
      ok = ok && Math.abs(w[0] - cc.c[0] / S.cities.length * 100) < 0.5 && [...$('powerSegs').children].every(i => !i.textContent);   // ohne Zahlen
      // alter Spielstand: Verlauf mit Stärkewerten statt Städten → beim Laden aus dem Zeitraffer nachgerechnet
      const o = JSON.parse(keep), st = o.S || o; st.hist = [{ t: 1, me: 300, en: 100, all: [300, 100] }];
      deserialize(JSON.stringify(o)); afterLoad(); closeModals();
      ok = ok && S.hist.length > 1 && S.hist.every(e => Array.isArray(e.c)) && S.hist[S.hist.length - 1].c[0] === cityCounts().c[0];
      updatePower(); ok = ok && !!$('powerVerdict').textContent;
      openPower(); ok = ok && /neutral/.test($('powerCalc').textContent) && !$('spoilerChk'); closeModals();
      deserialize(keep); afterLoad(); closeModals(); replay = 'off';
      return ok;
    });
    step('Klimazonen: Schnee oben und unten, Wüste in der Mitte, Inseln einfarbig, Ausschnitt wie die Karte', () => {
      const keep = serialize(); closeModals();
      startNew('mittel', 'normal', 'kontinente', 4711, 1, 'zonen'); closeModals();
      const z = zoneMap(), W = S.W, H = S.H, land = i => S.terrain[i] === 1, n = [0, 0, 0, 0];
      for (let i = 0; i < z.length; i++) if (land(i)) n[z[i]]++;
      const rowZone = y => { const c = [0, 0, 0, 0]; for (let x = 0; x < W; x++) if (land(y * W + x)) c[z[y * W + x]]++; return c; };
      let ok = n.every(v => v > 0) && rowZone(2)[2] > rowZone(2)[1] && rowZone(Math.floor(H / 2))[1] > rowZone(Math.floor(H / 2))[2];
      // gleiche Kartennummer, gleiches Bild
      const a = zoneMap().join(); startNew('mittel', 'normal', 'kontinente', 4711, 1, 'zonen'); closeModals(); ok = ok && zoneMap().join() === a;
      // Inselreich: jede kleine Insel hat nur eine Zone
      startNew('mittel', 'normal', 'inseln', 4711, 1, 'zonen'); closeModals();
      const zi = zoneMap(), per = new Map(); let total = 0;
      for (let i = 0; i < zi.length; i++) if (S.terrain[i]) { total++; const k = S.cont[i]; if (!per.has(k)) per.set(k, { n: 0, z: new Set() }); per.get(k).n++; per.get(k).z.add(zi[i]); }
      for (const v of per.values()) if (v.n < total * 0.15 && v.z.size !== 1) ok = false;
      const islZ = new Set([...per.values()].filter(v => v.n < total * 0.15).map(v => [...v.z][0]));
      ok = ok && islZ.has(2) && islZ.has(1) && islZ.has(0);   // Rangfolge: jede Inselkarte hat Schnee-, Wüsten- und grüne Inseln
      // Ausschnitt (Lupe) zeigt dieselben Farben wie die ganze Karte
      const ts = 24, full = buildTerrain(ts), c = S.cities.find(k => k.owner === 0), x0 = Math.max(0, c.x - 3), y0 = Math.max(0, c.y - 3), w = Math.min(7, W - x0), h = Math.min(7, H - y0);
      const sub = (src, T) => { const r = new T(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) r[y * w + x] = src[(y0 + y) * W + x0 + x]; return r; };
      const part = buildTerrain(ts, { W: w, H: h, ox: x0, oy: y0, over: false, terrain: sub(S.terrain, Uint8Array), depth: sub(S.depth, Uint8Array), elev: sub(S.elev, Float32Array), cityGrid: sub(S.cityGrid, Int16Array) });
      const A = full.getContext('2d').getImageData((x0 + 3) * ts + 3, (y0 + 3) * ts + 3, ts - 6, ts - 6).data, B = part.getContext('2d').getImageData(3 * ts + 3, 3 * ts + 3, ts - 6, ts - 6).data;
      let d = 0; for (let i = 0; i < A.length; i++) d += Math.abs(A[i] - B[i]);
      ok = ok && d / A.length < 6;
      deserialize(keep); afterLoad(); closeModals(); replay = 'off';
      return ok;
    });
    step('Neues Spiel: beginnt nah herangezoomt, die Startstadt in der Bildmitte', () => {
      setZoom(16); startNew('klein'); closeModals(); camStep(performance.now() + 5000);
      const u = selUnit(), r = cv.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      const ux = r.left + (u.x + 0.5) * TS, uy = r.top + (u.y + 0.5) * TS;
      return TS === START_ZOOM && Math.abs(ux - (w.left + w.width / 2)) < TS * 2 && Math.abs(uy - (w.top + w.height / 2)) < TS * 2;
    });
    step('Landschaft: eine Einstellung – gilt für die laufende und neue Partien, gespeicherte behalten ihre', () => {
      const keep = landPref, store = localStorage.getItem('archipel-landscape'), save = serialize();
      setLandscape('schnee');
      let ok = landPref === 'schnee' && S.land === 'schnee' && localStorage.getItem('archipel-landscape') === 'schnee' && !$('landDefSel') && !$('newLandSel');
      $('bNew').click(); $('sizeSel').value = 'klein'; $('bStart').click(); closeModals();
      ok = ok && S.land === 'schnee' && S.turn === 1;                       // neue Partie
      const o = JSON.parse(save); (o.S || o).land = 'lava'; deserialize(JSON.stringify(o)); afterLoad(); closeModals();
      ok = ok && S.land === 'lava' && landPref === 'schnee';                 // geladene Partie zeigt ihre gespeicherte Landschaft, die Einstellung bleibt
      openSettings('view'); ok = ok && $('setSel').value === 'insel'; closeModals(); openLook(); ok = ok && $('lookLands').querySelector('.on').dataset.lland === 'lava'; closeModals();
      $('bNew').click(); $('sizeSel').value = 'klein'; $('bStart').click(); closeModals(); ok = ok && S.land === 'schnee';
      setLandscape(keep); if (store === null) localStorage.removeItem('archipel-landscape');
      deserialize(save); afterLoad(); closeModals(); replay = 'off';
      return ok && DEFAULT_LAND === 'zonen';
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
    const pref0 = landPref, prefStore0 = localStorage.getItem('archipel-landscape');   // die Landschafts-Einstellung des Testbrowsers bleibt erhalten
    await loadOrder();
    save = await (await fetch('docs/spielstaende/beispiel-2-inselreich-seekrieg.json')).text();
    deserialize(save); afterLoad(); closeModals();
    const keepReplay = replay;
    build(); farMatrix(); nearMatrix(); flows(); locator(); garrison(); coverRing(); goneScale(); smoothZoomCheck(); borderCheck(); spaceSet(); unitOrder(); orders(); threat(); lupe(); safeStartLine(); tipsCheck();
    await walkthrough();
    landPref = pref0; if (prefStore0 === null) localStorage.removeItem('archipel-landscape'); else localStorage.setItem('archipel-landscape', prefStore0);
    replay = keepReplay; skipAnim(); closeModals(); startNew('klein', null, null, null, 0, landPref); closeModals(); refresh();   // am Ende eine frische Partie statt des Abschlussfensters
    return { bestanden: passed, fehlgeschlagen: fails };
  }
  return { run };
})();
