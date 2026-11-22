'use strict';
// ---------------------------------------------------------------------------
// Oberfläche, Teil 3 von 7 – Seitenleiste: Einheiten- und Stadtkarte, Produktion, Kräfteverhältnis.
// Die Teile ui-karte.js → ui-zug.js → ui-leiste.js → ui-fenster.js → ui-eingabe.js → ui-schau.js → ui-start.js werden in dieser Reihenfolge geladen und teilen sich
// den globalen Namensraum (wie alle Skripte). Was beim Laden sofort läuft, darf nur Funktionen aus diesem oder einem früheren Teil aufrufen.
// ---------------------------------------------------------------------------

// ------------------------------------------------------------------ Seitenleiste
function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

function unitChip(o) {
  const st = o.order ? ({ sentry: tt(' · Wache', ' · sentry'), patrol: tt(' · Patrouille', ' · patrol'), explore: tt(' · Erkundet', ' · exploring'), load: tt(' · lädt', ' · loading') }[o.order.type] || tt(' · Marsch', ' · marching')) : '';
  return `<span class="chip ${o.moves <= 0 ? 'done' : ''} ${o.id === sel ? 'cur' : ''}" data-unit="${o.id}">${esc(T(o).name)} ${o.hp}/${T(o).hp}${st}</span>`;
}

const iconCache = {};
function iconUrl(kind, v) {
  const key = kind + v + gfxSet();   // Grafik-Set (Inselwelt, Weltraum) folgt der Landschaft
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
    // Befehle, die gerade nichts bewirken, sind grau; der Hinweistext nennt dann den Grund statt der Taste (orderCheck in ui-zug.js)
    const chk = orderCheck(u);
    const ab = (act, label, tip) => `<button data-act="${act}" ${chk[act] ? 'disabled' : ''} title="${esc(chk[act] || tip)}">${label}</button>`;
    h += `<div class="row">` + ab('skip', tt('Überspringen', 'Skip'), tt('Leertaste', 'Space')) + ab('sentry', tt('Wache', 'Sentry'), 'S')
      + ab('patrol', tt('Patrouille', 'Patrol'), 'P') + ab('explore', tt('Erkunden', 'Explore'), 'R')
      + ab('home', tt('Heimkehr', 'Return home'), t.domain === 'sea' ? tt('B – zur nächsten eigenen Hafenstadt', 'B – to your nearest port') : tt('B – zur nächsten eigenen Stadt', 'B – to your nearest city'));
    if (u.order) h += `<button data-act="cancel">${tt('Befehl löschen', 'Clear order')}</button>`;
    const c = cityAt(u.x, u.y);
    // Transporter: „Laden bis voll“ geht überall (Stadt und Nachbarfelder); Träger laden wie bisher nur in der eigenen Stadt
    if (t.carries === 'land') h += `<button data-act="load" ${chk.load ? 'disabled' : ''} title="${chk.load ? esc(chk.load) : tt('L – bleibt liegen, bis er voll ist, und nimmt wartende Bodentruppen aus seiner Stadt und von den Nachbarfeldern an Bord. Ohne diesen Befehl nimmt er beim Verlassen einer eigenen Stadt mit, was dort wartet.', 'L – stays put until full, taking waiting land units on board from its city and the adjacent tiles. Without this order it takes along whatever is waiting when it leaves one of your cities.')}">${tt('Laden bis voll', 'Load until full')}</button>`;
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
// Ausgeschaltet verschwindet nur der Balken; der Menüeintrag „Kräfteverhältnis“ bleibt – er öffnet erst auf Wunsch das Fenster
function applyPower() { $('power').style.display = showPower ? '' : 'none'; }
// Einstufung nach deinem Anteil (du gegen den stärksten Gegner). Die äußeren Stufen hängen an der Schwelle fürs vorzeitige Ende (offerPct,
// Wunsch des Nutzers): „Erdrückend überlegen“ genau dort, wo der Sieg angeboten wird, „Aussichtslos“ dort, wo das Aufgeben angeboten wird – mit
// denselben Vergleichen wie maybeOfferEnd (> bzw. <). Ist das Angebot aus („nie“), gilt 10 %. „Klar“ und „stark“ liegen in der Mitte dazwischen.
function verdictBands() {
  const lo = (offerPct || 10) / 100, hi = 1 - lo;
  return { hi, clear: (0.55 + hi) / 2, ahead: 0.55, even: 0.45, behind: (0.45 + lo) / 2, lo };
}
function verdictOf(share) {
  const b = verdictBands();
  return share > b.hi ? [tt('Erdrückend überlegen', 'Overwhelming'), 'up'] : share >= b.clear ? [tt('Klar überlegen', 'Clearly ahead'), 'up'] : share >= b.ahead ? [tt('Überlegen', 'Ahead'), 'up']
    : share > b.even ? [tt('Ausgeglichen', 'Even'), 'flat'] : share > b.behind ? [tt('Unterlegen', 'Behind'), 'down'] : share >= b.lo ? [tt('Stark unterlegen', 'Far behind'), 'down'] : [tt('Aussichtslos', 'Hopeless'), 'down'];
}
// Balken: je Partei ein Abschnitt in ihrer Farbe mit ihrem Anteil an ALLEN Städten, die neutralen grau (Wunsch des Nutzers) – so sieht man auch,
// wie weit die Partie ist. Einschätzung („Überlegen“ …), Kurve und Trend rechnen nur mit den vergebenen Städten. Ohne Zahlen in den Abschnitten
// (Wunsch des Nutzers: der Anteil an allen Städten sagte wenig und passte nicht zur Schwelle fürs vorzeitige Ende, die mit „du gegen den
// stärksten Gegner“ rechnet) – die Städtezahlen stehen im Hinweistext, die ganze Rechnung im Fenster (Klick).
function updatePower() {
  const multi = nPlayers() > 2, cc = cityCounts(), sh = cityShares(cc), en = strongestEnemy();
  const bar = $('powerMe').parentElement;
  bar.classList.add('multi');   // immer Abschnitte (seit dem Städteanteil auch im Zweikampf, wegen des grauen Abschnitts)
  const segs = cc.c.map((v, p) => ({ p, v, w: sh.of[p] * 100 })).filter(s => s.p === 0 || isAlive(s.p));
  segs.push({ p: -1, v: cc.n, w: sh.neutral * 100 });
  let left = 0, h = '';
  for (const s of segs) {
    if (s.w <= 0) continue;
    const bg = s.p < 0 ? 'repeating-linear-gradient(135deg, #565d67 0 6px, #4d545d 6px 12px)' : `linear-gradient(90deg, ${PLAYERS[s.p].dark}, ${PLAYERS[s.p].color})`;
    h += `<i style="left:${left.toFixed(2)}%;width:${s.w.toFixed(2)}%;background:${bg}"></i>`;
    left += s.w;
  }
  $('powerSegs').innerHTML = h;
  const share = sh.vs, pct = Math.round(share * 100), mine = sh.mine;
  const owned = cc.c.reduce((a, b) => a + b, 0), alive = cc.c.filter((v, p) => p === 0 || isAlive(p)).length;
  const v = !owned || cc.c[0] + Math.max(0, ...cc.c.slice(1)) === 0 ? [tt('Offen', 'Open'), 'flat']
    : verdictOf(share);
  $('powerVerdict').textContent = v[0]; $('powerVerdict').className = v[1];
  // Trend gegenüber dem Beginn der letzten Runde (dein Anteil an den vergebenen Städten)
  const hist = (S.hist || []).filter(e => Array.isArray(e.c) && e.c.length === nPlayers());
  const prev = [...hist].reverse().find(e => e.t < S.turn);
  const tr = $('powerTrend');
  if (!prev) { tr.textContent = ''; }
  else {
    const d = Math.round((mine - cityShares(prev).mine) * 100);
    tr.textContent = d > 0 ? `▲ +${d} %` : d < 0 ? `▼ ${d} %` : '● ±0';
    tr.className = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    tr.title = tt('Veränderung seit Beginn der letzten Runde', 'Change since the start of the last turn');
  }
  const parts = segs.map(s => s.p < 0 ? tt(`neutral ${s.v}`, `neutral ${s.v}`) : `${s.p === 0 ? tt('Du', 'You') : pname(s.p)} ${s.v}`).join(' · ');
  $('power').title = tt(`Städte: ${parts} (von ${S.cities.length})\n`
    + `Einschätzung „${v[0]}“: du gegen ${multi ? `den stärksten Gegner (${pname(en)})` : 'den Gegner'}, ${cc.c[0]} : ${cc.c[en]} Städte, also ${pct} % : ${100 - pct} %\nKlick: Einzelheiten`,
    `Cities: ${parts} (of ${S.cities.length})\n`
    + `Assessment “${v[0]}”: you against ${multi ? `the strongest enemy (${pname(en)})` : 'the enemy'}, ${cc.c[0]} : ${cc.c[en]} cities, i.e. ${pct} % : ${100 - pct} %\nClick: details`);
  // Kurve und Pfeil (Wunsch des Nutzers): eine Miniatur des Zeitraffers – ein Klick darauf öffnet ihn, eigener Hinweistext
  $('powerFoot').title = tt(`Kurve: dein Anteil an allen vergebenen Städten über die ganze Partie (gestrichelt: ${multi ? `gleiche Anteile, 1/${alive}` : 'Gleichstand'}); Pfeil: seit Beginn der letzten Runde\nKlick: Zeitraffer der Partie (Taste T)`,
    `Curve: your share of all cities taken over the whole game (dashed: ${multi ? `equal shares, 1/${alive}` : 'even'}); arrow: since the start of the last turn\nClick: time-lapse of the game (key T)`);
  drawPowerSpark(hist, mine, multi ? 1 / alive : 0.5);
}

// Fenster „Kräfteverhältnis“ (Klick auf den Balken): Städte je Partei, neutrale, Anteile und wie gezählt wird. Seit dem Städteanteil gibt es
// nichts mehr zu verbergen: Der Balken zeigt die Städtezahl des Gegners ohnehin.
function renderPower() {
  const multi = nPlayers() > 2, en = strongestEnemy(), cc = cityCounts(), sh = cityShares(cc), total = S.cities.length;
  const pct = Math.round(sh.vs * 100), owned = cc.c.reduce((a, b) => a + b, 0);
  const box = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  const row = (l, ...cells) => `<tr><td>${l}</td>${cells.map(c => `<td class="num">${c}</td>`).join('')}</tr>`;
  let h = `<div class="stat-summary">${box(cc.c[0], tt(`von ${total} Städten gehören dir`, `of ${total} cities are yours`))}`
    + box(pct + ' %', multi ? tt(`du gegen ${pname(en)}, den stärksten Gegner`, `you vs ${pname(en)}, the strongest enemy`) : tt('deine Städte gegen seine', 'your cities against his'))
    + box(cc.n, tt('neutral', 'neutral')) + box(esc($('powerVerdict').textContent), tt('Lage', 'Situation')) + '</div>';
  const cols = S.players.map((_, p) => p).filter(p => p === 0 || isAlive(p));
  h += `<table class="stat-table"><thead><tr><th></th>${cols.map(p => `<th class="num">${p ? `<i class="pdot" style="background:${PLAYERS[p].color}"></i>` : ''}${esc(pname(p))}</th>`).join('')}<th class="num">${tt('neutral', 'neutral')}</th></tr></thead><tbody>`
    + row(tt('Städte', 'Cities'), ...cols.map(p => `<b>${cc.c[p]}</b>`), cc.n)
    + row(tt('Anteil an allen Städten', 'Share of all cities'), ...cols.map(p => Math.round(sh.of[p] * 100) + ' %'), Math.round(sh.neutral * 100) + ' %')
    + row(tt('Anteil an den vergebenen', 'Share of the cities taken'), ...cols.map(p => (owned ? Math.round(cc.c[p] / owned * 100) : 0) + ' %'), '–')
    + '</tbody></table>';
  // Verweis auf den Zeitraffer (Wunsch des Nutzers): dort steht, wie es dazu kam
  h += `<div class="power-tl"><span>${tt('Wie es dazu kam, zeigt der Zeitraffer: die Karte Runde für Runde, soweit du sie kennst, und die Städte aller Parteien als Kurve.',
    'The time-lapse shows how it came to this: the map turn by turn, as far as you know it, and the cities of all parties as a curve.')}</span>`
    + `<button data-tl>▶ ${tt('Zeitraffer', 'Time-lapse')}</button></div>`;
  const hi = 100 - offerPct;
  h += `<h3>${tt('So wird gezählt', 'How it is counted')}</h3><ul class="power-notes">
    <li>${tt('Gezählt werden nur die Städte – wer alle Städte hat, hat gewonnen. Der Balken zeigt, wie viel von allen Städten jede Partei besitzt; grau sind die neutralen. Einheiten zählen nicht: Eine Flotte auf dem Weg zu dir sieht man am Balken erst, wenn Städte fallen.',
      'Only cities count – whoever holds all cities has won. The bar shows how much of all cities each party owns; the neutral ones are grey. Units do not count: a fleet on its way to you shows on the bar only once cities fall.')}</li>
    <li>${multi ? tt('Die Einschätzung („Überlegen“ …) vergleicht deine Städte mit denen des stärksten Gegners; die Kurve darunter zeigt deinen Anteil an allen vergebenen Städten über die ganze Partie (gestrichelt: gleiche Anteile).',
      'The assessment (“Ahead” …) compares your cities with those of the strongest enemy; the curve below shows your share of all cities taken over the whole game (dashed: equal shares).')
      : tt('Die Einschätzung („Überlegen“ …) und die Kurve vergleichen deine Städte mit denen des Gegners; neutrale zählen dafür nicht. Die Kurve zeigt die ganze Partie.',
      'The assessment (“Ahead” …) and the curve compare your cities with the enemy\'s; neutral cities do not count for it. The curve shows the whole game.')}</li>
    <li>${(() => { const b = verdictBands(), P = v => Math.round(v * 100) + ' %';
      return tt(`Einstufung nach deinem Anteil: über ${P(b.hi)} erdrückend überlegen · ab ${P(b.clear)} klar überlegen · ab ${P(b.ahead)} überlegen · über ${P(b.even)} ausgeglichen · über ${P(b.behind)} unterlegen · ab ${P(b.lo)} stark unterlegen · darunter aussichtslos. Die äußeren Stufen richten sich nach der Schwelle fürs vorzeitige Ende.`,
        `Rating by your share: above ${P(b.hi)} overwhelming · from ${P(b.clear)} clearly ahead · from ${P(b.ahead)} ahead · above ${P(b.even)} even · above ${P(b.behind)} behind · from ${P(b.lo)} far behind · below that hopeless. The outer levels follow the threshold for the early end.`); })()}</li>
    <li>${offerPct ? tt(`Liegt dein Anteil fünf Runden in Folge unter ${offerPct} % oder über ${hi} %, bietet das Spiel das vorzeitige Ende an – frühestens, wenn höchstens die Hälfte der Städte neutral ist (einstellbar unter ☰ Menü → Einstellungen).`,
      `If your share stays below ${offerPct} % or above ${hi} % for five turns in a row, the game offers an early end – at the earliest once at most half of the cities are neutral (adjustable under ☰ Menu → Settings).`)
      : tt('Das Angebot zum vorzeitigen Ende ist ausgeschaltet (☰ Menü → Einstellungen).', 'The early-end offer is switched off (☰ Menu → Settings).')}</li>
  </ul>`;
  $('powerCalc').innerHTML = h;
}
function openPower() { if (!S) return; closeCtx(); renderPower(); openModal('mPower'); }
$('power').onclick = openPower;
$('powerFoot').onclick = e => { e.stopPropagation(); openTimelapse(); };   // Kurve und Pfeil → Zeitraffer (statt Kräftefenster)
$('powerCalc').addEventListener('click', e => { if (e.target.closest('[data-tl]')) { closeModals(); openTimelapse(); } });
$('bPowerMenu').onclick = openPower;

// Verlauf unter dem Balken: dein Anteil an den vergebenen Städten, um die Linie base zentriert (ein Gegner: 50 %; mehrere: gleiche Anteile
// aller noch lebenden Parteien)
function drawPowerSpark(hist, share, base = 0.5) {
  const c = $('powerSpark'), g = c.getContext('2d');
  const w = c.clientWidth || 190, h = 26, dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const pts = hist.filter(e => e.t < S.turn).map(e => cityShares(e).mine);
  pts.push(share);
  // um die Grundlinie zentriert, auf die tatsächliche Schwankung skaliert (mind. ±10 %)
  const dev = Math.max(0.1, ...pts.map(v => Math.abs(v - base))) * 1.15;
  const y = v => h / 2 - (v - base) / dev * (h / 2 - 2);
  g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 1; g.setLineDash([3, 3]);
  g.beginPath(); g.moveTo(0, y(base)); g.lineTo(w, y(base)); g.stroke(); g.setLineDash([]);
  if (pts.length < 2) return;
  const show = pts;   // die ganze Partie (Wunsch des Nutzers; bis dahin nur die letzten 80 Runden – das stand nirgends); die jüngste Bewegung zeigt der Trendpfeil
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
    const pc = Math.round(knownCapture(cc) * 100);   // ein Schlachtschiff in einer Stadt mit verborgener Besatzung zählt nicht (knownCapture)
    if (safeStart(0, cc)) return [pc, tt(' – deine ersten beiden neutralen Städte fallen sicher', ' – your first two neutral cities fall for certain')];
    return [pc, pc > 50 ? tt(' dank Feuerunterstützung durch dein Schlachtschiff', ' thanks to fire support from your battleship')
      : pc < 50 ? tt(' wegen Feuerschutz durch ein feindliches Schlachtschiff', ' because of covering fire from an enemy battleship') : ''];
  };
  if (P.vis[i]) {
    const us = topUnitsAt(x, y).filter(o => canSee(0, o));
    // Vom Gegner nur die Einheit nennen, die das Feld verteidigt – wie viele es sind, bleibt verborgen. In einer fremden Stadt nicht einmal
    // das (garrisonHidden): Wer sie verteidigt, zeigt sich erst im Kampf – deshalb dort auch keine Siegchance.
    const hid = garrisonHidden(x, y);
    const named = S.over || CHEAT_FOG || !us.some(o => o.owner !== 0) ? us : hid ? [] : us.filter(o => o.owner === 0).concat([pickDefender(us.filter(o => o.owner !== 0))]);
    if (named.length) s += ' · ' + named.map(o => `${o.owner === 0 ? '' : tt('Feind: ', 'Enemy: ')}${T(o).name} ${o.hp}/${T(o).hp}${T(o).stealth ? (o.surf ? tt(' (aufgetaucht)', ' (surfaced)') : tt(' (getaucht)', ' (submerged)')) : ''}`).join(', ');
    if (hid) s += tt(' · besetzt – wer die Stadt verteidigt, zeigt sich erst im Kampf', ' · garrisoned – who defends the city only shows in battle');
    const su = selUnit();
    const en = us.filter(o => o.owner !== 0);
    const foes = su ? cityDefenders(su, c, en).filter(o => canStrike(su, o)) : en;   // Schiffe im Hafen verteidigen nicht gegen Bodentruppen; Schiffe ohne Beschuss greifen kein Land an
    const ships = en.length - foes.length;
    const sinkTxt = ships ? tt(' · Schiffe im Hafen gehen mit der Stadt unter', ' · ships in port are lost with the city') : '';   // ohne Anzahl (bleibt verborgen)
    if (hid) {
      if (su && T(su).capture) {
        const [pc, why] = capInfo(c);
        s += tt(` · siegt deine Einheit, fällt die Stadt zu ${pc} %${why}`, ` · if your unit wins, the city falls ${pc} % of the time${why}`);
      }
    } else if (su && foes.length && canAttack(su.type)) {
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
    if (op) s += op.kind === 'city' && garrisonHidden(x, y) ? tt(' · Klick oder U: Die Truppen stürmen vom Schiff aus', ' · Click or U: the troops storm the city from the ship')
      : op.kind === 'city' ? tt(` · Klick oder U: Die Truppen stürmen vom Schiff aus – ${Math.round(op.chance * 100)} %`, ` · Click or U: the troops storm the city from the ship – ${Math.round(op.chance * 100)} %`)
      : tt(` · Klick: Die Truppen greifen vom Schiff aus an – ${Math.round(op.chance * 100)} %`, ` · Click: the troops attack from the ship – ${Math.round(op.chance * 100)} %`);
  }
  $('hover').textContent = s;
}
