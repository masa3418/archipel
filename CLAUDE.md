# Archipel – Hinweise für Claude

Rundenbasiertes Inselstrategiespiel im Browser (inspiriert von „Empire: Wargame of the
Century“, aber eigenständig: kein Name, keine Grafik, kein Code des Originals verwenden).
Repository: https://github.com/masa3418/archipel · Online: https://masa3418.github.io/archipel/
(GitHub Pages baut automatisch aus `main`, Root-Ordner, ca. 1 Minute nach dem Push).

## Zusammenarbeit

- Sprache: **Deutsch** – im Gespräch, in Kommentaren und Commit-Nachrichten. Das Spiel selbst ist
  **zweisprachig (Deutsch/Englisch)**: jeden neuen sichtbaren Text in beiden Sprachen anlegen (siehe unten).
- Der Nutzer interessiert sich für das **Ergebnis**, nicht fürs Programmieren: Änderungen
  selbstständig umsetzen, im Browser prüfen, verständlich (ohne Code-Fachjargon) berichten.
- Spielerische Änderungen (Balancing, KI) per Simulation absichern und Zahlen nennen.
- Committen und pushen nur auf Wunsch (Nutzer sagt z. B. „committe und pushe“).
- **Neue Version nur auf Wunsch** (öffentlicher Release): `VERSION` in `js/data.js` erhöhen, Abschnitt `## X.Y.Z` in
  `CHANGELOG.md` schreiben (deutsch, kurzer englischer Absatz), `node tools/pack.js` lokal prüfen, committen, dann
  `git tag vX.Y.Z && git push origin vX.Y.Z`. Den Rest erledigt GitHub; Ergebnis unter Actions und Releases ansehen.
  Commit-Nachrichten auf Deutsch, kurz, mit Co-Authored-By-Zeile.

## Grundsätze der Technik

- **Keine Abhängigkeiten, kein Build.** Reines HTML/CSS/JavaScript, klassische `<script>`-Tags
  (keine ES-Module), damit `index.html` auch per Doppelklick (`file://`) läuft.
- **Keine Asset-Dateien.** Grafik (`gfx.js`) und Klänge (`sfx.js`) werden im Code erzeugt.
  Einzige Ausnahmen: `favicon.svg`, `docs/screenshot.png` (README). `tools/pack.js` ist kein Build für den Betrieb,
  sondern verpackt nur den Release; `dist/` gehört nicht ins Repository.
- Alle Skripte teilen sich den globalen Namensraum. Reihenfolge in `index.html`:
  `data.js → map.js → game.js → ai.js → gfx.js → sfx.js → ui.js`.
- Spielzustand liegt komplett in der globalen Variable `S`.
- **Zweisprachigkeit**: `LANG`/`EN`/`tt(deutsch, englisch)` stehen oben in `data.js`. Im Code jeden sichtbaren
  Text als `tt('…', '…')` schreiben. Feste Texte in `index.html`: `data-en="…"` (englischer Inhalt),
  `data-en-title`/`-placeholder`/`-aria-label`; lange Absätze doppelt mit `data-lang="de"`/`"en"`.
  `applyLang()` (ui.js) setzt das um. Der Sprachknopf speichert `archipel-lang` und lädt die Seite neu
  (Spiel wird vorher gesichert) – Texte dürfen daher beim Laden festgelegt werden.
  Einheitennamen: `uname(u, 'nom'|'acc')` (Artikel je Sprache), `lc1()` für Kleinschreibung im Satz.
  Gespeicherte Meldungen bleiben in der Sprache, in der sie entstanden sind.

## Dateien

| Datei | Inhalt |
|---|---|
| `js/data.js` | Sprache `LANG`/`tt()`, Einheitentypen `UT` (inkl. `stealth`, `sonar`), `UNIT_ORDER`, `DIRS`, Spielerfarben, `MAP_SIZES`, Weltarten `WORLDS`, Schwierigkeitsgrade `DIFFICULTY` (inkl. `skill`) + `diff()`, `aiKnowsMap(p)`, `aiMistake(p)` |
| `js/map.js` | Kartengenerator: Weltarten `WORLDS` (data.js) – Inselwelten aus geplanten Inseln + Rauschen, Kontinente aus Value-Noise; Städte, faire Startpositionen |
| `js/game.js` | Regeln: Bewegung `moveStep`, Kampf `combatSpec`/`attackOdds`/`winProb`, Eroberung `captureChance`/`cityDefenders`, Unterstützung `fireSupport`/`airCover`, Produktion, Sicht `computeVision`/`canSee`, Wegsuche `bfs`/`findPath`/`explorePath`, Befehle `runGoto`/`runPatrol`/`runExplore`, Kräfteverhältnis `strength`, Speichern/Laden inkl. `sanitizeState` |
| `js/ai.js` | Computergegner: taktische Regeln je Einheit, Produktion inkl. Konter (`counterPick`), Erkundung, Bedrohungskarte (`threatMap`); Können `aiSkill(p)` (0 einfach, 1 umsichtig: Zielverteilung `spreadField`, Lagebild `buildPlan`, Jäger-Jagd, vorsichtige Transporter) |
| `js/gfx.js` | Gelände-Rendering, Einheiten-Abzeichen (SVG-Pfade → Sprites), Stadtgrafik |
| `js/sfx.js` | Web-Audio-Synthese: Effekte, Klangteppiche je Einheitentyp, Klangtest |
| `js/ui.js` | Zeichnen, Animationen/Zeitleiste, Kamera, Eingabe, Seitenleiste, Kontextmenü, alle Dialoge, Handbuch (`openHelp`, `buildHelp`) |
| `index.html` | Layout, CSS, Dialoge (Handbuch, Statistik, Spielstände, Klangtest …) |
| `tools/serve.js` | Mini-Webserver für die Entwicklung |
| `tools/pack.js` | Verpackt die Offline-Fassung nach `dist/` (Einzeldatei `archipel.html`, Ordner fürs ZIP, Release-Text) |
| `.github/workflows/release.yml` | Legt bei einem Tag `vX.Y.Z` den Release mit der Offline-Fassung an |

## Wichtige Zusammenhänge (beim Ändern beachten)

- **Kampf**: Alle Kampfwerte kommen aus `combatSpec(a, d, x, y)` (Stärken, Trefferchance `p`,
  Erstschlag, Hinweistexte). Kampfablauf, angezeigte Siegchance und KI-Bewertung nutzen
  diese eine Funktion – neue Boni nur dort eintragen. Die Tabelle „Wer schlägt wen“ im Handbuch rechnet sich
  daraus selbst; die Sonderregel als Zeile im Reiter „Kampf“ und im Einheitentext ergänzen (siehe „Handbuch“).
- **Schlachtschiffe**: `fireSupport(owner, x, y)` und `captureChance(owner, c)` (game.js) – Feuerunterstützung/Feuerschutz auf
  Nachbarfelder (Eroberung 75 % / 25 %, Bodentruppen treffen zu 2/3 bzw. werden zu 1/3 getroffen). Eroberungschancen nie fest
  mit 50 % rechnen, immer `captureChance` nehmen. Salven meldet `hooks.salvo`; Markierungen zeichnet `drawSupportMark` (ui.js).
- **Getarnte U-Boote**: `canSee(p, u)` (game.js) entscheidet, ob Spieler p eine Einheit sieht. Für fremde Einheiten immer
  diese Funktion benutzen, nie nur `P.vis` des Feldes. `P.sonar` = Ortungsbereich (jede Einheit/Stadt Umkreis 1, Einheiten mit
  `sonar: true` volle Sichtweite), wird in `computeVision` berechnet und nicht gespeichert. `u.surf` = aufgetaucht nach einem
  Angriff, bis zum nächsten eigenen Rundenbeginn. `moveStep` liefert `contact: true` (Sonarkontakt), wenn auf dem Zielfeld nur
  ein bisher ungeortetes U-Boot liegt – das passiert praktisch nur der KI, deren Sicht innerhalb eines Zugs veraltet sein kann.
  U-Boote sehen 2 Felder weit, werden aber erst auf 1 Feld geortet. KI: U-Boote lauern 2–3 Felder vor Häfen des Gegners und
  greifen nur Beute an (`SUB_PREY`: Transporter, große Schiffe); ab Können 1 Geleitschutz (`plan.escort`, ein Zerstörer je
  beladenem Transporter). Messung KI gegen KI (je 400 Partien): Geleitschutz, mehr U-Boote und die Lauer-Taktik ändern die
  Siegquote nicht messbar (48–51 %); U-Boote statt Kreuzern verlieren (36–42 %). Die Tarnung zahlt sich also vor allem für
  den Menschen aus – die KI führt U-Boote weiterhin schwächer als Kreuzer.
- **Schiffe im Hafen**: `cityDefenders(u, city, enemies)` (game.js) – greifen Bodentruppen eine fremde Stadt an, kämpfen Schiffe
  im Hafen nicht mit; fällt die Stadt, gehen sie mit unter (auch ein Schlachtschiff). Ohne diese Regel machte ein Schiff im
  Hafen die Stadt für Infanterie uneinnehmbar: Seit die KI U-Boote baut, blieben so auf Leicht 18 von 96 Partien stecken.
  Wer Kampfgegner auf einem Stadtfeld bestimmt (Regeln, KI, Hinweiszeile), nimmt `cityDefenders`, nicht alle Einheiten des Feldes.
- **Träger**: Sichtweite 4; `airCover(owner, x, y)` (game.js) – mit mindestens einem Jäger an Bord treffen feindliche Jäger den
  Träger und eigene Schiffe auf Nachbarfeldern nur zu 1/3. KI: `aiCarrier` (bleibt beim Schlachtschiff bzw. beladenen Transporter),
  ab Können 1 und 8 Städten ein Träger. Produktionsregeln der KI zählen mit `planned(t)` auch Einheiten, die andere Städte
  gerade bauen – sonst beginnen mehrere Städte gleichzeitig dasselbe.
- **Handbuch** (Hilfe): sechs Reiter in `index.html` (`data-tab`/`data-pane`), geöffnet über `openHelp(tab, unit)`.
  Einheitenkarten (`UNIT_INFO`, `UNIT_ROLE`) und die Tabelle „Wer schlägt wen“ (`oddsMatrix` über `attackOdds`) entstehen
  in `buildHelp()` aus den Spieldaten – Prozentwerte nie von Hand in die Hilfe schreiben. Neue Sonderregeln als Zeile in der
  Tabelle `.help-rules` (Reiter „Kampf“) ergänzen, den Einheitentext in `UNIT_INFO`.
- **Neues Feld im Spielzustand** → in `sanitizeState` (game.js) aufnehmen, sonst wird es beim
  Laden verworfen. Spielstände aus Dateien sind nicht vertrauenswürdig (siehe `SECURITY.md`);
  Werte aus `S` nie ungeprüft per `innerHTML` ausgeben, Texte mit `esc()` maskieren.
- **Animationen**: Regeln melden Bewegungen/Kämpfe/Eroberungen über `hooks` (game.js); `ui.js`
  zeichnet sie zwischen `animBegin()`/`animEnd()` als Zeitleiste auf. Gegnerzüge sind
  überspringbar, die Kamera folgt (`recCam`).
- **„Wartende“ Einheiten**: `needsOrders(u)` in ui.js steuert „Nächste Einheit“, die Zahl am
  Rundenknopf und das automatische Rundenende.
- **Schwierigkeit** wirkt nur auf Spieler 1 (Gegner). In Simulationen spielt die KI auch
  Spieler 0 – dort ohne Fehler und ohne Kartenwissen.
- **Karte bewegen** (ui.js): Ziehen mit jeder Maustaste (links erst ab `DRAG_THRESHOLD_LEFT`, der Klick danach wird über
  `dragSwallow` verschluckt), Umschalt + Pfeiltasten, Klick auf die Übersichtskarte. Rad-Ereignisse: Mausrad zoomt,
  Touchpad-Wischen verschiebt (`looksLikeTouchpad`: kleine, krumme oder seitliche Schritte), Spreizgeste = Rad mit Strg = Zoom.
  Die Einstellung `archipel-wheel` (auto | zoom | pan, im Menü unter „Einstellungen“) übersteuert die Erkennung.
  Echte Touchpad-Gesten lassen sich im eingebauten Browser nur als nachgestellte Rad-Ereignisse testen.
- **Kopfzeile und Menü**: Oben stehen nur Runde + Stufe (`updateHeader`), `☰ Menü`, Zoom, Ton, Handbuch, Sprache. Seltenes liegt im
  Menü `#menu` (`openMenu`/`closeMenu`, ui.js): Neues Spiel, Spielstände, Statistik sowie die Einstellungen Lautstärke, Klangtest,
  Mausrad/Touchpad, Kräfteverhältnis anzeigen (`showPower`, `archipel-power`), Schwelle fürs Angebot zum vorzeitigen Ende (`offerPct`, `archipel-offer`,
  0 = nie, Standard 10 %; `maybeOfferEnd`), automatisches Rundenende. Neue Einstellungen dort einhängen, nicht in die Kopfzeile oder Seitenleiste.
  Die Hinweiszeile `#hover` (Feld unter der Maus, Siegchance) steht über der Karte (`#infoBar` in `#mapCol`, so breit wie die Karte);
  während der Gegner zieht, liegt dort `#banner` („Gegner zieht …“) darüber. Meldungen fürs Spielgeschehen gehören an diese eine Stelle.
- **Produktionsansicht** (ui.js): `prodView`, umgeschaltet mit `setProdView(on)` (Schalter in der Seitenleiste, Taste V).
  `render()` zeichnet dann nach dem Nebel nur `drawProdView()` (Symbol, Fortschrittsring, Restzeit je eigener Stadt) und
  bricht ab; Klicks öffnen `openProdDialog`, Einheitentasten sind gesperrt. Rundenende, „Nächste Einheit“, neues Spiel und
  Laden schalten zurück. Der Zustand wird nicht gespeichert.
- **Grafik-Caches**: Gelände (`buildTerrainCache`) und Sprites hängen von der Zoomstufe `TS` ab.

## Entwickeln und testen

1. Server starten: Vorschau-Konfiguration „archipel“ (`.claude/launch.json`, lokal, nicht im
   Repo) oder `node tools/serve.js .` → http://localhost:8765
2. Syntax prüfen: `for f in js/*.js; do node --check $f; done`
3. Im eingebauten Browser testen; Spielfunktionen lassen sich per JavaScript direkt aufrufen
   (`S`, `newGame`, `startNew`, `doMove`, `endHumanTurn`, `skipAnim` …).
4. KI-gegen-KI-Simulation (im Browser ausführen):

```js
function simGame(size, dk, world = 'inseln', maxT = 350) {
  newGame(size, dk, world);   // world: inseln | gemischt | kontinente
  for (let k = 0; k < maxT && !S.over; k++) {
    for (const c of S.cities) if (c.owner === 0 && c.progress === 0) aiChooseProduction(c);
    aiTurn(0); endTurn(0); if (S.over) break;
    startTurn(1); aiTurn(1); endTurn(1); S.turn++; startTurn(0); checkGameOver();
  }
  const a = strength(0).total, b = strength(1).total;
  return { over: S.over, turn: S.turn, share: Math.round(a / (a + b) * 100) };
}
```

Schneller und ohne Browser: `data.js`, `map.js`, `game.js`, `ai.js` mit Node per `vm.runInThisContext`
laden (`globalThis.localStorage` als Attrappe), dann dieselbe `simGame`-Schleife (ca. 1 s je Partie;
im ausgeblendeten Browser-Fenster werden Zeitgeber gedrosselt, lange Läufe brechen dort ab).

### Stand der Einmessung

Kleine Karte, „Siege“ des einfachen KI-Spielers auf Platz 0, je 96 Partien über alle drei Welten
(nach Träger, Hafenregel und getarnten U-Booten; Schwer und Brutal nach dem Verlangsamen des Trägers auf 2 Felder –
mit 3 Feldern waren es 12 bzw. 2 Siege, der schnelle Träger nützte der KI also spürbar):

| Stufe | Siege | unentschieden nach 350 Runden | Bonus des Gegners |
|---|---|---|---|
| Leicht | 96 | 0 | 70 % Bautempo, macht Fehler, du +1 Infanterie |
| Normal | 56 | 3 | keiner, macht gelegentlich Fehler |
| Schwer | 24 | 4 | kennt die Karte, spielt umsichtig |
| Brutal | 5 | 1 | wie Schwer, 115 % Bautempo, zweite Stadt |

Partiedauer bis zur Entscheidung (Normal) ca. 210 Runden. Ein KI-Zug dauert auf der mittleren Karte ca. 50 ms.
Inselstatistik: größte Insel ≈ 30–40 % des Landes (Inselreich), ≈ 50–60 % (Gemischt), ≈ 75–85 % (Kontinente).

### KI messen

`AI_SKILL[platz] = 0|1` erzwingt das Können je Platz. Für einen fairen Vergleich beide Plätze ohne Fehler
(`DIFFICULTY.normal.aiMistake = 0`) und je Variante beide Sitzordnungen spielen, mindestens 400 Partien. Bei 200 Partien liegt
das Rauschen bei ±3,5 Punkten („Variante = Basis“ ergab schon 45 % und 54 %). Neue Verhaltensweisen erst hinter einem
Schalter je Platz einbauen, messen, dann festschreiben oder wieder entfernen. Immer auch die Zahl der **nicht entschiedenen**
Partien ansehen: Steigt sie, hat sich etwas festgefahren.

Was die bisherigen Messreihen (rund 20 000 Partien) ergeben haben:

- **Angriff schlägt Verteidigung.** Besatzungen schaden (Frontstädte 42 %, Hinterland 45 %, jede Stadt von Beginn an < 30 %):
  Eine Infanterie im Angriff erobert mit 50 % eine Stadt, als Besatzung senkt sie die Eroberungschance je Angreifer nur auf ca. 37 %.
  Das ist gewollt (der aktive Spieler ist im Vorteil) – keine Besatzungs-Logik einbauen.
- Umsichtige KI (Können 1) gegen einfache: 57 %. Wirksam ist vor allem „Infanterie statt Panzer als Eroberer“ (+10 Punkte).
  Zielverteilung, Jagd auf Eindringlinge, Jäger-Jagd, vorsichtige Transporter und Geleitschutz liegen einzeln im Rauschen, schaden aber nicht.
- Flotte: Ohne Kriegsschiffe verliert man im Inselreich fast immer (9 %). Kreuzer sind das beste Allround-Schiff; U-Boote statt
  Kreuzern verlieren (36–42 %). Verzicht auf Schlachtschiffe kostet ca. 5 Punkte. Träger: KI mit Träger gegen KI ohne 57 %.
- U-Boote wirken vor allem, wenn der Gegner die Karte kennt (Schwer): Sie lauern sofort vor den richtigen Häfen. Ohne Kartenwissen
  gewänne der Vergleichsspieler auf Schwer 31 % (Kontinente 50 %, Inselreich 10 %) – zu ungleich je Welt, deshalb nicht übernommen.
- Schlechter: keine frühen Kreuzer (34 %), mehr Transporter (42 %), Landung direkt vor der Stadt (47 %), andere Truppgrößen.
- Auf Schwer im Inselreich baut der Gegner (fast nur Küstenstädte) kaum Jäger.

## Bekannte Eigenheiten

- Das Screenshot-Werkzeug des eingebauten Browsers liefert höchstens 800 px Breite. `docs/screenshot.png` entsteht so:
  Ansicht auf 800×760 stellen, Partie simulieren und Szene aufbauen, Screenshot machen, die abgelegte JPG-Datei mit
  PowerShell (`System.Drawing`) als PNG speichern.
- Im Browser-Bereich können mehrere Reiter offen sein. Bei JavaScript-Aufrufen immer die Reiter-Kennung des Spiels angeben
  und nie `location.href` zurückgeben (ein Reiter kann eine riesige `data:`-Adresse haben).
- Testspielstände (`archipel-test-*.json` im Projektordner, nicht im Repo) erzeugt ein Node-Skript: Partie simulieren, Einheiten
  setzen, `serialize()` in eine Datei schreiben; geladen wird über „Spielstände → Aus Datei laden…“.
- Lange Ersetzungen lieber als Node-Skript im Scratchpad ausführen statt per `sed`/Heredoc oder `node -e`
  mit Backticks (Git Bash führt den Inhalt als Befehl aus).
- `localStorage`: Autosave `archipel-save-v1`, Spielstände `archipel-slot-*` mit Index
  `archipel-slots`, Einstellungen `archipel-*` (Ton, Zoom, Schwierigkeit, Rundenende, Sprache, Handbuch-Reiter, Rad/Touchpad, `archipel-welcome` = Willkommensfenster gesehen …).
