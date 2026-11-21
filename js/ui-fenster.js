'use strict';
// ---------------------------------------------------------------------------
// Oberfläche, Teil 4 von 7 – Fenster: Eroberung/Produktion, Handbuch, vorzeitiges Ende, Abschlussfenster, Zeitraffer, neues Spiel.
// Die Teile ui-karte.js → ui-zug.js → ui-leiste.js → ui-fenster.js → ui-eingabe.js → ui-schau.js → ui-start.js werden in dieser Reihenfolge geladen und teilen sich
// den globalen Namensraum (wie alle Skripte). Was beim Laden sofort läuft, darf nur Funktionen aus diesem oder einem früheren Teil aufrufen.
// ---------------------------------------------------------------------------

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
let offerPct = 20;   // Vorgabe; gemessen (288 Partien KI gegen KI): bis 20 % lag das Angebot in 1 von 282 Fällen falsch, siehe CLAUDE.md
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
  tips.game = null;   // geladener Stand: Transporter neu erfassen, sonst gälte ein fehlender als versenkt
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
