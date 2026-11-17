'use strict';
// ---------------------------------------------------------------------------
// Kartengenerator: Inseln & Kontinente, Städte, Startpositionen
// ---------------------------------------------------------------------------

function makeNameGen(r) {
  const a = ['Bar', 'Kel', 'Mor', 'Tan', 'Vel', 'Dra', 'Ost', 'Lin', 'Hav', 'Sun', 'Rau', 'Fen', 'Gar', 'Hol',
    'Mar', 'Nor', 'Pel', 'Rho', 'Sal', 'Tor', 'Ul', 'Ves', 'Wen', 'Zar', 'Bre', 'Cor', 'Del', 'Eck', 'Fal', 'Grim',
    'Has', 'Ivo', 'Jor', 'Kast', 'Lor', 'Mel', 'Nev', 'Orm', 'Quel', 'Rod', 'Sten', 'Tal', 'Var', 'Wolm', 'Ald', 'Bel'];
  const m = ['', '', '', 'a', 'e', 'i', 'o', 'en', 'er', 'an', 'ul'];
  const e = ['heim', 'burg', 'port', 'stad', 'ia', 'ow', 'is', 'dorf', 'mund', 'feld', 'au', 'wik', 'holm', 'ar', 'ten', 'ka'];
  const used = new Set();
  return () => {
    for (let k = 0; k < 200; k++) {
      const n = a[Math.floor(r() * a.length)] + m[Math.floor(r() * m.length)] + e[Math.floor(r() * e.length)];
      if (!used.has(n)) { used.add(n); return n; }
    }
    return 'Stadt ' + used.size;
  };
}

function generateMap(W, H, seed, worldKey = 'inseln') {
  const world = WORLDS[worldKey] || WORLDS.inseln;
  const r = mulberry32(seed);
  const N = W * H;

  function layer(cell) {
    const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x, y) => {
      const fx = x / cell, fy = y / cell;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  const raw = new Float32Array(N);
  const own = new Int16Array(N).fill(-1);   // Inselwelten: geplante Insel, zu der das Feld gehört (höchster Wert 1 - d/R)
  let landFrac = 0.37;
  if (!world.rBig) {
    // Kontinente: großflächiges Rauschen, ergibt wenige riesige Landmassen
    const base = Math.max(8, Math.round(Math.min(W, H) / 3.5));
    const layers = [[layer(base), 0.6], [layer(base / 2), 0.28], [layer(base / 4), 0.14]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = 0;
      for (const [f, w] of layers) v += f(x, y) * w;
      const e = Math.min(x, W - 1 - x, y, H - 1 - y);
      const fall = Math.min(1, e / 5);
      v -= (1 - fall) * 0.45;
      raw[y * W + x] = v;
    }
  } else {
    // Inselwelten: Inseln werden geplant (wenige große, einige mittlere, viele kleine)
    // und mit Abstand zueinander verteilt; Rauschen macht die Küsten unregelmäßig.
    landFrac = world.land;
    const A = W * H, Rb = Math.sqrt(A) * world.rBig;
    const plan = [];
    const nBig = Math.max(2, Math.round(A / world.perBig));
    for (let k = 0; k < nBig; k++) plan.push(Rb * (0.9 + r() * 0.25));
    let est = plan.reduce((s, q) => s + Math.PI * q * q, 0);
    for (let k = 0; est < A * landFrac * 1.15 && k < 400; k++) {
      const q = r() < world.mid ? Rb * (0.5 + r() * 0.25) : 1.2 + r() * Rb * world.small;
      plan.push(q); est += Math.PI * q * q;
    }
    const isl = [];
    for (const R of plan) {
      const st = 0.75 + r() * 0.55, ext = R * Math.max(st, 1 / st);
      const mx = Math.min(ext + 2, W / 2 - 1), my = Math.min(ext + 2, H / 2 - 1);
      for (let t = 0; t < 200; t++) {
        const x = mx + r() * (W - 2 * mx), y = my + r() * (H - 2 * my);
        if (isl.some(o => Math.hypot(o.x - x, o.y - y) < o.ext + ext + world.gap)) continue;
        const ang = r() * Math.PI;
        isl.push({ x, y, R, st, ext, c: Math.cos(ang), s: Math.sin(ang) });
        break;
      }
    }
    const n1 = layer(Math.max(3, Rb / 1.5)), n2 = layer(Math.max(2, Rb / 3.5)), n3 = layer(Math.max(1.5, Rb / 7));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = -1, best = -Infinity;
      for (let k = 0; k < isl.length; k++) {
        const o = isl[k];
        const dx = x - o.x, dy = y - o.y;
        const u = dx * o.c + dy * o.s, w = -dx * o.s + dy * o.c;
        const sc = 1 - Math.hypot(u / o.st, w * o.st) / o.R;
        if (sc > best) { best = sc; own[y * W + x] = k; }
        if (Math.abs(dx) > o.ext * 1.6 + 2 || Math.abs(dy) > o.ext * 1.6 + 2) continue;
        v = Math.max(v, sc);
      }
      v += (n1(x, y) - 0.5) * 0.8 + (n2(x, y) - 0.5) * 0.5 + (n3(x, y) - 0.5) * 0.2;
      const e = Math.min(x, W - 1 - x, y, H - 1 - y);
      v -= (1 - Math.min(1, e / 3)) * 0.5;
      raw[y * W + x] = v;
    }
  }
  const sorted = Array.from(raw).sort((p, q) => p - q);
  const thr = sorted[Math.floor(N * (1 - landFrac))];

  const terrain = new Uint8Array(N);
  const elev = new Float32Array(N);
  let maxE = 0;
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
    terrain[i] = !border && raw[i] > thr ? 1 : 0;
    elev[i] = raw[i] - thr;
    if (elev[i] > maxE) maxE = elev[i];
  }
  if (world.split) {
    // Inselreich: Das Rauschen der Küsten darf geplante Inseln nicht zu großen zusammenwachsen lassen. Stoßen Felder
    // verschiedener Inseln aneinander (auch über Eck), wird das schwächere Wasser – es bleibt immer ein Kanal dazwischen.
    for (let changed = true, pass = 0; changed && pass < 6; pass++) {
      changed = false;
      for (let i = 0; i < N; i++) {
        if (!terrain[i]) continue;
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (!terrain[j] || own[j] === own[i]) continue;
          terrain[raw[i] < raw[j] ? i : j] = 0; changed = true;
          if (!terrain[i]) break;
        }
      }
    }
  }
  for (let i = 0; i < N; i++) elev[i] = terrain[i] ? elev[i] / maxE : 0;

  // Zusammenhängende Gebiete (8er-Nachbarschaft)
  function label(isType) {
    const lab = new Int16Array(N).fill(-1);
    const sizes = [];
    for (let i = 0; i < N; i++) {
      if (lab[i] !== -1 || !isType(i)) continue;
      const id = sizes.length; let size = 0;
      const q = [i]; lab[i] = id;
      while (q.length) {
        const c = q.pop(); size++;
        const cx = c % W, cy = (c / W) | 0;
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (lab[ni] === -1 && isType(ni)) { lab[ni] = id; q.push(ni); }
        }
      }
      sizes.push(size);
    }
    return { lab, sizes };
  }
  const land = label(i => terrain[i] === 1);
  const water = label(i => terrain[i] === 0);

  // Wassertiefe (Abstand zur Küste) für die Grafik
  const depth = new Uint8Array(N).fill(255);
  const dq = [];
  for (let i = 0; i < N; i++) if (terrain[i] === 1) { depth[i] = 0; dq.push(i); }
  for (let h = 0; h < dq.length; h++) {
    const c = dq[h], cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (depth[ni] === 255) { depth[ni] = Math.min(254, depth[c] + 1); dq.push(ni); }
    }
  }

  const isOceanAdj = (x, y) => {
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (terrain[ni] === 0 && water.sizes[water.lab[ni]] >= 25) return true;
    }
    return false;
  };

  // Städte
  const landTiles = [];
  let landCount = 0;
  for (let i = 0; i < N; i++) if (terrain[i]) { landCount++; landTiles.push(i); }
  const target = Math.round(landCount / 15);
  const cand = landTiles.map(i => {
    const x = i % W, y = (i / W) | 0;
    return { i, x, y, coastal: isOceanAdj(x, y), s: r() };
  });
  cand.forEach(c => { if (c.coastal) c.s += 0.45; });
  cand.sort((p, q) => q.s - p.s);
  const nameGen = makeNameGen(r);
  const cities = [];
  const taken = new Uint8Array(N);
  for (const c of cand) {
    if (cities.length >= target) break;
    let ok = true;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && taken[ny * W + nx]) { ok = false; break; }
    }
    if (!ok) continue;
    taken[c.i] = 1;
    cities.push({ id: cities.length, x: c.x, y: c.y, name: nameGen(), owner: -1, prod: null, progress: 0, coastal: c.coastal });
  }

  // Startstädte: auf Kontinenten mit mind. 4 Städten, möglichst weit auseinander
  const perCont = new Map();
  for (const c of cities) {
    const k = land.lab[c.y * W + c.x];
    perCont.set(k, (perCont.get(k) || 0) + 1);
  }
  const eligible = cities.filter(c => c.coastal && perCont.get(land.lab[c.y * W + c.x]) >= 4);
  if (eligible.length < 2) return null;
  let best = null, bestScore = -1;
  for (let a = 0; a < eligible.length; a++) for (let b = a + 1; b < eligible.length; b++) {
    const A = eligible[a], B = eligible[b];
    const ka = land.lab[A.y * W + A.x], kb = land.lab[B.y * W + B.x];
    // weit auseinander, möglichst auf verschiedenen Inseln, und fair: ähnlich viele Städte auf beiden Startinseln
    let s = cheb(A.x, A.y, B.x, B.y) + (ka !== kb ? 20 : 0) - 3 * Math.abs(perCont.get(ka) - perCont.get(kb));
    if (s > bestScore) { bestScore = s; best = [A.id, B.id]; }
  }
  if (!best || cheb(cities[best[0]].x, cities[best[0]].y, cities[best[1]].x, cities[best[1]].y) < Math.min(W, H) / 2) return null;

  return { W, H, terrain, elev, depth, cont: land.lab, cities, start: best };
}
