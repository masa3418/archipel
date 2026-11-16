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
const anim = { rec: false, cursor: 0, speed: 110, events: [], byUnit: new Map(), t0: 0, end: 0 };

function animBegin(speed, follow = false) {
  anim.rec = true; anim.cursor = 0; anim.speed = speed; anim.events = []; anim.skippable = false;
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

hooks.move = (u, fx, fy, tx, ty) => {
  if (!anim.rec) return;
  if (u.owner !== 0 && !seenByHuman(fx, fy) && !seenByHuman(tx, ty)) return;
  recCam(fx, fy, tx, ty);
  anim.events.push({ type: 'move', id: u.id, utype: u.type, owner: u.owner, fx, fy, tx, ty, t0: anim.cursor, dur: anim.speed,
    vr: u.owner === 0 ? T(u).vision : 0 });
  anim.cursor += anim.speed;
};
const LABEL_MS = 1700;
// won: hat der Angreifer gewonnen? (Verlierer sind beim Aufruf noch nicht entfernt)
hooks.combat = (a, d, x, y, won, storm = null) => {
  if (!anim.rec) return;
  if (a.owner !== 0 && !(d && d.owner === 0) && !seenByHuman(x, y)) return;
  recCam(x, y);
  anim.events.push({ type: 'boom', x, y, t0: anim.cursor, dur: 650, win: won ? 'att' : 'def',
    hl: (a.owner === 0 && !won) || (d && d.owner === 0 && won) });
  // Ergebnis aus deiner Sicht als Schriftzug über dem Feld
  let label = null;
  // d === null: Eroberungsversuch einer unbesetzten Stadt ist gescheitert
  const city = cityAt(x, y);
  if (storm) label = null;   // Stadt fällt: der Schriftzug der Eroberung folgt
  else if (a.owner === 0) label = won ? (storm === false ? ['Sieg – Stadt hält', 'good'] : ['Sieg!', 'good']) : d ? ['Verloren', 'bad'] : ['Gescheitert', 'bad'];
  else if (d && d.owner === 0) label = won ? (storm === false ? ['Verloren – Stadt hält', 'bad'] : ['Verloren', 'bad']) : ['Abgewehrt!', 'good'];
  else if (!d && city && city.owner === 0) label = ['Abgewehrt!', 'good'];
  if (label) anim.events.push({ type: 'label', x, y, text: label[0], tone: label[1], t0: anim.cursor + 250, dur: LABEL_MS });
  anim.cursor += Math.max(260, anim.speed * 2.5);
};
hooks.capture = (c, owner, prev) => {
  if (!anim.rec) return;
  if (owner === 0) captureQueue.push({ game: S, id: c.id });
  if (owner !== 0 && !seenByHuman(c.x, c.y)) return;
  recCam(c.x, c.y);
  const lost = prev === 0;
  anim.events.push({ type: 'capture', x: c.x, y: c.y, owner, lost, t0: anim.cursor, dur: 900 });
  const text = owner === 0 ? 'Erobert!' : lost ? 'Stadt verloren' : 'Gegner erobert';
  anim.events.push({ type: 'label', x: c.x, y: c.y, text, tone: owner === 0 ? 'good' : 'bad', t0: anim.cursor + 150, dur: LABEL_MS });
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
    const here = topUnitsAt(x, y);
    const enemy = here.some(o => o.owner !== 0) && S.players[0].vis[idx(x, y)];
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

function render(now = performance.now()) {
  if (!S || !terrainCache) return;
  const P = S.players[0];
  const rel = now - anim.t0;
  const playing = animActive(now);
  ctx.drawImage(terrainCache, 0, 0);

  for (const c of S.cities) {
    if (!P.seen[idx(c.x, c.y)] && !S.over) continue;
    ctx.drawImage(citySprite(S.over ? c.owner : P.knownOwner[c.id], TS, c.id % 2), c.x * TS, c.y * TS);
  }

  const V = viewNow(rel, playing);
  drawFog(V);

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
    if (u.owner !== 0 && !V.vis[i] && !S.over) continue;
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
    const en = su && S.players[0].vis[idx(hx, hy)] ? topUnitsAt(hx, hy).filter(o => o.owner !== 0) : [];
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
    else if (e.type === 'boom') { Sfx.play('boom', 80); if (e.hl) setTimeout(() => Sfx.play('lost', 300), 380); }
    else if (e.type === 'capture') { if (e.owner === 0) Sfx.play('capture'); else if (e.lost) Sfx.play('cityLost'); else Sfx.play('boom', 80); }
  }
  if (anim.after && now >= anim.end) { const f = anim.after; anim.after = null; f(); }
  if (captureQueue.length && now >= anim.end && !anyModalOpen()) showCaptureDialog();
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
    if (u.owner !== 0 && !P.vis[idx(u.x, u.y)] && !S.over) continue;
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
  if (!list.length) { toast('Keine Einheit wartet mehr'); Sfx.play('error'); refresh(); return; }
  const cur = selUnit();
  const nxt = list.find(u => cur && u.id > cur.id) || list[0];
  if (cur && nxt === cur) toast('Das ist die letzte wartende Einheit');
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
  b.innerHTML = 'Runde endet gleich … <small>(Klick/Taste: abbrechen)</small>';
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
function doMove(u, x, y) {
  u.order = null;
  animBegin(120);
  const r = moveStep(u, x, y);
  animEnd();
  if (!r.ok) { toast(r.msg); Sfx.play('error'); }
  else if (r.boarded) Sfx.play('clank');
  afterAction(u);
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
  toast(n ? `${n} Einheit(en) eingeladen` : 'Nichts zum Einladen in dieser Stadt');
  refresh();
}
function actUnload() {
  const u = selUnit(); if (!u || !T(u).carries) return;
  if (!cargoOf(u).length) { toast('Niemand an Bord'); return; }
  animBegin(120);
  const n = unloadAll(u);
  animEnd();
  if (!n) Sfx.play('error');
  toast(n ? `${n} Einheit(en) ausgeladen` : 'Kein freies Feld zum Ausladen');
  afterAction(u);
}
// Heimkehr: Marsch zur nächsten erreichbaren eigenen Stadt (Schiffe: Hafenstadt)
function actHome() {
  const u = selUnit(); if (!u) return;
  const t = T(u);
  const ok = c => c && c.owner === 0 && (t.domain !== 'sea' || c.coastal);
  const here = cityAt(u.x, u.y);
  if (u.carrier == null && ok(here)) { toast(t.domain === 'sea' ? 'Liegt schon im Hafen' : 'Steht schon in einer eigenen Stadt'); Sfx.play('error'); return; }
  const path = bfs(u.x, u.y, makePassable(u, false, true), (x, y) => ok(cityAt(x, y)));
  if (!path) { toast(t.domain === 'sea' ? 'Kein eigener Hafen erreichbar' : 'Keine eigene Stadt erreichbar'); Sfx.play('error'); return; }
  const [x, y] = path[path.length - 1];
  if (t.fuel && path.length > u.fuel) {
    // Nicht losschicken: der Resttreibstoff bleibt dem Spieler (z. B. zum Erkunden)
    toast(`Treibstoff reicht nicht: ${cityAt(x, y).name} ist ${path.length} Felder entfernt, Treibstoff für ${u.fuel}`);
    Sfx.play('error'); return;
  }
  Sfx.play('select');
  doGoto(u, x, y);
}
function actCancel() { const u = selUnit(); if (u) { u.order = null; refresh(); } }

// ------------------------------------------------------------------ Patrouille
function actExplore() {
  const u = selUnit(); if (!u) return;
  if (u.carrier != null && T(u).domain === 'land') { toast('Erst ausladen, dann erkunden'); Sfx.play('error'); return; }
  if (T(u).domain === 'sea' && u.type === 'trn' && cargoOf(u).length) { toast('Transporter mit Ladung erkunden nicht selbstständig'); Sfx.play('error'); return; }
  u.order = { type: 'explore' };
  Sfx.play('select');
  animBegin(120);
  runExplore(u);
  animEnd();
  afterAction(u);
}

function actPatrol() {
  const u = selUnit(); if (!u) return;
  if (u.carrier != null) { toast('Erst ausladen, dann Patrouille festlegen'); Sfx.play('error'); return; }
  patrolMode = { id: u.id, pts: [] };
  Sfx.play('tick');
  toast('Wegpunkte auf der Karte anklicken, Enter startet');
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
  if (!S.players[0].seen[idx(x, y)]) { toast('Wegpunkte nur auf erkundeten Feldern'); Sfx.play('error'); return; }
  const c = cityAt(x, y);
  if (c && c.owner !== 0) { toast('Wegpunkt nicht in fremden Städten'); Sfx.play('error'); return; }
  if (!canEnterTerrain(u, x, y)) {
    toast(T(u).domain === 'land' ? 'Wegpunkt muss an Land liegen' : 'Wegpunkt muss auf dem Wasser liegen'); Sfx.play('error'); return;
  }
  patrolMode.pts.push([x, y]);
  Sfx.play('tick');
  refresh();
}

function onTileClick(x, y, shift) {
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
      if (enemy) { u.order = null; addLog(`${T(u).name} meldet Feindkontakt!`, 'bad', u.x, u.y); }
    }
    for (const u of S.units.filter(o => o.owner === 0 && o.order && o.order.type === 'goto')) {
      // Feind ist während des Gegnerzugs herangerückt: Marsch anhalten
      if (u.carrier == null && enemyAdjacent(u)) { u.order = null; addLog(`${T(u).name}: Marsch angehalten – Feindkontakt!`, 'bad', u.x, u.y); continue; }
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
    if (fresh.some(t => t.includes('Feindkontakt'))) Sfx.play('alarm');
    else if (fresh.some(t => t.includes('fertiggestellt'))) Sfx.play('built');
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
  const st = o.order ? ({ sentry: ' · Wache', patrol: ' · Patrouille', explore: ' · Erkundet' }[o.order.type] || ' · Marsch') : '';
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

function updatePanel() {
  const el = $('panel');
  if (!S) { el.innerHTML = ''; return; }
  let h = '';
  const u = selUnit();
  if (u) {
    const t = T(u);
    const cargo = cargoOf(u);
    let orderTxt = 'keiner';
    if (u.order) orderTxt = u.order.type === 'sentry' ? 'Wache'
      : u.order.type === 'explore' ? 'Erkunden'
      : u.order.type === 'patrol' ? `Patrouille (${u.order.pts.length - 1} Wegpunkt${u.order.pts.length > 2 ? 'e' : ''})`
      : `Marsch nach ${u.order.x},${u.order.y}`;
    h += `<section class="pcard pc-unit"><div class="pc-head"><img class="pc-icon" src="${iconUrl('u', u.type)}" alt=""><div><h3>Einheit</h3><div class="uname">${esc(t.name)}</div></div></div>`;
    h += `<div class="stats">
      <span>Trefferpunkte</span><b>${u.hp} / ${t.hp}</b>
      <span>Bewegung</span><b>${u.moves} / ${t.move}</b>
      <span>Stärke</span><b>${t.str}</b>`;
    if (t.domain === 'air') {
      const dh = distHome(0, u.x, u.y);
      const warn = !isBase(u) && u.fuel - Math.max(0, u.moves) < dh;
      h += `<span>Treibstoff</span><b class="${warn ? 'warn' : ''}">${u.fuel} / ${t.fuel}${warn ? ' ⚠ zurückfliegen!' : ''}</b>
            <span>Nächste Basis</span><b>${dh} Felder</b>`;
    }
    if (t.carries) h += `<span>An Bord</span><b>${cargo.length} / ${t.capacity}</b>`;
    if (u.carrier != null) h += `<span>Ort</span><b>an Bord</b>`;
    h += `<span>Befehl</span><b>${orderTxt}</b></div>`;
    if (cargo.length) h += `<div>${cargo.map(unitChip).join('')}</div>`;
    h += `<div class="row">
      <button data-act="skip" title="Leertaste">Überspringen</button>
      <button data-act="sentry" title="S">Wache</button>
      <button data-act="patrol" title="P">Patrouille</button>
      <button data-act="explore" title="R">Erkunden</button>
      <button data-act="home" title="B – zur nächsten eigenen ${t.domain === 'sea' ? 'Hafenstadt' : 'Stadt'}">Heimkehr</button>`;
    if (u.order) h += `<button data-act="cancel">Befehl löschen</button>`;
    const c = cityAt(u.x, u.y);
    if (t.carries && c && c.owner === 0) h += `<button data-act="load" title="L">Einladen</button>`;
    if (t.carries && cargo.length) h += `<button data-act="unload" title="U">Ausladen</button>`;
    h += `</div>`;
    if (patrolMode && patrolMode.id === u.id) {
      const n = patrolMode.pts.length;
      h += `<div class="patrolbox"><b>Patrouille festlegen</b><br>Klicke nacheinander Wegpunkte auf der Karte (${n} gesetzt).
        Die Einheit läuft dann dauerhaft im Kreis: Start → 1 → 2 … → Start. Bei Feindkontakt bricht sie ab und meldet sich.
        <div class="row"><button data-act="patrolGo" class="primary" ${n ? '' : 'disabled'}>Starten ⏎</button>
        <button data-act="patrolUndo" ${n ? '' : 'disabled'}>Letzten löschen</button>
        <button data-act="patrolAbort">Abbrechen</button></div></div>`;
    }
    if (u.carrier != null) h += `<p class="muted">Zieh die Einheit auf ein Nachbarfeld an Land, um sie auszuladen.</p>`;
    h += `</section>`;
  }
  const c = selCity != null ? S.cities[selCity] : null;
  if (c && c.owner === 0) {
    const p = c.prod ? UT[c.prod] : null;
    h += `<section class="pcard pc-city"><div class="pc-head"><img class="pc-icon" src="${iconUrl('c', c.id % 2)}" alt=""><div><h3>${u ? 'Stadt · Standort' : 'Stadt'}</h3><div class="uname">${esc(c.name)}${c.coastal ? ' <span class="muted" style="font-size:12px">· Hafen</span>' : ''}</div></div></div>`;
    h += `<label class="muted" style="display:block;margin-top:6px">Produktion</label><select id="prodSel">`;
    for (const k of UNIT_ORDER) {
      const ut = UT[k];
      const dis = ut.domain === 'sea' && !c.coastal;
      h += `<option value="${k}" ${c.prod === k ? 'selected' : ''} ${dis ? 'disabled' : ''}>${ut.name} – ${ut.cost} Runden</option>`;
    }
    h += `</select>`;
    if (p) h += `<div class="bar"><i style="width:${Math.round(c.progress / p.cost * 100)}%"></i></div>
      <div class="muted" style="font-size:12px;margin-top:3px">Fertig in ${p.cost - c.progress} Runde(n). Ein Wechsel setzt den Fortschritt zurück.</div>`;
    const inCity = topUnitsAt(c.x, c.y).filter(o => o.owner === 0);
    if (inCity.length) h += `<div style="margin-top:8px" class="muted">In der Stadt:</div><div>${inCity.map(unitChip).join('')}</div>`;
    h += `</section>`;
  }
  if (!u && !(c && c.owner === 0)) {
    const left = S.units.filter(needsOrders).length;
    h += `<h3>Lage</h3>`;
    h += left ? `<p>${left} Einheit(en) warten auf Befehle. <button data-act="next">Nächste (N)</button></p>`
      : `<p>Alle Einheiten haben gezogen. <b>Enter</b> beendet die Runde.</p>`;
    h += `<p class="muted">Klicke eine Einheit oder eigene Stadt an.</p>`;
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
    ? `Runde beenden ⏎ <small>· ${left} ${left === 1 ? 'wartet' : 'warten'}</small>`
    : 'Runde beenden ⏎';
  b.title = left > 0 ? 'Es gibt noch Einheiten mit Bewegungspunkten (N wählt die nächste)' : 'Alle Einheiten haben gezogen';
}

// ------------------------------------------------------------------ Kräfteverhältnis
function updatePower() {
  const a = strength(0), b = strength(1);
  const share = a.total + b.total > 0 ? a.total / (a.total + b.total) : 0.5;
  const pct = Math.round(share * 100);
  $('powerMe').style.width = pct + '%';
  $('powerL').textContent = 'Du ' + pct + ' %';
  $('powerR').textContent = (100 - pct) + ' % Gegner';
  const v = share >= OFFER_HIGH ? ['Erdrückend überlegen', 'up'] : share >= 0.65 ? ['Klar überlegen', 'up'] : share >= 0.55 ? ['Überlegen', 'up']
    : share > 0.45 ? ['Ausgeglichen', 'flat'] : share > 0.35 ? ['Unterlegen', 'down'] : share > OFFER_LOW ? ['Stark unterlegen', 'down'] : ['Aussichtslos', 'down'];
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
    tr.title = 'Veränderung seit Beginn der letzten Runde';
  }
  $('power').title = `Du: ${a.cities} Städte, ${a.units} Einheiten (Wert ${a.unitValue}) – Stärke ${a.total}\n`
    + `Gegner: ${b.cities} Städte, ${b.units} Einheiten (Wert ${b.unitValue}) – Stärke ${b.total}\n`
    + 'Stärke = Wert der Einheiten (Bauzeit × Zustand) + 20 je Stadt';
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
  $('turnInfo').innerHTML = `Runde <b>${S.turn}</b>`;
  updateLogHead();
  $('log').innerHTML = S.log.slice(0, 60).map(l =>
    `<div class="${l.cls}" ${l.x != null ? `data-x="${l.x}" data-y="${l.y}"` : ''}><span class="t">R${l.t}</span>${esc(l.text)}</div>`).join('');
}

function updateHover() {
  if (!hover || !S) { $('hover').innerHTML = '&nbsp;'; return; }
  const [x, y] = hover, i = idx(x, y), P = S.players[0];
  if (!P.seen[i]) { $('hover').textContent = `(${x},${y}) unerforscht`; return; }
  let s = `(${x},${y}) ${S.terrain[i] ? 'Land' : 'Wasser'}`;
  const c = cityAt(x, y);
  if (c) {
    const o = P.knownOwner[c.id];
    s += ` · Stadt ${c.name} (${o === 0 ? 'deine' : o === 1 ? 'feindlich' : 'neutral'})`;
  }
  if (P.vis[i]) {
    const us = topUnitsAt(x, y);
    if (us.length) s += ' · ' + us.map(o => `${o.owner === 0 ? '' : 'Feind: '}${T(o).name} ${o.hp}/${T(o).hp}`).join(', ');
    const su = selUnit();
    const en = us.filter(o => o.owner !== 0);
    if (su && en.length && T(su).str > 0) {
      const d = pickDefender(en);
      s += ` · Siegchance: ${Math.round(attackOdds(su, d, x, y) * 100)} %`;
      const cs = combatSpec(su, d, x, y);
      if (cs.notes.length) s += ' (' + cs.notes.join(', ') + ')';
      if (c && c.owner !== 0 && T(su).capture) s += ` · danach 50 % Eroberung, dabei fällt die Besatzung (${us.length})`;
    } else if (su && c && c.owner !== 0 && P.knownOwner[c.id] !== 0 && T(su).capture && !en.length) {
      s += ' · Eroberungschance: 50 %';
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
const UNIT_ROLE = {
  inf: 'Erobert Städte · schnell gebaut', tank: 'Erobert Städte · 2 Felder pro Zug',
  ftr: 'Fliegt weit · späht und jagt', trn: 'Bringt 6 Landeinheiten übers Meer',
  dst: 'Schneller Späher · jagt U-Boote', sub: 'Torpedo gegen große Schiffe',
  crs: 'Robust und vielseitig', car: 'Schwimmende Basis für Jäger', bat: 'Das stärkste Schiff',
};
const CAPTURE_CHEERS = [
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
  const mine = S.cities.filter(o => o.owner === 0).length, total = S.cities.length;
  const a = strength(0).total, b = strength(1).total;
  const pct = Math.round(a / Math.max(1, a + b) * 100);
  $('capTitle').textContent = `${c.name} ist erobert!`;
  $('capCheer').textContent = CAPTURE_CHEERS[(S.turn + c.id) % CAPTURE_CHEERS.length];
  $('capFacts').innerHTML = `<span><b>${mine}</b> von ${total} Städten gehören dir</span><span>Kräfteverhältnis <b>${pct} %</b></span>`
    + (c.coastal ? '<span>⚓ Hafenstadt – baut auch Schiffe</span>' : '');
  $('capBar').style.width = Math.round(mine / total * 100) + '%';
  let h = '';
  for (const k of UNIT_ORDER) {
    const ut = UT[k], dis = ut.domain === 'sea' && !c.coastal;
    h += `<button class="cap-unit${c.prod === k ? ' cur' : ''}" data-prod="${k}" ${dis ? 'disabled title="Nur in Hafenstädten"' : ''}>
      <img src="${iconUrl('u', k)}" alt=""><b>${ut.name}</b><small>${ut.cost} Runden</small><em>${UNIT_ROLE[k] || ''}</em></button>`;
  }
  $('capUnits').innerHTML = h;
  $('capUnits').onclick = e => {
    const btn = e.target.closest('[data-prod]');
    if (!btn || btn.disabled) return;
    if (c.prod !== btn.dataset.prod) { c.prod = btn.dataset.prod; c.progress = 0; }
    Sfx.play('select');
    closeModals();
    addLog(`${c.name} baut jetzt ${UT[c.prod].name}.`, '', c.x, c.y);
    saveGame(); refresh(); scheduleAutoEnd();
  };
  openModal('mCapture');
}

function openModal(id) { $(id).hidden = false; }
function closeModals() { document.querySelectorAll('.modal').forEach(m => m.hidden = true); Sfx.preview(null); }

// ------------------------------------------------------------------ Aufgeben / vorzeitiger Sieg
// Liegt das Kräfteverhältnis 5 Runden in Folge unter 10 % (über 90 %), bietet das
// Spiel Aufgeben (den Sieg) an. Nach einer Ablehnung wird 10 Runden nicht erneut gefragt.
const OFFER_LOW = 0.1, OFFER_HIGH = 0.9, OFFER_TURNS = 5, OFFER_PAUSE = 10, OFFER_MIN_TURN = 15;
function shareOf(e) { return e.me + e.en > 0 ? e.me / (e.me + e.en) : 0.5; }
function maybeOfferEnd() {
  if (!S || S.over || !S.hist || S.turn < OFFER_MIN_TURN) return;
  if ([...document.querySelectorAll('.modal')].some(m => !m.hidden)) return;
  if (S.offerPause && S.turn < S.offerPause) return;
  const last = S.hist.slice(-OFFER_TURNS);
  if (last.length < OFFER_TURNS) return;
  const low = last.every(e => shareOf(e) < OFFER_LOW), high = last.every(e => shareOf(e) > OFFER_HIGH);
  if (!low && !high) return;
  S.offerPause = S.turn + OFFER_PAUSE;      // gilt auch, wenn der Dialog einfach geschlossen wird
  const pct = Math.round(shareOf(last[last.length - 1]) * 100);
  const a = strength(0), b = strength(1);
  const facts = `Du: ${a.cities} Städte, ${a.units} Einheiten · Gegner: ${b.cities} Städte, ${b.units} Einheiten`;
  if (low) {
    $('offerTitle').textContent = 'Die Lage ist aussichtslos';
    $('offerText').innerHTML = `Seit ${OFFER_TURNS} Runden liegt deine Stärke unter ${OFFER_LOW * 100} % (jetzt ${pct} %).<br><span class="muted">${facts}</span><br><br>Willst du aufgeben?`;
    $('offerYes').textContent = 'Aufgeben';
    $('offerNo').textContent = 'Weiterkämpfen';
    $('offerYes').onclick = () => { closeModals(); S.over = 'lose'; S.overReason = 'surrender'; saveGame(); showGameOver(); };
  } else {
    $('offerTitle').textContent = 'Der Sieg ist dir sicher';
    $('offerText').innerHTML = `Seit ${OFFER_TURNS} Runden liegt deine Stärke über ${OFFER_HIGH * 100} % (jetzt ${pct} %).<br><span class="muted">${facts}</span><br><br>Der Gegner bietet die Kapitulation an. Sieg annehmen?`;
    $('offerYes').textContent = 'Sieg annehmen';
    $('offerNo').textContent = 'Weiterspielen';
    $('offerYes').onclick = () => { closeModals(); S.over = 'win'; S.overReason = 'capitulation'; saveGame(); showGameOver(); };
  }
  $('offerNo').onclick = () => { closeModals(); saveGame(); };
  Sfx.play(low ? 'lost' : 'capture');
  openModal('mOffer');
}

function showGameOver() {
  $('overTitle').textContent = S.over === 'win' ? 'Sieg!' : 'Niederlage';
  $('overText').textContent = S.over === 'win'
    ? (S.overReason === 'capitulation' ? `Der Gegner hat in Runde ${S.turn} vor deiner Übermacht kapituliert.` : `Du hast die Welt in ${S.turn} Runden erobert.`)
    : (S.overReason === 'surrender' ? `Du hast in Runde ${S.turn} aufgegeben.` : `Der Gegner hat in Runde ${S.turn} alle deine Städte eingenommen.`);
  openModal('mOver');
  Sfx.play(S.over === 'win' ? 'victory' : 'defeat');
  refresh();
}

function startNew(size, diffKey) {
  if (!diffKey) { try { diffKey = localStorage.getItem('archipel-diff') || 'normal'; } catch (e) { diffKey = 'normal'; } }
  setTimeout(() => { logSeen = S.log[0] || null; updateLogHead(); }, 0);
  newGame(size, diffKey);
  sel = null; selCity = null; hover = null; updateHover();
  resizeCanvas();
  selectNext();
  const u = selUnit();
  if (u) centerOn(u.x, u.y, true);
  saveGame();
  refresh();
}

function afterLoad() {
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
  if (enemyPlaybackRunning()) { skipAnim(); return; }
  const [x, y] = tileFromEvent(e); onTileClick(x, y, e.shiftKey);
});
// ------------------------------------------------------------------ Karte ziehen
// Mittlere oder rechte Maustaste gedrückt halten und ziehen verschiebt die Karte
// 1:1 (ersetzt das beschleunigte Auto-Scrollen des Browsers). Ein kurzer
// Rechtsklick ohne Ziehen behält seine Funktion.
let drag = null;
const DRAG_THRESHOLD = 4;
function rightClickAction() {
  if (patrolMode) { patrolUndo(); return; }
  sel = null; selCity = null; refresh();
}
cv.addEventListener('mousedown', e => {
  if (e.button !== 1 && e.button !== 2) return;
  e.preventDefault();                       // verhindert das Auto-Scrollen
  if (enemyPlaybackRunning()) skipAnim();
  cam.active = false;
  drag = { btn: e.button, x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop, moved: false };
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  if (!drag.moved) { drag.moved = true; cv.style.cursor = 'grabbing'; }
  wrap.scrollLeft = drag.sl - dx;
  wrap.scrollTop = drag.st - dy;
});
window.addEventListener('mouseup', e => {
  if (!drag || e.button !== drag.btn) return;
  const d = drag; drag = null;
  cv.style.cursor = '';
  if (d.btn === 2 && !d.moved) rightClickAction();
});
cv.addEventListener('contextmenu', e => e.preventDefault());

// Mausrad zoomt (zur Mausposition hin) statt zu scrollen.
// Touchpads liefern viele kleine Schritte; die werden aufsummiert.
let wheelAcc = 0;
wrap.addEventListener('wheel', e => {
  if (!S) return;
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
  wheelAcc += e.deltaY * unit;
  if (Math.abs(wheelAcc) < 60) return;
  const dir = wheelAcc < 0 ? 1 : -1;
  wheelAcc = 0;
  const r = wrap.getBoundingClientRect();
  setZoom(TS + dir * 4, e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
cv.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
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
  $('logNew').textContent = !logOpen && n ? n + ' neu' : '';
  const l = S.log[0], last = $('logLast');
  if (l) {
    last.innerHTML = `<span class="t">R${l.t}</span><span class="${l.cls}">${esc(l.text)}</span>`;
    if (l.x != null) { last.dataset.x = l.x; last.dataset.y = l.y; } else { delete last.dataset.x; delete last.dataset.y; }
    last.title = l.text;
  } else last.innerHTML = '<span class="muted">Keine Meldungen</span>';
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
  if (autoEndAt) { if (e.key === 'Enter') { e.preventDefault(); endHumanTurn(); } else cancelAutoEnd(); return; }
  if (enemyPlaybackRunning() && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); skipAnim(); return; }
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const modalOpen = [...document.querySelectorAll('.modal')].some(m => !m.hidden);
  if (modalOpen) { if (e.key === 'Escape') closeModals(); return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
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
    case 'h': case '?': openModal('mHelp'); break;
    case 'm': toggleSound(); break;
    case 'k': openSoundTest(); break;
    case 'i': openStats(); break;
  }
});

$('endTurn').onclick = endHumanTurn;
$('nextUnit').onclick = actNext;
$('autoEndChk').checked = autoEnd;
$('autoEndChk').onchange = e => {
  autoEnd = e.target.checked;
  try { localStorage.setItem('archipel-autoend', autoEnd ? '1' : '0'); } catch (err) {}
  if (!autoEnd) cancelAutoEnd();
};
$('bNew').onclick = () => openModal('mNew');
$('bStart').onclick = () => {
  try { localStorage.setItem('archipel-diff', $('diffSel').value); localStorage.setItem('archipel-size', $('sizeSel').value); } catch (e) {}
  closeModals(); startNew($('sizeSel').value, $('diffSel').value);
};
$('diffSel').onchange = () => { $('diffDesc').textContent = DIFFICULTY[$('diffSel').value].desc; };
$('bOverNew').onclick = () => { closeModals(); openModal('mNew'); };
$('bHelp').onclick = () => openModal('mHelp');

function updateSoundUi() {
  $('bSound').textContent = Sfx.isMuted() ? '🔇' : '🔊';
  $('bSound').title = Sfx.isMuted() ? 'Ton einschalten (M)' : 'Ton ausschalten (M)';
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
  const myCities = S.cities.filter(c => c.owner === 0).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const myUnits = S.units.filter(u => u.owner === 0);
  const known = S.players[0].knownOwner;
  const enemyC = S.cities.filter(c => known[c.id] === 1).length;
  const neutralC = S.cities.filter(c => known[c.id] === -1).length;
  const idle = myCities.filter(c => !c.prod).length;
  const box = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  $('statSummary').innerHTML = box(diff().label, 'Schwierigkeit') + box(S.turn, 'Runde') + box(myCities.length, 'Deine Städte') + box(myUnits.length, 'Deine Einheiten')
    + box(enemyC, 'Bekannte Feindstädte') + box(neutralC, 'Bekannte neutrale') + box(S.cities.length, 'Städte insgesamt')
    + (idle ? box(idle, 'Städte ohne Produktion') : '');

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
    const detail = [aboard ? `${aboard} an Bord` : '', sentry ? `${sentry} Wache` : '', patrol ? `${patrol} Patrouille` : ''].filter(Boolean).join(', ');
    return `<tr><td><span class="sym">${t.sym}</span>${t.name}</td>
      <td class="num ${list.length ? '' : 'zero'}">${list.length}</td>
      <td class="num muted">${detail || '–'}</td>
      <td class="num ${builders.length ? '' : 'zero'}">${builders.length}</td>
      <td class="num ${next == null ? 'zero' : ''}">${next == null ? '–' : next + (next === 1 ? ' Runde' : ' Runden')}</td></tr>`;
  }).join('') + `<tr><td><b>Gesamt</b></td><td class="num"><b>${total[0]}</b></td><td></td><td class="num"><b>${total[1]}</b></td><td></td></tr>`;

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
    return `<tr><td><button class="citylink" data-city="${c.id}" title="Zur Stadt springen">${esc(c.name)}</button>${c.coastal ? ' <span class="muted" style="font-size:12px">Hafen</span>' : ''}</td>
      <td><select data-prod="${c.id}">${opts}</select></td>
      <td class="num">${p ? (p.cost - c.progress) + (p.cost - c.progress === 1 ? ' Runde' : ' Runden') : '–'}</td>
      <td class="num muted">${inCity || '–'}</td></tr>`;
  }).join('') || '<tr><td colspan="4" class="muted">Du hast keine Städte mehr.</td></tr>';
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
const FX_NAMES = { select: 'Auswahl', tick: 'Klick', error: 'Ungültig', boom: 'Explosion', lost: 'Einheit verloren', capture: 'Stadt erobert',
  cityLost: 'Stadt verloren', built: 'Einheit fertig', clank: 'Ein-/Ausladen', endTurn: 'Rundenende', alarm: 'Feindkontakt', victory: 'Sieg', defeat: 'Niederlage' };

function renderSoundTest() {
  const pv = Sfx.previewing();
  $('sndRows').innerHTML = Sfx.kinds().map(k => `<tr>
    <td>${k.name}</td>
    <td><button data-loop="${k.kind}" class="${pv === k.kind ? 'on' : ''}">${pv === k.kind ? '■ Stopp' : '▶ Schleife'}</button>
        <button data-move="${k.kind}">▶ Zug</button></td>
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
const SIZE_NAME = { klein: 'klein', mittel: 'mittel', gross: 'groß' };
function fmtDate(t) {
  const d = new Date(t);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
function slotDesc(m) {
  m = { ...m, turn: Math.trunc(Number(m.turn)) || 0, cities: Math.trunc(Number(m.cities)) || 0, units: Math.trunc(Number(m.units)) || 0,
    size: SIZE_NAME[m.size] ? m.size : '', over: ['win', 'lose'].includes(m.over) ? m.over : null };
  const end = m.over === 'win' ? ' · gewonnen' : m.over === 'lose' ? ' · verloren' : '';
  const dl = m.difficulty && DIFFICULTY[m.difficulty] ? ' · ' + DIFFICULTY[m.difficulty].label : '';
  return `Runde ${m.turn} · ${plural(m.cities, 'Stadt', 'Städte')} · ${plural(m.units, 'Einheit', 'Einheiten')} · Karte ${SIZE_NAME[m.size] || '?'}${dl}${end}`;
}
function renderSaves() {
  const slots = listSlots();
  let rows = '';
  try {
    const j = localStorage.getItem(SAVE_KEY);
    if (j) {
      const o = JSON.parse(j);
      const m = { turn: o.turn, size: o.size, cities: o.cities.filter(c => c.owner === 0).length, units: o.units.filter(u => u.owner === 0).length, over: o.over, difficulty: o.difficulty };
      rows += `<tr class="auto"><td>Automatisch (letzte Runde)</td><td class="muted">${slotDesc(m)}</td><td class="muted">laufend</td>
        <td class="acts"><button data-load="auto">Laden</button><button data-export="auto" title="Als Datei herunterladen">Export</button></td></tr>`;
    }
  } catch (e) {}
  rows += slots.map(m => `<tr><td>${esc(m.name)}</td><td class="muted">${slotDesc(m)}</td><td class="muted">${fmtDate(m.date)}</td>
    <td class="acts"><button data-load="${m.id}">Laden</button><button data-over="${m.id}" title="Mit dem aktuellen Spiel überschreiben">Überschreiben</button><button data-export="${m.id}" title="Als Datei herunterladen">Export</button><button data-del="${m.id}" class="danger" title="Löschen">✕</button></td></tr>`).join('');
  $('saveRows').innerHTML = rows || '<tr><td colspan="4" class="muted">Noch keine Spielstände.</td></tr>';
  let used = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('archipel')) used += (localStorage.getItem(k) || '').length; } } catch (e) {}
  $('saveInfo').textContent = `${slots.length} gespeicherte Spielstände · belegt etwa ${(used * 2 / 1024 / 1024).toFixed(1)} MB von ca. 5 MB Browserspeicher. Export sichert einen Spielstand als Datei (z. B. für einen anderen Browser oder Rechner).`;
}
function openSaves() {
  if (!S) return;
  $('saveName').value = `Runde ${S.turn} – ${plural(S.cities.filter(c => c.owner === 0).length, 'Stadt', 'Städte')}`;
  renderSaves(); openModal('mSaves');
  setTimeout(() => { $('saveName').focus(); $('saveName').select(); }, 30);
}
function trySave(name, id) {
  try { saveSlot(name, id); toast('Spiel gespeichert'); Sfx.play('select'); renderSaves(); return true; }
  catch (e) { toast('Speicher voll – bitte alte Spielstände löschen oder exportieren'); Sfx.play('error'); return false; }
}
function afterSlotLoad(msg) {
  closeModals(); patrolMode = null; autoEndAt = 0;
  afterLoad(); saveGame();
  toast(msg); Sfx.play('select');
  if (S.over) showGameOver();
}
$('bSaves').onclick = openSaves;
$('saveNew').onclick = () => trySave($('saveName').value.trim() || `Runde ${S.turn}`);
$('saveName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('saveNew').click(); } });
$('mSaves').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.load) {
    const ok = d.load === 'auto' ? loadGame() : (() => { try { return loadSlot(d.load); } catch (err) { return false; } })();
    if (ok) afterSlotLoad('Spielstand geladen'); else { toast('Laden fehlgeschlagen'); Sfx.play('error'); }
  } else if (d.over) {
    const m = listSlots().find(x => x.id === d.over);
    if (m && confirm(`„${m.name}“ mit dem aktuellen Spiel (Runde ${S.turn}) überschreiben?`)) trySave(m.name, m.id);
  } else if (d.del) {
    const m = listSlots().find(x => x.id === d.del);
    if (m && confirm(`Spielstand „${m.name}“ endgültig löschen?`)) { deleteSlot(m.id); renderSaves(); toast('Gelöscht'); }
  } else if (d.export) {
    const data = slotData(d.export);
    if (!data) return;
    const m = d.export === 'auto' ? { name: 'automatisch' } : listSlots().find(x => x.id === d.export);
    const turn = (() => { try { return JSON.parse(data).turn; } catch (err) { return ''; } })();
    const fname = ('archipel-' + (m ? m.name : 'spielstand') + '-R' + turn).replace(/[^\w\-äöüÄÖÜß]+/g, '_') + '.json';
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
    afterSlotLoad('Spielstand aus Datei geladen');
  } catch (err) { toast('Datei ist kein gültiger Spielstand'); Sfx.play('error'); }
};
$('saveImport').onclick = () => importPick.click();
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModals);
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModals(); }));

// ------------------------------------------------------------------ Start
(function init() {
  let prefSize = 'mittel', prefDiff = 'normal';
  try { prefSize = localStorage.getItem('archipel-size') || 'mittel'; prefDiff = localStorage.getItem('archipel-diff') || 'normal'; } catch (e) {}
  $('sizeSel').innerHTML = Object.entries(MAP_SIZES).map(([k, v]) => `<option value="${k}" ${k === prefSize ? 'selected' : ''}>${v.label}</option>`).join('');
  $('diffSel').innerHTML = Object.entries(DIFFICULTY).map(([k, v]) => `<option value="${k}" ${k === prefDiff ? 'selected' : ''}>${v.label}</option>`).join('');
  $('diffDesc').textContent = DIFFICULTY[$('diffSel').value].desc;
  $('diffTable').innerHTML = Object.values(DIFFICULTY).map(d => {
    const you = d.youStart.map(t => '+1 ' + UT[t].name);
    const ai = [...d.aiStart.map(t => '+1 ' + UT[t].name), ...(d.aiCities ? ['+' + d.aiCities + ' Stadt'] : [])];
    const start = [you.length ? 'du: ' + you.join(', ') : '', ai.length ? 'Gegner: ' + ai.join(', ') : ''].filter(Boolean).join('; ') || 'gleich';
    return `<tr><td><b>${d.label}</b></td><td>${d.aiKnowsMap ? 'ja' : 'nein, erkundet'}</td><td>${Math.round(d.aiMistake * 100)} %</td>
      <td>${Math.round(d.aiProd * 100)} %</td><td>${d.invadeAt} Truppen</td><td>${start}</td></tr>`;
  }).join('');
  $('unitTable').innerHTML = UNIT_ORDER.map(k => {
    const t = UT[k];
    const extra = [t.capture ? 'erobert Städte' : '', t.noRepair ? 'wird nicht repariert' : '', t.carries ? `trägt ${t.capacity} ${t.carries === 'land' ? 'Bodentruppen' : 'Jäger'}` : '',
      t.fuel ? `${t.fuel} Treibstoff` : '', t.str === 0 ? 'unbewaffnet' : ''].filter(Boolean).join(', ');
    return `<tr><td>${t.sym} ${t.name}</td><td>${t.move}</td><td>${t.hp}</td><td>${t.str}</td><td>${t.cost}</td><td>${extra}</td></tr>`;
  }).join('');
  try { const z = +localStorage.getItem('archipel-zoom'); if (z >= 14 && z <= 48) TS = z; } catch (e) {}
  if (loadGame()) { afterLoad(); addLog('Spielstand fortgesetzt.'); refresh(); }
  else { startNew('mittel'); openModal('mHelp'); }
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => renderMini());
})();
