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
  Commit-Nachrichten auf Deutsch, kurz, mit Co-Authored-By-Zeile.

## Grundsätze der Technik

- **Keine Abhängigkeiten, kein Build.** Reines HTML/CSS/JavaScript, klassische `<script>`-Tags
  (keine ES-Module), damit `index.html` auch per Doppelklick (`file://`) läuft.
- **Keine Asset-Dateien.** Grafik (`gfx.js`) und Klänge (`sfx.js`) werden im Code erzeugt.
  Einzige Ausnahmen: `favicon.svg`, `docs/screenshot.png` (README).
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
| `js/data.js` | Einheitentypen `UT`, `UNIT_ORDER`, `DIRS`, Spielerfarben, `MAP_SIZES`, Schwierigkeitsgrade `DIFFICULTY` + `diff()`, `aiKnowsMap(p)`, `aiMistake(p)` |
| `js/map.js` | Kartengenerator: Weltarten `WORLDS` (data.js) – Inselwelten aus geplanten Inseln + Rauschen, Kontinente aus Value-Noise; Städte, faire Startpositionen |
| `js/game.js` | Regeln: Bewegung `moveStep`, Kampf `combatSpec`/`attackOdds`/`winProb`, Eroberung, Produktion, Sicht `computeVision`, Wegsuche `bfs`/`findPath`/`explorePath`, Befehle `runGoto`/`runPatrol`/`runExplore`, Kräfteverhältnis `strength`, Speichern/Laden inkl. `sanitizeState` |
| `js/ai.js` | Computergegner: taktische Regeln je Einheit, Produktion inkl. Konter (`counterPick`), Erkundung, Bedrohungskarte (`threatMap`); Können `aiSkill(p)` (0 einfach, 1 umsichtig: Zielverteilung `spreadField`, Lagebild `buildPlan`, Jäger-Jagd, vorsichtige Transporter) |
| `js/gfx.js` | Gelände-Rendering, Einheiten-Abzeichen (SVG-Pfade → Sprites), Stadtgrafik |
| `js/sfx.js` | Web-Audio-Synthese: Effekte, Klangteppiche je Einheitentyp, Klangtest |
| `js/ui.js` | Zeichnen, Animationen/Zeitleiste, Kamera, Eingabe, Seitenleiste, alle Dialoge |
| `index.html` | Layout, CSS, Dialoge (Hilfe, Statistik, Spielstände, Klangtest …) |
| `tools/serve.js` | Mini-Webserver für die Entwicklung |

## Wichtige Zusammenhänge (beim Ändern beachten)

- **Kampf**: Alle Kampfwerte kommen aus `combatSpec(a, d, x, y)` (Stärken, Trefferchance `p`,
  Erstschlag, Hinweistexte). Kampfablauf, angezeigte Siegchance und KI-Bewertung nutzen
  diese eine Funktion – neue Boni nur dort eintragen und die Tabelle in der Hilfe (`index.html`)
  sowie Testwerte nachziehen.
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

Letzte Einmessung (kleine Karte, „Siege“ des einfachen KI-Spielers auf Platz 0, je 32 Partien; nach „umsichtiger KI“ auf Schwer/Brutal):
Inselreich Leicht 32/32 · Normal 16/32 · Schwer 5/32 · Brutal 0/32 · Gemischt 32 · 19 · 9 · 0 · Kontinente 32 · 16 · 9 · 0.
Schwer über alle Welten 54/240 (23 %), ohne Bau-Bonus; Brutal mit 125 % Bautempo und zweiter Stadt 0/160. Partiedauer (Normal) ca. 220 Runden.
Nach den getarnten U-Booten (KI baut ein U-Boot je fünf Städte, Geleitschutz ab Können 1, Brutal 115 % Bautempo):
Leicht 95/96 · Normal 56/96 · Schwer 27/192 (14 %, damit etwas schwerer als zuvor mit 23 %) · Brutal 2/96.
Auf Schwer wirken die U-Boote, weil der Gegner die Karte kennt und sofort vor den richtigen Häfen lauert; ohne Kartenwissen
gewänne der Vergleichsspieler 31 % (Kontinente 50 %, Inselreich 10 %) – zu ungleich je Welt, deshalb nicht übernommen.
Nach Einführung der Schlachtschiff-Regeln (Feuerunterstützung, Luftangriff), je 96 Partien über alle Welten: Leicht 95 · Normal 62 · Schwer 20 · Brutal 0.
Verzicht auf Schlachtschiffe kostet KI gegen KI jetzt ca. 5 Punkte (vorher nichts); die KI baut sie selten und spät.

**KI-Können messen:** `AI_SKILL[platz] = 0|1` erzwingt das Können je Platz. Für einen fairen Vergleich beide Plätze ohne Fehler
(`DIFFICULTY.normal.aiMistake = 0`) und je Variante beide Sitzordnungen spielen, mindestens 400 Partien (bei 200 Partien liegt das
Rauschen bei ±3,5 Punkten; „Variante = Basis“ ergab im Test schon einmal 54 %). Ergebnisse der Messreihe (ca. 10 000 Partien):
- Umsichtige KI (Können 1) gegen einfache: 57 % Siege.
- Wirksam: Infanterie statt Panzer als Eroberer (+10 Punkte). Im Rauschen, aber unschädlich: Zielverteilung, Jagd auf
  Eindringlinge, Jäger-Jagd, vorsichtige Transporter.
- **Schädlich: Besatzungen** (Frontstädte 42 %, Hinterland 45 %, jede Stadt von Beginn an < 30 %). Grund: Eine Infanterie
  im Angriff erobert mit 50 % eine Stadt, in der Verteidigung senkt sie die Eroberungschance je Angreifer nur von 50 auf ca. 37 %.
  Solange die Regeln so sind, lohnt Verteidigung nicht – erst mit einem Verteidigungsbonus würde sich das ändern.
- Ebenfalls schlechter: keine frühen Kreuzer (34 %), mehr Transporter (42 %), Landung direkt vor der Stadt (47 %), andere Truppgrößen.
- Auf Schwer im Inselreich baut der Gegner (kennt die Karte, fast nur Küstenstädte) praktisch keine Jäger.
Inselstatistik je Weltart: `node mapstat.js <repo> <anzahl> <welt>` (Skript im Scratchpad, ggf. neu schreiben) –
größte Insel ≈ 30–40 % des Landes (Inselreich), ≈ 50–60 % (Gemischt), ≈ 75–85 % (Kontinente).
Ein KI-Zug dauert auf der mittleren Karte ca. 50 ms.

## Bekannte Eigenheiten

- Das Screenshot-Werkzeug des eingebauten Browsers liefert höchstens 800 px Breite.
- Lange Ersetzungen lieber als Node-Skript im Scratchpad ausführen statt per `sed`/Heredoc
  mit Backticks (Quoting-Probleme unter Git Bash).
- `localStorage`: Autosave `archipel-save-v1`, Spielstände `archipel-slot-*` mit Index
  `archipel-slots`, Einstellungen `archipel-*` (Ton, Zoom, Schwierigkeit, Rundenende, Sprache …).
