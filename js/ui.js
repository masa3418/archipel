'use strict';
// ---------------------------------------------------------------------------
// Oberfläche: Zeichnen, Eingabe, Seitenleiste, Dialoge
// ---------------------------------------------------------------------------

const $ = id => document.getElementById(id);
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
function recGone(u, until) {
  if (u.carrier != null) return;   // an Bord: wird ohnehin nicht einzeln gezeichnet
  anim.gone.push({ u: { id: u.id, type: u.type, owner: u.owner, hp: Math.max(1, u.hp), x: u.x, y: u.y,
    air: u.type === 'car' && S.units.some(f => f.carrier === u.id && f.type === 'ftr') }, until });   // air: Träger gab Luftdeckung
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
  anim.events.push({ type: 'boom', x, y, t0: anim.cursor, dur: 650, win: won ? 'att' : 'def',
    hl: (a.owner === 0 && !won) || (d && d.owner === 0 && won) });
  const loser = won ? d : a;
  if (loser) recGone(loser, anim.cursor + 280);   // der Verlierer verschwindet in der Explosion
  // Ergebnis aus deiner Sicht als Schriftzug über dem Feld
  let label = null;
  // d === null: Eroberungsversuch einer unbesetzten Stadt ist gescheitert
  const city = cityAt(x, y);
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
// Wegeansicht (Schalter in der Seitenleiste, Taste G): zeichnet unter den Einheiten alle laufenden Märsche (weiß),
// Patrouillen (türkis) und die Marschziele der Städte (gelb). Anders als die Produktionsansicht ist sie nur eine
// zusätzliche Ebene – das Spiel läuft normal weiter, und sie bleibt an, bis man sie abschaltet.
// Die Wege werden nur nach Änderungen neu berechnet (refresh() verwirft pathCache), nicht in jedem Bild.
let pathView = false, pathCache = null, rallyCache = null;
let rallyMode = null;   // { city: id } – der nächste Klick auf die Karte setzt das Marschziel dieser Stadt
function updateViewSwitch() {
  $('vUnits').classList.toggle('on', !prodView && !pathView);
  $('vProd').classList.toggle('on', prodView);
  $('vPaths').classList.toggle('on', pathView);
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

  // Feuerunterstützung: Städte neben einem sichtbaren Schlachtschiff markieren.
  // Eckwinkel = unter Feuer (fällt zu 75 %), gestrichelter Ring = Feuerschutz (fällt nur zu 25 %)
  for (const b of S.units) {
    if (b.type !== 'bat' || b.carrier != null) continue;
    if (b.owner !== 0 && !V.vis[idx(b.x, b.y)] && !S.over) continue;
    for (const [dx, dy] of [[0, 0], ...DIRS]) {
      const x = b.x + dx, y = b.y + dy;
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
  const shipsNow = S.units.filter(s => s.carrier == null && T(s).domain === 'sea' && (S.over || canSee(0, s))).concat(goneNow.filter(s => T(s).domain === 'sea'));
  const carriersNow = S.units.filter(c => c.type === 'car' && c.carrier == null && (S.over || canSee(0, c)) && S.units.some(f => f.carrier === c.id && f.type === 'ftr'))
    .concat(goneNow.filter(c => c.air));
  for (const c of carriersNow) {
    for (const s of shipsNow) {
      if (s.owner !== c.owner || cheb(s.x, s.y, c.x, c.y) > 1) continue;
      const i = idx(s.x, s.y);
      if (covered.has(i) || S.cityGrid[i] >= 0) continue;
      covered.add(i);
      drawSupportMark(s.x, s.y, true, PLAYERS[c.owner].light);
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
  for (const [i, list] of groups) {
    const x = i % S.W, y = (i / S.W) | 0;
    const show = list.find(u => su && (u === su || u.id === su.carrier)) || list.find(u => u.owner === 0 && u.moves > 0 && !u.order) || list[0];
    const inCity = S.cityGrid[i] >= 0;
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
  for (const [u, [x, y]] of moving) drawToken(u, x * TS, y * TS, TS, { badge: u.owner === 0 || S.over || CHEAT_FOG ? cargoOf(u).length : 0 });
  // Vernichtete und in einer Stadt aufgegangene Einheiten bleiben bis zu ihrem Moment sichtbar
  if (playing) for (const g of anim.gone) {
    if (rel >= g.until) continue;
    const [x, y] = animPos(g.u, rel) || [g.u.x, g.u.y];
    const still = Number.isInteger(x) && Number.isInteger(y);
    if (still && S.cityGrid[idx(x, y)] >= 0) drawToken(g.u, x * TS + TS * 0.36, y * TS + TS * 0.36, TS * 0.66);
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
    drawSelRing(su.x, su.y, pulse);
    const gp = gotoPreviewFor(su), hp = showRoute ? hoverRoute(su) : null;
    if (hp && !(gp && gp.x === hp.x && gp.y === hp.y)) drawGotoConfirm(su, hp, false);
    if (gp) drawGotoConfirm(su, gp);
    // Sturm vom Schiff: Über jeder Stadt, die die Truppen des gewählten Transporters angreifen können, steht die Chance –
    // dauerhaft und pulsierend, damit man auf der Karte sieht, was jetzt möglich ist (Klick auf die Stadt oder Taste U)
    if (T(su).carries === 'land' && su.owner === 0) for (const o of assaultOptions(su)) drawAssaultChance(o.x, o.y, o.chance, pulse);
  } else if (selCity != null && !su) {
    const c = S.cities[selCity];
    if (c) drawSelRing(c.x, c.y, pulse); else selCity = null;
  }
  if (hover) {
    const [hx, hy] = hover;
    // nur Gegner, die die Einheit hier wirklich angreifen kann (wie in der Hinweiszeile): keine U-Boote für Bodentruppen,
    // kein Land für Zerstörer & Co., keine Schiffe im Hafen, wenn Bodentruppen die Stadt angreifen
    const seen = su && S.players[0].vis[idx(hx, hy)] ? topUnitsAt(hx, hy).filter(o => o.owner !== 0 && canSee(0, o)) : [];
    const en = seen.length ? cityDefenders(su, cityAt(hx, hy), seen).filter(o => canStrike(su, o)) : [];
    drawHoverFrame(hx, hy, en.length > 0);
    if (en.length && canAttack(su.type) && cheb(su.x, su.y, hx, hy) <= 1) drawOdds(hx, hy, attackOdds(su, pickDefender(en), hx, hy));
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
// leuchtender Ring um die gewählte Einheit oder Stadt; pulse 0 … 1
function drawSelRing(x, y, pulse) {
  const cx = x * TS + TS / 2, cy = y * TS + TS / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(255,230,150,0.9)'; ctx.shadowBlur = TS * 0.3;
  ctx.strokeStyle = `rgba(255,${220 + pulse * 35},${120 + pulse * 120},0.95)`; ctx.lineWidth = Math.max(2, TS / 11);
  ctx.beginPath(); ctx.arc(cx, cy, TS * (0.5 + 0.04 * pulse), 0, 7); ctx.stroke();
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
function drawAssaultChance(hx, hy, chance, pulse) {
  const txt = '⚔ ' + Math.round(chance * 100) + ' %';
  ctx.font = `700 ${Math.max(11, Math.round(TS * 0.42))}px system-ui, sans-serif`;
  const w = ctx.measureText(txt).width + 12, h = Math.max(16, TS * 0.6);
  const bx = hx * TS + TS / 2 - w / 2, by = hy * TS - h - 3 - pulse * TS * 0.08;
  roundRectPath(ctx, bx, by, w, h, h / 2);
  ctx.fillStyle = 'rgba(15,20,28,0.92)'; ctx.fill();
  ctx.strokeStyle = `rgba(255,95,85,${0.55 + 0.4 * pulse})`; ctx.lineWidth = Math.max(1.5, TS / 18); ctx.stroke();
  ctx.fillStyle = chance >= 0.5 ? '#7ee2ae' : '#ff8a80';
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

// ------------------------------------------------------------------ Landemanöver: „Ausladen, wenn möglich“
// Je Transporter einschaltbar (u.landing, Standard aus). Sobald der Transporter Land berührt, werden seine Truppen geweckt und
// nacheinander zum Aussteigen angeboten – solange ein freies Landfeld, eine eigene Stadt oder (für Infanterie und Panzer) eine
// fremde Stadt angrenzt (canDisembark in game.js). Weil die Truppen damit als wartend zählen, endet die Runde nicht von selbst,
// während ein voller Transporter ungeschützt an der Küste liegt. Ist er leer, schaltet sich der Status von selbst ab.
// landingUpdate() bringt alle Transporter auf Stand und liefert die erste Einheit, die jetzt aussteigen kann.
function landingUpdate() {
  let first = null;
  if (!S) return null;
  for (const tr of S.units) {
    if (tr.owner !== 0 || !tr.landing) continue;
    const cargo = cargoOf(tr);
    if (!cargo.length) { delete tr.landing; continue; }
    for (const o of cargo) {
      if (T(o).domain !== 'land') continue;
      if (canDisembark(o, tr)) {
        if (o.order && o.order.type === 'sentry') o.order = null;      // wecken
        if (!first && needsOrders(o)) first = o;
      } else if (!o.order) o.order = { type: 'sentry' };               // nichts mehr frei oder kein Zug: weiterschlafen
    }
  }
  return first;
}
function actLanding() {
  const u = selUnit(); if (!u || T(u).carries !== 'land') return;
  if (u.landing) {
    delete u.landing;
    for (const o of cargoOf(u)) if (!o.order) o.order = { type: 'sentry' };
    toast(tt('Ausladen, wenn möglich: aus', 'Unload when possible: off'));
  } else {
    if (!cargoOf(u).length) { toast(tt('Niemand an Bord', 'Nobody on board')); Sfx.play('error'); return; }
    u.landing = true;
    const first = landingUpdate();
    toast(tt('Ausladen, wenn möglich: an – an Land werden die Truppen von selbst zum Aussteigen angeboten', 'Unload when possible: on – at the coast the troops are offered for disembarking by themselves'), 3500);
    if (first) select(first);
  }
  Sfx.play('tick');
  refresh(); scheduleAutoEnd();
}

// ------------------------------------------------------------------ Rückfrage: Angriff vom Schiff
// Liegt ein beladener Transporter ohne Befehl vor einer neutralen oder feindlichen Stadt – oder ohne eigenen Zug neben einer
// feindlichen Einheit am Ufer, die ihn in der Gegnerrunde angreifen könnte –, fragt das Spiel einmal je Runde,
// ob die Truppen angreifen sollen – beim Ankommen und zu Rundenbeginn, sobald keine Animation und kein anderes Fenster offen
// ist (landingStep in der Hauptschleife). „Nicht angreifen“ gilt für diese Runde (u.noAssault); wer das Fenster nur schließt,
// entscheidet später – der Transporter wartet dann weiter, und die Runde endet nicht von selbst.
let landCheck = false;
function openLandingDialog(u) {
  const tg = landingOption(u);
  if (!tg) return;
  u.landAsked = S.turn;
  // Karte auf den Transporter: einen laufenden Schwenk (z. B. zur nächsten Einheit nach der Wiedergabe) ersetzen
  select(u, false);
  pendingCenter = null;
  focusOn(u.x, u.y);
  refresh();
  const cnt = {};
  for (const o of cargoOf(u)) cnt[o.type] = (cnt[o.type] || 0) + 1;
  const list = UNIT_ORDER.filter(k => cnt[k]).map(k => `${cnt[k]} × ${UT[k].name}`).join(', ');
  const name = esc(tg.name), pct = Math.round(tg.chance * 100);
  if (tg.kind === 'city') {
    const neutral = tg.city.owner === -1;
    $('landTitle').textContent = tt(`Vor ${tg.name}: angreifen?`, `Off ${tg.name}: attack?`);
    $('landText').innerHTML = tt(`Dein Transporter liegt vor der ${neutral ? 'neutralen' : 'feindlichen'} Stadt <b>${name}</b>. An Bord: ${list}.<br><br>Die Truppen können sofort vom Schiff aus angreifen – erst Infanterie, dann Panzer, bis die Stadt fällt. Chance des ersten Angriffs: <b>${pct} %</b>.`,
      `Your transport lies off the ${neutral ? 'neutral' : 'enemy'} city of <b>${name}</b>. On board: ${list}.<br><br>The troops can attack straight from the ship – infantry first, then tanks, until the city falls. Chance of the first attack: <b>${pct} %</b>.`);
  } else {
    const d = tg.target;
    $('landTitle').textContent = tt(`Feind am Ufer: angreifen?`, `Enemy on the shore: attack?`);
    $('landText').innerHTML = tt(`Direkt neben deinem Transporter steht eine feindliche Einheit: <b>${name}</b> (${d.hp}/${T(d).hp}). Der Transporter hat keinen Zug mehr und läge in der Gegnerrunde schutzlos daneben. An Bord: ${list}.<br><br>Die Truppen können sie sofort vom Schiff aus angreifen; wer siegt, geht dabei an Land. Chance des besten Angreifers: <b>${pct} %</b>.`,
      `Right next to your transport stands an enemy unit: <b>${name}</b> (${d.hp}/${T(d).hp}). The transport has no moves left and would lie defenceless beside it during the enemy turn. On board: ${list}.<br><br>The troops can attack it straight from the ship; the winner goes ashore. Chance of the best attacker: <b>${pct} %</b>.`);
  }
  $('landYes').textContent = '⚔ ' + tt('Angreifen', 'Attack');
  $('landShore').textContent = tt('Nur an Land setzen', 'Just put ashore');
  $('landNo').textContent = tt('Nicht angreifen', 'Do not attack');
  $('landYes').onclick = () => { closeModals(); const t2 = alive(u) ? assaultOptions(u).find(o => o.x === tg.x && o.y === tg.y) : null; if (t2) doAssault(u, t2); };
  $('landShore').onclick = () => { closeModals(); if (alive(u)) { sel = u.id; actUnload(true); } };
  $('landNo').onclick = () => {
    closeModals();
    u.noAssault = S.turn;                      // für diese Runde entschieden
    if (!needsOrders(u)) selectNext();
    refresh(); scheduleAutoEnd();
  };
  Sfx.play('tick');
  openModal('mLanding');
}
function landingStep(now) {
  if (!landCheck || !S || S.over) return;
  if (animActive(now) || anyModalOpen() || captureQueue.length || patrolMode || rallyMode) return;
  const u = S.units.find(o => o.landAsked !== S.turn && landingPending(o));
  if (!u) { landCheck = false; return; }
  openLandingDialog(u);
}

function loop(now) {
  updateBanner(now);
  requestAnimationFrame(loop);
  if (S) {
    landingStep(now);
    pendingCenterStep(now);
    autoEndStep(now);
    playAnimSounds(now);
    camStep(now);
    const su = S.over ? null : selUnit();
    Sfx.setLoop(su ? su.type : null);
  }
  if (!S) return;
  const busy = animActive(now) || sel != null || selCity != null;
  if (!dirty && !busy) return;
  if (!dirty && now - lastFrame < 33) return;
  lastFrame = now; dirty = false;
  render(now);
}

function renderMini() {
  const s = Math.max(1, Math.floor(296 / S.W));
  if (mini.width !== S.W * s) { mini.width = S.W * s; mini.height = S.H * s; }
  const P = S.players[0];
  const img = mctx.createImageData(S.W * s, S.H * s);
  const put = (x, y, c) => {
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      const o = ((y * s + dy) * S.W * s + x * s + dx) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
  };
  for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) {
    const i = idx(x, y);
    let c = [8, 11, 16];
    if (P.seen[i] || S.over) {
      c = S.terrain[i] ? [86, 140, 70] : [34, 92, 146];
      if (!P.vis[i] && !S.over) c = c.map(v => v * 0.6);
    }
    put(x, y, c);
  }
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  for (const c of S.cities) {
    if (!P.seen[idx(c.x, c.y)] && !S.over) continue;
    const o = S.over ? c.owner : P.knownOwner[c.id];
    put(c.x, c.y, hex(ownerPal(o).light));
  }
  for (const u of S.units) {
    if (u.carrier != null) continue;
    if (u.owner !== 0 && !canSee(0, u) && !S.over) continue;
    if (S.cityGrid[idx(u.x, u.y)] >= 0) continue;
    put(u.x, u.y, u.owner === 0 ? [120, 180, 255] : u.owner === 1 ? [255, 110, 100] : hex(PLAYERS[u.owner].light));   // weitere Gegner in ihrer Farbe
  }
  mctx.putImageData(img, 0, 0);
  // Sichtfenster
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1;
  mctx.strokeRect(view.x / TS * s + 0.5, view.y / TS * s + 0.5, wrap.clientWidth / TS * s, wrap.clientHeight / TS * s);
}

// ------------------------------------------------------------------ Hilfen
function selUnit() {
  if (sel == null) return null;
  const u = unitById(sel);
  if (!u) sel = null;
  return u;
}

function toast(msg, ms = 1800) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), ms);
}

function centerOn(x, y, force = false) {
  const px = x * TS + TS / 2, py = y * TS + TS / 2;
  const m = TS * 3;
  const vx = view.x, vy = view.y, vw = wrap.clientWidth, vh = wrap.clientHeight;
  if (force || px < vx + m || px > vx + vw - m || py < vy + m || py > vy + vh - m) {
    view.x = px - vw / 2; view.y = py - vh / 2;
  }
}

// Weicher Schwenk auf ein Feld, falls es nicht schon gut sichtbar ist (always: immer in die Mitte)
function focusOn(x, y, always = false) {
  if (!always && inViewMargin(x, y)) { cam.active = false; return; }
  pan(x + 0.5, y + 0.5, 450);
}
// Knopf ⌖ / Taste F: Karte auf die ausgewählte Einheit (bzw. Stadt) zentrieren – nach dem Umsehen auf der Karte
function actFocus() {
  const u = selUnit(), c = selCity != null ? S.cities[selCity] : null;
  const t = u || c;
  if (!t) { toast(tt('Keine Einheit ausgewählt', 'No unit selected')); Sfx.play('error'); return; }
  pendingCenter = null;
  focusOn(t.x, t.y, true);
  dirty = true;
}

// Zoom; ax/ay = Punkt im Sichtfenster (Pixel), der dabei an seiner Stelle bleibt
// (Standard: Mitte; beim Mausrad: die Mausposition)
function setZoom(nts, ax = wrap.clientWidth / 2, ay = wrap.clientHeight / 2) {
  nts = Math.max(14, Math.min(48, nts));
  if (nts === TS) return;
  const cx = (view.x + ax) / TS, cy = (view.y + ay) / TS;
  TS = nts;
  resizeCanvas();
  cam.active = false;
  view.x = cx * TS - ax; view.y = cy * TS - ay;
  try { localStorage.setItem('archipel-zoom', String(TS)); } catch (e) {}
  render();
}

function resizeCanvas() {
  cv.width = S.W * TS; cv.height = S.H * TS;
  applyPad();
  buildTerrainCache();
}

function select(u, center = true) {
  if (patrolMode && (!u || u.id !== patrolMode.id)) patrolMode = null;
  rallyMode = null; gotoPreview = null;
  if (!u) { sel = null; return; }
  sel = u.id;
  if (u.order && u.order.type === 'sentry') u.order = null;
  const c = cityAt(u.x, u.y);
  selCity = c && c.owner === 0 ? c.id : null;
  if (center) { pendingCenter = null; centerOn(u.x, u.y); }
}

// Verzögerter, weicher Kameraschwenk zur nächsten Einheit
let pendingCenter = null;
function inViewMargin(x, y, m = 3) {
  const px = x * TS + TS / 2, py = y * TS + TS / 2, mm = TS * m;
  return px >= view.x + mm && px <= view.x + wrap.clientWidth - mm &&
         py >= view.y + mm && py <= view.y + wrap.clientHeight - mm;
}
function pendingCenterStep(now) {
  if (!pendingCenter || now < pendingCenter.at) return;
  // Solange ein Fenster offen ist oder gleich kommt (Eroberung, Landung), bleibt die Karte, wo sie ist – es bezieht sich auf diese Stelle
  if (anyModalOpen() || captureQueue.length) return;
  const pc = pendingCenter; pendingCenter = null;
  const u = selUnit();
  if (!u || u.id !== pc.id) return;
  if (!inViewMargin(u.x, u.y)) pan(u.x + 0.5, u.y + 0.5, 550);
}

// Beladener Transporter neben einer neutralen oder feindlichen Stadt: Seine Truppen haben ihren Zug noch und können vom Schiff aus
// angreifen – auch wenn der Transporter selbst keinen Zug mehr hat. Er gilt deshalb als „wartend“, bis der Spieler angreift,
// an Land setzt oder ihn überspringt. Sonst endete die Runde von selbst, und der Transporter läge eine Gegnerrunde lang
// schutzlos vor der Stadt.
function landingOption(u) {
  return assaultOptions(u).find(o => o.kind === 'city' || u.moves <= 0) || null;
}
function landingPending(u) {
  return u.owner === 0 && !u.skip && !u.order && u.carrier == null && T(u).carries === 'land' && !u.landing && u.noAssault !== S.turn && !!landingOption(u);
}
function needsOrders(u) {
  if (landingPending(u)) return true;
  if (u.owner !== 0 || u.moves <= 0 || u.order || u.skip) return false;
  // Bodentruppen an Bord: nur dann „wartend“, wenn der Transporter an einer Küste
  // liegt (nicht im eigenen Hafen) – mitten auf See können sie ohnehin nichts tun
  if (u.carrier != null && T(u).domain === 'land') {
    const tr = unitById(u.carrier);
    if (!tr) return false;
    const c = cityAt(tr.x, tr.y);
    if (c && c.owner === 0) return false;
    return canDisembark(u, tr);   // freies Landfeld, eigene Stadt oder (Infanterie/Panzer) fremde Stadt daneben
  }
  return true;
}

// „Nächste Einheit“: der Reihe nach durch alle wartenden Einheiten (feste
// Reihenfolge), die aktuelle bleibt dabei wartend
function actNext() {
  const list = S.units.filter(needsOrders).sort((a, b) => a.id - b.id);
  if (!list.length) { toast(tt('Keine Einheit wartet mehr', 'No units waiting')); Sfx.play('error'); refresh(); return; }
  const cur = selUnit();
  const nxt = list.find(u => cur && u.id > cur.id) || list[0];
  if (cur && nxt === cur) toast(tt('Das ist die letzte wartende Einheit', 'This is the last waiting unit'));
  select(nxt); centerOn(nxt.x, nxt.y);
  Sfx.play('select');
  refresh();
}

function selectNext(center = true) {
  const cur = selUnit();
  const list = S.units.filter(needsOrders);
  if (!list.length) { sel = null; return false; }
  const ref = cur || list[0];
  list.sort((a, b) => cheb(ref.x, ref.y, a.x, a.y) - cheb(ref.x, ref.y, b.x, b.y));
  select(list[0], center);
  return true;
}

// ------------------------------------------------------------------ Automatisches Rundenende
// Hat nach einer Aktion keine Einheit mehr Befehle offen, endet die Runde nach
// einem kurzen Countdown von selbst. Jeder Klick oder Tastendruck bricht ab.
const AUTO_END_MS = 1400;
let autoEnd = true;
try { autoEnd = localStorage.getItem('archipel-autoend') !== '0'; } catch (e) {}
let autoEndAt = 0;
function scheduleAutoEnd() {
  if (!autoEnd || !S || S.over || patrolMode || rallyMode) return;
  if (S.units.some(needsOrders)) return;
  if ([...document.querySelectorAll('.modal')].some(m => !m.hidden)) return;
  autoEndAt = Math.max(performance.now(), anim.end, pendingCenter ? pendingCenter.at : 0) + AUTO_END_MS;
}
function cancelAutoEnd() {
  if (!autoEndAt) return;
  autoEndAt = 0;
  updateEndTurnButton();
}
function autoEndStep(now) {
  if (!autoEndAt) return;
  const left = autoEndAt - now;
  const b = $('endTurn');
  if (left <= 0) { autoEndAt = 0; b.style.removeProperty('--auto'); endHumanTurn(); return; }
  b.classList.add('auto');
  b.style.setProperty('--auto', Math.min(100, 100 - left / AUTO_END_MS * 100).toFixed(1) + '%');
  b.innerHTML = tt('Runde endet gleich … <small>(Klick/Taste: abbrechen)</small>', 'Turn ends soon … <small>(click/key: cancel)</small>');
}

function afterAction(u) {
  computeVision(0);
  landCheck = true;   // liegt jetzt ein beladener Transporter vor einer fremden Stadt? (Rückfrage, siehe landingStep)
  const landFirst = landingUpdate();   // „Ausladen, wenn möglich“: Truppen wecken bzw. Status abschalten, wenn leer
  if (landFirst && u && alive(u) && u.landing && landFirst.carrier === u.id) {   // der Transporter hat gerade Land berührt
    if (checkGameOver()) showGameOver();
    select(landFirst); refresh(); scheduleAutoEnd();
    return;
  }
  if (checkGameOver()) { showGameOver(); }
  if (!u || !alive(u) || u.order || (u.moves <= 0 && !landingPending(u))) {
    // Erst zu Ende ansehen lassen, was gerade passiert ist (Kampf, Eroberung),
    // dann weich zur nächsten Einheit schwenken
    const dramatic = anim.events.some(e => e.type === 'boom' || e.type === 'capture');
    const pause = dramatic ? -400 : 250;   // anim.end enthält schon den Schriftzug
    if (selectNext(false)) pendingCenter = { id: sel, at: Math.max(performance.now(), anim.end) + pause };
  }
  else { const c = cityAt(u.x, u.y); selCity = c && c.owner === 0 ? c.id : null; centerOn(u.x, u.y); }
  refresh();
  scheduleAutoEnd();
}

function refresh() { dirty = true; pathCache = null; rallyCache = null; hoverPath = null; renderMini(); updatePanel(); updateHeader(); updateKeyLegend(); queueSave(); }

// Automatisch speichern nach jeder Änderung (refresh folgt auf jeden Zug, Angriff, Befehl): gebündelt kurz danach und beim Verlassen
// der Seite. Ein Spielstand braucht unter 1 ms. So geht beim Neuladen oder Absturz nichts verloren – und ein verlorener Kampf lässt sich
// nicht durch Neuladen wiederholen.
function queueSave() {
  clearTimeout(queueSave.t);
  queueSave.t = setTimeout(() => { if (S) saveGame(); }, 300);
}
window.addEventListener('pagehide', () => { clearTimeout(queueSave.t); if (S) saveGame(); });

// Installierbare App (nur online): sw.js und manifest.webmanifest liegen auf GitHub Pages, nicht im Release. Über file://
// (Offline-Fassung) gibt es keinen Service Worker – dort wird er gar nicht erst angemeldet.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ------------------------------------------------------------------ Aktionen
// geortete getauchte U-Boote des Gegners (für die Meldung „Sonarkontakt“ nach einem eigenen Zug)
function locatedSubs() { return S.units.filter(o => o.owner !== 0 && o.carrier == null && T(o).stealth && !o.surf && canSee(0, o)); }
// Angriff vom Schiff auf ein bestimmtes Ziel (Knopf, Taste U, Klick oder Richtungstaste auf das Ziel, Rückfrage)
function doAssault(u, opt) {
  animBegin(140);
  const r = assaultFrom(u, opt);
  animEnd();
  if (opt.kind === 'city' && !r.captured) toast(tt(`Angriff auf ${opt.name} abgewehrt`, `Attack on ${opt.name} repelled`));
  if (opt.kind === 'unit' && !r.cleared) toast(tt(`Angriff gescheitert – ${opt.name} hält das Ufer`, `Attack failed – ${opt.name.toLowerCase()} holds the shore`));
  afterAction(u);
}
// Der Transporter hat selbst keinen Zug mehr, seine Truppen können aber noch angreifen: sagen, was jetzt geht
function explainLanding(u) {
  const tg = landingOption(u), city = tg.kind === 'city';
  toast(tt(`Der Transporter hat in dieser Runde keinen Zug mehr. Seine Truppen können noch angreifen: Klick auf ${city ? tg.name : 'den Gegner am Ufer'}${city ? ' oder Taste U' : ''} – Leertaste überspringt.`,
    `The transport has no moves left this turn. Its troops can still attack: click ${city ? tg.name : 'the enemy on the shore'}${city ? ' or press U' : ''} – Space skips.`), 5000);
  Sfx.play('error');
}
function doMove(u, x, y) {
  if (T(u).carries === 'land' && u.owner === 0) {
    const opt = assaultOptions(u).find(o => o.x === x && o.y === y);
    if (opt) { doAssault(u, opt); return; }                            // Klick oder Richtungstaste auf Stadt oder Gegner am Ufer
    if (u.moves <= 0 && landingPending(u)) { explainLanding(u); return; }
  }
  u.order = null;
  const before = new Set(locatedSubs().map(o => o.id));
  animBegin(120);
  const r = sailStep(u, x, y);   // wie moveStep; ein Transporter nimmt beim Auslaufen die wartenden Truppen der Stadt mit
  animEnd();
  if (!r.ok) { toast(r.msg); Sfx.play('error'); }
  else if (r.picked) { toast(tt(`${r.picked === 1 ? '1 Einheit' : r.picked + ' Einheiten'} aus der Stadt mitgenommen (${cargoOf(u).length}/${T(u).capacity})`, `${r.picked === 1 ? '1 unit' : r.picked + ' units'} taken along from the city (${cargoOf(u).length}/${T(u).capacity})`)); Sfx.play('clank'); }
  else if (r.boarded) Sfx.play('clank');
  afterAction(u);
  const found = locatedSubs().filter(o => !before.has(o.id));
  if (found.length) {
    addLog(tt('Sonarkontakt: feindliches U-Boot geortet.', 'Sonar contact: enemy submarine located.'), 'bad', found[0].x, found[0].y);
    Sfx.play('alarm'); refresh();
  }
}

function doGoto(u, x, y) {
  if (u.moves <= 0 && landingPending(u)) { explainLanding(u); return; }   // kein Marschbefehl aus Versehen, solange die Truppen noch angreifen können
  // Jäger: Ziel weiter als der Treibstoff reicht → ablehnen (er stürzte unterwegs ab); kommt er hin, aber nicht zurück → warnen
  if (T(u).fuel) {
    const p = findPath(u, x, y, false);
    if (p && p.length > u.fuel) {
      toast(tt(`Treibstoff reicht nicht: Ziel ${p.length} Felder entfernt, Treibstoff für ${u.fuel}`, `Not enough fuel: target ${p.length} tiles away, fuel for ${u.fuel}`), 2600);
      Sfx.play('error'); return;
    }
    const c = cityAt(x, y);
    if (p && !(c && c.owner === 0) && u.fuel - p.length < distHome(0, x, y))
      toast(tt('Achtung: Von dort reicht der Treibstoff nicht mehr bis zur nächsten Stadt oder zum Träger.', 'Careful: from there the fuel will not reach the nearest city or carrier.'), 3200);
  }
  u.order = { type: 'goto', x, y };
  animBegin(95);
  runGoto(u);
  animEnd();
  afterAction(u);
}

function actSkip() { const u = selUnit(); if (!u) return; Sfx.play('tick'); u.skip = true; if (!selectNext()) sel = null; refresh(); scheduleAutoEnd(); }
function actSentry() { const u = selUnit(); if (!u) return; Sfx.play('tick'); u.order = { type: 'sentry' }; selectNext(); refresh(); scheduleAutoEnd(); }
function actLoad() {
  const u = selUnit(); if (!u || !T(u).carries) return;
  if (T(u).carries !== 'land') {   // Träger: wie bisher einmalig die Jäger aus der Stadt an Bord nehmen
    const n = loadUnits(u);
    Sfx.play(n ? 'clank' : 'error');
    toast(n ? tt(`${n} Einheit(en) eingeladen`, `${n} unit${n === 1 ? '' : 's'} loaded`) : tt('Nichts zum Einladen in dieser Stadt', 'Nothing to load in this city'));
    refresh();
    return;
  }
  // Transporter: Dauerbefehl – bleibt liegen, bis er voll ist (Regeln: runLoad in game.js)
  const cap = T(u).capacity;
  if (cargoOf(u).length >= cap) { toast(tt('Der Transporter ist schon voll', 'The transport is already full')); Sfx.play('error'); return; }
  u.order = { type: 'load' };
  delete u.dropped;
  animBegin(120);
  const n = runLoad(u);
  animEnd();
  Sfx.play(n ? 'clank' : 'tick');
  const k = cargoOf(u).length;
  toast(!u.order ? tt(`Voll beladen (${k}/${cap})`, `Fully loaded (${k}/${cap})`)
    : tt(`${n ? n + ' eingeladen – ' : ''}bleibt liegen und lädt, bis er voll ist (${k}/${cap})`, `${n ? n + ' loaded – ' : ''}stays put and loads until full (${k}/${cap})`));
  afterAction(u);
}
// Ausladen. Sonderfall: Liegt der Transporter neben einer neutralen oder feindlichen Stadt, greifen die Truppen sie direkt vom
// Schiff aus an (assaultTarget/assaultFrom in game.js) – sonst kostete das Aussteigen ihren Zug und der Angriff käme erst in der
// nächsten Runde. landOnly = true setzt sie trotzdem nur an Land (eigener Knopf).
function actUnload(landOnly = false) {
  const u = selUnit(); if (!u || !T(u).carries) return;
  if (!cargoOf(u).length) { toast(tt('Niemand an Bord', 'Nobody on board')); return; }
  const tgt = landOnly === true ? null : assaultOptions(u).find(o => o.kind === 'city');
  if (tgt) { doAssault(u, tgt); return; }
  animBegin(120);
  const n = unloadAll(u);
  animEnd();
  if (!n) Sfx.play('error');
  toast(n ? tt(`${n} Einheit(en) ausgeladen`, `${n} unit${n === 1 ? '' : 's'} unloaded`) : tt('Kein freies Feld zum Ausladen', 'No free tile to unload'));
  afterAction(u);
}
// Heimkehr: Marsch zur nächsten erreichbaren eigenen Stadt (Schiffe: Hafenstadt)
function actHome() {
  const u = selUnit(); if (!u) return;
  const t = T(u);
  const ok = c => c && c.owner === 0 && (t.domain !== 'sea' || c.coastal);
  const here = cityAt(u.x, u.y);
  if (u.carrier == null && ok(here)) { toast(t.domain === 'sea' ? tt('Liegt schon im Hafen', 'Already in port') : tt('Steht schon in einer eigenen Stadt', 'Already in one of your cities')); Sfx.play('error'); return; }
  const path = bfs(u.x, u.y, makePassable(u, false, true), (x, y) => ok(cityAt(x, y)));
  if (!path) { toast(t.domain === 'sea' ? tt('Kein eigener Hafen erreichbar', 'No port of yours in reach') : tt('Keine eigene Stadt erreichbar', 'None of your cities in reach')); Sfx.play('error'); return; }
  const [x, y] = path[path.length - 1];
  if (t.fuel && path.length > u.fuel) {
    // Nicht losschicken: der Resttreibstoff bleibt dem Spieler (z. B. zum Erkunden)
    toast(tt(`Treibstoff reicht nicht: ${cityAt(x, y).name} ist ${path.length} Felder entfernt, Treibstoff für ${u.fuel}`,
      `Not enough fuel: ${cityAt(x, y).name} is ${path.length} tiles away, fuel for ${u.fuel}`));
    Sfx.play('error'); return;
  }
  Sfx.play('select');
  doGoto(u, x, y);
}
function actCancel() { const u = selUnit(); if (u) { u.order = null; refresh(); } }

// ------------------------------------------------------------------ Patrouille
function actExplore() {
  const u = selUnit(); if (!u) return;
  if (u.carrier != null && T(u).domain === 'land') { toast(tt('Erst ausladen, dann erkunden', 'Unload first, then explore')); Sfx.play('error'); return; }
  if (T(u).domain === 'sea' && u.type === 'trn' && cargoOf(u).length) { toast(tt('Transporter mit Ladung erkunden nicht selbstständig', "Loaded transports don't explore on their own")); Sfx.play('error'); return; }
  u.order = { type: 'explore' };
  Sfx.play('select');
  animBegin(120);
  runExplore(u);
  animEnd();
  afterAction(u);
}

function actPatrol() {
  const u = selUnit(); if (!u) return;
  if (u.carrier != null) { toast(tt('Erst ausladen, dann Patrouille festlegen', 'Unload first, then set a patrol')); Sfx.play('error'); return; }
  patrolMode = { id: u.id, pts: [] };
  Sfx.play('tick');
  toast(tt('Wegpunkte auf der Karte anklicken, Enter startet', 'Click waypoints on the map, Enter starts'));
  refresh();
}
function patrolUndo() { if (patrolMode) { patrolMode.pts.pop(); refresh(); } }
function patrolAbort() { patrolMode = null; refresh(); }
function patrolStart() {
  const u = patrolMode && unitById(patrolMode.id);
  if (!u || !patrolMode.pts.length) { patrolMode = null; refresh(); return; }
  // intern: Wegpunkte + Rückkehr zum Start, dann von vorn
  u.order = { type: 'patrol', start: [u.x, u.y], pts: [...patrolMode.pts, [u.x, u.y]], i: 0 };
  patrolMode = null;
  Sfx.play('select');
  animBegin(120);
  runPatrol(u);
  animEnd();
  afterAction(u);
}
function patrolAddPoint(x, y) {
  const u = unitById(patrolMode.id);
  if (!u) { patrolMode = null; refresh(); return; }
  const last = patrolMode.pts.length ? patrolMode.pts[patrolMode.pts.length - 1] : [u.x, u.y];
  if (last[0] === x && last[1] === y) return;
  if (!S.players[0].seen[idx(x, y)]) { toast(tt('Wegpunkte nur auf erkundeten Feldern', 'Waypoints only on explored tiles')); Sfx.play('error'); return; }
  const c = cityAt(x, y);
  if (c && c.owner !== 0) { toast(tt('Wegpunkt nicht in fremden Städten', 'No waypoints in foreign cities')); Sfx.play('error'); return; }
  if (!canEnterTerrain(u, x, y)) {
    toast(T(u).domain === 'land' ? tt('Wegpunkt muss an Land liegen', 'Waypoint must be on land') : tt('Wegpunkt muss auf dem Wasser liegen', 'Waypoint must be on water')); Sfx.play('error'); return;
  }
  patrolMode.pts.push([x, y]);
  Sfx.play('tick');
  refresh();
}

function onTileClick(x, y, shift) {
  if (prodView) {   // Produktionsansicht: Klick auf eine eigene Stadt ändert ihre Produktion
    const c = S && inb(x, y) ? cityAt(x, y) : null;
    if (c && c.owner === 0) { Sfx.play('tick'); openProdDialog(c); }
    return;
  }
  if (rallyMode) { if (S && inb(x, y)) rallySet(x, y); return; }
  if (patrolMode) { patrolAddPoint(x, y); return; }
  if (!S || !inb(x, y)) return;
  const u = selUnit();
  const city = cityAt(x, y);
  const own = topUnitsAt(x, y).filter(o => o.owner === 0);
  if (u) {
    if (u.x === x && u.y === y && !shift) {
      // weiter durch die Einheiten auf dem Feld schalten
      const here = own.concat(...own.map(cargoOf)).filter(o => o.owner === 0);
      if (here.length > 1) { const k = here.indexOf(u); select(here[(k + 1) % here.length]); }
      refresh(); return;
    }
    const adjacent = cheb(u.x, u.y, x, y) === 1;
    const ownCity = city && city.owner === 0;
    const boardable = own.some(o => T(o).carries === T(u).domain && cargoOf(o).length < T(o).capacity);
    // Eigene Stadt = Ziel für die gewählte Einheit (auch wenn dort schon Einheiten stehen).
    // Stadt bearbeiten: erst Auswahl aufheben (Rechtsklick/Esc), dann Stadt anklicken.
    if (!shift && !ownCity && own.length && (!adjacent || !boardable)) {
      select(own.find(needsOrders) || own[0]); Sfx.play('select'); refresh(); return;
    }
    if (adjacent) { gotoPreview = null; doMove(u, x, y); return; }
    // Entferntes Feld: Marschbefehl (den Weg zeigt die Karte schon beim Überfahren, siehe hoverRoute). Nur bei einer eigenen Stadt zeigt
    // der erste Klick erst die Stadt in der Seitenleiste, der zweite schickt die Einheit hinein – ansehen und hinschicken sind dort zweierlei.
    // Was die Vorschau als unerreichbar zeigt, lehnt auch der Klick ab – mit demselben Grund. (Vorher fuhr ein Schiff bei einem Klick auf
    // Land bis an die Küste und meldete dann „Marsch unterbrochen“.)
    const h0 = hover; hover = [x, y];
    const hv = hoverRoute(u); hover = h0;
    if (hv && hv.none) { gotoPreview = null; toast(hv.none, 2600); Sfx.play('error'); refresh(); return; }
    const pv = gotoPreviewFor(u);
    // Umschalt + Klick heißt ausdrücklich „marschieren“ – dann ohne den Zwischenschritt
    const path = ownCity && !shift && !(pv && pv.x === x && pv.y === y) ? findPath(u, x, y, false, true) : null;
    if (!path || !path.length) { gotoPreview = null; doGoto(u, x, y); return; }   // auch ohne Weg: die Meldung dazu kommt vom Marschbefehl
    gotoPreview = { id: u.id, ox: u.x, oy: u.y, x, y, path };
    selCity = city.id;
    Sfx.play('tick'); refresh();
    return;
  }
  if (own.length) { select(own.find(needsOrders) || own[0]); Sfx.play('select'); }
  else sel = null;
  selCity = city && city.owner === 0 ? city.id : null;
  refresh();
}

// Wegvorschau (nach einem Erstspieler-Test: Er wollte eine Stadt nur ansehen und schickte die gewählte Einheit los).
// 1. Beim Überfahren (hoverRoute): Mit gewählter Einheit zeigt die Karte zu jedem entfernten Feld schon den Weg und die Dauer – man sieht,
//    was ein Klick auslöst (Idee des Nutzers). Der Klick schickt die Einheit dann sofort los.
// 2. Eigene Stadt (gotoPreview): Der erste Klick zeigt die Stadt in der Seitenleiste und hält den Weg fest, erst der zweite schickt los.
//    Gilt nur, solange dieselbe Einheit gewählt ist und am selben Platz steht; Esc, Rechtsklick, andere Auswahl oder ein Klick
//    woandershin verwerfen es. Züge aufs Nachbarfeld und Angriffe bleiben beim einfachen Klick.
// Abschaltbar (Einstellungen → Anzeige, archipel-route; Wunsch des Nutzers: Erfahrene stört die Vorschau beim Überfahren). Aus = keine Linie
// und keine Hinweise unter der Maus; der festgehaltene Weg zur eigenen Stadt und die Ablehnung unerreichbarer Ziele beim Klick bleiben.
let showRoute = true;
try { showRoute = localStorage.getItem('archipel-route') !== '0'; } catch (e) {}
let hoverPath = null;   // { key, path } – Wegsuche nur, wenn sich Feld oder Einheit ändern; refresh() verwirft
function hoverRoute(u) {
  if (!hover || patrolMode || rallyMode || u.owner !== 0) return null;
  const [x, y] = hover;
  const near = cheb(u.x, u.y, x, y);
  if (near === 0) return null;
  const key = u.id + ',' + u.x + ',' + u.y + ',' + x + ',' + y;
  if (near === 1) {
    // Nachbarfeld: keine Linie – aber der Grund, wenn die Einheit dort nichts tun kann (Schiff neben Land, Bodentruppen neben Wasser).
    // Gibt es dort einen Zugmarker (Angriff, an Bord gehen, Sturm vom Schiff), ist das Feld ein gültiges Ziel.
    if (!hoverPath || hoverPath.key !== key) {
      // Das gilt auch, wenn dort eine eigene Einheit steht (der Klick wählt sie aus, hin kann die gewählte Einheit trotzdem nicht) –
      // sonst fehlte der Hinweis z. B. beim Transporter neben der Infanterie, die er abholen soll.
      const dead = S.players[0].seen[idx(x, y)] && !canEnterTerrain(u, x, y) && !moveHints(u).some(h => h[0] === x && h[1] === y);
      hoverPath = { key, path: null, none: dead ? noGoReason(u, x, y) : null };
    }
    return hoverPath.none ? { x, y, path: [], none: hoverPath.none } : null;
  }
  // entferntes Feld, auch im Unerforschten: Der Klick marschiert dorthin, die Wegsuche verrät nichts
  if (!hoverPath || hoverPath.key !== key) {
    const c = cityAt(x, y);
    // Feld mit eigenen Einheiten (außer in eigener Stadt): Der Klick wählt dort aus, statt zu marschieren – keine Linie
    const sel2 = !(c && c.owner === 0) && topUnitsAt(x, y).some(o => o.owner === 0);
    // Die Wegsuche lässt jedes Zielfeld zu (Angriff, an Bord gehen) – ein erforschtes Feld, das die Einheit nicht betreten kann, ist kein Ziel
    // Ausnahme: fremde Stadt oder sichtbarer Gegner – dorthin führt ein Marsch (er hält bei Feindkontakt davor an), also Linie zeigen
    const foe = (c && S.players[0].knownOwner[c.id] !== 0) || topUnitsAt(x, y).some(e => e.owner !== 0 && canSee(0, e));
    const blocked = !foe && S.players[0].seen[idx(x, y)] && !canEnterTerrain(u, x, y);
    // Eigene Einheiten zählen nicht als Hindernis: Sie ziehen weiter, und der Marsch wartet oder weicht aus (runGoto) – sonst hieße es vor
    // einer besetzten Brücke „kein Weg“, und Linie und Dauer sprängen mit jeder eigenen Einheit. Sichtbare Gegner versperren den Weg.
    // Eigener Transporter/Träger mit freiem Platz: Der einfache Klick wählt ihn aus – hinmarschieren und an Bord gehen geht mit
    // Umschalt + Klick. Die Vorschau zeigt den Weg und sagt das dazu (ein Erstspieler fand den Weg an Bord nicht).
    const board = sel2 && topUnitsAt(x, y).some(o => o.owner === 0 && T(o).carries === T(u).domain && cargoOf(o).length < T(o).capacity);
    // Eigene Einheit auf einem Feld, das die gewählte betreten könnte: Der Klick wählt sie aus, Umschalt + Klick marschiert dorthin (bis das
    // Ziel erreicht ist, ist die andere oft längst weg) – Linie und Hinweis dazu
    const shiftGo = sel2 && !board && !blocked;
    const path = board || shiftGo ? findPath(u, x, y, false, true) : sel2 || blocked ? null : findPath(u, x, y, false, true);
    // kein Weg: sagen, warum (Bodentruppen aufs Wasser, Schiff an Land) – nur für erforschte Felder, sonst verriete es das Gelände
    // Steht dort eine eigene Einheit, wählt der Klick sie aus: dann nur ein Hinweis, wenn das Gelände selbst sperrt (Transporter zeigt auf
    // die Infanterie an Land, Infanterie auf einen vollen Transporter) – nicht „kein Weg“ zu einem Feld, das man gar nicht ansteuert.
    let none = null;
    if (!(path && path.length) && (sel2 ? blocked && !board : true)) none = noGoReason(u, x, y);
    hoverPath = { key, path, none, board, shiftGo };
  }
  return hoverPath.path && hoverPath.path.length ? { x, y, path: hoverPath.path, board: hoverPath.board, shiftGo: hoverPath.shiftGo } : hoverPath.none ? { x, y, path: [], none: hoverPath.none } : null;
}
// Warum die Einheit ein Feld nicht ansteuern kann – Gelände nur für erforschte Felder, sonst verriete der Grund, was dort liegt
function noGoReason(u, x, y) {
  const known = S.players[0].seen[idx(x, y)], land = S.terrain[idx(x, y)] === 1, d = T(u).domain;
  const full = topUnitsAt(x, y).find(o => o.owner === 0 && T(o).carries === d);   // passender Transporter/Träger, aber kein Platz mehr
  if (full) return tt(`${T(full).name} ist voll`, `${T(full).name} is full`);
  return known && d === 'land' && !land ? tt('Bodentruppen kommen nicht übers Wasser – dafür braucht es einen Transporter', 'Land units cannot cross water – that takes a transport')
    : known && d === 'sea' && land ? tt('Schiffe fahren nicht an Land', 'Ships cannot go on land')
    : tt('Kein Weg dorthin', 'No way there');
}
let gotoPreview = null;
function gotoPreviewFor(u) {
  const p = gotoPreview;
  return p && u && p.id === u.id && p.ox === u.x && p.oy === u.y && sel === u.id ? p : null;
}
function gotoTurns(u, len) { return len <= u.moves ? 1 : (u.moves > 0 ? 1 : 0) + Math.ceil((len - Math.max(0, u.moves)) / T(u).move); }
// pinned: festgehaltener Weg zu einer eigenen Stadt (wartet auf den zweiten Klick), sonst die blassere Vorschau beim Überfahren
// Jäger: Reicht der Treibstoff bis zum Ziel – und von dort noch bis zur nächsten Stadt oder zum Träger? (dieselben Regeln wie in doGoto)
// 'far' = Ziel außer Reichweite (der Marsch wird abgelehnt), 'noreturn' = hin ja, zurück nicht mehr, null = in Ordnung oder kein Jäger
function fuelState(u, x, y, len) {
  if (!T(u).fuel) return null;
  if (len > u.fuel) return 'far';
  const c = cityAt(x, y);
  return !(c && c.owner === 0) && u.fuel - len < distHome(0, x, y) ? 'noreturn' : null;
}
function drawGotoConfirm(u, p, pinned = true) {
  if (p.none) {   // kein Weg: durchgestrichener Kreis auf dem Feld und der Grund
    const cx = p.x * TS + TS / 2, cy = p.y * TS + TS / 2, r = TS * 0.3;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,107,97,0.95)'; ctx.lineWidth = Math.max(2, TS / 11); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.moveTo(cx - r * 0.7, cy - r * 0.7); ctx.lineTo(cx + r * 0.7, cy + r * 0.7); ctx.stroke();
    ctx.restore();
    drawRoutePill(p, p.none, 'rgba(255,107,97,0.9)', '#ffd2cd');
    return;
  }
  const fs = fuelState(u, p.x, p.y, p.path.length);
  const col = fs === 'far' ? 'rgba(255,107,97,0.9)' : fs === 'noreturn' ? 'rgba(242,184,75,0.95)' : 'rgba(255,255,255,0.75)';
  ctx.save(); if (!pinned) ctx.globalAlpha = fs ? 0.9 : 0.7;
  drawGotoPath(u.x, u.y, p.path, performance.now(), col);
  ctx.restore();
  const n = gotoTurns(u, p.path.length), turns = tt(`${n} ${n === 1 ? 'Runde' : 'Runden'}`, `${n} ${n === 1 ? 'turn' : 'turns'}`);
  const txt = fs === 'far' ? tt(`Treibstoff reicht nicht · ${p.path.length} Felder, Treibstoff für ${u.fuel}`, `Not enough fuel · ${p.path.length} tiles, fuel for ${u.fuel}`)
    : (pinned ? turns + tt(' · noch einmal klicken', ' · click again') : turns) + (p.board ? tt(' · Umschalt + Klick: an Bord gehen', ' · Shift + click: go aboard') : p.shiftGo ? tt(' · Umschalt + Klick: hinmarschieren', ' · Shift + click: march there') : '')
      + (fs && !p.board ? tt(' · kein Rückweg!', ' · no way back!') : '');
  drawRoutePill(p, txt, col, fs === 'far' ? '#ffd2cd' : fs ? '#ffe2a8' : '#fff');
}
// Schild über dem Zielfeld der Wegvorschau
function drawRoutePill(p, txt, col, ink) {
  ctx.font = `700 ${Math.max(11, Math.round(TS * 0.4))}px system-ui, sans-serif`;
  const w = ctx.measureText(txt).width + 14, h = Math.max(17, TS * 0.62);
  // im sichtbaren Ausschnitt halten (ein langer Hinweis am Bildrand wäre sonst abgeschnitten)
  const lo = Math.max(2, view.x + 4), hi = Math.min(S.W * TS - w - 2, view.x + wrap.clientWidth - w - 4);
  const bx = Math.max(lo, Math.min(hi, p.x * TS + TS / 2 - w / 2)), by = p.y * TS - h - 4 < Math.max(2, view.y + 2) ? (p.y + 1) * TS + 4 : p.y * TS - h - 4;
  roundRectPath(ctx, bx, by, w, h, h / 2);
  ctx.fillStyle = 'rgba(15,20,28,0.93)'; ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, TS / 18); ctx.stroke();
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, bx + w / 2, by + h / 2 + 0.5);
}

function endHumanTurn() {
  gotoPreview = null;
  if (!S || S.over) return;
  setProdView(false);
  rallyMode = null;
  autoEndAt = 0;
  sel = null;
  Sfx.play('endTurn');
  const logMark = S.log[0];
  animBegin(ENEMY_STEP_MS, true);
  const startScroll = [view.x, view.y];
  endTurn(0);
  // Alle Computergegner nacheinander (jeder gegen jeden); ausgeschiedene überspringen
  for (let p = 1; p < nPlayers() && !S.over; p++) {
    if (!isAlive(p)) continue;
    anim.phases.push({ at: anim.cursor, p });
    startTurn(p);
    aiTurn(p);
    if (!S.over) endTurn(p);
  }
  if (!S.over) {
    S.turn++;
    startTurn(0);
    // Ab hier folgen in der Zeitleiste die eigenen Einheiten mit ihren Befehlen – der Hinweis über der Karte wechselt dann
    const ownMark = anim.cursor, ownCount = anim.events.length;
    // Wachen wecken, wenn Feinde in der Nähe sind
    for (const u of S.units) {
      if (u.owner !== 0 || !u.order || (u.order.type !== 'sentry' && u.order.type !== 'load') || u.carrier != null) continue;
      let enemy = false;
      for (const [dx, dy] of DIRS) if (inb(u.x + dx, u.y + dy) && visibleEnemyAt(0, u.x + dx, u.y + dy)) enemy = true;
      if (enemy) { u.order = null; addLog(tt(`${T(u).name} meldet Feindkontakt!`, `${T(u).name} reports enemy contact!`), 'bad', u.x, u.y); }
    }
    for (const u of S.units.filter(o => o.owner === 0 && o.order && o.order.type === 'goto')) {
      // Feind ist während des Gegnerzugs herangerückt: Marsch anhalten
      if (u.carrier == null && enemyAdjacent(u)) { u.order = null; addLog(tt(`${T(u).name}: Marsch angehalten – Feindkontakt!`, `${T(u).name}: march stopped – enemy contact!`), 'bad', u.x, u.y); continue; }
      runGoto(u, true);   // Folgerunde: Jäger halten an, bevor sie außer Reichweite geraten
    }
    for (const u of S.units.filter(o => o.owner === 0 && o.order && o.order.type === 'patrol')) runPatrol(u);
    for (const u of S.units.filter(o => o.owner === 0 && o.order && o.order.type === 'explore')) runExplore(u);
    landingUpdate();   // „Ausladen, wenn möglich“: Truppen an der Küste wecken, damit sie als wartend zählen
    // Transporter mit „Laden bis voll“: zuletzt, damit auch gerade angekommene Einheiten an Bord gehen
    for (const u of S.units.filter(o => o.owner === 0 && o.order && o.order.type === 'load')) runLoad(u);
    if (anim.events.length > ownCount) anim.ownFrom = ownMark;
    computeVision(0);
  }
  animEnd(12000 + 6000 * (nPlayers() - 2));   // mehr Gegner, mehr zu zeigen: 12 s, je weiterem Gegner 6 s mehr
  landCheck = true;   // Rückfrage für Transporter, die jetzt vor einer fremden Stadt liegen
  anim.skippable = anim.events.length > 0;
  const fresh = [];
  let badNews = false;
  for (const l of S.log) { if (l === logMark) break; fresh.push(l.text); if (l.cls === 'bad') badNews = true; }
  const followed = anim.events.some(e => e.type === 'cam');
  const hasReplay = anim.events.length > 0 && replay !== "off";   // es gibt etwas zu sehen (Gegnerzüge, eigene Befehle)
  checkGameOver();
  saveGame();
  // Während der Wiedergabe bleibt die Karte, wo sie war (sonst liefen Gegnerzüge im bisherigen Ausschnitt ungesehen ab,
  // weil die Karte sofort zur nächsten eigenen Einheit sprang); danach weich zur eigenen Einheit
  selectNext(!hasReplay);
  const su = selUnit(), home = su || S.cities.find(c => c.owner === 0);
  if (hasReplay) {
    view.x = startScroll[0]; view.y = startScroll[1];
  } else if (!su && home) centerOn(home.x, home.y);
  anim.after = () => {
    // Erkennung über Schlüsselwörter der Meldungen (game.js) – in beiden Sprachen
    if (fresh.some(t => t.toLowerCase().includes(tt('feindkontakt', 'enemy contact')))) Sfx.play('alarm');
    else if (fresh.some(t => t.toLowerCase().includes(tt('fertiggestellt', 'completed')))) Sfx.play('built');
    const back = selUnit() || home;   // die Auswahl kann sich inzwischen geändert haben
    if (followed && hasReplay && back) pan(back.x + 0.5, back.y + 0.5, 600);
    else if (back) focusOn(back.x, back.y);   // nur, wenn die Einheit nicht ohnehin gut zu sehen ist
    maybeOfferEnd();
    // nichts zu tun (keine Einheit wartet) und nichts Schlimmes passiert: gleich weiter
    if (!badNews) scheduleAutoEnd();
  };
  refresh();
  if (S.over) showGameOver();
}

// ------------------------------------------------------------------ Seitenleiste
function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

function unitChip(o) {
  const st = o.order ? ({ sentry: tt(' · Wache', ' · sentry'), patrol: tt(' · Patrouille', ' · patrol'), explore: tt(' · Erkundet', ' · exploring'), load: tt(' · lädt', ' · loading') }[o.order.type] || tt(' · Marsch', ' · marching')) : '';
  return `<span class="chip ${o.moves <= 0 ? 'done' : ''} ${o.id === sel ? 'cur' : ''}" data-unit="${o.id}">${esc(T(o).name)} ${o.hp}/${T(o).hp}${st}</span>`;
}

const iconCache = {};
function iconUrl(kind, v) {
  const key = kind + v;
  if (!iconCache[key]) {
    const c = kind === 'u' ? unitSprite(v, 0, 40) : citySprite(0, 40, v);
    iconCache[key] = c.toDataURL();
  }
  return iconCache[key];
}

// Tabelle direkt unter dem Ansichtsschalter (nur in der Produktionsansicht): je Einheitentyp, wie viele Städte ihn bauen,
// wann die nächste fertig wird und wie viele es schon gibt. Typen, die weder gebaut werden noch vorhanden sind, fehlen.
function updateProdStats() {
  const el = $('prodStats');
  el.hidden = !prodView || !S;
  if (el.hidden) return;
  const mine = S.cities.filter(c => c.owner === 0 && c.prod && UT[c.prod]);
  const units = S.units.filter(u => u.owner === 0);
  const idle = S.cities.filter(c => c.owner === 0).length - mine.length;
  const num = (v, show = v) => `<td class="num${v ? '' : ' zero'}">${show}</td>`;
  let rows = '', tb = 0, te = 0;
  for (const k of UNIT_ORDER) {
    const cs = mine.filter(c => c.prod === k), n = units.filter(u => u.type === k).length;
    if (!cs.length && !n) continue;
    tb += cs.length; te += n;
    const next = cs.length ? Math.min(...cs.map(prodLeft)) : 0;
    rows += `<tr><td><img src="${iconUrl('u', k)}" alt="">${esc(UT[k].name)}</td>${num(cs.length)}${num(next, next ? next + ' ' + tt('R.', 'T.') : '–')}${num(n)}</tr>`;
  }
  el.innerHTML = `<table><thead><tr><th>${tt('Einheit', 'Unit')}</th>
      <th class="num" title="${tt('So viele Städte bauen diesen Typ gerade', 'This many cities are building this type')}">${tt('im Bau', 'building')}</th>
      <th class="num" title="${tt('Runden, bis die nächste Einheit dieses Typs fertig ist', 'Turns until the next unit of this type is ready')}">${tt('nächste', 'next')}</th>
      <th class="num" title="${tt('So viele Einheiten dieses Typs hast du', 'You own this many units of this type')}">${tt('vorhanden', 'owned')}</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>${tt('Gesamt', 'Total')}</td>${num(tb)}<td></td>${num(te)}</tr></tfoot></table>`
    + (idle ? `<div class="idle">${tt(`${idle} ${idle === 1 ? 'Stadt baut' : 'Städte bauen'} nichts`, `${idle} ${idle === 1 ? 'city is' : 'cities are'} building nothing`)}</div>` : '');
}

// Seitenleiste in der Produktionsansicht: kurze Erklärung (die Zahlen stehen in der Tabelle unter dem Schalter)
function prodPanel() {
  return `<p class="muted" style="font-size:12px;margin:0">${tt('Auf der Karte: Die Zahl an jeder Stadt nennt die Runden bis zur Fertigstellung, der Ring den Fortschritt. Klick auf eine Stadt ändert ihre Produktion. Taste V oder der Schalter oben führt zurück zu den Einheiten.',
    'On the map: the number at each city is the turns until completion, the ring shows the progress. Click a city to change its production. Press V or use the switch above to return to the units.')}</p>`;
}

function updatePanel() {
  const el = $('panel');
  updatePathLegend();
  updateProdStats();
  if (!S) { el.innerHTML = ''; return; }
  if (prodView) { el.innerHTML = prodPanel(); return; }
  let h = '';
  const u = selUnit();
  if (u) {
    const t = T(u);
    const cargo = cargoOf(u);
    let orderTxt = tt('keiner', 'none');
    if (u.order) orderTxt = u.order.type === 'sentry' ? tt('Wache', 'Sentry')
      : u.order.type === 'explore' ? tt('Erkunden', 'Explore')
      : u.order.type === 'load' ? tt(`Lädt, bis er voll ist (${cargo.length}/${t.capacity})`, `Loading until full (${cargo.length}/${t.capacity})`)
      : u.order.type === 'patrol' ? tt(`Patrouille (${u.order.pts.length - 1} Wegpunkt${u.order.pts.length > 2 ? 'e' : ''})`, `Patrol (${u.order.pts.length - 1} waypoint${u.order.pts.length > 2 ? 's' : ''})`) + (u.order.refuel ? tt(' · fliegt zum Tanken', ' · flying to refuel') : '')
      : tt(`Marsch nach ${u.order.x},${u.order.y}`, `Go to ${u.order.x},${u.order.y}`);
    h += `<section class="pcard pc-unit"><div class="pc-head"><img class="pc-icon" src="${iconUrl('u', u.type)}" alt=""><div><h3>${tt('Einheit', 'Unit')}</h3><div class="uname">${esc(t.name)}</div></div><button class="qhelp" data-help="${u.type}" title="${tt('Im Handbuch nachschlagen', 'Look up in the handbook')}" aria-label="${tt('Im Handbuch nachschlagen', 'Look up in the handbook')}">?</button></div>`;
    h += `<div class="stats">
      <span>${tt('Trefferpunkte', 'Hit points')}</span><b>${u.hp} / ${t.hp}</b>
      <span>${tt('Bewegung', 'Moves')}</span><b>${u.moves} / ${t.move}</b>
      <span>${tt('Stärke', 'Strength')}</span><b>${t.str}</b>`;
    if (t.domain === 'air') {
      const dh = distHome(0, u.x, u.y);
      const warn = !isBase(u) && u.fuel - Math.max(0, u.moves) < dh;
      h += `<span>${tt('Treibstoff', 'Fuel')}</span><b class="${warn ? 'warn' : ''}">${u.fuel} / ${t.fuel}${warn ? tt(' ⚠ zurückfliegen!', ' ⚠ fly back!') : ''}</b>
            <span>${tt('Nächste Basis', 'Nearest base')}</span><b>${dh} ${tt('Felder', 'tiles')}</b>`;
    }
    if (t.stealth) h += `<span>${tt('Tarnung', 'Stealth')}</span><b>${u.surf ? tt('aufgetaucht – bis zu deinem nächsten Zug sichtbar', 'surfaced – visible until your next turn') : tt('getaucht – nur aus der Nähe und von Zerstörern zu orten', 'submerged – only located up close or by destroyers')}</b>`;
    if (u.type === 'car' && u.carrier == null) {
      const hasFtr = cargo.some(o => o.type === 'ftr');
      const n = S.units.filter(o => o.owner === 0 && o !== u && o.carrier == null && T(o).domain === 'sea' && cheb(o.x, o.y, u.x, u.y) <= 1).length;
      h += `<span>${tt('Luftdeckung', 'Air cover')}</span><b>${hasFtr ? tt(`aktiv – schützt sich und ${n} ${n === 1 ? 'Schiff' : 'Schiffe'} nebenan vor Jägern`, `active – protects itself and ${n} adjacent ${n === 1 ? 'ship' : 'ships'} from fighters`) : tt('keine – dafür muss ein Jäger an Bord sein', 'none – needs a fighter on board')}</b>`;
    }
    if (u.type === 'bat' && u.carrier == null) {
      // Städte im Feuerbereich: fremde fallen leichter, eigene sind geschützt
      const near = S.cities.filter(c => cheb(c.x, c.y, u.x, u.y) <= 1 && S.players[0].seen[idx(c.x, c.y)]);
      const foe = near.filter(c => S.players[0].knownOwner[c.id] !== 0).map(c => esc(c.name)), own = near.filter(c => S.players[0].knownOwner[c.id] === 0).map(c => esc(c.name));
      h += `<span>${tt('Unter Feuer', 'Under fire')}</span><b>${foe.length ? foe.join(', ') + tt(' (fällt zu 75 %)', ' (falls 75 %)') : '–'}</b>`;
      if (own.length) h += `<span>${tt('Feuerschutz', 'Covering')}</span><b>${own.join(', ')}${tt(' (fällt nur zu 25 %)', ' (falls only 25 %)')}</b>`;
    }
    if (t.carries) h += `<span>${tt('An Bord', 'On board')}</span><b>${cargo.length} / ${t.capacity}</b>`;
    if (u.carrier != null) h += `<span>${tt('Ort', 'Location')}</span><b>${tt('an Bord', 'on board')}</b>`;
    h += `<span>${tt('Befehl', 'Order')}</span><b>${orderTxt}</b></div>`;
    if (cargo.length) h += `<div>${cargo.map(unitChip).join('')}</div>`;
    h += `<div class="row">
      <button data-act="skip" title="${tt('Leertaste', 'Space')}">${tt('Überspringen', 'Skip')}</button>
      <button data-act="sentry" title="S">${tt('Wache', 'Sentry')}</button>
      <button data-act="patrol" title="P">${tt('Patrouille', 'Patrol')}</button>
      <button data-act="explore" title="R">${tt('Erkunden', 'Explore')}</button>
      <button data-act="home" title="${t.domain === 'sea' ? tt('B – zur nächsten eigenen Hafenstadt', 'B – to your nearest port') : tt('B – zur nächsten eigenen Stadt', 'B – to your nearest city')}">${tt('Heimkehr', 'Return home')}</button>`;
    if (u.order) h += `<button data-act="cancel">${tt('Befehl löschen', 'Clear order')}</button>`;
    const c = cityAt(u.x, u.y);
    // Transporter: „Laden bis voll“ geht überall (Stadt und Nachbarfelder); Träger laden wie bisher nur in der eigenen Stadt
    if (t.carries === 'land') h += `<button data-act="load" title="${tt('L – bleibt liegen, bis er voll ist, und nimmt wartende Bodentruppen aus seiner Stadt und von den Nachbarfeldern an Bord. Ohne diesen Befehl nimmt er beim Verlassen einer eigenen Stadt mit, was dort wartet.', 'L – stays put until full, taking waiting land units on board from its city and the adjacent tiles. Without this order it takes along whatever is waiting when it leaves one of your cities.')}" ${(u.order && u.order.type === 'load') || cargo.length >= t.capacity ? 'disabled' : ''}>${tt('Laden bis voll', 'Load until full')}</button>`;
    else if (t.carries && c && c.owner === 0) h += `<button data-act="load" title="L">${tt('Einladen', 'Load')}</button>`;
    if (t.carries === 'land') h += `<button data-act="landing" class="${u.landing ? 'on' : ''}" ${!u.landing && !cargo.length ? 'disabled' : ''} title="${tt('Landemanöver: Sobald der Transporter Land berührt, werden die Truppen an Bord von selbst zum Aussteigen angeboten, bis kein Feld mehr frei ist. So endet die Runde nicht, während ein voller Transporter an der Küste liegt. Schaltet sich ab, wenn er leer ist.', 'Landing manoeuvre: as soon as the transport touches land, the troops on board are offered for disembarking by themselves until no tile is free. This way the turn does not end while a full transport lies at the coast. Switches off when it is empty.')}">${u.landing ? '☑' : '☐'} ${tt('Ausladen, wenn möglich', 'Unload when possible')}</button>`;
    let landTgt = null;
    if (t.carries && cargo.length) {
      const opts = t.carries === 'land' ? assaultOptions(u) : [], tgt = opts.find(o => o.kind === 'city') || null, foe = opts.find(o => o.kind === 'unit') || null;
      landTgt = landingPending(u) ? landingOption(u) : null;
      h += tgt ? `<button data-act="unload" title="${tt('U – die Truppen greifen die Stadt sofort vom Schiff aus an', 'U – the troops attack the city straight from the ship')}">⚔ ${tt('Angriff auf', 'Attack')} ${esc(tgt.name)} · ${Math.round(tgt.chance * 100)} %</button>
        <button data-act="unloadLand" title="${tt('Ohne Angriff auf freie Nachbarfelder aussteigen', 'Disembark onto free adjacent tiles without attacking')}">${tt('Nur an Land setzen', 'Just put ashore')}</button>`
        : `<button data-act="unload" title="U">${tt('Ausladen', 'Unload')}</button>`;
      if (foe) h += `<button data-act="assaultUnit" title="${tt('Die Truppen greifen die feindliche Einheit am Ufer sofort vom Schiff aus an; wer siegt, geht an Land', 'The troops attack the enemy unit on the shore straight from the ship; the winner goes ashore')}">⚔ ${tt('Angriff auf', 'Attack')} ${esc(foe.name)} · ${Math.round(foe.chance * 100)} %</button>`;
    }
    h += `</div>`;
    if (landTgt) h += `<div class="landnote">${landTgt.kind === 'city'
      ? tt(`Die Truppen an Bord haben ihren Zug noch: Klick auf ${esc(landTgt.name)} oder <kbd>U</kbd> greift an – die Leertaste überspringt.`, `The troops on board still have their move: click ${esc(landTgt.name)} or press <kbd>U</kbd> to attack – Space skips.`)
      : tt(`Feind am Ufer (${esc(landTgt.name)}): Die Truppen an Bord haben ihren Zug noch. Ein Klick auf den Gegner greift an – die Leertaste überspringt.`, `Enemy on the shore (${esc(landTgt.name)}): the troops on board still have their move. Click the enemy to attack – Space skips.`)}</div>`;
    if (patrolMode && patrolMode.id === u.id) {
      const n = patrolMode.pts.length;
      h += `<div class="patrolbox">${tt(`<b>Patrouille festlegen</b><br>Klicke nacheinander Wegpunkte auf der Karte (${n} gesetzt).
        Die Einheit läuft dann dauerhaft im Kreis: Start → 1 → 2 … → Start. Bei Feindkontakt bricht sie ab und meldet sich.`,
        `<b>Set patrol</b><br>Click waypoints on the map one after another (${n} set).
        The unit then keeps circling: Start → 1 → 2 … → Start. On enemy contact it stops and reports.`)}
        <div class="row"><button data-act="patrolGo" class="primary" ${n ? '' : 'disabled'}>${tt('Starten', 'Start')} ⏎</button>
        <button data-act="patrolUndo" ${n ? '' : 'disabled'}>${tt('Letzten löschen', 'Remove last')}</button>
        <button data-act="patrolAbort">${tt('Abbrechen', 'Cancel')}</button></div></div>`;
    }
    if (u.carrier != null) h += `<p class="muted">${tt('Zieh die Einheit auf ein Nachbarfeld an Land, um sie auszuladen.', 'Move the unit onto an adjacent land tile to unload it.')}</p>`;
    h += `</section>`;
  }
  const c = selCity != null ? S.cities[selCity] : null;
  if (c && c.owner === 0) {
    const p = c.prod ? UT[c.prod] : null;
    h += `<section class="pcard pc-city"><div class="pc-head"><img class="pc-icon" src="${iconUrl('c', c.id % 2)}" alt=""><div><h3>${!u ? tt('Stadt', 'City') : u.x === c.x && u.y === c.y ? tt('Stadt · Standort', 'City · location') : tt('Stadt · Ziel', 'City · destination')}</h3><div class="uname">${esc(c.name)}${c.coastal ? ` <span class="muted" style="font-size:12px">· ${tt('Hafen', 'Port')}</span>` : ''}</div></div></div>`;
    h += `<label class="muted" style="display:block;margin-top:6px">${tt('Produktion', 'Production')}</label><select id="prodSel">`;
    for (const k of UNIT_ORDER) {
      const ut = UT[k];
      const dis = ut.domain === 'sea' && !c.coastal;
      h += `<option value="${k}" ${c.prod === k ? 'selected' : ''} ${dis ? 'disabled' : ''}>${ut.name} – ${ut.cost} ${tt('Runden', 'turns')}</option>`;
    }
    h += `</select>`;
    if (p) h += `<div class="bar"><i style="width:${Math.round(c.progress / p.cost * 100)}%"></i></div>
      <div class="muted" style="font-size:12px;margin-top:3px">${tt(`Fertig in ${p.cost - c.progress} Runde(n). Ein Wechsel setzt den Fortschritt zurück.`, `Ready in ${p.cost - c.progress} turn${p.cost - c.progress === 1 ? '' : 's'}. Switching resets the progress.`)}</div>`;
    const inCity = topUnitsAt(c.x, c.y).filter(o => o.owner === 0);
    if (inCity.length) h += `<div style="margin-top:8px" class="muted">${tt('In der Stadt:', 'In the city:')}</div><div>${inCity.map(unitChip).join('')}</div>`;
    // Marschziel: Einheiten aus dieser Stadt marschieren nach der Fertigstellung sofort dorthin
    if (p) {
      const rTip = tt('Jede Einheit, die hier fertig wird, marschiert sofort zu diesem Feld. Wird gelöscht, wenn du die Produktion umstellst.', 'Every unit completed here marches to this tile at once. Cleared when you change the production.');
      if (rallyMode && rallyMode.city === c.id) {
        h += `<div class="rally on"><span>⚑ ${tt('Marschziel wählen: Klick auf das Zielfeld', 'Choose the rally point: click the target tile')}</span><button data-act="rallyabort">${tt('Abbrechen', 'Cancel')}</button></div>`;
      } else if (c.rally) {
        const tc = cityAt(c.rally[0], c.rally[1]), d = cheb(c.x, c.y, c.rally[0], c.rally[1]);
        const where = tc && S.players[0].knownOwner[tc.id] !== -2 ? esc(tc.name) : `(${c.rally[0]},${c.rally[1]})`;
        h += `<div class="rally" title="${rTip}"><span>⚑ ${tt('Marschziel', 'Rally point')}: <b>${where}</b> <span class="muted">· ${d} ${tt(d === 1 ? 'Feld' : 'Felder', d === 1 ? 'tile' : 'tiles')}</span></span>
          <span><button data-act="rally">${tt('Ändern', 'Change')}</button> <button data-act="rallyclear">${tt('Löschen', 'Clear')}</button></span></div>`;
      } else h += `<div class="rally"><button data-act="rally" title="${rTip}">⚑ ${tt('Marschziel setzen …', 'Set rally point …')}</button></div>`;
    }
    h += `</section>`;
  }
  if (!u && !(c && c.owner === 0)) {
    const left = S.units.filter(needsOrders).length;
    h += `<h3>${tt('Lage', 'Situation')}</h3>`;
    h += left ? `<p>${tt(`${left} Einheit(en) warten auf Befehle.`, `${left} unit${left === 1 ? ' is' : 's are'} waiting for orders.`)} <button data-act="next">${tt('Nächste', 'Next')} (N)</button></p>`
      : `<p>${tt('Alle Einheiten haben gezogen. <b>Enter</b> beendet die Runde.', 'All units have moved. <b>Enter</b> ends the turn.')}</p>`;
    h += `<p class="muted">${tt('Klicke eine Einheit oder eigene Stadt an.', 'Click one of your units or cities.')}</p>`;
  }
  el.innerHTML = h;
  const ps = $('prodSel');
  if (ps) ps.onchange = () => {
    changeProd(c, ps.value);
    refresh();
  };
}

function updateEndTurnButton() {
  const b = $('endTurn'), left = S.units.filter(needsOrders).length;
  if (!autoEndAt) b.classList.remove('auto');
  if (autoEndAt) return;
  b.classList.toggle('pending', left > 0);
  $('nextUnit').disabled = left === 0;
  b.innerHTML = left > 0
    ? tt(`Runde beenden ⏎ <small>· ${left} ${left === 1 ? 'wartet' : 'warten'}</small>`, `End turn ⏎ <small>· ${left} waiting</small>`)
    : tt('Runde beenden ⏎', 'End turn ⏎');
  b.title = left > 0 ? tt('Es gibt noch Einheiten mit Bewegungspunkten (N wählt die nächste)', 'Some units still have moves left (N selects the next)') : tt('Alle Einheiten haben gezogen', 'All units have moved');
}

// ------------------------------------------------------------------ Kräfteverhältnis
// Abschaltbar im Menü (Einstellung archipel-power): Dann fehlen der Balken in der Seitenleiste und die Angabe im Eroberungsfenster.
let showPower = true;
try { showPower = localStorage.getItem('archipel-power') !== '0'; } catch (e) {}
// Spoiler (Haken im Fenster „Kräfteverhältnis“, archipel-spoiler): Nur dort und nur dann stehen die Zahlen des Gegners (Städte,
// Einheiten). Der Hinweistext des Balkens und die Frage nach dem vorzeitigen Ende nennen vom Gegner immer nur den Prozentwert.
let spoiler = false;
try { spoiler = localStorage.getItem('archipel-spoiler') === '1'; } catch (e) {}
// Ausgeschaltet verschwindet nur der Balken; der Menüeintrag „Kräfteverhältnis“ bleibt – er öffnet erst auf Wunsch das Fenster mit der Rechnung
function applyPower() { $('power').style.display = showPower ? '' : 'none'; }
// Anteile aller Spieler an der Gesamtstärke (Prozent, auf 100 gerundet) – bei mehreren Gegnern im Hinweistext und im Fenster
function powerShares() {
  const v = S.players.map((_, p) => strength(p).total), sum = v.reduce((x, y) => x + y, 0) || 1;
  return v.map(x => Math.round(x / sum * 100));
}
// Anteil an der Stärke aller aus einem Eintrag von S.hist (null, wenn der Eintrag älter ist und die Stärke aller nicht kennt)
const allShare = e => (Array.isArray(e.all) ? e.all[0] / Math.max(1, e.all.reduce((x, y) => x + y, 0)) : null);
function updatePower() {
  // Urteil: du gegen den stärksten Gegner (bei einem Gegner: gegen ihn) – siehe strongestEnemy in game.js
  const en = strongestEnemy(), multi = nPlayers() > 2;
  const a = strength(0), b = strength(en);
  const share = a.total + b.total > 0 ? a.total / (a.total + b.total) : 0.5;
  const pct = Math.round(share * 100);
  const bar = $('powerMe').parentElement;
  bar.classList.toggle('multi', multi);
  // Mehrere Gegner: Balken, Kurve und Trend zeigen den Anteil jeder Partei an der Stärke aller (ausgeschiedene fehlen);
  // die Zahl steht im Abschnitt, wenn er breit genug ist, sonst nur im Hinweistext
  const tot = S.players.map((_, p) => (p === 0 || isAlive(p) ? strength(p).total : 0));
  const sumAll = Math.max(1, tot.reduce((x, y) => x + y, 0));
  const alive = tot.filter((v, p) => p === 0 || v > 0).length;
  const mine = multi ? tot[0] / sumAll : share;   // Wert für Kurve und Trend
  if (multi) {
    let left = 0, h = '';
    tot.forEach((v, p) => {
      if (p && !v) return;
      const w = v / sumAll * 100, pc = Math.round(w);
      const lab = w >= 10 ? (p === 0 && w >= 16 ? tt('Du ', 'You ') : '') + pc + ' %' : '';   // schmal: nur die Zahl, sehr schmal: nichts
      h += `<i style="left:${left.toFixed(2)}%;width:${w.toFixed(2)}%;background:linear-gradient(90deg, ${PLAYERS[p].dark}, ${PLAYERS[p].color})">${lab}</i>`;
      left += w;
    });
    $('powerSegs').innerHTML = h;
  } else {
    $('powerSegs').innerHTML = '';
    $('powerMe').style.width = pct + '%';
    $('powerL').textContent = tt('Du ', 'You ') + pct + ' %';
    $('powerR').textContent = (100 - pct) + tt(' % Gegner', ' % enemy');
  }
  const v = share >= 0.9 ? [tt('Erdrückend überlegen', 'Overwhelming'), 'up'] : share >= 0.65 ? [tt('Klar überlegen', 'Clearly ahead'), 'up'] : share >= 0.55 ? [tt('Überlegen', 'Ahead'), 'up']
    : share > 0.45 ? [tt('Ausgeglichen', 'Even'), 'flat'] : share > 0.35 ? [tt('Unterlegen', 'Behind'), 'down'] : share > 0.1 ? [tt('Stark unterlegen', 'Far behind'), 'down'] : [tt('Aussichtslos', 'Hopeless'), 'down'];
  $('powerVerdict').textContent = v[0]; $('powerVerdict').className = v[1];
  // Trend gegenüber dem Beginn der letzten Runde
  const hist = S.hist || [];
  const prev = [...hist].reverse().find(e => e.t < S.turn);
  const prevShare = !prev ? null : multi ? allShare(prev) : prev.me + prev.en > 0 ? prev.me / (prev.me + prev.en) : null;
  const tr = $('powerTrend');
  if (prevShare == null) { tr.textContent = ''; }
  else {
    const d = Math.round((mine - prevShare) * 100);
    tr.textContent = d > 0 ? `▲ +${d} %` : d < 0 ? `▼ ${d} %` : '● ±0';
    tr.className = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    tr.title = tt('Veränderung seit Beginn der letzten Runde', 'Change since the start of the last turn');
  }
  // Vom Gegner nur Prozentwerte (siehe Spoiler). Bei mehreren Gegnern: Anteile aller, dazu der Vergleich mit dem stärksten (Urteil).
  const all = multi ? powerShares() : null;
  const allTxt = multi ? S.players.map((_, p) => p === 0 || isAlive(p) ? `${pname(p)} ${all[p]} %` : null).filter(Boolean).join(', ') : '';
  $('power').title = multi
    ? tt(`Anteile an der Stärke aller: ${allTxt}\n`
      + `Einschätzung „${v[0]}“: du gegen den stärksten Gegner (${pname(en)}), ${pct} : ${100 - pct}\n`
      + `Du: ${a.cities} ${a.cities === 1 ? 'Stadt' : 'Städte'}, ${a.units} ${a.units === 1 ? 'Einheit' : 'Einheiten'} (Wert ${a.unitValue}) – Stärke ${a.total}\n`
      + `Kurve und Trend: dein Anteil an allem (gestrichelt: gleiche Anteile, 1/${alive})\n`
      + 'Stärke = Wert der Einheiten (Bauzeit × Zustand) + 20 je Stadt\nKlick: die genaue Rechnung',
      `Shares of everyone's strength: ${allTxt}\n`
      + `Assessment “${v[0]}”: you against the strongest enemy (${pname(en)}), ${pct} : ${100 - pct}\n`
      + `You: ${a.cities} ${a.cities === 1 ? 'city' : 'cities'}, ${a.units} ${a.units === 1 ? 'unit' : 'units'} (value ${a.unitValue}) – strength ${a.total}\n`
      + `Curve and trend: your share of everything (dashed: equal shares, 1/${alive})\n`
      + 'Strength = value of units (build time × condition) + 20 per city\nClick: the exact calculation')
    : tt(`Du: ${a.cities} ${a.cities === 1 ? 'Stadt' : 'Städte'}, ${a.units} ${a.units === 1 ? 'Einheit' : 'Einheiten'} (Wert ${a.unitValue}) – Stärke ${a.total}\n`
    + `Gegner: ${100 - pct} % der gesamten Stärke\n`
    + 'Stärke = Wert der Einheiten (Bauzeit × Zustand) + 20 je Stadt\nKlick: die genaue Rechnung',
    `You: ${a.cities} ${a.cities === 1 ? 'city' : 'cities'}, ${a.units} ${a.units === 1 ? 'unit' : 'units'} (value ${a.unitValue}) – strength ${a.total}\n`
    + `Enemy: ${100 - pct} % of the total strength\n`
    + 'Strength = value of units (build time × condition) + 20 per city\nClick: the exact calculation');
  drawPowerSpark(hist, mine, multi ? 1 / alive : 0.5, multi);
}

// Fenster „Kräfteverhältnis“ (Klick auf den Balken): die Rechnung hinter der Prozentzahl. Die eigenen Einheiten stehen je Typ da.
// Vom Gegner zeigt es ohne Spoiler nur den Anteil; aufgedeckt (spoiler) auch Städte und Gesamtwert der Einheiten – nie die Typen,
// das verriete, was im Nebel steht, etwa getarnte U-Boote.
function renderPower() {
  const multi = nPlayers() > 2, en = strongestEnemy();
  const a = strength(0), b = strength(en), sum = a.total + b.total;
  const pct = sum > 0 ? Math.round(a.total / sum * 100) : 50;
  const f1 = v => (Math.round(v * 10) / 10).toLocaleString(LANG, { maximumFractionDigits: 1 });
  const box = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  const row = (l, ...cells) => `<tr><td>${l}</td>${cells.map(c => `<td class="num">${c}</td>`).join('')}</tr>`;
  const un = n => `${n} ${tt(n === 1 ? 'Einheit' : 'Einheiten', n === 1 ? 'unit' : 'units')}`;
  const hid = `<span class="muted" title="${tt('Verdeckt – unten lässt sich das aufdecken', 'Hidden – you can reveal it below')}">${tt('verdeckt', 'hidden')}</span>`;
  let h = `<div class="stat-summary">${box(pct + ' %', multi ? tt('Du gegen den Stärksten', 'You vs the strongest') : tt('Dein Anteil', 'Your share'))}`
    + `${box((100 - pct) + ' %', multi ? `<i class="pdot" style="background:${PLAYERS[en].color}"></i>${tt(`${pname(en)}, stärkster Gegner`, `${pname(en)}, strongest enemy`)}` : tt('Anteil des Gegners', 'Enemy share'))}${box(a.total, tt('Deine Stärke', 'Your strength'))}`
    + (spoiler ? box(b.total, multi ? tt(`Stärke von ${pname(en)}`, `Strength of ${pname(en)}`) : tt('Stärke des Gegners', 'Enemy strength')) : '') + `${box(esc($('powerVerdict').textContent), tt('Lage', 'Situation'))}</div>`;

  if (!multi) {
    h += `<h3>${tt('Die Rechnung', 'The calculation')}</h3><table class="stat-table">
    <thead><tr><th></th><th class="num">${tt('Du', 'You')}</th><th class="num">${tt('Gegner', 'Enemy')}</th></tr></thead><tbody>`
    + row(tt(`Städte, je ${CITY_VALUE}`, `Cities, ${CITY_VALUE} each`), `${a.cities} × ${CITY_VALUE} = <b>${a.cities * CITY_VALUE}</b>`, spoiler ? `${b.cities} × ${CITY_VALUE} = <b>${b.cities * CITY_VALUE}</b>` : hid)
    + row(tt('Wert der Einheiten', 'Value of the units'), `${un(a.units)} = <b>${a.unitValue}</b>`, spoiler ? `${un(b.units)} = <b>${b.unitValue}</b>` : hid)
    + row(`<b>${tt('Stärke', 'Strength')}</b>`, `${a.cities * CITY_VALUE} + ${a.unitValue} = <b>${a.total}</b>`, spoiler ? `${b.cities * CITY_VALUE} + ${b.unitValue} = <b>${b.total}</b>` : hid)
    + row(`<b>${tt('Anteil', 'Share')}</b>`, spoiler && sum > 0 ? `${a.total} ÷ ${sum} = <b>${pct} %</b>` : `<b>${pct} %</b>`, spoiler && sum > 0 ? `${b.total} ÷ ${sum} = <b>${100 - pct} %</b>` : `<b>${100 - pct} %</b>`)
    + `</tbody></table>`;
  } else {
    // je Spieler eine Spalte (ausgeschiedene Gegner fehlen); Zahlen der Gegner nur mit Spoiler, Anteile immer
    const cols = S.players.map((_, p) => p).filter(p => p === 0 || isAlive(p)), st = cols.map(p => strength(p)), shares = powerShares();
    const head = cols.map(p => `<th class="num">${p ? `<i class="pdot" style="background:${PLAYERS[p].color}"></i>` : ''}${esc(pname(p))}</th>`).join('');
    const cell = (i, f) => (cols[i] === 0 || spoiler ? f(st[i]) : hid);
    h += `<h3>${tt('Die Rechnung', 'The calculation')}</h3><table class="stat-table"><thead><tr><th></th>${head}</tr></thead><tbody>`
      + row(tt(`Städte, je ${CITY_VALUE}`, `Cities, ${CITY_VALUE} each`), ...cols.map((p, i) => cell(i, s => `${s.cities} × ${CITY_VALUE} = <b>${s.cities * CITY_VALUE}</b>`)))
      + row(tt('Wert der Einheiten', 'Value of the units'), ...cols.map((p, i) => cell(i, s => `${un(s.units)} = <b>${s.unitValue}</b>`)))
      + row(`<b>${tt('Stärke', 'Strength')}</b>`, ...cols.map((p, i) => cell(i, s => `${s.cities * CITY_VALUE} + ${s.unitValue} = <b>${s.total}</b>`)))
      + row(`<b>${tt('Anteil an allen', 'Share of everyone')}</b>`, ...cols.map(p => `<b>${shares[p]} %</b>`))
      + `</tbody></table>`;
  }
  h += `
    <label class="spoiler"><input type="checkbox" id="spoilerChk" ${spoiler ? 'checked' : ''}> <span>${multi
      ? tt('Zahlen der Gegner aufdecken <span class="muted">– Spoiler: verrät, wie viele Städte und Einheiten sie haben, auch die im Nebel</span>',
        'Reveal the enemies\' numbers <span class="muted">– spoiler: gives away how many cities and units they have, including those in the fog</span>')
      : tt('Zahlen des Gegners aufdecken <span class="muted">– Spoiler: verrät, wie viele Städte und Einheiten er hat, auch die im Nebel</span>',
      'Reveal the enemy\'s numbers <span class="muted">– spoiler: gives away how many cities and units he has, including those in the fog</span>')}</span></label>`;

  const mine = S.units.filter(u => u.owner === 0);
  h += `<h3>${tt('Deine Einheiten im Einzelnen', 'Your units in detail')}</h3><table class="stat-table">
    <thead><tr><th>${tt('Einheit', 'Unit')}</th><th class="num">${tt('Anzahl', 'Number')}</th><th class="num">${tt('Bauzeit', 'Build time')}</th><th class="num">${tt('Wert', 'Value')}</th></tr></thead><tbody>`;
  for (const k of UNIT_ORDER) {
    const t = UT[k], list = mine.filter(u => u.type === k);
    if (!list.length) continue;
    const val = list.reduce((s, u) => s + t.cost * u.hp / t.hp, 0), dmg = list.filter(u => u.hp < t.hp).length;
    h += `<tr><td><span class="sym">${t.sym}</span>${t.name}</td><td class="num">${list.length}</td><td class="num">${t.cost}</td>
      <td class="num">${dmg ? `<span class="muted">${tt(`${dmg} beschädigt, voll wären es ${list.length * t.cost}`, `${dmg} damaged, ${list.length * t.cost} at full health`)} · </span>` : ''}<b>${f1(val)}</b></td></tr>`;
  }
  h += (mine.length ? '' : `<tr><td colspan="4" class="muted">${tt('Du hast keine Einheiten.', 'You have no units.')}</td></tr>`)
    + `<tr><td><b>${tt('Gesamt (gerundet)', 'Total (rounded)')}</b></td><td class="num"><b>${mine.length}</b></td><td></td><td class="num"><b>${a.unitValue}</b></td></tr></tbody></table>`;

  const hi = 100 - offerPct;
  h += `<h3>${tt('So wird gezählt', 'How it is counted')}</h3><ul class="power-notes">
    <li>${multi ? tt('Stärke = Wert der Einheiten + 20 je Stadt. Bei mehreren Gegnern zeigt der Balken den Anteil jeder Partei an der Stärke aller (wie die letzte Zeile der Tabelle), die Kurve darunter deinen. Die Einschätzung („Überlegen“ …) vergleicht dich mit dem stärksten Gegner: deine Stärke geteilt durch deine und seine zusammen. Die Summe aller Gegner zählt dafür nicht – sie bekämpfen sich auch untereinander.',
      'Strength = value of the units + 20 per city. With several enemies the bar shows each party\'s share of everyone\'s strength (like the last row of the table), the curve below it yours. The assessment (“Ahead” …) compares you with the strongest enemy: your strength divided by the sum of yours and theirs. The sum of all enemies does not count for it – they also fight each other.')
      : tt('Stärke = Wert der Einheiten + 20 je Stadt. Dein Anteil ist deine Stärke geteilt durch die Stärke beider Seiten zusammen.',
      'Strength = value of the units + 20 per city. Your share is your strength divided by the strength of both sides together.')}</li>
    <li>${tt('Der Wert einer Einheit ist ihre Bauzeit in Runden. Beschädigte Einheiten zählen anteilig nach ihren Trefferpunkten, Einheiten an Bord zählen mit.',
      'The value of a unit is its build time in turns. Damaged units count in proportion to their hit points; units on board are included.')}</li>
    <li>${tt('Beim Gegner zählt alles mit, auch was im Nebel liegt. Deshalb siehst du von ihm zunächst nur den Anteil. Aufgedeckt kommen seine Städte und der Gesamtwert seiner Einheiten dazu – nie aber, welche Einheiten es sind.',
      'For the enemy everything counts, including what is hidden in the fog. That is why at first you only see his share. Revealed, his cities and the total value of his units are added – but never which units they are.')}</li>
    <li>${tt('Einstufung nach deinem Anteil: ab 90 % erdrückend überlegen · ab 65 % klar überlegen · ab 55 % überlegen · über 45 % ausgeglichen · über 35 % unterlegen · über 10 % stark unterlegen · sonst aussichtslos.',
      'Rating by your share: from 90 % overwhelming · from 65 % clearly ahead · from 55 % ahead · above 45 % even · above 35 % behind · above 10 % far behind · otherwise hopeless.')}</li>
    <li>${offerPct ? tt(`Liegt dein Anteil fünf Runden in Folge unter ${offerPct} % oder über ${hi} %, bietet das Spiel das vorzeitige Ende an (einstellbar unter ☰ Menü → Einstellungen).`,
      `If your share stays below ${offerPct} % or above ${hi} % for five turns in a row, the game offers an early end (adjustable under ☰ Menu → Settings).`)
      : tt('Das Angebot zum vorzeitigen Ende ist abgeschaltet (☰ Menü → Einstellungen).', 'The offer of an early end is switched off (☰ Menu → Settings).')}</li>
  </ul>`;
  $('powerCalc').innerHTML = h;
  $('spoilerChk').onchange = e => {
    spoiler = e.target.checked;
    try { localStorage.setItem('archipel-spoiler', spoiler ? '1' : '0'); } catch (err) {}
    updatePower(); renderPower();
  };
}
function openPower() { if (!S) return; closeCtx(); renderPower(); openModal('mPower'); }
$('power').onclick = openPower;
$('bPowerMenu').onclick = openPower;

// Verlauf unter dem Balken: dein Anteil, um die Linie base zentriert (ein Gegner: 50 % gegen ihn; mehrere: Anteil an allem, base =
// gleiche Anteile aller noch lebenden Parteien – Einträge älterer Spielstände ohne die Stärke aller fehlen dann)
function drawPowerSpark(hist, share, base = 0.5, multi = false) {
  const c = $('powerSpark'), g = c.getContext('2d');
  const w = c.clientWidth || 190, h = 26, dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const pts = hist.filter(e => e.t < S.turn).map(e => (multi ? allShare(e) : e.me + e.en > 0 ? e.me / (e.me + e.en) : 0.5)).filter(v => v != null);
  pts.push(share);
  // um die Grundlinie zentriert, auf die tatsächliche Schwankung skaliert (mind. ±10 %)
  const dev = Math.max(0.1, ...pts.map(v => Math.abs(v - base))) * 1.15;
  const y = v => h / 2 - (v - base) / dev * (h / 2 - 2);
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 1; g.setLineDash([3, 3]);
  g.beginPath(); g.moveTo(0, y(base)); g.lineTo(w, y(base)); g.stroke(); g.setLineDash([]);
  if (pts.length < 2) return;
  const show = pts.slice(-80);
  const x = i => i / (show.length - 1) * (w - 4) + 2;
  g.beginPath(); g.moveTo(x(0), y(base));
  show.forEach((v, i) => g.lineTo(x(i), y(v)));
  g.lineTo(x(show.length - 1), y(base)); g.closePath();
  g.fillStyle = share >= base ? 'rgba(47,125,225,0.25)' : 'rgba(217,67,59,0.25)'; g.fill();
  g.beginPath(); show.forEach((v, i) => i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v)));
  g.strokeStyle = '#8fc0ff'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x(show.length - 1), y(show[show.length - 1]), 2.5, 0, 7); g.fill();
}

function updateHeader() {
  updateEndTurnButton();
  updatePower();
  // Runde und Schwierigkeitsstufe (mit Welt und Beschreibung im Hinweistext); ein Klick öffnet das Handbuch bei „Gegner & Stufen“
  const dk = DIFFICULTY[S.difficulty] ? S.difficulty : 'normal', dv = DIFFICULTY[dk], wv = WORLDS[S.world];
  const tip = `${tt('Schwierigkeit', 'Difficulty')}: ${dv.label}${wv ? ` · ${tt('Welt', 'World')}: ${wv.label}` : ''} – ${dv.desc}\n${tt('Klick: Erklärung der Stufen im Handbuch', 'Click: the levels explained in the handbook')}`;
  // mehrere Gegner: je Gegner ein Farbpunkt, ausgeschiedene blass
  let foes = '';
  if (nPlayers() > 2) {
    const ps = Array.from({ length: nPlayers() - 1 }, (_, i) => i + 1), out = p => S.outAt && S.outAt[p];
    const ftip = tt('Gegner: ', 'Enemies: ') + ps.map(p => pname(p) + (out(p) ? tt(` (ausgeschieden in Runde ${S.outAt[p]})`, ` (out in turn ${S.outAt[p]})`) : '')).join(', ');
    foes = ` <span class="foes" title="${esc(ftip)}">${ps.map(p => `<i class="pdot${out(p) ? ' out' : ''}" style="background:${PLAYERS[p].color}"></i>`).join('')}</span>`;
  }
  $('turnInfo').innerHTML = `${tt('Runde', 'Turn')} <b>${S.turn}</b> <span class="lvl lvl-${dk}" title="${esc(tip)}">${esc(dv.label)}</span>${foes}`
    + (CHEAT_FOG ? ` <span class="cheat" title="${tt('Schummelei aktiv: Du siehst die ganze Karte und alle Einheiten des Gegners samt Ladung und Besatzung. Klick schaltet den Nebel wieder ein.', 'Cheat active: you see the whole map and all enemy units including cargo and garrisons. Click to switch the fog back on.')}">👁 ${tt('Nebel aus', 'Fog off')}</span>` : '');
  updateLogHead();
  $('log').innerHTML = S.log.slice(0, 60).map(l =>
    `<div class="${l.cls}" ${l.x != null ? `data-x="${l.x}" data-y="${l.y}"` : ''}><span class="t">${tt('R', 'T')}${l.t}</span>${esc(l.text)}</div>`).join('');
}

function updateHover() {
  if (rallyMode && S && S.cities[rallyMode.city]) {   // ein Marschziel wird gerade gewählt
    const c = S.cities[rallyMode.city];
    dirty = true;
    $('hover').textContent = tt(`Marschziel für ${c.name} (${UT[c.prod].name}): Zielfeld anklicken · Esc oder Rechtsklick bricht ab`,
      `Rally point for ${c.name} (${UT[c.prod].name.toLowerCase()}): click the target tile · Esc or right-click cancels`) + (hover ? ` · (${hover[0]},${hover[1]})` : '');
    return;
  }
  if (!hover || !S) {   // Maus nicht über der Karte: kurzer Hinweis, wozu die Zeile da ist
    $('hover').textContent = S ? tt('Zeig auf ein Feld der Karte – hier steht, was dort ist.', 'Point at a map tile – this line tells you what is there.') : ' ';
    return;
  }
  if (prodView) {
    const c = inb(hover[0], hover[1]) ? cityAt(hover[0], hover[1]) : null;
    dirty = true;   // Hervorhebung der Stadt unter der Maus
    if (c && c.owner === 0 && c.prod && UT[c.prod]) {
      const n = prodLeft(c);
      $('hover').textContent = tt(`${c.name} baut ${UT[c.prod].name} · fertig in ${n} ${n === 1 ? 'Runde' : 'Runden'} · Klick ändert die Produktion`,
        `${c.name} builds ${UT[c.prod].name.toLowerCase()} · ready in ${n} ${n === 1 ? 'turn' : 'turns'} · click to change production`);
    } else $('hover').textContent = tt('Produktionsansicht · Klick auf eine eigene Stadt ändert ihre Produktion · V zurück zu den Einheiten', 'Production view · click one of your cities to change its production · V back to the units');
    return;
  }
  const [x, y] = hover, i = idx(x, y), P = S.players[0];
  if (!P.seen[i]) { $('hover').textContent = `(${x},${y}) ${tt('unerforscht', 'unexplored')}`; return; }
  let s = `(${x},${y}) ${S.terrain[i] ? tt('Land', 'land') : tt('Wasser', 'water')}`;
  const c = cityAt(x, y);
  if (c) {
    const o = P.knownOwner[c.id];
    const fo = nPlayers() > 2 && o >= 1 ? ', ' + pname(o) : '';   // bei mehreren Gegnern: wessen Stadt
    s += tt(` · Stadt ${c.name} (${o === 0 ? 'deine' : o >= 1 ? 'feindlich' + fo : 'neutral'})`, ` · city ${c.name} (${o === 0 ? 'yours' : o >= 1 ? 'enemy' + fo : 'neutral'})`);
    if (P.vis[i] && c.owner === 0) {
      // eigene Stadt: wirkt ein Schlachtschiff auf sie? Bei mehreren Gegnern zählt der gefährlichste
      let worst = 0;
      for (let p = 1; p < nPlayers(); p++) worst = Math.max(worst, captureChance(p, c));
      const pc = Math.round(worst * 100);
      if (pc > 50) s += tt(` · unter Feuer eines feindlichen Schlachtschiffs: fällt zu ${pc} %`, ` · under fire from an enemy battleship: falls ${pc} % of the time`);
      if (pc < 50) s += tt(` · Feuerschutz durch dein Schlachtschiff: fällt nur zu ${pc} %`, ` · covered by your battleship: falls only ${pc} % of the time`);
    }
  }
  // Eroberungschance der eigenen Einheit samt Grund (Schlachtschiffe)
  const capInfo = cc => {
    const pc = Math.round(captureChance(0, cc) * 100);
    return [pc, pc > 50 ? tt(' dank Feuerunterstützung durch dein Schlachtschiff', ' thanks to fire support from your battleship')
      : pc < 50 ? tt(' wegen Feuerschutz durch ein feindliches Schlachtschiff', ' because of covering fire from an enemy battleship') : ''];
  };
  if (P.vis[i]) {
    const us = topUnitsAt(x, y).filter(o => canSee(0, o));
    // Vom Gegner nur die Einheit nennen, die das Feld verteidigt – wie viele es sind, bleibt verborgen
    const named = S.over || CHEAT_FOG || !us.some(o => o.owner !== 0) ? us : us.filter(o => o.owner === 0).concat([pickDefender(us.filter(o => o.owner !== 0))]);
    if (named.length) s += ' · ' + named.map(o => `${o.owner === 0 ? '' : tt('Feind: ', 'Enemy: ')}${T(o).name} ${o.hp}/${T(o).hp}${T(o).stealth ? (o.surf ? tt(' (aufgetaucht)', ' (surfaced)') : tt(' (getaucht)', ' (submerged)')) : ''}`).join(', ');
    const su = selUnit();
    const en = us.filter(o => o.owner !== 0);
    const foes = su ? cityDefenders(su, c, en).filter(o => canStrike(su, o)) : en;   // Schiffe im Hafen verteidigen nicht gegen Bodentruppen; Schiffe ohne Beschuss greifen kein Land an
    const ships = en.length - foes.length;
    const sinkTxt = ships ? tt(' · Schiffe im Hafen gehen mit der Stadt unter', ' · ships in port are lost with the city') : '';   // ohne Anzahl (bleibt verborgen)
    if (su && foes.length && canAttack(su.type)) {
      const d = pickDefender(foes);
      s += ` · ${tt('Siegchance', 'Win chance')}: ${Math.round(attackOdds(su, d, x, y) * 100)} %`;
      const cs = combatSpec(su, d, x, y);
      if (cs.notes.length) s += ' (' + cs.notes.join(', ') + ')';
      if (c && c.owner !== 0 && T(su).capture) {
        const [pc, why] = capInfo(c);
        s += tt(` · danach ${pc} % Eroberung${why}: die ganze Besatzung fällt, deine Einheit geht in der Stadt auf`, ` · then ${pc} % capture${why}: the whole garrison falls, your unit merges into the city`);
      }
    } else if (su && c && c.owner !== 0 && P.knownOwner[c.id] !== 0 && T(su).capture && !foes.length) {
      const [pc, why] = capInfo(c);
      s += tt(` · Eroberungschance: ${pc} %${why} (deine Einheit geht dabei in der Stadt auf)`, ` · Capture chance: ${pc} %${why} (your unit merges into the city)`) + sinkTxt;
    }
  }
  // gewählter Transporter mit Truppen: Die Stadt lässt sich vom Schiff aus stürmen
  const hs = selUnit();
  if (hs && hs.owner === 0 && T(hs).carries === 'land') {
    const op = assaultOptions(hs).find(o => o.x === x && o.y === y);
    if (op) s += op.kind === 'city' ? tt(` · Klick oder U: Die Truppen stürmen vom Schiff aus – ${Math.round(op.chance * 100)} %`, ` · Click or U: the troops storm the city from the ship – ${Math.round(op.chance * 100)} %`)
      : tt(` · Klick: Die Truppen greifen vom Schiff aus an – ${Math.round(op.chance * 100)} %`, ` · Click: the troops attack from the ship – ${Math.round(op.chance * 100)} %`);
  }
  $('hover').textContent = s;
}

// ------------------------------------------------------------------ Dialoge
function anyModalOpen() { return [...document.querySelectorAll('.modal')].some(m => !m.hidden); }

// ------------------------------------------------------------------ Eroberungs-Dialog
// Nach jeder eigenen Eroberung (sobald die Animation vorbei ist) gleich die
// Produktion der neuen Stadt wählen lassen – mit etwas Jubel.
const captureQueue = [];
// Fenster erscheint kurz nachdem die Stadt die Farbe gewechselt hat
function captureReadyAt(q) {
  return q.ev && anim.events.includes(q.ev) ? anim.t0 + q.ev.t0 + 450 : anim.end;
}
const UNIT_ROLE = EN ? {
  inf: 'Captures cities · quick to build', tank: 'Captures cities · 2 tiles per turn',
  ftr: 'Flies far · scouts and hunts', trn: 'Carries 6 land units across the sea',
  dst: 'Locates and hunts submarines', sub: 'Hidden · torpedoes big ships',
  crs: 'Sturdy and versatile', car: 'Sees 4 tiles · air cover for the fleet', bat: 'Fire support for landings',
} : {
  inf: 'Erobert Städte · schnell gebaut', tank: 'Erobert Städte · 2 Felder pro Zug',
  ftr: 'Fliegt weit · späht und jagt', trn: 'Bringt 6 Landeinheiten übers Meer',
  dst: 'Ortet und jagt U-Boote', sub: 'Getarnt · Torpedo gegen große Schiffe',
  crs: 'Robust und vielseitig', car: 'Sieht 4 Felder · Luftdeckung für die Flotte', bat: 'Feuerunterstützung für Landungen',
};
const CAPTURE_CHEERS = EN ? [
  'The people cheer – your flag flies over the city!',
  'A big step towards ruling the archipelago!',
  'Your empire grows. The enemy will feel this.',
  'Brilliant capture! Now put the new city to work for you.',
  'A victory people will talk about for a long time.',
] : [
  'Die Bevölkerung jubelt – deine Fahne weht über der Stadt!',
  'Ein großer Schritt zur Herrschaft über das Archipel!',
  'Dein Reich wächst. Der Gegner wird das zu spüren bekommen.',
  'Glänzend erobert! Jetzt die neue Stadt für dich arbeiten lassen.',
  'Ein Sieg, über den man noch lange sprechen wird.',
];
function showCaptureDialog() {
  const q = captureQueue.shift();
  if (!S || S.over || q.game !== S) { captureQueue.length = 0; return; }
  const c = S.cities[q.id];
  if (!c || c.owner !== 0) return;
  cancelAutoEnd();
  openProdDialog(c, true);
}

// Produktion wählen: nach einer Eroberung (captured) mit Jubel, sonst als
// schlichtes Fenster (Kontextmenü „Produktion ändern“)
function openProdDialog(c, captured = false) {
  $('mCapture').querySelector('.cap-dlg').classList.toggle('plain', !captured);
  $('capBadge').textContent = captured ? '🏆' : '🏭';
  $('capKicker').textContent = captured ? tt('Sieg!', 'Victory!') : tt('Produktion', 'Production');
  $('capQ').textContent = captured ? tt('Was soll die Stadt jetzt für dich bauen?', 'What should the city build for you now?') : tt('Was soll die Stadt bauen?', 'What should the city build?');
  $('capHint').textContent = captured ? tt('Ohne Wahl baut die Stadt Infanterie. Die Produktion lässt sich jederzeit über die Stadt ändern.', 'Without a choice the city builds infantry. You can change production any time via the city.')
    : tt('Ein Wechsel setzt den bisherigen Fortschritt zurück.', 'Switching resets the current progress.');
  const p = c.prod ? UT[c.prod] : null;
  if (captured) {
    const mine = S.cities.filter(o => o.owner === 0).length, total = S.cities.length;
    const a = strength(0).total, b = strength(strongestEnemy()).total;   // wie der Balken: gegen den stärksten Gegner
    const pct = Math.round(a / Math.max(1, a + b) * 100);
    $('capTitle').textContent = tt(`${c.name} ist erobert!`, `${c.name} is captured!`);
    $('capCheer').textContent = CAPTURE_CHEERS[(S.turn + c.id) % CAPTURE_CHEERS.length];
    $('capFacts').innerHTML = tt(`<span><b>${mine}</b> von ${total} Städten gehören dir</span>`, `<span><b>${mine}</b> of ${total} cities are yours</span>`)
      + (showPower ? tt(`<span>Kräfteverhältnis <b>${pct} %</b></span>`, `<span>Balance of power <b>${pct} %</b></span>`) : '')
      + (c.coastal ? tt('<span>⚓ Hafenstadt – baut auch Schiffe</span>', '<span>⚓ Port city – builds ships too</span>') : '');
    $('capBar').style.width = Math.round(mine / total * 100) + '%';
  } else {
    const n = topUnitsAt(c.x, c.y).filter(o => o.owner === 0).length;
    const left = p ? p.cost - c.progress : 0;
    $('capTitle').textContent = c.name;
    $('capCheer').textContent = p ? tt(`Baut gerade ${p.name} – fertig in ${left} Runde${left === 1 ? '' : 'n'}.`, `Building: ${p.name.toLowerCase()} – ready in ${left} turn${left === 1 ? '' : 's'}.`) : tt('Baut derzeit nichts.', 'Not building anything.');
    $('capFacts').innerHTML = (c.coastal ? tt('<span>⚓ Hafenstadt – baut auch Schiffe</span>', '<span>⚓ Port city – builds ships too</span>') : tt('<span>Binnenstadt – keine Schiffe</span>', '<span>Inland city – no ships</span>'))
      + '<span>' + (n ? tt(`<b>${n}</b> Einheit${n === 1 ? '' : 'en'} in der Stadt`, `<b>${n}</b> unit${n === 1 ? '' : 's'} in the city`) : tt('Keine Einheiten in der Stadt', 'No units in the city')) + '</span>';
    $('capBar').style.width = p ? Math.round(c.progress / p.cost * 100) + '%' : '0%';
  }
  let h = '';
  for (const k of UNIT_ORDER) {
    const ut = UT[k], dis = ut.domain === 'sea' && !c.coastal;
    h += `<button class="cap-unit${c.prod === k ? ' cur' : ''}" data-prod="${k}" ${dis ? `disabled title="${tt('Nur in Hafenstädten', 'Port cities only')}"` : ''}>
      <img src="${iconUrl('u', k)}" alt=""><b>${ut.name}</b><small>${ut.cost} ${tt('Runden', 'turns')}</small><em>${UNIT_ROLE[k] || ''}</em></button>`;
  }
  $('capUnits').innerHTML = h;
  $('capUnits').onclick = e => {
    const btn = e.target.closest('[data-prod]');
    if (!btn || btn.disabled) return;
    const changed = c.prod !== btn.dataset.prod;
    if (changed) changeProd(c, btn.dataset.prod);
    Sfx.play('select');
    closeModals();
    if (changed || captured) addLog(tt(`${c.name} baut jetzt ${UT[c.prod].name}.`, `${c.name} now builds ${UT[c.prod].name.toLowerCase()}.`), '', c.x, c.y);
    saveGame(); refresh(); scheduleAutoEnd();
  };
  openModal('mCapture');
}

function openModal(id) { $(id).hidden = false; }

// ------------------------------------------------------------------ Handbuch
// Sechs Reiter. Einheitenkarten und die Tabelle „Wer schlägt wen“ entstehen aus den Spieldaten und den
// Kampfregeln (attackOdds) – sie können nicht veralten. Neue Regeltexte gehören in index.html (Reiter „Kampf“).
const UNIT_INFO = {
  inf: tt('Erobert Städte (50 %) und geht dabei in der Stadt auf. Billig und schnell gebaut – die Arbeitskraft jeder Eroberung.',
    'Captures cities (50 %) and merges into the city when it does. Cheap and quick to build – the workhorse of every conquest.'),
  tank: tt('Erobert Städte wie die Infanterie, ist aber doppelt so schnell und hält einen Treffer aus. Wird in Städten nicht repariert. Als Eroberer teuer, im Feld stark gegen Infanterie.',
    'Captures cities like infantry, but moves twice as fast and survives one hit. Is not repaired in cities. Expensive as a conqueror, strong against infantry in the field.'),
  ftr: tt('Fliegt über Land und Wasser. Hat Treibstoff für 18 Felder und muss zu einer eigenen Stadt oder einem Träger zurück; jede Runde in der Luft kostet mindestens 6. Jagt Transporter und richtet gegen Schlachtschiffe dreifachen Schaden an.',
    'Flies over land and water. Has fuel for 18 tiles and must return to one of your cities or a carrier; every turn in the air costs at least 6. Hunts transports and deals triple damage to battleships.'),
  trn: tt('Bringt bis zu 6 Bodentruppen übers Meer. Unbewaffnet: Wer ihn erwischt, versenkt die ganze Ladung. Gib ihm einen Zerstörer mit – und gegen Jäger einen Träger: Unter Luftdeckung wehrt er sich mit Stärke 1. Im eigenen Hafen ist er vor Zerstörern und U-Booten sicher. Laden, Landen und Angriff vom Schiff erklärt die Seite „Transporter“.',
    'Carries up to 6 ground units across the sea. Unarmed: whoever catches it sinks the whole load. Give it a destroyer escort – and a carrier against fighters: under air cover it fights back with strength 1. In your own port it is safe from destroyers and submarines. Loading, landing and attacking from the ship are explained on the “Transports” page.'),
  dst: tt('Schnell, billig, guter Späher. Ortet als einziges Schiff getauchte U-Boote in seiner vollen Sichtweite und schlägt sie mit Sonar und Wasserbomben. Der Geleitschutz für Transporter. Er greift nichts an Land und nichts in einer Stadt an, auch keine Schiffe im Hafen, Jäger nur über Wasser – und an der Küste ist er selbst gefährdet: Bodentruppen treffen ihn dreifach.',
    'Fast, cheap, a good scout. The only ship that locates submerged submarines at its full vision range, and beats them with sonar and depth charges. The escort for transports. It attacks nothing on land and nothing in a city, not even ships in port, and fighters only over water – and at the coast it is at risk itself: ground troops hit it threefold.'),
  sub: tt('Getarnt: Getaucht sehen es nur Nachbarn und Zerstörer. Sein Torpedo trifft große Schiffe zuerst und doppelt stark. Nach einem Angriff ist es bis zu deinem nächsten Zug aufgetaucht (Welle unter dem Boot). Für Bodentruppen ist es nicht angreifbar, greift selbst aber nur Schiffe auf offenem Wasser an – im Hafen sind sie vor ihm sicher. Große Schiffe können es getaucht kaum bekämpfen – sein Feind sind Zerstörer und Jäger.',
    'Hidden: submerged, it is only seen by neighbours and destroyers. Its torpedo hits big ships first and with double strength. After attacking it is surfaced until your next turn (wave below the boat). Ground troops cannot attack it, but it attacks only ships on open water itself – in port they are safe from it. Large ships can hardly fight it while submerged – its enemies are destroyers and fighters.'),
  crs: tt('Das Allround-Kriegsschiff: schlägt Zerstörer sicher und hält viel aus. Gegen Schlachtschiffe und U-Boote hat es das Nachsehen – getauchte U-Boote überlässt es besser Zerstörern. Beschießt auch Einheiten an Land und in Städten an der Küste.',
    'The all-round warship: reliably beats destroyers and can take a lot. It loses out to battleships and submarines – submerged submarines are better left to destroyers. Also bombards units on land and in coastal cities.'),
  car: tt('Das Auge der Flotte: sieht 4 Felder weit. Trägt und betankt bis zu 6 Jäger. Mit mindestens einem Jäger an Bord gibt er Luftdeckung: Feindliche Jäger treffen ihn und eigene Schiffe nebenan nur zu einem Drittel. Er greift nie selbst an, das übernehmen seine Jäger. Halte ihn von der Küste fern: Bodentruppen treffen ihn dreifach.',
    'The eyes of the fleet: sees 4 tiles. Carries and refuels up to 6 fighters. With at least one fighter on board it gives air cover: enemy fighters hit it and your adjacent ships only one third of the time. It never attacks itself – its fighters do that. Keep it off the coast: ground troops hit it threefold.'),
  bat: tt('Beherrscht das Seegefecht und gibt Feuerunterstützung auf alle Nachbarfelder: Fremde Städte dort fallen zu 75 %, eigene nur zu 25 %. Verwundbar durch U-Boote und Jäger-Schwärme. Beschießt auch Einheiten an Land und in Städten an der Küste.',
    'Rules the sea battle and gives fire support to all adjacent tiles: foreign cities there fall 75 % of the time, your own only 25 %. Vulnerable to submarines and fighter swarms. Also bombards units on land and in coastal cities.'),
};
// Siegchancen aller Einheiten gegeneinander, unbeschädigt und ohne örtliche Zu- oder Abschläge.
// m[a][d] = Siegchance (null: kann nicht angreifen), m.info[a][d] = { loss: verlorene Bauzeit der Angreifer (Schaden anteilig, Zerstörung
// ganz) je zerstörtem Ziel, notes: Sonderregeln }
function oddsMatrix() {
  let x = 0, y = 0;
  for (let k = 0; k < S.W * S.H; k++) if (S.cityGrid[k] < 0 && S.terrain[k] === 0) { x = k % S.W; y = (k / S.W) | 0; break; }
  const mk = (t, o) => ({ type: t, hp: UT[t].hp, owner: o, x: -9, y: -9, carrier: null });   // Besitzer ohne Einheiten: keine Unterstützung
  const m = { info: {} };
  for (const a of UNIT_ORDER) {
    m[a] = {}; m.info[a] = {};
    for (const d of UNIT_ORDER) {
      const A = mk(a, 7), D = mk(d, 8), ok = canAttack(a) && canStrike(A, D);
      m[a][d] = ok ? attackOdds(A, D, x, y) : null;
      if (ok) m.info[a][d] = { loss: hpLostToKill(A, D, x, y) * UT[a].cost / UT[a].hp, notes: combatSpec(A, D, x, y).notes };
    }
  }
  return m;
}
// Zahl mit höchstens einer Nachkommastelle (ab 10 ganzzahlig), Komma im Deutschen
const fmt1 = v => { const r = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10; return EN ? String(r) : String(r).replace('.', ','); };
// Bilanz immer mit einer Nachkommastelle (1,0 statt 1), ab 10 ganzzahlig
const fmtR = v => { const r = v >= 10 ? String(Math.round(v)) : v.toFixed(1); return EN ? r : r.replace('.', ','); };
// Tabelle „Wer schlägt wen“: 'duel' = Siegchance, 'econ' = Wirtschaftlichkeit (Bilanz), wird gemerkt
let matrixMode = 'duel', matrixData = null;
try { if (localStorage.getItem('archipel-matrix') === 'econ') matrixMode = 'econ'; } catch (e) {}
function renderMatrix() {
  const m = matrixData; if (!m) return;
  const pc = v => Math.round(v * 100), econ = matrixMode === 'econ';
  for (const b of $('matrixSw').querySelectorAll('button')) b.classList.toggle('on', b.dataset.mode === matrixMode);
  // Bilanz: Bauzeit des Ziels je verlorener Bauzeit der Angreifer (null = praktisch verlustfrei)
  const ratio = (a, d) => { const L = m.info[a][d].loss; return L < 0.05 * UT[a].cost ? null : UT[d].cost / L; };
  let note;
  if (econ) {
    note = tt('Lohnt sich der Angriff? Angreifer derselben Art greifen nacheinander an, bis das Ziel zerstört ist – der Schaden am Ziel bleibt. Die Zahl sagt, wie viel Bauzeit du zerstörst je Bauzeit, die du dabei verlierst: <b>über 1 lohnt es sich</b>, unter 1 zahlst du drauf. „frei“ heißt: kaum eigener Schaden.',
      'Does the attack pay off? Attackers of the same type attack one after another until the target is destroyed – the damage to the target stays. The number tells how much build time you destroy for each unit of build time you lose: <b>above 1 it pays off</b>, below 1 you lose out. “free” means: hardly any damage of your own.');
    const r = m.inf.tank != null ? ratio('inf', 'tank') : null;
    if (r) {
      const p = pc(m.inf.tank), bt = m.info.inf.tank.loss, n = fmt1(bt / UT.inf.cost);
      note += ' ' + tt(`Beispiel: Infanterie gewinnt gegen einen Panzer einer gegen einen nur zu ${p} %, doch im Schnitt reichen ${n} Infanterie (Bauzeit ${fmt1(bt)}) für einen Panzer (Bauzeit ${UT.tank.cost}) – das ergibt ${fmtR(r)}.`,
        `Example: infantry beats a tank one on one only ${p} % of the time, but on average ${n} infantry (build time ${fmt1(bt)}) are enough for a tank (build time ${UT.tank.cost}) – that makes ${fmtR(r)}.`);
    }
    note += ' ' + tt(`Schaden zählt anteilig als verlorene Bauzeit (ein Kreuzer mit halbem Schaden: ${fmt1(UT.crs.cost / 2)}), eine zerstörte Einheit ganz. Bei Einheiten, die repariert werden können (alle außer Panzern), gilt die Rechnung nur, solange sie sich nicht in einer eigenen Stadt reparieren. Alles auf offenem Feld.`,
      `Damage counts proportionally as lost build time (a cruiser with half damage: ${fmt1(UT.crs.cost / 2)}), a destroyed unit in full. For units that can be repaired (all except tanks), the figures only hold as long as they are not repaired in one of their cities. All in the open.`);
  } else {
    note = tt('Siegchance des Angreifers (Zeile) gegen den Verteidiger (Spalte), beide unbeschädigt, auf offenem Feld. Die Werte berechnet das Spiel aus den geltenden Regeln.',
      'Win chance of the attacker (row) against the defender (column), both undamaged, in the open. The game calculates the values from the current rules.');
  }
  note += ' ' + tt('Ein Punkt in der Ecke heißt: Hier gilt eine Sonderregel (siehe unten) – fahr mit der Maus über das Feld.', 'A dot in the corner means a special rule applies (see below) – hover over the cell.');
  $('matrixNote').innerHTML = note;
  const head = '<tr><th class="row">' + tt('Angreifer ↓ / Verteidiger →', 'Attacker ↓ / defender →') + '</th>' +
    UNIT_ORDER.map(d => `<th title="${UT[d].name}"><img src="${iconUrl('u', d)}" alt="">${UT[d].sym}</th>`).join('') + '</tr>';
  $('helpMatrix').innerHTML = head + UNIT_ORDER.filter(canAttack).map(a => `<tr><th class="row">${UT[a].sym} · ${UT[a].name}</th>` + UNIT_ORDER.map(d => {
    const v = m[a][d];
    if (v == null) return `<td class="none" title="${tt(`${UT[a].name} kann ${UT[d].name} nicht angreifen`, `${UT[a].name} cannot attack ${UT[d].name.toLowerCase()}`)}">–</td>`;
    const { loss, notes } = m.info[a][d], A = UT[a].name, D = UT[d].name;
    let cls, txt, tip;
    if (econ) {
      const r0 = ratio(a, d), r = r0 == null ? null : Math.round(r0 * 10) / 10;   // Farbe und Urteil nach der angezeigten Zahl
      cls = r == null || r >= 1.5 ? 'hi' : r >= 0.8 ? 'mid' : 'lo';
      txt = r == null ? tt('frei', 'free') : fmtR(r);
      const verdict = r == null ? '' : r >= 1.5 ? tt('lohnt sich', 'pays off') : r >= 0.8 ? tt('etwa ausgeglichen', 'roughly even') : tt('Verlustgeschäft', 'a losing deal');
      tip = r == null ? tt(`${A} gegen ${D}: zerstört das Ziel praktisch ohne eigenen Schaden`, `${A} against ${D.toLowerCase()}: destroys the target with hardly any damage of its own`)
        : tt(`${A} gegen ${D}: Bis das Ziel zerstört ist, verlierst du im Schnitt ${fmt1(loss)} Bauzeit durch Schaden und Verluste. ${D} kostet ${UT[d].cost} – ${verdict}`,
          `${A} against ${D.toLowerCase()}: until the target is destroyed you lose ${fmt1(loss)} build time on average through damage and losses. It costs ${UT[d].cost} – ${verdict}`);
    } else {
      const p = pc(v);
      cls = p >= 60 ? 'hi' : p >= 40 ? 'mid' : p > 0 ? 'lo' : 'none';
      txt = p + ' %';
      tip = tt(`${A} greift ${D} an: ${p} % Siegchance`, `${A} attacks ${D.toLowerCase()}: ${p} % win chance`);
    }
    if (notes.length) tip += tt('. Sonderregel: ', '. Special rule: ') + notes.join(', ');
    return `<td class="${cls}${notes.length ? ' rule' : ''}" title="${esc(tip)}">${txt}</td>`;
  }).join('') + '</tr>').join('');
}
$('matrixSw').addEventListener('click', e => {
  const b = e.target.closest('button[data-mode]'); if (!b) return;
  matrixMode = b.dataset.mode;
  try { localStorage.setItem('archipel-matrix', matrixMode); } catch (err) {}
  renderMatrix();
});
function buildHelp() {
  const m = oddsMatrix();
  const names = list => list.map(k => UT[k].name).join(', ') || '–';
  $('helpUnits').innerHTML = UNIT_ORDER.map(k => {
    const t = UT[k];
    // lohnend: Siegchance ab zwei Dritteln – oder etwa 50:50 gegen etwas deutlich Teureres
    const pays = (a, d) => m[a][d] != null && (m[a][d] >= 0.66 || (UT[a].domain !== 'land' && m[a][d] >= 0.44 && UT[d].cost >= UT[a].cost * 1.5));
    const sameField = (a, d) => UT[a].domain !== 'sea' || UT[d].domain !== 'land';   // Schiffe gegen Bodentruppen: Randfall, nicht aufführen
    const strong = UNIT_ORDER.filter(d => d !== k && UT[d].str > 0 && pays(k, d) && sameField(k, d));
    let weak = UNIT_ORDER.filter(a => a !== k && pays(a, k) && sameField(a, k));
    if (k === 'bat' && !weak.includes('ftr')) weak.push('ftr');   // einzeln schwach, im Schwarm tödlich (Schaden bleibt)
    const weakTxt = weak.length >= 7 ? tt('allen bewaffneten Einheiten', 'all armed units') : names(weak);
    const stat = (l, v) => `<span>${l} <b>${v}</b></span>`;
    return `<div class="ucard" id="help-${k}"><div class="ucard-head"><img src="${iconUrl('u', k)}" alt=""><div><b>${t.name}</b><small>${UNIT_ROLE[k] || ''}</small></div></div>
      <div class="ucard-stats">${stat(tt('Bauzeit', 'Build'), t.cost)}${stat(tt('Bewegung', 'Moves'), t.move)}${stat(tt('Trefferpunkte', 'HP'), t.hp)}${stat(tt('Stärke', 'Strength'), t.str)}${stat(tt('Sicht', 'Vision'), t.vision)}${t.fuel ? stat(tt('Treibstoff', 'Fuel'), t.fuel) : ''}${t.capacity ? stat(tt('Plätze', 'Capacity'), t.capacity) : ''}</div>
      <p>${UNIT_INFO[k]}</p>
      ${canAttack(k) ? `<div class="vs"><b class="good">${tt('Stark gegen', 'Strong against')}:</b> ${names(strong)}</div>` : ''}
      <div class="vs"><b class="bad">${tt('Verwundbar durch', 'Vulnerable to')}:</b> ${weakTxt}</div></div>`;
  }).join('');
  matrixData = m;
  renderMatrix();
}
function helpTab(name) {
  const tabs = [...$('helpTabs').querySelectorAll('button')];
  if (!tabs.some(b => b.dataset.tab === name)) name = 'start';
  for (const b of tabs) b.classList.toggle('on', b.dataset.tab === name);
  for (const p of $('helpBody').querySelectorAll('[data-pane]')) p.hidden = p.dataset.pane !== name;
  $('helpBody').scrollTop = 0;
  try { localStorage.setItem('archipel-helptab', name); } catch (e) {}
}
// tab: gewünschter Reiter (sonst der zuletzt geöffnete), unit: Einheitenkarte, zu der gesprungen wird
function openHelp(tab = null, unit = null) {
  if (S) buildHelp();
  // Stufe der laufenden Partie in der Tabelle „Gegner & Stufen“ hervorheben
  document.querySelectorAll('#diffTable tr').forEach(r => r.classList.toggle('cur', !!S && r.dataset.k === S.difficulty));
  if (!tab) { try { tab = localStorage.getItem('archipel-helptab'); } catch (e) {} }
  helpTab(unit ? 'units' : tab || 'start');
  openModal('mHelp');
  const card = unit && $('help-' + unit);
  if (card) {
    card.scrollIntoView({ block: 'center' });
    card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 1800);
  }
}
$('turnInfo').addEventListener('click', e => { if (e.target.closest('.cheat')) setCheatFog(false); else if (e.target.closest('.lvl')) openHelp('ai'); });
$('helpTabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) helpTab(b.dataset.tab); });
// Verweise im Text auf eine andere Seite des Handbuchs
$('helpBody').addEventListener('click', e => {
  const b = e.target.closest('[data-helptab]');
  if (!b) return;
  helpTab(b.dataset.helptab);
  const a = b.dataset.helpanchor && $(b.dataset.helpanchor);   // Sprung zu einem Abschnitt im Reiter
  if (a) a.scrollIntoView({ block: 'start' });
});
function closeModals() {
  // Fokus nicht im verborgenen Fenster lassen – sonst gingen die folgenden Spieltasten in ein unsichtbares Eingabefeld
  const f = document.activeElement;
  if (f && f.closest && f.closest('.modal')) f.blur();
  document.querySelectorAll('.modal').forEach(m => m.hidden = true); Sfx.preview(null);
}

// ------------------------------------------------------------------ Aufgeben / vorzeitiger Sieg
// Liegt das Kräfteverhältnis 5 Runden in Folge unter der Schwelle (bzw. über 100 % minus Schwelle), bietet das
// Spiel Aufgeben (den Sieg) an. Nach einer Ablehnung wird 10 Runden nicht erneut gefragt.
// Die Schwelle stellt man im Menü ein (archipel-offer: 0 = nie fragen, sonst Prozent; Standard 10).
const OFFER_TURNS = 5, OFFER_PAUSE = 10, OFFER_MIN_TURN = 15, OFFER_STEPS = [0, 5, 10, 15, 20, 25, 30];
let offerPct = 10;
try { const v = Number(localStorage.getItem('archipel-offer')); if (localStorage.getItem('archipel-offer') !== null && OFFER_STEPS.includes(v)) offerPct = v; } catch (e) {}
function shareOf(e) { return e.me + e.en > 0 ? e.me / (e.me + e.en) : 0.5; }
function maybeOfferEnd() {
  if (!offerPct || !S || S.over || !S.hist || S.turn < OFFER_MIN_TURN) return;
  if ([...document.querySelectorAll('.modal')].some(m => !m.hidden)) return;
  if (S.offerPause && S.turn < S.offerPause) return;
  const last = S.hist.slice(-OFFER_TURNS);
  if (last.length < OFFER_TURNS) return;
  const lim = offerPct / 100;
  const low = last.every(e => shareOf(e) < lim), high = last.every(e => shareOf(e) > 1 - lim);
  if (!low && !high) return;
  S.offerPause = S.turn + OFFER_PAUSE;      // gilt auch, wenn der Dialog einfach geschlossen wird
  const pct = Math.round(shareOf(last[last.length - 1]) * 100);
  const a = strength(0), b = strength(1);
  const facts = tt(`Du: ${a.cities} ${a.cities === 1 ? 'Stadt' : 'Städte'}, ${a.units} ${a.units === 1 ? 'Einheit' : 'Einheiten'}`, `You: ${a.cities} ${a.cities === 1 ? 'city' : 'cities'}, ${a.units} ${a.units === 1 ? 'unit' : 'units'}`);
  if (low) {
    $('offerTitle').textContent = tt('Die Lage ist aussichtslos', 'The situation is hopeless');
    const vsTop = nPlayers() > 2 ? tt(' im Vergleich zum stärksten Gegner', ' compared with the strongest enemy') : '';
    $('offerText').innerHTML = tt(`Seit ${OFFER_TURNS} Runden liegt deine Stärke${vsTop} unter ${offerPct} % (jetzt ${pct} %).<br><span class="muted">${facts}</span><br><br>Willst du aufgeben?`,
      `For ${OFFER_TURNS} turns your strength${vsTop} has been below ${offerPct} % (now ${pct} %).<br><span class="muted">${facts}</span><br><br>Do you want to surrender?`);
    $('offerYes').textContent = tt('Aufgeben', 'Surrender');
    $('offerNo').textContent = tt('Weiterkämpfen', 'Keep fighting');
    $('offerYes').onclick = () => { closeModals(); S.over = 'lose'; S.overReason = 'surrender'; saveGame(); showGameOver(); };
  } else {
    $('offerTitle').textContent = tt('Der Sieg ist dir sicher', 'Victory is yours');
    const multi = nPlayers() > 2, vsTop = multi ? tt(' selbst im Vergleich zum stärksten Gegner', ' even compared with the strongest enemy') : '';
    $('offerText').innerHTML = tt(`Seit ${OFFER_TURNS} Runden liegt deine Stärke${vsTop} über ${100 - offerPct} % (jetzt ${pct} %).<br><span class="muted">${facts}</span><br><br>${multi ? 'Deine Gegner bieten die Kapitulation an' : 'Der Gegner bietet die Kapitulation an'}. Sieg annehmen?`,
      `For ${OFFER_TURNS} turns your strength${vsTop} has been above ${100 - offerPct} % (now ${pct} %).<br><span class="muted">${facts}</span><br><br>${multi ? 'Your enemies offer to surrender' : 'The enemy offers to surrender'}. Accept victory?`);
    $('offerYes').textContent = tt('Sieg annehmen', 'Accept victory');
    $('offerNo').textContent = tt('Weiterspielen', 'Play on');
    $('offerYes').onclick = () => { closeModals(); S.over = 'win'; S.overReason = 'capitulation'; saveGame(); showGameOver(); };
  }
  $('offerNo').onclick = () => { closeModals(); saveGame(); };
  Sfx.play(low ? 'lost' : 'capture');
  openModal('mOffer');
}

// Abschlussfenster (Sieg oder Niederlage): Kopf wie beim Eroberungsfenster, links der Zeitraffer der ganzen Partie (spielt von selbst),
// rechts Eckdaten und je Einheitentyp gebaut / verloren für beide Seiten. Nach dem Ende ist alles aufgedeckt, auch die Zahlen des Gegners.
// Wieder aufrufen: Menü „Zeitraffer“ bzw. Taste T (quiet = ohne Fanfare).
const OVER_CHEERS = {
  win: [tt('Die Welt gehört dir!', 'The world is yours!'), tt('Das Archipel ist dein!', 'The archipelago is yours!'), tt('Ein Sieg für die Geschichtsbücher!', 'A victory for the history books!')],
  lose: [tt('Dein Reich ist gefallen.', 'Your empire has fallen.'), tt('Diesmal war der Gegner stärker.', 'This time the enemy was stronger.')],
};
function overCityMoves() {   // eroberte und verlorene Städte je Spieler aus der Aufzeichnung des Zeitraffers
  const r = { won: new Array(nPlayers()).fill(0), lost: new Array(nPlayers()).fill(0) };
  if (!S.tl) return r;
  const cur = new Array(S.cities.length).fill(-2);
  for (const [, id, o] of S.tl.own) {
    const prev = cur[id]; cur[id] = o;
    if (prev === -2 || prev === o) continue;
    if (o >= 0) r.won[o]++;
    if (prev >= 0) r.lost[prev]++;
  }
  return r;
}
function showGameOver(quiet = false) {
  recordStrength(); recordTimeline();   // Endstand für Kurve und Zeitraffer
  const win = S.over === 'win';
  $('mOver').querySelector('.over-dlg').classList.toggle('lose', !win);
  $('overBadge').textContent = win ? '🏆' : '🏳';
  $('overKicker').textContent = win ? tt('Sieg!', 'Victory!') : tt('Niederlage', 'Defeat');
  const ch = OVER_CHEERS[win ? 'win' : 'lose'];
  $('overTitle').textContent = ch[S.turn % ch.length];
  const n = nPlayers(), multi = n > 2, ps = Array.from({ length: n }, (_, p) => p);
  $('overText').textContent = win
    ? (S.overReason === 'capitulation' ? (multi ? tt(`Deine Gegner haben in Runde ${S.turn} vor deiner Übermacht kapituliert.`, `Your enemies surrendered to your superior force in turn ${S.turn}.`) : tt(`Der Gegner hat in Runde ${S.turn} vor deiner Übermacht kapituliert.`, `The enemy surrendered to your superior force in turn ${S.turn}.`))
      : multi ? (n === 3 ? tt(`Du hast beide Gegner besiegt und die Welt in ${S.turn} Runden erobert.`, `You defeated both enemies and conquered the world in ${S.turn} turns.`)
        : tt(`Du hast alle ${n - 1} Gegner besiegt und die Welt in ${S.turn} Runden erobert.`, `You defeated all ${n - 1} enemies and conquered the world in ${S.turn} turns.`)) : tt(`Du hast die Welt in ${S.turn} Runden erobert.`, `You conquered the world in ${S.turn} turns.`))
    : (S.overReason === 'surrender' ? tt(`Du hast in Runde ${S.turn} aufgegeben.`, `You surrendered in turn ${S.turn}.`)
      : multi ? tt(`Deine Gegner haben in Runde ${S.turn} alle deine Städte eingenommen.`, `Your enemies took all your cities in turn ${S.turn}.`) : tt(`Der Gegner hat in Runde ${S.turn} alle deine Städte eingenommen.`, `The enemy took all your cities in turn ${S.turn}.`));

  // Eckdaten – je Spieler eine Zahl in seiner Farbe (du blau, Gegner rot, gelb, violett)
  const per = v => (Array.isArray(v) && v.length === n ? v : ps.map(() => ({})));
  const built = per(S.built), kills = per(S.kills), wasted = per(S.wasted), lostBy = per(S.lost);
  const sum = o => Object.values(o).reduce((x, y) => x + y, 0);
  const lostOf = p => { const r = {}; for (const k of UNIT_ORDER) r[k] = (lostBy[p][k] || 0) + (wasted[p][k] || 0); return r; };
  const lost = ps.map(lostOf);
  const cm = overCityMoves();
  const cities = p => S.cities.filter(c => c.owner === p).length;
  // w2 = doppelt breit (mit mehreren Gegnern stehen bis zu vier Zahlen in einem Kästchen)
  const box = (v, l, w2) => `<div${w2 ? ' class="w2"' : ''}><b>${v}</b><span>${l}</span></div>`;
  const vs = f => ps.map(p => `<i style="color:${PLAYERS[p].light}">${f(p)}</i>`).join(' : ');
  const sz = MAP_SIZES[S.size], wd = WORLDS[S.world];
  $('overFacts').innerHTML = box(S.turn, tt('Runden', 'Turns')) + box(esc(diff().label), tt('Schwierigkeit', 'Difficulty'))
    + box(esc(wd ? wd.label : '–'), tt('Welt', 'World') + (sz ? ' · ' + esc(sz.label.split(' ')[0]) : ''), multi)
    + box(vs(cities), tt('Städte am Ende', 'Cities at the end'), multi)
    + box(vs(p => cm.won[p] || 0), tt('Städte erobert', 'Cities captured'), multi)
    + box(vs(p => sum(built[p])), tt('Einheiten gebaut', 'Units built'), multi)
    + box(vs(p => sum(kills[p])), tt('Einheiten zerstört', 'Units destroyed'), multi)
    + (multi ? box(vs(p => (S.outAt && S.outAt[p]) || (p === 0 && !win ? S.turn : '–')), tt('Ausgeschieden in Runde', 'Knocked out in turn'), true) : '')
    + (S.seed != null ? box('<span class="seedv">' + fmtSeed(S.seed) + '</span>', tt('Kartennummer', 'Map number')) : '');

  // je Einheitentyp: gebaut und verloren für jeden Spieler (mit mehreren Gegnern schmaler: kurze Überschriften)
  $('mOver').querySelector('.over-units').classList.toggle('multi', multi);
  const hB = multi ? tt('geb.', 'built') : tt('gebaut', 'built'), hL = multi ? tt('verl.', 'lost') : tt('verloren', 'lost');
  $('overHead').innerHTML = `<tr><th></th>${ps.map(p => `<th colspan="2" class="grp" style="color:${PLAYERS[p].light}">${esc(pname(p))}</th>`).join('')}</tr>`
    + `<tr><th>${tt('Einheit', 'Unit')}</th>${ps.map(() => `<th class="num" title="${tt('gebaut', 'built')}">${hB}</th><th class="num" title="${tt('verloren', 'lost')}">${hL}</th>`).join('')}</tr>`;
  const cell = v => `<td class="num ${v ? '' : 'zero'}">${v}</td>`;
  const tot = new Array(2 * n).fill(0);
  const rows = UNIT_ORDER.map(k => {
    const v = ps.flatMap(p => [built[p][k] || 0, lost[p][k]]);
    if (!v.some(Boolean)) return '';
    v.forEach((x, i) => { tot[i] += x; });
    return `<tr><td><span class="sym">${UT[k].sym}</span>${UT[k].name}</td>${v.map(x => cell(x)).join('')}</tr>`;
  }).join('');
  $('overUnits').innerHTML = rows + `<tr class="sum"><td>${tt('Gesamt', 'Total')}</td>${tot.map(x => `<td class="num">${x}</td>`).join('')}</tr>`;
  const from = Math.max(S.builtFrom || 1, S.killsFrom || 1);
  $('overNote').textContent = tt('Gebaut: in Städten, ohne Starteinheiten. Verloren: auch Ladung versenkter Schiffe und Abstürze.',
      'Built: in cities, without starting units. Lost: including cargo of sunk ships and crashes.')
    + (from > 1 ? ' ' + tt(`Gezählt seit Runde ${from} (älterer Spielstand).`, `Counted since turn ${from} (older save).`) : '');

  openModal('mOver');
  openTimelapse('mOver');
  if (!quiet) Sfx.play(win ? 'victory' : 'defeat');
  refresh();
}

// ------------------------------------------------------------------ Zeitraffer
// Spielt den Verlauf der Partie Runde für Runde ab (Aufzeichnung: recordTimeline in game.js, Kurve aus S.hist): entdeckte Karte,
// Städte und ihr Umland in der Farbe des Besitzers, darunter das Kräfteverhältnis. Während der Partie nur, was der Mensch zur
// jeweiligen Zeit wusste (sonst verriete der Zeitraffer den Gegner im Nebel); nach dem Spielende die ganze Wahrheit.
// Die Kurve folgt der Einstellung „Kräfteverhältnis anzeigen“ (am Spielende immer sichtbar). Menü, Taste T, Spielende-Fenster.
// Der Baustein #tlView (Karte, Zeile, Kurve, Bedienung) wird in das Fenster gehängt, das ihn gerade zeigt: Zeitraffer (#tlHome)
// oder Spielende (#overTl). tlv.modal = dieses Fenster; ist es zu, hält die Wiedergabe an.
const tlv = { t: 1, from: 1, to: 1, play: false, last: 0, acc: 0, s: 8, zone: null, truth: false, off: null, modal: null };
// Umland: jedes Landfeld gehört zur nächstgelegenen Stadt auf derselben Insel (höchstens 4 Schritte entfernt)
function tlZone() {
  const z = new Int16Array(S.W * S.H).fill(-1);
  let q = [];
  for (const c of S.cities) { const i = idx(c.x, c.y); z[i] = c.id; q.push(i); }
  for (let step = 1; step <= 4 && q.length; step++) {
    const nq = [];
    for (const i of q) {
      const x = i % S.W, y = (i - x) / S.W;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (!S.terrain[j] || z[j] >= 0) continue;
        z[j] = z[i]; nq.push(j);
      }
    }
    q = nq;
  }
  return z;
}
function tlOwnersAt(list, t) {   // Besitzer je Stadt zur Runde t (-2 = unbekannt / noch kein Eintrag)
  const r = new Array(S.cities.length).fill(-2);
  for (const e of list) { if (e[0] > t) break; r[e[1]] = e[2]; }
  return r;
}
function openTimelapse(host = 'mTime') {
  if (!S) return;
  closeMenu(); closeCtx();
  if (S.over && host === 'mTime') { closeModals(); showGameOver(true); return; }   // nach dem Ende: Abschlussfenster mit Zeitraffer
  recordTimeline();
  if (!S.tl) return;
  tlv.modal = $(host);
  $(host === 'mOver' ? 'overTl' : 'tlHome').appendChild($('tlView'));
  tlv.truth = !!S.over;
  tlv.from = S.tl.from; tlv.to = Math.max(S.turn, tlv.from);
  tlv.zone = tlZone();
  const s = Math.max(3, Math.floor(Math.min(720 / S.W, 450 / S.H)));
  tlv.s = s;
  const m = $('tlMap'); m.width = S.W * s; m.height = S.H * s;
  tlv.off = document.createElement('canvas'); tlv.off.width = S.W; tlv.off.height = S.H;
  const sl = $('tlSlider'); sl.min = tlv.from; sl.max = tlv.to;
  $('tlNote').textContent = (tlv.truth
    ? tt('Die Partie ist vorbei – der Zeitraffer zeigt die ganze Karte und alle Städte, auch was im Nebel lag.', 'The game is over – the time-lapse shows the whole map and every city, including what lay in the fog.')
    : tt('Gezeigt wird nur, was du zur jeweiligen Zeit wusstest. Nach dem Spielende siehst du hier die ganze Wahrheit.', 'Only what you knew at the time is shown. After the game ends you will see the whole truth here.'))
    + (tlv.from > 1 ? ' ' + tt(`Aufgezeichnet seit Runde ${tlv.from} (älterer Spielstand).`, `Recorded since turn ${tlv.from} (older save).`) : '');
  $('tlCurve').hidden = !(showPower || tlv.truth);
  openModal(host);
  tlSet(tlv.from);
  tlPlay(tlv.to > tlv.from);
}
function tlSet(t) {
  tlv.t = Math.max(tlv.from, Math.min(tlv.to, Math.round(t)));
  $('tlSlider').value = tlv.t;
  tlDraw();
}
function tlPlay(on) {
  if (on && tlv.t >= tlv.to) tlv.t = tlv.from;   // am Ende: von vorn
  tlv.play = !!on;
  $('tlPlay').textContent = tlv.play ? '❚❚ ' + tt('Pause', 'Pause') : '▶ ' + tt('Abspielen', 'Play');
  if (tlv.play) { tlv.last = performance.now(); tlv.acc = 0; requestAnimationFrame(tlTick); }
}
function tlTick(now) {
  if (!tlv.play) return;
  if (!tlv.modal || tlv.modal.hidden) { tlPlay(false); return; }
  tlv.acc += (now - tlv.last) / 1000 * (+$('tlSpeed').value || 5);
  tlv.last = now;
  if (tlv.acc >= 1) {
    const step = Math.floor(tlv.acc); tlv.acc -= step;
    tlSet(tlv.t + step);
    if (tlv.t >= tlv.to) { tlPlay(false); return; }
  }
  requestAnimationFrame(tlTick);
}
function tlDraw() {
  const t = tlv.t, tl = S.tl, W = S.W, H = S.H, N = W * H, s = tlv.s;
  const owners = tlOwnersAt(tlv.truth ? tl.own : tl.know, t);
  // Besitzwechsel genau in dieser Runde (weißer Ring) – nicht, wenn eine Stadt nur neu entdeckt wurde
  const prev = t > tlv.from ? tlOwnersAt(tlv.truth ? tl.own : tl.know, t - 1) : owners;
  const fresh = new Set(S.cities.filter(c => prev[c.id] !== -2 && prev[c.id] !== owners[c.id]).map(c => c.id));
  // Gelände in Feldauflösung, dann vergrößert
  const octx = tlv.off.getContext('2d'), img = octx.createImageData(W, H), px = img.data;
  const tint = [[60, 140, 245], [235, 72, 62], [236, 172, 36], [172, 104, 232]];   // Umland je Spieler (PLAYERS): kräftig, damit es sich vom dunklen Wasser abhebt
  let seenN = 0;
  for (let i = 0; i < N; i++) {
    const known = tlv.truth || (tl.seen[i] && tl.seen[i] <= t);
    let c = [8, 11, 16];
    if (known) {
      if (tl.seen[i] && tl.seen[i] <= t) seenN++;
      c = S.terrain[i] ? [92, 138, 72] : [22, 46, 74];
      const zc = tlv.zone[i];
      const o = zc >= 0 ? owners[zc] : -2;
      if (S.terrain[i] && o >= 0) c = c.map((v, k) => Math.round(v * 0.3 + tint[o][k] * 0.7));
    }
    px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  const m = $('tlMap'), ctx = m.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tlv.off, 0, 0, W * s, H * s);
  // Städte
  const cnt = { '-1': 0, unk: 0 };
  for (let p = 0; p < nPlayers(); p++) cnt[p] = 0;
  const r = Math.max(2.5, s * 0.6);
  for (const c of S.cities) {
    const o = owners[c.id];
    if (o === -2) { cnt.unk++; continue; }
    cnt[o]++;
    const cx = c.x * s + s / 2, cy = c.y * s + s / 2;
    if (fresh.has(c.id)) {
      ctx.beginPath(); ctx.arc(cx, cy, r + Math.max(3, s * 0.45), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1.5, s * 0.18); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = ownerPal(o).color; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1; ctx.stroke();
  }
  $('tlTurn').textContent = tt(`Runde ${t}`, `Turn ${t}`);
  const dot = o => `<i style="background:${ownerPal(o).color}"></i>`;
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  $('tlStats').innerHTML = `<span>${dot(0)}${tt('Du', 'You')}: ${plural(cnt[0], tt('Stadt', 'city'), tt('Städte', 'cities'))}</span>`
    + Array.from({ length: nPlayers() - 1 }, (_, i) => `<span>${dot(i + 1)}${esc(pname(i + 1))}: ${cnt[i + 1]}</span>`).join('')
    + `<span>${dot(-1)}${tt('neutral', 'neutral')}: ${cnt[-1]}</span>`
    + (tlv.truth ? '' : `<span>${tt('unbekannt', 'unknown')}: ${cnt.unk}</span>`)
    + (tlv.truth ? '' : `<span>${tt('entdeckt', 'explored')}: ${Math.round(seenN / N * 100)} %</span>`);
  tlCurve();
}
// Kräfteverhältnis über die Runden: Anteil „Du“ blau von unten, Gegner rot darüber, Strich bei der gezeigten Runde.
// Mehrere Gegner: alle Parteien gestapelt in ihren Farben (Anteil an der Stärke aller) – sofern die Aufzeichnung sie kennt (S.hist.all)
function tlCurve() {
  const cv2 = $('tlCurve');
  if (cv2.hidden) return;
  const w = cv2.clientWidth || 720, h = 54, dpr = window.devicePixelRatio || 1;
  if (cv2.width !== Math.round(w * dpr)) { cv2.width = Math.round(w * dpr); cv2.height = Math.round(h * dpr); }
  const ctx = cv2.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const hist = (S.hist || []).filter(e => e.t >= tlv.from && e.t <= tlv.to);
  const span = Math.max(1, tlv.to - tlv.from);
  const X = t => (t - tlv.from) / span * (w - 2) + 1;
  const stacked = nPlayers() > 2 && hist.length > 0 && hist.every(e => Array.isArray(e.all) && e.all.length === nPlayers());
  ctx.fillStyle = '#5a1f1c'; ctx.fillRect(0, 0, w, h);
  if (stacked) {
    let lower = hist.map(() => 0);
    for (let p = 0; p < nPlayers(); p++) {
      const upper = hist.map((e, i) => lower[i] + e.all[p] / Math.max(1, e.all.reduce((s, v) => s + v, 0)));
      ctx.beginPath();
      hist.forEach((e, i) => (i ? ctx.lineTo(X(e.t), h - upper[i] * h) : ctx.moveTo(X(e.t), h - upper[i] * h)));
      for (let i = hist.length - 1; i >= 0; i--) ctx.lineTo(X(hist[i].t), h - lower[i] * h);
      ctx.closePath(); ctx.fillStyle = PLAYERS[p].color; ctx.fill();
      lower = upper;
    }
  } else if (hist.length) {
    ctx.beginPath(); ctx.moveTo(X(hist[0].t), h);
    for (const e of hist) ctx.lineTo(X(e.t), h - e.me / Math.max(1, e.me + e.en) * h);
    ctx.lineTo(X(hist[hist.length - 1].t), h); ctx.closePath();
    ctx.fillStyle = '#2f7de1'; ctx.fill();
  }
  if (!stacked) {   // 50-%-Linie nur im Zweikampf
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h / 2 + 0.5); ctx.lineTo(w, h / 2 + 0.5); ctx.stroke(); ctx.setLineDash([]);
  }
  const x = X(tlv.t);
  ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x) - 1, 0, 2, h);
  const e = hist.filter(o => o.t <= tlv.t).pop();
  if (e) {
    const pct = Math.round((stacked ? allShare(e) : e.me / Math.max(1, e.me + e.en)) * 100);
    ctx.font = '600 12px system-ui, sans-serif'; ctx.textBaseline = 'top';
    const txt = tt(`Du ${pct} %`, `You ${pct} %`), tw = ctx.measureText(txt).width;
    const tx = Math.min(Math.max(4, x + 6), w - tw - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(tx - 3, 3, tw + 6, 16);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, tx, 5);
  }
}
$('tlPlay').onclick = () => tlPlay(!tlv.play);
$('tlSlider').oninput = e => { tlPlay(false); tlSet(+e.target.value); };
$('tlCurve').onclick = e => {
  const r = e.currentTarget.getBoundingClientRect();
  tlPlay(false); tlSet(tlv.from + (e.clientX - r.left) / r.width * (tlv.to - tlv.from));
};
$('tlMap').onclick = () => tlPlay(!tlv.play);
try { const sp = localStorage.getItem('archipel-tlspeed'); if (sp && [...$('tlSpeed').options].some(o => o.value === sp)) $('tlSpeed').value = sp; else $('tlSpeed').value = '5'; } catch (e) { $('tlSpeed').value = '5'; }
$('tlSpeed').onchange = e => { try { localStorage.setItem('archipel-tlspeed', e.target.value); } catch (err) {} };
$('bTime').onclick = () => openTimelapse();

function startNew(size, diffKey, worldKey, seed = null, nAi = 0) {   // seed: Kartennummer (null = zufällig), nAi: Zahl der Gegner
  prodView = false; pathView = false; rallyMode = null; updateViewSwitch();
  resetCheatFog();   // jede neue oder geladene Partie beginnt mit Nebel
  if (!diffKey) { try { diffKey = localStorage.getItem('archipel-diff') || 'normal'; } catch (e) { diffKey = 'normal'; } }
  if (!worldKey) { try { worldKey = localStorage.getItem('archipel-world') || 'inseln'; } catch (e) { worldKey = 'inseln'; } }
  if (!nAi) { try { nAi = +localStorage.getItem('archipel-ais') || 1; } catch (e) { nAi = 1; } }
  setTimeout(() => { logSeen = S.log[0] || null; updateLogHead(); }, 0);
  newGame(size, diffKey, worldKey, seed, nAi);
  sel = null; selCity = null; hover = null; updateHover();
  resizeCanvas();
  selectNext();
  const u = selUnit();
  if (u) centerOn(u.x, u.y, true);
  saveGame();
  refresh();
}

function afterLoad() {
  if (!S.gameId) S.gameId = 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);   // ältere Partie: ab jetzt gruppierbar
  landCheck = true;
  prodView = false; pathView = false; rallyMode = null; updateViewSwitch();
  resetCheatFog();   // jede neue oder geladene Partie beginnt mit Nebel
  logSeen = S.log[0] || null;
  if (!S.hist) S.hist = [];
  if (!S.hist.length) recordStrength();
  sel = null; selCity = null; hover = null; updateHover();
  resizeCanvas();
  computeVision(0);
  recordTimeline();   // ältere Spielstände ohne Zeitraffer: Aufzeichnung beginnt jetzt
  selectNext();
  const u = selUnit();
  const c = S.cities.find(c => c.owner === 0);
  if (u) centerOn(u.x, u.y, true); else if (c) centerOn(c.x, c.y, true);
  refresh();
}

// ------------------------------------------------------------------ Eingabe
function tileFromEvent(e) {
  const r = cv.getBoundingClientRect();
  return [Math.floor((e.clientX - r.left) / TS), Math.floor((e.clientY - r.top) / TS)];
}

cv.addEventListener('click', e => {
  if (dragSwallow) { dragSwallow = false; return; }   // die linke Taste hat gerade die Karte gezogen
  if (ctxSwallow) { ctxSwallow = false; return; }
  if (enemyPlaybackRunning()) { skipAnim(); return; }
  const [x, y] = tileFromEvent(e); onTileClick(x, y, e.shiftKey);
});
// ------------------------------------------------------------------ Karte ziehen
// Mittlere oder rechte Maustaste gedrückt halten und ziehen verschiebt die Karte
// 1:1 (ersetzt das beschleunigte Auto-Scrollen des Browsers). Ein kurzer
// Rechtsklick ohne Ziehen behält seine Funktion.
let drag = null, dragSwallow = false;
const DRAG_THRESHOLD = 4, DRAG_THRESHOLD_LEFT = 9;   // links großzügiger, damit ein Klick mit leichtem Wackeln ein Klick bleibt
function rightClickAction(e) {
  if (gotoPreview) { gotoPreview = null; refresh(); return; }   // Wegvorschau verwerfen
  if (rallyMode) { rallyAbort(); return; }
  if (prodView) { if (e && S) { const [x, y] = tileFromEvent(e); onTileClick(x, y, false); } return; }
  if (patrolMode) { patrolUndo(); return; }
  if (e && S && !S.over && !anyModalOpen()) {
    const [x, y] = tileFromEvent(e);
    if (inb(x, y) && openCtx(x, y, e.clientX, e.clientY)) return;
  }
  sel = null; selCity = null; refresh();
}

// ------------------------------------------------------------------ Kontextmenü
// Rechtsklick auf eigene Einheit/Stadt: Befehle, Auswahl im Stapel, Produktion
const ctxEl = $('ctxMenu');
let cmenu = null, ctxSwallow = false;
function ctxUnits(x, y) {
  const top = topUnitsAt(x, y).filter(o => o.owner === 0);
  return top.concat(...top.map(cargoOf)).filter(o => o.owner === 0);
}
function openCtx(x, y, cx, cy) {
  const units = ctxUnits(x, y);
  const city = cityAt(x, y);
  const ownCity = city && city.owner === 0 ? city : null;
  if (!units.length && !ownCity) return false;
  let u = selUnit();
  if (!u || !units.includes(u)) u = units.find(needsOrders) || units[0] || null;
  sel = u ? u.id : null;            // ohne select(): eine Wache bleibt Wache
  selCity = ownCity ? ownCity.id : null;
  cmenu = { x, y, cx, cy };
  Sfx.play('tick');
  renderCtx();
  refresh();
  return true;
}
function closeCtx() { if (!cmenu) return; cmenu = null; ctxEl.hidden = true; }
function renderCtx() {
  if (!cmenu || !S) return closeCtx();
  const units = ctxUnits(cmenu.x, cmenu.y), city = cityAt(cmenu.x, cmenu.y);
  const ownCity = city && city.owner === 0 ? city : null;
  const u = selUnit() && units.includes(selUnit()) ? selUnit() : null;
  if (!units.length && !ownCity) return closeCtx();
  const status = o => o.order ? (EN ? { sentry: 'sentry', patrol: 'patrol', explore: 'exploring', goto: 'marching', load: 'loading' } : { sentry: 'Wache', patrol: 'Patrouille', explore: 'Erkundet', goto: 'Marsch', load: 'lädt' })[o.order.type] || ''
    : o.moves <= 0 ? tt('fertig', 'done') : o.carrier != null ? tt('an Bord', 'on board') : tt('wartet', 'waiting');
  let h = '';
  if (ownCity) h += `<div class="cmenu-head"><b>${esc(ownCity.name)}</b>${ownCity.coastal ? tt(' · Hafen', ' · port') : ''}</div>`;
  if (units.length > 1) {
    if (!ownCity) h += `<div class="cmenu-head">${tt(`${units.length} Einheiten auf dem Feld`, `${units.length} units on this tile`)}</div>`;
    for (const o of units) h += `<button data-cunit="${o.id}" class="${u === o ? 'cur' : ''}"><img src="${iconUrl('u', o.type)}" alt="">${esc(T(o).name)} ${o.hp}/${T(o).hp}<small>${status(o)}</small></button>`;
    h += '<hr>';
  }
  if (u) {
    const t = T(u), aboard = u.carrier != null, here = cityAt(u.x, u.y);
    const homeOk = c => c && c.owner === 0 && (t.domain !== 'sea' || c.coastal);
    if (units.length <= 1) h += `<div class="cmenu-head"><b>${esc(t.name)}</b> · ${u.moves}/${t.move} ${tt('Bewegung', 'moves')}${t.fuel ? ` · ${tt('Treibstoff', 'fuel')} ${u.fuel}` : ''}</div>`;
    const btn = (act, label, key, dis = false) => `<button data-cact="${act}" ${dis ? 'disabled' : ''}>${label}${key ? `<kbd>${key}</kbd>` : ''}</button>`;
    h += btn('skip', tt('Überspringen', 'Skip'), tt('Leertaste', 'Space'), u.moves <= 0 && !landingPending(u));
    h += btn('sentry', tt('Wache', 'Sentry'), 'S', !!(u.order && u.order.type === 'sentry'));
    h += btn('explore', tt('Erkunden', 'Explore'), 'R', (aboard && t.domain === 'land') || (u.type === 'trn' && cargoOf(u).length > 0));
    h += btn('patrol', tt('Patrouille', 'Patrol'), 'P', aboard);
    h += btn('home', t.domain === 'sea' ? tt('Heimkehr (Hafen)', 'Return home (port)') : tt('Heimkehr', 'Return home'), 'B', !aboard && homeOk(here));
    if (t.carries === 'land') h += btn('landing', `${u.landing ? '☑' : '☐'} ${tt('Ausladen, wenn möglich', 'Unload when possible')}`, '', !u.landing && !cargoOf(u).length);
    if (t.carries === 'land') h += btn('load', tt('Laden bis voll', 'Load until full'), 'L', !!(u.order && u.order.type === 'load') || cargoOf(u).length >= t.capacity);
    else if (t.carries && here && here.owner === 0) h += btn('load', tt('Einladen', 'Load'), 'L');
    if (t.carries && cargoOf(u).length) {
      const opts = t.carries === 'land' ? assaultOptions(u) : [], tgt = opts.find(o => o.kind === 'city'), foe = opts.find(o => o.kind === 'unit');
      if (tgt) h += btn('unload', `⚔ ${tt('Angriff auf', 'Attack')} ${esc(tgt.name)} · ${Math.round(tgt.chance * 100)} %`, 'U') + btn('unloadLand', tt('Nur an Land setzen', 'Just put ashore'), '');
      else h += btn('unload', `${tt('Ausladen', 'Unload')} (${cargoOf(u).length})`, 'U');
      if (foe) h += btn('assaultUnit', `⚔ ${tt('Angriff auf', 'Attack')} ${esc(foe.name)} · ${Math.round(foe.chance * 100)} %`, '');
    }
    if (u.order) h += btn('cancel', u.order.type === 'sentry' ? tt('Wecken', 'Wake') : tt('Befehl löschen', 'Clear order'), '');
    h += '<hr>' + btn('help', tt(`Handbuch: ${t.name}`, `Handbook: ${t.name}`), '');
  }
  if (ownCity) {
    const p = ownCity.prod ? UT[ownCity.prod] : null;
    if (u) h += '<hr>';
    h += `<button data-cact="prod"><img src="${iconUrl('c', ownCity.id % 2)}" alt="">${tt('Produktion ändern …', 'Change production …')}<small>${p ? `${esc(p.name)} · ${p.cost - ownCity.progress} ${tt('R.', 'T.')}` : tt('nichts', 'nothing')}</small></button>`;
    if (ownCity.prod) h += `<button data-cact="rally"><span class="cglyph">⚑</span>${ownCity.rally ? tt('Marschziel ändern …', 'Change rally point …') : tt('Marschziel setzen …', 'Set rally point …')}</button>`;
    if (ownCity.rally) h += `<button data-cact="rallyclear"><span class="cglyph">✕</span>${tt('Marschziel löschen', 'Clear rally point')}</button>`;
  }
  ctxEl.innerHTML = h;
  ctxEl.hidden = false;
  // im Fenster halten
  const w = ctxEl.offsetWidth, hh = ctxEl.offsetHeight;
  ctxEl.style.left = Math.max(4, Math.min(cmenu.cx + 2, innerWidth - w - 4)) + 'px';
  ctxEl.style.top = Math.max(4, Math.min(cmenu.cy + 2, innerHeight - hh - 4)) + 'px';
}
ctxEl.addEventListener('contextmenu', e => e.preventDefault());
ctxEl.addEventListener('click', e => {
  const ub = e.target.closest('[data-cunit]');
  if (ub) { const o = unitById(+ub.dataset.cunit); if (o) { sel = o.id; Sfx.play('select'); renderCtx(); refresh(); } return; }
  const b = e.target.closest('[data-cact]');
  if (!b || b.disabled) return;
  const city = cmenu ? cityAt(cmenu.x, cmenu.y) : null;
  closeCtx();
  if (b.dataset.cact === 'rally') { actRally(city); return; }
  if (b.dataset.cact === 'rallyclear') { rallyClear(city); return; }
  if (b.dataset.cact === 'prod') { if (city && city.owner === 0) { Sfx.play('tick'); openProdDialog(city); } return; }
  const u = selUnit();
  if (b.dataset.cact === 'help') { if (u) openHelp(null, u.type); return; }
  if (u && u.order && u.order.type === 'sentry' && b.dataset.cact !== 'sentry' && b.dataset.cact !== 'cancel') u.order = null;
  ({ skip: actSkip, sentry: actSentry, load: actLoad, unload: actUnload, unloadLand: () => actUnload(true), assaultUnit: () => { const tr = selUnit(), o = tr && assaultOptions(tr).find(k => k.kind === 'unit'); if (o) doAssault(tr, o); }, landing: actLanding, cancel: actCancel, patrol: actPatrol, explore: actExplore, home: actHome })[b.dataset.cact]();
});
// Klick daneben schließt das Menü (und löst sonst nichts aus)
document.addEventListener('mousedown', e => {
  if (!cmenu || ctxEl.contains(e.target)) return;
  closeCtx();
  if (e.button === 0 && e.target === cv) ctxSwallow = true;
}, true);
window.addEventListener('resize', closeCtx);
window.addEventListener('blur', closeCtx);
cv.addEventListener('mousedown', e => {
  if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
  dragSwallow = false;
  if (e.button === 0) {
    // Linke Taste: Ein kurzer Klick wählt und zieht wie gewohnt; erst Halten und Ziehen verschiebt die Karte
    // (so lässt sich die Karte auch am Touchpad bewegen).
    drag = { btn: 0, x: e.clientX, y: e.clientY, sl: view.x, st: view.y, moved: false };
    return;
  }
  e.preventDefault();                       // verhindert das Auto-Scrollen
  if (enemyPlaybackRunning()) skipAnim();
  cam.active = false;
  drag = { btn: e.button, x: e.clientX, y: e.clientY, sl: view.x, st: view.y, moved: false };
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < (drag.btn === 0 ? DRAG_THRESHOLD_LEFT : DRAG_THRESHOLD)) return;
  if (!drag.moved) { drag.moved = true; cam.active = false; cv.style.cursor = 'grabbing'; }
  view.x = drag.sl - dx;
  view.y = drag.st - dy;
});
window.addEventListener('mouseup', e => {
  if (!drag || e.button !== drag.btn) return;
  const d = drag; drag = null;
  cv.style.cursor = '';
  if (d.btn === 0 && d.moved) dragSwallow = true;   // der folgende Klick gehört zum Ziehen
  if (d.btn === 2 && !d.moved) rightClickAction(e);
});
cv.addEventListener('contextmenu', e => e.preventDefault());

// Mausrad zoomt (zur Mausposition hin). Am Touchpad verschiebt Zwei-Finger-Wischen die Karte, die
// Spreizgeste (meldet der Browser als Rad mit Strg) zoomt. Unterschieden wird am Signal: Ein Touchpad liefert
// viele kleine, oft krumme oder seitliche Schritte, ein Mausrad große gerade. Einstellung `archipel-wheel`
// (auto | zoom | pan) übersteuert die Erkennung.
let wheelAcc = 0, padUntil = 0, wheelMode = 'auto';
try { const m = localStorage.getItem('archipel-wheel'); if (m === 'zoom' || m === 'pan') wheelMode = m; } catch (e) {}
function looksLikeTouchpad(e) {
  if (e.deltaMode !== 0) return false;                       // Zeilen/Seiten: Mausrad
  const now = performance.now();
  const ay = Math.abs(e.deltaY), ax = Math.abs(e.deltaX);
  const wd = typeof e.wheelDeltaY === 'number' && e.wheelDeltaY !== 0 ? Math.abs(e.wheelDeltaY) : null;
  // Bewährt (auf einem echten Notebook geprüft): seitliche, krumme oder kleine Schritte kommen vom Touchpad.
  let pad = ax > 0 || !Number.isInteger(e.deltaY) || (ay > 0 && ay < 40);
  // Zusätzlich für schnelle Wischer mit großen Schritten: In Chrome/Edge meldet ein Touchpad wheelDelta = 3 × delta,
  // ein Mausrad je Raste ein Vielfaches von 120.
  if (!pad && wd != null) pad = Math.abs(wd - 3 * ay) < 1.5 && wd % 120 !== 0;
  if (pad) padUntil = now + 500;
  return pad || now < padUntil;                              // Nachlauf einer Wischbewegung
}
// letzte Erkennung, für die Anzeige im Handbuch (hilft beim Einstellen und bei Fehlermeldungen)
function showWheelInfo(e, pan, pinch) {
  const el = $('wheelInfo');
  if (!el) return;
  const what = pinch ? tt('Spreizgeste → zoomt', 'pinch → zooms') : pan ? tt('Touchpad → verschiebt', 'touchpad → pans') : tt('Mausrad → zoomt', 'mouse wheel → zooms');
  const r1 = v => Math.round(v * 10) / 10;
  el.textContent = tt('Zuletzt erkannt: ', 'Last detected: ') + what + ` · Signal ${r1(e.deltaX)} / ${r1(e.deltaY)}${typeof e.wheelDeltaY === 'number' ? ' / ' + e.wheelDeltaY : ''}${e.deltaMode ? ' / ' + tt('Zeilen', 'lines') : ''}`;
}
wrap.addEventListener('wheel', e => {
  if (!S) return;
  e.preventDefault();
  const pinch = e.ctrlKey;                                   // Spreizgeste oder Strg + Rad: immer zoomen
  const pan = !pinch && (wheelMode === 'pan' || (wheelMode === 'auto' && looksLikeTouchpad(e)));
  showWheelInfo(e, pan, pinch);
  if (pan) {
    cam.active = false;
    view.x += e.deltaX; view.y += e.deltaY;
    return;
  }
  const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
  wheelAcc += e.deltaY * unit * (pinch ? 4 : 1);             // Spreizgesten liefern sehr kleine Schritte
  if (Math.abs(wheelAcc) < 60) return;
  const dir = wheelAcc < 0 ? 1 : -1;
  wheelAcc = 0;
  const r = wrap.getBoundingClientRect();
  setZoom(TS + dir * 4, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
cv.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
// Einstellung im Handbuch (Reiter „Steuerung“)
$('wheelSel').value = wheelMode;
$('wheelSel').onchange = () => { wheelMode = $('wheelSel').value; try { localStorage.setItem('archipel-wheel', wheelMode); } catch (e) {} };
cv.addEventListener('mousemove', e => {
  const t = tileFromEvent(e);
  if (!hover || hover[0] !== t[0] || hover[1] !== t[1]) { hover = inb(t[0], t[1]) ? t : null; dirty = true; updateHover(); }
});
cv.addEventListener('mouseleave', () => { hover = null; dirty = true; updateHover(); });
wrap.addEventListener('scroll', () => renderMini());
mini.addEventListener('click', e => {
  const r = mini.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * S.W, y = (e.clientY - r.top) / r.height * S.H;
  view.x = x * TS - wrap.clientWidth / 2; view.y = y * TS - wrap.clientHeight / 2;
});

$('panel').addEventListener('click', e => {
  const q = e.target.closest('[data-help]');
  if (q) { openHelp(null, q.dataset.help); return; }
  const chip = e.target.closest('[data-unit]');
  if (chip) { const u = unitById(+chip.dataset.unit); if (u) { select(u); refresh(); } return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  ({ skip: actSkip, sentry: actSentry, load: actLoad, unload: actUnload, unloadLand: () => actUnload(true), assaultUnit: () => { const tr = selUnit(), o = tr && assaultOptions(tr).find(k => k.kind === 'unit'); if (o) doAssault(tr, o); }, landing: actLanding, cancel: actCancel, next: actNext, patrol: actPatrol, patrolGo: patrolStart, patrolUndo: patrolUndo, patrolAbort: patrolAbort, explore: actExplore, home: actHome,
    rally: () => actRally(S.cities[selCity]), rallyclear: () => rallyClear(S.cities[selCity]), rallyabort: rallyAbort })[b.dataset.act]();
});
// ------------------------------------------------------------------ Meldungen ein-/ausklappen
let logOpen = false, logSeen = null;   // logSeen: neueste Meldung beim letzten Hinsehen
try { logOpen = localStorage.getItem('archipel-logopen') === '1'; } catch (e) {}
function updateLogHead() {
  const box = $('logBox');
  box.classList.toggle('collapsed', !logOpen);
  if (logOpen) logSeen = S.log[0] || null;
  let n = 0;
  for (const l of S.log) { if (l === logSeen) break; n++; }
  $('logNew').textContent = !logOpen && n ? n + tt(' neu', ' new') : '';
  const l = S.log[0], last = $('logLast');
  if (l) {
    last.innerHTML = `<span class="t">${tt('R', 'T')}${l.t}</span><span class="${l.cls}">${esc(l.text)}</span>`;
    if (l.x != null) { last.dataset.x = l.x; last.dataset.y = l.y; } else { delete last.dataset.x; delete last.dataset.y; }
    last.title = l.text;
  } else last.innerHTML = `<span class="muted">${tt('Keine Meldungen', 'No messages')}</span>`;
}
$('logHead').addEventListener('click', () => {
  logOpen = !logOpen;
  try { localStorage.setItem('archipel-logopen', logOpen ? '1' : '0'); } catch (e) {}
  updateLogHead();
});
$('logLast').addEventListener('click', e => {
  const d = e.currentTarget;
  if (d.dataset.x != null) { centerOn(+d.dataset.x, +d.dataset.y, true); renderMini(); }
});

$('log').addEventListener('click', e => {
  const d = e.target.closest('[data-x]');
  if (d) centerOn(+d.dataset.x, +d.dataset.y, true), renderMini();
});

const KEYDIR = {
  q: [-1, -1], w: [0, -1], e: [1, -1], a: [-1, 0], d: [1, 0], y: [-1, 1], z: [-1, 1], x: [0, 1], c: [1, 1],
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  7: [-1, -1], 8: [0, -1], 9: [1, -1], 4: [-1, 0], 6: [1, 0], 1: [-1, 1], 2: [0, 1], 3: [1, 1],
};
document.addEventListener('mousedown', e => { if (autoEndAt && !e.target.closest('#endTurn')) cancelAutoEnd(); }, true);

document.addEventListener('keydown', e => {
  if (!S) return;
  if (cmenu) { closeCtx(); if (e.key === 'Escape') return; }
  // Strg+S (Mac: ⌘+S): Spielstandfenster öffnen, im offenen Fenster speichern – statt „Seite speichern“ des Browsers
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    if (!$('mSaves').hidden) $('saveNew').click();
    else if (!anyModalOpen()) { cancelAutoEnd(); closeMenu(); openSaves(); }
    return;
  }
  if (autoEndAt) { if (e.key === 'Enter') { e.preventDefault(); endHumanTurn(); } else cancelAutoEnd(); return; }
  if (enemyPlaybackRunning() && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); skipAnim(); return; }
  const modalOpen = [...document.querySelectorAll('.modal')].some(m => !m.hidden);
  // Esc schließt ein Fenster auch, wenn darin ein Eingabefeld, Häkchen, Regler oder eine Auswahl den Fokus hat (Spielstände:
  // Namensfeld). Nur ein Suchfeld mit Text leert Esc zuerst – wie gewohnt –, das nächste Esc schließt.
  if (modalOpen && e.key === 'Escape' && !(e.target.type === 'search' && e.target.value)) { closeModals(); return; }
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (modalOpen && tlv.modal && !tlv.modal.hidden) {   // Zeitraffer: Leertaste spielt/hält an, Pfeile gehen eine Runde vor/zurück
    if (e.key === ' ') { e.preventDefault(); tlPlay(!tlv.play); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); tlPlay(false); tlSet(tlv.t + (e.key === 'ArrowRight' ? 1 : -1)); return; }
  }
  if (modalOpen) { if (e.key === 'Escape') closeModals(); return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.shiftKey && KEYDIR[k] && k.startsWith('Arrow')) {   // Umschalt + Pfeiltaste: Karte verschieben
    e.preventDefault(); cam.active = false;
    view.x += KEYDIR[k][0] * TS * 3; view.y += KEYDIR[k][1] * TS * 3;
    return;
  }
  if (k === 'v') { setProdView(!prodView); return; }
  if (k === 'g') { setPathView(!pathView); return; }
  if (prodView) {   // in der Produktionsansicht gibt es keine Einheitenbefehle
    if (k === 'Escape') { setProdView(false); return; }
    if (k === 'n') { setProdView(false); actNext(); return; }   // wie der Knopf „Nächste Einheit“
    if (!['+', '-', 'f', 'h', '?', 'm', 'i', 't', 'Enter'].includes(k)) return;
  }
  if (rallyMode) { if (k === 'Escape') rallyAbort(); return; }
  const u = selUnit();
  if (patrolMode) {
    if (k === 'Enter') { e.preventDefault(); patrolStart(); }
    else if (k === 'Escape') patrolAbort();
    else if (k === 'Backspace') { e.preventDefault(); patrolUndo(); }
    return;
  }
  if (KEYDIR[k] && u) { e.preventDefault(); doMove(u, u.x + KEYDIR[k][0], u.y + KEYDIR[k][1]); return; }
  switch (k) {
    case ' ': e.preventDefault(); actSkip(); break;
    case 's': actSentry(); break;
    case 'p': actPatrol(); break;
    case 'r': actExplore(); break;
    case 'b': actHome(); break;
    case 'n': actNext(); break;
    case 'f': actFocus(); break;
    case 'l': actLoad(); break;
    case 'u': actUnload(); break;
    case 'Enter': e.preventDefault(); endHumanTurn(); break;
    case 'Escape':
      if (gotoPreview) { gotoPreview = null; refresh(); break; }   // erst nur den festgehaltenen Weg verwerfen, die Einheit bleibt gewählt
      sel = null; selCity = null; refresh(); break;
    case '+': setZoom(TS + 4); break;
    case '-': setZoom(TS - 4); break;
    case 'h': case '?': openHelp(); break;
    case 'm': toggleSound(); break;
    case 'i': openStats(); break;
    case 't': openTimelapse(); break;   // nach dem Spielende: Abschlussfenster
  }
});

$('endTurn').onclick = endHumanTurn;
$('nextUnit').onclick = () => { setProdView(false); actNext(); };
$('vUnits').onclick = () => { setProdView(false); setPathView(false); };
$('vPaths').onclick = () => setPathView(!pathView);
$('vProd').onclick = () => setProdView(true);
// ------------------------------------------------------------------ Schummeln: Nebel aus
// Haken im Menü. Regeln: CHEAT_FOG/computeVision in game.js. Solange er gesetzt ist, steht neben der Rundenzahl ein Schildchen
// „Nebel aus“ – ein Klick darauf schaltet ihn wieder ab. Vor dem Aufdecken fragt das Spiel nach (askCheatFog): Was man einmal
// gesehen hat, weiß man. Deshalb wird der Haken auch nicht gemerkt – jede neue oder geladene Partie beginnt mit Nebel
// (resetCheatFog in startNew/afterLoad).
function setCheatFog(on) {
  CHEAT_FOG = !!on;
  $('cheatFogChk').checked = CHEAT_FOG;
  if (S) { computeVision(0); refresh(); updateHover(); }
}
function resetCheatFog() { CHEAT_FOG = false; $('cheatFogChk').checked = false; }
function askCheatFog() {
  if (!S) return;
  $('offerTitle').textContent = tt('Wirklich die ganze Karte aufdecken?', 'Really reveal the whole map?');
  $('offerText').innerHTML = tt('Du siehst dann alle Inseln und Städte, alle Einheiten des Gegners samt Ladung und Besatzung und jeden seiner Züge.<br><br>Was du einmal gesehen hast, weißt du – auch wenn du den Nebel danach wieder einschaltest. Das kann dir den Spaß an dieser Partie nehmen.',
    'You will then see all islands and cities, all enemy units including cargo and garrisons, and every one of his moves.<br><br>What you have seen once, you know – even if you switch the fog back on afterwards. This can spoil the fun of this game.');
  // der hervorgehobene Knopf ist die sichere Wahl
  $('offerYes').textContent = tt('Nebel behalten', 'Keep the fog');
  $('offerNo').textContent = tt('Ja, aufdecken', 'Yes, reveal');
  $('offerYes').onclick = () => closeModals();
  $('offerNo').onclick = () => { closeModals(); Sfx.play('tick'); setCheatFog(true); };
  openModal('mOffer');
}
try { localStorage.removeItem('archipel-cheat-fog'); } catch (e) {}   // frühere Fassung hat den Haken gemerkt
$('cheatFogChk').checked = false;
$('cheatFogChk').onchange = e => {
  if (!e.target.checked) { setCheatFog(false); return; }
  e.target.checked = false;   // erst nach der Rückfrage
  closeMenu(); closeModals(); askCheatFog();
};

// ------------------------------------------------------------------ Tastenlegende über der Karte
// Einblendbar im Menü (archipel-keys), schließbar mit dem Kreuz. Zeigt die Tastenkürzel passend zur Lage: Was gerade nicht geht
// (keine Einheit ausgewählt, kein Transporter, Produktionsansicht …), ist abgeblendet; beim Festlegen einer Patrouille oder eines
// Marschziels stehen nur dessen Tasten da. Wird in refresh() aufgefrischt. Tasten selbst: keydown-Handler weiter unten.
let showKeys = false;
// Neue Spieler (erster Besuch, Willkommensfenster noch nicht gesehen) bekommen die Legende eingeblendet; die Wahl wird gemerkt,
// wer sie wegklickt, sieht sie nicht wieder. Wer schon spielt und nie etwas eingestellt hat, behält „aus“.
try {
  const v = localStorage.getItem('archipel-keys');
  if (v === null && !welcomeSeen()) { showKeys = true; localStorage.setItem('archipel-keys', '1'); }
  else showKeys = v === '1';
} catch (e) {}
function setShowKeys(on) {
  showKeys = !!on;
  try { localStorage.setItem('archipel-keys', showKeys ? '1' : '0'); } catch (e) {}
  $('keysChk').checked = showKeys;
  updateKeyLegend();
}
function updateKeyLegend() {
  const box = $('keyLegend');
  box.hidden = !showKeys || !S;
  if (box.hidden) return;
  const kb = k => `<kbd>${k}</kbd>`;
  const row = (keys, label, ok = true) => `<div class="kl-row${ok ? '' : ' off'}"><span>${keys}</span>${label}</div>`;
  const grp = (title, rows) => `<div class="kl-g"><h5>${title}</h5>${rows.join('')}</div>`;
  const esc_ = kb('Esc'), enter = kb('Enter');
  let h = `<button class="kl-x" title="${tt('Ausblenden (im Menü wieder einschalten)', 'Hide (switch on again in the menu)')}">×</button>`;
  if (patrolMode) {
    h += grp(tt('Patrouille festlegen', 'Setting a patrol'), [
      row(tt('Klick', 'Click'), tt('Wegpunkt setzen', 'add waypoint')),
      row(enter, tt('Patrouille starten', 'start the patrol')),
      row(kb(tt('Rücktaste', 'Backspace')), tt('letzten löschen (auch Rechtsklick)', 'remove last (also right-click)')),
      row(esc_, tt('abbrechen', 'cancel')),
    ]);
  } else if (rallyMode) {
    h += grp(tt('Marschziel setzen', 'Setting a rally point'), [
      row(tt('Klick', 'Click'), tt('Zielfeld wählen', 'choose the destination')),
      row(esc_, tt('abbrechen', 'cancel')),
    ]);
  } else {
    const u = !S.over && !prodView ? selUnit() : null;
    const own = !!u && u.owner === 0;
    const car = own && T(u).carries;
    const pad = `<span class="kl-pad">${['Q', 'W', 'E', 'A', '', 'D', EN ? 'Z' : 'Y', 'X', 'C'].map(k => k ? kb(k) : '<i></i>').join('')}</span>`;
    h += grp(tt('Bewegen', 'Move'), [
      row(pad, tt('ziehen (auch Pfeile, Ziffernblock)', 'move (also arrows, numpad)'), own),
      row(kb('⇧') + kb('←'), tt('Karte verschieben', 'pan the map')),
      row(kb('+') + kb('−'), tt('zoomen', 'zoom')),
      row(kb('F'), tt('Einheit zentrieren', 'centre on unit'), !!(selUnit() || selCity != null)),
    ]);
    h += grp(tt('Einheit', 'Unit'), [
      row(kb('N'), tt('nächste Einheit', 'next unit'), !prodView),
      row(kb(tt('Leer', 'Space')), tt('überspringen', 'skip'), own),
      row(kb('S'), tt('Wache', 'sentry'), own),
      row(kb('R'), tt('erkunden', 'explore'), own),
      row(kb('P'), tt('Patrouille', 'patrol'), own),
      row(kb('B'), tt('Heimkehr', 'return home'), own),
      row(kb('L') + kb('U'), car === 'air' ? tt('Jäger laden / ausladen', 'load / unload fighters') : tt('laden / ausladen, Angriff', 'load / unload, attack'), !!car),
    ]);
    h += grp(tt('Ansicht', 'View'), [
      row(kb('V'), prodView ? tt('zurück zur Karte (auch Esc)', 'back to the map (also Esc)') : tt('Produktionsansicht', 'production view')),
      row(kb('G'), tt('Wegeansicht', 'route view')),
    ]);
    h += grp(tt('Spiel', 'Game'), [
      row(enter, tt('Runde beenden', 'end turn'), !S.over),
      row(esc_, tt('Auswahl aufheben', 'clear selection')),
      row(kb('H') + kb('I'), tt('Handbuch · Statistik', 'handbook · statistics')),
      row(kb('T'), tt('Zeitraffer der Partie', 'time-lapse of the game')),
      row(kb('M'), tt('Ton an/aus', 'sound on/off')),
      row(kb((navigator.platform.startsWith('Mac') ? '⌘' : tt('Strg', 'Ctrl'))) + kb('S'), tt('Spiel speichern', 'save the game')),
    ]);
  }
  box.innerHTML = h;
  box.querySelector('.kl-x').onclick = () => { setShowKeys(false); toast(tt('Tastenkürzel ausgeblendet – unter ☰ Menü → Einstellungen wieder einschalten', 'Shortcuts hidden – switch them on again under ☰ Menu → Settings'), 2500); };
}
$('keysChk').checked = showKeys;
$('keysChk').onchange = e => setShowKeys(e.target.checked);
$('routeChk').checked = showRoute;
$('routeChk').onchange = e => { showRoute = e.target.checked; try { localStorage.setItem('archipel-route', showRoute ? '1' : '0'); } catch (err) {} dirty = true; };

$('powerChk').checked = showPower;
$('powerChk').onchange = e => {
  showPower = e.target.checked;
  try { localStorage.setItem('archipel-power', showPower ? '1' : '0'); } catch (err) {}
  applyPower(); if (S) updatePower();
};
applyPower();
$('replaySel').value = replay;
$('replaySel').onchange = e => {
  replay = REPLAY[e.target.value] ? e.target.value : 'normal';
  try { localStorage.setItem('archipel-replay2', replay); } catch (err) {}
  if (replay === 'off') skipAnim();   // eine laufende Wiedergabe sofort beenden
};
$('offerSel').value = String(offerPct);
$('offerSel').onchange = e => {
  offerPct = Number(e.target.value) || 0;
  try { localStorage.setItem('archipel-offer', String(offerPct)); } catch (err) {}
};
$('autoEndChk').checked = autoEnd;
$('autoEndChk').onchange = e => {
  autoEnd = e.target.checked;
  try { localStorage.setItem('archipel-autoend', autoEnd ? '1' : '0'); } catch (err) {}
  if (!autoEnd) cancelAutoEnd();
};
// ------------------------------------------------------------------ Menü der Kopfzeile
// Selten Gebrauchtes liegt im Menü: Neues Spiel, Spielstände (Strg+S), Statistik, Kräfteverhältnis, Zeitraffer und „Einstellungen …“
// (eigenes Fenster). Ein Klick auf einen Eintrag schließt es.
const menuEl = $('menu');
function closeMenu() {
  if (menuEl.hidden) return;
  menuEl.hidden = true; $('bMenu').classList.remove('open'); $('bMenu').setAttribute('aria-expanded', 'false');
}
function openMenu() {
  closeCtx();
  menuEl.hidden = false; $('bMenu').classList.add('open'); $('bMenu').setAttribute('aria-expanded', 'true');
  const r = $('bMenu').getBoundingClientRect();
  menuEl.style.top = Math.round(r.bottom + 6) + 'px';
  menuEl.style.left = Math.round(Math.max(8, Math.min(r.left, innerWidth - menuEl.offsetWidth - 8))) + 'px';
}
$('bMenu').onclick = () => { if (menuEl.hidden) openMenu(); else closeMenu(); };
menuEl.addEventListener('click', e => { if (e.target.closest('button')) closeMenu(); });
document.addEventListener('mousedown', e => { if (!menuEl.hidden && !e.target.closest('#menu, #bMenu')) closeMenu(); }, true);
document.addEventListener('keydown', e => {
  if (menuEl.hidden) return;
  const inside = e.target.closest && e.target.closest('#menu, #bMenu');
  if (e.key === 'Escape') { closeMenu(); e.preventDefault(); e.stopPropagation(); }
  else if (inside && !e.ctrlKey && !e.metaKey) e.stopPropagation();   // Tasten im Menü gehören nicht dem Spiel – Strg+S schon
  else closeMenu();
}, true);
window.addEventListener('resize', closeMenu);

$('bNew').onclick = () => { $('seedIn').value = ''; openModal('mNew'); };
// „Diese Welt noch einmal“: Nummer, Größe und Welt der laufenden Partie eintragen (ältere Spielstände kennen ihre Nummer nicht)
$('seedIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('bStart').click(); } });
$('seedSame').onclick = () => {
  if (!S || S.seed == null) { toast(tt('Diese Partie stammt aus einer älteren Version und hat keine Kartennummer', 'This game comes from an older version and has no map number')); return; }
  // auch die Zahl der Gegner: Sie bestimmt die Startplätze (und kann deshalb eine andere Welt ergeben)
  $('seedIn').value = fmtSeed(S.seed); $('sizeSel').value = S.size; $('worldSel').value = S.world; $('worldSel').onchange();
  fillAiSel(S.players.length - 1);
};
$('bStart').onclick = () => {
  try {
    localStorage.setItem('archipel-diff', $('diffSel').value); localStorage.setItem('archipel-size', $('sizeSel').value);
    localStorage.setItem('archipel-world', $('worldSel').value); localStorage.setItem('archipel-ais', $('aiSel').value);
  } catch (e) {}
  closeModals(); startNew($('sizeSel').value, $('diffSel').value, $('worldSel').value, parseSeed($('seedIn').value), +$('aiSel').value || 1);
  Sfx.play('start');   // nur hier (Klick des Spielers): Browser spielen Ton erst nach einer Benutzeraktion
};
// Zahl der Gegner (1 … MAP_SIZES.maxAi der gewählten Kartengröße); want = gewünschte Zahl, sonst die bisherige Wahl
function fillAiSel(want) {
  const max = (MAP_SIZES[$('sizeSel').value] || MAP_SIZES.mittel).maxAi;
  let cur = want || +$('aiSel').value;
  if (!cur) { try { cur = +localStorage.getItem('archipel-ais') || 1; } catch (e) { cur = 1; } }
  cur = Math.max(1, Math.min(max, cur));
  $('aiSel').innerHTML = Array.from({ length: max }, (_, i) => i + 1).map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${k === 1
    ? tt('1 Gegner', '1 opponent') : tt(`${k} Gegner – jeder gegen jeden`, `${k} opponents – everyone against everyone`)}</option>`).join('');
  aiDesc();
}
function aiDesc() {
  const k = +$('aiSel').value || 1, max = (MAP_SIZES[$('sizeSel').value] || MAP_SIZES.mittel).maxAi;
  const cols = PLAYERS.slice(1, k + 1).map(p => p.name).join(', ');
  $('aiDesc').textContent = (k === 1 ? tt('Du gegen einen Computergegner.', 'You against one computer opponent.')
    : tt(`Jeder gegen jeden: Die Gegner (${cols}) bekämpfen sich auch untereinander. Die Schwierigkeit gilt für alle.`,
      `Everyone against everyone: the opponents (${cols}) also fight each other. The difficulty applies to all of them.`))
    + (max < PLAYERS.length - 1 ? ' ' + tt(`Auf dieser Kartengröße höchstens ${max}.`, `At most ${max} on this map size.`) : '');
}
$('aiSel').onchange = aiDesc;
$('sizeSel').addEventListener('change', () => fillAiSel());
$('diffSel').onchange = () => { $('diffDesc').textContent = DIFFICULTY[$('diffSel').value].desc; };
$('worldSel').onchange = () => { $('worldDesc').textContent = WORLDS[$('worldSel').value].desc; };
$('bOverNew').onclick = () => { closeModals(); $('bNew').onclick(); };
$('bHelp').onclick = () => openHelp();

function updateSoundUi() {
  $('bSound').textContent = Sfx.isMuted() ? '🔇' : '🔊';
  $('bSound').title = Sfx.isMuted() ? tt('Ton einschalten (M)', 'Sound on (M)') : tt('Ton ausschalten (M)', 'Sound off (M)');
  $('vol').value = Math.round(Sfx.volume() * 100);
}
function toggleSound() { Sfx.toggle(); updateSoundUi(); }
$('bSound').onclick = toggleSound;
$('vol').oninput = e => { Sfx.setVolume(e.target.value / 100); updateSoundUi(); };
$('vol').onchange = () => Sfx.play('select');
document.addEventListener('pointerdown', () => Sfx.unlock(), { once: true });
document.addEventListener('keydown', () => Sfx.unlock(), { once: true });
updateSoundUi();

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
function openSettings() { closeMenu(); closeCtx(); openModal('mSettings'); }
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
const EXAMPLES = [
  ['beispiel-1-inselreich-anfang', tt('Inselreich, Anfang', 'Archipelago, opening'), tt('Die ersten Städte und Transporter, die Inseln noch kaum erkundet.', 'The first cities and transports, the islands still barely explored.')],
  ['beispiel-2-inselreich-seekrieg', tt('Inselreich, Seekrieg', 'Archipelago, naval war'), tt('Ausgeglichene Lage, Flotten und Transporter auf beiden Seiten.', 'An even match, fleets and transports on both sides.')],
  ['beispiel-3-festland-front', tt('Festland, Front', 'Mainland, front line'), tt('Landkrieg mit Binnenmeeren, Flüssen und Brücken.', 'Land war with inland seas, rivers and bridges.')],
  ['beispiel-4-drei-gegner', tt('Drei Gegner', 'Three opponents'), tt('Jeder gegen jeden: Rot, Gelb und Violett sind alle noch im Spiel.', 'Everyone against everyone: Red, Yellow and Purple are all still in the game.')],
  ['beispiel-5-kurz-vor-dem-sieg', tt('Kurz vor dem Sieg', 'Close to victory'), tt('Der Gegner hält sich nur noch auf seinen letzten Inseln.', 'The enemy is holding out on its last islands.')],
  ['beispiel-6-schwere-lage', tt('Schwere Lage', 'A tough spot'), tt('Stufe Schwer, du bist klar unterlegen – schaffst du die Wende?', 'Hard level, you are clearly behind – can you turn it around?')],
  ['beispiel-7-sieg-gegen-drei', tt('Sieg gegen drei', 'Victory over three'), tt('Eine gewonnene Partie: Das Abschlussfenster zeigt den Zeitraffer der ganzen Partie.', 'A won game: the final window shows the timelapse of the whole game.')],
];
const EXAMPLE_ONLINE = /^https?:$/.test(location.protocol);
function renderExamples() {
  const rows = EXAMPLES.map(([f, title, desc]) => `<div class="ex-row"><div><b>${title}</b><span>${desc}</span></div>`
    + (EXAMPLE_ONLINE ? `<button data-example="${f}">${tt('Laden', 'Load')}</button>` : '') + '</div>').join('');
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
  $('saveInfo').textContent = tt(`${slots.length} gespeicherte Spielstände · belegt etwa ${(used * 2 / 1024 / 1024).toFixed(1)} MB von ca. 5 MB Browserspeicher. Export (⤓) sichert einen Spielstand als Datei, ⟳ überschreibt ihn mit dem aktuellen Spiel.`,
    `${slots.length} saved game${slots.length === 1 ? '' : 's'} · using about ${(used * 2 / 1024 / 1024).toFixed(1)} MB of roughly 5 MB browser storage. Export (⤓) saves a game as a file, ⟳ overwrites it with the current game.`);
}
function openSaves() {
  if (!S) return;
  $('saveName').value = EN ? `Turn ${S.turn} – ${plural(S.cities.filter(c => c.owner === 0).length, 'city', 'cities')}`
    : `Runde ${S.turn} – ${plural(S.cities.filter(c => c.owner === 0).length, 'Stadt', 'Städte')}`;
  $('saveFilter').value = '';
  renderSaves(); openModal('mSaves');
  setTimeout(() => { $('saveName').focus(); $('saveName').select(); }, 30);
}
function trySave(name, id) {
  // Erfolg: Fenster schließen (weiterspielen); bei vollem Speicher bleibt es offen, damit man alte Stände löschen kann
  try { saveSlot(name, id); closeModals(); toast(tt(`Gespeichert: „${name}“`, `Saved: “${name}”`), 2200); Sfx.play('select'); return true; }
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
$('mSaves').addEventListener('click', e => {
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
    const ok = d.load === 'auto' ? loadGame() : (() => { try { return loadSlot(d.load); } catch (err) { return false; } })();
    if (ok) afterSlotLoad(tt('Spielstand geladen', 'Game loaded')); else { toast(tt('Laden fehlgeschlagen', 'Loading failed')); Sfx.play('error'); }
  } else if (d.over) {
    const m = listSlots().find(x => x.id === d.over);
    if (m && confirm(tt(`„${m.name}“ mit dem aktuellen Spiel (Runde ${S.turn}) überschreiben?`, `Overwrite “${m.name}” with the current game (turn ${S.turn})?`))) trySave(m.name, m.id);
  } else if (d.del) {
    const m = listSlots().find(x => x.id === d.del);
    if (m && confirm(tt(`Spielstand „${m.name}“ endgültig löschen?`, `Delete saved game “${m.name}” for good?`))) { deleteSlot(m.id); renderSaves(); toast(tt('Gelöscht', 'Deleted')); }
  } else if (d.export) {
    const data = slotData(d.export);
    if (!data) return;
    const m = d.export === 'auto' ? { name: tt('automatisch', 'autosave') } : listSlots().find(x => x.id === d.export);
    const turn = (() => { try { return JSON.parse(data).turn; } catch (err) { return ''; } })();
    const fname = ('archipel-' + (m ? m.name : tt('spielstand', 'savegame')) + tt('-R', '-T') + turn).replace(/[^\w\-äöüÄÖÜß]+/g, '_') + '.json';
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
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
    const text = await f.text();
    const backup = S;
    try { deserialize(text); } catch (err) { S = backup; buildCityGrid(); throw err; }
    afterSlotLoad(tt('Spielstand aus Datei geladen', 'Game loaded from file'));
  } catch (err) { toast(tt('Datei ist kein gültiger Spielstand', 'File is not a valid saved game')); Sfx.play('error'); }
};
$('saveImport').onclick = () => importPick.click();
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
function welcomeSeen() { try { return localStorage.getItem('archipel-welcome') === '1'; } catch (e) { return true; } }
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
  else startNew('mittel');
  if (!welcomeSeen()) { welcomeFirst = true; showWelcome(); }
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => renderMini());
})();
