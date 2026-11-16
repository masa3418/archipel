'use strict';
// ---------------------------------------------------------------------------
// Computergegner: taktische Regeln je Einheit (keine übergreifende Strategie).
//
// Wissen: Auf Leicht/Normal kennt der Gegner nur, was seine Einheiten und
// Städte gesehen haben, und muss die Karte erkunden. Auf Schwer/Brutal kennt
// er die ganze Karte. Feindliche Einheiten sieht er immer nur in Sichtweite.
//
// Fehler: Auf Leicht/Normal „vergisst“ er gelegentlich Einheiten, schätzt
// Angriffe falsch ein oder baut Unpassendes (siehe DIFFICULTY.aiMistake).
// ---------------------------------------------------------------------------

// ------------------------------------------------------------------ Wissen
const seenBy = (p, i) => aiKnowsMap(p) || S.players[p].seen[i] === 1;
// bekannter Besitzer einer Stadt: -2 = Stadt noch nie gesehen
const knownOwnerOf = (p, c) => (aiKnowsMap(p) ? c.owner : S.players[p].knownOwner[c.id]);
const isTarget = (p, c) => { const o = knownOwnerOf(p, c); return o !== p && o !== -2; };
const knownTargets = p => S.cities.filter(c => isTarget(p, c));

function contTargets(p) {
  const s = new Set();
  for (const c of knownTargets(p)) s.add(S.cont[idx(c.x, c.y)]);
  return s;
}

// Anteil der Karte, den p noch nicht gesehen hat
function unexplored(p) {
  if (aiKnowsMap(p)) return 0;
  const seen = S.players[p].seen;
  let n = 0;
  for (let i = 0; i < seen.length; i++) if (!seen[i]) n++;
  return n / seen.length;
}

// Gibt es auf diesem Kontinent noch Land am Rand des Nebels?
function contHasFrontier(p, cont) {
  if (aiKnowsMap(p)) return false;
  const seen = S.players[p].seen;
  for (let i = 0; i < seen.length; i++) {
    if (!seen[i] || S.terrain[i] !== 1 || S.cont[i] !== cont) continue;
    const x = i % S.W, y = (i / S.W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (inb(nx, ny) && !seen[idx(nx, ny)]) return true;
    }
  }
  return false;
}

// Weg zum nächsten unerforschten Feld (Ziel: erstes unbekanntes Feld)
function pathToFog(u, maxDist = 40, extraGoal = null) {
  if (!extraGoal) return explorePath(u, maxDist);
  const p = u.owner, seen = S.players[p].seen;
  const pass = makePassable(u, false);
  return bfs(u.x, u.y, pass, (x, y, i) => !seen[i] && (!extraGoal || extraGoal(x, y, i)), maxDist);
}

// ------------------------------------------------------------------ Fehler
const mistake = p => rng() < aiMistake(p);

// ------------------------------------------------------------------ Produktion
function aiChooseProduction(c) {
  const p = c.owner;
  const targets = contTargets(p);
  const here = S.cont[idx(c.x, c.y)];
  const mine = S.units.filter(u => u.owner === p);
  const cnt = t => mine.filter(u => u.type === t).length;
  const ncity = S.cities.filter(o => o.owner === p).length;
  const knows = aiKnowsMap(p);
  let prod;
  const landHere = mine.filter(u => T(u).domain === 'land' && u.carrier == null && S.cont[idx(u.x, u.y)] === here).length;
  const targetsHere = knownTargets(p).filter(o => S.cont[idx(o.x, o.y)] === here).length;
  const scouts = cnt('dst') + cnt('ftr');
  const fog = unexplored(p);
  if (targets.has(here) && landHere < targetsHere * 3 + 4) {
    prod = rng() < 0.25 && ncity > 2 ? 'tank' : 'inf';
  } else if (targets.has(here)) {
    prod = c.coastal ? (rng() < 0.5 ? 'dst' : 'crs') : 'ftr';
  } else if (!knows && contHasFrontier(p, here) && landHere < 3) {
    prod = 'inf';                                   // eigenen Kontinent zu Fuß erkunden
  } else if (!knows && fog > 0.3 && scouts < 1 + Math.floor(ncity / 5)) {
    prod = c.coastal ? 'dst' : 'ftr';               // Späher für fremde Inseln
  } else if (c.coastal) {
    const land = mine.filter(u => T(u).domain === 'land').length;
    if (cnt('trn') < Math.max(1, Math.ceil(ncity / 4))) prod = 'trn';
    else if (land < cnt('trn') * 5) prod = rng() < 0.3 ? 'tank' : 'inf';
    else {
      prod = counterPick(p);
    }
  } else {
    prod = rng() < 0.6 ? 'inf' : 'ftr';
  }
  // Fehler: etwas Beliebiges bauen
  if (mistake(p)) {
    const opts = UNIT_ORDER.filter(k => c.coastal || UT[k].domain !== 'sea');
    prod = opts[Math.floor(rng() * opts.length)];
  }
  if (c.prod !== prod) { c.prod = prod; c.progress = 0; }
}

// Flottenmix nach gesichteten Feindtypen: viele große Schiffe -> mehr U-Boote,
// viele U-Boote -> mehr Zerstörer und Jäger
function enemySeen(p) {
  const n = {}, intel = S.players[p].intel || {};
  for (const id in intel) n[intel[id]] = (n[intel[id]] || 0) + 1;
  return n;
}
function counterPick(p) {
  const e = enemySeen(p), big = (e.bat || 0) + (e.crs || 0) + (e.car || 0);
  const w = { dst: 0.3 + 0.08 * (e.sub || 0), ftr: 0.18 + 0.04 * (e.sub || 0) + 0.03 * (e.trn || 0),
    sub: 0.14 + 0.07 * big, crs: 0.23, bat: 0.15 };
  let sum = 0; for (const k in w) sum += w[k];
  let r = rng() * sum;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'dst';
}

// Bedrohungskarte: Felder, auf denen u wahrscheinlich (≥ 60 %) von einem
// sichtbaren Gegner geschlagen würde, wenn dieser angreift
let threatCache = new Map();
function threatMap(u) {
  const key = u.owner + '|' + u.type + '|' + u.hp;
  if (threatCache.has(key)) return threatCache.get(key);
  const P = S.players[u.owner], z = new Uint8Array(S.W * S.H);
  threatCache.set(key, z);
  for (const e of S.units) {
    if (e.owner === u.owner || e.carrier != null || !P.vis[idx(e.x, e.y)] || T(e).str === 0) continue;
    if (T(e).domain === 'land' && T(u).domain === 'sea') continue;   // Bodentruppen greifen keine Schiffe an
    const r = Math.max(1, T(e).move);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = e.x + dx, y = e.y + dy;
      if (!inb(x, y) || z[idx(x, y)]) continue;
      if (attackOdds(e, u, x, y) >= 0.6) z[idx(x, y)] = 1;
    }
  }
  return z;
}

// ------------------------------------------------------------------ Runde
function aiTurn(p = 1) {
  threatCache = new Map();
  for (const c of S.cities) if (c.owner === p && !c.prod) aiChooseProduction(c);
  const mine = S.units.filter(u => u.owner === p);
  for (const dom of ['sea', 'land', 'air']) {
    for (const u of mine) {
      if (S.over || !alive(u) || T(u).domain !== dom) continue;
      // Fehler: Einheit diese Runde „vergessen“ (Jäger nicht – die würden abstürzen)
      if (dom !== 'air' && rng() < aiMistake(p) * 0.5) continue;
      try {
        if (dom === 'land') aiLand(u);
        else if (dom === 'air') aiFighter(u);
        else if (u.type === 'trn') aiTransport(u);
        else aiWarship(u);
      } catch (e) { console.error('KI-Fehler', e); }
      computeVision(p);
      checkGameOver();
    }
  }
}

// Stehen eigene Bodentruppen nahe dieser Stadt (an Land oder an Bord)? Nur dann
// lohnt es sich für Schiffe, die Verteidiger der Stadt zu beschießen.
function landingSupport(p, x, y) {
  return S.units.some(o => o.owner === p && T(o).domain === 'land' && cheb(o.x, o.y, x, y) <= 2);
}

// Bestes Angriffsziel auf einem Nachbarfeld (oder null)
function aiAdjTarget(u, minProb) {
  if (u.owner === 1) minProb = Math.min(0.95, minProb + diff().caution);
  // Fehler: Lage falsch einschätzen – mal zu wagemutig, mal zu zaghaft
  if (mistake(u.owner)) minProb = Math.max(0.05, Math.min(0.95, minProb + (rng() < 0.5 ? -0.25 : 0.3)));
  const P = S.players[u.owner], t = T(u);
  let best = null, bestScore = 0;
  for (const [dx, dy] of DIRS) {
    const nx = u.x + dx, ny = u.y + dy;
    if (!inb(nx, ny)) continue;
    const i = idx(nx, ny);
    const c = cityAt(nx, ny);
    const ens = P.vis[i] ? topUnitsAt(nx, ny).filter(o => o.owner !== u.owner) : [];
    let score = 0;
    if (ens.length) {
      if (t.str === 0) continue;
      const d = pickDefender(ens);
      const ship = t.domain === 'sea';
      if (ship && c && !landingSupport(u.owner, nx, ny)) continue;
      const pr = attackOdds(u, d, nx, ny);
      const need = c && !ship ? minProb - 0.15 : (T(d).str === 0 ? 0.2 : minProb);
      if (pr < need) continue;
      score = pr + (c && !ship ? 1 : 0) + cargoOf(d).length * 0.3 + T(d).cost / 40;
    } else if (c && c.owner !== u.owner && t.capture) {
      score = 2;
    }
    if (score > bestScore) { bestScore = score; best = [nx, ny]; }
  }
  return best;
}

function stepAlong(u, path) {
  if (!path || !path.length) return false;
  const r = moveStep(u, path[0][0], path[0][1]);
  return r.ok;
}

// Entfernungskarte über (bekanntes) Land zur nächsten bekannten fremden Stadt
let fieldCache = { key: '', d: null };
function landField(p) {
  const knows = aiKnowsMap(p), seen = S.players[p].seen;
  let seenN = 0;
  if (!knows) for (let i = 0; i < seen.length; i++) seenN += seen[i];
  const key = p + ':' + S.turn + ':' + seenN + ':' + S.cities.map(c => knownOwnerOf(p, c)).join(',');
  if (fieldCache.key === key) return fieldCache.d;
  const N = S.W * S.H, d = new Int16Array(N).fill(-1), q = [];
  for (const c of knownTargets(p)) { const i = idx(c.x, c.y); d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % S.W, cy = (cur / S.W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inb(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (d[ni] !== -1 || S.terrain[ni] !== 1 || !(knows || seen[ni])) continue;
      d[ni] = d[cur] + 1; q.push(ni);
    }
  }
  fieldCache = { key, d };
  return d;
}

// ------------------------------------------------------------------ Bodentruppen
function aiLand(u) {
  let guard = 8;
  while (alive(u) && u.moves > 0 && u.carrier == null && guard-- > 0) {
    const adj = aiAdjTarget(u, 0.45);
    if (adj) { moveStep(u, adj[0], adj[1]); continue; }
    const F = landField(u.owner);
    const here = F[idx(u.x, u.y)];
    if (here > 0) {
      let best = null, bs = 1e9;
      for (const [dx, dy] of DIRS) {
        const nx = u.x + dx, ny = u.y + dy;
        if (!inb(nx, ny)) continue;
        const f = F[idx(nx, ny)];
        if (f < 0 || f > here) continue;
        const c = cityAt(nx, ny);
        const occ = topUnitsAt(nx, ny);
        if (occ.some(o => o.owner !== u.owner)) continue;
        if (occ.length && !(c && c.owner === u.owner)) continue;
        const s = f + rng() * 0.9 + (f === here ? 0.6 : 0);
        if (s < bs) { bs = s; best = [nx, ny]; }
      }
      if (!best) break;
      if (!moveStep(u, best[0], best[1]).ok) break;
      continue;
    }
    // kein bekanntes Ziel erreichbar: eigenen Kontinent erkunden
    if (!aiKnowsMap(u.owner)) {
      const fog = pathToFog(u, 40);
      if (fog && fog.length) { if (!stepAlong(u, fog)) break; continue; }
    }
    // Kontinent erobert/erkundet: zum Hafen gehen und auf Transport warten
    for (const [dx, dy] of DIRS) {
      const nx = u.x + dx, ny = u.y + dy;
      if (!inb(nx, ny)) continue;
      const tr = topUnitsAt(nx, ny).find(o => o.owner === u.owner && o.type === 'trn' && cargoOf(o).length < T(o).capacity);
      if (tr) { moveStep(u, nx, ny); return; }
    }
    const hc = cityAt(u.x, u.y);
    if (hc && hc.owner === u.owner && hc.coastal) return;
    const port = bfs(u.x, u.y, makePassable(u, aiKnowsMap(u.owner)), (x, y) => { const c = cityAt(x, y); return !!(c && c.owner === u.owner && c.coastal); });
    if (!port || !stepAlong(u, port)) break;
  }
}

function waitingLand(p, targets) {
  return S.units.filter(o => o.owner === p && T(o).domain === 'land' && o.carrier == null &&
    !targets.has(S.cont[idx(o.x, o.y)]) && (() => { const c = cityAt(o.x, o.y); return c && c.owner === p && c.coastal; })());
}

// ------------------------------------------------------------------ Transporter
function aiTransport(u) {
  let guard = 12;
  const cap = T(u).capacity, p = u.owner;
  while (alive(u) && u.moves > 0 && guard-- > 0) {
    const targets = contTargets(p);
    const c = cityAt(u.x, u.y);
    if (c && c.owner === p && !targets.has(S.cont[idx(u.x, u.y)])) loadUnits(u);
    let cargo = cargoOf(u);
    // Ausladen, wenn neben (bekanntem) Land mit Zielen
    if (cargo.length) {
      const tgts = knownTargets(p);
      let did = false;
      for (const o of cargo) {
        if (o.moves <= 0) continue;
        let bestN = null, bestD = 1e9;
        for (const [dx, dy] of DIRS) {
          const nx = u.x + dx, ny = u.y + dy;
          if (!inb(nx, ny)) continue;
          const ni = idx(nx, ny);
          if (S.terrain[ni] !== 1 || !seenBy(p, ni) || !targets.has(S.cont[ni])) continue;
          const cc = cityAt(nx, ny);
          const occ = topUnitsAt(nx, ny);
          if (occ.some(x => x.owner === p) && !(cc && cc.owner === p)) continue;
          let d = 1e9;
          for (const tc of tgts) d = Math.min(d, cheb(nx, ny, tc.x, tc.y));
          if (cc && isTarget(p, cc)) d = -1;
          if (d < bestD) { bestD = d; bestN = [nx, ny]; }
        }
        if (bestN) { const r = moveStep(o, bestN[0], bestN[1]); if (r.ok) did = true; }
      }
      if (did) continue;
    }
    cargo = cargoOf(u);
    const pass = makePassable(u, aiKnowsMap(p));
    const waiting = waitingLand(p, targets);
    let path = null;
    const goInvade = cargo.length >= Math.min(cap, p === 1 ? diff().invadeAt : 4) || (cargo.length > 0 && (!waiting.length || (u.wait || 0) >= 3));
    if (goInvade && targets.size) {
      path = bfs(u.x, u.y, pass, (x, y, i) => {
        if (!pass(x, y, i) || S.terrain[i] !== 0 || !seenBy(p, i)) return false;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (!inb(nx, ny)) continue;
          const ni = idx(nx, ny);
          if (S.terrain[ni] === 1 && seenBy(p, ni) && targets.has(S.cont[ni])) return true;
        }
        return false;
      });
    } else if (waiting.length && !(goInvade && !targets.size)) {
      const ws = new Set(waiting.map(o => idx(o.x, o.y)));
      if (ws.has(idx(u.x, u.y))) { u.wait = (u.wait || 0) + 1; break; }
      path = bfs(u.x, u.y, pass, (x, y, i) => ws.has(i));
    } else if (!(c && c.owner === p)) {
      // nichts zu tun (oder noch kein Ziel bekannt): im Hafen warten
      path = bfs(u.x, u.y, pass, (x, y) => { const cc = cityAt(x, y); return !!(cc && cc.owner === p && cc.coastal); });
    }
    if (!path || !stepAlong(u, path)) break;
    if (!(cityAt(u.x, u.y))) u.wait = 0;
  }
}

// ------------------------------------------------------------------ Kriegsschiffe
function aiWarship(u) {
  let guard = 10;
  const t = T(u), p = u.owner;
  while (alive(u) && u.moves > 0 && guard-- > 0) {
    const adj = aiAdjTarget(u, 0.55);
    if (adj) { moveStep(u, adj[0], adj[1]); continue; }
    const basePass = makePassable(u, aiKnowsMap(p));
    const threat = threatMap(u);
    // eigener Hafen ist sicher; sonst Felder meiden, auf denen ein überlegener Gegner zuschlagen kann
    const pass = (x, y, i) => basePass(x, y, i) && (!threat[i] || (cityAt(x, y) && cityAt(x, y).owner === p));
    const ownPort = (x, y) => { const c = cityAt(x, y); return !!(c && c.owner === p && c.coastal); };
    const here = cityAt(u.x, u.y);
    if (u.hp < t.hp * 0.5) {
      if (here && here.owner === p) break;
      const pp = bfs(u.x, u.y, pass, ownPort);
      if (!pp || !stepAlong(u, pp)) break;
      continue;
    }
    if (here && here.owner === p && u.hp < t.hp) break;
    // sichtbaren Gegner jagen
    let path = bfs(u.x, u.y, pass, (x, y, i) => {
      if (!pass(x, y, i)) return false;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const e = visibleEnemyAt(p, nx, ny);
        if (!e || (cityAt(nx, ny) && !landingSupport(p, nx, ny))) continue;
        if (attackOdds(u, e, nx, ny) >= 0.55) return true;
      }
      return false;
    }, 12);
    // Zerstörer sind Späher: erkunden, solange viel unbekannt ist
    const explorer = !aiKnowsMap(p) && (u.type === 'dst' ? unexplored(p) > 0.15 : knownTargets(p).every(c => !c.coastal));
    if (!path && explorer) {
      path = explorePath(u, 60);
      // das unbekannte Ziel selbst ist evtl. Land – ein Schritt dorthin scheitert dann, und das Feld ist danach bekannt
    }
    if (!path) {
      // Patrouille auf See vor einer bekannten fremden Küstenstadt (mit Abstand, nicht direkt vor dem Hafen)
      let tc = u.aiTarget != null ? S.cities[u.aiTarget] : null;
      if (!tc || !isTarget(p, tc) || cheb(u.x, u.y, tc.x, tc.y) <= 4) {
        const opts = knownTargets(p).filter(c => c.coastal);
        if (!opts.length) break;
        opts.sort((a, b) => cheb(u.x, u.y, a.x, a.y) - cheb(u.x, u.y, b.x, b.y));
        tc = opts[Math.floor(rng() * Math.min(4, opts.length))];
        u.aiTarget = tc.id;
      }
      path = bfs(u.x, u.y, pass, (x, y, i) => { const d = cheb(x, y, tc.x, tc.y); return pass(x, y, i) && S.terrain[i] === 0 && d >= 3 && d <= 4; });
      if (!path) { u.aiTarget = null; }
    }
    if (!path || !stepAlong(u, path)) break;
  }
}

// ------------------------------------------------------------------ Jäger
function distHome(p, x, y) {
  let d = 1e9;
  for (const c of S.cities) if (c.owner === p) d = Math.min(d, cheb(x, y, c.x, c.y));
  for (const o of S.units) if (o.owner === p && T(o).carries === 'air') d = Math.min(d, cheb(x, y, o.x, o.y));
  return d;
}

function aiFighter(u) {
  const t = T(u), p = u.owner;
  if (u.carrier != null) return;
  const home0 = distHome(p, u.x, u.y);
  const mustReturn = !isBase(u) && (u.fuel - t.move < home0 + t.move);
  let guard = 12;
  while (alive(u) && u.moves > 0 && guard-- > 0) {
    if (mustReturn) {
      if (isBase(u)) break;
      let best = null, bd = 1e9;
      for (const [dx, dy] of DIRS) {
        const nx = u.x + dx, ny = u.y + dy;
        if (!inb(nx, ny) || topUnitsAt(nx, ny).some(o => o.owner !== p)) continue;
        const c = cityAt(nx, ny);
        if (c && c.owner !== p) continue;
        const d = distHome(p, nx, ny);
        if (d < bd) { bd = d; best = [nx, ny]; }
      }
      if (!best || !moveStep(u, best[0], best[1]).ok) break;
      continue;
    }
    if (isBase(u) && u.hp < t.hp) break;
    const adj = aiAdjTarget(u, 0.6);
    if (adj && !cityAt(adj[0], adj[1])) { moveStep(u, adj[0], adj[1]); continue; }
    // Flugziel: bekannte fremde Stadt in Reichweite, sonst ein unerforschtes Feld
    const g = u.aiGoal;
    const seen = S.players[p].seen;
    const goalDone = !g || cheb(u.x, u.y, g[0], g[1]) <= 1 ||
      (g[2] === 'fog' && !aiKnowsMap(p) && seen[idx(g[0], g[1])]) ||
      (g[2] === 'city' && !isTarget(p, S.cities[g[3]]));
    if (goalDone) {
      u.aiGoal = null;
      const reach = t.fuel / 2;
      const opts = knownTargets(p).filter(c => cheb(u.x, u.y, c.x, c.y) <= reach);
      if (opts.length && (aiKnowsMap(p) || rng() < 0.5)) {
        const tc = opts[Math.floor(rng() * opts.length)];
        u.aiGoal = [tc.x, tc.y, 'city', tc.id];
      } else if (!aiKnowsMap(p)) {
        // nächstgelegene unbekannte Felder in Reichweite, eines davon zufällig
        const cand = [];
        for (let k = 0; k < 400; k++) {
          const x = u.x + Math.round((rng() * 2 - 1) * reach), y = u.y + Math.round((rng() * 2 - 1) * reach);
          if (inb(x, y) && !seen[idx(x, y)]) cand.push([x, y, cheb(u.x, u.y, x, y)]);
        }
        cand.sort((a, b) => a[2] - b[2]);
        const pick = cand[Math.floor(rng() * Math.min(5, cand.length))];
        if (pick) u.aiGoal = [pick[0], pick[1], 'fog'];
      }
      if (!u.aiGoal) break;
    }
    const [gx, gy] = u.aiGoal;
    const threat = threatMap(u);
    let best = null, bd = 1e9;
    for (const [dx, dy] of DIRS) {
      const nx = u.x + dx, ny = u.y + dy;
      if (!inb(nx, ny) || topUnitsAt(nx, ny).length) continue;
      const c = cityAt(nx, ny);
      if (c && c.owner !== p) continue;
      if (u.fuel - t.move < distHome(p, nx, ny)) continue;
      if (threat[idx(nx, ny)] && !(c && c.owner === p)) continue;
      const d = cheb(nx, ny, gx, gy) + rng() * 0.5;
      if (d < bd) { bd = d; best = [nx, ny]; }
    }
    if (!best || !moveStep(u, best[0], best[1]).ok) { u.aiGoal = null; break; }
  }
}
