'use strict';
// ---------------------------------------------------------------------------
// Oberfläche: Zeichnen, Eingabe, Seitenleiste, Dialoge
// ---------------------------------------------------------------------------

const $ = id => document.getElementById(id);
const cv = $('map'), ctx = cv.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
const wrap = $('mapWrap');

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

function animBegin(speed, follow = false) {
  anim.rec = true; anim.cursor = 0; anim.speed = speed; anim.events = []; anim.gone = []; anim.skippable = false;
  anim.follow = follow;
  // Sichtstand vor der Aufzeichnung: neu aufgedeckte Felder erscheinen erst,
  // wenn die eigene Einheit in der Wiedergabe dort ankommt
  if (S) { anim.seen0 = S.players[0].seen.slice(); anim.vis0 = S.players[0].vis.slice(); }
  // gedachte Kameraposition während der Aufzeichnung (Kachelmitte des Sichtfensters)
  anim.vcx = (wrap.scrollLeft + wrap.clientWidth / 2) / TS;
  anim.vcy = (wrap.scrollTop + wrap.clientHeight / 2) / TS;
}

// ------------------------------------------------------------------ Kamera
// Beim Gegnerzug wird vor jedem Ereignis außerhalb des Sichtfensters eine
// Kamerafahrt in die Zeitleiste eingeplant.
const CAM_MS = 550;
function viewHalf() { return [wrap.clientWidth / TS / 2, wrap.clientHeight / TS / 2]; }
function clampCenter(cx, cy) {
  const [hw, hh] = viewHalf();
  return [S.W <= hw * 2 ? S.W / 2 : Math.min(S.W - hw, Math.max(hw, cx)),
          S.H <= hh * 2 ? S.H / 2 : Math.min(S.H - hh, Math.max(hh, cy))];
}
function inVirtualView(x, y) {
  const [hw, hh] = viewHalf(), m = 2;
  return Math.abs(x + 0.5 - anim.vcx) <= hw - m && Math.abs(y + 0.5 - anim.vcy) <= hh - m;
}
function recCam(x1, y1, x2 = x1, y2 = y1) {
  if (!anim.rec || !anim.follow) return;
  if (inVirtualView(x1, y1) && inVirtualView(x2, y2)) return;
  const [cx, cy] = clampCenter(x2 + 0.5, y2 + 0.5);
  anim.events.push({ type: 'cam', cx, cy, t0: anim.cursor, dur: CAM_MS });
  anim.cursor += CAM_MS + 80;
  anim.vcx = cx; anim.vcy = cy;
}
const cam = { active: false };
function camTo(cx, cy, dur) {
  [cx, cy] = clampCenter(cx, cy);
  cam.sx = wrap.scrollLeft; cam.sy = wrap.scrollTop;
  cam.tx = cx * TS - wrap.clientWidth / 2; cam.ty = cy * TS - wrap.clientHeight / 2;
  cam.t0 = performance.now(); cam.dur = dur; cam.active = true;
}
function camStep(now) {
  if (!cam.active) return;
  const f = Math.min(1, (now - cam.t0) / cam.dur), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
  wrap.scrollLeft = cam.sx + (cam.tx - cam.sx) * e;
  wrap.scrollTop = cam.sy + (cam.ty - cam.sy) * e;
  if (f >= 1) cam.active = false;
  dirty = true;
}
function animEnd(maxMs = 3500) {
  anim.rec = false;
  let end = 0;
  for (const e of anim.events) end = Math.max(end, e.t0 + e.dur);
  if (end > maxMs) {
    const f = maxMs / end;
    for (const e of anim.events) { e.t0 *= f; e.dur = Math.max(40, e.dur * f); }
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
  anim.gone.push({ u: { id: u.id, type: u.type, owner: u.owner, hp: Math.max(1, u.hp), x: u.x, y: u.y }, until });
}
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
  const text = lost ? tt('Stadt verloren', 'City lost') : tt('Gegner erobert', 'Enemy captures');
  anim.events.push({ type: 'label', x: c.x, y: c.y, text, tone: 'bad', t0: anim.cursor + 150, dur: LABEL_MS });
  anim.cursor += Math.max(200, anim.speed * 2);
};

const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// Position einer Einheit während der Wiedergabe (oder null = normale Darstellung)
function animPos(u, rel) {
  const evs = anim.byUnit.get(u.id);
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

function drawFog(P = S.players[0]) {
  if (fogC.width !== S.W || fogC.height !== S.H) { fogC.width = S.W; fogC.height = S.H; }
  const img = fogG.createImageData(S.W, S.H);
  for (let i = 0; i < S.W * S.H; i++) {
    const a = S.over ? 0 : !P.seen[i] ? 255 : !P.vis[i] ? 105 : 0;
    img.data[i * 4] = 7; img.data[i * 4 + 1] = 10; img.data[i * 4 + 2] = 18; img.data[i * 4 + 3] = a;
  }
  fogG.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fogC, 0, 0, S.W * TS, S.H * TS);
  ctx.restore();
}

function moveHints(u) {
  const out = [];
  if (!u || u.moves <= 0) return out;
  const t = T(u);
  for (const [dx, dy] of DIRS) {
    const x = u.x + dx, y = u.y + dy;
    if (!inb(x, y) || !S.players[0].seen[idx(x, y)]) continue;
    const c = cityAt(x, y);
    const here = topUnitsAt(x, y).filter(o => canSee(0, o));
    const enemy = here.some(o => o.owner !== 0);
    if (enemy) { if (t.str > 0) out.push([x, y, 'attack']); continue; }
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
  if (on) { sel = null; selCity = null; if (patrolMode) patrolAbort(); closeCtx(); }
  $('vUnits').classList.toggle('on', !on); $('vProd').classList.toggle('on', on);
  if (S) { refresh(); updateHover(); }
}
const prodLeft = c => Math.max(1, Math.ceil(UT[c.prod].cost - c.progress));
function drawProdView() {
  const fs = Math.max(9, Math.round(TS * 0.34));
  for (const c of S.cities) {
    if (c.owner !== 0) continue;
    const cx = c.x * TS + TS / 2, cy = c.y * TS + TS / 2, r = TS * 0.54;
    ctx.fillStyle = 'rgba(10,14,20,0.6)'; ctx.beginPath(); ctx.arc(cx, cy, r + TS * 0.06, 0, 7); ctx.fill();
    const hot = hover && hover[0] === c.x && hover[1] === c.y;
    ctx.lineWidth = Math.max(2, TS / 10);
    ctx.strokeStyle = hot ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    if (!c.prod || !UT[c.prod]) continue;
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
  // Luftdeckung: Schiffe neben einem sichtbaren Träger mit Jägern an Bord (gestrichelter Ring = geschützt)
  const covered = new Set();
  for (const c of S.units) {
    if (c.type !== 'car' || c.carrier != null || (!canSee(0, c) && !S.over) || !S.units.some(f => f.carrier === c.id && f.type === 'ftr')) continue;
    for (const s of S.units) {
      if (s.owner !== c.owner || s.carrier != null || T(s).domain !== 'sea' || cheb(s.x, s.y, c.x, c.y) > 1 || (!canSee(0, s) && !S.over)) continue;
      const i = idx(s.x, s.y);
      if (covered.has(i) || S.cityGrid[i] >= 0) continue;
      covered.add(i);
      drawSupportMark(s.x, s.y, true, PLAYERS[c.owner].light);
    }
  }

  const su = selUnit();
  // Zugmarker der ausgewählten Einheit
  if (su && !(now < anim.t0 + (anim.coreEnd || 0) + 30)) {
    for (const [x, y, kind] of moveHints(su)) {
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
  }

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
    const badge = inCity ? (list.length > 1 ? list.length : 0) : cargoOf(show).length;
    const own = show.owner === 0;
    const opts = {
      badge,
      dim: own && (show.moves <= 0 || (show.order && show.order.type === 'sentry')) && show !== su,
      sentry: own && show.order && show.order.type === 'sentry',
      goto: own && show.order && show.order.type === 'goto',
      patrol: own && show.order && show.order.type === 'patrol',
      explore: own && show.order && show.order.type === 'explore',
    };
    if (inCity) drawToken(show, x * TS + TS * 0.36, y * TS + TS * 0.36, TS * 0.66, opts);
    else drawToken(show, x * TS, y * TS, TS, opts);
  }
  for (const [u, [x, y]] of moving) drawToken(u, x * TS, y * TS, TS, { badge: cargoOf(u).length });
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
      const f = (rel - e.t0) / e.dur, cx = e.x * TS + TS / 2, cy = e.y * TS + TS / 2;
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
  }

  // Auswahl, Marschweg, Mausfeld
  const pulse = (Math.sin(now / 260) + 1) / 2;
  const ring = (x, y) => {
    const cx = x * TS + TS / 2, cy = y * TS + TS / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(255,230,150,0.9)'; ctx.shadowBlur = TS * 0.3;
    ctx.strokeStyle = `rgba(255,${220 + pulse * 35},${120 + pulse * 120},0.95)`; ctx.lineWidth = Math.max(2, TS / 11);
    ctx.beginPath(); ctx.arc(cx, cy, TS * (0.5 + 0.04 * pulse), 0, 7); ctx.stroke();
    ctx.restore();
  };
  if (su && !(now < anim.t0 + (anim.coreEnd || 0) + 30)) {
    const route = patrolMode && patrolMode.id === su.id ? { pts: patrolMode.pts, start: [su.x, su.y], editing: true }
      : su.order && su.order.type === 'patrol' ? { pts: su.order.pts.slice(0, -1), start: su.order.start, editing: false } : null;
    if (route) drawPatrolRoute(route, now);
    if (su.order && su.order.type === 'goto') {
      const path = findPath(su, su.order.x, su.order.y);
      if (path && path.length) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1.5, TS / 14);
        ctx.setLineDash([TS * 0.16, TS * 0.14]); ctx.lineDashOffset = -now / 40;
        ctx.beginPath(); ctx.moveTo(su.x * TS + TS / 2, su.y * TS + TS / 2);
        for (const [px, py] of path) ctx.lineTo(px * TS + TS / 2, py * TS + TS / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        const [ex, ey] = path[path.length - 1];
        ctx.beginPath(); ctx.arc(ex * TS + TS / 2, ey * TS + TS / 2, TS * 0.18, 0, 7); ctx.stroke();
        ctx.restore();
      }
    }
    ring(su.x, su.y);
  } else if (selCity != null && !su) {
    const c = S.cities[selCity];
    if (c) ring(c.x, c.y); else selCity = null;
  }
  if (hover) {
    const [hx, hy] = hover;
    const en = su && S.players[0].vis[idx(hx, hy)] ? topUnitsAt(hx, hy).filter(o => o.owner !== 0 && canSee(0, o)) : [];
    ctx.strokeStyle = en.length ? 'rgba(255,110,100,0.9)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = en.length ? 2 : 1;
    roundRectPath(ctx, hx * TS + 1.5, hy * TS + 1.5, TS - 3, TS - 3, TS * 0.15); ctx.stroke();
    if (en.length && T(su).str > 0 && cheb(su.x, su.y, hx, hy) <= 1) {
      const d = pickDefender(en);
      const pct = Math.round(attackOdds(su, d, hx, hy) * 100) + ' %';
      ctx.font = `700 ${Math.max(11, Math.round(TS * 0.42))}px system-ui, sans-serif`;
      const w = ctx.measureText(pct).width + 10, h = Math.max(16, TS * 0.6);
      const bx = hx * TS + TS / 2 - w / 2, by = hy * TS - h - 3;
      roundRectPath(ctx, bx, by, w, h, h / 2);
      ctx.fillStyle = 'rgba(15,20,28,0.9)'; ctx.fill();
      ctx.fillStyle = parseInt(pct) >= 50 ? '#7ee2ae' : '#ff8a80';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pct, hx * TS + TS / 2, by + h / 2 + 0.5);
    }
  }
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
    if (e.type === 'move') {
      // ein Geräusch pro zusammenhängender Bewegung, so lang wie die Animation
      const evs = anim.byUnit.get(e.id);
      if (evs && evs[0] === e) {
        const lastE = evs[evs.length - 1];
        const dur = Math.min(2.8, Math.max(0.8, (lastE.t0 + lastE.dur - e.t0) / 1000 + 0.35));
        Sfx.move(e.utype, dur, e.owner === 0 ? 1 : 0.7);
      }
    }
    else if (e.type === 'salvo') Sfx.play('salvo', 60);
    else if (e.type === 'boom') { Sfx.play('boom', 80); if (e.hl) setTimeout(() => Sfx.play('lost', 300), 380); }
    else if (e.type === 'capture') { if (e.owner === 0) Sfx.play('capture'); else if (e.lost) Sfx.play('cityLost'); else Sfx.play('boom', 80); }
  }
  if (anim.after && now >= anim.end) { const f = anim.after; anim.after = null; f(); }
  if (captureQueue.length && !anyModalOpen() && now >= captureReadyAt(captureQueue[0])) showCaptureDialog();
}

// Wiedergabe der Gegnerzüge: Tempo und Überspringen
const ENEMY_STEP_MS = 220;
function skipAnim() {
  anim.t0 = -1e9; anim.end = 0; anim.skippable = false; cam.active = false;
  dirty = true;
}
function enemyPlaybackRunning(now = performance.now()) { return anim.skippable && animActive(now); }

function loop(now) {
  $('banner').hidden = !enemyPlaybackRunning(now);
  requestAnimationFrame(loop);
  if (S) {
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
    put(u.x, u.y, u.owner === 0 ? [120, 180, 255] : [255, 110, 100]);
  }
  mctx.putImageData(img, 0, 0);
  // Sichtfenster
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1;
  mctx.strokeRect(wrap.scrollLeft / TS * s + 0.5, wrap.scrollTop / TS * s + 0.5, wrap.clientWidth / TS * s, wrap.clientHeight / TS * s);
}

// ------------------------------------------------------------------ Hilfen
function selUnit() {
  if (sel == null) return null;
  const u = unitById(sel);
  if (!u) sel = null;
  return u;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800);
}

function centerOn(x, y, force = false) {
  const px = x * TS + TS / 2, py = y * TS + TS / 2;
  const m = TS * 3;
  const vx = wrap.scrollLeft, vy = wrap.scrollTop, vw = wrap.clientWidth, vh = wrap.clientHeight;
  if (force || px < vx + m || px > vx + vw - m || py < vy + m || py > vy + vh - m) {
    wrap.scrollLeft = px - vw / 2; wrap.scrollTop = py - vh / 2;
  }
}

// Zoom; ax/ay = Punkt im Sichtfenster (Pixel), der dabei an seiner Stelle bleibt
// (Standard: Mitte; beim Mausrad: die Mausposition)
function setZoom(nts, ax = wrap.clientWidth / 2, ay = wrap.clientHeight / 2) {
  nts = Math.max(14, Math.min(48, nts));
  if (nts === TS) return;
  const cx = (wrap.scrollLeft + ax) / TS, cy = (wrap.scrollTop + ay) / TS;
  TS = nts;
  resizeCanvas();
  cam.active = false;
  wrap.scrollLeft = cx * TS - ax; wrap.scrollTop = cy * TS - ay;
  try { localStorage.setItem('archipel-zoom', String(TS)); } catch (e) {}
  render();
}

function resizeCanvas() {
  cv.width = S.W * TS; cv.height = S.H * TS;
  buildTerrainCache();
}

function select(u, center = true) {
  if (patrolMode && (!u || u.id !== patrolMode.id)) patrolMode = null;
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
  return px >= wrap.scrollLeft + mm && px <= wrap.scrollLeft + wrap.clientWidth - mm &&
         py >= wrap.scrollTop + mm && py <= wrap.scrollTop + wrap.clientHeight - mm;
}
function pendingCenterStep(now) {
  if (!pendingCenter || now < pendingCenter.at) return;
  const pc = pendingCenter; pendingCenter = null;
  const u = selUnit();
  if (!u || u.id !== pc.id) return;
  if (!inViewMargin(u.x, u.y)) camTo(u.x + 0.5, u.y + 0.5, 550);
}

function needsOrders(u) {
  if (u.owner !== 0 || u.moves <= 0 || u.order || u.skip) return false;
  // Bodentruppen an Bord: nur dann „wartend“, wenn der Transporter an einer Küste
  // liegt (nicht im eigenen Hafen) – mitten auf See können sie ohnehin nichts tun
  if (u.carrier != null && T(u).domain === 'land') {
    const tr = unitById(u.carrier);
    if (!tr) return false;
    const c = cityAt(tr.x, tr.y);
    if (c && c.owner === 0) return false;
    return DIRS.some(([dx, dy]) => inb(tr.x + dx, tr.y + dy) && S.terrain[idx(tr.x + dx, tr.y + dy)] === 1);
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
  if (!autoEnd || !S || S.over || patrolMode) return;
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
  if (checkGameOver()) { showGameOver(); }
  if (!u || !alive(u) || u.moves <= 0 || u.order) {
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

function refresh() { dirty = true; renderMini(); updatePanel(); updateHeader(); }

// ------------------------------------------------------------------ Aktionen
// geortete getauchte U-Boote des Gegners (für die Meldung „Sonarkontakt“ nach einem eigenen Zug)
function locatedSubs() { return S.units.filter(o => o.owner !== 0 && o.carrier == null && T(o).stealth && !o.surf && canSee(0, o)); }
function doMove(u, x, y) {
  u.order = null;
  const before = new Set(locatedSubs().map(o => o.id));
  animBegin(120);
  const r = moveStep(u, x, y);
  animEnd();
  if (!r.ok) { toast(r.msg); Sfx.play('error'); }
  else if (r.boarded) Sfx.play('clank');
  afterAction(u);
  const found = locatedSubs().filter(o => !before.has(o.id));
  if (found.length) {
    addLog(tt('Sonarkontakt: feindliches U-Boot geortet.', 'Sonar contact: enemy submarine located.'), 'bad', found[0].x, found[0].y);
    Sfx.play('alarm'); refresh();
  }
}

function doGoto(u, x, y) {
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
  const n = loadUnits(u);
  Sfx.play(n ? 'clank' : 'error');
  toast(n ? tt(`${n} Einheit(en) eingeladen`, `${n} unit${n === 1 ? '' : 's'} loaded`) : tt('Nichts zum Einladen in dieser Stadt', 'Nothing to load in this city'));
  refresh();
}
function actUnload() {
  const u = selUnit(); if (!u || !T(u).carries) return;
  if (!cargoOf(u).length) { toast(tt('Niemand an Bord', 'Nobody on board')); return; }
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
    if (adjacent) doMove(u, x, y); else doGoto(u, x, y);
    return;
  }
  if (own.length) { select(own.find(needsOrders) || own[0]); Sfx.play('select'); }
  else sel = null;
  selCity = city && city.owner === 0 ? city.id : null;
  refresh();
}

function endHumanTurn() {
  if (!S || S.over) return;
  setProdView(false);
  autoEndAt = 0;
  sel = null;
  Sfx.play('endTurn');
  const logMark = S.log[0];
  animBegin(ENEMY_STEP_MS, true);
  const startScroll = [wrap.scrollLeft, wrap.scrollTop];
  endTurn(0);
  startTurn(1);
  aiTurn();
  if (!S.over) {
    endTurn(1);
    S.turn++;
    startTurn(0);
    // Wachen wecken, wenn Feinde in der Nähe sind
    for (const u of S.units) {
      if (u.owner !== 0 || !u.order || u.order.type !== 'sentry' || u.carrier != null) continue;
      let enemy = false;
      for (const [dx, dy] of DIRS) if (inb(u.x + dx, u.y + dy) && visibleEnemyAt(0, u.x + dx, u.y + dy)) enemy = true;
      if (enemy) { u.order = null; addLog(tt(`${T(u).name} meldet Feindkontakt!`, `${T(u).name} reports enemy contact!`), 'bad', u.x, u.y); }
    }
    for (const u of S.units.filter(o => o.owner === 0 && o.order && o.order.type === 'goto')) {
      // Feind ist während des Gegnerzugs herangerückt: Marsch anhalten
      if (u.carrier == null && enemyAdjacent(u)) { u.order = null; addLog(tt(`${T(u).name}: Marsch angehalten – Feindkontakt!`, `${T(u).name}: march stopped – enemy contact!`), 'bad', u.x, u.y); continue; }
      runGoto(u);
    }
    for (const u of S.units.filter(o => o.owner === 0 && o.order && o.order.type === 'patrol')) runPatrol(u);
    for (const u of S.units.filter(o => o.owner === 0 && o.order && o.order.type === 'explore')) runExplore(u);
    computeVision(0);
  }
  animEnd(12000);
  anim.skippable = anim.events.length > 0;
  const fresh = [];
  let badNews = false;
  for (const l of S.log) { if (l === logMark) break; fresh.push(l.text); if (l.cls === 'bad') badNews = true; }
  const followed = anim.events.some(e => e.type === 'cam');
  checkGameOver();
  saveGame();
  selectNext();
  const su = selUnit(), home = su || S.cities.find(c => c.owner === 0);
  if (followed) {
    // Kamera bleibt erst, wo sie war; nach der Wiedergabe zurück zur eigenen Einheit
    wrap.scrollLeft = startScroll[0]; wrap.scrollTop = startScroll[1];
  } else if (!su && home) centerOn(home.x, home.y);
  anim.after = () => {
    // Erkennung über Schlüsselwörter der Meldungen (game.js) – in beiden Sprachen
    if (fresh.some(t => t.toLowerCase().includes(tt('feindkontakt', 'enemy contact')))) Sfx.play('alarm');
    else if (fresh.some(t => t.toLowerCase().includes(tt('fertiggestellt', 'completed')))) Sfx.play('built');
    if (followed && home) camTo(home.x + 0.5, home.y + 0.5, 600);
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
  const st = o.order ? ({ sentry: tt(' · Wache', ' · sentry'), patrol: tt(' · Patrouille', ' · patrol'), explore: tt(' · Erkundet', ' · exploring') }[o.order.type] || tt(' · Marsch', ' · marching')) : '';
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

// Seitenleiste in der Produktionsansicht: was wird wie oft gebaut, und wann ist das Nächste fertig
function prodPanel() {
  const mine = S.cities.filter(c => c.owner === 0 && c.prod && UT[c.prod]);
  let h = `<section class="pcard pc-city"><div class="pc-head"><img class="pc-icon" src="${iconUrl('c', 0)}" alt=""><div><h3>${tt('Produktion', 'Production')}</h3>
    <div class="uname">${tt(`${mine.length} ${mine.length === 1 ? 'Stadt' : 'Städte'}`, `${mine.length} ${mine.length === 1 ? 'city' : 'cities'}`)}</div></div></div><div class="stats">`;
  for (const k of UNIT_ORDER) {
    const cs = mine.filter(c => c.prod === k);
    if (!cs.length) continue;
    const next = Math.min(...cs.map(prodLeft));
    h += `<span>${cs.length} × ${esc(UT[k].name)}</span><b>${tt(`nächste in ${next} ${next === 1 ? 'Runde' : 'Runden'}`, `next in ${next} ${next === 1 ? 'turn' : 'turns'}`)}</b>`;
  }
  h += `</div><p class="muted" style="font-size:12px;margin:8px 0 0">${tt('Die Zahl an jeder Stadt nennt die Runden bis zur Fertigstellung, der Ring den Fortschritt. Klick auf eine Stadt ändert ihre Produktion. Taste V oder der Schalter oben führt zurück zu den Einheiten.',
    'The number at each city is the turns until completion, the ring shows the progress. Click a city to change its production. Press V or use the switch above to return to the units.')}</p></section>`;
  return h;
}

function updatePanel() {
  const el = $('panel');
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
      : u.order.type === 'patrol' ? tt(`Patrouille (${u.order.pts.length - 1} Wegpunkt${u.order.pts.length > 2 ? 'e' : ''})`, `Patrol (${u.order.pts.length - 1} waypoint${u.order.pts.length > 2 ? 's' : ''})`)
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
    if (t.carries && c && c.owner === 0) h += `<button data-act="load" title="L">${tt('Einladen', 'Load')}</button>`;
    if (t.carries && cargo.length) h += `<button data-act="unload" title="U">${tt('Ausladen', 'Unload')}</button>`;
    h += `</div>`;
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
    h += `<section class="pcard pc-city"><div class="pc-head"><img class="pc-icon" src="${iconUrl('c', c.id % 2)}" alt=""><div><h3>${u ? tt('Stadt · Standort', 'City · location') : tt('Stadt', 'City')}</h3><div class="uname">${esc(c.name)}${c.coastal ? ` <span class="muted" style="font-size:12px">· ${tt('Hafen', 'Port')}</span>` : ''}</div></div></div>`;
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
    if (c.prod !== ps.value) { c.prod = ps.value; c.progress = 0; }
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
function applyPower() { $('power').style.display = showPower ? '' : 'none'; }
function updatePower() {
  const a = strength(0), b = strength(1);
  const share = a.total + b.total > 0 ? a.total / (a.total + b.total) : 0.5;
  const pct = Math.round(share * 100);
  $('powerMe').style.width = pct + '%';
  $('powerL').textContent = tt('Du ', 'You ') + pct + ' %';
  $('powerR').textContent = (100 - pct) + tt(' % Gegner', ' % enemy');
  const v = share >= 0.9 ? [tt('Erdrückend überlegen', 'Overwhelming'), 'up'] : share >= 0.65 ? [tt('Klar überlegen', 'Clearly ahead'), 'up'] : share >= 0.55 ? [tt('Überlegen', 'Ahead'), 'up']
    : share > 0.45 ? [tt('Ausgeglichen', 'Even'), 'flat'] : share > 0.35 ? [tt('Unterlegen', 'Behind'), 'down'] : share > 0.1 ? [tt('Stark unterlegen', 'Far behind'), 'down'] : [tt('Aussichtslos', 'Hopeless'), 'down'];
  $('powerVerdict').textContent = v[0]; $('powerVerdict').className = v[1];
  // Trend gegenüber dem Beginn der letzten Runde
  const hist = S.hist || [];
  const prev = [...hist].reverse().find(e => e.t < S.turn);
  const prevShare = prev && prev.me + prev.en > 0 ? prev.me / (prev.me + prev.en) : null;
  const tr = $('powerTrend');
  if (prevShare == null) { tr.textContent = ''; }
  else {
    const d = Math.round((share - prevShare) * 100);
    tr.textContent = d > 0 ? `▲ +${d} %` : d < 0 ? `▼ ${d} %` : '● ±0';
    tr.className = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    tr.title = tt('Veränderung seit Beginn der letzten Runde', 'Change since the start of the last turn');
  }
  $('power').title = tt(`Du: ${a.cities} Städte, ${a.units} Einheiten (Wert ${a.unitValue}) – Stärke ${a.total}\n`
    + `Gegner: ${b.cities} Städte, ${b.units} Einheiten (Wert ${b.unitValue}) – Stärke ${b.total}\n`
    + 'Stärke = Wert der Einheiten (Bauzeit × Zustand) + 20 je Stadt',
    `You: ${a.cities} cities, ${a.units} units (value ${a.unitValue}) – strength ${a.total}\n`
    + `Enemy: ${b.cities} cities, ${b.units} units (value ${b.unitValue}) – strength ${b.total}\n`
    + 'Strength = value of units (build time × condition) + 20 per city');
  drawPowerSpark(hist, share);
}

function drawPowerSpark(hist, share) {
  const c = $('powerSpark'), g = c.getContext('2d');
  const w = c.clientWidth || 190, h = 26, dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const pts = hist.filter(e => e.t < S.turn).map(e => (e.me + e.en > 0 ? e.me / (e.me + e.en) : 0.5));
  pts.push(share);
  // um die 50-%-Linie zentriert, auf die tatsächliche Schwankung skaliert (mind. ±10 %)
  const dev = Math.max(0.1, ...pts.map(v => Math.abs(v - 0.5))) * 1.15;
  const y = v => h / 2 - (v - 0.5) / dev * (h / 2 - 2);
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 1; g.setLineDash([3, 3]);
  g.beginPath(); g.moveTo(0, y(0.5)); g.lineTo(w, y(0.5)); g.stroke(); g.setLineDash([]);
  if (pts.length < 2) return;
  const show = pts.slice(-80);
  const x = i => i / (show.length - 1) * (w - 4) + 2;
  g.beginPath(); g.moveTo(x(0), y(0.5));
  show.forEach((v, i) => g.lineTo(x(i), y(v)));
  g.lineTo(x(show.length - 1), y(0.5)); g.closePath();
  g.fillStyle = share >= 0.5 ? 'rgba(47,125,225,0.25)' : 'rgba(217,67,59,0.25)'; g.fill();
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
  $('turnInfo').innerHTML = `${tt('Runde', 'Turn')} <b>${S.turn}</b> <span class="lvl lvl-${dk}" title="${esc(tip)}">${esc(dv.label)}</span>`;
  updateLogHead();
  $('log').innerHTML = S.log.slice(0, 60).map(l =>
    `<div class="${l.cls}" ${l.x != null ? `data-x="${l.x}" data-y="${l.y}"` : ''}><span class="t">${tt('R', 'T')}${l.t}</span>${esc(l.text)}</div>`).join('');
}

function updateHover() {
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
    s += tt(` · Stadt ${c.name} (${o === 0 ? 'deine' : o === 1 ? 'feindlich' : 'neutral'})`, ` · city ${c.name} (${o === 0 ? 'yours' : o === 1 ? 'enemy' : 'neutral'})`);
    if (P.vis[i] && c.owner === 0) {
      // eigene Stadt: wirkt ein Schlachtschiff auf sie?
      const pc = Math.round(captureChance(1, c) * 100);
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
    if (us.length) s += ' · ' + us.map(o => `${o.owner === 0 ? '' : tt('Feind: ', 'Enemy: ')}${T(o).name} ${o.hp}/${T(o).hp}${T(o).stealth ? (o.surf ? tt(' (aufgetaucht)', ' (surfaced)') : tt(' (getaucht)', ' (submerged)')) : ''}`).join(', ');
    const su = selUnit();
    const en = us.filter(o => o.owner !== 0);
    const foes = su ? cityDefenders(su, c, en) : en;   // Schiffe im Hafen verteidigen nicht gegen Bodentruppen
    const ships = en.length - foes.length;
    const sinkTxt = ships ? tt(` · ${ships === 1 ? 'das Schiff im Hafen geht' : 'die Schiffe im Hafen gehen'} mit der Stadt unter`, ` · the ${ships === 1 ? 'ship' : 'ships'} in port ${ships === 1 ? 'is' : 'are'} lost with the city`) : '';
    if (su && foes.length && T(su).str > 0) {
      const d = pickDefender(foes);
      s += ` · ${tt('Siegchance', 'Win chance')}: ${Math.round(attackOdds(su, d, x, y) * 100)} %`;
      const cs = combatSpec(su, d, x, y);
      if (cs.notes.length) s += ' (' + cs.notes.join(', ') + ')';
      if (c && c.owner !== 0 && T(su).capture) {
        const [pc, why] = capInfo(c);
        s += tt(` · danach ${pc} % Eroberung${why}: Besatzung (${us.length}) fällt, deine Einheit geht in der Stadt auf`, ` · then ${pc} % capture${why}: garrison (${us.length}) falls, your unit merges into the city`);
      }
    } else if (su && c && c.owner !== 0 && P.knownOwner[c.id] !== 0 && T(su).capture && !foes.length) {
      const [pc, why] = capInfo(c);
      s += tt(` · Eroberungschance: ${pc} %${why} (deine Einheit geht dabei in der Stadt auf)`, ` · Capture chance: ${pc} %${why} (your unit merges into the city)`) + sinkTxt;
    }
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
    const a = strength(0).total, b = strength(1).total;
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
    if (changed) { c.prod = btn.dataset.prod; c.progress = 0; }
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
  trn: tt('Bringt bis zu 6 Bodentruppen übers Meer. Unbewaffnet: Wer ihn erwischt, versenkt die ganze Ladung. Gib ihm einen Zerstörer mit.',
    'Carries up to 6 ground units across the sea. Unarmed: whoever catches it sinks the whole load. Give it a destroyer escort.'),
  dst: tt('Schnell, billig, guter Späher. Ortet als einziges Schiff getauchte U-Boote in seiner vollen Sichtweite und schlägt sie mit Sonar und Wasserbomben. Der Geleitschutz für Transporter.',
    'Fast, cheap, a good scout. The only ship that locates submerged submarines at its full vision range, and beats them with sonar and depth charges. The escort for transports.'),
  sub: tt('Getarnt: Getaucht sehen es nur Nachbarn und Zerstörer. Sein Torpedo trifft große Schiffe zuerst und doppelt stark. Nach einem Angriff ist es bis zu deinem nächsten Zug aufgetaucht (Welle unter dem Boot).',
    'Hidden: submerged, it is only seen by neighbours and destroyers. Its torpedo hits big ships first and with double strength. After attacking it is surfaced until your next turn (wave below the boat).'),
  crs: tt('Das Allround-Kriegsschiff: schlägt Zerstörer und geortete U-Boote sicher und hält viel aus. Gegen Schlachtschiffe und U-Boot-Hinterhalte hat es das Nachsehen.',
    'The all-round warship: reliably beats destroyers and located submarines and can take a lot. It loses out to battleships and submarine ambushes.'),
  car: tt('Das Auge der Flotte: sieht 4 Felder weit. Trägt und betankt bis zu 6 Jäger. Mit mindestens einem Jäger an Bord gibt er Luftdeckung: Feindliche Jäger treffen ihn und eigene Schiffe nebenan nur zu einem Drittel.',
    'The eyes of the fleet: sees 4 tiles. Carries and refuels up to 6 fighters. With at least one fighter on board it gives air cover: enemy fighters hit it and your adjacent ships only one third of the time.'),
  bat: tt('Beherrscht das Seegefecht und gibt Feuerunterstützung auf alle Nachbarfelder: Fremde Städte dort fallen zu 75 %, eigene nur zu 25 %. Verwundbar durch U-Boote und Jäger-Schwärme.',
    'Rules the sea battle and gives fire support to all adjacent tiles: foreign cities there fall 75 % of the time, your own only 25 %. Vulnerable to submarines and fighter swarms.'),
};
// Siegchancen aller Einheiten gegeneinander, unbeschädigt und ohne örtliche Zu- oder Abschläge
function oddsMatrix() {
  let x = 0, y = 0;
  for (let k = 0; k < S.W * S.H; k++) if (S.cityGrid[k] < 0 && S.terrain[k] === 0) { x = k % S.W; y = (k / S.W) | 0; break; }
  const mk = (t, o) => ({ type: t, hp: UT[t].hp, owner: o, x: -9, y: -9, carrier: null });   // Besitzer ohne Einheiten: keine Unterstützung
  const m = {};
  for (const a of UNIT_ORDER) { m[a] = {}; for (const d of UNIT_ORDER) m[a][d] = UT[a].str > 0 ? attackOdds(mk(a, 7), mk(d, 8), x, y) : null; }
  return m;
}
function buildHelp() {
  const m = oddsMatrix(), pc = v => Math.round(v * 100);
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
      ${t.str > 0 ? `<div class="vs"><b class="good">${tt('Stark gegen', 'Strong against')}:</b> ${names(strong)}</div>` : ''}
      <div class="vs"><b class="bad">${tt('Verwundbar durch', 'Vulnerable to')}:</b> ${weakTxt}</div></div>`;
  }).join('');
  const head = '<tr><th class="row">' + tt('Angreifer ↓ / Verteidiger →', 'Attacker ↓ / defender →') + '</th>' +
    UNIT_ORDER.map(d => `<th title="${UT[d].name}"><img src="${iconUrl('u', d)}" alt="">${UT[d].sym}</th>`).join('') + '</tr>';
  $('helpMatrix').innerHTML = head + UNIT_ORDER.filter(a => UT[a].str > 0).map(a => `<tr><th class="row">${UT[a].sym} · ${UT[a].name}</th>` + UNIT_ORDER.map(d => {
    const v = m[a][d], p = pc(v);
    return `<td class="${p >= 60 ? 'hi' : p >= 40 ? 'mid' : p > 0 ? 'lo' : 'none'}" title="${UT[a].name} → ${UT[d].name}">${p} %</td>`;
  }).join('') + '</tr>').join('');
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
$('turnInfo').addEventListener('click', e => { if (e.target.closest('.lvl')) openHelp('ai'); });
$('helpTabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) helpTab(b.dataset.tab); });
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.hidden = true); Sfx.preview(null); }

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
  const facts = tt(`Du: ${a.cities} Städte, ${a.units} Einheiten · Gegner: ${b.cities} Städte, ${b.units} Einheiten`, `You: ${a.cities} cities, ${a.units} units · Enemy: ${b.cities} cities, ${b.units} units`);
  if (low) {
    $('offerTitle').textContent = tt('Die Lage ist aussichtslos', 'The situation is hopeless');
    $('offerText').innerHTML = tt(`Seit ${OFFER_TURNS} Runden liegt deine Stärke unter ${offerPct} % (jetzt ${pct} %).<br><span class="muted">${facts}</span><br><br>Willst du aufgeben?`,
      `For ${OFFER_TURNS} turns your strength has been below ${offerPct} % (now ${pct} %).<br><span class="muted">${facts}</span><br><br>Do you want to surrender?`);
    $('offerYes').textContent = tt('Aufgeben', 'Surrender');
    $('offerNo').textContent = tt('Weiterkämpfen', 'Keep fighting');
    $('offerYes').onclick = () => { closeModals(); S.over = 'lose'; S.overReason = 'surrender'; saveGame(); showGameOver(); };
  } else {
    $('offerTitle').textContent = tt('Der Sieg ist dir sicher', 'Victory is yours');
    $('offerText').innerHTML = tt(`Seit ${OFFER_TURNS} Runden liegt deine Stärke über ${100 - offerPct} % (jetzt ${pct} %).<br><span class="muted">${facts}</span><br><br>Der Gegner bietet die Kapitulation an. Sieg annehmen?`,
      `For ${OFFER_TURNS} turns your strength has been above ${100 - offerPct} % (now ${pct} %).<br><span class="muted">${facts}</span><br><br>The enemy offers to surrender. Accept victory?`);
    $('offerYes').textContent = tt('Sieg annehmen', 'Accept victory');
    $('offerNo').textContent = tt('Weiterspielen', 'Play on');
    $('offerYes').onclick = () => { closeModals(); S.over = 'win'; S.overReason = 'capitulation'; saveGame(); showGameOver(); };
  }
  $('offerNo').onclick = () => { closeModals(); saveGame(); };
  Sfx.play(low ? 'lost' : 'capture');
  openModal('mOffer');
}

function showGameOver() {
  $('overTitle').textContent = S.over === 'win' ? tt('Sieg!', 'Victory!') : tt('Niederlage', 'Defeat');
  $('overText').textContent = S.over === 'win'
    ? (S.overReason === 'capitulation' ? tt(`Der Gegner hat in Runde ${S.turn} vor deiner Übermacht kapituliert.`, `The enemy surrendered to your superior force in turn ${S.turn}.`) : tt(`Du hast die Welt in ${S.turn} Runden erobert.`, `You conquered the world in ${S.turn} turns.`))
    : (S.overReason === 'surrender' ? tt(`Du hast in Runde ${S.turn} aufgegeben.`, `You surrendered in turn ${S.turn}.`) : tt(`Der Gegner hat in Runde ${S.turn} alle deine Städte eingenommen.`, `The enemy took all your cities in turn ${S.turn}.`));
  openModal('mOver');
  Sfx.play(S.over === 'win' ? 'victory' : 'defeat');
  refresh();
}

function startNew(size, diffKey, worldKey) {
  if (prodView) { prodView = false; $('vUnits').classList.add('on'); $('vProd').classList.remove('on'); }
  if (!diffKey) { try { diffKey = localStorage.getItem('archipel-diff') || 'normal'; } catch (e) { diffKey = 'normal'; } }
  if (!worldKey) { try { worldKey = localStorage.getItem('archipel-world') || 'inseln'; } catch (e) { worldKey = 'inseln'; } }
  setTimeout(() => { logSeen = S.log[0] || null; updateLogHead(); }, 0);
  newGame(size, diffKey, worldKey);
  sel = null; selCity = null; hover = null; updateHover();
  resizeCanvas();
  selectNext();
  const u = selUnit();
  if (u) centerOn(u.x, u.y, true);
  saveGame();
  refresh();
}

function afterLoad() {
  if (prodView) { prodView = false; $('vUnits').classList.add('on'); $('vProd').classList.remove('on'); }
  logSeen = S.log[0] || null;
  if (!S.hist) S.hist = [];
  if (!S.hist.length) recordStrength();
  sel = null; selCity = null; hover = null; updateHover();
  resizeCanvas();
  computeVision(0);
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
  const status = o => o.order ? (EN ? { sentry: 'sentry', patrol: 'patrol', explore: 'exploring', goto: 'marching' } : { sentry: 'Wache', patrol: 'Patrouille', explore: 'Erkundet', goto: 'Marsch' })[o.order.type] || ''
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
    h += btn('skip', tt('Überspringen', 'Skip'), tt('Leertaste', 'Space'), u.moves <= 0);
    h += btn('sentry', tt('Wache', 'Sentry'), 'S', !!(u.order && u.order.type === 'sentry'));
    h += btn('explore', tt('Erkunden', 'Explore'), 'R', (aboard && t.domain === 'land') || (u.type === 'trn' && cargoOf(u).length > 0));
    h += btn('patrol', tt('Patrouille', 'Patrol'), 'P', aboard);
    h += btn('home', t.domain === 'sea' ? tt('Heimkehr (Hafen)', 'Return home (port)') : tt('Heimkehr', 'Return home'), 'B', !aboard && homeOk(here));
    if (t.carries && here && here.owner === 0) h += btn('load', tt('Einladen', 'Load'), 'L');
    if (t.carries && cargoOf(u).length) h += btn('unload', `${tt('Ausladen', 'Unload')} (${cargoOf(u).length})`, 'U');
    if (u.order) h += btn('cancel', u.order.type === 'sentry' ? tt('Wecken', 'Wake') : tt('Befehl löschen', 'Clear order'), '');
    h += '<hr>' + btn('help', tt(`Handbuch: ${t.name}`, `Handbook: ${t.name}`), '');
  }
  if (ownCity) {
    const p = ownCity.prod ? UT[ownCity.prod] : null;
    if (u) h += '<hr>';
    h += `<button data-cact="prod"><img src="${iconUrl('c', ownCity.id % 2)}" alt="">${tt('Produktion ändern …', 'Change production …')}<small>${p ? `${esc(p.name)} · ${p.cost - ownCity.progress} ${tt('R.', 'T.')}` : tt('nichts', 'nothing')}</small></button>`;
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
  if (b.dataset.cact === 'prod') { if (city && city.owner === 0) { Sfx.play('tick'); openProdDialog(city); } return; }
  const u = selUnit();
  if (b.dataset.cact === 'help') { if (u) openHelp(null, u.type); return; }
  if (u && u.order && u.order.type === 'sentry' && b.dataset.cact !== 'sentry' && b.dataset.cact !== 'cancel') u.order = null;
  ({ skip: actSkip, sentry: actSentry, load: actLoad, unload: actUnload, cancel: actCancel, patrol: actPatrol, explore: actExplore, home: actHome })[b.dataset.cact]();
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
    drag = { btn: 0, x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop, moved: false };
    return;
  }
  e.preventDefault();                       // verhindert das Auto-Scrollen
  if (enemyPlaybackRunning()) skipAnim();
  cam.active = false;
  drag = { btn: e.button, x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop, moved: false };
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < (drag.btn === 0 ? DRAG_THRESHOLD_LEFT : DRAG_THRESHOLD)) return;
  if (!drag.moved) { drag.moved = true; cam.active = false; cv.style.cursor = 'grabbing'; }
  wrap.scrollLeft = drag.sl - dx;
  wrap.scrollTop = drag.st - dy;
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
    wrap.scrollLeft += e.deltaX; wrap.scrollTop += e.deltaY;
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
  wrap.scrollLeft = x * TS - wrap.clientWidth / 2; wrap.scrollTop = y * TS - wrap.clientHeight / 2;
});

$('panel').addEventListener('click', e => {
  const q = e.target.closest('[data-help]');
  if (q) { openHelp(null, q.dataset.help); return; }
  const chip = e.target.closest('[data-unit]');
  if (chip) { const u = unitById(+chip.dataset.unit); if (u) { select(u); refresh(); } return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  ({ skip: actSkip, sentry: actSentry, load: actLoad, unload: actUnload, cancel: actCancel, next: actNext, patrol: actPatrol, patrolGo: patrolStart, patrolUndo: patrolUndo, patrolAbort: patrolAbort, explore: actExplore, home: actHome })[b.dataset.act]();
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
  if (autoEndAt) { if (e.key === 'Enter') { e.preventDefault(); endHumanTurn(); } else cancelAutoEnd(); return; }
  if (enemyPlaybackRunning() && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); skipAnim(); return; }
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const modalOpen = [...document.querySelectorAll('.modal')].some(m => !m.hidden);
  if (modalOpen) { if (e.key === 'Escape') closeModals(); return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.shiftKey && KEYDIR[k] && k.startsWith('Arrow')) {   // Umschalt + Pfeiltaste: Karte verschieben
    e.preventDefault(); cam.active = false;
    wrap.scrollLeft += KEYDIR[k][0] * TS * 3; wrap.scrollTop += KEYDIR[k][1] * TS * 3;
    return;
  }
  if (k === 'v') { setProdView(!prodView); return; }
  if (prodView) {   // in der Produktionsansicht gibt es keine Einheitenbefehle
    if (k === 'Escape') { setProdView(false); return; }
    if (!['+', '-', 'h', '?', 'm', 'k', 'i', 'Enter'].includes(k)) return;
  }
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
    case 'l': actLoad(); break;
    case 'u': actUnload(); break;
    case 'Enter': e.preventDefault(); endHumanTurn(); break;
    case 'Escape': sel = null; selCity = null; refresh(); break;
    case '+': setZoom(TS + 4); break;
    case '-': setZoom(TS - 4); break;
    case 'h': case '?': openHelp(); break;
    case 'm': toggleSound(); break;
    case 'k': openSoundTest(); break;
    case 'i': openStats(); break;
  }
});

$('endTurn').onclick = endHumanTurn;
$('nextUnit').onclick = () => { setProdView(false); actNext(); };
$('vUnits').onclick = () => setProdView(false);
$('vProd').onclick = () => setProdView(true);
$('powerChk').checked = showPower;
$('powerChk').onchange = e => {
  showPower = e.target.checked;
  try { localStorage.setItem('archipel-power', showPower ? '1' : '0'); } catch (err) {}
  applyPower(); if (S) updatePower();
};
applyPower();
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
// Selten Gebrauchtes liegt im Menü (Spiel: Neues Spiel, Spielstände, Statistik · Einstellungen: Lautstärke, Klangtest,
// Mausrad/Touchpad, automatisches Rundenende). Ein Klick auf einen Eintrag schließt es, Einstellungen lassen es offen.
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
  else if (inside) e.stopPropagation();   // Tasten im Menü (Regler, Auswahl, Tab) gehören nicht dem Spiel
  else closeMenu();
}, true);
window.addEventListener('resize', closeMenu);

$('bNew').onclick = () => openModal('mNew');
$('bStart').onclick = () => {
  try {
    localStorage.setItem('archipel-diff', $('diffSel').value); localStorage.setItem('archipel-size', $('sizeSel').value);
    localStorage.setItem('archipel-world', $('worldSel').value);
  } catch (e) {}
  closeModals(); startNew($('sizeSel').value, $('diffSel').value, $('worldSel').value);
};
$('diffSel').onchange = () => { $('diffDesc').textContent = DIFFICULTY[$('diffSel').value].desc; };
$('worldSel').onchange = () => { $('worldDesc').textContent = WORLDS[$('worldSel').value].desc; };
$('bOverNew').onclick = () => { closeModals(); openModal('mNew'); };
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
  const enemyC = S.cities.filter(c => known[c.id] === 1).length;
  const neutralC = S.cities.filter(c => known[c.id] === -1).length;
  const idle = myCities.filter(c => !c.prod).length;
  const box = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  $('statSummary').innerHTML = box(diff().label, tt('Schwierigkeit', 'Difficulty')) + box(S.turn, tt('Runde', 'Turn')) + box(myCities.length, tt('Deine Städte', 'Your cities')) + box(myUnits.length, tt('Deine Einheiten', 'Your units'))
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

  // Zerstörte Einheiten: was du zerstört hast, was der Gegner zerstört hat, was sonst verloren ging (siehe killUnit)
  const kMe = (S.kills && S.kills[0]) || {}, kEn = (S.kills && S.kills[1]) || {}, wMe = (S.wasted && S.wasted[0]) || {};
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
  if (c.prod !== e.target.value) { c.prod = e.target.value; c.progress = 0; Sfx.play('tick'); }
  renderStats(); refresh();
});

// ------------------------------------------------------------------ Klangtest
const FX_NAMES = EN ? { select: 'Select', tick: 'Click', error: 'Invalid', boom: 'Explosion', salvo: 'Battleship salvo', lost: 'Unit lost', capture: 'City captured',
  cityLost: 'City lost', built: 'Unit ready', clank: 'Load/unload', endTurn: 'End of turn', alarm: 'Enemy contact', victory: 'Victory', defeat: 'Defeat' }
  : { select: 'Auswahl', tick: 'Klick', error: 'Ungültig', boom: 'Explosion', salvo: 'Schlachtschiff-Salve', lost: 'Einheit verloren', capture: 'Stadt erobert',
  cityLost: 'Stadt verloren', built: 'Einheit fertig', clank: 'Ein-/Ausladen', endTurn: 'Rundenende', alarm: 'Feindkontakt', victory: 'Sieg', defeat: 'Niederlage' };

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
$('bSndTest').onclick = openSoundTest;

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
// ------------------------------------------------------------------ Spielstände
const SIZE_NAME = EN ? { klein: 'small', mittel: 'medium', gross: 'large' } : { klein: 'klein', mittel: 'mittel', gross: 'groß' };
function fmtDate(t) {
  const d = new Date(t);
  const loc = EN ? 'en-GB' : 'de-DE';
  return d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
function slotDesc(m) {
  m = { ...m, turn: Math.trunc(Number(m.turn)) || 0, cities: Math.trunc(Number(m.cities)) || 0, units: Math.trunc(Number(m.units)) || 0,
    size: SIZE_NAME[m.size] ? m.size : '', over: ['win', 'lose'].includes(m.over) ? m.over : null };
  const end = m.over === 'win' ? tt(' · gewonnen', ' · won') : m.over === 'lose' ? tt(' · verloren', ' · lost') : '';
  const dl = m.difficulty && DIFFICULTY[m.difficulty] ? ' · ' + DIFFICULTY[m.difficulty].label : '';
  return EN ? `Turn ${m.turn} · ${plural(m.cities, 'city', 'cities')} · ${plural(m.units, 'unit', 'units')} · ${SIZE_NAME[m.size] || '?'} map${dl}${end}`
    : `Runde ${m.turn} · ${plural(m.cities, 'Stadt', 'Städte')} · ${plural(m.units, 'Einheit', 'Einheiten')} · Karte ${SIZE_NAME[m.size] || '?'}${dl}${end}`;
}
function renderSaves() {
  const slots = listSlots();
  let rows = '';
  try {
    const j = localStorage.getItem(SAVE_KEY);
    if (j) {
      const o = JSON.parse(j);
      const m = { turn: o.turn, size: o.size, cities: o.cities.filter(c => c.owner === 0).length, units: o.units.filter(u => u.owner === 0).length, over: o.over, difficulty: o.difficulty };
      rows += `<tr class="auto"><td>${tt('Automatisch (letzte Runde)', 'Autosave (last turn)')}</td><td class="muted">${slotDesc(m)}</td><td class="muted">${tt('laufend', 'current')}</td>
        <td class="acts"><button data-load="auto">${tt('Laden', 'Load')}</button><button data-export="auto" title="${tt('Als Datei herunterladen', 'Download as file')}">Export</button></td></tr>`;
    }
  } catch (e) {}
  rows += slots.map(m => `<tr><td>${esc(m.name)}</td><td class="muted">${slotDesc(m)}</td><td class="muted">${fmtDate(m.date)}</td>
    <td class="acts"><button data-load="${m.id}">${tt('Laden', 'Load')}</button><button data-over="${m.id}" title="${tt('Mit dem aktuellen Spiel überschreiben', 'Overwrite with the current game')}">${tt('Überschreiben', 'Overwrite')}</button><button data-export="${m.id}" title="${tt('Als Datei herunterladen', 'Download as file')}">Export</button><button data-del="${m.id}" class="danger" title="${tt('Löschen', 'Delete')}">✕</button></td></tr>`).join('');
  $('saveRows').innerHTML = rows || `<tr><td colspan="4" class="muted">${tt('Noch keine Spielstände.', 'No saved games yet.')}</td></tr>`;
  let used = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('archipel')) used += (localStorage.getItem(k) || '').length; } } catch (e) {}
  $('saveInfo').textContent = tt(`${slots.length} gespeicherte Spielstände · belegt etwa ${(used * 2 / 1024 / 1024).toFixed(1)} MB von ca. 5 MB Browserspeicher. Export sichert einen Spielstand als Datei (z. B. für einen anderen Browser oder Rechner).`,
    `${slots.length} saved game${slots.length === 1 ? '' : 's'} · using about ${(used * 2 / 1024 / 1024).toFixed(1)} MB of roughly 5 MB browser storage. Export saves a game as a file (e.g. for another browser or computer).`);
}
function openSaves() {
  if (!S) return;
  $('saveName').value = EN ? `Turn ${S.turn} – ${plural(S.cities.filter(c => c.owner === 0).length, 'city', 'cities')}`
    : `Runde ${S.turn} – ${plural(S.cities.filter(c => c.owner === 0).length, 'Stadt', 'Städte')}`;
  renderSaves(); openModal('mSaves');
  setTimeout(() => { $('saveName').focus(); $('saveName').select(); }, 30);
}
function trySave(name, id) {
  try { saveSlot(name, id); toast(tt('Spiel gespeichert', 'Game saved')); Sfx.play('select'); renderSaves(); return true; }
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
$('wStart').onclick = closeModals;
$('wHelp').onclick = () => { closeModals(); openHelp('start'); };
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
  let prefWorld = 'inseln';
  try { prefWorld = localStorage.getItem('archipel-world') || 'inseln'; } catch (e) {}
  $('worldSel').innerHTML = Object.entries(WORLDS).map(([k, v]) => `<option value="${k}" ${k === prefWorld ? 'selected' : ''}>${v.label}</option>`).join('');
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
  if (!welcomeSeen()) showWelcome();
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => renderMini());
})();
