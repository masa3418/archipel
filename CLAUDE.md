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
| `js/map.js` | Kartengenerator (Value-Noise, Kontinente, Städte, Startpositionen) |
| `js/game.js` | Regeln: Bewegung `moveStep`, Kampf `combatSpec`/`attackOdds`/`winProb`, Eroberung, Produktion, Sicht `computeVision`, Wegsuche `bfs`/`findPath`/`explorePath`, Befehle `runGoto`/`runPatrol`/`runExplore`, Kräfteverhältnis `strength`, Speichern/Laden inkl. `sanitizeState` |
| `js/ai.js` | Computergegner: taktische Regeln je Einheit, Produktion inkl. Konter (`counterPick`), Erkundung, Bedrohungskarte (`threatMap`) |
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
function simGame(size, dk, maxT = 350) {
  newGame(size, dk);
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

Letzte Einmessung (kleine Karte, „Siege“ des KI-Spielers auf Platz 0, nach „Eroberer geht in der Stadt auf“):
Leicht 14/16 · Normal 17/32 · Schwer 8/32 · Brutal 0/16. Partiedauer bis zur Entscheidung (Normal) ca. 224 Runden.
Ein KI-Zug dauert auf der mittleren Karte ca. 50 ms.

## Bekannte Eigenheiten

- Das Screenshot-Werkzeug des eingebauten Browsers liefert höchstens 800 px Breite.
- Lange Ersetzungen lieber als Node-Skript im Scratchpad ausführen statt per `sed`/Heredoc
  mit Backticks (Quoting-Probleme unter Git Bash).
- `localStorage`: Autosave `archipel-save-v1`, Spielstände `archipel-slot-*` mit Index
  `archipel-slots`, Einstellungen `archipel-*` (Ton, Zoom, Schwierigkeit, Rundenende, Sprache …).
