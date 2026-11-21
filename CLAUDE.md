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
  `CHANGELOG.md` schreiben (deutsch, kurzer englischer Absatz), `node tools/pack.js` lokal prüfen, committen und pushen. Das Tag setzt der Nutzer selbst
  in der PowerShell – dort gibt es kein `&&`, deshalb immer als zwei einzelne Befehle nennen: `git tag vX.Y.Z`, danach `git push origin vX.Y.Z`. Den Rest erledigt GitHub; Ergebnis unter Actions und Releases ansehen.
  Commit-Nachrichten auf Deutsch, kurz, mit Co-Authored-By-Zeile.

## Grundsätze der Technik

- **Keine Abhängigkeiten, kein Build.** Reines HTML/CSS/JavaScript, klassische `<script>`-Tags
  (keine ES-Module), damit `index.html` auch per Doppelklick (`file://`) läuft.
- **Keine Asset-Dateien.** Grafik (`gfx.js`) und Klänge (`sfx.js`) werden im Code erzeugt.
  Einzige Ausnahmen: `favicon.svg`, `docs/seeschlacht.gif` (README, aus dem Teaser `docs/videos/seeschlacht.mp4` erzeugt) und die
  Erklärvideos `docs/videos/*.mp4` – sie gehören nicht zum Spiel und nicht in den Release. Ebenso die Beispiel-Spielstände
  `docs/spielstaende/*.json` (im README aufgeführt): erzeugt mit `node tools/beispiele.js` (die KI spielt beide Seiten, gespeichert wird,
  sobald eine gewünschte Lage erreicht ist; Zeitraffer und Kurve ab Runde 1). Nach Regeländerungen oder Änderungen am Spielstand neu
  erzeugen und die Tabelle im README (Runden, Städte) anpassen. Online lädt das Handbuch sie direkt (Reiter „Über das Spiel“,
  `EXAMPLES` in ui.js – Dateinamen, Runden und Städte dort und im README gleich halten; je Beispiel eine Zeile zum Aufklappen mit Eckdaten, darin eine Schilderung der Lage und erst dann der Laden-Knopf; Hinweis mit Sprung dorthin in „Erste Schritte“ per `data-helpanchor`);
  die Offline-Fassung (`file://`) lädt nichts aus dem Internet und zeigt stattdessen den Link zu GitHub. `tools/pack.js` ist kein Build für den Betrieb,
  sondern verpackt nur den Release; `dist/` gehört nicht ins Repository.
- **Installierbare App nur online:** `manifest.webmanifest` und `sw.js` (Service Worker, „erst Netz, dann Zwischenspeicher“) liegen im
  Repository für GitHub Pages, gehören aber **nicht** in den Release: `pack.js` entfernt den Manifest-Verweis aus der Einzeldatei,
  ui.js meldet `sw.js` nur bei https/localhost an (nicht über file://). Als App-Symbol dient `favicon.svg` – keine weiteren Bilddateien.
  Kommt eine neue Skriptdatei hinzu, auch in `CORE` von `sw.js` eintragen. Beim Aktivieren wirft der Service Worker zwischengespeicherte
  `js/*.js` hinaus, die nicht mehr in `CORE` stehen (nach dem Aufteilen blieb sonst `js/ui.js` liegen).
  „Erst Netz“ fragt jedes Mal beim Server nach (`fromNet`: `cache: 'no-cache'`, Antwort 304 wenn unverändert) und gibt der Seite alles mit
  `Cache-Control: no-cache` weiter (`askFirst`). Ohne das galten nach einem Update die 10 Minuten von GitHub Pages (`max-age=600`): erst im
  HTTP-Zwischenspeicher, dann beim Neuladen im selben Tab im Arbeitsspeicher von Chrome, der den Service Worker gar nicht fragt – neue Seite,
  alte Skripte. Geprüft mit einem Testserver, der GitHub Pages nachahmt (max-age, ETag/304, vorgetäuschtes Update, Anfrageprotokoll):
  alt blieb die Versionsnummer stehen, neu sofort aktuell; ohne Netz startet die App weiter. `tools/serve.js` sendet `no-store`, zeigt das also nicht.
- Alle Skripte teilen sich den globalen Namensraum. Reihenfolge in `index.html`:
  `data.js → map.js → game.js → ai.js → gfx.js → sfx.js`, dann die sieben Teile der Oberfläche `ui-karte.js → ui-zug.js → ui-leiste.js →
  ui-fenster.js → ui-eingabe.js → ui-schau.js → ui-start.js`. **„ui.js“ meint in dieser Datei und in Kommentaren diese sieben Teile zusammen**
  (bis 1.7.4 eine Datei mit 4.400 Zeilen; aufgeteilt an Abschnittsgrenzen, Inhalt und Reihenfolge unverändert). Welche Funktion wo steht:
  `grep -n "function name" js/ui-*.js`.
  **Ladereihenfolge beachten:** Funktionen eines späteren Skripts gibt es beim Laden eines früheren noch nicht. Code, der beim Laden sofort
  läuft (Zuweisungen auf oberster Ebene, `try { … }`-Blöcke für Einstellungen, Anbindung von Knöpfen), darf nur Funktionen aus demselben oder
  einem früheren Skript aufrufen; in Funktionen und Ereignis-Behandlern ist alles erlaubt. Innerhalb eines `try/catch` bliebe ein Verstoß
  ohne Fehlermeldung – beim Aufteilen wären so Tipps und Tastenlegende beim ersten Besuch aus geblieben (`welcomeSeen` stand im letzten Teil,
  jetzt in `ui-karte.js`). `UiTest.run()` prüft das (Attrappen für alle späteren Funktionen, vier Ausgangslagen).
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
| `js/data.js` | Sprache `LANG`/`tt()`, Einheitentypen `UT` (inkl. `stealth`, `sonar`, `noAttack`) + `canAttack`, `UNIT_ORDER`, `DIRS`, Spieler `PLAYERS` (Name, Farben; Du, Rot, Gelb, Violett), `MAP_SIZES` (inkl. `maxAi`), Weltarten `WORLDS`, Schwierigkeitsgrade `DIFFICULTY` (inkl. `skill`) + `diff()`, `aiKnowsMap(p)`, `aiMistake(p)` |
| `js/map.js` | Kartengenerator: Weltarten `WORLDS` (data.js) – Inselwelten aus geplanten Inseln + Rauschen (getrennt mit `split`), Festland (`festland`: Küstensaum, Binnenmeere, Flüsse mit Brücken); Städte, faire Startpositionen (ab drei Spielern `pickStarts`) |
| `js/game.js` | Regeln: Bewegung `moveStep`, Kampf `combatSpec`/`attackOdds`/`winProb`, Eroberung `captureChance`/`cityDefenders`, Unterstützung `fireSupport`/`airCover`, Produktion, Sicht `computeVision`/`canSee`, Wegsuche `bfs`/`findPath`/`explorePath`, Befehle `runGoto`/`runPatrol`/`runExplore`, Rundenwechsel `nextRound`/`runStandingOrders`, Kräfteverhältnis `strength`, Speichern/Laden inkl. `sanitizeState` |
| `js/ai.js` | Computergegner: taktische Regeln je Einheit, Produktion inkl. Konter (`counterPick`), Erkundung, Bedrohungskarte (`threatMap`), Landung im Hinterland auf dem Festland (`hinterInfo`); Können `aiSkill(p)` (0 einfach, 1 umsichtig: Zielverteilung `spreadField`, Lagebild `buildPlan`, Jäger-Jagd, vorsichtige Transporter) |
| `js/gfx.js` | Gelände-Rendering (`buildTerrain(TS, st)`), Einheiten-Abzeichen (SVG-Pfade `ICON_SRC` → Sprites, als SVG-Code `unitSvg`), Stadtgrafik |
| `js/sfx.js` | Web-Audio-Synthese: Effekte, Klangteppiche je Einheitentyp (Pegel `LOOP_LEVEL`/`MOVE_LEVEL` nach gehörter Lautheit in LUFS abgestimmt, nicht nach der Spitze – Messweg im Kommentar dort), Klangtest |
| `js/ui-karte.js` | Oberfläche 1: Grundlagen (`$`, `view`, `pad`), Aufzeichnung der Animationen (`anim`, `hooks`), Kamera, Zeichnen der Karte (`render`, `drawToken`, `drawEffect` …), Produktions- und Wegeansicht |
| `js/ui-zug.js` | Oberfläche 2: Landung, Auswahl (`select`, `needsOrders`), automatisches Rundenende, Aktionen (`doMove`, `doGoto`, `act…`), Patrouille, Klick auf die Karte (`onTileClick`), Wegvorschau (`hoverRoute`), `endHumanTurn` |
| `js/ui-leiste.js` | Oberfläche 3: Seitenleiste (`updatePanel`), Kräfteverhältnis (`renderPower`), Kopf- und Hinweiszeile |
| `js/ui-fenster.js` | Oberfläche 4: Eroberung/Produktion, Handbuch (`openHelp`, `buildHelp`), vorzeitiges Ende, Abschlussfenster, Zeitraffer, `startNew`, `afterLoad` |
| `js/ui-eingabe.js` | Oberfläche 5: Maus und Tastatur, Kontextmenü, Meldungen, Schummeln, Tastenlegende, Einstiegstipps (`TIPS`), Menü der Kopfzeile |
| `js/ui-schau.js` | Oberfläche 6: Statistik, Klangtest, Grafik-Übersicht (`openGfx`), Einstellungen, Beispiel-Spielstände |
| `js/ui-start.js` | Oberfläche 7: Spielstände, Sprache (`applyLang`), Willkommensfenster, Start des Spiels – muss als Letztes geladen werden |
| `index.html` | Layout, CSS, Dialoge (Handbuch, Statistik, Spielstände, Klangtest …) |
| `tools/serve.js` | Mini-Webserver für die Entwicklung |
| `tools/pack.js` | Verpackt die Offline-Fassung nach `dist/` (Einzeldatei `archipel-offline.html`, Release-Text; ohne Manifest-Verweis). Seit 1.8.6 kein eigenes ZIP mehr (Wunsch des Nutzers): Die einzelnen Dateien liefert GitHub als „Source code“ zu jedem Release; bis 1.8.5 hieß die Datei `archipel.html` |
| `tools/beispiele.js` | Erzeugt die Beispiel-Spielstände `docs/spielstaende/*.json` (nicht im Release) |
| `tools/test.js` | Automatische Regeltests ohne Browser: `node tools/test.js` (nicht im Release) |
| `tools/test-ui.js` | Oberflächentest im Browser: Wegvorschau gegen Klick, Klick-Abläufe, Einstiegstipps (nicht im Release) |
| `manifest.webmanifest`, `sw.js` | Installierbare App für die Online-Fassung (nur GitHub Pages, nicht im Release) |
| `.github/workflows/release.yml` | Legt bei einem Tag `vX.Y.Z` den Release mit der Offline-Fassung an – erst nach bestandenen Regeltests |
| `.github/workflows/tests.yml` | Lässt bei jedem Push auf `main` (und bei Pull Requests) Syntaxprüfung und `node tools/test.js` laufen |

## Wichtige Zusammenhänge (beim Ändern beachten)

- **Kampf**: Alle Kampfwerte kommen aus `combatSpec(a, d, x, y)` (Stärken, Trefferchance `p`,
  Erstschlag, Hinweistexte). Kampfablauf, angezeigte Siegchance und KI-Bewertung nutzen
  diese eine Funktion – neue Boni nur dort eintragen. Die Tabelle „Wer schlägt wen“ im Handbuch rechnet sich
  daraus selbst; die Sonderregel als Zeile im Reiter „Kampf“ und im Einheitentext ergänzen (siehe „Handbuch“).
- **Beschuss von Land**: Nur Schiffe mit `shore: true` (Kreuzer, Schlachtschiff) erreichen etwas auf einem Landfeld: Einheiten an Land,
  Jäger über Land und alles in einer Stadt, auch Schiffe im Hafen (Wunsch des Nutzers: Zerstörer greifen kein Flugzeug über Land an und
  schießen nicht in Städte – der eigene Hafen ist ein Schutzraum für Transporter vor Zerstörern und U-Booten; Jäger erreichen Schiffe im Hafen weiter).
  `canStrike(a, d, x, y)` (game.js; x, y = Feld des Ziels, sonst sein Standort) entscheidet das; moveStep, KI (`bestAttack`, Jagd der Schiffe,
  Bedrohungskarte je Feld) und Anzeige fragen dort nach. Die Tabelle „Wer schlägt wen“ rechnet auf offenem Wasser.
  Messung Jäger über Land (kleine Karte, alle Welten, alt → neu): Leicht 100 → 99 % (96), Normal 60 → 61 % (384), Schwer 20 → 17 % (288),
  Brutal 3 → 2 % (96), offen 15 → 21 von 864 – im Rahmen, Stufen nicht nachgestellt. Hafen als Schutzraum (Hafen angreifbar → sicher):
  Leicht 99 → 97 % (96), Normal 57 → 61 % (288), Schwer 19 → 15 % (192), Brutal 2 → 1 % (96), offen 11 → 14 von 672 – im Rahmen.
  **Küstenangriff** (`COAST` in game.js, in `combatSpec`): Bodentruppen gegen ein Schiff auf einem Nachbarfeld (nicht in einer Stadt) richten
  dreifachen Schaden an – außer gegen Kreuzer/Schlachtschiff (`shore`). U-Boote sind für Bodentruppen nicht angreifbar (`canStrike`).
  Infanterie → Zerstörer 50 %, Panzer → Zerstörer 75 %, Panzer → Träger 31 %. Die KI-Bedrohungskarte (`threatMap`) berücksichtigt das.
- **Schlachtschiffe**: `fireSupport(owner, x, y)` und `captureChance(owner, c)` (game.js) – Feuerunterstützung/Feuerschutz auf
  Nachbarfelder (Eroberung 75 % / 25 %, Bodentruppen treffen zu 2/3 bzw. werden zu 1/3 getroffen). Eroberungschancen nie fest
  mit 50 % rechnen, immer `captureChance` nehmen (Grundwert `CAPTURE_BASE`, Zuschlag `SUPPORT_CAPTURE`). Salven meldet `hooks.salvo`; Markierungen zeichnet `drawSupportMark` (ui.js). Luftdeckung im Kampf: `hooks.cover` (in `attack`, Jäger gegen Schiff unter `airCover`) – Abfangjäger, Schutzring, Klang `cover`.
- **Sicherer Anfang** (`START_SURE` = 3 in `captureChance`, game.js; Wunsch des Nutzers: Pech bei den ersten Städten entschied zu viel): Solange ein
  Spieler weniger als drei Städte besitzt, fällt eine **neutrale** Stadt sicher – für alle Spieler, auch die KI; gegnerische Städte bleiben beim
  Grundwert. Greift erneut, wenn jemand wieder unter drei fällt. Messung, zwei gleich starke KI ohne Fehler, kleine Karte, je 150 Partien: wer bis
  Runde 25 weniger Infanterie verlor, gewann vorher 65 % (mit mehr Verlusten 37 %), in 14 Partien saß eine Seite in Runde 25 noch auf der Startstadt;
  mit der Regel 49 % / 50 % und 0. Städte je Seite in Runde 25: 3,4 → 4,6; Partiedauer gleich. Varianten „unter 4 sicher“ und „unter 4 mit 75 %“ nicht
  besser. Stufen danach (Platz 0 einfach, klein, je 96 über die drei alten Welten): Leicht 100 %, Normal 59 %, Schwer 16 %, Brutal 1 %, offen 9 von 384
  – Schwer und Brutal etwas schwerer als in der Tabelle unten (24 und 5 von 96), nicht nachgestellt. Tests: in `tools/test.js` bringt `grow()` den
  Spieler über den sicheren Anfang hinaus, bevor Eroberungschancen geprüft werden. Texte: Handbuch (Erste Schritte, Regel „Eroberung“), Einheitentext
  Infanterie, Tipp „Städte erobern“, README.
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
- **Verborgene Stärke:** Ladung fremder Transporter/Träger zeigt die Karte nicht (Marke ohne Zahl, erst nach Spielende oder mit `CHEAT_FOG` alles);
  die KI schätzt fremde Ladung mit `cargoSeen` (Transporter halb voll). Neue Anzeigen über fremde Einheiten dürfen keine Anzahl verraten.
  **Besatzung fremder Städte** (Idee des Nutzers; ui-karte.js `garrisonHidden(x, y)`, `veiledCity(c)`, `knownCapture(c)`): Die Karte zeigt nur das Zeichen
  „besetzt“ (`drawGarrison`, Schild mit Fragezeichen in der Farbe des Besitzers, `ICONS.garrison` in gfx.js) – welche Einheit verteidigt, zeigt sich erst im
  Kampf: Hält der Verteidiger stand, trägt das boom-Ereignis `rv` (Marke für Explosion und Schriftzug), fällt er, zeigt ihn `anim.gone` ab `from`. Vorher stand
  dort die zuerst gebaute Einheit, die Hinweiszeile nannte aber die stärkste – das passte oft nicht zusammen. Deshalb gibt es gegen eine besetzte fremde
  Stadt keine Siegchance (Hinweiszeile: „besetzt – wer die Stadt verteidigt, zeigt sich erst im Kampf“ und nur die Eroberungschance; Karte ohne `drawOdds`;
  Sturm vom Schiff „⚔ ?“, Rückfragefenster ohne Chance), Schiffe im Hafen werden nicht erwähnt, ein Schlachtschiff oder Träger in der Stadt zeichnet weder
  Feuerschutz noch Luftdeckung und zählt in der angezeigten Eroberungschance nicht (`knownCapture` – die Regel selbst rechnet mit `captureChance`), und die
  Reichweite der Gegner färbt die Felder rund um die Stadt. In `drawTileToken` zählt `veiledCity`, nicht `garrisonHidden`: Die Liste enthält dort schon nur
  Sichtbares, während der Wiedergabe mit dem Sichtstand von damals (sonst blitzte nach dem Tod der letzten Einheit neben der Stadt der Kreuzer auf). Die KI
  kennt die Besatzung deiner Städte weiterhin (Entscheidung des Nutzers: Stufen bleiben gültig). Neue Anzeigen über fremde Städte dort nachfragen.
  Handbuch: Zeile „Verborgene Stärke“ im Reiter „Kampf“.
  Messung (je 192 Partien, alt → gedeckter Transporter + KI-Korrektur → zusätzlich verborgene Ladung): Leicht 98/98/97 %,
  Normal 59/65/62 %, Schwer 17/20/22 %, Brutal 2/2/3 %, offen 20/12/13 – im Rahmen, Stufen nicht nachgestellt.
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
  Reiter „Über das Spiel“ (aufgeräumt auf Wunsch des Nutzers): offen stehen nur Speichern und die Beispiel-Spielstände; Hintergrund und
  Kleingedrucktes (Version/Offline, Sprache, Datenschutz, Quelltext und Lizenz, Musik, Städtenamen) sind Zeilen zum Aufklappen
  (`details.about-d`, Titel + Stichwort in `.about-g`). Neues dieser Art dort als weitere Zeile anhängen, nicht als offenen Abschnitt. Die Zeile „Vorbilder“ (auch im README) ist ein persönlicher Text des Nutzers (Amiga, Empire: Wargame of the Century als Vorlage, Carrier Command viel gespielt) – Angaben recherchiert (Bright 1977 Caltech, Interstel 1987 mit Mark Baldwin, Realtime Games 1988, Arbeitstitel „Archipelago“ laut birdsanctuary.co.uk – der Name Archipel ist davon unabhängig entstanden); nicht umformulieren oder um weitere Spiele ergänzen, ohne ihn zu fragen. Ebenso die langen Erläuterungen in „Steuerung“ („Gut zu wissen“) und „Gegner & Stufen“ (Tabelle offen, Spalten und Hintergrund zum Aufklappen).
- **Schummeln „Nebel aus“**: `CHEAT_FOG` (game.js), geschaltet mit `setCheatFog` (ui.js, Haken im Menü mit Rückfrage `askCheatFog`; wird nicht gemerkt,
  `resetCheatFog` in `startNew`/`afterLoad` – jede neue oder geladene Partie beginnt mit Nebel). `computeVision(0)`
  legt dann das echte Kartengedächtnis in `P.real` (`seen`, `knownOwner`) ab und füllt `seen`/`vis`/`sonar` mit 1; `serialize` sichert immer
  das echte. Beim Abschalten kehrt der Nebel zurück. Wer `P.seen`/`P.knownOwner` schreibt, muss `P.real` beachten (bisher schreibt nur
  `computeVision`). In Simulationen bleibt der Schalter aus. Anzeige: Schildchen `.cheat` neben der Rundenzahl.
- **Kräfteverhältnis = Anteil an den Städten** (seit 1.8.3, Wunsch des Nutzers; game.js `cityCounts`, `cityShares`, `recordStrength`, `histFromTimeline`):
  Balken = je Partei ihr Anteil an **allen** Städten in ihrer Farbe, die neutralen grau gestreift (immer Abschnitte, auch im Zweikampf). Einschätzung
  („Überlegen“ …), Kapitulationsangebot und Eroberungsfenster rechnen „du gegen den stärksten Gegner“ nur mit vergebenen Städten (`cityShares().vs`),
  Kurve und Trend mit deinem Anteil an allen vergebenen (`mine`, gestrichelt 50 % bzw. 1/n). Zeitraffer-Kurve gestapelt in Parteifarben, oben grau die
  neutralen. `strongestEnemy` = meiste Städte (Gleichstand: Einheitenwert). `strength(p)` (Einheitenwert + `CITY_VALUE` je Stadt) bleibt für Werkzeuge,
  Tests und `tools/beispiele.js`. Das Kräftefenster (`renderPower`) zeigt Städte je Partei und neutral, Anteile und wie gezählt wird – den Spoiler-Haken
  gibt es nicht mehr: Der Balken verrät die Städtezahl des Gegners ohnehin (dem Nutzer vorher gesagt). Einheiten zählen nicht mehr (eine Flotte auf dem
  Weg sieht man erst, wenn Städte fallen), der Balken springt je Stadt. Messung (130 Partien, 5 Welten, klein/mittel, Normal): Führender gewinnt nach
  Stärke / nach Städten – Runde 60: 68/68 % (klein), 80/79 % (mittel); Runde 90: 85/76, 88/91; Runde 120: 92/82, 88/81; Runde 150: 91/91, 98/94 %.
  Angebot zum vorzeitigen Ende (20 %) in beiden Fällen ohne Fehlgriff, nach Städten ca. 7 Runden später.
  `S.hist` speichert je Runde `{ t, c: Städte je Spieler, n: neutrale }`. Ältere Spielstände hatten Stärkewerte (`me`, `en`, `all`): `sanitizeState` verwirft
  sie, `afterLoad` rechnet den Verlauf aus `S.tl.own` nach (ab `S.tl.from` exakt; Test vergleicht Aufzeichnung und Nachrechnung Runde für Runde).
  Eine ältere Offline-Fassung kann neue Spielstände laden, zeigt dann aber keine Kurve.
  Einstufung (`verdictOf`, `verdictBands` in ui-leiste.js; Wunsch des Nutzers): „Erdrückend überlegen“ über 100 % − Schwelle, „Aussichtslos“ unter der
  Schwelle fürs vorzeitige Ende (`offerPct`, mit denselben Vergleichen wie `maybeOfferEnd`; Schwelle „nie“ → 10 %), „Überlegen“/„Ausgeglichen“ fest bei
  55/45 %, „Klar überlegen“ und „Stark unterlegen“ jeweils in der Mitte dazwischen. Bei 20 %: 80/68/55/45/33/20. Der Erklärtext im Kräftefenster rechnet mit.
- **Zerstörte Einheiten** (Statistik): `killUnit(u, by)` zählt mit – `by` = Spieler, der zerstört hat (→ `S.kills[by][typ]` und beim Opfer `S.lost[besitzer][typ]`), `-1` = ohne
  Gegner verloren (Absturz, neutrale Stadt → `S.wasted[besitzer][typ]`), ohne Angabe nichts (Eroberer wird Besatzung). Wer eine neue
  Stelle einbaut, an der Einheiten sterben, gibt `by` an. `S.killsFrom` = Runde, ab der gezählt wird (ältere Spielstände: ab dem Laden).
- **Zeitraffer**: `recordTimeline()` (game.js, in `startTurn(0)`, `afterLoad`, `showGameOver`) schreibt `S.tl` mit: `from` (ältere Spielstände:
  ab dem Laden), `seen` (Uint16Array: Runde der Entdeckung je Feld, als Base64 gespeichert – Sonderfall in `serialize`), `own` (echte
  Besitzwechsel) und `know` (Wissen des Menschen) als `[Runde, Stadt, Besitzer]`, chronologisch. `openTimelapse` (ui.js, Menü, Taste T,
  Spielende-Fenster) zeigt während der Partie nur `seen`/`know`, nach dem Ende `own` und die ganze Karte; Umland = nächste Stadt
  auf derselben Insel (`tlZone`, ≤ 4 Felder). Kurve aus `S.hist`, folgt `showPower`. Spielstand wird dadurch 5–20 kB größer (klein–groß).
  Der Baustein `#tlView` wird in das zeigende Fenster gehängt (`openTimelapse(host)`: `#tlHome` im Fenster „Zeitraffer“ oder `#overTl`).
- **Abschlussfenster** (`showGameOver(quiet)`, `#mOver`): Kopf wie beim Eroberungsfenster (Sieg golden, Niederlage rot), links der Zeitraffer
  der ganzen Partie, rechts Eckdaten und je Typ gebaut/verloren für jeden Spieler (nach dem Ende alles aufgedeckt; mit mehreren Gegnern
  doppelt breite Kästchen `.w2` und kurze Spaltenköpfe, Kästchen „Ausgeschieden in Runde“). Nach dem Spielende öffnen
  Menü „Zeitraffer“ und Taste T dieses Fenster. Gebaute Einheiten: `S.built[p][typ]` (in `startTurn`), `S.builtFrom` wie `killsFrom`.
  Verloren = `S.lost` (von Gegnern zerstört) + `S.wasted`. Eroberte Städte: `overCityMoves` aus `S.tl.own`.
- **Kartennummer** (`S.seed`, game.js): Startwert des Kartengenerators; `newGame(size, diff, world, seed)`, `parseSeed` (Ziffern direkt, Text per Hash,
  leer = zufällig), `fmtSeed` (Dreiergruppen). Gleiche Nummer + Größe + Welt = gleiche Karte, Städte und Startplätze (nicht die KI-Züge).
  Eingabe und „Diese Welt noch einmal“ im Fenster „Neues Spiel“, Anzeige in Statistik und Abschlussfenster. Der Generator darf nur
  `mulberry32(seed)` nutzen, nie `Math.random` – sonst stimmt die Nummer nicht mehr. Ältere Spielstände: `seed = null`.
- **Spielstände** (ui.js `renderSaves`): nach Partie gruppiert über `S.gameId` (bei `newGame` vergeben, ältere Partien in `afterLoad`; in den
  Metadaten als `game`, dazu `world`/`seed`/`ais` aus `saveSummary`; mehrere Gegner nennt der Gruppentitel). Laufende Partie oben und offen, sonst zugeklappt (`saveOpen`); ohne Kennung →
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
  `S.units` kennt während der Wiedergabe nur den Endstand: Was an einer Einheit hängt (Feuerschutz, Luftdeckung), richtet sich nach ihrer gezeigten Lage
  (`shownAt` in `render`: Startfeld bis zu ihrem Zug, unterwegs ausgeblendet bzw. beim Ring der Luftdeckung mitfahrend) – dem Nutzer fiel der Ring am Zielort auf.
- **Rundenwechsel** (game.js): `nextRound(onPhase)` nach `endTurn(0)` – alle lebenden Gegner ziehen (`enemyTurns`), dann `S.turn++` und
  `startTurn(0)`; `runStandingOrders(p, beforeLoad)` führt die Daueraufträge in fester Reihenfolge aus (Wachen wecken, Marsch, Patrouille,
  Erkunden, Einschub der Oberfläche, Laden). `endHumanTurn` (ui.js), `simGame`, `tools/beispiele.js` und `tools/test.js` rufen dieselben
  Funktionen auf – den Ablauf nie wieder nachbauen (vorher lag er in ui.js, mit drei Kopien der Gegnerschleife).
- **„Wartende“ Einheiten**: `needsOrders(u)` in ui.js steuert „Nächste Einheit“, die Zahl am
  Rundenknopf und das automatische Rundenende. **Reihenfolge** (ui-zug.js `nearestTo`, `selectNext(center, from)`, `actNext`; Wunsch des Nutzers: weniger
  Springen): immer die nächstgelegene wartende Einheit (Züge, dann Luftlinie, dann Nummer). Bezugspunkt: die gewählte Einheit, sonst ihre letzte Stelle
  (`afterAction` gibt sie mit – gefallen oder in einer eroberten Stadt aufgegangen), zu Rundenbeginn die Mitte des bisherigen Ausschnitts. N geht je
  Durchgang jede Einheit einmal durch (`nextCycle`), dann von vorn. Vorher N nach Nummer und ohne Bezugspunkt die älteste: Sprungweite über einen ganzen
  Durchgang mit N in den Beispielen 162 → 75, 628 → 148, 762 → 191 Felder; nach dem Fall einer Einheit im Schnitt 17–20 → 1,7 Felder bis zur nächsten.
- **Schwierigkeit** wirkt auf alle Computergegner (Spieler ≥ 1: `aiKnowsMap`, `aiMistake`, `aiSkill`). In Simulationen spielt die KI auch
  Spieler 0 – dort ohne Fehler und ohne Kartenwissen.
- **Mehrere Gegner** (jeder gegen jeden): `newGame(size, diff, world, seed, nAi)`, Spieler 0 = Mensch, 1 … nAi = Computer
  (höchstens `MAP_SIZES[size].maxAi`: klein 2, mittel/groß 3; Wahl `aiSel` im Fenster „Neues Spiel“, gemerkt in `archipel-ais`).
  `nPlayers()`, `pname(p)` (bei einem Gegner „Gegner“, sonst der Farbname), `uname` hängt bei mehreren Gegnern die Farbe an.
  Computer immer mit `owner >= 1` erkennen, nie `=== 1`. Zähler je Spieler (`kills`, `wasted`, `lost`, `built`, `outAt`) sind Felder der
  Länge `nPlayers()` – neue genauso anlegen und in `sanitizeState` prüfen. `S.lost[p][typ]` = Verluste von p durch Gegner (bei zwei Spielern
  dasselbe wie `kills` des anderen; ältere Spielstände werden umgerechnet). Ausscheiden (Wunsch des Nutzers, einfacher): `checkGameOver` setzt `S.outAt[p]` = Runde, sobald ein
  Gegner keine Stadt mehr hat, und entfernt alle seine Einheiten (`hooks.out`: Wiedergabe zeigt sie bis dahin); gewonnen, wenn alle Gegner
  draußen sind – auch mit einem Gegner (vorher musste man seine letzten Bodentruppen jagen). Der Mensch verliert weiterhin erst ohne Stadt
  und ohne Einheit, die erobern kann.
  Zugfolge: `endHumanTurn` lässt die lebenden Gegner nacheinander ziehen, `anim.phases` merkt, ab wann wer in der Zeitleiste dran ist
  (`updateBanner`: „Gelb zieht …“). Kräftebalken (Wunsch des Nutzers): je Partei ein Abschnitt in ihrer Farbe mit ihrem Anteil an der
  Stärke aller (`#powerSegs`, Klasse `multi`; Zahl nur, wenn der Abschnitt breit genug ist), Kurve und Trend darunter = dein Anteil an allem
  (gestrichelt: gleiche Anteile 1/n), Zeitraffer-Kurve gestapelt in allen Farben (`tlCurve`) – dafür speichert `recordStrength` in `S.hist`
  zusätzlich `all` (Stärke je Spieler; ältere Einträge ohne). Das Urteil („Überlegen“ …) und das Angebot zum vorzeitigen Ende vergleichen
  weiter mit dem stärksten Gegner (`strongestEnemy`). Das Kräftefenster hat eine Spalte je Gegner (Anteil immer, Zahlen nur mit dem
  Spoiler-Haken), das Abschlussfenster Spalten je Spieler. Kopfzeile: Punkte je Gegner (`.foes`, blass = ausgeschieden). Startplätze: zwei Spieler wie bisher (gleiche
  Kartennummer = gleiche Karte wie vor der Erweiterung), ab drei `pickStarts` (map.js: weit auseinander, möglichst auf verschiedenen
  Landmassen, ähnlich viele Städte im Umkreis).
- **Wegvorschau** (ui.js; Grund: Ein Erstspieler wollte eine Stadt nur ansehen und schickte die gewählte Einheit los). Beim Überfahren
  (`hoverRoute`, Idee des Nutzers): Mit gewählter Einheit zeigt die Karte zu jedem entfernten Feld Weg und Dauer („3 Runden“, `drawGotoConfirm`),
  der Klick gibt wie immer sofort den Marschbefehl (`doGoto`). Nur bei einer entfernten eigenen Stadt (`gotoPreview` in `onTileClick`) zeigt der erste
  Klick die Stadt in der Seitenleiste („Stadt · Ziel“) und hält den Weg fest („… · noch einmal klicken“), der zweite schickt los; Esc, Rechtsklick,
  andere Auswahl oder ein Klick woandershin verwerfen das. Zwei Klicks für jeden Marsch waren kurz gebaut – unnötig, seit die Linie warnt.
  Jäger (`fuelState`, dieselben Regeln wie `doGoto`): Linie und Schild orange „kein Rückweg!“, wenn der Treibstoff hin, aber nicht mehr zur nächsten
  Stadt/zum Träger reicht, rot „Treibstoff reicht nicht“, wenn das Ziel außer Reichweite liegt. Kein Weg: durchgestrichener Kreis und der Grund
  („Bodentruppen kommen nicht übers Wasser …“, „Schiffe fahren nicht an Land“, sonst „Kein Weg dorthin“). Achtung: `findPath` lässt jedes Zielfeld zu
  (Angriff, an Bord gehen) – ob die Einheit das Feld betreten kann, prüft `hoverRoute` mit `canEnterTerrain`, nur für erforschte Felder.
  Auch auf dem Nachbarfeld steht der Grund, wenn die Einheit dort nichts tun kann (kein Zugmarker aus `moveHints`: Schiff neben Land, Bodentruppen
  neben Wasser) – mit Angriffs- oder Bordmarker bleibt es ein gültiges Ziel. Eigener Transporter/Träger mit freiem Platz in der Ferne:
  Linie plus „… · Umschalt + Klick: an Bord gehen“ – der einfache Klick wählt ihn weiter aus (ein Erstspieler fand den Weg an Bord nicht; zwei Klicks
  wie bei der Stadt wären beim ständigen Umschalten zwischen Einheiten lästig). Vorschau und Klick sind deckungsgleich: Was als
  unerreichbar gezeigt wird, lehnt auch der Klick mit demselben Grund ab (vorher fuhr ein Schiff bei Klick auf Land bis an die Küste); fremde
  Städte und sichtbare Gegner sind gültige Marschziele. Steht auf dem Feld eine eigene Einheit, wählt der Klick sie aus; der Hinweis erscheint
  trotzdem, wenn das Gelände selbst sperrt (`noGoReason`: Transporter zeigt auf Infanterie an Land, Infanterie auf vollen Transporter → „… ist voll“).
  Eigene Einheit auf betretbarem Feld in der Ferne: Linie plus „… · Umschalt + Klick: hinmarschieren“. Die Vorschau unter der Maus ist abschaltbar
  (`showRoute`, `archipel-route`, Einstellungen → Anzeige; Wunsch des Nutzers für erfahrene Spieler) – der festgehaltene Weg zur Stadt und die
  Ablehnung beim Klick bleiben. Esc verwirft erst nur den festgehaltenen Weg; Umschalt + Klick auf eine eigene Stadt marschiert sofort. Getestet mit einer Matrix im Browser
  (9 Einheitentypen × 15 Fernziele und × 11 Nachbarziele, je Vorschau gegen Klick-Ergebnis).
  Die Vorschau rechnet mit Gelände und sichtbaren Gegnern, aber ohne eigene Einheiten (`findPath(…, false, true)`): Die ziehen weiter, der Marsch
  wartet oder weicht aus – sonst hieße es vor einer besetzten Brücke „kein Weg“. Wegsuche nur bei Feldwechsel (`hoverPath`, `refresh()` verwirft). Tastentabelle im Handbuch beachten.
- **Rand um die Karte** (ui.js `pad`, `view`, `applyPad`; `#mapPad` in index.html): Um die Leinwand liegt ein leerer Streifen von einer halben
  Fensterbreite/-höhe, damit jedes Feld in die Bildmitte passt (ein Erstspieler war verwirrt: Start am Kartenrand lag am Bildrand, unten links
  unter der Tastenlegende). `view.x`/`view.y` = Kartenpixel an der linken oberen Ecke des Sichtfensters (auch negativ) – immer darüber rechnen,
  nie mit `wrap.scrollLeft`/`scrollTop`; `clampCenter` begrenzt nur noch auf die Karte. Auch `tools/video/rec.js` rechnet mit `view`.
- **Gewählte Einheit finden** (Hinweis des Nutzers: am Rand des Ausschnitts übersehen; jedes Mal in die Mitte wäre zu viel Bewegung):
  `drawSelRing(x, y, pulse, now)` mit dunklem Saum (trägt auf Schnee und Wüste) und Herzschlag – alle `SEL_BEAT` ms eine Welle nach außen, nicht bei
  reduzierter Bewegung (`calmMotion`). **Suchring** (ui-karte.js `ping`, `drawSelPing`, `PING_MS`): Wechselt die Auswahl von selbst (nächste Einheit nach
  einem Zug, Rundenbeginn, Tasten N und Leertaste) oder auf Taste F (`pingAgain`), ziehen sich zwei Ringe von weit außen auf die Einheit zusammen. Ausgelöst
  in `render`, erst wenn Kamera, Wiedergabe (`anim.after`), `pendingCenter` und Fenster ruhen – also nach dem Schwenk. Auswahl per Klick (Karte, Rechtsklick,
  Ladung in der Seitenleiste) ruft `pingSkip`; neue Stellen, an denen der Spieler selbst auswählt, ebenso. **Kamera:** `wellInView(x, y)` (ui-zug.js) –
  Abstand zum Rand mindestens 3 Felder und ein Sechstel des Ausschnitts (herausgezoomt reichten 3 Felder nicht), nicht unter Tastenlegende oder Tipp;
  sonst rücken `centerOn`, `focusOn` und der Schwenk zur nächsten Einheit sie in die Mitte. Neue Elemente über der Karte dort eintragen.
- **Karte bewegen** (ui.js): Ziehen mit jeder Maustaste (links erst ab `DRAG_THRESHOLD_LEFT`, der Klick danach wird über
  `dragSwallow` verschluckt), Umschalt + Pfeiltasten, Klick auf die Übersichtskarte. Rad-Ereignisse: Mausrad zoomt,
  Touchpad-Wischen verschiebt (`looksLikeTouchpad`: kleine, krumme oder seitliche Schritte), Spreizgeste = Rad mit Strg = Zoom.
  Die Einstellung `archipel-wheel` (auto | zoom | pan, im Menü unter „Einstellungen“) übersteuert die Erkennung.
  Echte Touchpad-Gesten lassen sich im eingebauten Browser nur als nachgestellte Rad-Ereignisse testen.
- **Tastatur und Fenster** (ui.js, `keydown`): Tasten in Eingabefeldern, Häkchen, Reglern und Auswahllisten gehören dem Feld – außer Esc bei
  offenem Fenster: Das schließt es immer (vorher blieb z. B. „Spielstände“ offen, weil das Namensfeld den Fokus hat); nur ein Suchfeld mit Text
  leert Esc zuerst. `closeModals` nimmt den Fokus aus dem Fenster, damit die Spieltasten danach wieder greifen.
- **Kopfzeile und Menü**: Oben stehen nur Runde + Stufe (`updateHeader`), `☰ Menü`, Zoom, Zentrieren (Fadenkreuz/Taste F, `actFocus` → `focusOn`), Ansicht, Ton, Handbuch, Sprache.
  Ordnung der Leiste (Konzept mit dem Nutzer): Menü (Spiel, Seltenes) | Karte (Zoom, Zentrieren, Ansicht) | Ton | Hilfe (Handbuch, Sprache). **Ansicht** (`#bView`, Auge;
  `openViewMenu`/`renderViewMenu`/`VIEW_SW` in ui-schau.js, Liste `#viewMenu`): ein Symbol für alles, was die Anzeige der Karte betrifft – Schalter Tastenkürzel,
  Wegvorschau, Kräfteverhältnis (dieselben wie in den Einstellungen: `setShowKeys`, `setShowRoute`, `setShowPower`), Wege und Marschziele (`setPathView`) und darunter die fünf Landschaften mit Farbfeld
  (Wunsch des Nutzers: Landschaft mitten im Spiel wechseln als Gimmick). Die Liste bleibt beim Klicken offen. Neue Anzeige-Optionen kommen dorthin, nie als
  weiteres Symbol in die Leiste. Seltenes liegt im
  Menü `#menu` (`openMenu`/`closeMenu`, ui.js): Neues Spiel, Spielstände, Statistik, Zeitraffer und „Einstellungen …“. Die Einstellungen stehen im
  eigenen Fenster `#mSettings` (`openSettings(tab)`, `setTab`), in vier Reitern wie im Handbuch (`data-settab`/`data-setpane`: Anzeige, Spielablauf, Ton & Steuerung,
  Schummeln & Zurücksetzen – Wunsch des Nutzers: Das Fenster war anderthalbmal so lang wie der Bildschirm; die letzten beiden sind keine gewöhnlichen
  Einstellungen und stehen im rot gestrichelten Kasten `.set-special`; dieser Reiter wird nicht gemerkt, `archipel-settab`), je Zeile ein erklärender Satz
  (`.set-row` + `.set-d`): Lautstärke, Klangtest, Wiedergabe der Züge, Wegvorschau beim Zeigen (`showRoute`), Grafiken (Übersicht, siehe unten), Kräfteverhältnis anzeigen (`showPower`, `archipel-power`), Tastenlegende über
  der Karte (`showKeys`, `archipel-keys`; beim ersten Besuch an, sonst aus; das × klappt sie nur zum Schildchen „⌨ Tasten“ ein (`keysMin`, `archipel-keys-min` – ein Erstspieler hatte sie geschlossen und fand sie nicht wieder; ganz aus nur über Einstellungen oder Ansicht; das Schildchen liegt immer unten links, aufgeklappt kehrt die Legende an ihre gemerkte Stelle zurück); verschiebbar am Griff `.kl-grip` oben – Wunsch des Nutzers –, Stelle in `keyPos`/`archipel-keys-pos`, Doppelklick legt sie zurück; `updateKeyLegend` in `refresh()`, blendet ab, was gerade nicht geht – neue Tastenkürzel dort
  und in der Tastentabelle des Handbuchs eintragen), automatisches Rundenende, Schwelle fürs Angebot zum vorzeitigen Ende (`offerPct`, `archipel-offer`,
  0 = nie, Standard 20 %; `maybeOfferEnd`. Zusatzbedingungen nach einem Spielstand des Nutzers (Runde 38, 84 %, aber 47 von 56 Städten neutral und der Gegner noch nicht gefunden – „zu früh“): Angebot erst, wenn höchstens die Hälfte der Städte neutral ist (`OFFER_NEUTRAL`), der Sieg nur, wenn eine Stadt eines Gegners bekannt ist. Messung, 192 Partien: Angebote vor Runde 60 vorher 16 (mittel/Leicht 11 von 42), danach 0; die übrigen so früh wie bisher, kein falsches. Bis 1.7.4 waren es 10 % – dem Nutzer zu spät. Messung KI gegen KI, 288 Partien, klein/mittel, Normal/Schwer: Angebot falsch bei 10/15/20/25/30/35 % in 0/0/1/3/7/22 Fällen von ca. 280; es kommt vor dem Ende um 10/18/29/43/63/91 Runden (klein) bzw. 20/30/44/66/86/120 (mittel)), Mausrad/Touchpad, Nebel aus. Neue Einstellungen dort einhängen, nicht ins Menü, in die Kopfzeile oder Seitenleiste.
  Die Hinweiszeile `#hover` (Feld unter der Maus, Siegchance) steht über der Karte (`#infoBar` in `#mapCol`, so breit wie die Karte);
  während die Zeitleiste nach dem Rundenende läuft, liegt dort `#banner` darüber – erst „Gegner zieht …“, ab `anim.ownFrom`
  (eigene Märsche/Patrouillen der neuen Runde) „Deine Einheiten führen ihre Befehle aus …“ (`updateBanner`). Meldungen fürs Spielgeschehen gehören an diese eine Stelle.
- **Einstiegstipps** (ui.js `TIPS`, `tipState`, `updateTips` in `refresh()`, Karte `#tipBox` oben links; Wunsch des Nutzers: Ein Erstspieler wusste
  am Anfang nicht, was zu tun ist): sieben kurze Hinweise, ausgelöst vom Spielstand, jeder einmal – Start, Maus und Karte (ab Runde 2), Städte erobern,
  Produktion (Städte bauen von selbst Infanterie – der Tipp sagt ausdrücklich, dass man nichts einstellen muss), Transporter
  (erst wenn das eigene Land zu ≥ 90 % erkundet ist und keine bekannte fremde Stadt mehr über Land erreichbar), Zerstörer zum Erkunden, Feindkontakt.
  Dazu je ein Tipp zur ersten eigenen Einheit jeder Art außer Infanterie (`UNIT_TIPS`, Kopf „Neue Einheit · …“, Zahlen aus den Spieldaten) –
  ändert sich eine Einheitenregel, den Tipp mit anpassen. Und je einer nach dem ersten Sieg (`S.kills[0]`: Kampfablauf, Schaden, Reparatur in der
  Stadt) und dem ersten Verlust (`S.lost[0]` oder gescheiterte Eroberung in `S.wasted[0]`: Siegchance vorher ansehen, Fehlschläge sind normal) sowie nach dem ersten abgestürzten Jäger (`S.wasted[0].ftr`: Treibstoff, rechtzeitig landen) und dem ersten versenkten beladenen
  Transporter (`tips.sunk`: `updateTips` merkt sich die beladenen eigenen Transporter und sieht nach, ob einer fehlt; gilt zugleich als „erster Verlust“, `also`). Die erste eroberte Stadt deckt der Grundtipp `build` ab („Erste Stadt erobert!“), die erste
  verlorene `citylost` (`tips.cityLost`, eigene Städte ebenso verfolgt), die erste einem Gegner abgenommene `foecity` (`tips.foeTaken`). Befehle kommen in der Lage, in der sie helfen: Heimkehr `home` (Jäger mit
  knappem Treibstoff), Wache `sentry` (ab Runde 8 mit ≥ 4 Wartenden), Marschziel `rally` (ab 4 Städten), Produktionsansicht und Statistik `plan`
  (ab 6 Städten). Patrouille bleibt bewusst im Handbuch. Mit jedem weiteren Tipp steigt die Gefahr, dass sie nur weggeklickt werden – sparsam bleiben. Ein Tipp, der drei Runden unbeachtet stehen bleibt, gilt als erledigt und
  macht Platz (`tips.shown`) – sonst blockierte er alle folgenden. Kopfzeile ohne Zähler („1 / 7“ zählte nur die Grundtipps und verwirrte). Ein neuer Tipp gleitet herein, leuchtet dreimal gelb auf (`.tip-new`, bei reduzierter Bewegung nur ein Rahmen) und gibt einen leisen Ton – oben links wurde er sonst übersehen (Wunsch des Nutzers); Gelb statt Blau hebt ihn von der Oberfläche ab.
  „Verstanden“ blendet aus, „Tipps ausschalten“ oder Einstellungen → Spielablauf (`tipsChk`) schaltet ab; Einschalten beginnt von vorn.
  `archipel-tips-on` / `archipel-tips` (erledigte, über alle Partien). Vorgabe: an nur beim allerersten Besuch. Bewusst wenige und kurze Texte –
  nicht zum Regelwerk ausbauen, dafür ist das Handbuch da. Probelauf (KI spielt, 4 Karten): Tipps kamen in sinnvoller Reihenfolge (R1, 4, 5–22, 22–57 …).
- **Produktionsansicht** (ui.js): `prodView`, umgeschaltet mit `setProdView(on)` (Schalter in der Seitenleiste, Taste V).
  `render()` zeichnet dann nach dem Nebel nur `drawProdView()` (Symbol, Fortschrittsring, Restzeit je eigener Stadt) und
  bricht ab; Klicks öffnen `openProdDialog`, Einheitentasten sind gesperrt. Direkt unter dem Schalter steht die Tabelle `#prodStats`
  (`updateProdStats`: je Typ im Bau, nächste fertig in, vorhanden). Rundenende, „Nächste Einheit“, neues Spiel und
  Laden schalten zurück. Der Zustand wird nicht gespeichert.
- **Wegeansicht** (ui.js): `pathView`, umgeschaltet mit `setPathView(on)` (Schalter „Wege und Marschziele“ in der Liste „Ansicht“ der Kopfzeile, Taste G; bis 1.7.7 dritter Knopf des Schalters in der Seitenleiste – dort stehen nur noch die Arbeitsmodi Einheiten | Produktion, die Produktionsansicht bleibt bewusst dort). Anders als
  die Produktionsansicht nur eine zusätzliche Ebene unter den Einheiten – das Spiel läuft normal weiter, sie bleibt über Runden an.
  `buildPathCache()` sammelt Märsche (weiß, Pfeil), Patrouillen (türkis, Punkte) und Marschziele (gelb, Fähnchen), `drawRoute` zeichnet;
  `refresh()` verwirft den Cache (Wegsuche nie in jedem Bild). Legende mit Anzahl: `updatePathLegend` (`#pathLegend`).
- **Reichweite der Gegner** (ui-karte.js `threatView`, `setThreatView`, `buildThreatMap`, `drawThreat`; Wunsch des Nutzers nach dem Vorbild Fire Emblem):
  zuschaltbare Ebene (Liste „Ansicht“, Taste K, gemerkt in `archipel-threat`). Rot getönt mit Umriss = Felder, auf denen eine sichtbare gegnerische
  Einheit in ihrem nächsten Zug angreifen könnte; nur schraffiert = allein von Jägern erreichbar. Je Einheit volle Bewegung über betretbares Gelände,
  letzter Schritt = Angriff (Bodentruppen auch auf Wasser am Ufer, Schiffe an Land nur mit `shore`, Transporter nur aufs Land daneben, Träger nichts);
  ohne andere Einheiten und ohne Treibstoff. **Darf nichts verraten:** nur `canSee(0, e)`, um besetzte fremde Städte nur die Felder rundum (Besatzung verborgen), keine Ladung,
  nur erforschte Felder (sonst zeichnete die Ebene Küsten im Nebel nach). Cache `threatMapUi`, von `refresh()` verworfen (0,1 ms je Berechnung).
  Nicht während der Wiedergabe und nicht nach Spielende. Ändern sich Angriffsregeln (`canStrike`), hier mit anpassen. Noch nicht in der Grafik-Übersicht.
- **Lupe** (ui-karte.js `setLoupe`, `drawLoupe`, `LOUPE_D`; Wunsch des Nutzers statt größerer Zoomstufen – die wären nur zum Anschauen, und die Karte
  ist ein einziges Bild in voller Größe: bei 48 Pixeln je Feld ist auf der großen Karte Schluss, der Umbau auf „nur den Ausschnitt zeichnen“ lohnt dafür
  nicht): Taste O gedrückt halten → runder Ausschnitt unter der Maus, ca. 2,5-fach (64–104 Pixel je Feld), neu gezeichnet statt hochskaliert –
  `buildTerrain(ts, st)` mit einem Kartenstück (`st.ox`/`st.oy` = Lage auf der Karte), Städte, `drawFog`, Marken über `drawTileToken` (aus `render`
  herausgelöst). Zeigt nur, was die Karte zeigt; ohne Marker, Wege, Effekte; aus während der Wiedergabe und bei offenem Fenster. Dafür würfelt
  `buildTerrain` Wellen, Bodenstruktur, Bäume und Berge jetzt **je Feld** (`seedAt`, Startwert aus der Lage) statt der Reihe nach über die Karte – sonst
  sähe ein Ausschnitt anders aus als dieselbe Stelle der Karte. Neue Zufallsdetails im Gelände genauso anlegen. Bäume stehen seit 1.8.0 deshalb woanders.
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
- **Jäger auf dem Marsch** (`runGoto(u, auto)`, game.js; Wunsch des Nutzers): In der Runde des Befehls fliegt der Jäger auch ohne Rückweg los (die
  Vorschau warnt, der Spieler entscheidet). In Folgerunden (`auto`, Aufruf in `endHumanTurn`) hält er an, bevor nach dem nächsten Schritt der
  Treibstoff nicht mehr für den Heimweg reichte (+1 Feld Reserve, wie bei der Patrouille) – Meldung, Befehl weg, der Spieler entscheidet. Flüge
  zu einer eigenen Stadt oder einem eigenen Träger laufen durch. Er steht dann mit Restzügen in der Luft: Unbenutzte Züge kosten am Rundenende Treibstoff.
- **Befehle, die gerade nichts bewirken** (ui-zug.js `orderCheck(u)`; Wunsch des Nutzers): eine Stelle sagt je Befehl (`skip`, `sentry`, `patrol`,
  `explore`, `home`, `load`) null = möglich oder den Grund als Text. Alle fragen dort nach: Knöpfe der Seitenleiste (grau, Grund als Hinweistext),
  Rechtsklick-Menü, Tastenlegende (blendet ab) und die Befehle selbst – die Taste meldet den Grund mit Fehlerton (`orderDenied`) und gibt keinen
  Befehl. Beispiele: „Heimkehr“ in der eigenen Stadt, „Erkunden“, wenn es nichts mehr zu entdecken gibt (`explorePath` findet weder einen sicheren
  noch einen riskanten Weg), Treibstoff reicht nicht heim. Ausnahme: Leertaste ohne Züge geht still zur nächsten Einheit (man drückt sie oft).
  Neue Befehle dort eintragen, nie an einer einzelnen Stelle abfragen. Ergebnis gilt bis zum nächsten `refresh()` (`orderCache`; < 1 ms je Einheit,
  große Karte). `UiTest` prüft 19 Lagen × 6 Befehle: Knopf, Menü und Taste einig; aktiver Knopf bewirkt etwas.
- **Patrouille ist ein Dauerbefehl** (`runPatrol`, game.js): endet nur durch den Spieler, Feindkontakt oder einen unerreichbaren Wegpunkt.
  Jäger tanken zwischendurch selbst: Reicht der Treibstoff nach dem nächsten Schritt nicht mehr für den Heimweg (+1 Feld Reserve),
  fliegt er zur nächsten Stadt (`o.refuel`, `refuelBase`) und macht danach beim selben Wegpunkt weiter. Zweimal Umkehren für denselben
  Wegpunkt (`o.rf`) heißt „außer Reichweite“ und beendet die Patrouille. Früher brach der Jäger hier ab und stand ohne Befehl in der Stadt.
- **Stege** (gfx.js, `buildTerrain`): Berühren sich zwei Landfelder nur an einer Ecke, dürfen Bodentruppen diagonal hinüber und Schiffe
  diagonal hindurch (Bewegung in 8 Richtungen, keine Sperre an Ecken). Die Karte zeigt das mit abgerundeten Ecken und einem kleinen Holzsteg.
  In Inselwelten selten (0–5 je Karte); auf dem Festland sind es die Brücken über die Flüsse (Flussschritt über Eck alle 2–4 Felder, im Schnitt 5 / 11 / 21 je Karte nach Größe).
  Wer die Regel an Ecken ändert, muss auch diese Darstellung, den Festland-Generator und den Handbuchsatz anpassen.
- **Zoom am Anfang**: `startNew` setzt `TS = START_ZOOM` (44, fast ganz nah; Wunsch des Nutzers: herausgezoomt dominiert am Anfang der Nebel). Gilt für
  jede neue Partie und wird wie eine eigene Wahl gemerkt; geladene Partien behalten die gemerkte Stufe.
- **Grafik-Caches**: Gelände (`buildTerrainCache`) und Sprites hängen von der Zoomstufe `TS` ab.
- **Landschaften** (Wunsch des Nutzers; data.js `LAND_KEYS`/`START_LANDS`, gfx.js `LANDSCAPES`/`landscape()`, ui-schau.js `setLandscape`/`LAND_NAMES`,
  Einstellungen → Anzeige): Grüne Inseln, Wüste, Schnee, Lava, Fremder Planet, Klimazonen – dieselbe Karte, nur anders eingefärbt, ohne Einfluss auf Regeln.
  Die Landschaft gehört zur Partie (`S.land`, in `sanitizeState`, ältere Spielstände und die Beispiele: grün). Die Landschaft ist **eine dauerhafte Einstellung** (`landPref`, `setLandscape` in ui-schau.js, `archipel-landscape`, Vorgabe `DEFAULT_LAND` =
  Klimazonen; Wunsch des Nutzers – getrennte Einstellungen für die laufende und für neue Partien waren umständlich): Umschalten über „Ansicht“ oder
  Einstellungen → Anzeige gilt sofort für die laufende Partie und bleibt für neue eingestellt (auch den Start ohne Spielstand). Gespeicherte Partien
  zeigen beim Laden die Landschaft, mit der sie gespeichert wurden (`S.land`, Wunsch des Nutzers) – das ändert die Einstellung nicht; das Auswahlfeld
  in den Einstellungen zeigt, was die Karte gerade zeigt. „Zurücksetzen“ stellt sie zurück. In den Einstellungen sind jederzeit alle wählbar (ändert `S.land` der laufenden Partie),
  ebenso über „Ansicht“ in der Kopfzeile (siehe „Kopfzeile und Menü“). Je Landschaft ein Farbsatz (Wasser nach Tiefe,
  Strand, Land nach Höhe, Brandung, Berge, Gipfel, Hügel, „Wald“ – in der Lava glühende Tümpel, auf dem Planeten magentafarbene Gewächse –,
  Farben der Übersichtskarte); Formen und Zufallsfolge in `buildTerrain` sind für alle gleich, feste Farben dort immer über `L.…` holen. Der
  Zeitraffer bleibt bei seinen eigenen Farben (er färbt das Land ohnehin nach Besitzer). Lava: erst war das Meer heller als das Land – jetzt
  dunkles Meer, helleres warmes Land. Eigene Formen je Landschaft (Palmen, Tannen, Eisschollen) gibt es bewusst noch nicht.
  **Klimazonen** (`zonen`, Wunsch des Nutzers statt „je Insel zufällig“): je Feld einer der Farbsätze Grün/Wüste/Schnee/Lava nach der Lage
  (`zoneMap`, `ZONE_KEYS`, `tileLandscape` in gfx.js): Abstand zur Mitte oben/unten mit welligem Rauschen – über `ZONE_SNOW` (0,78) Schnee, unter `ZONE_DESERT` (0,17) Wüste (Grün übergewichtet, Wunsch des Nutzers: Land mittel über alle Welten Grün/Wüste/Schnee/Lava 63/17/15/6 %, vorher mit 0,62/0,28 34/27/36/4 %),
  dazwischen Grün; Inseln unter 15 % des Landes einheitlich nach der **Rangfolge** ihrer Mitte von Nord nach Süd (`ISL_SNOW` je 10 % im Norden und Süden Schnee, `ISL_DESERT` die
  mittleren 15 % Wüste, 12 % Lava, nie im Schnee – Wunsch des Nutzers; nach der absoluten Lage gab es mit dem schmalen Schneegürtel im Inselreich oft keine
  Schneeinsel; jetzt in 30 Karten aller Welten keine ohne Schnee oder Wüste; Land mittel: Inselreich 64/19/10/7 %, Binnenmeer 53/7/34/5 %), große Landmassen Feld für Feld mit
  Lavafeldern aus einem zweiten Rauschen. Wasser überall grün-blau, Strand in der Farbe des Landes daneben, Brandung einheitlich. Zufall nur aus der
  Kartennummer (`S.seed`), Cache je Partie. `buildTerrain` holt den Farbsatz je Feld (`pal(x, y)`; Lupe über `st.ox/oy`), Kartenstücke der
  Grafik-Übersicht bleiben grün; Übersichtskarte über `tileLandscape`. Binnenmeer wirkt sehr verschneit, weil der Landring oben und unten liegt.
  **Farbprüfung** (alle 4 Parteien + neutral × 5 Farbsätze × Land flach/mittel/hoch, Strand, Wasser flach/tief; Farbabstand ΔE in Lab, < 25 = schwach):
  Einheiten überall ≥ 31 (am knappsten Gelb auf Wüste 31–37, Blau auf Wasser 33–39, Violett auf violettem Planetenwasser 35 – je mit dunklem Rand
  gut lesbar). Städte der Parteien: nur Gelb auf Wüste knapp (Platz 20–22, Rand 30+). Neutrale Städte verschwanden fast (beiger Platz auf Sand und
  Schnee 10–25) → seitdem dunkler Rand `#4a4f57` statt `#7f7254` (citySprite): Auf hellem Grund trägt der Rand, auf Lava der helle Platz.
  Neue Landschaft oder Parteifarbe → diese Prüfung wiederholen (Musterbogen: `gfxMap` + `buildTerrain` + `citySprite`/`drawToken` je Farbsatz).
- **Grafik-Übersicht** (Wunsch des Nutzers, wie der Klangtest; Einstellungen → Anzeige → Grafiken, `#mGfx`, ui.js `openGfx`/`renderGfx`): Reiter
  Einheiten (Abzeichen je Farbe, Zeichen an der Marke, SVG-Symbole der Oberfläche), Städte und Gelände, Markierungen, Animationen (▶ mit Ton).
  Alles wird mit den Zeichenfunktionen der Karte gezeichnet, nie nachgebaut: `drawOn(g, ts, fn)` leitet `ctx` und `TS` kurz auf eine kleine
  Leinwand um (deshalb `let ctx`), `buildTerrain(TS, st)` und `drawFog(P, st)` nehmen ein Kartenstück aus `gfxMap(rows)`. Dafür aus `render()`
  herausgelöst: `drawEffect(e, f)` (Explosion, Salve, Luftdeckung, Schriftzug, Eroberung), `drawHint`, `drawSelRing`, `drawGotoPath`,
  `drawAssaultChance`, `drawHoverFrame`, `drawOdds`, `drawProdCity`; Klänge der Zeitleiste in `eventSound`. Neue Zeichenfunktionen ebenso über
  `ctx`/`TS` schreiben und neue Grafiken oder Effekte in der Übersicht ergänzen. Animationen = kleine Zeitleisten (`gfxAnimSpecs`) mit denselben
  Ereignissen wie `anim.events`, Zeiten wie in den `hooks`. SVG-Code: `unitSvg(type, owner, badge)` aus `ICON_SRC` – Abzeichen wie `unitSprite`
  (Bildvergleich: im Mittel ≤ 1 von 255 Farbstufen Abweichung) oder nur Symbol (Maske, `currentColor`); App-Symbol aus dem `<link rel=icon>`
  (Einzeldatei: data-Adresse, sonst `fetch`; einzelne Dateien über file:// nicht lesbar → Hinweis), „Zentrieren“ aus `index.html`. Städte, Gelände
  und Effekte entstehen aus Zeichenbefehlen und haben keinen SVG-Code. Kopieren braucht einen echten Klick (Zwischenablage); per Skript lehnt der Browser ab.

## Entwickeln und testen

1. Server starten: Vorschau-Konfiguration „archipel“ (`.claude/launch.json`, lokal, nicht im
   Repo) oder `node tools/serve.js .` → http://localhost:8765
2. Syntax prüfen: `for f in js/*.js; do node --check $f; done`
   **Tests laufen lassen – vor jedem Commit, der Regeln oder Oberfläche ändert:**
   - `node tools/test.js` (ca. 6 s, 35 Tests; auch: `index.html`, `CORE` in `sw.js` und der Ordner `js/` nennen dieselben Skripte): Kampfchancen aus dieser Datei (89/25/44 %, Küstenangriff 50/75/31 %, Luftdeckung 33 %), `canStrike`,
     Eroberung 50/75/25 %, Gelände, Transporter, Treibstoff und Jäger-Marsch, U-Boot-Ortung, Ausscheiden, Spielstand (stabil, kaputte Dateien,
     alle Beispiele) und drei ganze KI-Partien mit Prüfung nach jeder 10. Runde (`invariants`: niemand im falschen Gelände, eine Einheit je Feld
     außerhalb von Städten …). `node tools/test.js kampf` = nur Tests mit dem Wort im Namen.
   - Im Browser (localhost:8765): `eval(await (await fetch('tools/test-ui.js')).text()); await UiTest.run()` (ca. 10 s, 796 Prüfungen) – Ladereihenfolge der Skripte, Durchlauf aller Fenster, Tasten, Ansichten und des Zeichnens (`walkthrough`), 9 Einheiten
     × 15 Fernziele und × 9 Nachbarziele, je Vorschau gegen Klick-Ergebnis, dazu Klick-Abläufe, Suchring, verborgene Besatzung, Luftdeckung in der Wiedergabe, Reihenfolge der Einheiten und jeder Tipp-Auslöser. Ersetzt die laufende Partie.
   GitHub lässt die Regeltests bei jedem Push laufen (`tests.yml`, rotes Kreuz am Commit und Mail bei Fehler) und als Sperre vor dem Release
   (`release.yml`). Die Online-Fassung baut unabhängig davon aus `main` – ein Fehler dort wird gemeldet, aber nicht verhindert. Bewusst keine
   Pull Requests (Entscheidung mit dem Nutzer: für eine Person zu viel Zeremonie; neu überlegen, wenn andere beitragen).
   Dazu Befehle des Spielers (Patrouille, Erkunden, Marschziel, Sturm vom Schiff, Ausladen), Spielstände anlegen/laden/löschen und eine Partie auf Schwer.
   **Abdeckung** (gemessen nach dem Ausbau): Regeln, KI und Karte 93 % der Zeilen (`NODE_V8_COVERAGE=dir node tools/test.js`, game.js 88 %, ai.js 97 %,
   map.js 100 %); Oberfläche 80 % der Funktionen (165 von 205 werden im Browsertest aufgerufen – gezählt mit Zähl-Hüllen um alle globalen Funktionen).
   Nicht abgedeckt: Landungs-Rückfrage, Marschziel per Klick, Touchpad-Erkennung, Kamerafahrten, Klänge der Wiedergabe. Die Zahlen sagen, was
   läuft, nicht, ob es stimmt – wie die Karte aussieht, prüft kein Test.
   Neue Regel oder behobener Fehler → Test ergänzen. Ändert sich ein Wert absichtlich, den Test und die Zahl in dieser Datei mit anpassen.
   Gegenprobe beim Anlegen: verstellte Regel (`CAPTURE_BASE` 0,6) und abgeschaltete Hinweise (`noGoReason`) fielen auf (1 bzw. 32 Fehler).
   Dabei gefunden, kein Fehler: Lehnt der Generator eine Kartennummer ab (Festland: etwa zwei von drei, sonst selten), nimmt `newGame` die
   nächste passende (höchstens 11 weiter gemessen, Grenze 200) – Nachbarnummern ergeben dort oft dieselbe Karte. Nicht ändern: Die Nummern
   bestehender Karten und Beispiele blieben sonst nicht gültig.
3. Im eingebauten Browser testen; Spielfunktionen lassen sich per JavaScript direkt aufrufen
   (`S`, `newGame`, `startNew`, `doMove`, `endHumanTurn`, `skipAnim` …).
4. KI-gegen-KI-Simulation (im Browser ausführen):

```js
function simGame(size, dk, world = 'inseln', maxT = 350, nAi = 1) {
  newGame(size, dk, world, null, nAi);   // world: inseln | gemischt | kontinente
  for (let k = 0; k < maxT && !S.over; k++) {
    for (const c of S.cities) if (c.owner === 0 && c.progress === 0) aiChooseProduction(c);
    aiTurn(0); endTurn(0); if (S.over) break;
    if (nextRound()) checkGameOver();   // Gegner ziehen, neue Runde – derselbe Ablauf wie im Spiel
  }
  const a = strength(0).total, b = strength(strongestEnemy()).total;
  return { over: S.over, turn: S.turn, share: Math.round(a / (a + b) * 100) };
}
```

Schneller und ohne Browser: `data.js`, `map.js`, `game.js`, `ai.js` mit Node per `vm.runInThisContext`
laden (`globalThis.localStorage` als Attrappe), dann dieselbe `simGame`-Schleife (ca. 1 s je Partie;
im ausgeblendeten Browser-Fenster werden Zeitgeber gedrosselt, lange Läufe brechen dort ab).

### Stand der Einmessung

Kleine Karte, „Siege“ des einfachen KI-Spielers auf Platz 0, je 96 Partien über die drei alten Welten (Inselreich, Gemischt, Festland).
**Neuester Stand (nach 1.8.6, Transporter: Truppen handeln nach der Fahrt, Zuflucht ab Schwer – siehe „KI messen“), in Prozent:** Leicht 100,
Normal 61 (192 Partien), Schwer 11, Brutal 1; offen 0 / 2 / 1 / 0. Unmittelbar davor im selben Lauf: Leicht 100, Normal 62 (288), Schwer 17, Brutal 3.
Die Tabelle darunter ist der Stand seit dem sicheren Anfang.
Stand **seit dem sicheren Anfang (1.8.1)**; davor: Leicht 96, Normal 56, Schwer 24, Brutal 5 (offen 0 / 3 / 4 / 1) – Schwer und Brutal sind also
etwas härter geworden, weil die KI dort die Karte kennt und den schnelleren Start besser nutzt. Die älteren Messreihen weiter unten und bei den
einzelnen Regeln (meist „alt → neu“) stammen aus der Zeit davor und sind untereinander vergleichbar, aber nicht mit dieser Tabelle.
Die neuen Welten stehen bei ihrer Beschreibung (Binnenmeer, Kontinente). Früher: Mit einem Träger von 3 statt 2 Feldern waren es auf Schwer/Brutal
12 bzw. 2 Siege, der schnelle Träger nützte der KI spürbar:

| Stufe | Siege | unentschieden nach 350 Runden | Bonus des Gegners |
|---|---|---|---|
| Leicht | 96 | 0 | 70 % Bautempo, macht Fehler, du +1 Infanterie |
| Normal | 57 | 7 | keiner, macht gelegentlich Fehler |
| Schwer | 15 | 2 | kennt die Karte, spielt umsichtig |
| Brutal | 1 | 0 | wie Schwer, 115 % Bautempo, zweite Stadt |

Partiedauer bis zur Entscheidung (Normal) ca. 180 Runden auf der kleinen Karte. Ein KI-Zug dauert auf der mittleren Karte ca. 50 ms.

**Mehrere Gegner** (Platz 0 einfach ohne Fehler, je 96 Partien über alle drei Welten, Siege / offen nach 350 Runden; Skript wie `simGame` mit `nAi`):

| Gegner, Karte | Leicht | Normal | Schwer | Brutal |
|---|---|---|---|---|
| 1, mittel (Vergleich) | 100 % / 0 | 56 % / 10 | 15 % / 5 | 1 % / 2 |
| 2, klein | 95 % / 2 | 40 % / 0 | 17 % / 1 | 5 % / 1 |
| 3, mittel | 96 % / 4 | 32 % / 12 | 7 % / 7 | 0 % / 2 |

Die Stufen bleiben in der richtigen Reihenfolge, mehr Gegner sind schwerer (gewollt, nicht nachgestellt; der einfache Vergleichsspieler
nutzt nicht aus, dass sich die Gegner gegenseitig schwächen). Partien mit drei Gegnern dauern auf Normal ca. 240 Runden.
**Offene Partien auf der mittleren Karte:** schon mit einem Gegner 10 von 96 (klein: 0–3), fast alle auf dem **Festland** – dort allein
16–33 von 96 (je nach Stichprobe). Ein Teil läuft nach 350 Runden nur noch (Partien dauern dort Ø 230–250 Runden), ein Teil ist festgefahren:
Außerhalb von Städten steht je Feld nur eine Einheit (`aiLand` betritt keine besetzten Felder), die überlegene Seite hat Hunderte Bodentruppen im
Stau und in den eigenen Städten (z. B. 352 von 447, im Extrem 974), und die Städte bauen weiter Bodentruppen. Im untersuchten Spielstand staute
sich alles vor einer ein Feld breiten Landbrücke zwischen Meer und Binnenmeer – einer Abkürzung, das Land hing im Süden breit zusammen
(Testspielstände `archipel-test-stall-*.json`, Engstelle in 164 bei x 29–33, y 2). Gemildert durch die **Landung im Hinterland** (siehe „KI messen“).
Versuch, verworfen: Seen mit mindestens 3 Feldern Abstand zum Meer und zueinander (schmale Landstreifen je Karte halbiert, Wasseranteil mittel
37 → 35 %, etwas mehr Brücken) – offene Partien nicht weniger (mittel 16 → 20 und 22 → 24 von 96, drei Gegner 15 → 17 von 64, klein Normal
1 → 5). Die Engstelle war ein Einzelfall, nicht die Ursache; die Festland-Karten blieben deshalb, wie sie sind (gleiche Kartennummer, gleiche Karte).
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
Kontinente (innerer Name `erdteile` – `kontinente` ist das Festland; `kont: true`, nutzt den Weg der Landmassen von „Gemischt“; Wunsch des Nutzers):
je Spieler ein eigener Kontinent an festem Platz (`SPOTS` in map.js: zwei links und rechts, hochkant; drei im Dreieck; vier in den Ecken), dazwischen
Meer mit kleinen Inseln. Die Karte hängt deshalb von der Zahl der Gegner ab. Nie zwei Spieler auf demselben Kontinent (sonst nächste Nummer).
`massShare` 0,45 = Anteil der Kontinente am Land: Mit 0,6 (Kontinente mit über 20 Städten auf der mittleren Karte) blieben 9 von 32 Partien offen und
es standen bis zu 903 Einheiten – beide rüsten endlos, keiner bekommt genug übers Meer; mit 0,45 offen 2 von 24, mit 0,32 ebenfalls 2 von 24 (dann aber
kaum noch Kontinente). Städte je Startkontinent (2 Spieler): klein 12, mittel 16, groß 27; daneben 4 / 11 / 17 Inseln mit Stadt. Messung mit 0,45
(Platz 0 einfach, klein, je 40): Leicht 100 %, Normal 38 %, Schwer 20 %, Brutal 0 %, offen 2 von 160; Normal Ø 210 Runden, ca. 80 Transporter und
60 Kriegsschiffe je Partie – die transportlastigste Welt. Mittel, Normal (24): 46 %, offen 2, Ø 247 Runden. Groß und mehrere Gegner mit 0,45 nicht gemessen
(mit 0,6: mittel, drei Gegner 13 % Siege, 6 von 24 offen).
Form der Kontinente (Wunsch des Nutzers: weniger kompakt): Jeder besteht aus vier sich überlappenden Teilen mit gemeinsamer Kennung `g` (damit
`split` sie nicht zerschneidet), dazu 1,4-faches Küstenrauschen – Buchten, Halbinseln, Einschnitte, mehr Häfen und Landeplätze. Das half vor allem den
großen Kontinenten: mittel, Normal, `massShare` 0,6 offen 9 von 32 (rund) → 3 von 24 (zerklüftet), meiste Einheiten 903 → 346. Mit 0,45 zerklüftet:
mittel 58 %, offen 3 von 24; klein Normal 59 %, Schwer 19 %, offen 1 von 64 (mit 0,6: 53 % / 19 %, offen 5 von 64). Es bleibt bei 0,45. Die Zahlen im
Absatz davor (38 % auf Normal usw.) stammen noch von den runden Kontinenten. Die Startkontinente sind etwas ungleicher (Ø Unterschied 2,6 Städte).
Binnenmeer (`binnenmeer`, `binnen: true`, `ring`, `islArea`; Wunsch des Nutzers, als Versuch eingebaut): Landring bis an den Kartenrand, in der Mitte
ein Meer (abgerundetes Rechteck, unregelmäßiges Ufer) mit kleinen Inseln – eine je `islArea` Felder Meer (klein Ø 2,4 / mittel 4,9 / groß 10,9 Inseln,
zusammen 4 / 9 / 21 Städte). Land ca. 60 %, Städte 35 / 61 / 121, davon 24 / 36 / 61 Häfen. Anders als in allen anderen Welten ist der Kartenrand hier Land (ein Feld Wasser
außen herum wäre ein Graben ohne Verbindung zum Meer – dem Nutzer aufgefallen); keine Stadt direkt auf dem Rand. Der Generator lehnt keine Nummer ab (0 von 120). Zweig steht in `generateMap` beim Festland
(gemeinsame Höhenberechnung), ohne dessen Seen, Flüsse und Zusammenhangsprüfung; die Zufallsfolge des Festlands ist unverändert. Die KI landet auch
hier im Hinterland (`hinterInfo`). Messung (Platz 0 einfach, klein, je 48 Partien, Binnenmeer / Festland): Leicht 100 / 100 %, Normal 65 / 65 %,
Schwer 8 / 10 %, Brutal 0 / 0 %; offen 2 / 6 von 192; Kriegsschiffe je Partie auf Normal 54 / 27, meiste Einheiten 158 / 235. Mittel, Normal (je 32):
72 / 66 %, offen 3 / 6, Kriegsschiffe 139 / 57, meiste Einheiten 342 / 845 – mehr Seekrieg, weniger Stau an Land.
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
- **Landung im Hinterland** (Wunsch des Nutzers, nur Festland; ai.js `hinterInfo`, `landingOk`, `waitingLand`, `pickSpot`, `boardAdjacent`,
  Schalter `AI_AMPHIB` je Platz). Vorher baute die KI auf dem Festland praktisch keine Transporter (0,3 je Partie): Sie lädt nur auf Kontinenten
  ohne Ziele. Jetzt gilt: Übermacht auf dem Kontinent (Bodentruppen ≥ 3 je bekannter Zielstadt + 4) und eine fremde Stadt, die über Land
  ≥ `HINTER` (6) Felder von den eigenen Truppen entfernt und vom Meer (≤ 2 Felder) erreichbar ist → Häfen bauen Transporter (höchstens
  1 + 1 je 6 Städte), Transporter laden in Häfen mit mindestens zwei Wartenden oder holen Truppen an der Küste ab (`u.pickAt` bleibt, solange dort
  eigene Truppen stehen, sonst pendelten sie; Truppen mit Abstand ≥ 3 zum Ziel steigen zu), setzen nur nahe einer Hinterland-Stadt ab und landen
  alles, bevor sie wieder abholen (`u.inv`). Wege planen sie dabei ohne eigene Einheiten (`makePassable(…, true)`; steht eine im Weg, warten sie,
  nach zwei Runden außen herum, `u.blk`) – vorher wechselten sie in schmalen Wasserstraßen jede Runde den Umweg. Messung Festland, mittel,
  ein Gegner, Normal (drei Stichproben je 96, offen ohne → mit): 33 → 25, 26 → 20, 17 → 19, zusammen 76 → 64 von 288; ca. 11 Transporter je Partie.
  Direkter Vergleich (beide ohne Fehler, 192 Partien): Variante gewinnt 76, Basis 83 – neutral. Kleine Karte (alle Welten, je 96, ohne → mit):
  Leicht 100/100 %, Normal 60/63 %, Schwer 17/17 %, Brutal 1/2 %. Auf Inselreich und Gemischt gab es damit einige offene Partien mehr
  (zusammen ca. +8) – deshalb nur Festland. Verworfen (Festland, offen von 96): Binnenstädte bauen im Stau nichts (38 statt 20), Jäger statt
  Bodentruppen (36 statt 20, Idee des Nutzers), Jäger greifen die Front gezielt an, auch bei 50 % (34 statt 19). Grund: Im Stau sind die eigenen
  Städte ringsum von eigenen Truppen umstellt – außerhalb von Städten darf nie mehr als eine Einheit auf einem Feld stehen, die Jäger kommen nicht
  zum Tanken hinein und stürzen ab (z. B. 65 in 60 Runden). Weniger Bodentruppen schaden: Die Masse bricht irgendwann doch durch.
- **Artillerie** (Idee des Nutzers für den Landkrieg auf dem Festland, wieder entfernt): Bauzeit 10, 1 Feld, Stärke 1, greift nicht an, erobert
  nicht; Feuerunterstützung wie das Schlachtschiff (Bodentruppen treffen zu 2/3, Stadt fällt zu 75 %), aber kein Feuerschutz. KI baute eine je
  5 Bodentruppen gegen Städte eines Gegners. Messung Festland, mittel, Normal (je 192 Partien, offen ohne → mit; direkter Vergleich ohne Fehler,
  Siege ohne : mit): Reichweite 1 (neben der Stadt) 50 → 49, 77 : 69 – sie wurde an der Front sofort abgeschossen (106 gebaut, 42 übrig);
  Reichweite 2 (aus der zweiten Reihe) 44 → 45, 72 : 75 – sie überlebte (125 von 154), steckte aber im selben Stau wie die Infanterie. Kein
  Nutzen, das Spiel wird nur komplizierter; auf den Inselkarten übernimmt das Schlachtschiff diese Rolle. Nicht wieder versuchen.
- Flucht vom bedrohten Feld (`aiWarship`: kein gefahrloser Weg → notfalls durch bedrohte Felder aus der Reichweite; lauernde U-Boote bleiben
  nur unbedroht liegen). Vorher blieb z. B. ein U-Boot neben einem Zerstörer stehen. Messung (Können 1, je ~400 Partien): Siegquote 49 %,
  offen 9 → 10 von 408, Partien 5 Runden länger – neutral, deshalb festgeschrieben.
- Beschuss von Land nur noch durch Kreuzer und Schlachtschiff (je 192 Partien, alt → neu): Leicht 100 → 98 %, Normal 57 → 55 %,
  Schwer 21 → 22 %, Brutal 5 → 6 %, offen 9 → 9. Partien dauern 5–10 Runden länger. Die Stufen bleiben also gültig.
- Küstenangriff (je 192 Partien, ohne → dreifacher Schaden → dreifach und 2/3 Treffer): Leicht 98/99/100 %, Normal 65/65/70 %,
  Schwer 21/23/24 %, Brutal 5/4/5 %, offen 7/6/2. Gewählt: dreifacher Schaden bei normaler Trefferquote (verschiebt nichts).
- **Transporter** (dem Nutzer aufgefallen; ai.js `cargoAct`, Schalter `AI_CARGO` / `AI_REFUGE` je Platz). Fehler: Die Truppen an Bord stiegen nur aus,
  solange der Transporter selbst noch Züge hatte – erreichte er die Küste mit dem letzten Zug, blieben sie an Bord und er lag eine Runde wehrlos
  neben dem Gegner. Jetzt handeln sie auch danach (`AI_CARGO`, alle Stufen): erst ein Gegner am Ufer (Landfeld außerhalb einer Stadt, `aiAdjTarget`
  ≥ 45 %, wie der Sturm vom Schiff des Spielers), sonst an Land wie bisher. Dazu **Zuflucht** (Idee des Nutzers, `AI_REFUGE`, nur Können ≥ 1): Endete
  der Zug auf einem Feld der `threatMap` und liegt ein unbedrohter eigener Hafen in Reichweite dieses Zugs, fährt er hinein (im Hafen bleibt er);
  nicht, wenn er in diesem Zug seinen Landeplatz erreicht. Messung direkter Vergleich (Normal ohne Fehler, beide Sitze, je 400 Partien über alle
  fünf Welten, Siege der Variante unter den entschiedenen): nur Truppen 53 % (offen 11), Truppen + Zuflucht 59 % (offen 12; Inselreich/Gemischt je
  70 %, Kontinente 59 %, Festland 45 %, Binnenmeer 47 %; verlorene Transporter je Partie 17,6 statt 19,8). Stufen (Platz 0 einfach, alt → beides):
  Leicht 100 → 100 %, Normal 62 → 52 %, Schwer 17 → 11 %, Brutal 3 → 1 %; nur Truppen auf Normal 61 %. Entscheidung des Nutzers: Zuflucht nur
  ab Schwer, Normal bleibt so bei etwa 61 % (Tabelle oben). Test: `tools/test.js`, „KI: Transporter …“.

## Bekannte Eigenheiten

- **Erklärvideos** (`docs/videos/*.mp4`, im README verlinkt, nicht im Release): `tools/video/` – `recv.js` (Empfänger, ruft ffmpeg;
  lauscht nur auf 127.0.0.1, nimmt nur Anfragen von `http://localhost:8765` an, Videonamen nur `[a-z0-9-]`, Pfade über `inside()` –
  so verlangt es das Code Scanning (CodeQL „Uncontrolled data used in path expression“), und keine fremde Webseite kann ihm Aufträge schicken),
  `rec.js` (Aufnahme im Browser: eigene Uhr, Textleiste DE/EN, `caption(de, en, { big: true })` = Titeltafel mit Schriftzug,
  `speed(ms)` = Zugtempo, Ton offline), `scenes.js` (zehn Szenen: landung, feuerschutz, uboot, kueste, luftdeckung, nachschub, jaeger, eroberung, steg, nebel; je Video eine Szene, sucht sich die Stelle
  auf einer erzeugten Karte; Prozentwerte aus den Regeln). Neu erzeugen nach Regeländerungen: `node tools/video/recv.js` starten,
  im Browser Ansicht 1280×800, `rec.js` und `scenes.js` per fetch + eval laden, `await Scenes.all()`, danach Seite neu laden.
  Ausnahmen „keine Asset-Dateien“ gelten auch für `docs/videos/`. Videoseite `docs/videos/index.html` (online unter
  …/archipel/docs/videos/, eigenständig, Sprache über `archipel-lang`): Titel, Länge und Texte stehen dort von Hand – nach dem
  Neuaufnehmen mit anpassen; sie liest `?lang=de|en`. Im Spiel verlinkt über `a[data-videos]` (Menü „Hilfe“, Handbuch „Erste Schritte“,
  Willkommensfenster), `VIDEO_URL` in ui.js setzt Adresse, Sprache und neuen Reiter – immer mit Kästchen `.ext` „online ↗“, auch in der
  Offline-Fassung (die Seite liegt nur im Internet). `sw.js` fängt `docs/` und `tools/` nicht ab (sonst landeten 8 MB Videos im Zwischenspeicher der App).
- **Teaser `docs/videos/seeschlacht.mp4`** (Szene `seeschlacht`, kurze Werbetexte statt Erklärungen; Videoseite oben) und daraus das
  README-GIF: `ffmpeg -i docs/videos/seeschlacht.mp4 -vf "fps=10,scale=680:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 docs/seeschlacht.gif`.
  Prinzip der Aufnahme (in `tools/video/rec.js` umgesetzt): ohne Bildschirmaufnahme, Bild für Bild, `performance.now` durch eine eigene Uhr ersetzen, `requestAnimationFrame` und `setTimeout` auf
  diese Uhr umlenken, je Bild Uhr +33,3 ms, `loop(t)` aufrufen, sichtbaren Kartenausschnitt (`wrap.scroll*`) aus `cv` kopieren
  und per POST an einen kleinen Node-Empfänger schicken (ffmpeg liegt unter WinGet). Kampfausgänge: vor dem Abspielen prüfen,
  sonst `deserialize` und wiederholen (`rng` ist fest `Math.random`). Ton: `Sfx.play`/`Sfx.move` mit Zeitpunkt protokollieren,
  danach `sfx.js` mit einem `OfflineAudioContext` neu laden (per Textersetzung) und die Klänge mit `suspend(t)` taktgenau
  abspielen, als WAV ausgeben. ffmpeg: H.264/AAC; GIF mit `palettegen` (10 Bilder/s, 680 px, ca. 3,2 MB für 49 s – Titeltafeln mit Abblendung kosten viel).
- Im Browser-Bereich können mehrere Reiter offen sein. Bei JavaScript-Aufrufen immer die Reiter-Kennung des Spiels angeben
  und nie `location.href` zurückgeben (ein Reiter kann eine riesige `data:`-Adresse haben).
- Testspielstände (`archipel-test-*.json` im Projektordner, nicht im Repo) erzeugt ein Node-Skript: Partie simulieren, Einheiten
  setzen, `serialize()` in eine Datei schreiben; geladen wird über „Spielstände → Aus Datei laden…“.
- Lange Ersetzungen lieber als Node-Skript im Scratchpad ausführen statt per `sed`/Heredoc oder `node -e`
  mit Backticks (Git Bash führt den Inhalt als Befehl aus).
- `localStorage`: Autosave `archipel-save-v1` (nach jeder Änderung: `queueSave` in `refresh()`, 300 ms gebündelt, dazu `pagehide`; < 1 ms je Speichern), Spielstände `archipel-slot-*` mit Index
  `archipel-slots`, Einstellungen `archipel-*` (Ton, Zoom, Schwierigkeit, Rundenende, Sprache, Handbuch-Reiter, Rad/Touchpad, `archipel-welcome` = Willkommensfenster gesehen …).
  **Zurücksetzen** (Einstellungen, `askReset`/`resetAll`/`resetKeys` in ui-schau.js; Wunsch des Nutzers für geteilte Rechner): löscht nach Rückfrage
  alle Schlüssel `archipel-…` und lädt neu – wie beim ersten Besuch. Benannte Spielstände nur mit dem Haken in der Rückfrage. Neue Schlüssel
  deshalb immer mit `archipel-` beginnen. `resetting` verhindert, dass `pagehide` die Partie beim Neuladen wieder speichert.
