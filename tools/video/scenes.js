// Erklärvideos: Szenen (nur Entwicklung). Laden nach rec.js:
//   (0, eval)(await fetch('/tools/video/scenes.js').then(r => r.text()));
//   await Scenes.landung();   // … feuerschutz, uboot, kueste, luftdeckung, nachschub
// Jede Szene baut sich auf einer erzeugten Karte (Inselreich, mittel) eine passende Stelle, spielt den Ablauf mit
// Texteinblendungen ab und schickt das Video an den Empfänger (docs/videos/<name>.mp4). Danach die Seite neu laden.
// Prozentwerte kommen aus den Spielregeln (attackOdds, captureChance) – nie von Hand eintragen.
window.Scenes = (() => {
  const pc = v => Math.round(v * 100) + ' %';
  const water = (x, y) => inb(x, y) && S.terrain[idx(x, y)] === 0 && S.cityGrid[idx(x, y)] < 0;
  const land = (x, y) => inb(x, y) && S.terrain[idx(x, y)] === 1 && S.cityGrid[idx(x, y)] < 0;
  const nb = (x, y) => DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => inb(a, b));
  const freeOf = (cells, used) => cells.filter(([a, b]) => !used.some(([c, d]) => cheb(a, b, c, d) <= 0));

  // Neue Karte ohne Einheiten, alle Städte neutral und bekannt, alles erkundet
  function fresh(seed) {
    newGame('mittel', 'normal', 'inseln', seed); afterLoad(); setPathView(false); if (TS !== 48) setZoom(48);
    S.units = [];
    for (const c of S.cities) { c.owner = -1; c.rally = null; }
    const P = S.players[0]; P.seen.fill(1);
    sel = null; selCity = null;
  }
  function own(c, p) { c.owner = p; c.prod = 'inf'; c.progress = 0; S.players[0].knownOwner[c.id] = p; }
  function unit(t, p, x, y, cargoOf = null) { const u = createUnit(t, p, x, y); if (cargoOf) { u.carrier = cargoOf.id; u.order = { type: 'sentry' }; } return u; }
  function ready(cx, cy) {
    for (const u of S.units) { u.moves = T(u).move; if (T(u).fuel) u.fuel = T(u).fuel; }
    computeVision(0); computeVision(1); centerOn(cx + 0.5, cy + 1.5, true); refresh();
  }
  // Seeds durchsuchen, bis find() eine Stelle liefert
  function search(find) {
    for (let seed = 1; seed < 200; seed++) {
      fresh(seed);
      const r = find();
      if (r) return r;
    }
    throw new Error('keine passende Stelle gefunden');
  }
  const R = () => Rec;

  // 1. Landung mit Feuerunterstützung
  async function landung() {
    const s = search(() => {
      for (const c of S.cities) {
        if (!c.coastal || nb(c.x, c.y).some(([a, b]) => cityAt(a, b))) continue;
        const w = nb(c.x, c.y).filter(([a, b]) => water(a, b));
        const l = nb(c.x, c.y).filter(([a, b]) => land(a, b));
        if (w.length >= 3 && l.length >= 2) return { c, b: w[0], t: w.find(p => cheb(p[0], p[1], w[0][0], w[0][1]) >= 2) || w[2] };
      }
      return null;
    });
    const { c } = s;
    own(c, 1);
    const g = unit('inf', 1, c.x, c.y); const port = unit('dst', 1, c.x, c.y);
    const bat = unit('bat', 0, s.b[0], s.b[1]);
    const trn = unit('trn', 0, s.t[0], s.t[1]);
    for (let k = 0; k < 3; k++) unit('inf', 0, trn.x, trn.y, trn);
    ready(c.x, c.y);
    const opt = () => assaultOptions(trn).find(o => o.kind === 'city');
    await R().start('landung');
    R().caption('Landung mit Schlachtschiff', 'Landing with a battleship');
    await R().hold(2500);
    sel = bat.id; refresh();
    R().caption('Dein Schlachtschiff liegt direkt neben der feindlichen Stadt. Die Eckwinkel zeigen: Feuerunterstützung.',
      'Your battleship lies right next to the enemy city. The corner brackets show: fire support.');
    await R().hold(4000);
    R().caption(`Die Stadt fällt jetzt zu ${pc(captureChance(0, c))} statt zu 50 %, und deine Truppen treffen dort zu 2/3.`,
      `The city now falls ${pc(captureChance(0, c))} of the time instead of 50 %, and your troops hit 2/3 of the time there.`);
    await R().hold(4000);
    sel = trn.id; refresh();
    R().caption(`Der Transporter stürmt vom Schiff aus: erst den Verteidiger schlagen, dann die Stadt nehmen – ${pc(opt().chance)}.`,
      `The transport storms from the ship: beat the defender first, then take the city – ${pc(opt().chance)}.`);
    await R().hold(2500);
    const trnId = trn.id, cid = c.id;
    await R().act(() => assaultFrom(R().byId(trnId), assaultOptions(R().byId(trnId)).find(o => o.kind === 'city')),
      () => S.cities[cid].owner === 0);
    R().caption('Die Stadt ist erobert. Mit ihr geht die ganze Besatzung unter – auch Schiffe im Hafen.',
      'The city is captured. The whole garrison is lost with it – ships in port too.');
    sel = null; refresh();
    await R().hold(4500);
    R().caption(null);
    await R().hold(600);
    void g; void port;
    return R().finish();
  }

  // 2. Feuerschutz
  async function feuerschutz() {
    const s = search(() => {
      for (const c of S.cities) {
        if (!c.coastal || nb(c.x, c.y).some(([a, b]) => cityAt(a, b))) continue;
        const w = nb(c.x, c.y).filter(([a, b]) => water(a, b));
        const l = nb(c.x, c.y).filter(([a, b]) => land(a, b));
        if (w.length >= 2 && l.length >= 3) return { c, b: w[0], e: l.slice(0, 2) };
      }
      return null;
    });
    const { c } = s;
    own(c, 0);
    unit('inf', 0, c.x, c.y);
    const bat = unit('bat', 0, s.b[0], s.b[1]);
    const e1 = unit('inf', 1, s.e[0][0], s.e[0][1]), e2 = unit('tank', 1, s.e[1][0], s.e[1][1]);
    ready(c.x, c.y);
    const cid = c.id;
    const holds = () => S.cities[cid].owner === 0 && topUnitsAt(S.cities[cid].x, S.cities[cid].y).some(o => o.owner === 0);
    await R().start('feuerschutz');
    R().caption('Feuerschutz durch das Schlachtschiff', 'Covering fire from the battleship');
    await R().hold(2500);
    sel = bat.id; refresh();
    R().caption('Dein Schlachtschiff liegt neben deiner eigenen Stadt. Der gestrichelte Ring zeigt: Feuerschutz.',
      'Your battleship lies next to one of your own cities. The dashed ring shows: covering fire.');
    await R().hold(4000);
    R().caption(`Angreifer treffen deine Truppen dort nur zu 1/3, und die Stadt fällt nur zu ${pc(captureChance(1, c))} statt zu 50 %.`,
      `Attackers hit your troops there only 1/3 of the time, and the city falls only ${pc(captureChance(1, c))} of the time instead of 50 %.`);
    sel = null; refresh();
    await R().hold(4000);
    R().caption(`Feindliche Infanterie greift an – Siegchance ${pc(attackOdds(e1, topUnitsAt(c.x, c.y)[0], c.x, c.y))}.`,
      `Enemy infantry attacks – win chance ${pc(attackOdds(e1, topUnitsAt(c.x, c.y)[0], c.x, c.y))}.`);
    await R().hold(1800);
    await R().act(() => moveStep(R().byId(e1.id), c.x, c.y), holds);
    await R().hold(800);
    R().caption(`Auch der Panzer scheitert meist – ${pc(attackOdds(e2, topUnitsAt(c.x, c.y)[0], c.x, c.y))}.`,
      `The tank usually fails too – ${pc(attackOdds(e2, topUnitsAt(c.x, c.y)[0], c.x, c.y))}.`);
    await R().hold(1500);
    await R().act(() => moveStep(R().byId(e2.id), c.x, c.y), holds);
    R().caption('Ein Schlachtschiff vor der eigenen Küste macht eine Stadt zur Festung.',
      'A battleship off your own coast turns a city into a fortress.');
    await R().hold(4000);
    R().caption(null);
    await R().hold(600);
    return R().finish();
  }

  // offenes Meer w×h (Seeschlachten)
  function openSea(w, h) {
    for (let y = 2; y < S.H - h - 2; y++) for (let x = 2; x < S.W - w - 2; x++) {
      let ok = true;
      for (let j = 0; j < h && ok; j++) for (let i = 0; i < w && ok; i++) if (!water(x + i, y + j)) ok = false;
      if (!ok) continue;
      let l = 0;
      for (let j = -3; j < h + 3; j++) for (let i = -3; i < w + 3; i++) if (inb(x + i, y + j) && S.terrain[idx(x + i, y + j)] === 1) l++;
      if (l >= 30) return { x, y };
    }
    return null;
  }

  // 3. U-Boot und Sonar
  async function uboot() {
    const o = search(() => openSea(10, 7));
    const X = (i, j) => [o.x + i, o.y + j];
    const trn = unit('trn', 0, ...X(1, 2)); for (let k = 0; k < 3; k++) unit('inf', 0, trn.x, trn.y, trn);
    const sub = unit('sub', 1, ...X(5, 2));
    const dst = unit('dst', 0, ...X(2, 4));   // sieht das Feld des Angriffs (2 Felder), ortet das U-Boot vorher aber nicht (3 Felder)
    own(cityNear(o.x, o.y) || S.cities[0], 0);
    ready(o.x + 4, o.y + 2);
    await R().start('uboot');
    R().caption('U-Boot und Sonar', 'Submarine and sonar');
    await R().hold(2500);
    R().caption('Hier lauert ein getauchtes feindliches U-Boot – du siehst es nicht.', 'A submerged enemy submarine lurks here – you cannot see it.');
    await R().hold(3500);
    sel = trn.id; refresh();
    R().caption('Dein Transporter fährt los. Geortet wird ein U-Boot erst aus einem Feld Entfernung.',
      'Your transport sets off. A submarine is only located from one tile away.');
    await R().hold(1500);
    await R().walk(trn.id, [X(2, 2), X(3, 2)]);
    await R().act(() => moveStep(R().byId(trn.id), ...X(4, 2)));
    if (canSee(0, R().byId(sub.id))) Sfx.play('alarm');
    R().caption('Sonarkontakt! Jetzt ist es zu sehen – aber zu spät.', 'Sonar contact! Now it is visible – but too late.');
    sel = null; refresh();
    await R().hold(2500);
    R().caption('Das U-Boot greift an und versenkt den Transporter samt Ladung.', 'The submarine attacks and sinks the transport with its cargo.');
    await R().hold(1200);
    await R().act(() => moveStep(R().byId(sub.id), ...X(4, 2)), () => !R().byId(trn.id));
    R().caption('Nach dem Angriff ist es aufgetaucht (Welle unter dem Boot) – bis zu seinem nächsten Zug für alle sichtbar.',
      'After attacking it has surfaced (wave below the boat) – visible to everyone until its next turn.');
    await R().hold(4000);
    sel = dst.id; refresh();
    const s2 = R().byId(sub.id);
    R().caption(`Der Zerstörer ist der U-Boot-Jäger: Er ortet 2 Felder weit und trifft zuerst – ${pc(attackOdds(dst, s2, s2.x, s2.y))}.`,
      `The destroyer is the submarine hunter: it locates 2 tiles away and strikes first – ${pc(attackOdds(dst, s2, s2.x, s2.y))}.`);
    await R().hold(2500);
    await R().walk(dst.id, [X(3, 3), [s2.x, s2.y]], () => !R().byId(sub.id));
    sel = null; refresh();
    R().caption('Gib Transportern einen Zerstörer als Begleitung mit.', 'Give your transports a destroyer escort.');
    await R().hold(4000);
    R().caption(null);
    await R().hold(600);
    return R().finish();
  }
  function cityNear(x, y) { return S.cities.slice().sort((a, b) => cheb(a.x, a.y, x, y) - cheb(b.x, b.y, x, y))[0]; }

  // 4. Küstenangriff
  async function kueste() {
    const s = search(() => {
      for (let y = 3; y < S.H - 3; y++) for (let x = 3; x < S.W - 3; x++) {
        if (!land(x, y) || !land(x + 1, y)) continue;
        if (nb(x, y).concat(nb(x + 1, y)).some(([a, b]) => cityAt(a, b))) continue;
        const w1 = nb(x, y).filter(([a, b]) => water(a, b) && cheb(a, b, x + 1, y) > 1);
        const w2 = nb(x + 1, y).filter(([a, b]) => water(a, b) && cheb(a, b, x, y) > 1);
        // l3: ein weiteres Landfeld neben dem Kreuzer – dort steht eine Infanterie, die ihn nach dem Beschuss weiter sieht
        for (const v of w2) {
          const l3 = nb(v[0], v[1]).find(([a, b]) => land(a, b) && !(a === x + 1 && b === y) && cheb(a, b, x + 1, y) <= 2 && !(a === x && b === y));
          if (w1.length && l3) return { l1: [x, y], l2: [x + 1, y], w1: w1[0], w2: v, l3 };
        }
      }
      return null;
    });
    const tank = unit('tank', 0, ...s.l1), inf = unit('inf', 0, ...s.l2);
    unit('inf', 0, ...s.l3).order = { type: 'sentry' };
    const dst = unit('dst', 1, ...s.w1), crs = unit('crs', 1, ...s.w2);
    own(cityNear(...s.l1), 0);
    ready(s.l1[0], s.l1[1]);
    await R().start('kueste');
    R().caption('Küstenangriff', 'Coastal attack');
    await R().hold(2500);
    R().caption('Ein feindlicher Zerstörer liegt direkt an deiner Küste.', 'An enemy destroyer lies right off your coast.');
    await R().hold(3000);
    sel = tank.id; refresh();
    R().caption(`Bodentruppen greifen Schiffe auf dem Nachbarfeld mit dreifachem Schaden an: Panzer gegen Zerstörer ${pc(attackOdds(tank, dst, dst.x, dst.y))}.`,
      `Ground troops attack ships on an adjacent tile with triple damage: tank against destroyer ${pc(attackOdds(tank, dst, dst.x, dst.y))}.`);
    await R().hold(3500);
    await R().act(() => moveStep(R().byId(tank.id), ...s.w1), () => !R().byId(dst.id));
    sel = null; refresh();
    await R().hold(1500);
    R().caption('Kreuzer und Schlachtschiffe sind für die Küste gebaut: kein Nachteil – und sie beschießen Einheiten an Land.',
      'Cruisers and battleships are built for the coast: no penalty – and they bombard units on land.');
    await R().hold(3500);
    await R().act(() => moveStep(R().byId(crs.id), ...s.l2), () => !R().byId(inf.id));
    R().caption('Halte Zerstörer, Träger und Transporter von fremden Küsten fern.', 'Keep destroyers, carriers and transports away from enemy coasts.');
    await R().hold(4000);
    R().caption(null);
    await R().hold(600);
    return R().finish();
  }

  // 5. Luftdeckung
  async function luftdeckung() {
    const o = search(() => openSea(10, 7));
    const X = (i, j) => [o.x + i, o.y + j];
    const car = unit('car', 0, ...X(3, 3)); unit('ftr', 0, car.x, car.y, car);
    const t1 = unit('trn', 0, ...X(4, 3)); for (let k = 0; k < 3; k++) unit('inf', 0, t1.x, t1.y, t1);
    const t2 = unit('trn', 0, ...X(7, 5)); for (let k = 0; k < 3; k++) unit('inf', 0, t2.x, t2.y, t2);
    const f1 = unit('ftr', 1, ...X(7, 1)), f2 = unit('ftr', 1, ...X(9, 3));
    own(cityNear(o.x, o.y), 0);
    ready(o.x + 5, o.y + 2);
    await R().start('luftdeckung');
    R().caption('Luftdeckung durch den Träger', 'Air cover from the carrier');
    await R().hold(2500);
    sel = car.id; refresh();
    R().caption('Dein Träger hat einen Jäger an Bord: Er schützt sich und die Schiffe nebenan – gestrichelte Ringe.',
      'Your carrier has a fighter on board: it protects itself and the ships next to it – dashed rings.');
    await R().hold(4000);
    sel = null; refresh();
    R().caption(`Feindliche Jäger treffen dort nur zu 1/3, und selbst ein Transporter wehrt sich: Jäger gewinnt nur zu ${pc(attackOdds(f1, t1, t1.x, t1.y))}.`,
      `Enemy fighters hit only 1/3 of the time there, and even a transport fights back: the fighter wins only ${pc(attackOdds(f1, t1, t1.x, t1.y))}.`);
    await R().hold(2500);
    await R().walk(f1.id, [X(6, 2), X(5, 2), X(4, 3)], () => !R().byId(f1.id) && !!R().byId(t1.id));
    await R().hold(1500);
    R().caption('Der zweite Transporter liegt ohne Schutz – gegen ihn gewinnt ein Jäger immer.',
      'The second transport has no cover – a fighter always beats it.');
    await R().hold(2500);
    await R().walk(f2.id, [X(8, 4), X(7, 5)], () => !R().byId(t2.id));
    R().caption('Schick beladene Transporter mit Träger – und gegen U-Boote mit Zerstörer.',
      'Send loaded transports with a carrier – and with a destroyer against submarines.');
    await R().hold(4000);
    R().caption(null);
    await R().hold(600);
    return R().finish();
  }

  // 6. Nachschub halb automatisch
  async function nachschub() {
    const s = search(() => {
      const probe = { type: 'inf', owner: 0, hp: 1, x: 0, y: 0, carrier: null };
      for (const h of S.cities) {
        if (!h.coastal) continue;
        const w = nb(h.x, h.y).filter(([a, b]) => water(a, b));
        if (!w.length) continue;
        const near = S.cities.filter(c => c !== h && S.cont[idx(c.x, c.y)] === S.cont[idx(h.x, h.y)] && cheb(c.x, c.y, h.x, h.y) >= 2 && cheb(c.x, c.y, h.x, h.y) <= 4)
          .filter(c => { probe.x = c.x; probe.y = c.y; const p = findPath(probe, h.x, h.y, true, 'all'); return p && p.length <= 4; });
        const out = nb(w[0][0], w[0][1]).filter(([a, b]) => water(a, b) && cheb(a, b, h.x, h.y) === 2);
        if (near.length >= 2 && out.length) return { h, a: near[0], b: near[1], w: w[0], out: out[0] };
      }
      return null;
    });
    const { h, a, b } = s;
    for (const c of [h, a, b]) own(c, 0);
    a.rally = [h.x, h.y]; b.rally = [h.x, h.y];
    const trn = unit('trn', 0, ...s.out);
    ready(h.x, h.y);
    setPathView(true);
    await R().start('nachschub');
    R().caption('Nachschub halb automatisch', 'Semi-automatic supply');
    await R().hold(2500);
    R().caption('Gib den Städten der Insel ein Marschziel: den Hafen (gelbes Fähnchen).', 'Give the island\'s cities a rally point: the port (yellow flag).');
    await R().hold(4000);
    R().caption('Jede fertige Infanterie marschiert von selbst dorthin und wartet – Runde für Runde.',
      'Every finished infantry marches there by itself and waits – turn after turn.');
    for (let round = 0; round < 7; round++) {
      await R().act(() => {
        if (round < 2) for (const c of [a, b]) applyRally(c, createUnit('inf', 0, c.x, c.y));
        for (const u of S.units) if (u.owner === 0 && u.order && u.order.type === 'goto') { u.moves = T(u).move; runGoto(u); }
      });
      await R().hold(500);
      if (!S.units.some(u => u.order && u.order.type === 'goto') && round >= 2) break;
    }
    await R().hold(1500);
    sel = trn.id; refresh();
    R().caption('Der Transporter läuft in den Hafen ein und wieder aus – und nimmt alle Wartenden mit.',
      'The transport sails into the port and out again – and takes everyone waiting along.');
    await R().hold(2500);
    const sail = (x, y) => R().act(() => { const t = R().byId(trn.id); t.moves = T(t).move; sailStep(t, x, y); });
    await sail(...s.w);
    await sail(h.x, h.y);
    await R().hold(800);
    await sail(...s.w);
    await sail(...s.out);
    sel = null; refresh();
    R().caption(`Ganz ohne Einladen von Hand: ${cargoOf(R().byId(trn.id)).length} Infanterie an Bord.`, `No loading by hand: ${cargoOf(R().byId(trn.id)).length} infantry on board.`);
    await R().hold(4000);
    R().caption(null);
    await R().hold(600);
    return R().finish();
  }

  // Runde nachstellen (wie startTurn): Bewegung auffüllen, Jäger in einer Basis tanken
  function newRound(units) {
    for (const u of units) { if (!alive(u)) continue; u.moves = T(u).move; if (T(u).fuel && isBase(u)) u.fuel = T(u).fuel; }
  }

  // 7. Jäger: Reichweite, Tanken, Patrouille mit Tankstopp
  async function jaeger() {
    const s = search(() => S.cities.find(c => c.x > 6 && c.x < S.W - 14 && c.y > 6 && c.y < S.H - 8) || null);
    const c = s; own(c, 0);
    const f = unit('ftr', 0, c.x, c.y);
    ready(c.x + 4, c.y);
    const fuel = () => R().byId(f.id).fuel, max = UT.ftr.fuel, mv = UT.ftr.move;
    await R().start('jaeger');
    R().caption('Jäger: Reichweite und Tanken', 'Fighters: range and refuelling');
    await R().hold(2500);
    sel = f.id; refresh();
    R().caption(`Ein Jäger fliegt ${mv} Felder je Runde, hat aber nur Treibstoff für ${max} Felder.`,
      `A fighter flies ${mv} tiles per turn but only has fuel for ${max} tiles.`);
    await R().hold(3500);
    await R().walk(f.id, Array.from({ length: mv }, (_, k) => [c.x + 1 + k, c.y]));
    R().caption(`Noch ${fuel()} Treibstoff, ${mv} Felder bis zur Stadt: Der Rückweg muss immer reichen – sonst stürzt er ab.`,
      `${fuel()} fuel left, ${mv} tiles back to the city: the way back must always fit – or it crashes.`);
    await R().hold(4000);
    newRound([R().byId(f.id)]);
    await R().walk(f.id, Array.from({ length: mv }, (_, k) => [c.x + mv - 1 - k, c.y]));
    newRound([R().byId(f.id)]);
    R().caption(`Zurück in der Stadt: wieder ${fuel()} Treibstoff. Auch ein eigener Träger ist eine Basis zum Tanken.`,
      `Back in the city: ${fuel()} fuel again. Your own carrier is a base for refuelling too.`);
    await R().hold(4000);
    // Patrouille zwischen zwei Wegpunkten draußen – der Jäger tankt zwischendurch selbst
    const A = [c.x + 4, c.y - 2], B = [c.x + 8, c.y + 2];
    R().byId(f.id).order = { type: 'patrol', start: A, pts: [B, A], i: 0 };
    setPathView(true); sel = null; refresh();
    R().caption('Patrouille (türkis): Er fliegt die Wegpunkte von selbst ab, Runde für Runde.', 'Patrol (turquoise): it flies the waypoints by itself, turn after turn.');
    // Phasen: 0 Patrouille, 1 fliegt zum Tanken, 2 hat getankt, 3 wieder unterwegs → Ende
    let phase = 0;
    for (let round = 0; round < 12 && phase < 3; round++) {
      const u = R().byId(f.id); if (!u || !u.order) break;
      newRound([u]);
      if (phase === 1 && isBase(u)) {
        phase = 2;
        R().caption('… tankt auf und setzt die Patrouille danach fort. Er bleibt in der Luft, bis du ihn zurückrufst.',
          '… refuels and then continues the patrol. It keeps flying until you call it back.');
        await R().hold(1500);
      }
      await R().act(() => runPatrol(R().byId(f.id)));
      const w = R().byId(f.id);
      if (phase === 0 && w && w.order && w.order.refuel) {
        phase = 1;
        R().caption('Der Treibstoff wird knapp: Er fliegt von selbst zum Tanken in die Stadt …', 'Fuel is running low: it flies to the city to refuel by itself …');
      } else if (phase === 2 && w && !isBase(w)) phase = 3;
      await R().hold(500);
    }
    await R().hold(3000);
    R().caption(null);
    await R().hold(600);
    return R().finish();
  }

  // 8. Eroberung
  async function eroberung() {
    const s = search(() => {
      const free = c => nb(c.x, c.y).filter(([a, b]) => land(a, b));
      for (const n of S.cities) for (const e of S.cities) {
        if (n === e || S.cont[idx(n.x, n.y)] !== S.cont[idx(e.x, e.y)]) continue;
        const d = cheb(n.x, n.y, e.x, e.y);
        if (d < 3 || d > 6) continue;
        const fn = free(n), fe = free(e).filter(([a, b]) => cheb(a, b, n.x, n.y) > 1);
        if (fn.length >= 2 && fe.length >= 1) return { n, e, i1: fn[0], i2: fn[1], t: fe[0] };
      }
      return null;
    });
    const { n, e } = s;
    own(e, 1); unit('inf', 1, e.x, e.y);
    const i1 = unit('inf', 0, ...s.i1), i2 = unit('inf', 0, ...s.i2), tank = unit('tank', 0, ...s.t);
    own(cityNear(...s.i1) === n || cityNear(...s.i1) === e ? S.cities.find(c => c !== n && c !== e) : cityNear(...s.i1), 0);
    ready((n.x + e.x) / 2, (n.y + e.y) / 2);
    await R().start('eroberung');
    R().caption('Städte erobern', 'Capturing cities');
    await R().hold(2500);
    R().caption(`Eine neutrale Stadt (grau) nehmen Infanterie und Panzer ein – jeder Versuch gelingt zu ${pc(captureChance(0, n))}.`,
      `Infantry and tanks capture a neutral city (grey) – each attempt succeeds ${pc(captureChance(0, n))} of the time.`);
    sel = i1.id; refresh();
    await R().hold(3500);
    const nid = n.id, eid = e.id;
    await R().act(() => moveStep(R().byId(i1.id), n.x, n.y), () => S.cities[nid].owner !== 0);
    R().caption('Gescheitert – die Infanterie ist dabei verloren. Also der nächste Versuch.', 'Failed – the infantry is lost. So the next attempt.');
    sel = i2.id; refresh();
    await R().hold(3000);
    await R().act(() => moveStep(R().byId(i2.id), n.x, n.y), () => S.cities[nid].owner === 0);
    sel = null; refresh();
    R().caption('Erobert! Der Eroberer geht in der Stadt auf – sie gehört jetzt dir und baut für dich.',
      'Captured! The conqueror merges into the city – it is yours now and builds for you.');
    await R().hold(4000);
    const g = topUnitsAt(e.x, e.y)[0];
    R().caption(`Eine besetzte Stadt: erst den Verteidiger schlagen (Panzer ${pc(attackOdds(tank, g, e.x, e.y))}), dann gelingt die Eroberung zu ${pc(captureChance(0, e))}.`,
      `An occupied city: first beat the defender (tank ${pc(attackOdds(tank, g, e.x, e.y))}), then the capture succeeds ${pc(captureChance(0, e))} of the time.`);
    sel = tank.id; refresh();
    await R().hold(4000);
    await R().act(() => moveStep(R().byId(tank.id), e.x, e.y), () => S.cities[eid].owner === 0);
    sel = null; refresh();
    R().caption('Schick lieber mehrere Einheiten los: Jede hat ihre eigene Chance. Angriff lohnt sich mehr als Verteidigung.',
      'Better send several units: each has its own chance. Attacking pays off more than defending.');
    await R().hold(4500);
    R().caption(null);
    await R().hold(600);
    return R().finish();
  }

  // 9. Stege und Stau: zwei Inseln, die sich nur an einer Ecke berühren (wie die Brücken auf dem Festland)
  async function steg() {
    const o = search(() => openSea(14, 9));
    const L = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S.terrain[idx(o.x + x, o.y + y)] = 1; };
    L(1, 1, 5, 4); L(6, 5, 11, 8);            // Ecke: (5,4) berührt (6,5)
    // Geländehöhe: Küste flach, innen etwas höher – sonst wäre alles Sand
    for (let y = 0; y < 10; y++) for (let x = 0; x < 13; x++) {
      const i = idx(o.x + x, o.y + y);
      if (S.terrain[i] !== 1) continue;
      const coast = nb(o.x + x, o.y + y).some(([a, b]) => S.terrain[idx(a, b)] === 0);
      S.elev[i] = coast ? 0.14 : 0.32 + ((x * 7 + y * 3) % 5) * 0.02;
    }
    buildTerrainCache();
    const P = (x, y) => [o.x + x, o.y + y];
    own(cityNear(o.x, o.y), 0);
    const block = unit('inf', 0, ...P(6, 5)); block.order = { type: 'sentry' };
    const col = [unit('inf', 0, ...P(4, 3)), unit('inf', 0, ...P(3, 2)), unit('tank', 0, ...P(2, 1))];
    for (const u of col) u.order = { type: 'goto', x: o.x + 10, y: o.y + 8 };
    const dst = unit('dst', 0, ...P(6, 1));
    ready(o.x + 6, o.y + 4);
    await R().start('steg');
    R().caption('Stege, Brücken und Stau', 'Corner crossings, bridges and jams');
    await R().hold(2500);
    R().caption('Berühren sich zwei Inseln nur an einer Ecke, liegt dort ein Steg (Holzbrett): Schiffe fahren diagonal hindurch …',
      'Where two islands touch only at a corner there is a crossing (wooden plank): ships sail diagonally through it …');
    sel = dst.id; refresh();
    await R().hold(3000);
    await R().walk(dst.id, [P(6, 2), P(6, 3), P(6, 4), P(5, 5)]);
    newRound([R().byId(dst.id)]);
    await R().walk(dst.id, [P(5, 6), P(4, 7)]);
    sel = null; refresh();
    R().caption('… und Bodentruppen gehen diagonal hinüber. Auf dem Festland sind das die Brücken über die Flüsse.',
      '… and ground troops cross diagonally. On the mainland these are the bridges over the rivers.');
    await R().hold(3500);
    setPathView(true); refresh();
    R().caption('Hier steht eine eigene Einheit auf dem Übergang. Die Kolonne marschiert trotzdem los …',
      'Here one of your own units stands on the crossing. The column marches off anyway …');
    await R().hold(2500);
    const goStep = () => R().act(() => { for (const u of S.units) if (u.owner === 0 && u.order && u.order.type === 'goto') { u.moves = T(u).move; runGoto(u); } });
    for (let k = 0; k < 3; k++) { await goStep(); await R().hold(400); }
    R().caption('… rückt bis an den Stau vor und wartet, statt aufzugeben – bis zu 5 Runden.',
      '… advances up to the jam and waits instead of giving up – for up to 5 turns.');
    await R().hold(3500);
    await R().act(() => { const b = R().byId(block.id); b.moves = 1; moveStep(b, ...P(7, 5)); });
    R().caption('Der Übergang ist frei: Die Kolonne zieht weiter.', 'The crossing is clear: the column moves on.');
    for (let k = 0; k < 6; k++) { await goStep(); await R().hold(300); if (!S.units.some(u => u.order && u.order.type === 'goto')) break; }
    await R().hold(3000);
    R().caption(null);
    await R().hold(600);
    return R().finish();
  }

  // 10. Nebel und Erkunden: echter Spielbeginn mit Nebel
  async function nebel() {
    let home = null;
    for (let seed = 3; seed < 80 && !home; seed++) {
      newGame('mittel', 'normal', 'inseln', seed); afterLoad(); setPathView(false);
      home = S.cities.find(c => c.owner === 0 && c.coastal && c.x > 10 && c.x < S.W - 10 && c.y > 8 && c.y < S.H - 8) || null;
    }
    sel = null; selCity = null;
    setZoom(30);
    const dst = unit('dst', 0, home.x, home.y), ftr = unit('ftr', 0, home.x, home.y);
    const inf = S.units.find(u => u.owner === 0 && u.type === 'inf') || unit('inf', 0, home.x, home.y);
    for (const u of [dst, ftr, inf]) u.order = { type: 'explore' };
    for (const u of S.units) { u.moves = T(u).move; if (T(u).fuel) u.fuel = T(u).fuel; }
    computeVision(0); computeVision(1); centerOn(home.x + 0.5, home.y + 2, true); refresh();
    await R().start('nebel');
    R().caption('Nebel des Krieges und Erkunden', 'Fog of war and exploring');
    await R().hold(2500);
    R().caption('Zu Beginn kennst du nur die Umgebung deiner Stadt. Alles andere liegt im Nebel.',
      'At the start you only know the area around your city. Everything else lies in the fog.');
    await R().hold(3500);
    R().caption('Befehl „Erkunden“ (Taste R): Die Einheiten suchen sich selbst unerforschte Felder – der Jäger kehrt rechtzeitig zum Tanken zurück.',
      '“Explore” order (key R): units seek out unexplored tiles by themselves – the fighter returns in time to refuel.');
    const scouts = [dst.id, ftr.id, inf.id];
    let stopped = false;
    for (let round = 0; round < 8; round++) {
      newRound(S.units.filter(u => u.owner === 0));
      // Entdeckt eine Einheit eine neue Stadt, hält sie an (Spielregel) – dann wie ein Spieler erneut losschicken
      for (const id of scouts) { const u = R().byId(id); if (u && !u.order) { u.order = { type: 'explore' }; } }
      await R().act(() => { for (const id of scouts) { const u = R().byId(id); if (u && u.order && u.order.type === 'explore' && u.carrier == null) runExplore(u); } });
      if (!stopped && scouts.some(id => { const u = R().byId(id); return u && !u.order; })) {
        stopped = true;
        R().caption('Entdeckt eine Einheit eine neue Stadt, hält sie an und meldet sich – dann einfach wieder losschicken.',
          'When a unit discovers a new city it stops and reports – then simply send it off again.');
        await R().hold(1500);
      }
      await R().hold(300);
      if (round === 5) R().caption('Was einmal entdeckt ist, bleibt auf der Karte. Hell ist nur, was deine Einheiten gerade sehen – nur dort erscheinen Gegner.',
        'What has been discovered stays on the map. Only what your units see right now is bright – only there do enemies appear.');
    }
    await R().hold(1500);
    R().caption('Graue Städte sind neutral – leichte Beute für deine Infanterie.', 'Grey cities are neutral – easy prey for your infantry.');
    await R().hold(4000);
    R().caption(null);
    await R().hold(600);
    return R().finish();
  }

  // alle Videos nacheinander; Ergebnis je Szene (oder Fehlertext)
  async function all(list = ['landung', 'feuerschutz', 'uboot', 'kueste', 'luftdeckung', 'nachschub', 'jaeger', 'eroberung', 'steg', 'nebel']) {
    const out = {};
    for (const k of list) { try { out[k] = await api[k](); } catch (e) { out[k] = String(e && e.message || e); } }
    return out;
  }
  const api = { landung, feuerschutz, uboot, kueste, luftdeckung, nachschub, jaeger, eroberung, steg, nebel, all };
  return api;
})();
