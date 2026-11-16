# Mitmachen bei Archipel

Schön, dass du helfen möchtest! Archipel ist ein kleines Hobbyprojekt – jede Rückmeldung
zählt, auch ohne eine einzige Zeile Code.

Bitte beachte dabei unseren [Verhaltenskodex](CODE_OF_CONDUCT.md).

## Ohne Programmieren helfen

Am meisten helfen Erfahrungen aus echten Partien. Unter
[Issues → New issue](https://github.com/masa3418/archipel/issues/new/choose) gibt es dafür
Vorlagen:

- **Fehler melden** – etwas funktioniert nicht wie erwartet. Ein Spielstand kurz vor dem
  Fehler (**Spielstände → Export**) hilft sehr beim Nachstellen.
- **Idee oder Wunsch** – Vorschläge für neue Funktionen oder Verbesserungen.
- **Balancing-Feedback** – zu leicht, zu schwer, eine Einheit zu stark oder zu schwach?

Bevor du ein neues Issue anlegst, schau kurz, ob es schon ein ähnliches gibt.

**Sicherheitslücken** bitte nicht öffentlich melden, sondern wie in [SECURITY.md](SECURITY.md)
beschrieben.

## Code beitragen

### Loslegen

1. Repository forken und klonen.
2. `index.html` im Browser öffnen – fertig. Es gibt nichts zu installieren und nichts zu bauen.
3. Für die Entwicklung ist ein lokaler Server bequemer (verhindert Browser-Einschränkungen bei
   `file://`):

   ```bash
   node tools/serve.js .
   ```

   Danach http://localhost:8765 öffnen.

Einen Überblick über die Dateien gibt die [README](README.md); ausführlichere technische Hinweise
stehen in [CLAUDE.md](CLAUDE.md).

### Grundsätze

- **Keine Abhängigkeiten, kein Build-Schritt.** Reines HTML, CSS und JavaScript. Keine
  Frameworks, keine npm-Pakete.
- **Muss per Doppelklick laufen.** Deshalb klassische `<script>`-Tags statt ES-Modulen und
  keine Dateien, die per `fetch` nachgeladen werden.
- **Keine Bild- oder Audiodateien.** Grafik und Klänge werden im Code erzeugt
  (`js/gfx.js`, `js/sfx.js`).
- **Deutsch** in der Oberfläche, in Kommentaren und in Commit-Nachrichten.
- **Sicherheit:** Daten aus Spielständen nie ungeprüft per `innerHTML` ausgeben, Texte mit
  `esc()` maskieren. Neue Felder im Spielzustand in `sanitizeState` (`js/game.js`) aufnehmen.
- **Kampfregeln** nur in `combatSpec` (`js/game.js`) ändern – Kampf, Siegchance-Anzeige und
  Computergegner nutzen diese eine Funktion. Die Tabelle in der Hilfe (`index.html`)
  entsprechend anpassen.
- Stil: 2 Leerzeichen Einrückung, Semikolons, einfache Anführungszeichen – wie im
  bestehenden Code.

### Testen

- Syntax prüfen:

  ```bash
  for f in js/*.js; do node --check "$f"; done
  ```

- Die Änderung im Browser ausprobieren, inklusive Speichern und Laden.
- Bei Änderungen an Regeln, Balancing oder Computergegner: einige Partien KI gegen KI
  simulieren und die Ergebnisse im Pull Request nennen. Eine fertige Simulationsfunktion steht
  in [CLAUDE.md](CLAUDE.md#entwickeln-und-testen).

### Pull Requests

- Ein Pull Request pro Thema; lieber klein und übersichtlich.
- Beschreibe kurz, **was** sich ändert und **warum** – bei sichtbaren Änderungen gern mit
  Screenshot.
- Verweise auf das zugehörige Issue (z. B. „Behebt #12“).
- Commit-Nachrichten auf Deutsch, kurze Betreffzeile im Präsens
  (z. B. „Zerstörer erkunden mit voller Sichtweite“).

## Lizenz

Mit deinem Beitrag erklärst du dich einverstanden, dass er unter der
[MIT-Lizenz](LICENSE) des Projekts veröffentlicht wird.

Danke fürs Mitmachen!
