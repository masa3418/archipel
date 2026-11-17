'use strict';
// ---------------------------------------------------------------------------
// Spielregeln: Zustand, Bewegung, Kampf, Städte, Produktion, Sicht, Runden
// ---------------------------------------------------------------------------

let S = null; // gesamter Spielzustand

const T = u => UT[u.type];
const idx = (x, y) => y * S.W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < S.W && y < S.H;
const alive = u => S.units.includes(u);

function mkPlayer(W, H, nc) {
  return { seen: new Uint8Array(W * H), vis: new Uint8Array(W * H), sonar: new Uint8Array(W * H), knownOwner: new Int8Array(nc).fill(-2) };
}

// Kartennummer: Startwert des Kartengenerators (0 … SEED_MAX-1). Gleiche Nummer + Größe + Welt = gleiche Welt (Städte, Startplätze).
// Die KI würfelt davon unabhängig. Ändert sich der Generator in einer neuen Version, kann dieselbe Nummer eine andere Welt ergeben.
const SEED_MAX = 1e9;
// Eingabe → Kartennummer: Ziffern (Leerzeichen erlaubt) direkt, jeder andere Text über einen Hash; leer → null (zufällig)
function parseSeed(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  const digits = s.replace(/[\s.]/g, '');
  if (/^\d+$/.test(digits)) return Number(digits.slice(-9)) % SEED_MAX;
  let h = 2166136261;   // FNV-1a
  for (const ch of s.toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % SEED_MAX;
}
const fmtSeed = n => String(n).padStart(9, '0').replace(/(\d{3})(?=\d)/g, '$1 ');   // 042 113 907

function newGame(sizeKey, diffKey = 'normal', worldKey = 'inseln', seedIn = null) {
  const sz = MAP_SIZES[sizeKey] || MAP_SIZES.mittel;
  if (!WORLDS[worldKey]) worldKey = 'inseln';
  const seed0 = seedIn != null ? seedIn : Math.floor(Math.random() * SEED_MAX);
  let m = null, seed = seed0;
  for (let k = 0; !m && k < 200; k++) m = generateMap(sz.w, sz.h, seed + k, worldKey);
  S = {
    W: m.W, H: m.H, size: sizeKey, terrain: m.terrain, elev: m.elev, depth: m.depth, cont: m.cont,
    cities: m.cities, units: [], nextId: 1, turn: 1, cur: 0, log: [], over: null, difficulty: DIFFICULTY[diffKey] ? diffKey : 'normal', world: worldKey, seed: seed0,
    gameId: 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),   // Kennung der Partie (Spielstände gruppieren)
    players: [mkPlayer(m.W, m.H, m.cities.length), mkPlayer(m.W, m.H, m.cities.length)],
    kills: [{}, {}], wasted: [{}, {}], killsFrom: 1,   // Statistik: zerstörte Einheiten je Spieler und Typ, siehe killUnit
    built: [{}, {}], builtFrom: 1,                    // Statistik: in Städten gebaute Einheiten je Spieler und Typ (startTurn)
  };
  buildCityGrid();
  m.start.forEach((cid, p) => {
    const c = S.cities[cid];
    c.owner = p; c.prod = 'inf'; c.progress = 0;
    createUnit('inf', p, c.x, c.y);
    for (const t of p === 0 ? diff().youStart : diff().aiStart) createUnit(t, p, c.x, c.y);
  });
  // Brutal: Gegner beginnt mit zusätzlichen Städten (die nächstgelegenen neutralen)
  const aiHome = S.cities[m.start[1]];
  for (let k = 0; k < diff().aiCities; k++) {
    const near = S.cities.filter(c => c.owner === -1)
      .sort((a, b) => cheb(a.x, a.y, aiHome.x, aiHome.y) - cheb(b.x, b.y, aiHome.x, aiHome.y))[0];
    if (near) { near.owner = 1; near.prod = 'inf'; near.progress = 0; }
  }
  addLog(tt('Willkommen! Erobere alle Städte der Welt.', 'Welcome! Capture every city in the world.'), 'good');
  startTurn(0);
  computeVision(1);
}

function buildCityGrid() {
  S.cityGrid = new Int16Array(S.W * S.H).fill(-1);
  for (const c of S.cities) S.cityGrid[idx(c.x, c.y)] = c.id;
}

function cityAt(x, y) { const i = S.cityGrid[idx(x, y)]; return i >= 0 ? S.cities[i] : null; }
function topUnitsAt(x, y) { return S.units.filter(u => u.x === x && u.y === y && u.carrier == null); }
function cargoOf(u) { return S.units.filter(c => c.carrier === u.id); }
function unitById(id) { return S.units.find(u => u.id === id) || null; }

function createUnit(type, owner, x, y) {
  const t = UT[type];
  const u = { id: S.nextId++, type, owner, x, y, hp: t.hp, moves: t.move, fuel: t.fuel || 0, carrier: null, order: null, skip: false };
  S.units.push(u);
  return u;
}

// by: Spieler (0/1), der die Einheit zerstört hat – zählt in S.kills[by] für die Statistik; -1 = ohne Zutun eines
// Gegners verloren (Absturz, Angriff auf neutrale Stadt) – zählt in S.wasted[Besitzer]. Ohne Angabe wird nichts
// gezählt (Eroberer, der als Besatzung in der Stadt aufgeht). Ladung geht mit unter und zählt genauso.
function killUnit(u, by) {
  for (const c of cargoOf(u)) killUnit(c, by);
  const k = S.units.indexOf(u);
  if (k < 0) return;
  S.units.splice(k, 1);
  const rec = by == null ? null : by >= 0 ? S.kills && S.kills[by] : S.wasted && S.wasted[u.owner];
  if (rec) rec[u.type] = (rec[u.type] || 0) + 1;
}

// Produktion einer Stadt umstellen: Der Fortschritt beginnt neu, und das Marschziel (es galt für den alten Typ) entfällt.
function setProduction(c, type) {
  if (!UT[type] || c.prod === type) return false;
  c.prod = type; c.progress = 0; c.rally = null;
  return true;
}

// Marschziel einer Stadt (c.rally = [x, y], setzt nur der Mensch): Eine dort fertiggestellte Einheit bekommt sofort den
// Marschbefehl dorthin. rallyCheck prüft mit einer gedachten Einheit des Typs, ob das Ziel taugt – beim Setzen (ui.js)
// und noch einmal bei der Fertigstellung. Jäger nur zu einer eigenen Stadt in Reichweite, sonst stürzten sie ab.
function rallyCheck(c, type, x, y) {
  const t = UT[type];
  if (!t || !inb(x, y)) return { ok: false, msg: tt('Kein gültiges Feld', 'Not a valid tile') };
  if (x === c.x && y === c.y) return { ok: false, msg: tt('Das ist die Stadt selbst', 'That is the city itself') };
  const probe = { id: -1, type, owner: c.owner, x: c.x, y: c.y, carrier: null, fuel: t.fuel || 0 };
  // Das Zielfeld selbst muss der Typ betreten können (soweit das Gelände bekannt ist) – die Wegsuche lässt das Ziel immer zu
  if (S.players[c.owner].seen[idx(x, y)] && !canEnterTerrain(probe, x, y))
    return { ok: false, msg: tt(`${t.name} kann dieses Feld nicht betreten`, `${t.name} cannot enter this tile`) };
  const path = findPath(probe, x, y, aiKnowsMap(c.owner));
  if (!path || !path.length) return { ok: false, msg: tt(`Kein Weg dorthin für ${t.name}`, `No path there for ${t.name.toLowerCase()}`) };
  if (t.domain === 'air') {
    const tc = cityAt(x, y);
    if (!tc || tc.owner !== c.owner) return { ok: false, msg: tt('Jäger brauchen als Marschziel eine eigene Stadt', 'Fighters need one of your cities as rally point') };
    if (path.length > t.fuel) return { ok: false, msg: tt(`Zu weit für Jäger: ${path.length} Felder, Treibstoff für ${t.fuel}`, `Too far for fighters: ${path.length} tiles, fuel for ${t.fuel}`) };
  }
  return { ok: true, path };
}
function applyRally(c, u) {
  if (!c.rally) return;
  const r = rallyCheck(c, u.type, c.rally[0], c.rally[1]);
  if (r.ok) u.order = { type: 'goto', x: c.rally[0], y: c.rally[1] };
  else if (u.owner === 0) addLog(tt(`${c.name}: Marschziel nicht erreichbar (${r.msg}) – ${T(u).name} wartet auf Befehle.`,
    `${c.name}: rally point out of reach (${r.msg}) – ${T(u).name.toLowerCase()} is waiting for orders.`), '', c.x, c.y);
}

function addLog(text, cls = '', x = null, y = null) {
  S.log.unshift({ t: S.turn, text, cls, x, y });
  if (S.log.length > 100) S.log.pop();
}

// Deutsche Deklination: Nominativ (Angreifer) und Akkusativ (Verteidiger)
const ART = {
  nom: { 0: { m: 'Dein', f: 'Deine', n: 'Dein' }, 1: { m: 'Feindlicher', f: 'Feindliche', n: 'Feindliches' } },
  acc: { 0: { m: 'deinen', f: 'deine', n: 'dein' }, 1: { m: 'feindlichen', f: 'feindliche', n: 'feindliches' } },
};
// Englisch: "Your tank" / "Enemy tank" (nom), "your tank" / "the enemy tank" (acc)
const ART_EN = { nom: ['Your', 'Enemy'], acc: ['your', 'the enemy'] };
function uname(u, kase = 'nom') {
  if (EN) return `${ART_EN[kase][u.owner]} ${T(u).name.toLowerCase()}`;
  return `${ART[kase][u.owner][T(u).g]} ${T(u).name}`;
}
// Ersten Buchstaben klein (für uname mitten im Satz)
const lc1 = s => s.charAt(0).toLowerCase() + s.slice(1);
const MSG_OCCUPIED = tt('Feld ist besetzt', 'Tile is occupied');

function isBase(u) {
  if (u.carrier != null) return true;
  const c = cityAt(u.x, u.y);
  return !!(c && c.owner === u.owner);
}

function canEnterTerrain(u, x, y) {
  const t = T(u), i = idx(x, y);
  if (t.domain === 'air') return true;
  if (t.domain === 'land') return S.terrain[i] === 1;
  if (S.terrain[i] === 0) return true;
  const c = cityAt(x, y);
  return !!(c && c.owner === u.owner && c.coastal);
}

// Haken für die Oberfläche (Animationen); die Regeln funktionieren auch ohne
const hooks = { move: null, combat: null, capture: null, salvo: null };

function relocate(u, x, y) {
  if (hooks.move && (u.x !== x || u.y !== y)) hooks.move(u, u.x, u.y, x, y);
  u.x = x; u.y = y;
  for (const c of cargoOf(u)) { c.x = x; c.y = y; }
}

// Bewegungspunkt (und bei Flugzeugen Treibstoff) verbrauchen. false = abgestürzt
function spendMove(u) {
  u.moves--;
  if (T(u).domain === 'air') {
    if (isBase(u)) { u.fuel = T(u).fuel; }
    else {
      u.fuel--;
      if (u.fuel <= 0) {
        if (u.owner === 0) addLog(tt('Dein Jäger ist ohne Treibstoff abgestürzt.', 'Your fighter ran out of fuel and crashed.'), 'bad', u.x, u.y);
        killUnit(u, -1);
        return false;
      }
    }
  }
  return true;
}

function pickDefender(list) {
  return list.reduce((b, o) => (T(o).str * o.hp + o.hp > T(b).str * b.hp + b.hp ? o : b));
}

// Exakte Siegwahrscheinlichkeit: jede Runde 50 % Treffer für eine Seite
// ---------------------------------------------------------------------------
// Kampfregeln
//   Jede Kampfrunde trifft der Angreifer mit Wahrscheinlichkeit p (sonst der
//   Verteidiger) und richtet so viel Schaden an, wie seine Stärke beträgt.
//   Erstschlag: Eine Seite trifft vor der ersten Runde einmal sicher.
// Besonderheiten (Konter):
//   Küstenbatterie   – Schiff greift Einheiten in einer Stadt an: Verteidiger doppelt stark
//   Torpedo          – U-Boot greift Schlachtschiff/Kreuzer/Träger an: Erstschlag, doppelte Stärke
//   Sonar            – Zerstörer greift U-Boot an: Erstschlag, trifft danach zu 2/3
//   Wasserbomben     – U-Boot greift Zerstörer an: Zerstörer verteidigt doppelt stark
//   Luftangriff      – Jäger gegen U-Boot (an der Oberfläche): Jäger trifft zu 2/3
//   Abgetaucht       – Schlachtschiff greift getauchtes U-Boot an: trifft nur zu 1/4, das U-Boot schlägt mit
//                      doppelter Stärke zurück (das U-Boot ist ein Konter des Schlachtschiffs).
//                      Ein aufgetauchtes U-Boot (u.surf, nach eigenem Angriff) bekämpft es dagegen normal.
//   Luftangriff      – Jäger gegen Schlachtschiff: trifft zu 2/3 mit dreifachem Schaden
//                      (versenkt es selten allein, aber der Schaden bleibt – Schwärme lohnen sich)
// Luftdeckung      – Träger mit mindestens einem Jäger an Bord schützen eigene Schiffe auf den Nachbarfeldern
//                      (und sich selbst): Feindliche Jäger treffen dort nur zu 1/3
// Feuerunterstützung – Schlachtschiffe wirken auf die acht Nachbarfelder (und das eigene Feld):
//   Angriff:      Bodentruppen, die ein solches Feld angreifen, treffen zu 2/3; eine Stadt dort fällt zu 75 %
//   Verteidigung: Bodentruppen auf einem solchen Feld werden nur zu 1/3 getroffen; eine eigene Stadt fällt nur zu 25 %
//   Haben beide Seiten ein Schlachtschiff am Feld, hebt es sich auf.
// ---------------------------------------------------------------------------
const BATTERY = 2;
const BIG_SHIPS = ['bat', 'crs', 'car'];
const SUPPORT_HIT = 2 / 3, SUPPORT_CAPTURE = 0.25;
// Küstenangriff: Bodentruppen, die ein Schiff auf einem Nachbarfeld angreifen, richten COAST.str-fachen Schaden an und treffen mit
// COAST.p – außer gegen Kreuzer und Schlachtschiff (UT.shore), die für die Küste gebaut sind. U-Boote sind für sie unerreichbar.
const COAST = { str: 3, p: 0.5 };

// Schlachtschiff des Spielers, das auf das Feld (x, y) wirkt – oder null
function fireSupport(owner, x, y) {
  if (owner < 0) return null;
  for (const u of S.units) {
    if (u.type === 'bat' && u.owner === owner && u.carrier == null && u.hp > 0 && cheb(u.x, u.y, x, y) <= 1) return u;
  }
  return null;
}
// Träger des Spielers mit Jägern an Bord, der das Feld (x, y) deckt – oder null
function airCover(owner, x, y) {
  if (owner == null || owner < 0) return null;
  for (const u of S.units) {
    if (u.type !== 'car' || u.owner !== owner || u.carrier != null || u.hp <= 0 || cheb(u.x, u.y, x, y) > 1) continue;
    if (S.units.some(f => f.carrier === u.id && f.type === 'ftr')) return u;
  }
  return null;
}
// Erfolgschance, mit der Spieler `owner` die Stadt c erobert
function captureChance(owner, c) {
  let p = 0.5;
  if (fireSupport(owner, c.x, c.y)) p += SUPPORT_CAPTURE;
  if (fireSupport(c.owner, c.x, c.y)) p -= SUPPORT_CAPTURE;
  return p;
}
// Darf a die Einheit d überhaupt angreifen? Schiffe beschießen Einheiten an Land (auch in Städten) nur, wenn sie dafür gebaut
// sind (UT.shore: Kreuzer, Schlachtschiff). Zerstörer, U-Boot und Träger greifen nur Schiffe und Flugzeuge an.
// Bodentruppen greifen Schiffe an der Küste an, aber keine U-Boote.
// Regeln (moveStep), KI und Anzeige (Zugmarker, Hinweiszeile, Tabelle „Wer schlägt wen“) fragen alle hier nach.
function canStrike(a, d) {
  if (T(a).str <= 0) return false;
  if (T(a).domain === 'land' && T(d).stealth) return false;   // U-Boote: für Bodentruppen nicht angreifbar
  return !(T(a).domain === 'sea' && !T(a).shore && T(d).domain === 'land');
}

function combatSpec(a, d, x, y) {
  const ta = a.type, td = d.type;
  let as = T(a).str, ds = T(d).str, p = 0.5, first = null;
  const notes = [];
  if (T(a).domain === 'sea' && cityAt(x, y)) { ds = Math.max(1, ds) * BATTERY; notes.push(tt('Küstenbatterie', 'coastal battery')); }
  if (ta === 'sub' && BIG_SHIPS.includes(td)) { as *= 2; first = 'att'; notes.push(tt('Torpedo-Überraschung', 'torpedo surprise')); }
  if (ta === 'dst' && td === 'sub') { first = 'att'; p = 2 / 3; notes.push(tt('Sonar: Zerstörer trifft zuerst und öfter', 'sonar: destroyer strikes first and more often')); }
  if (ta === 'sub' && td === 'dst') { ds *= 2; notes.push(tt('Wasserbomben', 'depth charges')); }
  if (ta === 'ftr' && td === 'sub') { p = 2 / 3; notes.push(tt('Luftangriff auf U-Boot', 'air strike on submarine')); }
  if (ta === 'bat' && td === 'sub' && !d.surf) { p = 1 / 4; ds *= 2; notes.push(tt('U-Boot taucht ab: schwer zu treffen, Torpedo-Gegenschlag', 'submarine dives: hard to hit, torpedo counter-strike')); }
  if (ta === 'ftr' && td === 'bat') { as *= 3; p = 2 / 3; notes.push(tt('Luftangriff auf Schlachtschiff', 'air strike on battleship')); }
  if (T(a).domain === 'land' && T(d).domain === 'sea' && !T(d).shore && !cityAt(x, y)) {
    as *= COAST.str; p = COAST.p;
    notes.push(tt('Küstenangriff: Schiff in Reichweite der Bodentruppen', 'coastal attack: ship within reach of ground troops'));
  }
  if (ta === 'ftr' && T(d).domain === 'sea' && airCover(d.owner, x, y)) { p = 1 / 3; notes.push(tt('Luftdeckung durch Träger', 'air cover from a carrier')); }
  // Feuerunterstützung/Feuerschutz betreffen nur Bodentruppen
  if (T(a).domain === 'land' || T(d).domain === 'land') {
    const att = T(a).domain === 'land' && a.owner != null && !!fireSupport(a.owner, x, y);
    const def = T(d).domain === 'land' && d.owner != null && !!fireSupport(d.owner, x, y);
    if (att && !def) { p = SUPPORT_HIT; notes.push(tt('Feuerunterstützung durch Schlachtschiff', 'fire support from a battleship')); }
    if (def && !att) { p = 1 - SUPPORT_HIT; notes.push(tt('Feuerschutz durch Schlachtschiff des Verteidigers', 'covering fire from the defender\'s battleship')); }
  }
  return { as, ds, p, first, notes };
}
function combatStr(a, d, x, y) { const c = combatSpec(a, d, x, y); return [c.as, c.ds]; }
function attackOdds(a, d, x, y) {
  const c = combatSpec(a, d, x, y);
  return winProb(a.hp, c.as, d.hp, c.ds, c.p, c.first);
}

function winProb(ahp, astr, dhp, dstr, p = 0.5, first = null) {
  if (first === 'att') dhp -= astr;
  if (first === 'def') ahp -= dstr;
  if (dhp <= 0) return 1;
  if (ahp <= 0) return 0;
  if (astr <= 0) return 0;
  if (dstr <= 0) return 1;
  const memo = new Map();
  const f = (a, d) => {
    if (d <= 0) return 1;
    if (a <= 0) return 0;
    const k = a * 1000 + d;
    if (memo.has(k)) return memo.get(k);
    const v = p * f(a, d - astr) + (1 - p) * f(a - dstr, d);
    memo.set(k, v);
    return v;
  };
  return f(ahp, dhp);
}

// by: die erobernde Einheit – sie geht in der Stadt auf (wird verbraucht).
// Das bremst den Vormarsch: Jede Eroberung kostet eine Einheit.
function captureCity(c, owner, by = null, support = false) {
  const prev = c.owner;
  c.owner = owner; c.prod = 'inf'; c.progress = 0; c.rally = null;
  if (hooks.capture) hooks.capture(c, owner, prev, by);
  if (by) killUnit(by);
  if (owner === 0) addLog(tt(`Du hast ${c.name} erobert!`, `You captured ${c.name}!`) + (by ? tt(` ${{ m: 'Der', f: 'Die', n: 'Das' }[T(by).g]} ${T(by).name} geht in der Stadt auf.`, ` Your ${T(by).name.toLowerCase()} merges into the city.`) : '')
    + (support ? tt(' Dein Schlachtschiff gab Feuerunterstützung.', ' Your battleship gave fire support.') : ''), 'good', c.x, c.y);
  else if (prev === 0) addLog(tt(`${c.name} ist an den Gegner gefallen!`, `${c.name} has fallen to the enemy!`)
    + (support ? tt(' Ein feindliches Schlachtschiff gab Feuerunterstützung.', ' An enemy battleship gave fire support.') : ''), 'bad', c.x, c.y);
  if (owner === 1 && typeof aiChooseProduction === 'function') aiChooseProduction(c);
}

function attack(u, nx, ny, enemies, city) {
  const def = pickDefender(enemies);
  const a = T(u), d = T(def);
  const involved = u.owner === 0 || def.owner === 0;
  const aName = uname(u), dName = uname(def, 'acc');
  const cs = combatSpec(u, def, nx, ny);
  if (a.stealth) u.surf = true;   // wer angreift, verrät sich: aufgetaucht bis zum nächsten eigenen Zug
  // Schlachtschiffe feuern mit: das des Angreifers aufs Ziel, das des Verteidigers auf den Angreifer
  const supA = a.domain === 'land' ? fireSupport(u.owner, nx, ny) : null;
  const supD = d.domain === 'land' || (city && city.owner === def.owner) ? fireSupport(def.owner, nx, ny) : null;
  if (hooks.salvo) {
    if (supA && (d.domain === 'land' || (city && city.owner !== u.owner && a.capture))) hooks.salvo(supA, nx, ny);
    if (supD && supD !== def) hooks.salvo(supD, u.x, u.y);
  }
  if (cs.first === 'att') def.hp -= cs.as;
  if (cs.first === 'def') u.hp -= cs.ds;
  while (u.hp > 0 && def.hp > 0) {
    if (rng() < cs.p) def.hp -= cs.as; else u.hp -= cs.ds;
  }
  // Besetzte Stadt: Wer den Verteidiger besiegt und Städte erobern kann, würfelt
  // sofort die 50 % auf die Stadt. Fällt sie, geht die restliche Besatzung unter.
  const storm = u.hp > 0 && city && city.owner !== u.owner && a.capture ? rng() < captureChance(u.owner, city) : null;
  if (hooks.combat) hooks.combat(u, def, nx, ny, u.hp > 0, storm);   // won = Angreifer hat gewonnen
  if (u.hp <= 0) {
    if (involved) addLog(tt(`${aName} greift ${dName} an – und wird vernichtet.`, `${aName} attacks ${dName} – and is destroyed.`), u.owner === 0 ? 'bad' : 'good', nx, ny);
    killUnit(u, def.owner);
    return { ok: true, died: true, combat: true };
  }
  const cargoLost = cargoOf(def).length;
  if (involved) addLog(tt(`${aName} greift ${dName} an – Sieg!`, `${aName} attacks ${dName} – victory!`) + (cargoLost ? tt(` (${cargoLost} Einheiten an Bord verloren)`, ` (${cargoLost} ${cargoLost === 1 ? 'unit' : 'units'} lost on board)`) : ''),
    u.owner === 0 ? 'good' : 'bad', nx, ny);
  killUnit(def, u.owner);
  if (storm) {
    const garrison = S.units.filter(o => o.x === nx && o.y === ny && o.owner !== u.owner && o.carrier == null);
    let lost = 0;
    for (const o of garrison) { lost += 1 + cargoOf(o).length; killUnit(o, u.owner); }
    relocate(u, nx, ny); u.carrier = null; u.order = null; u.moves = 0;
    captureCity(city, u.owner, u, !!supA);
    if (lost && involved) addLog(tt(`Mit ${city.name} ${lost === 1 ? 'ging 1 weitere Einheit' : `gingen ${lost} weitere Einheiten`} unter.`, `${lost === 1 ? '1 more unit was' : `${lost} more units were`} lost with ${city.name}.`),
      u.owner === 0 ? 'good' : 'bad', nx, ny);
    return { ok: true, combat: true, captured: city, died: true, consumed: true };
  }
  if (storm === false && involved) addLog(tt(`${city.name} hält dem Sturm stand.`, `${city.name} withstands the assault.`), u.owner === 0 ? 'bad' : 'good', nx, ny);
  const rest = topUnitsAt(nx, ny);
  if (!rest.length && !(city && city.owner !== u.owner) && canEnterTerrain(u, nx, ny)) { relocate(u, nx, ny); u.carrier = null; }   // von Bord aus gesiegt: jetzt an Land
  const ok = spendMove(u);
  return { ok: true, died: !ok, combat: true };
}

// Wer verteidigt das Feld gegen u? Greifen Bodentruppen eine fremde Stadt an, kämpfen Schiffe im Hafen nicht mit –
// fällt die Stadt, gehen sie mit unter (auch ein Schlachtschiff). So macht kein Schiff eine Stadt uneinnehmbar.
function cityDefenders(u, city, enemies) {
  return T(u).domain === 'land' && city && city.owner !== u.owner ? enemies.filter(o => T(o).domain !== 'sea') : enemies;
}

// Ein Schritt auf ein Nachbarfeld: bewegen, angreifen, erobern oder einsteigen
function moveStep(u, nx, ny) {
  const t = T(u);
  if (!inb(nx, ny)) return { ok: false, msg: tt('Kartenrand', 'Edge of the map') };
  if (cheb(u.x, u.y, nx, ny) !== 1) return { ok: false, msg: tt('Feld ist nicht benachbart', 'Tile is not adjacent') };
  if (u.moves <= 0) return { ok: false, msg: tt('Keine Bewegungspunkte mehr', 'No moves left') };
  const city = cityAt(nx, ny);
  const here = topUnitsAt(nx, ny);
  const enemies = here.filter(o => o.owner !== u.owner);
  const foes = cityDefenders(u, city, enemies);

  if (foes.length) {
    // Sonarkontakt: Liegt dort nur ein U-Boot, das der Spieler bisher nicht geortet hat, gibt es keinen Kampf.
    // Die Einheit bleibt stehen, das U-Boot ist jetzt entdeckt (sie steht ja direkt daneben).
    if (foes.every(o => T(o).stealth && !o.surf && !canSee(u.owner, o))) {
      computeVision(u.owner);
      return { ok: false, contact: true, msg: tt('Sonarkontakt: U-Boot voraus', 'Sonar contact: submarine ahead') };
    }
    if (t.str === 0) return { ok: false, msg: tt(`${t.name} kann nicht angreifen`, `${t.name} cannot attack`) };
    const targets = foes.filter(o => canStrike(u, o));
    if (!targets.length) return { ok: false, msg: t.domain === 'land'
      ? tt('U-Boote sind für Bodentruppen nicht angreifbar', 'Submarines cannot be attacked by ground troops')
      : tt(`${t.name} kann keine Einheiten an Land angreifen – das können nur Kreuzer und Schlachtschiffe`, `${t.name} cannot attack units on land – only cruisers and battleships can`) };
    return attack(u, nx, ny, targets, city);
  }
  if (city && city.owner !== u.owner) {
    if (!t.capture) return { ok: false, msg: tt('Nur Infanterie und Panzer können Städte erobern', 'Only infantry and tanks can capture cities') };
    u.moves = 0;
    const supA = fireSupport(u.owner, nx, ny), supD = fireSupport(city.owner, nx, ny);
    if (hooks.salvo) { if (supA) hooks.salvo(supA, nx, ny); if (supD) hooks.salvo(supD, u.x, u.y); }
    if (rng() < captureChance(u.owner, city)) {
      // Schiffe im Hafen gehen mit der Stadt unter
      const mine = u.owner === 0 || city.owner === 0;
      let sunk = 0;
      for (const o of enemies) { sunk += 1 + cargoOf(o).length; killUnit(o, u.owner); }
      relocate(u, nx, ny); u.carrier = null; u.order = null;
      captureCity(city, u.owner, u, !!supA);
      if (sunk && mine) addLog(tt(`Mit ${city.name} ${sunk === 1 ? 'ging 1 Einheit im Hafen' : `gingen ${sunk} Einheiten im Hafen`} unter.`,
        `${sunk === 1 ? '1 unit in port was' : `${sunk} units in port were`} lost with ${city.name}.`), u.owner === 0 ? 'good' : 'bad', nx, ny);
      return { ok: true, captured: city, died: true, consumed: true };
    }
    if (hooks.combat) hooks.combat(u, null, nx, ny, false);
    if (u.owner === 0) addLog(tt(`Angriff auf ${city.name} abgewehrt – ${t.name} verloren.`, `Attack on ${city.name} repelled – ${t.name.toLowerCase()} lost.`), 'bad', nx, ny);
    else if (city.owner === 0) addLog(tt(`${city.name} hat einen Angriff abgewehrt.`, `${city.name} repelled an attack.`), 'good', nx, ny);
    killUnit(u, city.owner);   // neutrale Stadt (-1): zählt als „sonst verloren“
    return { ok: true, died: true };
  }
  const ownCity = city && city.owner === u.owner;
  if (here.length && !ownCity) {
    const carrier = here.find(o => T(o).carries === t.domain && cargoOf(o).length < T(o).capacity);
    if (!carrier) return { ok: false, msg: MSG_OCCUPIED };
    relocate(u, nx, ny); u.carrier = carrier.id;
    if (u.owner === 0) u.order = { type: 'sentry' };
    const ok = spendMove(u);
    if (t.domain === 'air' && ok) u.fuel = t.fuel;
    return { ok: true, died: !ok, boarded: carrier };
  }
  if (!canEnterTerrain(u, nx, ny)) {
    if (t.domain === 'land') return { ok: false, msg: tt('Bodentruppen können nicht ins Wasser', 'Land units cannot enter water') };
    return { ok: false, msg: tt('Schiffe können nicht an Land', 'Ships cannot go ashore') };
  }
  relocate(u, nx, ny); u.carrier = null;
  const ok = spendMove(u);
  return { ok: true, died: !ok };
}

// Transporter/Träger in eigener Stadt: Einheiten aus der Stadt an Bord nehmen
function loadUnits(u, filter = () => true) {
  const t = T(u);
  if (!t.carries) return 0;
  const c = cityAt(u.x, u.y);
  if (!c || c.owner !== u.owner) return 0;
  let n = 0;
  for (const o of topUnitsAt(u.x, u.y)) {
    if (o === u || o.owner !== u.owner || T(o).domain !== t.carries || !filter(o)) continue;
    if (cargoOf(u).length >= t.capacity) break;
    o.carrier = u.id; if (u.owner === 0) o.order = { type: 'sentry' };
    if (T(o).domain === 'air') o.fuel = T(o).fuel;
    n++;
  }
  return n;
}

// Wartende Bodentruppen, die ein Transporter von selbst an Bord nimmt: eigene Einheiten ohne Befehl oder auf Wache.
// Wer marschiert, patrouilliert oder erkundet, ist unterwegs und bleibt draußen.
const waitingTroops = u => o => o !== u && o.owner === u.owner && o.carrier == null && T(o).domain === T(u).carries
  && (!o.order || o.order.type === 'sentry');

// Dauerbefehl „Laden“ für Transporter (u.order = { type: 'load' }): Er bleibt liegen, bis er voll ist, und nimmt die wartenden
// Bodentruppen an Bord, die in seiner Stadt oder auf einem Nachbarfeld stehen – sofort und zu jedem Rundenbeginn. Ist er voll,
// endet der Befehl und der Transporter meldet sich.
function runLoad(u) {
  const t = T(u);
  if (!t.carries) return 0;
  const free = () => t.capacity - cargoOf(u).length;
  const want = waitingTroops(u);
  let n = 0;
  // Nachbarfelder: Die Einheit zieht selbst an Bord (kostet ihren Zug) – liegt der Transporter im Hafen, zieht sie in die Stadt
  for (const [dx, dy] of DIRS) {
    const x = u.x + dx, y = u.y + dy;
    if (!inb(x, y)) continue;
    for (const o of topUnitsAt(x, y)) {
      if (free() <= 0) break;
      if (!want(o) || o.moves <= 0) continue;
      const had = o.order;
      o.order = null;
      const r = moveStep(o, u.x, u.y);
      if (r.ok && r.boarded) n++;
      else if (!r.ok) o.order = had;
    }
  }
  const c = cityAt(u.x, u.y);
  if (c && c.owner === u.owner) n += loadUnits(u, want);
  if (free() <= 0 && u.order && u.order.type === 'load') {
    u.order = null;
    if (u.owner === 0) addLog(tt(`${t.name}: voll beladen – bereit zum Auslaufen.`, `${t.name}: fully loaded – ready to sail.`), 'good', u.x, u.y);
  }
  return n;
}

// Kann die Einheit o von ihrem Transporter tr aus jetzt von Bord gehen? Dazu braucht sie ihren Zug und ein Ziel daneben: ein
// freies Landfeld, eine eigene Stadt, eine feindliche Einheit am Ufer oder – für Infanterie und Panzer – eine neutrale/feindliche
// Stadt (Angriff vom Schiff).
function canDisembark(o, tr) {
  if (o.moves <= 0) return false;
  for (const [dx, dy] of DIRS) {
    const x = tr.x + dx, y = tr.y + dy;
    if (!inb(x, y) || !canEnterTerrain(o, x, y)) continue;
    const c = cityAt(x, y);
    if (c) { if (c.owner === o.owner || T(o).capture) return true; continue; }
    const there = topUnitsAt(x, y).filter(q => q.owner === o.owner || canSee(o.owner, q));
    if (!there.length) return true;                                              // freies Feld
    if (T(o).str > 0 && there.every(q => q.owner !== o.owner)) return true;      // Gegner am Ufer: Angriff vom Schiff
  }
  return false;
}

// Angriff vom Schiff: Die Truppen an Bord eines Transporters können ein Nachbarfeld direkt angreifen – ohne Umweg über ein
// freies Landfeld, der ihren Zug kosten und den Angriff um eine Runde verschieben würde. Zwei Arten von Zielen (assaultOptions):
//   'city' – eine neutrale oder feindliche Stadt: Infanterie und Panzer stürmen sie (Chance = Sieg gegen den Verteidiger × Eroberung)
//   'unit' – eine feindliche Einheit auf einem Landfeld daneben (Bodentruppen, auch ein Jäger über Land), die den Transporter
//            sonst in der Gegnerrunde angreifen könnte: Alles an Bord, was kämpfen kann, greift sie an
// Städte stehen vorn (assaultTarget), danach nach Chance.
function assaultTroops(u) {
  return cargoOf(u).filter(o => T(o).capture && o.moves > 0).sort((a, b) => T(a).cost - T(b).cost);   // erst Infanterie, dann Panzer
}
function assaultOptions(u) {
  const out = [], capt = assaultTroops(u);
  const fight = cargoOf(u).filter(o => o.moves > 0 && T(o).str > 0 && T(o).domain === 'land');
  if (!capt.length && !fight.length) return out;
  for (const [dx, dy] of DIRS) {
    const x = u.x + dx, y = u.y + dy;
    if (!inb(x, y)) continue;
    const c = cityAt(x, y);
    const seen = topUnitsAt(x, y).filter(o => o.owner !== u.owner && canSee(u.owner, o));
    if (c) {
      if (c.owner === u.owner || !capt.length) continue;
      const foes = cityDefenders(capt[0], c, seen);
      const chance = (foes.length ? attackOdds(capt[0], pickDefender(foes), x, y) : 1) * captureChance(u.owner, c);
      out.push({ kind: 'city', x, y, city: c, name: c.name, chance, troops: capt.length });
    } else if (seen.length && fight.length && S.terrain[idx(x, y)] === 1) {
      const d = pickDefender(seen);
      const chance = Math.max(...fight.map(o => attackOdds(o, d, x, y)));
      out.push({ kind: 'unit', x, y, target: d, name: T(d).name, chance, troops: fight.length });
    }
  }
  return out.sort((a, b) => (a.kind !== b.kind ? (a.kind === 'city' ? -1 : 1) : b.chance - a.chance));
}
function assaultTarget(u) { return assaultOptions(u)[0] || null; }
// Führt den Angriff aus. Stadt: der Reihe nach, bis sie fällt; wer danach noch an Bord ist, bleibt dort (für das nächste Ziel).
// Einheit: jeweils der aussichtsreichste Angreifer, bis das Feld frei ist – der Sieger geht dabei an Land.
function assaultFrom(u, opt) {
  let attacks = 0, done = false;
  if (opt.kind === 'city') {
    const city = opt.city;
    for (const o of assaultTroops(u)) {
      let guard = 4;
      while (alive(o) && o.carrier === u.id && o.moves > 0 && city.owner !== u.owner && guard-- > 0) {
        o.order = null;
        const r = moveStep(o, city.x, city.y);
        if (!r.ok) break;
        attacks++;
      }
      if (city.owner === u.owner) break;
    }
    done = city.owner === u.owner;
  } else {
    const foesAt = () => topUnitsAt(opt.x, opt.y).filter(o => o.owner !== u.owner && canSee(u.owner, o));
    for (let guard = 12; guard > 0; guard--) {
      const foes = foesAt();
      if (!foes.length) break;
      const d = pickDefender(foes);
      const troops = cargoOf(u).filter(o => o.moves > 0 && T(o).str > 0 && T(o).domain === 'land')
        .sort((a, b) => attackOdds(b, d, opt.x, opt.y) - attackOdds(a, d, opt.x, opt.y));
      if (!troops.length) break;
      troops[0].order = null;
      const r = moveStep(troops[0], opt.x, opt.y);
      if (!r.ok) break;
      attacks++;
    }
    done = !foesAt().length;
  }
  // wer an Bord geblieben ist, schläft wieder (wie nach dem Einsteigen)
  if (u.owner === 0) for (const o of cargoOf(u)) if (!o.order) o.order = { type: 'sentry' };
  return { attacks, captured: opt.kind === 'city' && done, cleared: done };
}

// Zug eines Transporters des Spielers (von Hand oder auf dem Marsch; die KI benutzt moveStep direkt): Verlässt er eine eigene
// Stadt, nimmt er die dort wartenden Bodentruppen mit, soweit der Laderaum reicht. So genügt es, Truppen in einer Stadt zu
// sammeln und mit dem Transporter hindurchzufahren. Ausnahme: Hat er in dieser Stadt gerade selbst ausgeladen (u.dropped),
// bleiben die Truppen dort. Läuft er in eine eigene Stadt ein, bleibt seine Ladung an Bord. r.picked = Zahl der Mitgenommenen.
function sailStep(u, nx, ny) {
  const c = cityAt(u.x, u.y), from = [u.x, u.y];
  let picked = [];
  if (T(u).carries === 'land' && c && c.owner === u.owner && !u.dropped && u.moves > 0 && inb(nx, ny)) {
    const before = new Set(cargoOf(u).map(o => o.id));
    const orders = new Map(S.units.map(o => [o.id, o.order]));
    loadUnits(u, waitingTroops(u));
    picked = cargoOf(u).filter(o => !before.has(o.id)).map(o => [o, orders.get(o.id)]);
  }
  const r = moveStep(u, nx, ny);
  const left = r.ok && alive(u) && (u.x !== from[0] || u.y !== from[1]);
  if (!left) for (const [o, ord] of picked) { o.carrier = null; o.order = ord || null; }   // nicht losgekommen: wieder an Land
  else {
    if (u.dropped) delete u.dropped;
    if (picked.length) {
      r.picked = picked.length;
      if (u.owner === 0) addLog(tt(`${T(u).name} nimmt ${picked.length === 1 ? '1 Einheit' : picked.length + ' Einheiten'} aus ${c.name} mit.`, `${T(u).name} takes ${picked.length === 1 ? '1 unit' : picked.length + ' units'} along from ${c.name}.`), '', from[0], from[1]);
    }
  }
  return r;
}

// Alle Einheiten an Bord auf freie Nachbarfelder (oder in die Stadt) ausladen
function unloadAll(u) {
  let n = 0;
  const c = cityAt(u.x, u.y);
  for (const o of cargoOf(u)) {
    o.order = null;
    if (c && c.owner === u.owner) { o.carrier = null; n++; u.dropped = true; continue; }   // dropped: beim Auslaufen nicht wieder mitnehmen
    if (o.moves <= 0) continue;
    for (const [dx, dy] of DIRS) {
      const nx = u.x + dx, ny = u.y + dy;
      if (!inb(nx, ny) || !canEnterTerrain(o, nx, ny)) continue;
      const cc = cityAt(nx, ny);
      if (cc && cc.owner !== o.owner) continue;
      if (topUnitsAt(nx, ny).length && !(cc && cc.owner === o.owner)) continue;
      const r = moveStep(o, nx, ny);
      if (r.ok) { n++; break; }
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Sicht / Nebel des Krieges
// ---------------------------------------------------------------------------
// Getarnte U-Boote: Ein getauchtes U-Boot sieht nur, wer es ortet – jede Einheit und jede Stadt
// direkt daneben, Zerstörer in ihrer vollen Sichtweite (P.sonar). Nach einem Angriff ist das U-Boot
// bis zum nächsten eigenen Zug aufgetaucht (u.surf) und wie jede andere Einheit sichtbar.
// canSee(p, u): Kann Spieler p die Einheit u sehen? Für fremde Einheiten immer diese Funktion
// benutzen, nie nur P.vis des Feldes abfragen.
function canSee(p, u) {
  if (u.owner === p) return true;
  const P = S.players[p], i = idx(u.x, u.y);
  if (!P.vis[i]) return false;
  return !T(u).stealth || u.surf === true || P.sonar[i] === 1;
}

// Schummelei „Nebel aus“ – nur für den Menschen (Spieler 0), geschaltet in ui.js (setCheatFog). Solange sie an ist, sieht der
// Spieler die ganze Karte, alle Städte und alle Einheiten, auch getauchte U-Boote; Regeln und Wegsuche rechnen damit.
// Das echte Kartengedächtnis (seen, knownOwner) läuft in P.real weiter: Es wird gespeichert (serialize) und kehrt zurück,
// sobald der Nebel wieder an ist. In Simulationen bleibt der Schalter aus.
let CHEAT_FOG = false;

function computeVision(p) {
  const P = S.players[p];
  const cheat = CHEAT_FOG && p === 0;
  if (cheat && !P.real) {   // einschalten: echtes Gedächtnis beiseitelegen
    P.real = { seen: P.seen, knownOwner: P.knownOwner };
    P.seen = new Uint8Array(P.seen.length); P.knownOwner = new Int8Array(P.knownOwner.length);
  } else if (!cheat && P.real) {   // ausschalten: zurückholen
    P.seen = P.real.seen; P.knownOwner = P.real.knownOwner; P.real = null;
  }
  const seen = P.real ? P.real.seen : P.seen, known = P.real ? P.real.knownOwner : P.knownOwner;
  P.vis.fill(0);
  if (!P.sonar) P.sonar = new Uint8Array(S.W * S.H);
  P.sonar.fill(0);
  const ping = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (inb(nx, ny)) P.sonar[idx(nx, ny)] = 1;
    }
  };
  for (const u of S.units) if (u.owner === p) ping(u.x, u.y, T(u).sonar ? T(u).vision : 1);
  for (const c of S.cities) if (c.owner === p) ping(c.x, c.y, 1);
  const mark = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const i = idx(nx, ny); P.vis[i] = 1; seen[i] = 1;
    }
  };
  for (const u of S.units) if (u.owner === p) mark(u.x, u.y, T(u).vision);
  for (const c of S.cities) if (c.owner === p) mark(c.x, c.y, 2);
  // Sichtbare Städte zeigen den wahren Besitzer. Eigene Städte kennt man immer –
  // auch den Verlust einer eigenen Stadt erfährt man sofort, selbst im Nebel.
  for (const c of S.cities) {
    if (P.vis[idx(c.x, c.y)] || c.owner === p || known[c.id] === p) known[c.id] = c.owner;
  }
  if (cheat) {   // Nebel aus: alles sichtbar, alles geortet, alle Besitzer bekannt
    P.vis.fill(1); P.sonar.fill(1); P.seen.fill(1);
    for (const c of S.cities) P.knownOwner[c.id] = c.owner;
  }
  // gesichtete feindliche Einheiten (id -> Typ), für die Konter-Produktion der KI
  if (!P.intel) P.intel = {};
  for (const u of S.units) if (u.owner !== p && canSee(p, u)) P.intel[u.id] = u.type;
}

function visibleEnemyAt(p, x, y) {
  if (!S.players[p].vis[idx(x, y)]) return null;
  return topUnitsAt(x, y).find(o => o.owner !== p && canSee(p, o)) || null;
}

// ---------------------------------------------------------------------------
// Wegsuche (Breitensuche, 8 Richtungen)
// ---------------------------------------------------------------------------
function bfs(sx, sy, passable, goal, maxDist = 9999) {
  const W = S.W, N = S.W * S.H;
  const prev = new Int32Array(N).fill(-1);
  const dist = new Int16Array(N);
  const start = sy * W + sx;
  prev[start] = start;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    if (dist[cur] >= maxDist) continue;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= S.H) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -1) continue;
      if (goal(nx, ny, ni)) {
        prev[ni] = cur;
        const path = [];
        for (let k = ni; k !== start; k = prev[k]) path.push([k % W, (k / W) | 0]);
        return path.reverse();
      }
      if (passable(nx, ny, ni)) { prev[ni] = cur; dist[ni] = dist[cur] + 1; q.push(ni); }
    }
  }
  return null;
}

// Passierbarkeit aus Sicht eines Spielers (knowAll: kennt die ganze Karte)
function makePassable(u, knowAll, ignoreOwn = false) {
  const p = u.owner, P = S.players[p], t = T(u);
  const occ = new Map();
  for (const o of S.units) {
    if (o.carrier != null || o === u) continue;
    const i = idx(o.x, o.y);
    if (o.owner !== p) { if (canSee(p, o)) occ.set(i, 2); }
    else if (!ignoreOwn && !occ.has(i)) occ.set(i, 1);
  }
  return (x, y, i) => {
    const ci = S.cityGrid[i];
    if (ci >= 0) {
      const own = knowAll ? S.cities[ci].owner : P.knownOwner[ci];
      if (own !== p && own !== -2) return false;
    }
    const o = occ.get(i);
    if (o === 2) return false;
    if (o === 1 && ci < 0) return false;
    if (!knowAll && !P.seen[i]) return true;
    if (t.domain === 'air') return true;
    if (t.domain === 'land') return S.terrain[i] === 1;
    return S.terrain[i] === 0 || (ci >= 0 && S.cities[ci].coastal);
  };
}

// Wegsuche zu einem festen Ziel. Diagonal ist ein Schritt genauso teuer wie
// gerade, deshalb gibt es oft viele gleich kurze Wege. Unter diesen wird der
// gewählt, der am nächsten an der direkten Linie Start–Ziel bleibt
// (winziger Aufschlag je Schritt für den Abstand zur Linie; die Schrittzahl
// hat immer Vorrang).
// Schiffe: Aufschlag FOG_COST je unerforschtem Feld direkt neben bekanntem Land – dort geht die Küste vermutlich weiter. Sonst plant
// ein Schiff quer durch eine Insel, deren Ende noch im Nebel liegt, und dreht erst davor ab. Gemessen (6 Fälle mit Land im Nebel,
// 5 mit Wasser im Nebel): Umwege 26 → 10 Felder, bei Wasser im Nebel keine zusätzlichen; Aufschlag auf alle unerforschten Felder
// half nicht, höhere Werte verlängerten Fahrten durch unbekanntes Wasser. Bodentruppen und Jäger: kein Aufschlag.
const FOG_COST = 2;
// ignoreOwn: eigene Einheiten zählen nicht als Hindernis (Prüfung „versperren nur eigene Einheiten den Weg?“)
function findPath(u, tx, ty, knowAll = false, ignoreOwn = false) {
  if (u.x === tx && u.y === ty) return [];
  const passable = makePassable(u, knowAll, ignoreOwn);
  const seen = S.players[u.owner].seen, fogCost = !knowAll && T(u).domain === 'sea' ? FOG_COST : 0;
  let fogMask = null;   // unerforschte Felder direkt neben bekanntem Land
  if (fogCost) {
    fogMask = new Uint8Array(S.W * S.H);
    for (let i = 0; i < fogMask.length; i++) {
      if (seen[i]) continue;
      const x = i % S.W, y = (i / S.W) | 0;
      for (const [dx, dy] of DIRS) { const j = idx(x + dx, y + dy); if (inb(x + dx, y + dy) && seen[j] && S.terrain[j]) { fogMask[i] = 1; break; } }
    }
  }
  const W = S.W, N = S.W * S.H, sx = u.x, sy = u.y;
  const lx = tx - sx, ly = ty - sy, len = Math.hypot(lx, ly) || 1;
  const EPS = 1e-5;
  const dev = (x, y) => Math.abs(lx * (y - sy) - ly * (x - sx)) / len;
  const cost = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const start = sy * W + sx, goal = ty * W + tx;
  cost[start] = 0;
  // kleiner Binär-Heap aus [Kosten, Index]
  const heap = [[0, start]];
  const push = item => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [c, cur] = pop();
    if (c > cost[cur]) continue;
    if (cur === goal) break;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= S.H) continue;
      const ni = ny * W + nx;
      if (ni !== goal && !passable(nx, ny, ni)) continue;
      // Schiffe: Unerforschtes direkt neben bekanntem Land kostet extra (vermutlich Küste) – bekannte Wege werden vorgezogen,
      // Unbekanntes nur, wenn es deutlich kürzer ist (siehe FOG_COST)
      const nc = c + 1 + (fogMask && fogMask[ni] ? fogCost : 0) + EPS * dev(nx, ny);
      if (nc < cost[ni]) { cost[ni] = nc; prev[ni] = cur; push([nc, ni]); }
    }
  }
  if (prev[goal] === -1) return null;
  const path = [];
  for (let k = goal; k !== start; k = prev[k]) path.push([k % W, (k / W) | 0]);
  return path.reverse();
}

// Kontaktprüfung für Befehle (Marsch, Patrouille, Erkunden): Vor jedem Schritt
// wird festgehalten, was bekannt ist; danach hält die Einheit an, sobald sie
// eine unbekannte Stadt entdeckt, eine feindliche Stadt oder Einheit neu sichtet
// oder neu an eine feindliche Einheit/Stadt angrenzt. ignore = [x, y] (Marschziel).
function contactSnap(u) {
  const p = u.owner, P = S.players[p];
  const units = new Set(), cities = new Set(), known = new Set(), adj = new Set();
  for (const o of S.units) if (o.owner !== p && o.carrier == null && canSee(p, o)) units.add(o.id);
  for (const c of S.cities) {
    if (P.knownOwner[c.id] !== -2) known.add(c.id);
    if (c.owner >= 0 && c.owner !== p && P.vis[idx(c.x, c.y)]) cities.add(c.id);
  }
  for (const k of adjacentEnemies(u)) adj.add(k);
  return { units, cities, known, adj };
}

function adjacentEnemies(u) {
  const out = [];
  for (const [dx, dy] of DIRS) {
    const x = u.x + dx, y = u.y + dy;
    if (!inb(x, y)) continue;
    const e = visibleEnemyAt(u.owner, x, y);
    if (e) out.push('u' + e.id);
    const c = cityAt(x, y);
    if (c && c.owner >= 0 && c.owner !== u.owner) out.push('c' + c.id);
  }
  return out;
}

function contactCheck(u, snap, ignore = null) {
  if (!alive(u)) return null;
  const p = u.owner, P = S.players[p];
  const skip = (x, y) => ignore && ignore[0] === x && ignore[1] === y;
  for (const c of S.cities) {
    if (skip(c.x, c.y)) continue;
    if (!snap.known.has(c.id) && P.knownOwner[c.id] !== -2) {
      if (c.owner === p) continue;
      return c.owner < 0 ? { msg: tt(`neue Stadt entdeckt: ${c.name}`, `new city discovered: ${c.name}`), cls: 'good', x: c.x, y: c.y }
                         : { msg: tt(`feindliche Stadt entdeckt: ${c.name}`, `enemy city discovered: ${c.name}`), cls: 'bad', x: c.x, y: c.y };
    }
    if (c.owner >= 0 && c.owner !== p && P.vis[idx(c.x, c.y)] && !snap.cities.has(c.id))
      return { msg: tt(`feindliche Stadt in Sicht: ${c.name}`, `enemy city in sight: ${c.name}`), cls: 'bad', x: c.x, y: c.y };
  }
  for (const o of S.units) {
    if (o.owner === p || o.carrier != null || skip(o.x, o.y) || !canSee(p, o) || snap.units.has(o.id)) continue;
    if (T(o).stealth && !o.surf) return { msg: tt('Sonarkontakt, feindliches U-Boot geortet', 'sonar contact, enemy submarine located'), cls: 'bad', x: o.x, y: o.y };
    return { msg: tt(`${lc1(uname(o))} gesichtet`, `${lc1(uname(o))} sighted`), cls: 'bad', x: o.x, y: o.y };
  }
  for (const k of adjacentEnemies(u)) {
    if (snap.adj.has(k)) continue;
    const id = +k.slice(1);
    if (k[0] === 'c') {
      const c = S.cities.find(q => q.id === id);
      if (c && !skip(c.x, c.y)) return { msg: tt(`Feindkontakt an ${c.name}`, `enemy contact at ${c.name}`), cls: 'bad', x: c.x, y: c.y };
    } else {
      const o = S.units.find(q => q.id === id);
      if (o && !skip(o.x, o.y)) return { msg: tt(`Feindkontakt – ${lc1(uname(o))} direkt nebenan`, `enemy contact – ${lc1(uname(o))} right next to you`), cls: 'bad', x: o.x, y: o.y };
    }
  }
  return null;
}

// Hält einen Befehl wegen Kontakt an und meldet es
function contactStop(u, what, hit) {
  u.order = null;
  if (u.owner === 0) addLog(tt(`${T(u).name}: ${what} angehalten – ${hit.msg}.`, `${T(u).name}: ${what} stopped – ${hit.msg}.`), hit.cls, u.x, u.y);
}

// Marschbefehl ausführen, solange Bewegungspunkte da sind
const GOTO_WAIT = 5;   // so viele Runden wartet ein Marsch, wenn nur eigene Einheiten den Weg versperren
// Steht auf (x, y) eine eigene Einheit, auf die u nicht ziehen kann? (Städte nehmen beliebig viele auf; Einsteigen geht)
function ownBlocks(u, x, y) {
  if (cityAt(x, y)) return false;
  return topUnitsAt(x, y).some(o => o.owner === u.owner && !(T(o).carries === T(u).domain && cargoOf(o).length < T(o).capacity));
}
function runGoto(u) {
  let guard = 50;
  while (alive(u) && u.order && u.order.type === 'goto' && u.moves > 0 && guard-- > 0) {
    const o = u.order;
    if (u.x === o.x && u.y === o.y) { u.order = null; break; }
    let path = findPath(u, o.x, o.y, aiKnowsMap(u.owner));
    // Versperren nur eigene Einheiten den Weg (Kolonne vor einer Brücke oder Engstelle): so weit wie möglich vorrücken und
    // dann warten – höchstens GOTO_WAIT Runden, damit die Einheit nicht unbemerkt ewig steht. Jäger warten nicht (in der Luft
    // kostet Warten Treibstoff).
    if ((!path || !path.length) && T(u).domain !== 'air') {
      const p2 = findPath(u, o.x, o.y, aiKnowsMap(u.owner), true);
      if (p2 && p2.length) {
        if (!ownBlocks(u, p2[0][0], p2[0][1])) path = p2;
        else {
          o.wait = (o.wait || 0) + 1;
          if (o.wait <= GOTO_WAIT) break;
          if (u.owner === 0) addLog(tt(`${T(u).name}: Marsch abgebrochen – der Weg ist seit ${GOTO_WAIT} Runden von eigenen Einheiten versperrt.`, `${T(u).name}: march cancelled – the way has been blocked by your own units for ${GOTO_WAIT} turns.`), '', u.x, u.y);
          u.order = null; break;
        }
      }
    }
    if (!path || !path.length) {
      if (u.owner === 0) addLog(tt(`${T(u).name}: kein Weg zum Ziel gefunden.`, `${T(u).name}: no path to the destination.`), '', u.x, u.y);
      u.order = null; break;
    }
    o.wait = 0;
    const [nx, ny] = path[0];
    const snap = contactSnap(u);
    const r = sailStep(u, nx, ny);   // Transporter nimmt beim Auslaufen die wartenden Truppen mit
    computeVision(u.owner);
    if (!r.ok) {
      if (u.owner === 0) addLog(tt(`${T(u).name}: Marsch unterbrochen (${r.msg}).`, `${T(u).name}: march interrupted (${r.msg}).`), '', u.x, u.y);
      if (alive(u)) u.order = null;
      break;
    }
    if (r.died || r.combat || r.captured || r.boarded) { if (alive(u)) u.order = null; break; }
    if (alive(u) && u.x === o.x && u.y === o.y) { u.order = null; break; }
    const hit = contactCheck(u, snap, [o.x, o.y]);
    if (hit) { contactStop(u, tt('Marsch', 'march'), hit); break; }
  }
}

// Patrouille: läuft die Wegpunkte im Kreis ab (Start -> P1 -> ... -> Pn -> Start ...), bis der Spieler sie aufhebt oder ein
// Feind auftaucht. Jäger tanken zwischendurch von selbst (siehe runPatrol).
function enemyAdjacent(u) {
  for (const [dx, dy] of DIRS) {
    const x = u.x + dx, y = u.y + dy;
    if (inb(x, y) && visibleEnemyAt(u.owner, x, y)) return true;
  }
  return false;
}

function runPatrol(u) {
  let guard = 60;
  const stop = (msg, cls = '') => {
    if (alive(u)) u.order = null;
    if (u.owner === 0 && msg) addLog(`${T(u).name}: ${msg}`, cls, u.x, u.y);
  };
  while (alive(u) && u.order && u.order.type === 'patrol' && u.moves > 0 && guard-- > 0) {
    const o = u.order;
    if (enemyAdjacent(u)) { stop(tt('Patrouille unterbrochen – Feindkontakt!', 'patrol interrupted – enemy contact!'), 'bad'); break; }
    // Jäger tanken zwischendurch: Reicht der Treibstoff nach dem nächsten Schritt nicht mehr sicher für den Rückweg, fliegt
    // der Jäger zur nächsten Basis (o.refuel) und setzt die Patrouille danach beim selben Wegpunkt fort – sie bleibt ein
    // Dauerbefehl. Muss er zweimal hintereinander für denselben Wegpunkt umkehren (o.rf), liegt der außer Reichweite.
    const air = T(u).domain === 'air' && typeof distHome === 'function';
    if (o.refuel && isBase(u)) o.refuel = false;   // getankt
    let path = null;
    if (!o.refuel) {
      let [tx, ty] = o.pts[o.i];
      if (u.x === tx && u.y === ty) {
        o.i = (o.i + 1) % o.pts.length; o.rf = -1;
        [tx, ty] = o.pts[o.i];
        if (u.x === tx && u.y === ty) break;   // nur ein Punkt = Standort
      }
      path = findPath(u, tx, ty, aiKnowsMap(u.owner));
      // nur eigene Einheiten im Weg (z. B. auf einer Brücke): so weit wie möglich vorrücken, dann warten – die Patrouille
      // bleibt ein Dauerbefehl
      if ((!path || !path.length) && !air) {
        const p2 = findPath(u, tx, ty, aiKnowsMap(u.owner), true);
        if (p2 && p2.length) { if (ownBlocks(u, p2[0][0], p2[0][1])) break; path = p2; }
      }
      if (!path || !path.length) { stop(tt('Patrouille abgebrochen – kein Weg zum Wegpunkt.', 'patrol aborted – no path to the waypoint.')); break; }
      if (air) {
        const [qx, qy] = path[0], c = cityAt(qx, qy);
        // nach dem Schritt muss der Treibstoff für den Heimweg reichen, mit einem Feld Reserve für Umwege
        if (!(c && c.owner === u.owner) && u.fuel - 1 < distHome(u.owner, qx, qy) + 1) {
          if (o.rf === o.i) {   // unerreichbar: Patrouille aufgeben und heimfliegen, statt ohne Befehl in der Luft zu bleiben
            u.order = { type: 'goto', ...refuelBase(u) };
            if (u.owner === 0) addLog(tt(`${T(u).name}: Patrouille abgebrochen – Wegpunkt außer Reichweite, fliegt zur Basis.`, `${T(u).name}: patrol aborted – waypoint out of range, flying back to base.`), '', u.x, u.y);
            runGoto(u);
            break;
          }
          o.refuel = true; o.rf = o.i;
        }
      }
    }
    if (o.refuel) {
      const b = refuelBase(u);
      path = findPath(u, b.x, b.y, aiKnowsMap(u.owner));
      if (!path || !path.length) { stop(tt('Patrouille abgebrochen – kein Weg zur Basis.', 'patrol aborted – no path to the base.')); break; }
    }
    const [nx, ny] = path[0];
    const snap = contactSnap(u);
    const r = moveStep(u, nx, ny);
    computeVision(u.owner);
    if (!r.ok) {
      if (r.msg === MSG_OCCUPIED) {
        // eigene Einheit auf dem Wegpunkt: Schiffe und Bodentruppen warten bis zur nächsten Runde; ein Jäger kann nicht in der
        // Luft warten (ungenutzte Bewegung kostet Treibstoff) und nimmt gleich den nächsten Wegpunkt
        if (air && !o.refuel && o.pts.length > 1) { o.i = (o.i + 1) % o.pts.length; continue; }
        break;
      }
      stop(tt(`Patrouille abgebrochen (${r.msg}).`, `patrol aborted (${r.msg}).`));
      break;
    }
    if (r.died) break;
    if (r.combat || r.captured || r.boarded) { stop(tt('Patrouille beendet.', 'patrol finished.')); break; }
    const hit = contactCheck(u, snap);
    if (hit) { contactStop(u, tt('Patrouille', 'patrol'), hit); break; }
  }
}

// Erkundungsziel nach Informationsgewinn: Unter allen erreichbaren, bekannten
// Feldern wird das gewählt, von dem aus die Einheit mit ihrer Sichtweite am
// meisten Unbekanntes aufdeckt – im Verhältnis zum Weg dorthin. Felder
// außerhalb der Karte zählen nicht, daher fährt niemand sinnlos an den Rand.
// Gefahrenzone: Felder neben sichtbaren feindlichen Einheiten und neben
// bekannten Feindstädten (dort können Verteidiger stehen)
function dangerZone(p) {
  const P = S.players[p], z = new Uint8Array(S.W * S.H);
  const mark = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (inb(nx, ny)) z[idx(nx, ny)] = 1;
    }
  };
  for (const o of S.units) if (o.owner !== p && o.carrier == null && canSee(p, o)) mark(o.x, o.y);
  for (const c of S.cities) {
    const k = aiKnowsMap(p) ? c.owner : P.knownOwner[c.id];
    if (k >= 0 && k !== p) mark(c.x, c.y);
  }
  return z;
}

// avoid: Gefahrenzone meiden (Erkunder sollen nicht neben Gegnern landen)
function explorePath(u, maxDist = 60, avoid = true) {
  const p = u.owner, seen = S.players[p].seen, W = S.W, N = S.W * S.H;
  const r = T(u).vision;
  const danger = avoid ? dangerZone(p) : null;
  const basePass = makePassable(u, false);
  const pass = danger ? (x, y, i) => !danger[i] && basePass(x, y, i) : basePass;
  const prev = new Int32Array(N).fill(-1), dist = new Int16Array(N);
  const start = idx(u.x, u.y);
  prev[start] = start;
  const q = [start];
  let best = -1, bestScore = 0;
  const gainAt = (x, y) => {
    let g = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < S.H && !seen[ny * W + nx]) g++;
    }
    return g;
  };
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % W, cy = (cur / W) | 0;
    if (cur !== start) {
      const g = gainAt(cx, cy);
      // Gewinn je Schritt; leichte Bevorzugung naher Ziele
      const sc = g / (dist[cur] + 1.5);
      if (sc > bestScore) { bestScore = sc; best = cur; }
    }
    if (dist[cur] >= maxDist) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= S.H) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -1 || !seen[ni] || !pass(nx, ny, ni)) continue;   // nur über bekanntes Gelände planen
      prev[ni] = cur; dist[ni] = dist[cur] + 1; q.push(ni);
    }
  }
  if (best < 0) {
    // nichts Lohnendes über bekanntes Gelände: zum nächsten unbekannten Feld (optimistisch durch den Nebel)
    return bfs(u.x, u.y, pass, (x, y, i) => !seen[i], maxDist);
  }
  const path = [];
  for (let k = best; k !== start; k = prev[k]) path.push([k % W, (k / W) | 0]);
  return path.reverse();
}

// Erkunden: Die Einheit zieht selbstständig dorthin, wo sie am meisten Neues sieht.
// Bricht ab bei Feindkontakt oder wenn nichts Erreichbares mehr unbekannt ist.
// Jäger fliegen rechtzeitig zum Tanken heim und erkunden danach weiter.
function runExplore(u) {
  const t = T(u), p = u.owner, seen = S.players[p].seen;
  const stop = (msg, cls = '') => {
    if (alive(u)) u.order = null;
    if (p === 0 && msg) addLog(`${t.name}: ${msg}`, cls, u.x, u.y);
  };
  const air = t.domain === 'air';
  // Jäger: Rückflug nötig, wenn der Treibstoff für eine weitere Runde draußen nicht reicht
  const mustReturn = air && !isBase(u) && (u.fuel - t.move < distHome(p, u.x, u.y) + t.move);
  let guard = 30, reported = false;
  while (alive(u) && u.order && u.order.type === 'explore' && u.moves > 0 && guard-- > 0) {
    if (enemyAdjacent(u)) {
      // Bodentruppen und Schiffe halten an und melden sich. Jäger melden nur –
      // in der Luft stehen bleiben würde sie den Treibstoff kosten.
      if (!air) { stop(tt('Erkundung unterbrochen – Feindkontakt!', 'exploration interrupted – enemy contact!'), 'bad'); return; }
      if (!reported && p === 0) { addLog(tt('Jäger meldet Feindkontakt und erkundet weiter.', 'Fighter reports enemy contact and keeps exploring.'), 'bad', u.x, u.y); reported = true; }
    }
    if (mustReturn) {
      if (isBase(u)) return;                       // getankt wird zu Rundenbeginn, dann geht es weiter
      const danger = dangerZone(p);
      let best = null, bd = 1e9;
      for (const [dx, dy] of DIRS) {
        const nx = u.x + dx, ny = u.y + dy;
        if (!inb(nx, ny) || topUnitsAt(nx, ny).some(o => o.owner !== p)) continue;
        const c = cityAt(nx, ny);
        if (c && c.owner !== p) continue;
        // Heimweg geht vor, bei gleichem Abstand lieber nicht neben Gegnern
        const d = distHome(p, nx, ny) + (danger[idx(nx, ny)] ? 0.5 : 0);
        if (d < bd) { bd = d; best = [nx, ny]; }
      }
      if (!best || !moveStep(u, best[0], best[1]).ok) return;
      computeVision(p);
      continue;
    }
    const reach = air ? Math.max(1, Math.floor((u.fuel - t.move) / 2)) : 60;
    const path = explorePath(u, reach);
    if (!path || !path.length) {
      // Es gäbe noch etwas zu entdecken, aber nur durch Feindnähe: diese Runde abwarten
      const risky = explorePath(u, reach, false);
      if (risky && risky.length) return;
      stop(air ? tt('Erkundung beendet – nichts Unbekanntes mehr in Reichweite.', 'exploration finished – nothing unknown left in range.') : tt('Erkundung beendet – hier gibt es nichts mehr zu entdecken.', 'exploration finished – nothing left to discover here.'));
      return;
    }
    const [nx, ny] = path[0];
    if (air) {
      const c = cityAt(nx, ny);
      if (!(c && c.owner === p) && u.fuel - t.move < distHome(p, nx, ny)) return;   // lieber nicht weiter raus
    }
    const snap = contactSnap(u);
    const r = moveStep(u, nx, ny);
    computeVision(p);
    if (!r.ok || r.died) return;
    if (r.combat || r.captured) { stop(tt('Erkundung beendet.', 'exploration finished.')); return; }
    const hit = contactCheck(u, snap);
    if (hit) { contactStop(u, tt('Erkundung', 'exploration'), hit); return; }
  }
}

// Wohin ein Jäger auf Patrouille zum Tanken fliegt: zur nächsten eigenen Stadt, solange der Treibstoff dafür reicht – von dort
// geht die Patrouille weiter. Nur wenn keine Stadt erreichbar ist, zur nächsten Basis überhaupt (auch ein Träger; die Landung
// dort beendet die Patrouille).
function refuelBase(u) {
  let best = null, bd = 1e9;
  for (const c of S.cities) if (c.owner === u.owner) { const d = cheb(u.x, u.y, c.x, c.y); if (d < bd) { bd = d; best = { x: c.x, y: c.y }; } }
  return best && bd <= u.fuel ? best : nearestBase(u);
}
function nearestBase(u) {
  let best = null, bd = 1e9;
  for (const c of S.cities) if (c.owner === u.owner) {
    const d = cheb(u.x, u.y, c.x, c.y);
    if (d < bd) { bd = d; best = { x: c.x, y: c.y }; }
  }
  for (const o of S.units) if (o.owner === u.owner && T(o).carries === 'air' && cargoOf(o).length < T(o).capacity) {
    const d = cheb(u.x, u.y, o.x, o.y);
    if (d < bd) { bd = d; best = { x: o.x, y: o.y }; }
  }
  return best || { x: u.x, y: u.y };
}

// ---------------------------------------------------------------------------
// Runden
// ---------------------------------------------------------------------------
// Kräfteverhältnis: Wert aller Einheiten (Bauzeit, anteilig nach Trefferpunkten)
// plus 20 Punkte je Stadt (Produktionskraft)
const CITY_VALUE = 20;
function strength(p) {
  let units = 0, n = 0;
  for (const u of S.units) if (u.owner === p) { units += T(u).cost * u.hp / T(u).hp; n++; }
  const cities = S.cities.filter(c => c.owner === p).length;
  return { cities, units: n, unitValue: Math.round(units), total: Math.round(units + cities * CITY_VALUE) };
}
function recordStrength() {
  if (!S.hist) S.hist = [];
  const e = { t: S.turn, me: strength(0).total, en: strength(1).total };
  const last = S.hist[S.hist.length - 1];
  if (last && last.t === S.turn) S.hist[S.hist.length - 1] = e; else S.hist.push(e);
  if (S.hist.length > 1000) S.hist.shift();
}

// Zeitraffer (ui.js: openTimelapse): Verlauf der Partie, je Runde zu Beginn des Zugs des Menschen und beim Spielende festgehalten.
//   S.tl.from  – Runde, ab der aufgezeichnet wird (ältere Spielstände: ab dem Laden)
//   S.tl.seen  – je Feld die Runde, in der der Mensch es zuerst gesehen hat (0 = nie); Uint16Array, gespeichert als Base64
//   S.tl.own   – echte Besitzwechsel der Städte [Runde, Stadt, Besitzer]; Anfangszustand als Einträge der Runde „from“
//   S.tl.know  – was der Mensch über die Besitzer wusste (knownOwner) [Runde, Stadt, Besitzer]; Anfangszustand wie oben
// Während der Partie zeigt der Zeitraffer nur seen/know (sonst verriete er den Gegner im Nebel), am Ende own und die ganze Karte.
// Bei „Nebel aus“ zählt das echte Kartengedächtnis (P.real).
const TL_MAX_EVENTS = 20000;
function tlState(list, n) {   // Stand nach allen Einträgen einer Liste (Besitzer je Stadt, -2 = noch kein Eintrag)
  const r = new Array(n).fill(-2);
  for (const e of list) r[e[1]] = e[2];
  return r;
}
function recordTimeline() {
  const P = S.players[0], seen = (P.real || P).seen, known = (P.real || P).knownOwner, t = S.turn;
  if (!S.tl || !S.tl.seen || S.tl.seen.length !== seen.length) S.tl = { from: t, seen: new Uint16Array(seen.length), own: [], know: [] };
  const tl = S.tl;
  for (let i = 0; i < seen.length; i++) if (seen[i] && !tl.seen[i]) tl.seen[i] = t;
  const own = tlState(tl.own, S.cities.length), kn = tlState(tl.know, S.cities.length);
  for (const c of S.cities) {
    if (own[c.id] !== c.owner && tl.own.length < TL_MAX_EVENTS) tl.own.push([t, c.id, c.owner]);
    if (known[c.id] !== -2 && kn[c.id] !== known[c.id] && tl.know.length < TL_MAX_EVENTS) tl.know.push([t, c.id, known[c.id]]);
  }
}

// Meldet einmal, wenn ein sichtbares feindliches Schlachtschiff neben einer eigenen Stadt liegt
// (nicht gespeichert: nach dem Laden wird einmal erneut gewarnt)
let batWarned = { game: null, keys: new Set() };
function warnBattleships() {
  if (batWarned.game !== S) batWarned = { game: S, keys: new Set() };
  const P = S.players[0], now = new Set();
  for (const u of S.units) {
    if (u.type !== 'bat' || u.owner === 0 || u.carrier != null || !P.vis[idx(u.x, u.y)]) continue;
    for (const c of S.cities) {
      if (c.owner !== 0 || cheb(u.x, u.y, c.x, c.y) > 1) continue;
      const k = u.id + ':' + c.id;
      now.add(k);
      if (!batWarned.keys.has(k)) addLog(tt(`Feindliches Schlachtschiff bedroht ${c.name}: Die Stadt fällt jetzt leichter (75 %).`,
        `Enemy battleship threatens ${c.name}: the city now falls more easily (75 %).`), 'bad', c.x, c.y);
    }
  }
  batWarned.keys = now;
}

function startTurn(p) {
  S.cur = p;
  for (const u of S.units) {
    if (u.owner !== p) continue;
    const t = T(u);
    u.moves = t.move; u.skip = false;
    if (u.surf) u.surf = false;   // U-Boot taucht wieder ab
    const c = cityAt(u.x, u.y);
    if (c && c.owner === p && u.hp < t.hp && !t.noRepair) u.hp = Math.min(t.hp, u.hp + (t.domain === 'sea' ? 1 : t.hp));
    if (t.domain === 'air' && isBase(u)) u.fuel = t.fuel;
  }
  for (const c of S.cities) {
    if (c.owner !== p || !c.prod) continue;
    if (UT[c.prod].domain === 'sea' && !c.coastal) { c.prod = 'inf'; c.progress = 0; c.rally = null; }
    c.progress += p === 1 ? diff().aiProd : 1;
    if (c.progress >= UT[c.prod].cost) {
      c.progress = Math.max(0, c.progress - UT[c.prod].cost);
      if (S.built) S.built[p][c.prod] = (S.built[p][c.prod] || 0) + 1;
      applyRally(c, createUnit(c.prod, p, c.x, c.y));   // Marschziel der Stadt, falls gesetzt
      if (p === 0) addLog(tt(`${c.name}: ${UT[c.prod].name} fertiggestellt.`, `${c.name}: ${UT[c.prod].name.toLowerCase()} completed.`), '', c.x, c.y);
      else if (typeof aiChooseProduction === 'function') aiChooseProduction(c);
    }
  }
  computeVision(p);
  if (p === 0) { recordStrength(); recordTimeline(); warnBattleships(); }
}

function endTurn(p) {
  for (const u of [...S.units]) {
    if (u.owner !== p || T(u).domain !== 'air' || isBase(u)) continue;
    u.fuel -= Math.max(0, u.moves);
    u.moves = 0;
    if (u.fuel <= 0) {
      if (p === 0) addLog(tt('Dein Jäger ist ohne Treibstoff abgestürzt.', 'Your fighter ran out of fuel and crashed.'), 'bad', u.x, u.y);
      killUnit(u, -1);
    }
  }
}

function isAlive(p) {
  return S.cities.some(c => c.owner === p) || S.units.some(u => u.owner === p && T(u).capture);
}

function checkGameOver() {
  if (S.over) return S.over;
  if (!isAlive(1)) S.over = 'win';
  else if (!isAlive(0)) S.over = 'lose';
  return S.over;
}

// ---------------------------------------------------------------------------
// Speichern / Laden
// ---------------------------------------------------------------------------
const SAVE_KEY = 'archipel-save-v1';          // automatischer Spielstand
const SLOT_INDEX = 'archipel-slots';             // Liste der benannten Spielstände
const SLOT_PREFIX = 'archipel-slot-';
const TYPED = { terrain: Uint8Array, elev: Float32Array, depth: Uint8Array, cont: Int16Array };

// Typed Arrays als Base64 (deutlich kleiner als Zahlenlisten)
function b64(arr) {
  const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(str, Type) {
  const s = atob(str), u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  if (u8.length % Type.BYTES_PER_ELEMENT) throw new Error(tt('Ungültige Daten', 'Invalid data'));
  return new Type(u8.buffer);
}
// liest altes Format (Zahlenliste) und neues (Base64)
const fromSaved = (v, Type) => {
  if (typeof v === 'string') return unb64(v, Type);
  if (Array.isArray(v)) return Type.from(v, x => (Number.isFinite(x) ? x : 0));
  throw new Error(tt('Ungültige Daten', 'Invalid data'));
};

function serialize() {
  const o = { v: 2 };
  for (const k of Object.keys(S)) {
    if (k === 'cityGrid') continue;
    o[k] = TYPED[k] ? b64(S[k]) : S[k];
  }
  if (S.tl) o.tl = { from: S.tl.from, seen: b64(S.tl.seen), own: S.tl.own, know: S.tl.know };   // Zeitraffer
  // Höhe nur für die Grafik: 256 Stufen genügen
  o.elev = { q: b64(Uint8Array.from(S.elev, v => Math.round(Math.max(0, Math.min(1, v)) * 255))) };
  // Sichtbereiche werden beim Laden neu berechnet
  // bei „Nebel aus“ das echte Kartengedächtnis sichern, nicht die aufgedeckte Karte
  o.players = S.players.map(P => ({ seen: b64((P.real || P).seen), knownOwner: b64((P.real || P).knownOwner), intel: P.intel || {} }));
  return JSON.stringify(o);
}

// Ein Spielstand kann aus einer fremden Datei stammen. Deshalb wird beim Laden
// jeder Wert auf Typ und Wertebereich geprüft; Unbekanntes wird verworfen.
// So kann ein präparierter Spielstand keinen Code in die Seite einschleusen.
function sanitizeState(o) {
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  const num = (v, d = 0, lo = -1e9, hi = 1e9) => (isNum(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const int = (v, d = 0, lo = -1e9, hi = 1e9) => Math.trunc(num(v, d, lo, hi));
  const str = (v, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');
  const oneOf = (v, list, d) => (list.includes(v) ? v : d);
  const W = int(o.W, 0), H = int(o.H, 0);
  if (W < 8 || H < 8 || W > 300 || H > 300) throw new Error(tt('Ungültige Kartengröße', 'Invalid map size'));
  const N = W * H;
  for (const k of ['terrain', 'elev', 'depth', 'cont']) if (!o[k] || o[k].length !== N) throw new Error(tt('Ungültige Kartendaten', 'Invalid map data'));
  const inMap = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < W && y < H;
  const pt = v => (Array.isArray(v) && inMap(v[0], v[1]) ? [v[0], v[1]] : null);
  for (let i = 0; i < N; i++) {
    o.terrain[i] = o.terrain[i] ? 1 : 0;
    o.elev[i] = Number.isFinite(o.elev[i]) ? Math.min(1, Math.max(0, o.elev[i])) : 0;
    if (!o.terrain[i] && o.depth[i] < 1) o.depth[i] = 1;   // Wasser hat immer Tiefe ≥ 1 (Farbtabelle)
  }

  const s = {
    W, H, terrain: o.terrain, elev: o.elev, depth: o.depth, cont: o.cont,
    size: oneOf(o.size, Object.keys(MAP_SIZES), 'mittel'),
    difficulty: oneOf(o.difficulty, Object.keys(DIFFICULTY), 'normal'),
    world: oneOf(o.world, Object.keys(WORLDS), 'kontinente'),   // ältere Spielstände: bisherige Welt
    seed: isNum(o.seed) ? int(o.seed, 0, 0, SEED_MAX - 1) : null,   // Kartennummer (ältere Spielstände: unbekannt)
    gameId: typeof o.gameId === 'string' && /^[a-z0-9]{1,24}$/.test(o.gameId) ? o.gameId : null,   // Kennung der Partie (ältere: keine)
    turn: int(o.turn, 1, 1, 1e6), cur: oneOf(o.cur, [0, 1], 0),
    over: oneOf(o.over, ['win', 'lose'], null),
    overReason: oneOf(o.overReason, ['surrender', 'capitulation'], undefined),
    offerPause: int(o.offerPause, 0, 0, 1e6),
  };

  if (!Array.isArray(o.cities) || !o.cities.length || o.cities.length > 2000) throw new Error(tt('Ungültige Städte', 'Invalid cities'));
  s.cities = o.cities.map((c, i) => {
    c = c || {};
    const x = int(c.x, -1), y = int(c.y, -1);
    if (!inMap(x, y)) throw new Error(tt('Ungültige Stadt', 'Invalid city'));
    return { id: i, x, y, name: str(c.name, 40) || 'Stadt ' + (i + 1), owner: oneOf(c.owner, [-1, 0, 1], -1),
      prod: UT[c.prod] ? c.prod : null, progress: num(c.progress, 0, 0, 1000), coastal: !!c.coastal,
      rally: c.owner === 0 ? pt(c.rally) : null };
  });

  const units = [];
  const seenIds = new Set();
  for (const u of Array.isArray(o.units) ? o.units.slice(0, 20000) : []) {
    if (!u || !UT[u.type]) continue;
    const t = UT[u.type], x = int(u.x, -1), y = int(u.y, -1), id = int(u.id, 0, 1, 1e9);
    if (!inMap(x, y) || !id || seenIds.has(id)) continue;
    seenIds.add(id);
    let order = null;
    const od = u.order;
    if (od && od.type === 'sentry') order = { type: 'sentry' };
    else if (od && od.type === 'explore') order = { type: 'explore' };
    else if (od && od.type === 'load' && UT[u.type].carries === 'land') order = { type: 'load' };
    else if (od && od.type === 'goto' && inMap(od.x, od.y)) order = { type: 'goto', x: od.x, y: od.y };
    else if (od && od.type === 'patrol' && Array.isArray(od.pts)) {
      const pts = od.pts.slice(0, 50).map(pt).filter(Boolean), start = pt(od.start);
      if (pts.length && start) order = { type: 'patrol', start, pts, i: int(od.i, 0, 0, pts.length - 1) };
      if (order && od.refuel === true) order.refuel = true;   // Jäger war gerade auf dem Weg zum Tanken
    }
    const nu = { id, type: u.type, owner: oneOf(u.owner, [0, 1], 0), x, y,
      hp: num(u.hp, t.hp, 0.01, t.hp), moves: int(u.moves, 0, 0, t.move), fuel: num(u.fuel, t.fuel || 0, 0, t.fuel || 0),
      carrier: isNum(u.carrier) ? int(u.carrier) : null, order, skip: !!u.skip };
    if (isNum(u.aiTarget)) nu.aiTarget = int(u.aiTarget, 0, 0, s.cities.length - 1);
    if (Array.isArray(u.aiGoal) && pt(u.aiGoal)) nu.aiGoal = [u.aiGoal[0], u.aiGoal[1], oneOf(u.aiGoal[2], ['fog', 'city', 'prey'], 'fog'), int(u.aiGoal[3], 0, 0, s.cities.length - 1)];
    if (isNum(u.wait)) nu.wait = int(u.wait, 0, 0, 1000);
    if (u.surf === true && UT[u.type].stealth) nu.surf = true;
    if (u.dropped === true && UT[u.type].carries) nu.dropped = true;
    if (u.landing === true && UT[u.type].carries === 'land') nu.landing = true;   // „Ausladen, wenn möglich“
    units.push(nu);
  }
  // Ladung nur an existierenden Trägern
  const byId = new Map(units.map(u => [u.id, u]));
  for (const u of units) {
    const c = u.carrier != null && byId.get(u.carrier);
    if (!c || c === u || !UT[c.type].carries) u.carrier = null;
    else { u.x = c.x; u.y = c.y; }
  }
  s.units = units;
  s.nextId = Math.max(int(o.nextId, 1, 1, 2e9), ...units.map(u => u.id + 1), 1);

  s.log = (Array.isArray(o.log) ? o.log.slice(0, 100) : []).filter(l => l && typeof l.text === 'string').map(l => ({
    t: int(l.t, 1, 0, 1e6), text: str(l.text, 300), cls: oneOf(l.cls, ['', 'good', 'bad'], ''),
    x: inMap(l.x, l.y) ? l.x : null, y: inMap(l.x, l.y) ? l.y : null,
  }));
  s.hist = (Array.isArray(o.hist) ? o.hist.slice(-1000) : []).filter(e => e && isNum(e.t)).map(e => ({
    t: int(e.t, 1, 0, 1e6), me: num(e.me, 0, 0, 1e9), en: num(e.en, 0, 0, 1e9),
  }));

  // Statistik der zerstörten Einheiten: je Spieler und Einheitentyp eine Zahl. Ältere Spielstände kennen sie nicht,
  // dort wird erst ab dem Laden gezählt (killsFrom = Runde, ab der die Zahlen gelten).
  const tally = v => [0, 1].map(p => {
    const src = Array.isArray(v) && v[p] && typeof v[p] === 'object' ? v[p] : {}, r = {};
    for (const k of Object.keys(UT)) { const n = int(src[k], 0, 0, 1e6); if (n) r[k] = n; }
    return r;
  });
  s.kills = tally(o.kills); s.wasted = tally(o.wasted);
  s.built = tally(o.built);   // gebaute Einheiten (ältere Spielstände: ab dem Laden)
  s.builtFrom = Array.isArray(o.built) ? int(o.builtFrom, 1, 1, 1e6) : s.turn;
  s.killsFrom = Array.isArray(o.kills) ? int(o.killsFrom, 1, 1, 1e6) : s.turn;

  // Zeitraffer (siehe recordTimeline). Fehlt er oder passt er nicht, beginnt die Aufzeichnung beim Laden neu.
  s.tl = null;
  if (o.tl && typeof o.tl === 'object' && typeof o.tl.seen === 'string') {
    try {
      const seen = unb64(o.tl.seen, Uint16Array);
      if (seen.length === N) {
        const nc = s.cities.length;
        for (let i = 0; i < N; i++) if (seen[i] > s.turn) seen[i] = s.turn;
        const ev = v => (Array.isArray(v) ? v.slice(0, TL_MAX_EVENTS) : [])
          .filter(e => Array.isArray(e) && isNum(e[0]) && isNum(e[1]) && isNum(e[2]) && e[1] >= 0 && e[1] < nc)
          .map(e => [int(e[0], 1, 0, s.turn), int(e[1], 0, 0, nc - 1), int(e[2], -1, -1, 1)])
          .sort((a, b) => a[0] - b[0]);   // der Zeitraffer liest die Einträge der Reihe nach
        s.tl = { from: int(o.tl.from, 1, 1, s.turn), seen, own: ev(o.tl.own), know: ev(o.tl.know) };
      }
    } catch (e) { s.tl = null; }
  }

  if (!Array.isArray(o.players) || o.players.length !== 2) throw new Error(tt('Ungültige Spielerdaten', 'Invalid player data'));
  s.players = o.players.map(P => {
    if (!P || !P.seen || P.seen.length !== N) throw new Error(tt('Ungültige Spielerdaten', 'Invalid player data'));
    const ko = new Int8Array(s.cities.length).fill(-2);
    if (P.knownOwner) for (let i = 0; i < ko.length && i < P.knownOwner.length; i++) ko[i] = Math.min(1, Math.max(-2, P.knownOwner[i]));
    for (let i = 0; i < N; i++) P.seen[i] = P.seen[i] ? 1 : 0;
    const intel = {};
    if (P.intel && typeof P.intel === 'object') for (const [k, v] of Object.entries(P.intel).slice(0, 20000)) if (UT[v] && /^\d+$/.test(k)) intel[k] = v;
    return { seen: P.seen, vis: new Uint8Array(N), sonar: new Uint8Array(N), knownOwner: ko, intel };
  });
  return s;
}

function deserialize(json) {
  const o = JSON.parse(json);
  if (!o || typeof o !== 'object' || !o.terrain || !o.cities || !o.units || !o.players) throw new Error(tt('Kein gültiger Spielstand', 'Not a valid saved game'));
  for (const [k, Type] of Object.entries(TYPED)) {
    if (k === 'elev' && o.elev && typeof o.elev.q === 'string') o.elev = Float32Array.from(unb64(o.elev.q, Uint8Array), v => v / 255);
    else o[k] = fromSaved(o[k], Type);
  }
  if (!Array.isArray(o.players)) throw new Error(tt('Kein gültiger Spielstand', 'Not a valid saved game'));
  o.players = o.players.map(P => ({
    seen: P && P.seen ? fromSaved(P.seen, Uint8Array) : null,
    knownOwner: P && P.knownOwner ? fromSaved(P.knownOwner, Int8Array) : null,
    intel: P && P.intel,
  }));
  const clean = sanitizeState(o);   // wirft bei unbrauchbaren Daten – dann bleibt das alte Spiel erhalten
  S = clean;
  buildCityGrid();
  computeVision(0); computeVision(1);
}

function saveGame(key = SAVE_KEY) {
  try { localStorage.setItem(key, serialize()); return true; } catch (e) { return false; }
}
function loadGame(key = SAVE_KEY) {
  try {
    const j = localStorage.getItem(key);
    if (!j) return false;
    deserialize(j);
    return true;
  } catch (e) { return false; }
}
function hasSave(key = SAVE_KEY) {
  try { return !!localStorage.getItem(key); } catch (e) { return false; }
}

// ---- benannte Spielstände
function saveSummary() {
  return {
    turn: S.turn, size: S.size, difficulty: S.difficulty || 'normal', world: S.world, seed: S.seed, game: S.gameId || null,
    cities: S.cities.filter(c => c.owner === 0).length,
    units: S.units.filter(u => u.owner === 0).length,
    over: S.over || null,
  };
}
function listSlots() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(SLOT_INDEX) || '[]'); } catch (e) {}
  // alten einzelnen Spielstand („Speichern“-Knopf früherer Versionen) übernehmen
  try {
    const old = localStorage.getItem('archipel-manual');
    if (old) {
      const id = 'm' + Date.now().toString(36);
      localStorage.setItem(SLOT_PREFIX + id, old);
      const o = JSON.parse(old);
      list.push({ id, name: tt('Älterer Spielstand', 'Older saved game'), date: Date.now(), turn: o.turn, size: o.size,
        cities: o.cities.filter(c => c.owner === 0).length, units: o.units.filter(u => u.owner === 0).length, over: o.over || null });
      localStorage.setItem(SLOT_INDEX, JSON.stringify(list));
      localStorage.removeItem('archipel-manual');
    }
  } catch (e) {}
  return list.sort((x, y) => y.date - x.date);
}
function writeSlots(list) { localStorage.setItem(SLOT_INDEX, JSON.stringify(list)); }

// speichert unter neuem Namen oder überschreibt (id). Wirft bei vollem Speicher.
function saveSlot(name, id = null) {
  const list = listSlots();
  id = id || 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const data = serialize();
  localStorage.setItem(SLOT_PREFIX + id, data);
  const meta = { id, name: name || 'Spielstand', date: Date.now(), bytes: data.length, ...saveSummary() };
  const i = list.findIndex(s => s.id === id);
  if (i >= 0) list[i] = meta; else list.push(meta);
  writeSlots(list);
  return meta;
}
function loadSlot(id) {
  const j = localStorage.getItem(SLOT_PREFIX + id);
  if (!j) return false;
  deserialize(j);
  return true;
}
function deleteSlot(id) {
  localStorage.removeItem(SLOT_PREFIX + id);
  writeSlots(listSlots().filter(s => s.id !== id));
}
function slotData(id) { return id === 'auto' ? localStorage.getItem(SAVE_KEY) : localStorage.getItem(SLOT_PREFIX + id); }

