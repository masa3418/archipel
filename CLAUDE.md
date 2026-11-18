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
- **Installierbare App nur online:** `manifest.webmanifest` und `sw.js` (Service Worker, „erst Netz, dann Zwischenspeicher“) liegen im
  Repository für GitHub Pages, gehören aber **nicht** in den Release: `pack.js` entfernt den Manifest-Verweis aus Einzeldatei und ZIP-Ordner,
  ui.js meldet `sw.js` nur bei https/localhost an (nicht über file://). Als App-Symbol dient `favicon.svg` – keine weiteren Bilddateien.
  Kommt eine neue Skriptdatei hinzu, auch in `CORE` von `sw.js` eintragen.
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
| `js/data.js` | Sprache `LANG`/`tt()`, Einheitentypen `UT` (inkl. `stealth`, `sonar`, `noAttack`) + `canAttack`, `UNIT_ORDER`, `DIRS`, Spielerfarben, `MAP_SIZES`, Weltarten `WORLDS`, Schwierigkeitsgrade `DIFFICULTY` (inkl. `skill`) + `diff()`, `aiKnowsMap(p)`, `aiMistake(p)` |
| `js/map.js` | Kartengenerator: Weltarten `WORLDS` (data.js) – Inselwelten aus geplanten Inseln + Rauschen (getrennt mit `split`), Festland (`festland`: Küstensaum, Binnenmeere, Flüsse mit Brücken); Städte, faire Startpositionen |
| `js/game.js` | Regeln: Bewegung `moveStep`, Kampf `combatSpec`/`attackOdds`/`winProb`, Eroberung `captureChance`/`cityDefenders`, Unterstützung `fireSupport`/`airCover`, Produktion, Sicht `computeVision`/`canSee`, Wegsuche `bfs`/`findPath`/`explorePath`, Befehle `runGoto`/`runPatrol`/`runExplore`, Kräfteverhältnis `strength`, Speichern/Laden inkl. `sanitizeState` |
| `js/ai.js` | Computergegner: taktische Regeln je Einheit, Produktion inkl. Konter (`counterPick`), Erkundung, Bedrohungskarte (`threatMap`); Können `aiSkill(p)` (0 einfach, 1 umsichtig: Zielverteilung `spreadField`, Lagebild `buildPlan`, Jäger-Jagd, vorsichtige Transporter) |
| `js/gfx.js` | Gelände-Rendering, Einheiten-Abzeichen (SVG-Pfade → Sprites), Stadtgrafik |
| `js/sfx.js` | Web-Audio-Synthese: Effekte, Klangteppiche je Einheitentyp, Klangtest |
| `js/ui.js` | Zeichnen, Animationen/Zeitleiste, Kamera, Eingabe, Seitenleiste, Kontextmenü, alle Dialoge, Handbuch (`openHelp`, `buildHelp`) |
| `index.html` | Layout, CSS, Dialoge (Handbuch, Statistik, Spielstände, Klangtest …) |
| `tools/serve.js` | Mini-Webserver für die Entwicklung |
| `tools/pack.js` | Verpackt die Offline-Fassung nach `dist/` (Einzeldatei `archipel.html`, Ordner fürs ZIP, Release-Text; ohne Manifest-Verweis) |
| `manifest.webmanifest`, `sw.js` | Installierbare App für die Online-Fassung (nur GitHub Pages, nicht im Release) |
| `.github/workflows/release.yml` | Legt bei einem Tag `vX.Y.Z` den Release mit der Offline-Fassung an |

## Wichtige Zusammenhänge (beim Ändern beachten)

- **Kampf**: Alle Kampfwerte kommen aus `combatSpec(a, d, x, y)` (Stärken, Trefferchance `p`,
  Erstschlag, Hinweistexte). Kampfablauf, angezeigte Siegchance und KI-Bewertung nutzen
  diese eine Funktion – neue Boni nur dort eintragen. Die Tabelle „Wer schlägt wen“ im Handbuch rechnet sich
  daraus selbst; die Sonderregel als Zeile im Reiter „Kampf“ und im Einheitentext ergänzen (siehe „Handbuch“).
- **Beschuss von Land**: Nur Schiffe mit `shore: true` (Kreuzer, Schlachtschiff) dürfen Einheiten an Land angreifen, auch in Städten.
  `canStrike(a, d)` (game.js) entscheidet das; moveStep, KI (`bestAttack`, Jagd der Schiffe) und Anzeige fragen dort nach.
  **Küstenangriff** (`COAST` in game.js, in `combatSpec`): Bodentruppen gegen ein Schiff auf einem Nachbarfeld (nicht in einer Stadt) richten
  dreifachen Schaden an – außer gegen Kreuzer/Schlachtschiff (`shore`). U-Boote sind für Bodentruppen nicht angreifbar (`canStrike`).
  Infanterie → Zerstörer 50 %, Panzer → Zerstörer 75 %, Panzer → Träger 31 %. Die KI-Bedrohungskarte (`threatMap`) berücksichtigt das.
- **Schlachtschiffe**: `fireSupport(owner, x, y)` und `captureChance(owner, c)` (game.js) – Feuerunterstützung/Feuerschutz auf
  Nachbarfelder (Eroberung 75 % / 25 %, Bodentruppen treffen zu 2/3 bzw. werden zu 1/3 getroffen). Eroberungschancen nie fest
  mit 50 % rechnen, immer `captureChance` nehmen. Salven meldet `hooks.salvo`; Markierungen zeichnet `drawSupportMark` (ui.js). Luftdeckung im Kampf: `hooks.cover` (in `attack`, Jäger gegen Schiff unter `airCover`) – Abfangjäger, Schutzring, Klang `cover`.
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
  **Rollen zur See** (combatSpec/canStrike): U-Boote greifen nur Schiffe an (keine Jäger). Der Zerstörer ist der U-Boot-Jäger: Torpedos
  richten an ihm nur `SUB_VS_DST` (2) Schaden an (Zerstörer → U-Boot 89 %, U-Boot → Zerstörer 25 %). Getauchte U-Boote tauchen vor allen
  großen Schiffen ab (`BIG_SHIPS`: trifft zu 1/4, U-Boot doppelt; Kreuzer → U-Boot 44 %, Träger 16 %) – große Schiffe brauchen Zerstörer
  oder Jäger als Schutz. Jäger bleiben bewusst schwach gegen Kreuzer/Zerstörer (Wunsch des Nutzers: ihre Stärke ist das schnelle Zusammenziehen).
  Messung (je 192 Partien, alt → neu): Leicht 99/99 %, Normal 56/58 %, Schwer 11/17 %, Brutal 3/1 %, offen 20 → 13.
- **Schiffe im Hafen**: `cityDefenders(u, city, enemies)` (game.js) – greifen Bodentruppen eine fremde Stadt an, kämpfen Schiffe
  im Hafen nicht mit; fällt die Stadt, gehen sie mit unter (auch ein Schlachtschiff). Ohne diese Regel machte ein Schiff im
  Hafen die Stadt für Infanterie uneinnehmbar: Seit die KI U-Boote baut, blieben so auf Leicht 18 von 96 Partien stecken.
  Wer Kampfgegner auf einem Stadtfeld bestimmt (Regeln, KI, Hinweiszeile), nimmt `cityDefenders`, nicht alle Einheiten des Feldes.
- **Träger**: greift nie selbst an (`noAttack` in UT, `canAttack(typ)` in data.js – wie der Transporter; verteidigt sich mit Stärke 1).
  Wer prüft, ob ein Typ angreifen kann, nimmt `canAttack`, nicht `str > 0`. Sichtweite 4; `airCover(owner, x, y)` (game.js) – mit mindestens einem Jäger an Bord treffen feindliche Jäger den
  Träger und eigene Schiffe auf Nachbarfeldern nur zu 1/3, und ein Transporter wehrt sich dann mit Stärke 1 (Jäger → gedeckter Transporter 33 %).
  „Wehrlos“ daher nie über `T(d).str === 0` prüfen, sondern über `combatSpec(...).ds` (so in `aiAdjTarget`). KI: `aiCarrier` (bleibt beim Schlachtschiff bzw. beladenen Transporter),
  ab Können 1 und 8 Städten ein Träger. Produktionsregeln der KI zählen mit `planned(t)` auch Einheiten, die andere Städte
  gerade bauen – sonst beginnen mehrere Städte gleichzeitig dasselbe.
- **Verborgene Stärke:** Ladung fremder Transporter/Träger und die Zahl der Einheiten in fremden Städten zeigt die Karte nicht (Marke ohne
  Zahl, Hinweiszeile nennt nur den Verteidiger, erst nach Spielende oder mit `CHEAT_FOG` alles); die KI schätzt fremde Ladung mit `cargoSeen` (Transporter halb voll).
  Neue Anzeigen über fremde Einheiten dürfen keine Anzahl verraten. Handbuch: Zeile „Verborgene Stärke“ im Reiter „Kampf“.
- **Handbuch** (Hilfe): sieben Reiter in `index.html` (alles zum Laden, Landen und Angriff vom Schiff steht gesammelt unter
  „Transporter“; „Erste Schritte“ bleibt kurz, Verweise mit `data-helptab`), Aufbau über `data-tab`/`data-pane`, geöffnet über `openHelp(tab, unit)`.
  Einheitenkarten (`UNIT_INFO`, `UNIT_ROLE`) und die Tabelle „Wer schlägt wen“ (`oddsMatrix` über `attackOdds`) entstehen
  in `buildHelp()` aus den Spieldaten – Prozentwerte nie von Hand in die Hilfe schreiben. Die Tabelle hat zwei Ansichten
  (`renderMatrix`, Umschalter `#matrixSw`, gemerkt in `archipel-matrix`): „Siegchance“ und „Wirtschaftlichkeit“ (Bilanz =
  Bauzeit des Ziels / verlorene Bauzeit, wenn Angreifer derselben Art nacheinander angreifen, bis das Ziel zerstört ist; `hpLostToKill` in game.js.
  Schaden an Überlebenden zählt anteilig, Reparatur nicht – Wunsch des Nutzers; nur zerstörte Einheiten zu zählen ergab z. B. Kreuzer gegen Kreuzer 1,6.
  So stehen gleiche Typen bei 1,0. „frei“ = Schaden < 5 % der eigenen Bauzeit). Erklärtext `#matrixNote` samt Beispiel (Infanterie gegen Panzer) wird berechnet. Ein Punkt in der Ecke markiert Paarungen
  mit Sonderregel (Hinweistext nennt sie, aus `combatSpec().notes`). Eine Anzeige des mittleren Schadens („Ø 1 / 8“) gab es kurz – dem Nutzer zu verwirrend. Neue Sonderregeln als Zeile in der
  Tabelle `.help-rules` (Reiter „Kampf“) ergänzen, den Einheitentext in `UNIT_INFO`.
- **Schummeln „Nebel aus“**: `CHEAT_FOG` (game.js), geschaltet mit `setCheatFog` (ui.js, Haken im Menü mit Rückfrage `askCheatFog`; wird nicht gemerkt,
  `resetCheatFog` in `startNew`/`afterLoad` – jede neue oder geladene Partie beginnt mit Nebel). `computeVision(0)`
  legt dann das echte Kartengedächtnis in `P.real` (`seen`, `knownOwner`) ab und füllt `seen`/`vis`/`sonar` mit 1; `serialize` sichert immer
  das echte. Beim Abschalten kehrt der Nebel zurück. Wer `P.seen`/`P.knownOwner` schreibt, muss `P.real` beachten (bisher schreibt nur
  `computeVision`). In Simulationen bleibt der Schalter aus. Anzeige: Schildchen `.cheat` neben der Rundenzahl.
- **Kräfteverhältnis**: `strength(p)` (game.js) = Wert der Einheiten (Bauzeit × Trefferpunkte-Anteil) + `CITY_VALUE` je Stadt. Ein Klick auf
  den Balken öffnet `openPower`/`renderPower` (ui.js) mit der Rechnung: eigene Einheiten je Typ. Vom Gegner standardmäßig nur der
  Prozentwert; erst mit dem Haken „Zahlen des Gegners aufdecken“ (`spoiler`, `archipel-spoiler`) nennt das Fenster
  seine Städte und den Gesamtwert seiner Einheiten – nie die Typen (das verriete Einheiten im Nebel). Überall sonst (Hinweistext des
  Balkens, Frage nach dem vorzeitigen Ende, Eroberungsfenster) steht vom Gegner nur der Prozentwert; das ist gewollt, keine Zahlen des
  Gegners außerhalb dieses Fensters anzeigen. Ändert sich die Formel, das Fenster mit anpassen.
- **Zerstörte Einheiten** (Statistik): `killUnit(u, by)` zählt mit – `by` = Spieler, der zerstört hat (→ `S.kills[by][typ]`), `-1` = ohne
  Gegner verloren (Absturz, neutrale Stadt → `S.wasted[besitzer][typ]`), ohne Angabe nichts (Eroberer wird Besatzung). Wer eine neue
  Stelle einbaut, an der Einheiten sterben, gibt `by` an. `S.killsFrom` = Runde, ab der gezählt wird (ältere Spielstände: ab dem Laden).
- **Zeitraffer**: `recordTimeline()` (game.js, in `startTurn(0)`, `afterLoad`, `showGameOver`) schreibt `S.tl` mit: `from` (ältere Spielstände:
  ab dem Laden), `seen` (Uint16Array: Runde der Entdeckung je Feld, als Base64 gespeichert – Sonderfall in `serialize`), `own` (echte
  Besitzwechsel) und `know` (Wissen des Menschen) als `[Runde, Stadt, Besitzer]`, chronologisch. `openTimelapse` (ui.js, Menü, Taste T,
  Spielende-Fenster) zeigt während der Partie nur `seen`/`know`, nach dem Ende `own` und die ganze Karte; Umland = nächste Stadt
  auf derselben Insel (`tlZone`, ≤ 4 Felder). Kurve aus `S.hist`, folgt `showPower`. Spielstand wird dadurch 5–20 kB größer (klein–groß).
  Der Baustein `#tlView` wird in das zeigende Fenster gehängt (`openTimelapse(host)`: `#tlHome` im Fenster „Zeitraffer“ oder `#overTl`).
- **Abschlussfenster** (`showGameOver(quiet)`, `#mOver`): Kopf wie beim Eroberungsfenster (Sieg golden, Niederlage rot), links der Zeitraffer
  der ganzen Partie, rechts Eckdaten und je Typ gebaut/verloren für beide Seiten (nach dem Ende alles aufgedeckt). Nach dem Spielende öffnen
  Menü „Zeitraffer“ und Taste T dieses Fenster. Gebaute Einheiten: `S.built[p][typ]` (in `startTurn`), `S.builtFrom` wie `killsFrom`.
  Verloren = vom Gegner zerstört + `S.wasted`. Eroberte Städte: `overCityMoves` aus `S.tl.own`.
- **Kartennummer** (`S.seed`, game.js): Startwert des Kartengenerators; `newGame(size, diff, world, seed)`, `parseSeed` (Ziffern direkt, Text per Hash,
  leer = zufällig), `fmtSeed` (Dreiergruppen). Gleiche Nummer + Größe + Welt = gleiche Karte, Städte und Startplätze (nicht die KI-Züge).
  Eingabe und „Diese Welt noch einmal“ im Fenster „Neues Spiel“, Anzeige in Statistik und Abschlussfenster. Der Generator darf nur
  `mulberry32(seed)` nutzen, nie `Math.random` – sonst stimmt die Nummer nicht mehr. Ältere Spielstände: `seed = null`.
- **Spielstände** (ui.js `renderSaves`): nach Partie gruppiert über `S.gameId` (bei `newGame` vergeben, ältere Partien in `afterLoad`; in den
  Metadaten als `game`, dazu `world`/`seed` aus `saveSummary`). Laufende Partie oben und offen, sonst zugeklappt (`saveOpen`); ohne Kennung →
  „Ältere Spielstände“. Suchfeld ab 7 Ständen, `data-delgame` löscht alle Stände einer Partie.
- **Neues Feld im Spielzustand** → in `sanitizeState` (game.js) aufnehmen, sonst wird es beim
  Laden verworfen. Spielstände aus Dateien sind nicht vertrauenswürdig (siehe `SECURITY.md`);
  Werte aus `S` nie ungeprüft per `innerHTML` ausgeben, Texte mit `esc()` maskieren.
- **Animationen**: Regeln melden Bewegungen/Kämpfe/Eroberungen über `hooks` (game.js); `ui.js`
  zeichnet sie zwischen `animBegin()`/`animEnd()` als Zeitleiste auf. Gegnerzüge sind
  überspringbar, die Kamera folgt (`recCam`).
  Tempo: Einstellung „Wiedergabe der Züge“ (`replay`, `REPLAY`, `archipel-replay2`: slow 2,6× / normal 1,8× / fast 1× / off; Vorgabe off bei
  prefers-reduced-motion) skaliert `animBegin`-Tempo, Kamerafahrten (`anim.camMs`) und die Obergrenze in `animEnd`; „off“ setzt die Zeitleiste
  sofort auf den Endstand. Kamerabewegungen außerhalb der Zeitleiste immer über `pan()` (bei „off“ ohne Schwenk), nicht direkt `camTo`.
  Während der Wiedergabe nach dem Rundenende bleibt die Karte stehen; erst danach geht es zur nächsten eigenen Einheit.
- **„Wartende“ Einheiten**: `needsOrders(u)` in ui.js steuert „Nächste Einheit“, die Zahl am
  Rundenknopf und das automatische Rundenende.
- **Schwierigkeit** wirkt nur auf Spieler 1 (Gegner). In Simulationen spielt die KI auch
  Spieler 0 – dort ohne Fehler und ohne Kartenwissen.
- **Karte bewegen** (ui.js): Ziehen mit jeder Maustaste (links erst ab `DRAG_THRESHOLD_LEFT`, der Klick danach wird über
  `dragSwallow` verschluckt), Umschalt + Pfeiltasten, Klick auf die Übersichtskarte. Rad-Ereignisse: Mausrad zoomt,
  Touchpad-Wischen verschiebt (`looksLikeTouchpad`: kleine, krumme oder seitliche Schritte), Spreizgeste = Rad mit Strg = Zoom.
  Die Einstellung `archipel-wheel` (auto | zoom | pan, im Menü unter „Einstellungen“) übersteuert die Erkennung.
  Echte Touchpad-Gesten lassen sich im eingebauten Browser nur als nachgestellte Rad-Ereignisse testen.
- **Kopfzeile und Menü**: Oben stehen nur Runde + Stufe (`updateHeader`), `☰ Menü`, Zoom, Zentrieren (Fadenkreuz/Taste F, `actFocus` → `focusOn`), Ton, Handbuch, Sprache. Seltenes liegt im
  Menü `#menu` (`openMenu`/`closeMenu`, ui.js): Neues Spiel, Spielstände, Statistik, Zeitraffer und „Einstellungen …“. Die Einstellungen stehen im
  eigenen Fenster `#mSettings` (`openSettings`), nach Abschnitten (Ton, Anzeige, Spielablauf, Steuerung, Schummeln), je Zeile ein erklärender Satz
  (`.set-row` + `.set-d`): Lautstärke, Klangtest, Wiedergabe der Züge, Kräfteverhältnis anzeigen (`showPower`, `archipel-power`), Tastenlegende über
  der Karte (`showKeys`, `archipel-keys`; beim ersten Besuch an, sonst aus; `updateKeyLegend` in `refresh()`, blendet ab, was gerade nicht geht – neue Tastenkürzel dort
  und in der Tastentabelle des Handbuchs eintragen), automatisches Rundenende, Schwelle fürs Angebot zum vorzeitigen Ende (`offerPct`, `archipel-offer`,
  0 = nie, Standard 10 %; `maybeOfferEnd`), Mausrad/Touchpad, Nebel aus. Neue Einstellungen dort einhängen, nicht ins Menü, in die Kopfzeile oder Seitenleiste.
  Die Hinweiszeile `#hover` (Feld unter der Maus, Siegchance) steht über der Karte (`#infoBar` in `#mapCol`, so breit wie die Karte);
  während die Zeitleiste nach dem Rundenende läuft, liegt dort `#banner` darüber – erst „Gegner zieht …“, ab `anim.ownFrom`
  (eigene Märsche/Patrouillen der neuen Runde) „Deine Einheiten führen ihre Befehle aus …“ (`updateBanner`). Meldungen fürs Spielgeschehen gehören an diese eine Stelle.
- **Produktionsansicht** (ui.js): `prodView`, umgeschaltet mit `setProdView(on)` (Schalter in der Seitenleiste, Taste V).
  `render()` zeichnet dann nach dem Nebel nur `drawProdView()` (Symbol, Fortschrittsring, Restzeit je eigener Stadt) und
  bricht ab; Klicks öffnen `openProdDialog`, Einheitentasten sind gesperrt. Direkt unter dem Schalter steht die Tabelle `#prodStats`
  (`updateProdStats`: je Typ im Bau, nächste fertig in, vorhanden). Rundenende, „Nächste Einheit“, neues Spiel und
  Laden schalten zurück. Der Zustand wird nicht gespeichert.
- **Wegeansicht** (ui.js): `pathView`, umgeschaltet mit `setPathView(on)` (dritter Knopf des Ansichtsschalters, Taste G). Anders als
  die Produktionsansicht nur eine zusätzliche Ebene unter den Einheiten – das Spiel läuft normal weiter, sie bleibt über Runden an.
  `buildPathCache()` sammelt Märsche (weiß, Pfeil), Patrouillen (türkis, Punkte) und Marschziele (gelb, Fähnchen), `drawRoute` zeichnet;
  `refresh()` verwirft den Cache (Wegsuche nie in jedem Bild). Legende mit Anzahl: `updatePathLegend` (`#pathLegend`).
- **Marschziel einer Stadt**: `c.rally = [x, y]` (nur Städte des Menschen, wird gespeichert). `startTurn` gibt jeder dort fertiggestellten
  Einheit über `applyRally` den Marschbefehl; `rallyCheck(c, typ, x, y)` (game.js) prüft Ziel und Weg (ohne Einheiten: `findPath(…, 'all')` – wer gerade wo steht, zählt nicht) – beim Setzen und bei der
  Fertigstellung (Zielfeld für den Typ betretbar, Weg vorhanden, Jäger nur zu eigener Stadt in Treibstoff-Reichweite).
  Produktion immer über `setProduction` (game.js) bzw. `changeProd` (ui.js) umstellen: Das löscht das Marschziel, weil es für den
  alten Typ galt; auch eine Eroberung löscht es. Gesetzt wird es über Stadtkarte oder Kontextmenü (`actRally`, `rallyMode`, Klick aufs Zielfeld).
- **Transporter** (game.js): „Laden bis voll“ ist ein Dauerbefehl (`u.order = { type: 'load' }`, `runLoad`): bleibt liegen, lädt die wartenden
  Bodentruppen (`waitingTroops`: ohne Befehl oder auf Wache) aus der Stadt und von den Nachbarfeldern, endet, wenn er voll ist.
  `sailStep` (statt `moveStep` in `doMove` und `runGoto`): Verlässt ein Transporter des Spielers eine eigene Stadt, nimmt er die wartenden
  Truppen mit; hat er dort gerade ausgeladen (`u.dropped`), nicht. Beim Einlaufen bleibt die Ladung an Bord. „Ausladen“ neben einer neutralen/feindlichen Stadt ist ein Sturm vom Schiff (`assaultTarget`, `assaultFrom`):
  erst Infanterie, dann Panzer, bis die Stadt fällt; der Rest bleibt an Bord. `actUnload(true)` setzt nur an Land. Auslöser: Knopf, Taste U, Klick oder Richtungstaste auf die Stadt (`doAssault` über `doMove`);
  über der Stadt steht pulsierend die Chance (`assaultOptions`). `landingPending(u)` (ui.js): Ein beladener Transporter neben einer
  fremden Stadt gilt als wartend (`needsOrders`), auch ohne eigenen Zug – die Runde endet erst, wenn der Spieler entschieden hat. Dazu fragt ein Fenster
  einmal je Runde und Transporter (`landingStep` in der Hauptschleife, `openLandingDialog`, `u.landAsked`/`u.noAssault` = Rundennummer, nicht gespeichert):
  Angreifen, nur an Land setzen oder nicht angreifen. Ein Transporter mit Befehl (Wache, Marsch, Laden) wird nicht gefragt.
  Zweite Zielart `kind: 'unit'`: feindliche Einheit auf einem Landfeld daneben (auch Jäger über Land) – auf der Karte immer angreifbar,
  gefragt wird aber nur, wenn der Transporter keinen Zug mehr hat (`landingOption`); Taste U bleibt dort beim Ausladen.
  „Ausladen, wenn möglich“ (`u.landing`, je Transporter, Standard aus, wird gespeichert; `actLanding`, `landingUpdate` in ui.js, `canDisembark`
  in game.js): Berührt der Transporter Land, werden die Truppen geweckt und zählen als wartend, solange sie von Bord können – statt des
  Fensters. Leer schaltet sich der Status ab. Kennzeichen: Pfeil unten links an der Marke (`opts.landing`). Träger laden wie bisher
  einmalig (`loadUnits`). Die KI nutzt beides nicht.
- **Marsch und Engstellen** (`runGoto`, `ownBlocks`, `GOTO_WAIT` in game.js): Versperren nur eigene Einheiten den Weg (Kolonne vor Brücke
  oder Wasserstraße), rückt die Einheit bis an den Stau vor und wartet – höchstens 5 Runden, dann Abbruch mit Meldung; Patrouillen warten ohne
  Grenze. Prüfung über `findPath(…, ignoreOwn = true)`. Jäger warten nie. `doGoto` (ui.js) lehnt Jägermärsche über den Treibstoff hinaus ab
  und warnt, wenn vom Ziel keine Basis erreichbar ist. Testfälle (Brücke, Fluss, Nebel, Stau, Feind) liefen als Node-Skript mit Kleinkarten.
  Schiffe im Nebel: `FOG_COST` (2) je unerforschtem Feld direkt neben bekanntem Land (`fogMask` in `findPath`) – sonst planten sie quer
  durch Inseln, deren Ende im Nebel lag (Umwege in 6 Testfällen 26 → 10 Felder, bei Wasser im Nebel unverändert 0).
- **Patrouille ist ein Dauerbefehl** (`runPatrol`, game.js): endet nur durch den Spieler, Feindkontakt oder einen unerreichbaren Wegpunkt.
  Jäger tanken zwischendurch selbst: Reicht der Treibstoff nach dem nächsten Schritt nicht mehr für den Heimweg (+1 Feld Reserve),
  fliegt er zur nächsten Stadt (`o.refuel`, `refuelBase`) und macht danach beim selben Wegpunkt weiter. Zweimal Umkehren für denselben
  Wegpunkt (`o.rf`) heißt „außer Reichweite“ und beendet die Patrouille. Früher brach der Jäger hier ab und stand ohne Befehl in der Stadt.
- **Stege** (gfx.js, `buildTerrain`): Berühren sich zwei Landfelder nur an einer Ecke, dürfen Bodentruppen diagonal hinüber und Schiffe
  diagonal hindurch (Bewegung in 8 Richtungen, keine Sperre an Ecken). Die Karte zeigt das mit abgerundeten Ecken und einem kleinen Holzsteg.
  In Inselwelten selten (0–5 je Karte); auf dem Festland sind es die Brücken über die Flüsse (Flussschritt über Eck alle 2–4 Felder, im Schnitt 5 / 11 / 21 je Karte nach Größe).
  Wer die Regel an Ecken ändert, muss auch diese Darstellung, den Festland-Generator und den Handbuchsatz anpassen.
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
Inselstatistik: größte Insel ≈ 15–22 % des Landes (Inselreich, je nach Kartengröße). Gemischt (`massLen`, `massShare`, `minBig`): gleich große
mittelgroße Landmassen, Anzahl nach Kartengröße (klein/mittel/groß: 3/4/5, je ≈ 16–29 % des Landes, Start nur dort, Startland 8–13 Städte),
kleine Inseln ≈ 21–30 %. Vorher zwei große Kontinente – das hieß langwieriger Landkrieg oder ein Transporter bricht durch.
Festland (innerer Name weiterhin `kontinente`, `festland: true`, große Seen `lakeR`/`lakeArea`, Landengen `lakeGap`): eine Landmasse,
Städtezahl gedeckelt (`N * 0.36 / 15`), Höhen über die Rangfolge verteilt (ca. 9 % Berge). Häfen nur an offenem Wasser (`openWater`,
nicht an Flüssen; Städte ohne Küstenvorliebe → ca. 20 % Häfen). Jedes Netz aus Seen und Flüssen mündet höchstens einmal ins Meer, dazu
Quellflüsse, die im Land enden; ohne Brücken gerechnet (4er-Nachbarschaft) muss das größte Gebiet ≥ 80 % des Landes sein. Grund: Wassermauern
mit wenigen Brücken ergaben Stellungskriege (ein Angriff je Brücke und Runde gegen den Nachschub vieler Städte; bis 30 % offene Partien).
KI: Binnenstädte bauen Jäger nur bis `2 + Städte/4` (`ftrCap` in `aiChooseProduction`), danach Bodentruppen – vorher Hunderte Jäger.
Messung (Platz 0 einfach, je 96 Partien, kleine Karte, ursprünglicher Generator → jetzt): Gemischt Leicht 100/99 %, Normal 58/55 %,
Schwer 13/17 %, Brutal 5/1 %, offen 0–1; Festland (alt: Kontinente) Leicht 100/100 %, Normal 61/67 %, Schwer 21/23 %, Brutal 2/1 %,
offen auf Normal 2 → 6, Partien ca. 5 Runden länger. (Festland mit kleinen Seen hatte Schwer 15 % – große Seen geben dem Angreifer
über Wasser wieder Möglichkeiten.)
Inselreich (`split: true` in `WORLDS`, `generateMap`): Jedes Landfeld gehört zur geplanten Insel mit dem höchsten Wert 1 − d/R (`own`);
stoßen Felder verschiedener Inseln aneinander (auch über Eck), wird das schwächere Wasser. Vorher ließ das Küstenrauschen Inseln
zusammenwachsen (größte Insel Ø 31–42 %, bis 76 %). Startinseln: Ø 4,8–5,7 Städte, mindestens 4. Die Tabelle oben stammt noch vom alten
Generator; im Inselreich allein (je 96–288 Partien, alt → neu): Leicht 99 → 99 %, Normal 66 → 54 %, Schwer 26 → 24 %, Brutal 4 → 3 %,
Partien ca. 10 Runden länger, offen auf Normal 1 → 3 % (meist schon entschieden, nur die letzten Inseln fehlen).

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
- **Jäger-Schwarm** (Idee des Nutzers: alle Jäger schnell an einem Punkt zusammenziehen; Versuch wieder entfernt). Test-KI: doppelte
  Jäger-Obergrenze, jedes zweite Kriegsschiff ein Jäger; ein Viertel erkundet, der Rest wartet in den Städten, fliegt bei feindlichen
  Schiffen ≤ 12 Felder vor einer eigenen Stadt dorthin und greift gemeinsam an, wenn die Jäger in Reichweite das Schiff rechnerisch
  (mittlerer Schaden aus combatSpec) in dieser Runde versenken; nie unter Luftdeckung. Je 402 Partien gegen die normale KI (Können 0,
  ohne Fehler, beide Sitze), Inselreich/Gemischt/Festland/gesamt: Gegenprobe 47/47/40/44,5 %; nur mehr Jäger 53/41/41/45 %;
  Schwarm 54/49/31/44,5 %; angriffslustig (halber Schaden reicht) 49/49/40/46 %. Kein Effekt – der Schwarm schlägt selten zu
  (1–2 Angriffe je Partie, meist Transporter), weil ein Jäger gegen einen Kreuzer im Schnitt nur 1 Schaden macht. Auf dem Festland
  schaden die vielen Jäger (fehlende Bodentruppen). Erst neu messen, falls Jäger gegen Schiffe stärker werden.
- Flucht vom bedrohten Feld (`aiWarship`: kein gefahrloser Weg → notfalls durch bedrohte Felder aus der Reichweite; lauernde U-Boote bleiben
  nur unbedroht liegen). Vorher blieb z. B. ein U-Boot neben einem Zerstörer stehen. Messung (Können 1, je ~400 Partien): Siegquote 49 %,
  offen 9 → 10 von 408, Partien 5 Runden länger – neutral, deshalb festgeschrieben.
- Beschuss von Land nur noch durch Kreuzer und Schlachtschiff (je 192 Partien, alt → neu): Leicht 100 → 98 %, Normal 57 → 55 %,
  Schwer 21 → 22 %, Brutal 5 → 6 %, offen 9 → 9. Partien dauern 5–10 Runden länger. Die Stufen bleiben also gültig.
- Küstenangriff (je 192 Partien, ohne → dreifacher Schaden → dreifach und 2/3 Treffer): Leicht 98/99/100 %, Normal 65/65/70 %,
  Schwer 21/23/24 %, Brutal 5/4/5 %, offen 7/6/2. Gewählt: dreifacher Schaden bei normaler Trefferquote (verschiebt nichts).

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
- `localStorage`: Autosave `archipel-save-v1` (nach jeder Änderung: `queueSave` in `refresh()`, 300 ms gebündelt, dazu `pagehide`; < 1 ms je Speichern), Spielstände `archipel-slot-*` mit Index
  `archipel-slots`, Einstellungen `archipel-*` (Ton, Zoom, Schwierigkeit, Rundenende, Sprache, Handbuch-Reiter, Rad/Touchpad, `archipel-welcome` = Willkommensfenster gesehen …).
