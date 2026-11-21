'use strict';
// ---------------------------------------------------------------------------
// Oberfläche, Teil 2 von 7 – Züge und Befehle: Landung, Auswahl und nächste Einheit, automatisches Rundenende, Aktionen, Patrouille, Klick auf die Karte, Wegvorschau, Rundenende.
// Die Teile ui-karte.js → ui-zug.js → ui-leiste.js → ui-fenster.js → ui-eingabe.js → ui-schau.js → ui-start.js werden in dieser Reihenfolge geladen und teilen sich
// den globalen Namensraum (wie alle Skripte). Was beim Laden sofort läuft, darf nur Funktionen aus diesem oder einem früheren Teil aufrufen.
// ---------------------------------------------------------------------------

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

function refresh() { dirty = true; pathCache = null; rallyCache = null; hoverPath = null; orderCache = null; renderMini(); updatePanel(); updateHeader(); updateKeyLegend(); updateTips(); queueSave(); }

// Automatisch speichern nach jeder Änderung (refresh folgt auf jeden Zug, Angriff, Befehl): gebündelt kurz danach und beim Verlassen
// der Seite. Ein Spielstand braucht unter 1 ms. So geht beim Neuladen oder Absturz nichts verloren – und ein verlorener Kampf lässt sich
// nicht durch Neuladen wiederholen.
function queueSave() {
  clearTimeout(queueSave.t);
  queueSave.t = setTimeout(() => { if (S) saveGame(); }, 300);
}
let resetting = false;   // „Zurücksetzen“ (ui-schau.js) lädt die Seite neu – dabei darf die Partie nicht wieder gespeichert werden
window.addEventListener('pagehide', () => { clearTimeout(queueSave.t); if (S && !resetting) saveGame(); });

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

// Welche Befehle sind für die Einheit gerade möglich? Je Befehl null (geht) oder der Grund, warum nicht. EINE Stelle für alle, die das
// wissen müssen: Knöpfe der Seitenleiste (grau, Grund als Hinweistext), Rechtsklick-Menü, Tastenlegende und die Befehle selbst (Meldung
// beim Tastendruck). Vorher entschied jede Stelle für sich – das Menü blendete ab, die Seitenleiste nicht. Neue Befehle hier eintragen.
// „Erkunden“ und „Heimkehr“ brauchen je eine Wegsuche; das Ergebnis gilt, bis sich an der Einheit etwas ändert (orderCache, refresh() verwirft).
let orderCache = null;
function orderCheck(u) {
  const t = T(u), cargo = cargoOf(u).length, aboard = u.carrier != null;
  const key = [u.id, u.x, u.y, u.moves, u.fuel, u.order ? u.order.type : '', cargo, u.carrier, S.turn].join();
  if (orderCache && orderCache.key === key) return orderCache;
  const r = { key, skip: null, sentry: null, patrol: null, explore: null, home: null, load: null, homeAt: null };
  if (u.moves <= 0 && !landingPending(u)) r.skip = tt('Keine Züge mehr in dieser Runde', 'No moves left this turn');
  if (u.order && u.order.type === 'sentry') r.sentry = tt('Hält schon Wache', 'Already on sentry');
  if (aboard) r.patrol = tt('Erst ausladen, dann Patrouille festlegen', 'Unload first, then set a patrol');
  // Erkunden
  if (aboard && t.domain === 'land') r.explore = tt('Erst ausladen, dann erkunden', 'Unload first, then explore');
  else if (u.type === 'trn' && cargo) r.explore = tt('Transporter mit Ladung erkunden nicht selbstständig', "Loaded transports don't explore on their own");
  else {
    const air = t.domain === 'air', reach = air ? Math.max(1, Math.floor((u.fuel - t.move) / 2)) : 60, any = p => p && p.length;
    if (!any(explorePath(u, reach)) && !any(explorePath(u, reach, false)))
      r.explore = air ? tt('Nichts Unbekanntes mehr in Reichweite', 'Nothing unknown left in range') : tt('Hier gibt es nichts mehr zu erkunden', 'Nothing left to explore here');
  }
  // Heimkehr: nächste erreichbare eigene Stadt (Schiffe: Hafenstadt)
  const homeOk = c => c && c.owner === 0 && (t.domain !== 'sea' || c.coastal);
  if (!aboard && homeOk(cityAt(u.x, u.y))) r.home = t.domain === 'sea' ? tt('Liegt schon im Hafen', 'Already in port') : tt('Steht schon in einer eigenen Stadt', 'Already in one of your cities');
  else {
    const path = bfs(u.x, u.y, makePassable(u, false, true), (x, y) => homeOk(cityAt(x, y)));
    if (!path) r.home = t.domain === 'sea' ? tt('Kein eigener Hafen erreichbar', 'No port of yours in reach') : tt('Keine eigene Stadt erreichbar', 'None of your cities in reach');
    else {
      const [x, y] = path[path.length - 1];
      // Nicht losschicken, wenn der Treibstoff nicht reicht: Der Rest bleibt dem Spieler (z. B. zum Erkunden)
      if (t.fuel && path.length > u.fuel) r.home = tt(`Treibstoff reicht nicht: ${cityAt(x, y).name} ist ${path.length} Felder entfernt, Treibstoff für ${u.fuel}`,
        `Not enough fuel: ${cityAt(x, y).name} is ${path.length} tiles away, fuel for ${u.fuel}`);
      else r.homeAt = [x, y];
    }
  }
  // Laden (Transporter: Dauerbefehl „Laden bis voll“)
  if (t.carries === 'land') {
    if (cargo >= t.capacity) r.load = tt('Der Transporter ist schon voll', 'The transport is already full');
    else if (u.order && u.order.type === 'load') r.load = tt('Lädt bereits, bis er voll ist', 'Already loading until full');
  }
  return (orderCache = r);
}
// Befehl nicht möglich: Grund melden (Tastendruck auf einen Befehl, den der graue Knopf schon ausschließt)
function orderDenied(why) { if (!why) return false; toast(why, 2600); Sfx.play('error'); return true; }

// Ohne Züge gibt es nichts zu überspringen: Die Leertaste geht dann nur still zur nächsten Einheit weiter (keine Fehlermeldung – man drückt sie oft)
function actSkip() { const u = selUnit(); if (!u) return; Sfx.play('tick'); if (!orderCheck(u).skip) u.skip = true; if (!selectNext()) sel = null; refresh(); scheduleAutoEnd(); }
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
  if (orderDenied(orderCheck(u).load)) return;
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
  const chk = orderCheck(u);
  if (orderDenied(chk.home)) return;
  Sfx.play('select');
  doGoto(u, chk.homeAt[0], chk.homeAt[1]);
}
function actCancel() { const u = selUnit(); if (u) { u.order = null; refresh(); } }

// ------------------------------------------------------------------ Patrouille
function actExplore() {
  const u = selUnit(); if (!u) return;
  // Nichts mehr zu entdecken, an Bord, beladener Transporter: gleich sagen und den Befehl gar nicht erst geben (orderCheck) – wie
  // „Heimkehr“ in der eigenen Stadt. Vorher stand „Erkundung beendet“ nur in den Meldungen.
  if (orderDenied(orderCheck(u).explore)) return;
  u.order = { type: 'explore' };
  Sfx.play('select');
  animBegin(120);
  runExplore(u);
  animEnd();
  afterAction(u);
}

function actPatrol() {
  const u = selUnit(); if (!u) return;
  if (orderDenied(orderCheck(u).patrol)) return;
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
  // Der Rundenwechsel selbst steht bei den Regeln (game.js: nextRound, runStandingOrders) – hier nur, was die Zeitleiste dazu braucht.
  // Alle Computergegner nacheinander (jeder gegen jeden); anim.phases merkt, ab wann wer zieht
  if (nextRound(p => anim.phases.push({ at: anim.cursor, p }))) {
    // Ab hier folgen in der Zeitleiste die eigenen Einheiten mit ihren Befehlen – der Hinweis über der Karte wechselt dann
    const ownMark = anim.cursor, ownCount = anim.events.length;
    runStandingOrders(0, landingUpdate);   // landingUpdate: „Ausladen, wenn möglich“ weckt Truppen an der Küste, damit sie als wartend zählen
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
