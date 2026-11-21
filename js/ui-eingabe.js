'use strict';
// ---------------------------------------------------------------------------
// Oberfläche, Teil 5 von 7 – Eingabe: Maus und Tastatur, Karte ziehen, Kontextmenü, Meldungen, Schummeln, Tastenlegende, Einstiegstipps, Menü der Kopfzeile.
// Die Teile ui-karte.js → ui-zug.js → ui-leiste.js → ui-fenster.js → ui-eingabe.js → ui-schau.js → ui-start.js werden in dieser Reihenfolge geladen und teilen sich
// den globalen Namensraum (wie alle Skripte). Was beim Laden sofort läuft, darf nur Funktionen aus diesem oder einem früheren Teil aufrufen.
// ---------------------------------------------------------------------------

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
  if (gotoPreview) { gotoPreview = null; refresh(); return; }   // Wegvorschau verwerfen
  if (rallyMode) { rallyAbort(); return; }
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
  const status = o => o.order ? (EN ? { sentry: 'sentry', patrol: 'patrol', explore: 'exploring', goto: 'marching', load: 'loading' } : { sentry: 'Wache', patrol: 'Patrouille', explore: 'Erkundet', goto: 'Marsch', load: 'lädt' })[o.order.type] || ''
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
    const chk = orderCheck(u);   // dieselbe Prüfung wie für die Knöpfe der Seitenleiste
    if (units.length <= 1) h += `<div class="cmenu-head"><b>${esc(t.name)}</b> · ${u.moves}/${t.move} ${tt('Bewegung', 'moves')}${t.fuel ? ` · ${tt('Treibstoff', 'fuel')} ${u.fuel}` : ''}</div>`;
    const btn = (act, label, key, dis = false) => `<button data-cact="${act}" ${dis ? 'disabled' : ''}${typeof dis === 'string' ? ` title="${esc(dis)}"` : ''}>${label}${key ? `<kbd>${key}</kbd>` : ''}</button>`;
    h += btn('skip', tt('Überspringen', 'Skip'), tt('Leertaste', 'Space'), chk.skip);
    h += btn('sentry', tt('Wache', 'Sentry'), 'S', chk.sentry);
    h += btn('explore', tt('Erkunden', 'Explore'), 'R', chk.explore);
    h += btn('patrol', tt('Patrouille', 'Patrol'), 'P', chk.patrol);
    h += btn('home', t.domain === 'sea' ? tt('Heimkehr (Hafen)', 'Return home (port)') : tt('Heimkehr', 'Return home'), 'B', chk.home);
    if (t.carries === 'land') h += btn('landing', `${u.landing ? '☑' : '☐'} ${tt('Ausladen, wenn möglich', 'Unload when possible')}`, '', !u.landing && !cargoOf(u).length);
    if (t.carries === 'land') h += btn('load', tt('Laden bis voll', 'Load until full'), 'L', chk.load);
    else if (t.carries && here && here.owner === 0) h += btn('load', tt('Einladen', 'Load'), 'L');
    if (t.carries && cargoOf(u).length) {
      const opts = t.carries === 'land' ? assaultOptions(u) : [], tgt = opts.find(o => o.kind === 'city'), foe = opts.find(o => o.kind === 'unit');
      if (tgt) h += btn('unload', `⚔ ${tt('Angriff auf', 'Attack')} ${esc(tgt.name)} · ${Math.round(tgt.chance * 100)} %`, 'U') + btn('unloadLand', tt('Nur an Land setzen', 'Just put ashore'), '');
      else h += btn('unload', `${tt('Ausladen', 'Unload')} (${cargoOf(u).length})`, 'U');
      if (foe) h += btn('assaultUnit', `⚔ ${tt('Angriff auf', 'Attack')} ${esc(foe.name)} · ${Math.round(foe.chance * 100)} %`, '');
    }
    if (u.order) h += btn('cancel', u.order.type === 'sentry' ? tt('Wecken', 'Wake') : tt('Befehl löschen', 'Clear order'), '');
    h += '<hr>' + btn('help', tt(`Handbuch: ${t.name}`, `Handbook: ${t.name}`), '');
  }
  if (ownCity) {
    const p = ownCity.prod ? UT[ownCity.prod] : null;
    if (u) h += '<hr>';
    h += `<button data-cact="prod"><img src="${iconUrl('c', ownCity.id % 2)}" alt="">${tt('Produktion ändern …', 'Change production …')}<small>${p ? `${esc(p.name)} · ${p.cost - ownCity.progress} ${tt('R.', 'T.')}` : tt('nichts', 'nothing')}</small></button>`;
    if (ownCity.prod) h += `<button data-cact="rally"><span class="cglyph">⚑</span>${ownCity.rally ? tt('Marschziel ändern …', 'Change rally point …') : tt('Marschziel setzen …', 'Set rally point …')}</button>`;
    if (ownCity.rally) h += `<button data-cact="rallyclear"><span class="cglyph">✕</span>${tt('Marschziel löschen', 'Clear rally point')}</button>`;
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
  if (b.dataset.cact === 'rally') { actRally(city); return; }
  if (b.dataset.cact === 'rallyclear') { rallyClear(city); return; }
  if (b.dataset.cact === 'prod') { if (city && city.owner === 0) { Sfx.play('tick'); openProdDialog(city); } return; }
  const u = selUnit();
  if (b.dataset.cact === 'help') { if (u) openHelp(null, u.type); return; }
  if (u && u.order && u.order.type === 'sentry' && b.dataset.cact !== 'sentry' && b.dataset.cact !== 'cancel') u.order = null;
  ({ skip: actSkip, sentry: actSentry, load: actLoad, unload: actUnload, unloadLand: () => actUnload(true), assaultUnit: () => { const tr = selUnit(), o = tr && assaultOptions(tr).find(k => k.kind === 'unit'); if (o) doAssault(tr, o); }, landing: actLanding, cancel: actCancel, patrol: actPatrol, explore: actExplore, home: actHome })[b.dataset.cact]();
});
// Klick daneben schließt das Menü (und löst sonst nichts aus)
document.addEventListener('mousedown', e => {
  if (!cmenu || ctxEl.contains(e.target)) return;
  closeCtx();
  if (e.button === 0 && e.target === cv) ctxSwallow = true;
}, true);
window.addEventListener('resize', closeCtx);
window.addEventListener('blur', closeCtx);
window.addEventListener('blur', () => setLoupe(false));
document.addEventListener('keyup', e => { if (e.key === 'o' || e.key === 'O') setLoupe(false); });
cv.addEventListener('mousedown', e => {
  if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
  dragSwallow = false;
  if (e.button === 0) {
    // Linke Taste: Ein kurzer Klick wählt und zieht wie gewohnt; erst Halten und Ziehen verschiebt die Karte
    // (so lässt sich die Karte auch am Touchpad bewegen).
    drag = { btn: 0, x: e.clientX, y: e.clientY, sl: view.x, st: view.y, moved: false };
    return;
  }
  e.preventDefault();                       // verhindert das Auto-Scrollen
  if (enemyPlaybackRunning()) skipAnim();
  cam.active = false;
  drag = { btn: e.button, x: e.clientX, y: e.clientY, sl: view.x, st: view.y, moved: false };
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < (drag.btn === 0 ? DRAG_THRESHOLD_LEFT : DRAG_THRESHOLD)) return;
  if (!drag.moved) { drag.moved = true; cam.active = false; cv.style.cursor = 'grabbing'; }
  view.x = drag.sl - dx;
  view.y = drag.st - dy;
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
    view.x += e.deltaX; view.y += e.deltaY;
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
  view.x = x * TS - wrap.clientWidth / 2; view.y = y * TS - wrap.clientHeight / 2;
});

$('panel').addEventListener('click', e => {
  const q = e.target.closest('[data-help]');
  if (q) { openHelp(null, q.dataset.help); return; }
  const chip = e.target.closest('[data-unit]');
  if (chip) { const u = unitById(+chip.dataset.unit); if (u) { select(u); refresh(); } return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  ({ skip: actSkip, sentry: actSentry, load: actLoad, unload: actUnload, unloadLand: () => actUnload(true), assaultUnit: () => { const tr = selUnit(), o = tr && assaultOptions(tr).find(k => k.kind === 'unit'); if (o) doAssault(tr, o); }, landing: actLanding, cancel: actCancel, next: actNext, patrol: actPatrol, patrolGo: patrolStart, patrolUndo: patrolUndo, patrolAbort: patrolAbort, explore: actExplore, home: actHome,
    rally: () => actRally(S.cities[selCity]), rallyclear: () => rallyClear(S.cities[selCity]), rallyabort: rallyAbort })[b.dataset.act]();
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
  // Strg+S (Mac: ⌘+S): Spielstandfenster öffnen, im offenen Fenster speichern – statt „Seite speichern“ des Browsers
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    if (!$('mSaves').hidden) $('saveNew').click();
    else if (!anyModalOpen()) { cancelAutoEnd(); closeMenu(); openSaves(); }
    return;
  }
  if (autoEndAt) { if (e.key === 'Enter') { e.preventDefault(); endHumanTurn(); } else cancelAutoEnd(); return; }
  if (enemyPlaybackRunning() && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); skipAnim(); return; }
  const modalOpen = [...document.querySelectorAll('.modal')].some(m => !m.hidden);
  // Esc schließt ein Fenster auch, wenn darin ein Eingabefeld, Häkchen, Regler oder eine Auswahl den Fokus hat (Spielstände:
  // Namensfeld). Nur ein Suchfeld mit Text leert Esc zuerst – wie gewohnt –, das nächste Esc schließt.
  if (modalOpen && e.key === 'Escape' && !(e.target.type === 'search' && e.target.value)) { closeModals(); return; }
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (modalOpen && tlv.modal && !tlv.modal.hidden) {   // Zeitraffer: Leertaste spielt/hält an, Pfeile gehen eine Runde vor/zurück
    if (e.key === ' ') { e.preventDefault(); tlPlay(!tlv.play); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); tlPlay(false); tlSet(tlv.t + (e.key === 'ArrowRight' ? 1 : -1)); return; }
  }
  if (modalOpen) { if (e.key === 'Escape') closeModals(); return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.shiftKey && KEYDIR[k] && k.startsWith('Arrow')) {   // Umschalt + Pfeiltaste: Karte verschieben
    e.preventDefault(); cam.active = false;
    view.x += KEYDIR[k][0] * TS * 3; view.y += KEYDIR[k][1] * TS * 3;
    return;
  }
  if (k === 'v') { setProdView(!prodView); return; }
  if (k === 'g') { setPathView(!pathView); return; }
  if (k === 'k') { setThreatView(!threatView); Sfx.play('tick'); return; }
  if (k === 'o') { if (!e.repeat) setLoupe(true); return; }   // Lupe, solange die Taste gehalten wird (keyup unten)
  if (prodView) {   // in der Produktionsansicht gibt es keine Einheitenbefehle
    if (k === 'Escape') { setProdView(false); return; }
    if (k === 'n') { setProdView(false); actNext(); return; }   // wie der Knopf „Nächste Einheit“
    if (!['+', '-', 'f', 'h', '?', 'm', 'i', 't', 'Enter'].includes(k)) return;
  }
  if (rallyMode) { if (k === 'Escape') rallyAbort(); return; }
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
    case 'f': actFocus(); break;
    case 'l': actLoad(); break;
    case 'u': actUnload(); break;
    case 'Enter': e.preventDefault(); endHumanTurn(); break;
    case 'Escape':
      if (gotoPreview) { gotoPreview = null; refresh(); break; }   // erst nur den festgehaltenen Weg verwerfen, die Einheit bleibt gewählt
      sel = null; selCity = null; refresh(); break;
    case '+': setZoom(TS + 4); break;
    case '-': setZoom(TS - 4); break;
    case 'h': case '?': openHelp(); break;
    case 'm': toggleSound(); break;
    case 'i': openStats(); break;
    case 't': openTimelapse(); break;   // nach dem Spielende: Abschlussfenster
  }
});

$('endTurn').onclick = endHumanTurn;
$('nextUnit').onclick = () => { setProdView(false); actNext(); };
$('vUnits').onclick = () => setProdView(false);
$('vProd').onclick = () => setProdView(true);
// ------------------------------------------------------------------ Schummeln: Nebel aus
// Haken im Menü. Regeln: CHEAT_FOG/computeVision in game.js. Solange er gesetzt ist, steht neben der Rundenzahl ein Schildchen
// „Nebel aus“ – ein Klick darauf schaltet ihn wieder ab. Vor dem Aufdecken fragt das Spiel nach (askCheatFog): Was man einmal
// gesehen hat, weiß man. Deshalb wird der Haken auch nicht gemerkt – jede neue oder geladene Partie beginnt mit Nebel
// (resetCheatFog in startNew/afterLoad).
function setCheatFog(on) {
  CHEAT_FOG = !!on;
  $('cheatFogChk').checked = CHEAT_FOG;
  if (S) { computeVision(0); refresh(); updateHover(); }
}
function resetCheatFog() { CHEAT_FOG = false; $('cheatFogChk').checked = false; }
function askCheatFog() {
  if (!S) return;
  $('offerTitle').textContent = tt('Wirklich die ganze Karte aufdecken?', 'Really reveal the whole map?');
  $('offerText').innerHTML = tt('Du siehst dann alle Inseln und Städte, alle Einheiten des Gegners samt Ladung und Besatzung und jeden seiner Züge.<br><br>Was du einmal gesehen hast, weißt du – auch wenn du den Nebel danach wieder einschaltest. Das kann dir den Spaß an dieser Partie nehmen.',
    'You will then see all islands and cities, all enemy units including cargo and garrisons, and every one of his moves.<br><br>What you have seen once, you know – even if you switch the fog back on afterwards. This can spoil the fun of this game.');
  // der hervorgehobene Knopf ist die sichere Wahl
  $('offerYes').textContent = tt('Nebel behalten', 'Keep the fog');
  $('offerNo').textContent = tt('Ja, aufdecken', 'Yes, reveal');
  $('offerYes').onclick = () => closeModals();
  $('offerNo').onclick = () => { closeModals(); Sfx.play('tick'); setCheatFog(true); };
  openModal('mOffer');
}
try { localStorage.removeItem('archipel-cheat-fog'); } catch (e) {}   // frühere Fassung hat den Haken gemerkt
$('cheatFogChk').checked = false;
$('cheatFogChk').onchange = e => {
  if (!e.target.checked) { setCheatFog(false); return; }
  e.target.checked = false;   // erst nach der Rückfrage
  closeMenu(); closeModals(); askCheatFog();
};

// ------------------------------------------------------------------ Tastenlegende über der Karte
// Einblendbar im Menü (archipel-keys), schließbar mit dem Kreuz. Zeigt die Tastenkürzel passend zur Lage: Was gerade nicht geht
// (keine Einheit ausgewählt, kein Transporter, Produktionsansicht …), ist abgeblendet; beim Festlegen einer Patrouille oder eines
// Marschziels stehen nur dessen Tasten da. Wird in refresh() aufgefrischt. Tasten selbst: keydown-Handler weiter unten.
let showKeys = false;
// Neue Spieler (erster Besuch, Willkommensfenster noch nicht gesehen) bekommen die Legende eingeblendet; die Wahl wird gemerkt,
// wer sie wegklickt, sieht sie nicht wieder. Wer schon spielt und nie etwas eingestellt hat, behält „aus“.
try {
  const v = localStorage.getItem('archipel-keys');
  if (v === null && !welcomeSeen()) { showKeys = true; localStorage.setItem('archipel-keys', '1'); }
  else showKeys = v === '1';
} catch (e) {}
let keysMin = false;   // eingeklappt zum Schildchen „Tasten“ (× an der Legende); showKeys = ganz aus (Einstellungen, Ansicht-Liste)
try { keysMin = localStorage.getItem('archipel-keys-min') === '1'; } catch (e) {}
function setKeysMin(on) { keysMin = !!on; try { localStorage.setItem('archipel-keys-min', keysMin ? '1' : '0'); } catch (e) {} updateKeyLegend(); }
function setShowKeys(on) {
  showKeys = !!on; if (showKeys) keysMin = false;   // Einschalten zeigt sie immer aufgeklappt
  try { localStorage.setItem('archipel-keys', showKeys ? '1' : '0'); } catch (e) {}
  $('keysChk').checked = showKeys;
  updateKeyLegend();
}
function updateKeyLegend() {
  const box = $('keyLegend');
  box.hidden = !showKeys || !S;
  if (box.hidden) return;
  box.classList.toggle('min', keysMin);
  if (keysMin) {   // ein Erstspieler hatte die Legende geschlossen und fand sie nicht wieder: Sie verschwindet nicht mehr, sondern klappt ein
    box.innerHTML = `<button class="kl-open" title="${tt('Tastenkürzel wieder aufklappen', 'Show the shortcuts again')}"><span aria-hidden="true">⌨</span>${tt('Tasten', 'Keys')}</button>`;
    applyKeyPos();
    box.querySelector('.kl-open').onclick = () => { Sfx.play('tick'); setKeysMin(false); };
    return;
  }
  const kb = k => `<kbd>${k}</kbd>`;
  const row = (keys, label, ok = true) => `<div class="kl-row${ok ? '' : ' off'}"><span>${keys}</span>${label}</div>`;
  const grp = (title, rows) => `<div class="kl-g"><h5>${title}</h5>${rows.join('')}</div>`;
  const esc_ = kb('Esc'), enter = kb('Enter');
  let h = `<div class="kl-grip" title="${tt('Ziehen: verschieben · Doppelklick: zurück an den Platz unten links', 'Drag to move · double-click: back to the bottom left')}"></div>`
    + `<button class="kl-x" title="${tt('Einklappen – ein Klick auf „Tasten“ klappt wieder auf', 'Collapse – click “Keys” to open again')}">×</button>`;
  if (patrolMode) {
    h += grp(tt('Patrouille festlegen', 'Setting a patrol'), [
      row(tt('Klick', 'Click'), tt('Wegpunkt setzen', 'add waypoint')),
      row(enter, tt('Patrouille starten', 'start the patrol')),
      row(kb(tt('Rücktaste', 'Backspace')), tt('letzten löschen (auch Rechtsklick)', 'remove last (also right-click)')),
      row(esc_, tt('abbrechen', 'cancel')),
    ]);
  } else if (rallyMode) {
    h += grp(tt('Marschziel setzen', 'Setting a rally point'), [
      row(tt('Klick', 'Click'), tt('Zielfeld wählen', 'choose the destination')),
      row(esc_, tt('abbrechen', 'cancel')),
    ]);
  } else {
    const u = !S.over && !prodView ? selUnit() : null;
    const own = !!u && u.owner === 0;
    const car = own && T(u).carries;
    const chk = own ? orderCheck(u) : {};   // abblenden, was gerade nicht geht – dieselbe Prüfung wie Knöpfe und Menü
    const pad = `<span class="kl-pad">${['Q', 'W', 'E', 'A', '', 'D', EN ? 'Z' : 'Y', 'X', 'C'].map(k => k ? kb(k) : '<i></i>').join('')}</span>`;
    h += grp(tt('Bewegen', 'Move'), [
      row(pad, tt('ziehen (auch Pfeile, Ziffernblock)', 'move (also arrows, numpad)'), own),
      row(kb('⇧') + kb('←'), tt('Karte verschieben', 'pan the map')),
      row(kb('+') + kb('−'), tt('zoomen', 'zoom')),
      row(kb('F'), tt('Einheit zentrieren', 'centre on unit'), !!(selUnit() || selCity != null)),
    ]);
    h += grp(tt('Einheit', 'Unit'), [
      row(kb('N'), tt('nächste Einheit', 'next unit'), !prodView),
      row(kb(tt('Leer', 'Space')), tt('überspringen', 'skip'), own && !chk.skip),
      row(kb('S'), tt('Wache', 'sentry'), own && !chk.sentry),
      row(kb('R'), tt('erkunden', 'explore'), own && !chk.explore),
      row(kb('P'), tt('Patrouille', 'patrol'), own && !chk.patrol),
      row(kb('B'), tt('Heimkehr', 'return home'), own && !chk.home),
      row(kb('L') + kb('U'), car === 'air' ? tt('Jäger laden / ausladen', 'load / unload fighters') : tt('laden / ausladen, Angriff', 'load / unload, attack'), !!car),
    ]);
    h += grp(tt('Ansicht', 'View'), [
      row(kb('V'), prodView ? tt('zurück zur Karte (auch Esc)', 'back to the map (also Esc)') : tt('Produktionsansicht', 'production view')),
      row(kb('G'), tt('Wege einblenden', 'show routes')),
      row(kb('K'), tt('Reichweite der Gegner', 'enemy reach')),
      row(kb('O'), tt('Lupe (halten)', 'magnifier (hold)')),
    ]);
    h += grp(tt('Spiel', 'Game'), [
      row(enter, tt('Runde beenden', 'end turn'), !S.over),
      row(esc_, tt('Auswahl aufheben', 'clear selection')),
      row(kb('H') + kb('I'), tt('Handbuch · Statistik', 'handbook · statistics')),
      row(kb('T'), tt('Zeitraffer der Partie', 'time-lapse of the game')),
      row(kb('M'), tt('Ton an/aus', 'sound on/off')),
      row(kb((navigator.platform.startsWith('Mac') ? '⌘' : tt('Strg', 'Ctrl'))) + kb('S'), tt('Spiel speichern', 'save the game')),
    ]);
  }
  box.innerHTML = h;
  applyKeyPos();
  box.querySelector('.kl-x').onclick = () => setKeysMin(true);
}
// Legende verschieben (Wunsch des Nutzers): am oberen Rand greifen und ziehen; die Stelle wird gemerkt (archipel-keys-pos, Pixel ab der
// linken oberen Ecke der Kartenspalte) und bleibt immer ganz im Kartenbereich – auch wenn das Fenster kleiner wird. Doppelklick auf den
// Griff legt sie zurück nach unten links. Der Inhalt wird bei jedem refresh() neu gebaut, deshalb hängen die Ereignisse an der Legende selbst.
let keyPos = null;
try { const p = JSON.parse(localStorage.getItem('archipel-keys-pos') || 'null'); if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) keyPos = { x: p.x, y: p.y }; } catch (e) {}
function applyKeyPos() {
  const box = $('keyLegend'), col = $('mapCol');
  // Eingeklappt liegt das Schildchen immer unten links (Wunsch des Nutzers: Es hat keinen Griff, und dort sucht man es); aufgeklappt
  // kehrt die Legende an ihre gemerkte Stelle zurück.
  if (!keyPos || keysMin) { box.style.left = box.style.top = box.style.bottom = ''; return; }
  const top0 = $('infoBar').offsetHeight;
  const x = Math.max(0, Math.min(keyPos.x, col.clientWidth - box.offsetWidth)), y = Math.max(top0, Math.min(keyPos.y, col.clientHeight - box.offsetHeight));
  box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.bottom = 'auto';
}
function setKeyPos(p) {
  keyPos = p;
  try { if (p) localStorage.setItem('archipel-keys-pos', JSON.stringify(p)); else localStorage.removeItem('archipel-keys-pos'); } catch (e) {}
  applyKeyPos();
}
{
  const box = $('keyLegend'); let drag = null;
  box.addEventListener('pointerdown', e => {
    if (!e.target.closest('.kl-grip') || e.button !== 0) return;
    const r = box.getBoundingClientRect(), c = $('mapCol').getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, cx: c.left, cy: c.top };
    box.classList.add('drag'); e.preventDefault();
  });
  window.addEventListener('pointermove', e => { if (drag) { keyPos = { x: Math.round(e.clientX - drag.cx - drag.dx), y: Math.round(e.clientY - drag.cy - drag.dy) }; applyKeyPos(); } });
  window.addEventListener('pointerup', () => { if (!drag) return; drag = null; box.classList.remove('drag'); const b = $('keyLegend'); setKeyPos({ x: b.offsetLeft, y: b.offsetTop }); });
  box.addEventListener('dblclick', e => { if (e.target.closest('.kl-grip')) setKeyPos(null); });
  window.addEventListener('resize', () => { if (keyPos) applyKeyPos(); });
}
$('keysChk').checked = showKeys;
$('keysChk').onchange = e => setShowKeys(e.target.checked);
$('routeChk').checked = showRoute;
function setShowRoute(on) { showRoute = !!on; $('routeChk').checked = showRoute; try { localStorage.setItem('archipel-route', showRoute ? '1' : '0'); } catch (err) {} dirty = true; }
$('routeChk').onchange = e => setShowRoute(e.target.checked);

// ------------------------------------------------------------------ Einstiegstipps
// Kleine Hinweise für die ersten Runden (Wunsch des Nutzers: Ein Erstspieler wusste am Anfang nicht, was zu tun ist). Je Tipp eine
// Karte oben links über der Karte, ausgelöst vom Spielstand (when), jeder nur einmal – „Verstanden“ blendet ihn aus, der nächste kommt,
// sobald seine Bedingung zutrifft. Bewusst wenige und kurze: nur die Schritte, um ins Spiel zu kommen. Abschaltbar (Karte und
// Einstellungen → Spielablauf); Einschalten beginnt von vorn. Gemerkt in archipel-tips-on / archipel-tips (erledigte Tipps, über alle
// Partien). Vorgabe: an beim allerersten Besuch, sonst aus (wer das Spiel kennt, bekommt nichts Neues eingeblendet).
const tips = { on: false, done: new Set(), cur: null, cache: null, shown: {} };
try {
  const v = localStorage.getItem('archipel-tips-on');
  if (v === null && !welcomeSeen()) { tips.on = true; localStorage.setItem('archipel-tips-on', '1'); }
  else tips.on = v === '1';
  tips.done = new Set(JSON.parse(localStorage.getItem('archipel-tips') || '[]'));
} catch (e) {}
// Lage für die Bedingungen – nur neu berechnet, wenn sich Runde, Städte oder bekannte Städte ändern (Wegsuche)
function tipState() {
  const P = S.players[0], mine = S.cities.filter(c => c.owner === 0);
  const known = S.cities.filter(c => c.owner !== 0 && P.seen[idx(c.x, c.y)]);
  const key = S.gameId + '|' + S.turn + '|' + mine.length + '|' + known.length;
  if (tips.cache && tips.cache.key === key) return tips.cache;
  // Gibt es eine bekannte fremde Stadt, die Bodentruppen von einer eigenen Stadt aus über Land erreichen?
  let byLand = false;
  for (const c of mine.slice(0, 6)) {
    const probe = { id: -1, type: 'inf', owner: 0, x: c.x, y: c.y, carrier: null, fuel: 0 };
    if (known.some(k => cheb(k.x, k.y, c.x, c.y) <= 14 && (p => p && p.length)(findPath(probe, k.x, k.y, false, 'all')))) { byLand = true; break; }
  }
  // Ist das eigene Land erkundet? Anteil der gesehenen Felder der Landmasse(n) unter den eigenen Städten. Erst dann heißt „keine Stadt
  // mehr über Land“ wirklich „die Insel gehört dir“ – sonst käme der Transporter-Tipp schon, bevor man die Nachbarstadt entdeckt hat.
  const mark = new Uint8Array(S.W * S.H), q = [];
  for (const c of mine) { const i = idx(c.x, c.y); if (!mark[i]) { mark[i] = 1; q.push(i); } }
  let all = 0, seenN = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % S.W, y = (i / S.W) | 0;
    all++; if (P.seen[i]) seenN++;
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, j = ny * S.W + nx; if (inb(nx, ny) && S.terrain[j] === 1 && !mark[j]) { mark[j] = 1; q.push(j); } }
  }
  const explored = all > 0 && seenN / all >= 0.9;
  return (tips.cache = { key, cities: mine.length, port: mine.some(c => c.coastal), byLand, explored,
    neutral: known.some(k => P.knownOwner[k.id] === -1), foe: known.some(k => P.knownOwner[k.id] > 0) });
}
const TIPS = [
  { id: 'start', when: s => S.turn <= 5 && s.cities <= 1,
    text: tt('<b>So geht es los:</b> Deine Infanterie ist schon gewählt (gelber Ring). Ein Klick auf ein Nachbarfeld bewegt sie – oder drück <kbd>R</kbd>, dann erkundet sie von selbst. Hat alles gezogen: <b>Runde beenden</b> (<kbd>Enter</kbd>). Deine Stadt baut derweil die nächste Infanterie.',
      '<b>Getting started:</b> your infantry is already selected (yellow ring). Click an adjacent tile to move it – or press <kbd>R</kbd> and it explores on its own. When everything has moved: <b>End turn</b> (<kbd>Enter</kbd>). Meanwhile your city builds the next infantry.') },
  { id: 'mouse', when: () => S.turn >= 2,
    text: tt('<b>Maus und Karte:</b> <b>Linksklick</b> wählt eine Einheit oder Stadt aus und schickt die gewählte Einheit auf ein Feld. <b>Rechtsklick</b> auf eine eigene Einheit oder Stadt öffnet ihre Befehle, ins Leere hebt er die Auswahl auf. Karte verschieben: Maustaste gedrückt halten und ziehen. Das Mausrad zoomt.',
      '<b>Mouse and map:</b> a <b>left click</b> selects a unit or city and sends the selected unit to a tile. A <b>right click</b> on one of your units or cities opens its orders; on empty ground it clears the selection. To move the map, hold a mouse button and drag. The wheel zooms.') },
  { id: 'capture', when: s => s.neutral && s.byLand && s.cities <= 2,
    text: tt('<b>Städte erobern:</b> Zieh eine Infanterie auf eine graue, neutrale Stadt. Deine ersten beiden neutralen Städte fallen sicher; danach gelingt es in der Hälfte der Fälle. Die Infanterie geht dabei in der Stadt auf oder ist verloren. Darum braucht es Nachschub – schick jede neue Infanterie los.',
      '<b>Capturing cities:</b> move an infantry onto a grey, neutral city. Your first two neutral cities fall for certain; after that it works half of the time. The infantry merges into the city or is lost. So you need a steady supply – send every new infantry out.') },
  { id: 'build', when: s => s.cities >= 2,
    text: tt('<b>Erste Stadt erobert!</b> Die Infanterie ist in der Stadt aufgegangen; die Stadt steht jetzt leer und baut von selbst Infanterie – du musst nichts einstellen. Für den Anfang ist das genau richtig, bis dir alle Städte deiner Insel gehören. Umstellen kannst du es jederzeit: Stadt anklicken und rechts die Produktion wählen.',
      '<b>First city captured!</b> The infantry has merged into the city; the city now stands empty and builds infantry by itself – you do not have to set anything. That is just right to begin with, until every city on your island is yours. You can change it at any time: click the city and choose the production on the right.') },
  { id: 'transport', when: s => s.cities >= 2 && !s.byLand && s.explored && s.port,
    text: tt('<b>Runter von der Insel:</b> Über Land ist nichts mehr zu holen. Stell eine Hafenstadt auf <b>Transporter</b> um – er trägt 6 Bodentruppen übers Meer. Im Hafen laden: <kbd>L</kbd>. An fremder Küste ausladen oder eine Stadt stürmen: <kbd>U</kbd>.',
      '<b>Off the island:</b> there is nothing left to take by land. Switch a port city to <b>transports</b> – one carries 6 land units across the sea. Load in port: <kbd>L</kbd>. Unload on a foreign coast or storm a city: <kbd>U</kbd>.') },
  { id: 'scout', when: s => s.cities >= 2 && !s.byLand && s.explored && s.port,
    text: tt('<b>Die Welt erkunden:</b> Bau auch einen <b>Zerstörer</b> und schick ihn mit <kbd>R</kbd> auf Erkundung. Er findet neue Inseln und den Gegner – und schützt später deine Transporter.',
      '<b>Exploring the world:</b> build a <b>destroyer</b> too and send it exploring with <kbd>R</kbd>. It finds new islands and the enemy – and later protects your transports.') },
  { id: 'enemy', when: s => s.foe || S.units.some(u => u.owner !== 0 && u.carrier == null && canSee(0, u)),
    text: tt('<b>Feindkontakt:</b> Wähl eine Einheit und zeig auf den Gegner – über dem Feld steht deine Siegchance. <kbd>K</kbd> färbt rot, wo er in seinem nächsten Zug angreifen kann. Wer wen schlägt und alles Weitere steht im <b>Handbuch</b> (<kbd>H</kbd>). Viel Erfolg!',
      '<b>Enemy contact:</b> select a unit and point at the enemy – your odds of winning appear above the tile. <kbd>K</kbd> tints red where it can attack on its next turn. Who beats whom and everything else is in the <b>handbook</b> (<kbd>H</kbd>). Good luck!') },
];

// Dazu je ein Tipp zur ersten eigenen Einheit jeder Art (Wunsch des Nutzers) – was sie kann und worauf man achten muss, in zwei, drei
// Sätzen. Zahlen kommen aus den Spieldaten. Die Infanterie erklären schon die Tipps oben.
const TIP_BASE = TIPS.length;
const pctTip = v => Math.round(v * 100) + ' %';
const UNIT_TIPS = {
  tank: tt(`Der <b>Panzer</b> zieht ${UT.tank.move} Felder pro Runde und hält ${UT.tank.hp} Treffer aus. Er erobert Städte wie die Infanterie und geht dabei ebenfalls in der Stadt auf – zum Erobern ist die billigere Infanterie meist die bessere Wahl, der Panzer räumt ihr den Weg frei.`,
    `The <b>tank</b> moves ${UT.tank.move} tiles per turn and takes ${UT.tank.hp} hits. It captures cities like infantry and also merges into the city – for capturing, the cheaper infantry is usually the better choice; the tank clears the way for it.`),
  ftr: tt(`Der <b>Jäger</b> fliegt ${UT.ftr.move} Felder pro Runde, hat aber nur Treibstoff für ${UT.ftr.fuel}. Er muss rechtzeitig in einer eigenen Stadt oder auf einem Träger landen, sonst stürzt er ab – die Wegvorschau warnt, wenn der Rückweg nicht reicht. Ideal zum Erkunden.`,
    `The <b>fighter</b> flies ${UT.ftr.move} tiles per turn but only has fuel for ${UT.ftr.fuel}. It must land in one of your cities or on a carrier in time, or it crashes – the route preview warns when the way back is too far. Ideal for scouting.`),
  trn: tt(`Der <b>Transporter</b> trägt ${UT.trn.capacity} Bodentruppen. Im Hafen: <kbd>L</kbd> lädt, bis er voll ist. Neben fremder Küste: <kbd>U</kbd> lädt aus oder stürmt eine Stadt direkt vom Schiff. Er kann sich nicht wehren – gib ihm ein Kriegsschiff als Schutz mit. Mehr im Handbuch unter „Transporter“.`,
    `The <b>transport</b> carries ${UT.trn.capacity} land units. In port: <kbd>L</kbd> loads until it is full. Next to a foreign coast: <kbd>U</kbd> unloads or storms a city straight from the ship. It cannot defend itself – give it a warship as an escort. More in the handbook under “Transports”.`),
  dst: tt('Der <b>Zerstörer</b> ist schnell und günstig: der beste Erkunder zur See (<kbd>R</kbd>) und Geleitschutz für Transporter. Er ortet getauchte U-Boote und jagt sie. Auf Land und in Städte schießt er nicht.',
    'The <b>destroyer</b> is fast and cheap: the best scout at sea (<kbd>R</kbd>) and an escort for transports. It locates submerged submarines and hunts them. It does not fire at land or into cities.'),
  sub: tt('Das <b>U-Boot</b> ist getaucht unsichtbar, bis ein Gegner direkt daneben steht. Es greift nur Schiffe an – gefährlich für Transporter und große Schiffe, schwach gegen Zerstörer. Nach einem Angriff bleibt es bis zu deiner nächsten Runde aufgetaucht und für alle sichtbar.',
    'The <b>submarine</b> is invisible while submerged until an enemy is right next to it. It only attacks ships – dangerous for transports and big ships, weak against destroyers. After an attack it stays surfaced and visible to all until your next turn.'),
  crs: tt('Der <b>Kreuzer</b> ist robust und vielseitig – das Rückgrat der Flotte. Als eines von zwei Schiffen kann er auch Einheiten an Land und in Städten auf dem Nachbarfeld beschießen. Vor U-Booten braucht er einen Zerstörer als Schutz.',
    'The <b>cruiser</b> is sturdy and versatile – the backbone of the fleet. It is one of two ships that can also fire at units on land and in cities on an adjacent tile. Against submarines it needs a destroyer for protection.'),
  car: tt(`Der <b>Träger</b> greift nie selbst an. Er sieht ${UT.car.vision} Felder weit, und Jäger können auf ihm landen und tanken. Mit einem Jäger an Bord gibt er sich und den eigenen Schiffen nebenan Luftdeckung gegen feindliche Jäger.`,
    `The <b>carrier</b> never attacks by itself. It sees ${UT.car.vision} tiles, and fighters can land and refuel on it. With a fighter on board it gives itself and your ships next to it air cover against enemy fighters.`),
  bat: tt(`Das <b>Schlachtschiff</b> ist das stärkste Schiff. Liegt es neben einer fremden Stadt, erobern deine Truppen sie zu ${pctTip(CAPTURE_BASE + SUPPORT_CAPTURE)} statt ${pctTip(CAPTURE_BASE)}; eine eigene Stadt daneben fällt nur noch zu ${pctTip(CAPTURE_BASE - SUPPORT_CAPTURE)}. Vor U-Booten braucht es Zerstörer als Schutz.`,
    `The <b>battleship</b> is the strongest ship. When it lies next to a foreign city, your troops capture it at ${pctTip(CAPTURE_BASE + SUPPORT_CAPTURE)} instead of ${pctTip(CAPTURE_BASE)}; one of your own cities next to it only falls at ${pctTip(CAPTURE_BASE - SUPPORT_CAPTURE)}. Against submarines it needs destroyers for protection.`),
};
for (const k of UNIT_ORDER) if (UNIT_TIPS[k]) TIPS.push({ id: 'u-' + k, unit: k, when: () => S.units.some(u => u.owner === 0 && u.type === k), text: UNIT_TIPS[k] });
// … und je einer zum ersten Kampfergebnis (Wunsch des Nutzers): nach dem ersten Sieg und nach dem ersten Verlust
const tipSum = (o, keys) => !o ? 0 : (keys || Object.keys(o)).reduce((n, k) => n + (o[k] || 0), 0);
TIPS.push({ id: 'won', head: tt('Erster Sieg', 'First victory'), when: () => tipSum(S.kills && S.kills[0]) > 0,
  text: tt('Im Kampf trifft in jeder Runde eine Seite zufällig, bis eine keine Trefferpunkte mehr hat. Auch der Sieger kann dabei Schaden nehmen – der Balken unter der Marke zeigt ihn. Schiffe werden in einer eigenen Hafenstadt repariert, einen Trefferpunkt je Runde; Panzer lassen sich nicht reparieren.',
    'In combat one side hits at random each round until one has no hit points left. The winner can take damage too – the bar under the badge shows it. Ships are repaired in one of your ports, one hit point per turn; tanks cannot be repaired.') });
// Beladener Transporter versenkt (Wunsch des Nutzers). Das Spiel zählt nicht mit, ob ein Transporter beladen unterging – updateTips merkt
// sich deshalb die eigenen beladenen Transporter und sieht nach, ob einer fehlt (tips.sunk). Der Tipp deckt den „ersten Verlust“ mit ab.
TIPS.push({ id: 'sunk', head: tt('Transporter versenkt', 'Transport sunk'), also: ['lost'], when: () => tips.sunk,
  text: tt('Mit dem Transporter geht die ganze Ladung unter – er kann sich nicht wehren. Gib ihm ein Kriegsschiff als Geleit mit und erkunde die Route vorher. Im eigenen Hafen ist er vor Zerstörern und U-Booten sicher. Verluste gehören dazu: Vor jedem eigenen Angriff zeigt die Karte deine Siegchance über dem Ziel.',
    'When a transport goes down, its whole cargo goes with it – it cannot defend itself. Give it a warship as an escort and scout the route first. In your own port it is safe from destroyers and submarines. Losses are part of the game: before each of your attacks the map shows your odds above the target.') });
// Erste verlorene Stadt (Wunsch des Nutzers) – wie beim Transporter verfolgt updateTips die eigenen Städte (tips.cityLost)
TIPS.push({ id: 'citylost', head: tt('Stadt verloren', 'City lost'), when: () => tips.cityLost,
  text: tt('Der Gegner hat eine deiner Städte erobert – Schiffe, die im Hafen liegen, gehen dabei mit unter. Seine Einheit ist dabei in der Stadt aufgegangen – die Stadt steht also leer und lässt sich zurückerobern. Am besten fängst du Landungen vorher ab: Transporter des Gegners versenken, bevor sie die Küste erreichen.',
    'The enemy has captured one of your cities – ships lying in its port go down with it. His unit merged into the city – so the city stands empty and can be taken back. Best of all, stop landings beforehand: sink enemy transports before they reach the coast.') });
// Erste Stadt, die man einem Gegner abnimmt (Wunsch des Nutzers; tips.foeTaken, Städte der Gegner ebenso verfolgt)
TIPS.push({ id: 'foecity', head: tt('Stadt des Gegners erobert', 'Enemy city captured'), when: () => tips.foeTaken,
  text: tt('Das trifft ihn doppelt: Du baust dort jetzt selbst, und ihm fehlt die Produktion. Hat ein Gegner keine Stadt mehr, scheidet er aus und alle seine Einheiten verschwinden. Rechne aber mit einem Gegenangriff – deine Einheit ist in der Stadt aufgegangen, sie steht leer.',
    'That hurts him twice: you now build there yourself, and he loses the production. An opponent without any city is out, and all his units vanish. But expect a counter-attack – your unit merged into the city, so it stands empty.') });
// Befehle, die man nicht von selbst findet – jeweils in der Lage, in der sie gerade helfen (Patrouille bleibt bewusst im Handbuch:
// keine eindeutige Lage, und das komplizierteste Konzept)
TIPS.push({ id: 'home', head: tt('Treibstoff wird knapp', 'Fuel is running low'),
  when: () => S.units.some(u => u.owner === 0 && u.type === 'ftr' && u.carrier == null && !isBase(u) && u.fuel - Math.max(0, u.moves) < distHome(0, u.x, u.y) + UT.ftr.move),
  text: tt('Ein Jäger muss bald zurück. Wähl ihn aus und drück <kbd>B</kbd> (Heimkehr): Er fliegt von selbst zur nächsten eigenen Stadt oder zum Träger und tankt dort. Rechts siehst du jederzeit „Treibstoff“ und „Nächste Basis“.',
    'A fighter has to head back soon. Select it and press <kbd>B</kbd> (return home): it flies to your nearest city or carrier by itself and refuels there. On the right you can always see “Fuel” and “Nearest base”.') });
TIPS.push({ id: 'sentry', head: tt('Viele Einheiten warten', 'Many units are waiting'), when: () => S.turn >= 8 && S.units.filter(needsOrders).length >= 4,
  text: tt('Nicht jede Einheit braucht jede Runde einen Befehl. <kbd>S</kbd> stellt sie auf <b>Wache</b>: Sie ruht, bis du sie anklickst oder ein Feind auftaucht, und wird nicht mehr abgefragt. Die <kbd>Leertaste</kbd> überspringt eine Einheit nur für diese Runde.',
    'Not every unit needs an order every turn. <kbd>S</kbd> puts it on <b>sentry</b>: it rests until you click it or an enemy shows up, and is no longer asked for orders. The <kbd>space bar</kbd> skips a unit for this turn only.') });
TIPS.push({ id: 'rally', head: tt('Marschziel', 'Rally point'), when: s => s.cities >= 4,
  text: tt('Mit mehreren Städten wird das Einsammeln mühsam. Gib einer Stadt ein <b>Marschziel</b>: Stadt anklicken, rechts „⚑ Marschziel setzen …“ und das Zielfeld anklicken. Jede dort fertige Einheit marschiert dann von selbst dorthin – etwa zum Hafen, in dem der Transporter lädt.',
    'With several cities, gathering units gets tedious. Give a city a <b>rally point</b>: click the city, then “⚑ Set rally point …” on the right and click the target tile. Every unit finished there then marches to it by itself – for example to the port where the transport is loading.') });
TIPS.push({ id: 'plan', head: tt('Den Überblick behalten', 'Keeping track'), when: s => s.cities >= 6,
  text: tt('Was baut gerade wo? Die <b>Produktionsansicht</b> (<kbd>V</kbd>) zeigt auf der Karte, was jede Stadt baut und wie lange es noch dauert; ein Klick auf eine Stadt stellt um. Die <b>Statistik</b> (<kbd>I</kbd>) listet alle Städte und Einheiten in einer Tabelle – auch dort lässt sich die Produktion ändern.',
    'What is being built where? The <b>production view</b> (<kbd>V</kbd>) shows on the map what each city builds and how long it still takes; a click on a city changes it. The <b>statistics</b> (<kbd>I</kbd>) list all cities and units in a table – production can be changed there as well.') });
TIPS.push({ id: 'crash', head: tt('Jäger abgestürzt', 'Fighter crashed'), when: () => tipSum(S.wasted && S.wasted[0], ['ftr']) > 0,
  text: tt(`Der Treibstoff war aufgebraucht. Ein Jäger hat Treibstoff für ${UT.ftr.fuel} Felder und verbraucht ihn auch, wenn er in der Luft stehen bleibt. Er muss rechtzeitig in einer eigenen Stadt oder auf einem Träger landen. Rechts steht bei „Treibstoff“ und „Nächste Basis“, wie viel Luft noch ist; die Wegvorschau warnt mit „kein Rückweg!“.`,
    `It ran out of fuel. A fighter has fuel for ${UT.ftr.fuel} tiles and also burns it while staying in the air – so it has to land in one of your cities or on a carrier in time. On the right, “Fuel” and “Nearest base” show how much margin is left; the route preview warns with “no way back!”.`) });
TIPS.push({ id: 'lost', head: tt('Erster Verlust', 'First loss'), when: () => tipSum(S.lost && S.lost[0]) + tipSum(S.wasted && S.wasted[0], ['inf', 'tank']) > 0,
  text: tt(`Das gehört dazu: Kämpfe und Eroberungen sind Glückssache mit bekannten Chancen. Wähl vor einem Angriff die Einheit und zeig auf das Ziel – über dem Feld steht deine Siegchance. Eine Stadt fällt nur zu ${pctTip(CAPTURE_BASE)}; ein Fehlschlag ist normal, schick die nächste Einheit.`,
    `That is part of it: battles and captures are a matter of luck with known odds. Before attacking, select the unit and point at the target – your odds of winning appear above the tile. A city only falls at ${pctTip(CAPTURE_BASE)}; a failure is normal, send the next unit.`) });
function updateTips() {
  const box = $('tipBox');
  tips.cur = null;
  if (S) {   // beladene eigene Transporter verfolgen: Fehlt einer beim nächsten Mal, ist er mit Ladung untergegangen
    if (tips.game !== S.gameId) { tips.game = S.gameId; tips.loaded = new Set(); tips.sunk = false; tips.mine = new Set(); tips.cityLost = false; tips.foes = new Set(); tips.foeTaken = false; }
    for (const id of tips.foes) if (S.cities[id] && S.cities[id].owner === 0) tips.foeTaken = true;
    tips.foes = new Set(S.cities.filter(c => c.owner > 0).map(c => c.id));
    for (const id of tips.mine) if (S.cities[id] && S.cities[id].owner !== 0) tips.cityLost = true;
    tips.mine = new Set(S.cities.filter(c => c.owner === 0).map(c => c.id));
    const ids = new Set(S.units.map(u => u.id));
    for (const id of tips.loaded) if (!ids.has(id)) tips.sunk = true;
    tips.loaded = new Set(S.units.filter(u => u.owner === 0 && u.type === 'trn' && cargoOf(u).length).map(u => u.id));
  }
  if (tips.on && S && !S.over) {
    // Ein Tipp, der drei Runden unbeachtet stehen blieb, macht Platz (gilt als erledigt) – sonst blockierte er alle folgenden,
    // und wer nie auf „Verstanden“ klickt, sähe das ganze Spiel über denselben ersten Tipp.
    const s = tipState();
    for (let guard = 0; guard < TIPS.length; guard++) {
      tips.cur = TIPS.find(t => !tips.done.has(t.id) && t.when(s)) || null;
      if (!tips.cur) break;
      const k = S.gameId + ':' + tips.cur.id;
      if (tips.shown[k] == null) tips.shown[k] = S.turn;
      if (S.turn - tips.shown[k] < 3) break;
      tips.done.add(tips.cur.id); saveTips();
    }
  }
  box.hidden = !tips.cur;
  if (!tips.cur || box.dataset.id === tips.cur.id) return;
  box.dataset.id = tips.cur.id;
  // neuer Tipp: auffällig einblenden (Klasse neu setzen startet die Animation erneut) und leise melden
  box.classList.remove('tip-new'); void box.offsetWidth; box.classList.add('tip-new');
  clearTimeout(updateTips.t); updateTips.t = setTimeout(() => box.classList.remove('tip-new'), 4500);
  Sfx.play('select');
  const n = TIPS.indexOf(tips.cur) + 1;
  const head = tips.cur.head || (tips.cur.unit ? tt('Neue Einheit', 'New unit') + ' · ' + UT[tips.cur.unit].name : tt('Tipp', 'Tip'));   // ohne „1 / 7“: Die Zahl zählte nur die Grundtipps und verwirrte
  box.innerHTML = `<div class="tip-h">${head}</div><div class="tip-t">${tips.cur.text}</div>`
    + `<div class="tip-b"><button class="primary" data-tip="ok">${tt('Verstanden', 'Got it')}</button><button data-tip="off">${tt('Tipps ausschalten', 'Switch tips off')}</button></div>`;
}
function saveTips() { try { localStorage.setItem('archipel-tips-on', tips.on ? '1' : '0'); localStorage.setItem('archipel-tips', JSON.stringify([...tips.done])); } catch (e) {} }
function setTips(on) {
  tips.on = !!on;
  if (tips.on) { tips.done.clear(); tips.shown = {}; }   // einschalten = von vorn
  $('tipBox').dataset.id = '';
  $('tipsChk').checked = tips.on;
  saveTips(); updateTips();
}
$('tipBox').addEventListener('click', e => {
  const b = e.target.closest('[data-tip]');
  if (!b || !tips.cur) return;
  if (b.dataset.tip === 'off') { setTips(false); toast(tt('Tipps aus – wieder einschalten unter ☰ Menü → Einstellungen → Spielablauf', 'Tips off – switch them on again under ☰ Menu → Settings → Game flow'), 3200); return; }
  tips.done.add(tips.cur.id); for (const id of tips.cur.also || []) tips.done.add(id);
  saveTips(); Sfx.play('tick'); updateTips();
});
$('tipsChk').checked = tips.on;
$('tipsChk').onchange = e => setTips(e.target.checked);

$('powerChk').checked = showPower;
function setShowPower(on) {
  showPower = !!on; $('powerChk').checked = showPower;
  try { localStorage.setItem('archipel-power', showPower ? '1' : '0'); } catch (err) {}
  applyPower(); if (S) updatePower();
}
$('powerChk').onchange = e => setShowPower(e.target.checked);
applyPower();
$('replaySel').value = replay;
$('replaySel').onchange = e => {
  replay = REPLAY[e.target.value] ? e.target.value : 'normal';
  try { localStorage.setItem('archipel-replay2', replay); } catch (err) {}
  if (replay === 'off') skipAnim();   // eine laufende Wiedergabe sofort beenden
};
$('offerSel').value = String(offerPct);
$('offerSel').onchange = e => {
  offerPct = Number(e.target.value) || 0;
  try { localStorage.setItem('archipel-offer', String(offerPct)); } catch (err) {}
  if (S) updatePower();   // die äußeren Einstufungen hängen an der Schwelle
};
$('autoEndChk').checked = autoEnd;
$('autoEndChk').onchange = e => {
  autoEnd = e.target.checked;
  try { localStorage.setItem('archipel-autoend', autoEnd ? '1' : '0'); } catch (err) {}
  if (!autoEnd) cancelAutoEnd();
};
// ------------------------------------------------------------------ Menü der Kopfzeile
// Selten Gebrauchtes liegt im Menü: Neues Spiel, Spielstände (Strg+S), Statistik, Kräfteverhältnis, Zeitraffer und „Einstellungen …“
// (eigenes Fenster). Ein Klick auf einen Eintrag schließt es.
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
  else if (inside && !e.ctrlKey && !e.metaKey) e.stopPropagation();   // Tasten im Menü gehören nicht dem Spiel – Strg+S schon
  else closeMenu();
}, true);
window.addEventListener('resize', closeMenu);

$('bNew').onclick = () => { $('seedIn').value = ''; openModal('mNew'); };
// „Diese Welt noch einmal“: Nummer, Größe und Welt der laufenden Partie eintragen (ältere Spielstände kennen ihre Nummer nicht)
$('seedIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('bStart').click(); } });
$('seedSame').onclick = () => {
  if (!S || S.seed == null) { toast(tt('Diese Partie stammt aus einer älteren Version und hat keine Kartennummer', 'This game comes from an older version and has no map number')); return; }
  // auch die Zahl der Gegner: Sie bestimmt die Startplätze (und kann deshalb eine andere Welt ergeben)
  $('seedIn').value = fmtSeed(S.seed); $('sizeSel').value = S.size; $('worldSel').value = S.world; $('worldSel').onchange();
  fillAiSel(S.players.length - 1);
};
$('bStart').onclick = () => {
  try {
    localStorage.setItem('archipel-diff', $('diffSel').value); localStorage.setItem('archipel-size', $('sizeSel').value);
    localStorage.setItem('archipel-world', $('worldSel').value); localStorage.setItem('archipel-ais', $('aiSel').value);
  } catch (e) {}
  closeModals(); startNew($('sizeSel').value, $('diffSel').value, $('worldSel').value, parseSeed($('seedIn').value), +$('aiSel').value || 1, landPref);   // Landschaft: die eingestellte (gilt dauerhaft, Vorgabe Klimazonen)
  Sfx.play('start');   // nur hier (Klick des Spielers): Browser spielen Ton erst nach einer Benutzeraktion
};
// Zahl der Gegner (1 … MAP_SIZES.maxAi der gewählten Kartengröße); want = gewünschte Zahl, sonst die bisherige Wahl
function fillAiSel(want) {
  const max = (MAP_SIZES[$('sizeSel').value] || MAP_SIZES.mittel).maxAi;
  let cur = want || +$('aiSel').value;
  if (!cur) { try { cur = +localStorage.getItem('archipel-ais') || 1; } catch (e) { cur = 1; } }
  cur = Math.max(1, Math.min(max, cur));
  $('aiSel').innerHTML = Array.from({ length: max }, (_, i) => i + 1).map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${k === 1
    ? tt('1 Gegner', '1 opponent') : tt(`${k} Gegner – jeder gegen jeden`, `${k} opponents – everyone against everyone`)}</option>`).join('');
  aiDesc();
}
function aiDesc() {
  const k = +$('aiSel').value || 1, max = (MAP_SIZES[$('sizeSel').value] || MAP_SIZES.mittel).maxAi;
  const cols = PLAYERS.slice(1, k + 1).map(p => p.name).join(', ');
  $('aiDesc').textContent = (k === 1 ? tt('Du gegen einen Computergegner.', 'You against one computer opponent.')
    : tt(`Jeder gegen jeden: Die Gegner (${cols}) bekämpfen sich auch untereinander. Die Schwierigkeit gilt für alle.`,
      `Everyone against everyone: the opponents (${cols}) also fight each other. The difficulty applies to all of them.`))
    + (max < PLAYERS.length - 1 ? ' ' + tt(`Auf dieser Kartengröße höchstens ${max}.`, `At most ${max} on this map size.`) : '');
}
$('aiSel').onchange = aiDesc;
$('sizeSel').addEventListener('change', () => fillAiSel());
$('diffSel').onchange = () => { $('diffDesc').textContent = DIFFICULTY[$('diffSel').value].desc; };
$('worldSel').onchange = () => { $('worldDesc').textContent = WORLDS[$('worldSel').value].desc; };
$('bOverNew').onclick = () => { closeModals(); $('bNew').onclick(); };
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
