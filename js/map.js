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

// nPlayers: Zahl der Startplätze (2 = du und ein Gegner; mehr bei mehreren Computergegnern). Bei 2 bleibt die Wahl wie früher,
// damit dieselbe Kartennummer dieselben Startplätze ergibt.
function generateMap(W, H, seed, worldKey = 'inseln', nPlayers = 2) {
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
  let landFrac = 0.37, fixedElev = null, massCount = 0;
  if (world.festland || world.binnen) {
    // Festland: Die ganze Karte ist eine Landmasse – schmaler Küstensaum am Rand, Binnenmeere und Flüsse.
    // Flüsse sind ein Feld breit; in Abständen macht ein Fluss einen Schritt über Eck. Dort berühren sich die Ufer an einer Ecke:
    // Bodentruppen kommen diagonal hinüber (Brücke, gezeichnet als Steg in gfx.js), Schiffe fahren darunter durch.
    const water = new Uint8Array(N);
    const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const nCoast = layer(5), nLake = layer(2.5);
    if (world.binnen) {
      // Binnenmeer: ein Meer in der Mitte (abgerundetes Rechteck mit unregelmäßigem Ufer), ringsum ein Landring gleicher Breite bis an den
      // Kartenrand; im Meer kleine Inseln mit Abstand zueinander und zum Ufer, damit das Meer überall befahrbar bleibt.
      const ring = Math.max(6, Math.round(Math.min(W, H) * (world.ring || 0.22)));
      const cx = (W - 1) / 2, cy = (H - 1) / 2, a = W / 2 - ring, b = H / 2 - ring;
      const sup = (x, y, da = 0) => Math.pow(Math.abs(x - cx) / Math.max(1, a - da), 3) + Math.pow(Math.abs(y - cy) / Math.max(1, b - da), 3);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sup(x, y) < 0.75 + nCoast(x, y) * 0.5) water[y * W + x] = 1;
      const isles = [], nIsl = Math.max(2, Math.round(a * b * 3.5 / (world.islArea || 150)));
      for (let k = 0; k < nIsl; k++) {
        const R = 1.4 + r() * 1.6, st = 0.7 + r() * 0.6, ang = r() * Math.PI;
        for (let t = 0; t < 80; t++) {
          const x = cx + (r() * 2 - 1) * a, y = cy + (r() * 2 - 1) * b;
          if (sup(x, y, R + 3) > 0.7 || isles.some(o => Math.hypot(o.x - x, o.y - y) < o.R + R + 3)) continue;
          isles.push({ x, y, R, st, c: Math.cos(ang), s: Math.sin(ang) });
          break;
        }
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const o of isles) {
        const dx = x - o.x, dy = y - o.y, u = dx * o.c + dy * o.s, w = -dx * o.s + dy * o.c;
        if (Math.hypot(u / o.st, w * o.st) < o.R * (0.75 + nLake(x, y) * 0.5)) water[y * W + x] = 0;
      }
    } else {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = Math.min(x, W - 1 - x, y, H - 1 - y);
      if (e < 1 + nCoast(x, y) * 2.4) water[y * W + x] = 1;
    }
    // Binnenmeere: elliptisch, mit unregelmäßigem Ufer, mit Abstand zueinander und zum Rand
    // Große Binnenmeere, damit Kreuzer und Schlachtschiffe an Landengen und Brücken mitreden; zwischen ihnen bleiben schmale
    // Landengen (Abstand LAKE_GAP) – die Engstellen der Karte
    const LAKE_GAP = Number(world.lakeGap) || 4;
    const lakes = [], nLakes = Math.max(3, Math.round(N / (world.lakeArea || 560)));
    for (let k = 0; k < nLakes; k++) {
      const R = (world.lakeR || 3.2) + r() * 3, st = 0.65 + r() * 0.7, ang = r() * Math.PI;
      for (let t = 0; t < 120; t++) {
        const x = 6 + r() * (W - 12), y = 6 + r() * (H - 12);
        if (lakes.some(o => Math.hypot(o.x - x, o.y - y) < o.R + R + LAKE_GAP)) continue;
        lakes.push({ x, y, R, st, c: Math.cos(ang), s: Math.sin(ang) });
        break;
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const o of lakes) {
      const dx = x - o.x, dy = y - o.y, u = dx * o.c + dy * o.s, w = -dx * o.s + dy * o.c;
      if (Math.hypot(u / o.st, w * o.st) < o.R * (0.75 + nLake(x, y) * 0.5)) water[y * W + x] = 1;
    }
    // Flüsse: vom See zum nächsten See oder zum Meer. Meist gerade Schritte, ab und zu ein Bogen; alle 2–4 Felder ein Schritt
    // über Eck (Brücke, alle 2–4 Felder). Endet, sobald er auf anderes Wasser trifft – ein Quellfluss (maxLen) auch nach maxLen Feldern
    // an Land bzw. am Zielpunkt.
    const river = (sx, sy, tx, ty, maxLen = 0) => {
      let x = Math.round(sx), y = Math.round(sy), left = false, since = 1, every = 2 + Math.floor(r() * 3), len = 0;
      let axis = Math.abs(tx - x) > Math.abs(ty - y) ? 0 : 1;
      for (let step = 0; step < W + H; step++) {
        if (maxLen && (len >= maxLen || (x === Math.round(tx) && y === Math.round(ty)))) return;
        if (left) len++;
        const ddx = Math.sign(Math.round(tx) - x), ddy = Math.sign(Math.round(ty) - y);
        let nx = x, ny = y;
        if (left && since >= every && ddx && ddy) { nx += ddx; ny += ddy; since = 0; every = 2 + Math.floor(r() * 3); }
        else {
          if (r() < 0.12) axis = 1 - axis;                                   // Bogen
          if (axis === 0 && !ddx) axis = 1; else if (axis === 1 && !ddy) axis = 0;
          if (axis === 0) nx += ddx || (r() < 0.5 ? 1 : -1); else ny += ddy || (r() < 0.5 ? 1 : -1);
          since++;
        }
        if (!inMap(nx, ny)) return;
        const j = ny * W + nx;
        if (water[j]) { if (left) return; }            // Ziel erreicht (anderes Wasser) – oder noch im eigenen See
        else left = true;
        water[j] = 1; x = nx; y = ny;
      }
    };
    // Jeder See bekommt einen Fluss – zum nächsten See eines anderen Netzes oder zum Meer. Jedes Netz aus Seen und Flüssen mündet
    // höchstens einmal ins Meer: Zwei Mündungen schnitten die Karte von Rand zu Rand durch, und an solchen Wassermauern mit wenigen
    // Brücken fuhren sich die Armeen fest (ein Angriff je Brücke und Runde gegen den Nachschub vieler Städte).
    const net = lakes.map((o, k) => k), sea = lakes.map(() => false);
    const root = k => (net[k] === k ? k : (net[k] = root(net[k])));
    lakes.forEach((o, k) => {
      const ed = [[o.x, 0], [o.x, H - 1], [0, o.y], [W - 1, o.y]].sort((a, b) => Math.hypot(a[0] - o.x, a[1] - o.y) - Math.hypot(b[0] - o.x, b[1] - o.y));
      const others = lakes.map((q, j) => j).filter(j => root(j) !== root(k))
        .filter(j => !(sea[root(j)] && sea[root(k)]))   // zwei Netze mit Mündung nicht verbinden
        .sort((a, b) => Math.hypot(lakes[a].x - o.x, lakes[a].y - o.y) - Math.hypot(lakes[b].x - o.x, lakes[b].y - o.y));
      if (!sea[root(k)] && (!others.length || r() < 0.45)) { river(o.x, o.y, ed[0][0], ed[0][1]); sea[root(k)] = true; }
      else if (others.length) {
        const j = others[0], s = sea[root(j)] || sea[root(k)];
        river(o.x, o.y, lakes[j].x, lakes[j].y);
        net[root(k)] = root(j); sea[root(j)] = s;
      }
    });
    // Quellflüsse: entspringen im Land und enden dort – sie geben der Karte Flüsse, ohne Wassermauern zu bilden
    lakes.forEach(o => {
      if (r() < 0.25) return;
      const ang = r() * Math.PI * 2, len = 6 + Math.floor(r() * 7);
      const tx = Math.max(3, Math.min(W - 4, o.x + Math.cos(ang) * (o.R + len))), ty = Math.max(3, Math.min(H - 4, o.y + Math.sin(ang) * (o.R + len)));
      river(o.x, o.y, tx, ty, len);
    });
    // Zusammenhang prüfen: Kleine abgeschnittene Landstücke werden Wasser; ist ein größeres Stück ohne Brücke abgetrennt, neuer Versuch
    const lab = new Int32Array(N).fill(-1), sizes = [];
    for (let i = 0; i < N; i++) {
      if (water[i] || lab[i] >= 0) continue;
      const id = sizes.length, q = [i]; lab[i] = id; let n = 0;
      while (q.length) {
        const c = q.pop(); n++;
        const cx = c % W, cy = (c / W) | 0;
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (!inMap(nx, ny)) continue;
          const j = ny * W + nx;
          if (!water[j] && lab[j] < 0) { lab[j] = id; q.push(j); }
        }
      }
      sizes.push(n);
    }
    const main = sizes.indexOf(Math.max(...sizes));
    for (let i = 0; i < N; i++) {
      if (water[i] || lab[i] === main) continue;
      if (sizes[lab[i]] > 12) return null;
      water[i] = 1;
    }
    // Keine Wassermauern: Ohne Brücken gerechnet (Nachbarschaft nur gerade, nicht über Eck) muss das größte zusammenhängende Gebiet
    // mindestens 80 % des Landes umfassen – sonst teilen Flüsse die Welt in Gebiete, die nur über Brücken verbunden sind
    {
      const l4 = new Int32Array(N).fill(-1); let best = 0, total = 0;
      for (let i = 0; i < N; i++) {
        if (water[i]) continue; total++;
        if (l4[i] >= 0) continue;
        const q = [i]; l4[i] = i; let n = 0;
        while (q.length) {
          const c = q.pop(); n++;
          const cx = c % W, cy = (c / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (!inMap(nx, ny)) continue;
            const j = ny * W + nx;
            if (!water[j] && l4[j] < 0) { l4[j] = i; q.push(j); }
          }
        }
        if (n > best) best = n;
      }
      if (best < total * 0.8) return null;
    }
    }   // Ende Festland (Seen, Flüsse, Zusammenhang)
    // Höhen: Rauschen, zum Wasser hin flacher; über die Rangfolge auf 0…1 verteilt (wenige Berge, viel Wald und Wiese)
    const base = Math.max(8, Math.round(Math.min(W, H) / 3.5));
    const hl = [[layer(base), 0.55], [layer(base / 2), 0.3], [layer(base / 4), 0.15]];
    const dist = new Uint8Array(N).fill(255), dq = [];
    for (let i = 0; i < N; i++) if (water[i]) { dist[i] = 0; dq.push(i); }
    for (let h = 0; h < dq.length; h++) {
      const c = dq[h], cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!inMap(nx, ny)) continue;
        const j = ny * W + nx;
        if (dist[j] === 255) { dist[j] = dist[c] + 1; dq.push(j); }
      }
    }
    const hv = new Float32Array(N), landIdx = [];
    let wc = 0;
    for (let i = 0; i < N; i++) {
      if (water[i]) { raw[i] = -1; wc++; continue; }
      const x = i % W, y = (i / W) | 0;
      let v = 0; for (const [f, wgt] of hl) v += f(x, y) * wgt;
      hv[i] = v * Math.min(1, 0.35 + dist[i] / 5);
      raw[i] = 1; landIdx.push(i);
    }
    landIdx.sort((a, b) => hv[a] - hv[b]);
    fixedElev = new Float32Array(N);
    // Rang → Höhe (Schwellen wie in gfx.js): ca. 6 % Ufer, 74 % Wiese und Wald, 11 % Hügel (> 0,56), 9 % Berge (> 0,68)
    const stops = [[0, 0.04], [0.06, 0.1], [0.8, 0.56], [0.91, 0.68], [1, 0.95]];
    landIdx.forEach((i, k) => {
      const q = k / Math.max(1, landIdx.length - 1);
      let s = 0; while (s < stops.length - 2 && q > stops[s + 1][0]) s++;
      const [q0, e0] = stops[s], [q1, e1] = stops[s + 1];
      fixedElev[i] = e0 + (e1 - e0) * (q - q0) / (q1 - q0);
    });
    landFrac = (N - wc + 0.5) / N;   // Schwelle fällt so genau zwischen Wasser (-1) und Land (1)
  } else {
    // Inselwelten: Inseln werden geplant (wenige große, einige mittlere, viele kleine)
    // und mit Abstand zueinander verteilt; Rauschen macht die Küsten unregelmäßig.
    landFrac = world.land;
    const A = W * H;
    // Gemischt (massLen): mehrere gleich große, mittelgroße Landmassen – ihre Zahl wächst mit der Kartengröße (eine je massLen Felder
    // Kantenlänge, mindestens minBig), zusammen tragen sie massShare des Landes; der Rest sind kleine Inseln
    const nBig = world.kont ? nPlayers : world.massLen ? Math.max(world.minBig, Math.round(Math.sqrt(A) / world.massLen)) : Math.max(2, Math.round(A / world.perBig));
    // Kontinente: feste Plätze je Spielerzahl (Anteile der Kartenbreite/-höhe) – zwei links und rechts (hochkant), drei im Dreieck, vier in den Ecken
    const SPOTS = { 2: [[0.22, 0.5], [0.78, 0.5]], 3: [[0.2, 0.34], [0.8, 0.34], [0.5, 0.72]], 4: [[0.23, 0.27], [0.77, 0.27], [0.23, 0.73], [0.77, 0.73]] }[nBig];
    const Rb = world.massLen ? Math.sqrt(world.massShare * landFrac * A / (nBig * Math.PI)) : Math.sqrt(A) * world.rBig;
    massCount = world.massLen ? nBig : 0;
    const plan = [];
    // Gemischt: gleich große Landmassen, damit die Startkontinente fair sind
    for (let k = 0; k < nBig; k++) plan.push(Rb * (world.massLen ? 0.98 + r() * 0.04 : 0.9 + r() * 0.25));
    let est = plan.reduce((s, q) => s + Math.PI * q * q, 0);
    for (let k = 0; est < A * landFrac * 1.15 && k < 400; k++) {
      const q = r() < world.mid ? Rb * (0.5 + r() * 0.25) : 1.2 + r() * Rb * world.small;
      plan.push(q); est += Math.PI * q * q;
    }
    const isl = [];
    // Jeder Kontinent besteht aus vier sich überlappenden Teilen (Wunsch des Nutzers: weniger kompakt) – das gibt Buchten und Halbinseln,
    // also mehr Küste, Häfen und Landeplätze. Die Teile tragen dieselbe Kennung g, damit die Trennung der Inseln (split) sie nicht zerschneidet.
    if (world.kont) for (let k = 0; k < nBig; k++) {
      const R = plan[k], cx = SPOTS[k][0] * W + (r() - 0.5) * 2, cy = SPOTS[k][1] * H + (r() - 0.5) * 2, a0 = r() * Math.PI * 2;
      for (let j = 0; j < 4; j++) {
        // zwei Spieler: Teile übereinander (hochkant), sonst im Kreis um die Mitte
        const dx = nBig === 2 ? (r() - 0.5) * R * 1.5 : Math.cos(a0 + j * 1.57) * R * (0.7 + r() * 0.35);
        const dy = nBig === 2 ? (j - 1.5) * R * (0.75 + r() * 0.15) : Math.sin(a0 + j * 1.57) * R * (0.7 + r() * 0.35);
        const Rl = R * (0.46 + r() * 0.14), st = 0.7 + r() * 0.6, ang = r() * Math.PI;
        isl.push({ x: cx + dx, y: cy + dy, R: Rl, st, ext: Rl * Math.max(st, 1 / st), c: Math.cos(ang), s: Math.sin(ang), g: k });
      }
    }
    for (const R of world.kont ? plan.slice(nBig) : plan) {
      // Landmassen (Gemischt) rundlicher und näher am Rand, damit auch auf der kleinen Karte drei mit Abstand Platz finden
      const mass = world.massLen && R >= Rb * 0.9;
      const st = mass ? 0.85 + r() * 0.3 : 0.75 + r() * 0.55, ext = R * Math.max(st, 1 / st);
      const edge = mass ? ext * 0.6 + 2 : ext + 2;
      const mx = Math.min(edge, W / 2 - 1), my = Math.min(edge, H / 2 - 1);
      for (let t = 0; t < 200; t++) {
        const x = mx + r() * (W - 2 * mx), y = my + r() * (H - 2 * my);
        if (isl.some(o => Math.hypot(o.x - x, o.y - y) < o.ext + ext + world.gap)) continue;
        const ang = r() * Math.PI;
        isl.push({ x, y, R, st, ext, c: Math.cos(ang), s: Math.sin(ang) });
        break;
      }
    }
    // Gemischt: Die Landmassen müssen alle Platz gefunden haben, sonst neuer Versuch
    if (world.massLen && !world.kont && isl.filter(o => o.R >= Rb * 0.9).length < nBig) return null;
    const n1 = layer(Math.max(3, Rb / 1.5)), n2 = layer(Math.max(2, Rb / 3.5)), n3 = layer(Math.max(1.5, Rb / 7));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = -1, best = -Infinity;
      for (let k = 0; k < isl.length; k++) {
        const o = isl[k];
        const dx = x - o.x, dy = y - o.y;
        const u = dx * o.c + dy * o.s, w = -dx * o.s + dy * o.c;
        const sc = 1 - Math.hypot(u / o.st, w * o.st) / o.R;
        if (sc > best) { best = sc; own[y * W + x] = o.g != null ? o.g : k; }
        if (Math.abs(dx) > o.ext * 1.6 + 2 || Math.abs(dy) > o.ext * 1.6 + 2) continue;
        v = Math.max(v, sc);
      }
      v += ((n1(x, y) - 0.5) * 0.8 + (n2(x, y) - 0.5) * 0.5 + (n3(x, y) - 0.5) * 0.2) * (world.kont ? 1.4 : 1);   // Kontinente: zerklüftetere Küsten
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
    // Der Kartenrand ist sonst immer Wasser; beim Binnenmeer reicht das Land bis an den Rand (ein Feld Wasser außen herum wäre ein
    // Graben ohne Verbindung zum Meer, an dem scheinbar Küstenstädte lägen – dem Nutzer aufgefallen)
    terrain[i] = (!border || world.binnen) && raw[i] > thr ? 1 : 0;
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
  for (let i = 0; i < N; i++) elev[i] = terrain[i] ? (fixedElev ? fixedElev[i] : elev[i] / maxE) : 0;

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
      if (terrain[ni] === 0 && water.sizes[water.lab[ni]] >= 25 && (!world.festland || openWater(nx, ny))) return true;
    }
    return false;
  };
  // Festland: Häfen nur an Seen und am Meer, nicht an einem schmalen Fluss (sonst wäre jede Stadt ein Hafen und die KI baute
  // Flotten für Flüsse). Offenes Wasser = Wasserfeld mit mindestens 5 Wasser-Nachbarn.
  function openWater(x, y) {
    let n = 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || terrain[ny * W + nx] === 0) n++;
    }
    return n >= 5;
  }

  // Städte
  const landTiles = [];
  let landCount = 0;
  for (let i = 0; i < N; i++) if (terrain[i]) { landCount++; landTiles.push(i); }
  // je 15 Landfelder eine Stadt – auf dem Festland (fast alles Land) gedeckelt, sonst würden es doppelt so viele wie in den Inselwelten
  const target = Math.round(Math.min(landCount, N * 0.36) / 15);
  const cand = landTiles.map(i => {
    const x = i % W, y = (i / W) | 0;
    return { i, x, y, coastal: isOceanAdj(x, y), s: r() };
  });
  // Binnenmeer: keine Stadt direkt auf dem Kartenrand (dort ist sonst nie Land)
  if (world.binnen) cand.forEach(c => { if (c.x === 0 || c.y === 0 || c.x === W - 1 || c.y === H - 1) c.s = -1; });
  // Städte bevorzugt an der Küste – auf dem Festland nicht (dort läge sonst jede Stadt an einem See und wäre ein Hafen)
  if (!world.festland) cand.forEach(c => { if (c.coastal) c.s += 0.45; });
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
  // Gemischt: Start nur auf den Landmassen (den massCount größten), nicht auf einer kleinen Insel
  const masses = massCount ? [...perCont.entries()].sort((a, b) => b[1] - a[1]).slice(0, massCount).map(e => e[0]) : null;
  const eligible = cities.filter(c => c.coastal && perCont.get(land.lab[c.y * W + c.x]) >= 4 && (!masses || masses.includes(land.lab[c.y * W + c.x])));
  if (eligible.length < nPlayers) return null;
  if (nPlayers > 2) {
    const start = pickStarts(eligible, nPlayers, c => land.lab[c.y * W + c.x], k => perCont.get(k), Math.min(W, H));
    // Kontinente: jeder auf seinem eigenen – sonst nächste Karte
    if (start && world.kont && new Set(start.map(id => land.lab[cities[id].y * W + cities[id].x])).size < nPlayers) return null;
    return start ? { W, H, terrain, elev, depth, cont: land.lab, cities, start } : null;
  }
  let best = null, bestScore = -1;
  for (let a = 0; a < eligible.length; a++) for (let b = a + 1; b < eligible.length; b++) {
    const A = eligible[a], B = eligible[b];
    const ka = land.lab[A.y * W + A.x], kb = land.lab[B.y * W + B.x];
    if (world.kont && ka === kb) continue;   // Kontinente: nie zwei Spieler auf demselben (sonst gewann bei ungleich großen Kontinenten die Fairness-Regel)
    // weit auseinander, möglichst auf verschiedenen Inseln, und fair: ähnlich viele Städte auf beiden Startinseln
    let s = cheb(A.x, A.y, B.x, B.y) + (ka !== kb ? 20 : 0) - 3 * Math.abs(perCont.get(ka) - perCont.get(kb));
    if (s > bestScore) { bestScore = s; best = [A.id, B.id]; }
  }
  if (!best || cheb(cities[best[0]].x, cities[best[0]].y, cities[best[1]].x, cities[best[1]].y) < Math.min(W, H) / 2) return null;

  return { W, H, terrain, elev, depth, cont: land.lab, cities, start: best };
}

// Startplätze für 3 oder 4 Spieler (bei 2 gilt die Paarsuche oben): möglichst weit auseinander – es zählt der kleinste Abstand –,
// möglichst auf verschiedenen Inseln und fair (ähnlich viele Städte auf den Startinseln). Von jeder geeigneten Stadt aus wird mit
// dem Weitester-Punkt-Verfahren eine Auswahl gebildet und dann durch Tauschen einzelner Plätze verbessert; die beste gewinnt.
// Ohne Zufall – dieselbe Karte ergibt dieselben Plätze. null, wenn die Plätze zu eng lägen (dann versucht newGame die nächste Karte).
function pickStarts(el, n, contOf, citiesOf, minDim) {
  const score = set => {
    let md = 1e9, diffPairs = 0, pairs = 0, lo = 1e9, hi = 0;
    for (let i = 0; i < set.length; i++) {
      const a = el[set[i]], ka = contOf(a), na = citiesOf(ka);
      lo = Math.min(lo, na); hi = Math.max(hi, na);
      for (let j = i + 1; j < set.length; j++) {
        const b = el[set[j]];
        md = Math.min(md, cheb(a.x, a.y, b.x, b.y));
        pairs++; if (ka !== contOf(b)) diffPairs++;
      }
    }
    return { md, s: md + 20 * diffPairs / pairs - 3 * (hi - lo) };
  };
  let best = null, bestS = -1e9;
  for (let f = 0; f < el.length; f++) {
    const set = [f];
    while (set.length < n) {
      let pick = -1, pd = -1;
      for (let k = 0; k < el.length; k++) {
        if (set.includes(k)) continue;
        let d = 1e9;
        for (const s of set) d = Math.min(d, cheb(el[k].x, el[k].y, el[s].x, el[s].y));
        if (d > pd) { pd = d; pick = k; }
      }
      set.push(pick);
    }
    let cur = score(set).s;
    for (let improved = true, guard = 20; improved && guard > 0; guard--) {
      improved = false;
      for (let i = 0; i < n; i++) for (let k = 0; k < el.length; k++) {
        if (set.includes(k)) continue;
        const old = set[i]; set[i] = k;
        const sc = score(set).s;
        if (sc > cur + 1e-9) { cur = sc; improved = true; } else set[i] = old;
      }
    }
    if (cur > bestS) { bestS = cur; best = set.slice(); }
  }
  if (!best || score(best).md < minDim * (n === 3 ? 0.45 : 0.36)) return null;
  return best.map(i => el[i].id);
}
