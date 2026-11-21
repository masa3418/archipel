'use strict';
// ---------------------------------------------------------------------------
// Oberfläche, Teil 1 von 7 – Karte: Grundlagen, Aufzeichnung der Animationen, Kamera, Zeichnen der Karte (render), Produktions- und Wegeansicht.
// Die Teile ui-karte.js → ui-zug.js → ui-leiste.js → ui-fenster.js → ui-eingabe.js → ui-schau.js → ui-start.js werden in dieser Reihenfolge geladen und teilen sich
// den globalen Namensraum (wie alle Skripte). Was beim Laden sofort läuft, darf nur Funktionen aus diesem oder einem früheren Teil aufrufen.
// ---------------------------------------------------------------------------

const $ = id => document.getElementById(id);
// War das Willkommensfenster schon zu sehen (also kein allererster Besuch)? Steht hier vorn, weil Tastenlegende und Einstiegstipps
// es schon beim Laden fragen – eine Funktion aus einem späteren Teil gäbe es da noch nicht.
function welcomeSeen() { try { return localStorage.getItem('archipel-welcome') === '1'; } catch (e) { return true; } }
const cv = $('map');
// Die Zeichenfunktionen der Karte (drawToken, drawEffect, drawRoute …) zeichnen auf ctx in der Kachelgröße TS. Die Grafik-Übersicht
// leitet beide mit drawOn kurz auf eine eigene kleine Leinwand um – deshalb let. Neue Zeichenfunktionen ebenso über ctx/TS schreiben.
let ctx = cv.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
const wrap = $('mapWrap');
// Rand um die Karte: Rings um die Leinwand liegt ein leerer Streifen von einer halben Fensterbreite/-höhe (#mapPad), damit sich auch
// Felder am Kartenrand in die Bildmitte holen lassen (Start am Rand lag sonst am Bildrand, unten links unter der Tastenlegende).
// view.x / view.y = Kartenpixel an der linken oberen Ecke des Sichtfensters (darf negativ sein) – immer darüber rechnen,
// nie direkt mit wrap.scrollLeft / scrollTop.
const pad = { x: 0, y: 0 };
const view = {
  get x() { return wrap.scrollLeft - pad.x; }, set x(v) { wrap.scrollLeft = v + pad.x; },
  get y() { return wrap.scrollTop - pad.y; }, set y(v) { wrap.scrollTop = v + pad.y; },
};
function applyPad() {
  const x = view.x, y = view.y;   // Ausschnitt halten, wenn sich die Fenstergröße ändert
  pad.x = Math.floor(wrap.clientWidth / 2); pad.y = Math.floor(wrap.clientHeight / 2);
  const box = $('mapPad');
  box.style.width = cv.width + pad.x * 2 + 'px'; box.style.height = cv.height + pad.y * 2 + 'px';
  cv.style.left = pad.x + 'px'; cv.style.top = pad.y + 'px';
  view.x = x; view.y = y;
}
window.addEventListener('resize', () => { if (S) { applyPad(); dirty = true; } });

let TS = 28;            // Kachelgröße in Pixeln
let sel = null;         // ausgewählte Einheit (id)
let selCity = null;     // ausgewählte Stadt (id)
let hover = null;       // [x,y]
let patrolMode = null;  // { id, pts: [[x,y],...] } während Wegpunkte gesetzt werden
let terrainCache = null;
let dirty = true;
const fogC = document.createElement('canvas');
const fogG = fogC.getContext('2d');

function ownerPal(o) { return o >= 0 ? PLAYERS[o] : NEUTRAL; }

function buildTerrainCache() {
  clearSprites();
  terrainCache = buildTerrain(TS);
}

// ------------------------------------------------------------------ Animationen
// Während einer Aktion (oder des gegnerischen Zugs) werden sichtbare Bewegungen
// und Kämpfe aufgezeichnet und anschließend als Zeitleiste abgespielt.
// gone: Einheiten, die während der Aufzeichnung vernichtet wurden oder in einer Stadt aufgegangen sind.
// Das Ergebnis steht im Spielzustand sofort fest – in der Wiedergabe bleiben sie bis zu ihrem Moment sichtbar,
// ebenso behält eine eroberte Stadt bis dahin ihre alte Farbe (siehe shownOwner).
const anim = { rec: false, cursor: 0, speed: 110, events: [], byUnit: new Map(), gone: [], t0: 0, end: 0 };

// Wiedergabe der Züge (Menü, archipel-replay): Tempo aller Bewegungen und Kamerafahrten – langsam, normal, schnell oder aus.
// „aus“: keine Bewegungen, keine Kamerafahrten (Einheiten stehen sofort am Ziel), die Karte springt nur, wenn sie muss.
// Für Menschen, die schnelles Hin und Her auf dem Bildschirm schlecht vertragen. Vorgabe „aus“, wenn das Betriebssystem
// reduzierte Bewegung wünscht (prefers-reduced-motion).
// Die ersten Stufen waren zu hektisch: das frühere „langsam“ ist jetzt „normal“, das frühere „normal“ heißt „schnell“, dazu ein
// ruhigeres „langsam“. Gespeichert unter archipel-replay2; eine alte Wahl (archipel-replay) wird so übernommen, dass das Tempo bleibt.
const REPLAY = { slow: { f: 2.6, cam: 2.4 }, normal: { f: 1.8, cam: 1.7 }, fast: { f: 1, cam: 1 }, off: { f: 1, cam: 1 } };
let replay = 'normal';
try {
  const v = localStorage.getItem('archipel-replay2');
  const old = { slow: 'normal', normal: 'fast', fast: 'fast', off: 'off' }[localStorage.getItem('archipel-replay')];
  if (REPLAY[v]) replay = v;
  else if (old) replay = old;
  else if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) replay = 'off';
} catch (e) {}
function animBegin(speed, follow = false) {
  speed *= REPLAY[replay].f;
  anim.camMs = CAM_MS * REPLAY[replay].cam;
  anim.rec = true; anim.cursor = 0; anim.speed = speed; anim.events = []; anim.gone = []; anim.skippable = false;
  anim.follow = follow;
  anim.ownFrom = null;   // Zeitpunkt in der Zeitleiste, ab dem die eigenen Einheiten ihre Befehle ausführen (siehe updateBanner)
  anim.phases = [];      // bei mehreren Gegnern: ab welchem Zeitpunkt welcher Gegner zieht ({ at, p }, siehe updateBanner)
  // Sichtstand vor der Aufzeichnung: neu aufgedeckte Felder erscheinen erst,
  // wenn die eigene Einheit in der Wiedergabe dort ankommt
  if (S) { anim.seen0 = S.players[0].seen.slice(); anim.vis0 = S.players[0].vis.slice(); }
  // gedachte Kameraposition während der Aufzeichnung (Kachelmitte des Sichtfensters)
  anim.vcx = (view.x + wrap.clientWidth / 2) / TS;
  anim.vcy = (view.y + wrap.clientHeight / 2) / TS;
}

// ------------------------------------------------------------------ Kamera
// Beim Gegnerzug wird vor jedem Ereignis außerhalb des Sichtfensters eine
// Kamerafahrt in die Zeitleiste eingeplant.
const CAM_MS = 550;
function viewHalf() { return [wrap.clientWidth / TS / 2, wrap.clientHeight / TS / 2]; }
function clampCenter(cx, cy) {
  const [hw, hh] = viewHalf();
  // Karte kleiner als das Fenster: in die Mitte; sonst darf jedes Feld in die Bildmitte (der Rand um die Karte macht es möglich)
  return [S.W <= hw * 2 ? S.W / 2 : Math.min(S.W - 0.5, Math.max(0.5, cx)),
          S.H <= hh * 2 ? S.H / 2 : Math.min(S.H - 0.5, Math.max(0.5, cy))];
}
function inVirtualView(x, y) {
  const [hw, hh] = viewHalf(), m = 2;
  return Math.abs(x + 0.5 - anim.vcx) <= hw - m && Math.abs(y + 0.5 - anim.vcy) <= hh - m;
}
function recCam(x1, y1, x2 = x1, y2 = y1) {
  if (!anim.rec || !anim.follow) return;
  if (inVirtualView(x1, y1) && inVirtualView(x2, y2)) return;
  const [cx, cy] = clampCenter(x2 + 0.5, y2 + 0.5);
  anim.events.push({ type: 'cam', cx, cy, t0: anim.cursor, dur: anim.camMs });
  anim.cursor += anim.camMs + 80;
  anim.vcx = cx; anim.vcy = cy;
}
const cam = { active: false };
function camTo(cx, cy, dur) {
  [cx, cy] = clampCenter(cx, cy);
  cam.sx = view.x; cam.sy = view.y;
  cam.tx = cx * TS - wrap.clientWidth / 2; cam.ty = cy * TS - wrap.clientHeight / 2;
  cam.t0 = performance.now(); cam.dur = dur; cam.active = true;
}
// Kamera zu einem Punkt außerhalb der Zeitleiste (zur nächsten Einheit, Zentrieren …): weich im eingestellten Tempo,
// bei „Wiedergabe aus“ ohne Schwenk
function pan(cx, cy, dur) {
  if (replay === 'off') {
    cam.active = false;
    [cx, cy] = clampCenter(cx, cy);
    view.x = cx * TS - wrap.clientWidth / 2; view.y = cy * TS - wrap.clientHeight / 2;
    dirty = true;
    return;
  }
  camTo(cx, cy, dur * REPLAY[replay].cam);
}
function camStep(now) {
  if (!cam.active) return;
  const f = Math.min(1, (now - cam.t0) / cam.dur), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
  view.x = cam.sx + (cam.tx - cam.sx) * e;
  view.y = cam.sy + (cam.ty - cam.sy) * e;
  if (f >= 1) cam.active = false;
  dirty = true;
}
function animEnd(maxMs = 3500) {
  anim.rec = false;
  maxMs *= REPLAY[replay].f;
  let end = 0;
  for (const e of anim.events) end = Math.max(end, e.t0 + e.dur);
  if (end > maxMs) {
    const f = maxMs / end;
    for (const e of anim.events) { e.t0 *= f; e.dur = Math.max(40, e.dur * f); }
    if (anim.ownFrom != null) anim.ownFrom *= f;
    for (const ph of anim.phases || []) ph.at *= f;
    end = maxMs;
  }
  anim.byUnit = new Map();
  for (const e of anim.events) if (e.type === 'move') {
    if (!anim.byUnit.has(e.id)) anim.byUnit.set(e.id, []);
    anim.byUnit.get(e.id).push(e);
  }
  // Ende der eigentlichen Bewegungen/Kämpfe (Schriftzüge dürfen länger stehen)
  anim.coreEnd = 0;
  for (const e of anim.events) if (e.type !== 'label') anim.coreEnd = Math.max(anim.coreEnd, e.t0 + e.dur);
  anim.t0 = performance.now(); anim.end = anim.t0 + end;
  if (replay === 'off') { anim.t0 = -1e9; anim.end = 0; }   // Wiedergabe aus: gleich der Endstand (Klänge und Kamera entfallen)
  dirty = true;
}
function animActive(now) { return now < anim.end + 30; }

function seenByHuman(x, y) { return S.players[0].vis[idx(x, y)] === 1; }
// Sähe der Mensch die Einheit, wenn sie auf (x, y) steht? (getauchte U-Boote nur im Ortungsbereich)
function humanSeesAt(u, x, y) {
  if (u.owner === 0) return true;
  const P = S.players[0], i = idx(x, y);
  return P.vis[i] === 1 && (!T(u).stealth || u.surf === true || P.sonar[i] === 1);
}

hooks.move = (u, fx, fy, tx, ty) => {
  if (!anim.rec) return;
  if (!humanSeesAt(u, fx, fy) && !humanSeesAt(u, tx, ty)) return;
  recCam(fx, fy, tx, ty);
  anim.events.push({ type: 'move', id: u.id, utype: u.type, owner: u.owner, fx, fy, tx, ty, t0: anim.cursor, dur: anim.speed,
    vr: u.owner === 0 ? T(u).vision : 0 });
  anim.cursor += anim.speed;
};
// from: Verteidiger einer fremden Stadt mit verborgener Besatzung – bis dahin nur als Zeichen „besetzt“ (render)
function recGone(u, until, from = null) {
  if (u.carrier != null) return;   // an Bord: wird ohnehin nicht einzeln gezeichnet
  anim.gone.push({ u: { id: u.id, type: u.type, owner: u.owner, hp: Math.max(1, u.hp), x: u.x, y: u.y,
    air: u.type === 'car' && S.units.some(f => f.carrier === u.id && f.type === 'ftr') }, until, from });   // air: Träger gab Luftdeckung
}
// Gegner scheidet aus (keine Stadt mehr): seine Einheiten verschwinden in der Wiedergabe erst in diesem Moment – nur die, die du siehst
hooks.out = (p, units) => {
  if (!anim.rec) return;
  for (const u of units) if (u.carrier == null && humanSeesAt(u, u.x, u.y)) recGone(u, anim.cursor);
};
// Besitzer einer Stadt, wie er gerade gezeigt wird: Während der Wiedergabe gilt bis zum Moment der Eroberung der alte.
function shownOwner(c, rel, playing) {
  if (playing) for (const e of anim.events) if (e.type === 'capture' && e.cid === c.id && rel < e.t0) return Math.max(-1, e.prevShown);
  return S.players[0].knownOwner[c.id];
}
// Salve eines Schlachtschiffs (Feuerunterstützung): Mündungsfeuer am Schiff, Granaten zum Zielfeld
hooks.salvo = (b, x, y) => {
  if (!anim.rec) return;
  if (b.owner !== 0 && !seenByHuman(x, y) && !seenByHuman(b.x, b.y)) return;
  recCam(x, y);
  anim.events.push({ type: 'salvo', fx: b.x, fy: b.y, x, y, t0: anim.cursor, dur: 560 });
  anim.cursor += 560;   // erst die Einschläge, dann der Sturm
};
// Luftdeckung: Jäger steigen vom Träger auf und fangen den Angreifer (auf ax, ay) ab; das geschützte Schiff (sx, sy) leuchtet auf
hooks.cover = (car, ax, ay, sx, sy) => {
  if (!anim.rec) return;
  if (car.owner !== 0 && !seenByHuman(ax, ay) && !seenByHuman(sx, sy)) return;
  recCam(sx, sy);
  anim.events.push({ type: 'cover', fx: car.x, fy: car.y, x: ax, y: ay, sx, sy, col: PLAYERS[car.owner].light, t0: anim.cursor, dur: 700 });
  anim.cursor += 520;   // der Kampf beginnt, während die Abfangjäger noch feuern
};
const LABEL_MS = 1700;
// won: hat der Angreifer gewonnen? (Verlierer sind beim Aufruf noch nicht entfernt)
hooks.combat = (a, d, x, y, won, storm = null) => {
  if (!anim.rec) return;
  if (a.owner !== 0 && !(d && d.owner === 0) && !seenByHuman(x, y)) return;
  recCam(x, y);
  // Verteidiger einer fremden Stadt (Besatzung sonst verborgen, garrisonHidden): Er zeigt sich erst jetzt – hält er stand, über rv
  // für die Dauer von Explosion und Schriftzug, fällt er, als Verlierer ab kurz vor der Explosion
  const city = cityAt(x, y), hiddenDef = !!(d && city && d.owner !== 0 && city.owner !== 0 && city.x === d.x && city.y === d.y);
  anim.events.push({ type: 'boom', x, y, t0: anim.cursor, dur: 650, win: won ? 'att' : 'def',
    hl: (a.owner === 0 && !won) || (d && d.owner === 0 && won),
    rv: hiddenDef && !won ? { id: d.id, type: d.type, owner: d.owner, hp: Math.max(1, d.hp) } : null });
  const loser = won ? d : a;
  if (loser) recGone(loser, anim.cursor + 280, hiddenDef && won ? anim.cursor - 120 : null);   // der Verlierer verschwindet in der Explosion
  // Ergebnis aus deiner Sicht als Schriftzug über dem Feld
  let label = null;
  // d === null: Eroberungsversuch einer unbesetzten Stadt ist gescheitert
  if (storm) label = null;   // Stadt fällt: der Schriftzug der Eroberung folgt
  else if (a.owner === 0) label = won ? (storm === false ? [tt('Sieg – Stadt hält', 'Won – city holds'), 'good'] : [tt('Sieg!', 'Victory!'), 'good']) : d ? [tt('Verloren', 'Lost'), 'bad'] : [tt('Gescheitert', 'Failed'), 'bad'];
  else if (d && d.owner === 0) label = won ? (storm === false ? [tt('Verloren – Stadt hält', 'Lost – city holds'), 'bad'] : [tt('Verloren', 'Lost'), 'bad']) : [tt('Abgewehrt!', 'Repelled!'), 'good'];
  else if (!d && city && city.owner === 0) label = [tt('Abgewehrt!', 'Repelled!'), 'good'];
  if (label) anim.events.push({ type: 'label', x, y, text: label[0], tone: label[1], t0: anim.cursor + 250, dur: LABEL_MS });
  anim.cursor += Math.max(260, anim.speed * 2.5);
};
hooks.capture = (c, owner, prev, by = null) => {
  if (!anim.rec) return;
  if (owner !== 0 && !seenByHuman(c.x, c.y)) return;
  recCam(c.x, c.y);
  const lost = prev === 0;
  const ev = { type: 'capture', x: c.x, y: c.y, cid: c.id, prevShown: S.players[0].knownOwner[c.id], owner, lost, t0: anim.cursor, dur: 900 };
  anim.events.push(ev);
  if (by) recGone(by, ev.t0 + 100);   // der Eroberer geht erst jetzt in der Stadt auf
  // Eigene Eroberung: kein Schriftzug – das Eroberungsfenster folgt gleich nach dem Farbwechsel
  if (owner === 0) { captureQueue.push({ game: S, id: c.id, ev }); anim.cursor += Math.max(200, anim.speed * 2); return; }
  const text = lost ? tt('Stadt verloren', 'City lost') : nPlayers() > 2 ? tt(`${pname(owner)} erobert`, `${pname(owner)} captures`) : tt('Gegner erobert', 'Enemy captures');
  anim.events.push({ type: 'label', x: c.x, y: c.y, text, tone: 'bad', t0: anim.cursor + 150, dur: LABEL_MS });
  anim.cursor += Math.max(200, anim.speed * 2);
};

const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// Position einer Einheit während der Wiedergabe (oder null = normale Darstellung)
function animPos(u, rel, byUnit = anim.byUnit) {
  const evs = byUnit.get(u.id);
  if (!evs) return null;
  const last = evs[evs.length - 1];
  if (rel >= last.t0 + last.dur) return null;
  if (rel < evs[0].t0) return [evs[0].fx, evs[0].fy];
  for (let k = 0; k < evs.length; k++) {
    const e = evs[k];
    if (rel < e.t0) return [evs[k - 1].tx, evs[k - 1].ty];
    if (rel < e.t0 + e.dur) {
      const f = ease((rel - e.t0) / e.dur);
      return [e.fx + (e.tx - e.fx) * f, e.fy + (e.ty - e.fy) * f];
    }
  }
  return null;
}

// ------------------------------------------------------------------ Zeichnen
function drawToken(u, px, py, size, opts = {}) {
  const spr = unitSprite(u.type, u.owner, size);
  const t = T(u);
  ctx.save();
  if (opts.dim) ctx.globalAlpha = 0.6;
  ctx.drawImage(spr, px - spr.pad, py - spr.pad);
  ctx.restore();
  // U-Boot: Getaucht ist der Normalzustand und bekommt kein Zeichen. Nur das aufgetauchte (nach einem Angriff,
  // für alle sichtbar) trägt eine Welle unter dem Boot.
  if (t.stealth && u.surf) {
    ctx.save();
    ctx.beginPath(); ctx.arc(px + size / 2, py + size / 2, size * 0.4, 0, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(215,240,255,0.95)'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.2, size / 16);
    const yy = py + size * 0.72, x0 = px + size * 0.18, w = size * 0.64;
    ctx.beginPath(); ctx.moveTo(x0, yy);
    for (let k = 1; k <= 14; k++) ctx.lineTo(x0 + w * k / 14, yy + Math.sin(k / 14 * Math.PI * 4) * size * 0.03);
    ctx.stroke();
    ctx.restore();
  }
  if (u.hp < t.hp) {
    const w = size * 0.62, h = Math.max(3, size * 0.1), x0 = px + (size - w) / 2, y0 = py + size * 0.86;
    roundRectPath(ctx, x0 - 1, y0 - 1, w + 2, h + 2, h / 2 + 1); ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fill();
    const f = u.hp / t.hp;
    roundRectPath(ctx, x0, y0, Math.max(h, w * f), h, h / 2);
    ctx.fillStyle = f > 0.5 ? '#4cc38a' : f > 0.25 ? '#f2b84b' : '#ff6b61'; ctx.fill();
  }
  if (opts.badge) {
    const r = Math.max(6, size * 0.19), bx = px + size - r * 0.8, by = py + r * 0.8;
    ctx.fillStyle = '#f2b84b'; ctx.strokeStyle = '#5a3d06'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1b1406'; ctx.font = `700 ${Math.round(r * 1.25)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(opts.badge), bx, by + 0.5);
  }
  if (opts.landing) {   // „Ausladen, wenn möglich“ ist an: kleiner Pfeil unten links
    const r = Math.max(5, size * 0.16), bx = px + r * 0.9, by = py + size - r * 0.9;
    ctx.fillStyle = 'rgba(20,28,40,0.9)'; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#f2b84b'; ctx.lineWidth = Math.max(1.5, size / 18); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by - r * 0.5); ctx.lineTo(bx, by + r * 0.45);
    ctx.moveTo(bx - r * 0.42, by + r * 0.02); ctx.lineTo(bx, by + r * 0.5); ctx.lineTo(bx + r * 0.42, by + r * 0.02); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  }
  if (opts.sentry) {
    const r = Math.max(5, size * 0.16), bx = px + r * 0.9, by = py + r * 0.9;
    ctx.fillStyle = 'rgba(20,28,40,0.9)';
    ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#cfe2ff'; ctx.font = `700 ${Math.round(r * 1.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('z', bx, by);
  } else if (opts.explore) {
    // Kompass-Symbol
    const r = Math.max(5, size * 0.16), bx = px + r * 0.9, by = py + r * 0.9;
    ctx.fillStyle = 'rgba(20,28,40,0.9)';
    ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2b84b';
    ctx.beginPath(); ctx.moveTo(bx, by - r * 0.75); ctx.lineTo(bx + r * 0.28, by); ctx.lineTo(bx, by + r * 0.75); ctx.lineTo(bx - r * 0.28, by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(20,28,40,0.9)';
    ctx.beginPath(); ctx.arc(bx, by, r * 0.14, 0, 7); ctx.fill();
  } else if (opts.patrol) {
    const r = Math.max(5, size * 0.16), bx = px + r * 0.9, by = py + r * 0.9;
    ctx.fillStyle = 'rgba(20,28,40,0.9)';
    ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7fe0d0'; ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath(); ctx.arc(bx, by, r * 0.5, -2.6, 2.2); ctx.stroke();
    ctx.fillStyle = '#7fe0d0';
    const ax = bx + Math.cos(2.2) * r * 0.5, ay = by + Math.sin(2.2) * r * 0.5;
    ctx.beginPath(); ctx.moveTo(ax - r * 0.35, ay - r * 0.05); ctx.lineTo(ax + r * 0.15, ay - r * 0.35); ctx.lineTo(ax + r * 0.1, ay + r * 0.25); ctx.closePath(); ctx.fill();
  } else if (opts.goto) {
    const r = Math.max(5, size * 0.16), bx = px + r * 0.9, by = py + r * 0.9;
    ctx.fillStyle = 'rgba(20,28,40,0.9)';
    ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#cfe2ff'; ctx.lineWidth = Math.max(1, r * 0.25);
    ctx.beginPath(); ctx.moveTo(bx - r * 0.4, by - r * 0.45); ctx.lineTo(bx + r * 0.25, by); ctx.lineTo(bx - r * 0.4, by + r * 0.45); ctx.stroke();
  }
}

// Sicht für die Darstellung: während einer Wiedergabe nur das, was die
// eigenen Einheiten bis zum aktuellen Zeitpunkt schon gesehen haben
function viewNow(rel, playing) {
  const P = S.players[0];
  if (!playing || !anim.seen0 || anim.seen0.length !== P.seen.length) return P;
  const seen = anim.seen0.slice(), vis = anim.vis0.slice();
  for (const e of anim.events) {
    if (e.type !== 'move' || !e.vr || rel < e.t0 + e.dur * 0.6) continue;
    for (let dy = -e.vr; dy <= e.vr; dy++) for (let dx = -e.vr; dx <= e.vr; dx++) {
      const x = e.tx + dx, y = e.ty + dy;
      if (!inb(x, y)) continue;
      const i = idx(x, y);
      if (P.seen[i]) seen[i] = 1;
      if (P.vis[i]) vis[i] = 1;
    }
  }
  return { seen, vis };
}

// st: Kartenstück (Grafik-Übersicht), sonst die laufende Partie
function drawFog(P = S.players[0], st = S) {
  if (fogC.width !== st.W || fogC.height !== st.H) { fogC.width = st.W; fogC.height = st.H; }
  const img = fogG.createImageData(st.W, st.H);
  for (let i = 0; i < st.W * st.H; i++) {
    const a = st.over ? 0 : !P.seen[i] ? 255 : !P.vis[i] ? 105 : 0;
    img.data[i * 4] = 7; img.data[i * 4 + 1] = 10; img.data[i * 4 + 2] = 18; img.data[i * 4 + 3] = a;
  }
  fogG.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fogC, 0, 0, st.W * TS, st.H * TS);
  ctx.restore();
}

function moveHints(u) {
  const out = [];
  if (!u) return out;
  const t = T(u);
  // Beladener Transporter: Städte, die seine Truppen vom Schiff aus stürmen können (auch wenn er selbst keinen Zug mehr hat)
  if (t.carries === 'land' && u.owner === 0) for (const o of assaultOptions(u)) out.push([o.x, o.y, 'attack']);
  if (u.moves <= 0) return out;
  for (const [dx, dy] of DIRS) {
    const x = u.x + dx, y = u.y + dy;
    if (!inb(x, y) || !S.players[0].seen[idx(x, y)]) continue;
    const c = cityAt(x, y);
    const here = topUnitsAt(x, y).filter(o => canSee(0, o));
    const enemy = here.some(o => o.owner !== 0);
    if (enemy) { if (here.some(o => o.owner !== 0 && canStrike(u, o))) out.push([x, y, 'attack']); continue; }
    if (c && c.owner !== 0) { if (t.capture) out.push([x, y, 'attack']); continue; }
    if (here.length && !(c && c.owner === 0)) {
      if (here.some(o => T(o).carries === t.domain && cargoOf(o).length < T(o).capacity)) out.push([x, y, 'board']);
      continue;
    }
    if (canEnterTerrain(u, x, y)) out.push([x, y, 'move']);
  }
  return out;
}

function drawSupportMark(x, y, protect, col) {
  const x0 = x * TS, y0 = y * TS, lw = Math.max(2, TS / 12);
  ctx.save();
  ctx.lineCap = 'round';
  const stroke = path => {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = lw + 2; path(); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = lw; path(); ctx.stroke();
  };
  if (protect) {
    ctx.setLineDash([TS * 0.16, TS * 0.12]);
    stroke(() => { ctx.beginPath(); ctx.arc(x0 + TS / 2, y0 + TS / 2, TS * 0.56, 0, 7); });
  } else {
    const a = TS * 0.3, m = -TS * 0.06, e = TS - m;
    stroke(() => {
      ctx.beginPath();
      ctx.moveTo(x0 + m, y0 + m + a); ctx.lineTo(x0 + m, y0 + m); ctx.lineTo(x0 + m + a, y0 + m);
      ctx.moveTo(x0 + e - a, y0 + m); ctx.lineTo(x0 + e, y0 + m); ctx.lineTo(x0 + e, y0 + m + a);
      ctx.moveTo(x0 + e, y0 + e - a); ctx.lineTo(x0 + e, y0 + e); ctx.lineTo(x0 + e - a, y0 + e);
      ctx.moveTo(x0 + m + a, y0 + e); ctx.lineTo(x0 + m, y0 + e); ctx.lineTo(x0 + m, y0 + e - a);
    });
  }
  ctx.restore();
}

// ------------------------------------------------------------------ Produktionsansicht
// Umschaltbare Sicht (Schalter in der Seitenleiste, Taste V): Statt der Einheiten zeigt die Karte, was jede
// eigene Stadt baut – Symbol der Einheit, Fortschrittsring, Restzeit. Ein Klick auf eine Stadt ändert die Produktion.
let prodView = false;
function setProdView(on) {
  on = !!on && !!S;
  if (on === prodView) return;
  prodView = on;
  if (on) { pathView = false; rallyMode = null; sel = null; selCity = null; if (patrolMode) patrolAbort(); closeCtx(); }
  updateViewSwitch();
  if (S) { refresh(); updateHover(); }
}
const prodLeft = c => Math.max(1, Math.ceil(UT[c.prod].cost - c.progress));
function drawProdView() {
  for (const c of S.cities) if (c.owner === 0) drawProdCity(c, hover && hover[0] === c.x && hover[1] === c.y);
}
// eine Stadt in der Produktionsansicht (c: x, y, prod, progress); hot = Maus darüber
function drawProdCity(c, hot) {
  const fs = Math.max(9, Math.round(TS * 0.34));
  const cx = c.x * TS + TS / 2, cy = c.y * TS + TS / 2, r = TS * 0.54;
  ctx.fillStyle = 'rgba(10,14,20,0.6)'; ctx.beginPath(); ctx.arc(cx, cy, r + TS * 0.06, 0, 7); ctx.fill();
  ctx.lineWidth = Math.max(2, TS / 10);
  ctx.strokeStyle = hot ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  if (!c.prod || !UT[c.prod]) return;
  const t = UT[c.prod], size = Math.round(TS * 0.8), spr = unitSprite(c.prod, 0, size);
  ctx.drawImage(spr, cx - size / 2 - spr.pad, cy - size / 2 - spr.pad);
  // Fortschritt als Ring, beginnend oben
  const f = Math.min(1, c.progress / t.cost);
  if (f > 0) { ctx.strokeStyle = '#f2b84b'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); ctx.lineCap = 'butt'; }
  // Restzeit in Runden
  const txt = String(prodLeft(c));
  ctx.font = `700 ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.max(fs * 1.25, ctx.measureText(txt).width + fs * 0.6), h = fs * 1.25, bx = cx + TS * 0.4, by = cy + TS * 0.42;
  roundRectPath(ctx, bx - w / 2, by - h / 2, w, h, h / 2); ctx.fillStyle = '#f2b84b'; ctx.fill();
  ctx.fillStyle = '#1b1406'; ctx.fillText(txt, bx, by + 0.5);
}

// ------------------------------------------------------------------ Wegeansicht und Marschziele
// Wegeansicht (Schalter „Wege und Marschziele“ unter „Ansicht“ in der Kopfzeile, Taste G – bis 1.7.7 dritter Knopf des Schalters in der
// Seitenleiste; dort stehen jetzt nur die beiden Arbeitsmodi Einheiten | Produktion): zeichnet unter den Einheiten alle laufenden Märsche (weiß),
// Patrouillen (türkis) und die Marschziele der Städte (gelb). Anders als die Produktionsansicht ist sie nur eine
// zusätzliche Ebene – das Spiel läuft normal weiter, und sie bleibt an, bis man sie abschaltet.
// Die Wege werden nur nach Änderungen neu berechnet (refresh() verwirft pathCache), nicht in jedem Bild.
let pathView = false, pathCache = null, rallyCache = null;

// ------------------------------------------------------------------ Reichweite der Gegner
// Zuschaltbare Ebene (Wunsch des Nutzers, wie in Fire Emblem; „Ansicht“ in der Kopfzeile, Taste K, gemerkt in archipel-threat): rot getönt
// sind alle Felder, auf denen eine sichtbare gegnerische Einheit in ihrem nächsten Zug angreifen könnte; nur schraffiert, was allein Jäger
// erreichen. Gerechnet wird je Einheit mit ihrer vollen Bewegung über Gelände, das sie betreten kann – ohne andere Einheiten (die ziehen
// weiter) und ohne Treibstoff. Der letzte Schritt ist der Angriff: Bodentruppen auch auf Schiffe am Ufer (Küstenangriff), Schiffe an Land
// nur Kreuzer und Schlachtschiff, Transporter aufs Land daneben (Sturm vom Schiff). Die Ebene verrät nichts, was der Spieler nicht weiß:
// nur Einheiten, die er sieht (canSee), um besetzte fremde Städte nur die Felder rundum (Besatzung verborgen), keine Ladung, und nur über
// erforschtes Gelände.
let threatView = false, threatMapUi = null;
try { threatView = localStorage.getItem('archipel-threat') === '1'; } catch (e) {}
function setThreatView(on) {
  threatView = !!on; threatMapUi = null;
  try { localStorage.setItem('archipel-threat', threatView ? '1' : '0'); } catch (e) {}
  dirty = true;
  if (S) refresh();
}
function buildThreatMap() {
  const P = S.players[0], z = new Uint8Array(S.W * S.H), inCity = new Set();   // 0 nichts, 1 zu Land/zur See, 2 nur aus der Luft
  for (const e of S.units) {
    if (e.owner === 0 || e.carrier != null || !canSee(0, e)) continue;
    const t = T(e), i0 = idx(e.x, e.y);
    if (S.cityGrid[i0] >= 0 && !CHEAT_FOG) {
      // Besatzung verborgen (garrisonHidden): Was auch immer drinsteht, erreicht zumindest die Felder rundum – mehr verrät die Ebene nicht
      if (!inCity.has(i0)) for (const [dx, dy] of DIRS) { const nx = e.x + dx, ny = e.y + dy; if (inb(nx, ny) && P.seen[idx(nx, ny)]) z[idx(nx, ny)] = 1; }
      inCity.add(i0);
      continue;
    }
    if (!canAttack(e.type) && e.type !== 'trn') continue;
    const air = t.domain === 'air', mv = Math.max(1, t.move), seen = new Set([i0]);
    let front = [[e.x, e.y]];
    for (let d = 0; d < mv && front.length; d++) {
      const next = [];
      for (const [x, y] of front) for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const i = idx(nx, ny);
        if (!P.seen[i]) continue;
        const land = S.terrain[i] === 1;
        const hit = air || t.domain === 'land' || (e.type === 'trn' ? land : (!land || !!t.shore));
        if (hit) z[i] = air ? (z[i] || 2) : 1;
        if (d + 1 < mv && !seen.has(i) && canEnterTerrain(e, nx, ny)) { seen.add(i); next.push([nx, ny]); }
      }
      front = next;
    }
  }
  return z;
}
let threatHatch = null;
function drawThreat() {
  if (!threatMapUi) threatMapUi = buildThreatMap();
  const z = threatMapUi, W = S.W, at = (x, y) => (inb(x, y) ? z[idx(x, y)] : 0);
  if (!threatHatch || threatHatch.ts !== TS) {   // Schraffur für „nur aus der Luft“
    const c = document.createElement('canvas'), n = Math.max(6, Math.round(TS / 3)); c.width = c.height = n;
    const g = c.getContext('2d'); g.strokeStyle = 'rgba(255,70,60,0.5)'; g.lineWidth = Math.max(1, TS / 22);
    g.beginPath(); g.moveTo(-1, n + 1); g.lineTo(n + 1, -1); g.moveTo(-1, 1); g.lineTo(1, -1); g.moveTo(n - 1, n + 1); g.lineTo(n + 1, n - 1); g.stroke();
    threatHatch = { ts: TS, pat: c };
  }
  ctx.save();
  const pat = ctx.createPattern(threatHatch.pat, 'repeat');
  for (let i = 0; i < z.length; i++) {
    if (!z[i]) continue;
    const x = i % W, y = (i / W) | 0;
    ctx.fillStyle = z[i] === 1 ? 'rgba(235,45,40,0.26)' : pat;
    ctx.fillRect(x * TS, y * TS, TS, TS);
  }
  // Umriss der bedrohten Fläche: Kante, wo das Nachbarfeld frei ist
  ctx.strokeStyle = 'rgba(255,90,80,0.9)'; ctx.lineWidth = Math.max(1.5, TS / 16); ctx.lineCap = 'square';
  ctx.beginPath();
  for (let i = 0; i < z.length; i++) {
    if (!z[i]) continue;
    const x = i % W, y = (i / W) | 0, X = x * TS, Y = y * TS;
    if (!at(x, y - 1)) { ctx.moveTo(X, Y); ctx.lineTo(X + TS, Y); }
    if (!at(x, y + 1)) { ctx.moveTo(X, Y + TS); ctx.lineTo(X + TS, Y + TS); }
    if (!at(x - 1, y)) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + TS); }
    if (!at(x + 1, y)) { ctx.moveTo(X + TS, Y); ctx.lineTo(X + TS, Y + TS); }
  }
  ctx.stroke();
  ctx.restore();
}
let rallyMode = null;   // { city: id } – der nächste Klick auf die Karte setzt das Marschziel dieser Stadt
function updateViewSwitch() {
  $('vUnits').classList.toggle('on', !prodView);
  $('vProd').classList.toggle('on', prodView);
  document.querySelector('aside').classList.toggle('prodmode', prodView);
}
function setPathView(on) {
  on = !!on && !!S;
  if (on === pathView) return;
  if (on) setProdView(false);
  pathView = on;
  updateViewSwitch();
  if (S) { refresh(); updateHover(); }
}
function rallyRoute(c) {
  const r = c.prod ? rallyCheck(c, c.prod, c.rally[0], c.rally[1]) : { ok: false };
  return { kind: 'rally', pts: [[c.x, c.y], ...(r.ok ? r.path : [c.rally])], bad: !r.ok };
}
function buildPathCache() {
  const list = [];
  for (const c of S.cities) if (c.owner === 0 && c.rally) list.push(rallyRoute(c));
  for (const u of S.units) {
    if (u.owner !== 0 || u.carrier != null || !u.order) continue;
    if (u.order.type === 'goto') {
      const path = findPath(u, u.order.x, u.order.y);
      list.push({ kind: 'goto', pts: [[u.x, u.y], ...(path && path.length ? path : [[u.order.x, u.order.y]])] });
    } else if (u.order.type === 'patrol') {
      list.push({ kind: 'patrol', pts: [u.order.start, ...u.order.pts.slice(0, -1)], at: [u.x, u.y], next: u.order.pts[u.order.i] });
    }
  }
  return list;
}
// Farbe und Strichmuster je Art (Muster in Feldbreiten) – unterscheidbar auch ohne Farbe: Striche, Punkte, Strich-Punkt
const ROUTE_STYLE = { goto: ['255,255,255', [0.24, 0.16]], patrol: ['127,224,208', [0.02, 0.17]], rally: ['242,184,75', [0.34, 0.13, 0.03, 0.13]] };
function drawRoute(r) {
  const [rgb, dash] = ROUTE_STYLE[r.kind], col = `rgba(${r.bad ? '255,120,110' : rgb},0.92)`;
  const c = p => [p[0] * TS + TS / 2, p[1] * TS + TS / 2];
  const w = Math.max(2, TS / 13), edge = 'rgba(8,12,18,0.7)';
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const line = (pts, close) => {
    ctx.beginPath(); ctx.moveTo(...c(pts[0]));
    for (let k = 1; k < pts.length; k++) ctx.lineTo(...c(pts[k]));
    if (close) ctx.closePath();
    // dunkler Rand, damit die Linie auf Sand, Wiese und Wasser gleich gut zu sehen ist
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(8,12,18,0.45)'; ctx.lineWidth = w + 2.5; ctx.stroke();
    ctx.setLineDash(dash.map(d => d * TS)); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    ctx.setLineDash([]);
  };
  if (r.kind === 'patrol') {
    if (r.at && r.next && (r.at[0] !== r.next[0] || r.at[1] !== r.next[1])) line([r.at, r.next], false);   // Weg zum nächsten Wegpunkt
    line(r.pts, r.pts.length > 2);
    r.pts.forEach((p, k) => {   // Wegpunkte; der Startpunkt ist hohl
      const [x, y] = c(p);
      ctx.beginPath(); ctx.arc(x, y, TS * 0.11, 0, 7);
      ctx.fillStyle = k === 0 ? 'rgba(12,17,24,0.9)' : col; ctx.fill();
      ctx.strokeStyle = k === 0 ? col : edge; ctx.lineWidth = k === 0 ? Math.max(1.5, TS / 16) : 1; ctx.stroke();
    });
  } else {
    line(r.pts, false);
    const [ex, ey] = c(r.pts[r.pts.length - 1]);
    if (r.kind === 'goto') {   // Pfeilspitze in Marschrichtung
      const [px, py] = c(r.pts[Math.max(0, r.pts.length - 2)]);
      if (px !== ex || py !== ey) {
        const a = Math.atan2(ey - py, ex - px), s = TS * 0.3;
        ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * s * 0.6, ey + Math.sin(a) * s * 0.6);
        ctx.lineTo(ex + Math.cos(a + 2.5) * s, ey + Math.sin(a + 2.5) * s); ctx.lineTo(ex + Math.cos(a - 2.5) * s, ey + Math.sin(a - 2.5) * s);
        ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke();
      }
    } else {   // Marschziel: Fähnchen
      const s = TS * 0.36, mx = ex - s * 0.4;
      ctx.beginPath(); ctx.moveTo(mx, ey + s * 0.75); ctx.lineTo(mx, ey - s);
      ctx.strokeStyle = edge; ctx.lineWidth = Math.max(3.5, TS / 8); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, TS / 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, ey - s); ctx.lineTo(mx + s * 1.15, ey - s * 0.55); ctx.lineTo(mx, ey - s * 0.1); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  ctx.restore();
}
// Legende mit Anzahl unter dem Ansichtsschalter (nur in der Wegeansicht)
function updatePathLegend() {
  const el = $('pathLegend');
  el.hidden = !pathView || !S;
  if (el.hidden) return;
  if (!pathCache) pathCache = buildPathCache();
  const n = k => pathCache.filter(r => r.kind === k).length;
  const g = n('goto'), p = n('patrol'), r = n('rally');
  const ex = S.units.filter(u => u.owner === 0 && u.carrier == null && u.order && u.order.type === 'explore').length;
  el.innerHTML = `<span><i class="pl-goto"></i>${g} ${tt(g === 1 ? 'Marsch' : 'Märsche', g === 1 ? 'march' : 'marches')}</span>`
    + `<span><i class="pl-patrol"></i>${p} ${tt(p === 1 ? 'Patrouille' : 'Patrouillen', p === 1 ? 'patrol' : 'patrols')}</span>`
    + `<span><i class="pl-rally"></i>${r} ${tt(r === 1 ? 'Marschziel' : 'Marschziele', r === 1 ? 'rally point' : 'rally points')}</span>`
    + (ex ? `<span>${tt(`${ex} ${ex === 1 ? 'Einheit erkundet' : 'Einheiten erkunden'} (ohne festen Weg)`, `${ex} ${ex === 1 ? 'unit is' : 'units are'} exploring (no fixed route)`)}</span>` : '');
}

// Marschziel einer Stadt: Einheiten, die dort fertig werden, marschieren sofort dorthin (Regeln: rallyCheck/applyRally in game.js).
// Gesetzt wird es über die Stadtkarte oder das Kontextmenü, dann mit einem Klick auf das Zielfeld.
function actRally(c) {
  if (!c || c.owner !== 0 || !c.prod) return;
  if (patrolMode) patrolAbort();
  setProdView(false);
  closeCtx();
  rallyMode = { city: c.id }; sel = null; selCity = c.id;
  Sfx.play('tick');
  refresh(); updateHover();
}
function rallyAbort() { if (!rallyMode) return; rallyMode = null; refresh(); updateHover(); }
function rallySet(x, y) {
  const c = S.cities[rallyMode.city];
  if (!c || c.owner !== 0) { rallyMode = null; refresh(); return; }
  const r = rallyCheck(c, c.prod, x, y);
  if (!r.ok) { toast(r.msg); Sfx.play('error'); return; }   // der Modus bleibt: anderes Feld wählen oder Esc
  c.rally = [x, y]; rallyMode = null;
  Sfx.play('select');
  saveGame(); refresh(); updateHover();
}
function rallyClear(c) { if (!c || !c.rally) return; c.rally = null; Sfx.play('tick'); saveGame(); refresh(); }
// Produktion umstellen (alle Stellen der Oberfläche): Das Marschziel galt für den bisherigen Typ und entfällt.
function changeProd(c, k) {
  const had = !!c.rally;
  if (!setProduction(c, k)) return false;
  if (had) toast(tt('Marschziel gelöscht – es galt für die bisherige Produktion.', 'Rally point cleared – it applied to the previous production.'));
  return true;
}

// Effekt der Zeitleiste (Explosion, Salve, Luftdeckung, Schriftzug, Eroberung) beim Fortschritt f (0 … 1) – auf der Karte
// und in der Grafik-Übersicht
function drawEffect(e, f) {
  const cx = e.x * TS + TS / 2, cy = e.y * TS + TS / 2;
  if (e.type === 'boom') {
    const r = TS * (0.2 + 0.55 * ease(Math.min(1, f * 1.6)));
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, `rgba(255,250,210,${1 - f})`);
    grd.addColorStop(0.4, `rgba(255,170,60,${0.9 * (1 - f)})`);
    grd.addColorStop(1, 'rgba(200,60,20,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(255,220,140,${1 - f})`; ctx.lineWidth = Math.max(1, TS / 20);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + 0.3, r0 = TS * 0.25 + f * TS * 0.4, r1 = r0 + TS * 0.15;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.fillStyle = `rgba(60,60,60,${0.45 * (1 - f)})`;
    ctx.beginPath(); ctx.arc(cx + TS * 0.1, cy - TS * 0.2 - f * TS * 0.4, TS * (0.15 + f * 0.25), 0, 7); ctx.fill();
  } else if (e.type === 'salvo') {
    const sx = e.fx * TS + TS / 2, sy = e.fy * TS + TS / 2;
    const ddx = cx - sx, ddy = cy - sy, len = Math.hypot(ddx, ddy) || 1, nx = -ddy / len, ny = ddx / len;
    if (f < 0.3) {   // Mündungsfeuer
      ctx.fillStyle = `rgba(255,238,180,${1 - f / 0.3})`;
      ctx.beginPath(); ctx.arc(sx + ddx / len * TS * 0.4, sy + ddy / len * TS * 0.4, TS * (0.16 + f * 0.5), 0, 7); ctx.fill();
    }
    for (let k = 0; k < 3; k++) {   // drei Granaten mit Leuchtspur, leicht versetzt
      const g = f * 1.45 - k * 0.14;
      if (g <= 0 || g >= 1) continue;
      const at = t => [sx + ddx * t + nx * (k - 1) * TS * 0.12, sy + ddy * t + ny * (k - 1) * TS * 0.12 - Math.sin(Math.PI * t) * TS * 0.3];
      const [hx, hy] = at(g), [tx, ty] = at(Math.max(0, g - 0.22));
      ctx.strokeStyle = 'rgba(255,215,140,0.9)'; ctx.lineWidth = Math.max(1.5, TS / 14); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.5, TS / 12), 0, 7); ctx.fill();
    }
    if (f > 0.62) {   // Einschläge
      const a = (1 - f) / 0.38;
      ctx.fillStyle = `rgba(255,190,90,${0.85 * a})`;
      ctx.beginPath(); ctx.arc(cx, cy, TS * (0.2 + (1 - a) * 0.35), 0, 7); ctx.fill();
    }
  } else if (e.type === 'cover') {
    // Schutzschirm um das angegriffene Schiff (gestrichelt wie die Markierung der Luftdeckung)
    const px = e.sx * TS + TS / 2, py = e.sy * TS + TS / 2, sh = Math.sin(Math.PI * f);
    ctx.save();
    ctx.strokeStyle = e.col; ctx.globalAlpha = 0.9 * sh; ctx.lineWidth = Math.max(1.5, TS / 16);
    ctx.setLineDash([TS / 7, TS / 9]); ctx.lineDashOffset = -f * TS;
    ctx.beginPath(); ctx.arc(px, py, TS * (0.55 + 0.1 * f), 0, 7); ctx.stroke();
    ctx.restore();
    // zwei Abfangjäger steigen vom Träger auf und fliegen in leichtem Bogen auf den Angreifer zu
    const sx = e.fx * TS + TS / 2, sy = e.fy * TS + TS / 2, ddx = cx - sx, ddy = cy - sy, len = Math.hypot(ddx, ddy) || 1;
    const nx = -ddy / len, ny = ddx / len;
    for (let k = 0; k < 2; k++) {
      const side = k ? 1 : -1, g = Math.min(1, Math.max(0, (f - k * 0.08) / 0.6));
      if (f - k * 0.08 <= 0) continue;
      // Ziel: schräg vor dem Angreifer, links und rechts von ihm (nicht auf seiner Marke); dorthin in leichtem Bogen
      const ex = cx - ddx / len * TS * 0.7 + nx * side * TS * 0.45, ey = cy - ddy / len * TS * 0.7 + ny * side * TS * 0.45;
      const at = t => [sx + (ex - sx) * t + nx * side * Math.sin(Math.PI * t) * TS * 0.35, sy + (ey - sy) * t + ny * side * Math.sin(Math.PI * t) * TS * 0.35];
      const [hx, hy] = at(g), [bx, by] = at(Math.max(0, g - 0.05));
      const ang = Math.atan2(hy - by, hx - bx) || Math.atan2(ddy, ddx);
      // Leuchtspur der Bordkanonen, sobald der Angreifer in Reichweite ist
      if (g > 0.55 && f < 0.9) {
        ctx.strokeStyle = '#fff1a0'; ctx.lineWidth = Math.max(1.5, TS / 16); ctx.lineCap = 'round';
        for (let j = 0; j < 3; j++) {
          const q = ((f * 9 + j * 0.33) % 1);
          const tx0 = hx + (cx - hx) * q, ty0 = hy + (cy - hy) * q, tl = 0.18;
          ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(tx0, ty0);
          ctx.lineTo(tx0 + (cx - hx) * tl, ty0 + (cy - hy) * tl); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // Jäger als kleiner Pfeil in Flugrichtung
      const s = Math.max(6, TS * 0.3);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
      ctx.fillStyle = e.col; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, TS / 30);
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, s * 0.75); ctx.lineTo(-s * 0.35, 0); ctx.lineTo(-s * 0.7, -s * 0.75); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
    if (f > 0.6 && f < 0.95) {   // Treffer-Funken am Angreifer
      const a = 1 - (f - 0.6) / 0.35;
      ctx.strokeStyle = `rgba(255,190,80,${a})`; ctx.lineWidth = Math.max(1.5, TS / 18);
      for (let k = 0; k < 6; k++) {
        const w = k * Math.PI / 3 + f * 4, r0 = TS * 0.12, r1 = TS * (0.2 + 0.15 * (1 - a));
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(w) * r0, cy + Math.sin(w) * r0); ctx.lineTo(cx + Math.cos(w) * r1, cy + Math.sin(w) * r1); ctx.stroke();
      }
    }
  } else if (e.type === 'label') {
    // steigt leicht auf, blendet am Ende aus
    const alpha = f < 0.12 ? f / 0.12 : f > 0.75 ? (1 - f) / 0.25 : 1;
    const yy = cy - TS * 0.7 - ease(Math.min(1, f * 1.3)) * TS * 0.6;
    const fs = Math.max(13, Math.round(TS * 0.5));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `800 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(e.text).width + fs * 0.9, h = fs * 1.5;
    roundRectPath(ctx, cx - w / 2, yy - h / 2, w, h, h / 2);
    ctx.fillStyle = e.tone === 'good' ? 'rgba(18,60,38,0.92)' : 'rgba(80,20,18,0.92)'; ctx.fill();
    ctx.strokeStyle = e.tone === 'good' ? '#4cc38a' : '#ff6b61'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = e.tone === 'good' ? '#bdf5d6' : '#ffd2cd';
    ctx.fillText(e.text, cx, yy + 1);
    ctx.restore();
  } else if (e.type === 'capture') {
    const pal = PLAYERS[e.owner];
    ctx.strokeStyle = pal.light; ctx.globalAlpha = 1 - f; ctx.lineWidth = Math.max(2, TS / 8) * (1 - f) + 1;
    ctx.beginPath(); ctx.arc(cx, cy, TS * (0.3 + 1.1 * ease(f)), 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Verborgene Besatzung (Wunsch des Nutzers): Steht in einer fremden Stadt etwas, zeigt die Karte nur das Zeichen „besetzt“ (Schild mit
// Fragezeichen in der Farbe des Besitzers) – welche Einheit verteidigt, zeigt sich erst im Kampf (rv im boom-Ereignis, hooks.combat).
// Vorher stand dort die zuerst gebaute Einheit, die Hinweiszeile nannte aber die stärkste – das passte oft nicht zusammen. Deshalb auch:
// keine Siegchance gegen die Stadt (Hinweiszeile, Karte, Sturm vom Schiff „⚔ ?“), kein Feuerschutz und keine Luftdeckung aus der Stadt,
// die Reichweite der Gegner zählt die Felder rundum. Nach Spielende und mit „Nebel aus“ ist alles offen. Die KI kennt die Besatzung
// deiner Städte weiterhin (Entscheidung des Nutzers: Stufen bleiben gültig). Neue Anzeigen über fremde Städte hier nachfragen.
function garrisonHidden(x, y) {
  return veiledCity(cityAt(x, y)) && topUnitsAt(x, y).some(o => o.owner !== 0 && canSee(0, o));
}
function veiledCity(c) { return !!c && c.owner !== 0 && !S.over && !CHEAT_FOG; }   // Besatzung dieser Stadt wäre verborgen
// Eroberungschance, wie du sie kennen kannst: Ein Schlachtschiff in einer Stadt mit verborgener Besatzung zählt nicht mit – sein
// Feuerschutz zeigt sich erst beim Angriff (die Regel selbst rechnet mit captureChance).
function knownCapture(c) {
  if (safeStart(0, c)) return 1;
  const bat = o => S.units.some(u => u.type === 'bat' && u.owner === o && u.carrier == null && u.hp > 0 && cheb(u.x, u.y, c.x, c.y) <= 1 && !(o !== 0 && garrisonHidden(u.x, u.y)));
  return CAPTURE_BASE + (bat(0) ? SUPPORT_CAPTURE : 0) - (c.owner >= 0 && bat(c.owner) ? SUPPORT_CAPTURE : 0);
}
// Die Marke eines Feldes: welche der Einheiten dort gezeigt wird und mit welchen Zeichen. x, y = Feld, an dem gezeichnet wird (Karte: das Feld
// selbst; Lupe: seine Lage im Ausschnitt). rv = Verteidiger, der sich gerade im Kampf zeigt (sonst bei verborgener Besatzung das Zeichen).
function drawTileToken(list, i, su, x, y, rv = null) {
  const inCity = S.cityGrid[i] >= 0;
  // list enthält schon nur, was du siehst (während der Wiedergabe mit dem Sichtstand von damals) – deshalb hier nicht garrisonHidden
  if (inCity && list[0].owner !== 0 && veiledCity(S.cities[S.cityGrid[i]])) {
    if (rv) drawToken(rv, x * TS + TS * 0.36, y * TS + TS * 0.36, TS * 0.66);
    else drawGarrison(list[0].owner, x * TS + TS * 0.36, y * TS + TS * 0.36, TS * 0.66);
    return;
  }
  const show = list.find(u => su && (u === su || u.id === su.carrier)) || list.find(u => u.owner === 0 && u.moves > 0 && !u.order) || list[0];
  // Zahl an der Marke (Einheiten in der Stadt, Ladung) nur bei eigenen Einheiten – wie viel der Gegner an Bord oder
  // in einer Stadt hat, bleibt bis zum Spielende verborgen
  const reveal = show.owner === 0 || S.over || CHEAT_FOG;   // Schummeln „Nebel aus“ deckt auch das auf
  const badge = !reveal ? 0 : inCity ? (list.length > 1 ? list.length : 0) : cargoOf(show).length;
  const own = show.owner === 0;
  const opts = {
    badge,
    dim: own && (show.moves <= 0 || (show.order && (show.order.type === 'sentry' || show.order.type === 'load'))) && show !== su,
    sentry: own && show.order && (show.order.type === 'sentry' || show.order.type === 'load'),   // ladender Transporter wartet wie eine Wache
    goto: own && show.order && show.order.type === 'goto',
    patrol: own && show.order && show.order.type === 'patrol',
    explore: own && show.order && show.order.type === 'explore',
    landing: own && !!show.landing,
  };
  if (inCity) drawToken(show, x * TS + TS * 0.36, y * TS + TS * 0.36, TS * 0.66, opts);
  else drawToken(show, x * TS, y * TS, TS, opts);
}
function drawGarrison(owner, px, py, size) {
  const spr = unitSprite('garrison', owner, size);
  ctx.drawImage(spr, px - spr.pad, py - spr.pad);
}

// ------------------------------------------------------------------ Lupe
// Taste O gedrückt halten (Wunsch des Nutzers: mehr Zoom ist nur zum Anschauen – dafür eine Lupe statt größerer Zoomstufen): ein runder
// Ausschnitt unter der Maus, etwa 2,5-fach vergrößert und scharf – Gelände, Städte, Nebel und Einheiten werden für den Ausschnitt in der
// größeren Stufe neu gezeichnet (buildTerrain mit einem Kartenstück wie in der Grafik-Übersicht, drawOn), nicht hochskaliert. Sie zeigt
// dasselbe wie die Karte, nicht mehr: Nebel bleibt Nebel. Ohne Marker, Wege und Effekte; während der Wiedergabe der Züge ist sie aus.
const LOUPE_D = 300;
let loupeOn = false, loupeXY = null, loupeBg = null;
window.addEventListener('mousemove', e => { loupeXY = [e.clientX, e.clientY]; });
function setLoupe(on) { loupeOn = !!on && !!S; if (!loupeOn) $('loupe').hidden = true; else drawLoupe(); }
function drawLoupe() {
  const el = $('loupe'), rect = cv.getBoundingClientRect(), now = performance.now();
  const fx = loupeXY ? (loupeXY[0] - rect.left) / TS : -1, fy = loupeXY ? (loupeXY[1] - rect.top) / TS : -1;
  const wr = wrap.getBoundingClientRect();
  const inside = loupeXY && fx >= 0 && fy >= 0 && fx < S.W && fy < S.H && loupeXY[0] >= wr.left && loupeXY[0] <= wr.right && loupeXY[1] >= wr.top && loupeXY[1] <= wr.bottom;
  if (!loupeOn || !inside || animActive(now) || [...document.querySelectorAll('.modal')].some(m => !m.hidden)) { el.hidden = true; return; }
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1)), tsl = Math.max(64, Math.min(104, Math.round(TS * 2.5))), ts = Math.round(tsl * dpr);
  const R = Math.ceil(LOUPE_D / 2 / tsl) + 1, tx = Math.floor(fx), ty = Math.floor(fy);
  const x0 = Math.max(0, tx - R), y0 = Math.max(0, ty - R), x1 = Math.min(S.W - 1, tx + R), y1 = Math.min(S.H - 1, ty + R), w = x1 - x0 + 1, h = y1 - y0 + 1;
  const P = S.players[0], sub = (src, T, fill) => { const a = new T(w * h); if (fill != null) a.fill(fill); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = src[idx(x0 + x, y0 + y)]; return a; };
  const key = [x0, y0, w, h, ts, S.land, S.gameId].join();
  if (!loupeBg || loupeBg.key !== key) {
    const st = { W: w, H: h, ox: x0, oy: y0, over: S.over, terrain: sub(S.terrain, Uint8Array), depth: sub(S.depth, Uint8Array), elev: sub(S.elev, Float32Array), cityGrid: sub(S.cityGrid, Int16Array) };
    loupeBg = { key, st, img: buildTerrain(ts, st) };
  }
  const px = Math.round(LOUPE_D * dpr);
  if (el.width !== px || el.height !== px) { el.width = px; el.height = px; }   // eine neue Leinwand ist 300 × 150 – Breite allein zu prüfen reichte nicht
  el.style.width = el.style.height = LOUPE_D + 'px';
  el.style.left = Math.round(loupeXY[0] - LOUPE_D / 2) + 'px'; el.style.top = Math.round(loupeXY[1] - LOUPE_D / 2) + 'px';
  const g = el.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#080b10'; g.fillRect(0, 0, el.width, el.height);
  g.translate(Math.round(el.width / 2 - (fx - x0) * ts), Math.round(el.height / 2 - (fy - y0) * ts));
  g.drawImage(loupeBg.img, 0, 0);
  drawOn(g, ts, () => {
    for (const c of S.cities) {
      if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1 || (!P.seen[idx(c.x, c.y)] && !S.over)) continue;
      ctx.drawImage(citySprite(S.over ? c.owner : shownOwner(c, 0, false), TS, c.id % 2), (c.x - x0) * TS, (c.y - y0) * TS);
    }
    drawFog({ seen: sub(P.seen, Uint8Array), vis: sub(P.vis, Uint8Array) }, loupeBg.st);
    const groups = new Map(), su = S.over ? null : selUnit();
    for (const u of S.units) {
      if (u.carrier != null || u.x < x0 || u.x > x1 || u.y < y0 || u.y > y1) continue;
      const i = idx(u.x, u.y);
      if (u.owner !== 0 && !S.over && !canSee(0, u)) continue;
      if (!groups.has(i)) groups.set(i, []);
      groups.get(i).push(u);
    }
    for (const [i, list] of groups) drawTileToken(list, i, su, i % S.W - x0, ((i / S.W) | 0) - y0);
  });
  el.hidden = false;
}

function render(now = performance.now()) {
  if (!S || !terrainCache) return;
  const P = S.players[0];
  const rel = now - anim.t0;
  const playing = animActive(now);
  ctx.drawImage(terrainCache, 0, 0);

  for (const c of S.cities) {
    if (!P.seen[idx(c.x, c.y)] && !S.over) continue;
    ctx.drawImage(citySprite(S.over ? c.owner : shownOwner(c, rel, playing), TS, c.id % 2), c.x * TS, c.y * TS);
  }

  const V = viewNow(rel, playing);
  drawFog(V);
  if (prodView) { drawProdView(); return; }   // Produktionsansicht: keine Einheiten, Marker, Effekte
  if (threatView && !playing && !S.over) drawThreat();   // Reichweite der Gegner (nicht während der Wiedergabe: Sie rechnet mit dem Endstand)

  // Wo eine Einheit gerade zu sehen ist: Während der Wiedergabe steht sie bis zu ihrem Zug am Startfeld und ist danach unterwegs (null) –
  // S.units kennt nur den Endstand. Feuerschutz und Luftdeckung richten sich danach (dem Nutzer aufgefallen: Der Ring der Luftdeckung
  // wartete schon am Zielort, während der Träger noch fuhr).
  // glide: auch unterwegs, mit Bruchteilen (der Ring der Luftdeckung fährt mit)
  const shownAt = (u, glide = false) => {
    const p = playing ? animPos(u, rel) : null;
    if (!p) return [u.x, u.y];
    return glide || (Number.isInteger(p[0]) && Number.isInteger(p[1])) ? p : null;
  };
  // Feuerunterstützung: Städte neben einem sichtbaren Schlachtschiff markieren.
  // Eckwinkel = unter Feuer (fällt zu 75 %), gestrichelter Ring = Feuerschutz (fällt nur zu 25 %)
  for (const b of S.units) {
    if (b.type !== 'bat' || b.carrier != null) continue;
    const bp = shownAt(b);
    if (!bp) continue;
    if (b.owner !== 0 && ((!V.vis[idx(bp[0], bp[1])] && !S.over) || veiledCity(cityAt(bp[0], bp[1])))) continue;   // in einer fremden Stadt: verborgen
    for (const [dx, dy] of [[0, 0], ...DIRS]) {
      const x = bp[0] + dx, y = bp[1] + dy;
      if (!inb(x, y)) continue;
      const c = cityAt(x, y);
      if (!c || !P.seen[idx(x, y)]) continue;
      drawSupportMark(x, y, (S.over ? c.owner : shownOwner(c, rel, playing)) === b.owner, PLAYERS[b.owner].light);
    }
  }
  // Luftdeckung: Schiffe neben einem sichtbaren Träger mit Jägern an Bord (gestrichelter Ring = geschützt).
  // Während der Wiedergabe zählen auch Schiffe mit, die erst im Lauf des Zugs untergehen (anim.gone) – sonst
  // verlören sie den Ring schon, bevor der Angriff auf sie gezeigt wird.
  const covered = new Set();
  const goneNow = playing ? anim.gone.filter(g => rel < g.until).map(g => g.u) : [];
  // [Einheit, gezeigte Lage (auch unterwegs), nächstes Feld]
  const placed = list => list.map(u => { const p = shownAt(u, true); return [u, p, [Math.round(p[0]), Math.round(p[1])]]; });
  const shipsNow = placed(S.units.filter(s => s.carrier == null && T(s).domain === 'sea' && (S.over || canSee(0, s))).concat(goneNow.filter(s => T(s).domain === 'sea')));
  const carriersNow = placed(S.units.filter(c => c.type === 'car' && c.carrier == null && (S.over || canSee(0, c)) && S.units.some(f => f.carrier === c.id && f.type === 'ftr'))
    .concat(goneNow.filter(c => c.air)))
    .filter(([c, , t]) => !(c.owner !== 0 && veiledCity(cityAt(t[0], t[1]))));   // Träger in einer fremden Stadt: verborgen
  for (const [c, , ct] of carriersNow) {
    for (const [s, sp, st] of shipsNow) {
      if (s.owner !== c.owner || cheb(st[0], st[1], ct[0], ct[1]) > 1) continue;
      const i = idx(st[0], st[1]);
      if (covered.has(i) || S.cityGrid[i] >= 0) continue;
      covered.add(i);
      drawSupportMark(sp[0], sp[1], true, PLAYERS[c.owner].light);
    }
  }

  // Wegeansicht: alle Märsche, Patrouillen und Marschziele – sonst nur das Marschziel der gewählten Stadt
  if (pathView) {
    if (!pathCache) pathCache = buildPathCache();
    for (const r of pathCache) drawRoute(r);
  } else if (selCity != null && S.cities[selCity] && S.cities[selCity].owner === 0 && S.cities[selCity].rally) {
    if (!rallyCache || rallyCache.id !== selCity) rallyCache = { id: selCity, route: rallyRoute(S.cities[selCity]) };
    drawRoute(rallyCache.route);
  }
  if (rallyMode && hover && S.cities[rallyMode.city]) {   // Vorschau beim Wählen eines Marschziels
    const rc = S.cities[rallyMode.city];
    drawRoute({ kind: 'rally', pts: [[rc.x, rc.y], hover] });
  }

  const su = selUnit();
  // Zugmarker der ausgewählten Einheit
  if (su && !(now < anim.t0 + (anim.coreEnd || 0) + 30)) for (const [x, y, kind] of moveHints(su)) drawHint(x, y, kind);

  // Einheiten
  const groups = new Map();
  const moving = [];
  for (const u of S.units) {
    if (u.carrier != null) continue;
    if (playing) {
      const p = animPos(u, rel);
      if (p) { moving.push([u, p]); continue; }
    }
    const i = idx(u.x, u.y);
    if (u.owner !== 0 && !S.over && (!V.vis[i] || (T(u).stealth && !u.surf && !P.sonar[i]))) continue;
    if (!groups.has(i)) groups.set(i, []);
    groups.get(i).push(u);
  }
  // Kampf um eine fremde Stadt mit verborgener Besatzung: Der Verteidiger, der standhält, zeigt sich, solange Explosion und Schriftzug
  // zu sehen sind (rv, hooks.combat); einer, der fällt, über anim.gone (ab g.from, vorher als Zeichen „besetzt“)
  const reveal = new Map();
  if (playing) for (const e of anim.events) if (e.rv && rel >= e.t0 - 120 && rel < e.t0 + 250 + LABEL_MS) reveal.set(idx(e.x, e.y), e.rv);
  for (const [i, list] of groups) {
    const x = i % S.W, y = (i / S.W) | 0;
    drawTileToken(list, i, su, x, y, reveal.get(i));
  }
  for (const [u, [x, y]] of moving) drawToken(u, x * TS, y * TS, TS, { badge: u.owner === 0 || S.over || CHEAT_FOG ? cargoOf(u).length : 0 });
  // Vernichtete und in einer Stadt aufgegangene Einheiten bleiben bis zu ihrem Moment sichtbar
  if (playing) for (const g of anim.gone) {
    if (rel >= g.until) continue;
    const [x, y] = animPos(g.u, rel) || [g.u.x, g.u.y];
    const still = Number.isInteger(x) && Number.isInteger(y);
    if (still && S.cityGrid[idx(x, y)] >= 0) {
      if (g.from != null && rel < g.from) drawGarrison(g.u.owner, x * TS + TS * 0.36, y * TS + TS * 0.36, TS * 0.66);
      else drawToken(g.u, x * TS + TS * 0.36, y * TS + TS * 0.36, TS * 0.66);
    }
    else drawToken(g.u, x * TS, y * TS, TS);
  }

  // Effekte
  if (playing) {
    for (const e of anim.events) {
      if (e.type === 'move' || rel < e.t0 || rel > e.t0 + e.dur) continue;
      drawEffect(e, (rel - e.t0) / e.dur);
    }
  }

  // Auswahl, Marschweg, Mausfeld
  const pulse = (Math.sin(now / 260) + 1) / 2;
  if (su && !(now < anim.t0 + (anim.coreEnd || 0) + 30)) {
    const route = patrolMode && patrolMode.id === su.id ? { pts: patrolMode.pts, start: [su.x, su.y], editing: true }
      : su.order && su.order.type === 'patrol' ? { pts: su.order.pts.slice(0, -1), start: su.order.start, editing: false } : null;
    if (route) drawPatrolRoute(route, now);
    if (su.order && su.order.type === 'goto') {
      const path = findPath(su, su.order.x, su.order.y);
      if (path && path.length) drawGotoPath(su.x, su.y, path, now);
    }
    drawSelRing(su.x, su.y, pulse, now);
    if (ping.seen !== su.id && !cam.active && !anim.after && !(pendingCenter && pendingCenter.id === su.id) && !captureQueue.length && !anyModalOpen()) {
      ping.seen = ping.id = su.id; ping.t0 = now;
    }
    if (ping.id === su.id && now - ping.t0 < PING_MS) drawSelPing(su.x, su.y, (now - ping.t0) / PING_MS);
    const gp = gotoPreviewFor(su), hp = showRoute ? hoverRoute(su) : null;
    if (hp && !(gp && gp.x === hp.x && gp.y === hp.y)) drawGotoConfirm(su, hp, false);
    if (gp) drawGotoConfirm(su, gp);
    // Sturm vom Schiff: Über jeder Stadt, die die Truppen des gewählten Transporters angreifen können, steht die Chance –
    // dauerhaft und pulsierend, damit man auf der Karte sieht, was jetzt möglich ist (Klick auf die Stadt oder Taste U)
    if (T(su).carries === 'land' && su.owner === 0) for (const o of assaultOptions(su)) drawAssaultChance(o.x, o.y, garrisonHidden(o.x, o.y) ? null : o.chance, pulse);
  } else if (selCity != null && !su) {
    const c = S.cities[selCity];
    if (c) drawSelRing(c.x, c.y, pulse, now); else selCity = null;
  }
  if (hover) {
    const [hx, hy] = hover;
    // nur Gegner, die die Einheit hier wirklich angreifen kann (wie in der Hinweiszeile): keine U-Boote für Bodentruppen,
    // kein Land für Zerstörer & Co., keine Schiffe im Hafen, wenn Bodentruppen die Stadt angreifen
    const seen = su && S.players[0].vis[idx(hx, hy)] ? topUnitsAt(hx, hy).filter(o => o.owner !== 0 && canSee(0, o)) : [];
    const en = seen.length ? cityDefenders(su, cityAt(hx, hy), seen).filter(o => canStrike(su, o)) : [];
    // fremde Stadt mit verborgener Besatzung: rot für jede Einheit, die dort angreifen oder erobern kann (ob nur Schiffe im Hafen liegen,
    // bleibt offen), aber keine Siegchance
    const hid = seen.length > 0 && garrisonHidden(hx, hy);
    drawHoverFrame(hx, hy, en.length > 0 || (hid && !!T(su).capture));
    if (!hid && en.length && canAttack(su.type) && cheb(su.x, su.y, hx, hy) <= 1) drawOdds(hx, hy, attackOdds(su, pickDefender(en), hx, hy));
  }
}

// Bausteine der Karte (auch für die Grafik-Übersicht): Zugmarker, Auswahlring, Marschweg, Chancen, Mausfeld
// Zugmarker: Punkt = Feld frei, goldener Punkt = an Bord gehen, rotes Fadenkreuz = angreifen
function drawHint(x, y, kind) {
  const cx = x * TS + TS / 2, cy = y * TS + TS / 2;
  if (kind === 'attack') {
    ctx.strokeStyle = 'rgba(255,95,85,0.9)'; ctx.lineWidth = Math.max(1.5, TS / 16);
    ctx.beginPath(); ctx.arc(cx, cy, TS * 0.36, 0, 7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - TS * 0.48, cy); ctx.lineTo(cx - TS * 0.24, cy); ctx.moveTo(cx + TS * 0.24, cy); ctx.lineTo(cx + TS * 0.48, cy);
    ctx.moveTo(cx, cy - TS * 0.48); ctx.lineTo(cx, cy - TS * 0.24); ctx.moveTo(cx, cy + TS * 0.24); ctx.lineTo(cx, cy + TS * 0.48);
    ctx.stroke();
  } else {
    ctx.fillStyle = kind === 'board' ? 'rgba(242,184,75,0.85)' : 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, TS * 0.09, 0, 7); ctx.fill();
  }
}
// Leuchtender Ring um die gewählte Einheit oder Stadt; pulse 0 … 1. Die gewählte Einheit wurde am Rand des Ausschnitts leicht übersehen
// (Hinweis des Nutzers), deshalb: dunkler Saum unter dem Ring (trägt auch auf Schnee und Wüste) und mit now ein Herzschlag – alle
// SEL_BEAT ms läuft eine Welle nach außen; Bewegung fällt auch im Augenwinkel auf. Nicht bei reduzierter Bewegung (calmMotion).
const SEL_BEAT = 1800;
const calmMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function drawSelRing(x, y, pulse, now) {
  const cx = x * TS + TS / 2, cy = y * TS + TS / 2, r = TS * (0.5 + 0.04 * pulse), lw = Math.max(2, TS / 11);
  ctx.save();
  const f = now == null || calmMotion ? 1 : (now % SEL_BEAT) / SEL_BEAT * 2;   // erste Hälfte Welle, zweite Ruhe
  if (f < 1) {
    ctx.strokeStyle = `rgba(255,236,160,${0.8 * (1 - f)})`; ctx.lineWidth = lw * (1 - f * 0.6);
    ctx.beginPath(); ctx.arc(cx, cy, r + TS * 0.62 * (1 - (1 - f) * (1 - f)), 0, 7); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(12,16,24,0.55)'; ctx.lineWidth = lw + 3;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  ctx.shadowColor = 'rgba(255,230,150,0.9)'; ctx.shadowBlur = TS * 0.3;
  ctx.strokeStyle = `rgba(255,${220 + pulse * 35},${120 + pulse * 120},0.95)`; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  ctx.restore();
}
// Suchring: Wechselt die Auswahl von selbst zu einer anderen Einheit (nächste Einheit nach einem Zug, Rundenbeginn, Tasten N und Leertaste)
// oder auf Taste F, ziehen sich zwei Ringe von weit außen auf sie zusammen – so findet das Auge sie auch am Rand des Ausschnitts, ohne
// dass die Karte jedes Mal in die Mitte springt. Erst wenn Kamera und Wiedergabe stehen und kein Fenster offen ist (render); nach einem
// Klick auf die Einheit nicht – dann weiß man, wo sie ist (pingSkip). f 0 … 1, r0 = Startradius in Pixeln.
const PING_MS = 700;
const ping = { seen: null, id: null, t0: -1e9 };
function pingSkip() { ping.seen = sel; }
function pingAgain() { ping.seen = null; }
function drawSelPing(x, y, f, r0 = Math.max(TS * 3.4, 130)) {
  const cx = x * TS + TS / 2, cy = y * TS + TS / 2, r1 = TS * 0.56;
  ctx.save();
  for (let k = 0; k < 2; k++) {
    const g = (f - k * 0.22) / 0.78;
    if (g <= 0 || g >= 1) continue;
    const e = 1 - Math.pow(1 - g, 3);              // schnell herein, sanft ankommen
    const r = r1 + (r0 - r1) * (1 - e), a = Math.min(1, g * 6) * (1 - g * 0.6);
    ctx.strokeStyle = `rgba(12,16,24,${0.5 * a})`; ctx.lineWidth = Math.max(3, TS / 9) + 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = `rgba(255,236,160,${a})`; ctx.lineWidth = Math.max(3, TS / 9);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  }
  ctx.restore();
}
// Marschweg der gewählten Einheit: laufende Striche von (x, y) über path, Kreis am Ziel
function drawGotoPath(x, y, path, now, col = 'rgba(255,255,255,0.75)') {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, TS / 14);
  ctx.setLineDash([TS * 0.16, TS * 0.14]); ctx.lineDashOffset = -now / 40;
  ctx.beginPath(); ctx.moveTo(x * TS + TS / 2, y * TS + TS / 2);
  for (const [px, py] of path) ctx.lineTo(px * TS + TS / 2, py * TS + TS / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const [ex, ey] = path[path.length - 1];
  ctx.beginPath(); ctx.arc(ex * TS + TS / 2, ey * TS + TS / 2, TS * 0.18, 0, 7); ctx.stroke();
  ctx.restore();
}
// Chance eines Sturms vom Schiff über der Stadt (hx, hy), pulsierend
// chance = null: Besatzung verborgen (garrisonHidden) – „⚔ ?“
function drawAssaultChance(hx, hy, chance, pulse) {
  const txt = chance == null ? '⚔ ?' : '⚔ ' + Math.round(chance * 100) + ' %';
  ctx.font = `700 ${Math.max(11, Math.round(TS * 0.42))}px system-ui, sans-serif`;
  const w = ctx.measureText(txt).width + 12, h = Math.max(16, TS * 0.6);
  const bx = hx * TS + TS / 2 - w / 2, by = hy * TS - h - 3 - pulse * TS * 0.08;
  roundRectPath(ctx, bx, by, w, h, h / 2);
  ctx.fillStyle = 'rgba(15,20,28,0.92)'; ctx.fill();
  ctx.strokeStyle = `rgba(255,95,85,${0.55 + 0.4 * pulse})`; ctx.lineWidth = Math.max(1.5, TS / 18); ctx.stroke();
  ctx.fillStyle = chance == null ? '#f2d38a' : chance >= 0.5 ? '#7ee2ae' : '#ff8a80';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, hx * TS + TS / 2, by + h / 2 + 0.5);
}
// Rahmen um das Feld unter der Maus – rot, wenn dort ein Gegner steht, den die gewählte Einheit angreifen kann
function drawHoverFrame(hx, hy, enemy) {
  ctx.strokeStyle = enemy ? 'rgba(255,110,100,0.9)' : 'rgba(255,255,255,0.45)';
  ctx.lineWidth = enemy ? 2 : 1;
  roundRectPath(ctx, hx * TS + 1.5, hy * TS + 1.5, TS - 3, TS - 3, TS * 0.15); ctx.stroke();
}
// Siegchance p (0 … 1) über dem Feld
function drawOdds(hx, hy, p) {
  const pct = Math.round(p * 100) + ' %';
  ctx.font = `700 ${Math.max(11, Math.round(TS * 0.42))}px system-ui, sans-serif`;
  const w = ctx.measureText(pct).width + 10, h = Math.max(16, TS * 0.6);
  const bx = hx * TS + TS / 2 - w / 2, by = hy * TS - h - 3;
  roundRectPath(ctx, bx, by, w, h, h / 2);
  ctx.fillStyle = 'rgba(15,20,28,0.9)'; ctx.fill();
  ctx.fillStyle = parseInt(pct) >= 50 ? '#7ee2ae' : '#ff8a80';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(pct, hx * TS + TS / 2, by + h / 2 + 0.5);
}

function drawPatrolRoute(route, now) {
  const ring = [route.start, ...route.pts];
  const c = p => [p[0] * TS + TS / 2, p[1] * TS + TS / 2];
  ctx.save();
  ctx.strokeStyle = 'rgba(127,224,208,0.9)'; ctx.lineWidth = Math.max(2, TS / 12);
  ctx.setLineDash([TS * 0.2, TS * 0.12]); ctx.lineDashOffset = -now / 35;
  ctx.beginPath();
  ctx.moveTo(...c(ring[0]));
  for (let k = 1; k < ring.length; k++) ctx.lineTo(...c(ring[k]));
  if (ring.length > 1) ctx.lineTo(...c(ring[0]));
  if (route.editing && hover) { ctx.moveTo(...c(ring[ring.length - 1])); ctx.lineTo(...c(hover)); }
  ctx.stroke();
  ctx.setLineDash([]);
  ring.forEach((p, k) => {
    const [x, y] = c(p), r = Math.max(7, TS * 0.22);
    ctx.fillStyle = k === 0 ? 'rgba(20,28,40,0.9)' : 'rgba(127,224,208,0.95)';
    ctx.strokeStyle = '#7fe0d0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - TS * 0.38, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = k === 0 ? '#7fe0d0' : '#0d2a26';
    ctx.font = '700 ' + Math.round(r * 1.2) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(k === 0 ? 'S' : String(k), x, y - TS * 0.38 + 0.5);
  });
  ctx.restore();
}

let lastFrame = 0;
// Klänge passend zur abgespielten Zeitleiste
function playAnimSounds(now) {
  const rel = now - anim.t0;
  for (const e of anim.events) {
    if (e.played || rel < e.t0) continue;
    e.played = true;
    if (rel > e.t0 + e.dur + 250) continue;
    if (e.type === 'cam') { camTo(e.cx, e.cy, e.dur * 0.95); continue; }
    eventSound(e, anim.byUnit);
  }
  if (anim.after && now >= anim.end) { const f = anim.after; anim.after = null; f(); }
  if (captureQueue.length && !anyModalOpen() && now >= captureReadyAt(captureQueue[0])) showCaptureDialog();
}
// Klang zu einem Ereignis der Zeitleiste (auch für die Animationen in der Grafik-Übersicht)
function eventSound(e, byUnit) {
  if (e.type === 'move') {
    // ein Geräusch pro zusammenhängender Bewegung, so lang wie die Animation
    const evs = byUnit.get(e.id);
    if (evs && evs[0] === e) {
      const lastE = evs[evs.length - 1];
      const dur = Math.min(2.8, Math.max(0.8, (lastE.t0 + lastE.dur - e.t0) / 1000 + 0.35));
      Sfx.move(e.utype, dur, e.owner === 0 ? 1 : 0.7);
    }
  }
  else if (e.type === 'salvo') Sfx.play('salvo', 60);
  else if (e.type === 'cover') Sfx.play('cover', 60);
  else if (e.type === 'boom') { Sfx.play('boom', 80); if (e.hl) setTimeout(() => Sfx.play('lost', 300), 380); }
  else if (e.type === 'capture') { if (e.owner === 0) Sfx.play('capture'); else if (e.lost) Sfx.play('cityLost'); else Sfx.play('boom', 80); }
}

// Wiedergabe der Gegnerzüge: Tempo und Überspringen
const ENEMY_STEP_MS = 220;
function skipAnim() {
  anim.t0 = -1e9; anim.end = 0; anim.skippable = false; cam.active = false;
  dirty = true;
}
function enemyPlaybackRunning(now = performance.now()) { return anim.skippable && animActive(now); }

// Hinweis über der Karte, solange die Zeitleiste nach dem Rundenende läuft: erst „Gegner zieht …“, dann – sobald die
// eigenen Einheiten ihre Befehle ausführen (Marsch, Patrouille, Erkunden) – „Deine Einheiten führen ihre Befehle aus …“.
let bannerMode = null;
function updateBanner(now) {
  let mode = !enemyPlaybackRunning(now) ? null : anim.ownFrom != null && now - anim.t0 >= anim.ownFrom ? 'own' : 'enemy';
  // mehrere Gegner: welcher gerade zieht (letzte Phase, die schon begonnen hat)
  let who = 1;
  if (mode === 'enemy' && anim.phases && anim.phases.length) {
    for (const ph of anim.phases) if (now - anim.t0 >= ph.at) who = ph.p;
    if (nPlayers() > 2) mode = 'enemy' + who;
  }
  if (mode === bannerMode) return;
  bannerMode = mode;
  const b = $('banner');
  b.hidden = !mode;
  if (!mode) return;
  b.classList.toggle('own', mode === 'own');
  const dot = nPlayers() > 2 ? `<i class="pdot" style="background:${PLAYERS[who].color}"></i>` : '';
  b.innerHTML = (mode === 'own' ? tt('Deine Einheiten führen ihre Befehle aus …', 'Your units are carrying out their orders …')
    : nPlayers() > 2 ? dot + tt(`${pname(who)} zieht …`, `${pname(who)} is moving …`) : tt('Gegner zieht …', 'Enemy is moving …'))
    + ' <span>' + tt('Klick oder beliebige Taste überspringt', 'Click or press any key to skip') + '</span>';
}
