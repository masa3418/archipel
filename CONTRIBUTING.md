# Mitmachen bei Archipel

*[English version below](#contributing-in-english)*

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
- **Zweisprachig:** Das Spiel gibt es auf Deutsch und Englisch. Jeden neuen sichtbaren Text in
  beiden Sprachen anlegen – im Code als `tt('deutsch', 'english')`, in `index.html` mit
  `data-en="…"` bzw. doppelten Absätzen mit `data-lang="de"`/`"en"`. Im Spiel mit dem Knopf
  **DE/EN** beide Fassungen ansehen.
- **Deutsch** in Kommentaren und Commit-Nachrichten.
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

- Die Änderung im Browser ausprobieren, inklusive Speichern und Laden, in beiden Sprachen.
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

---

## Contributing in English

Thanks for wanting to help! Archipel is a small hobby project, and every piece of feedback counts,
even without writing a single line of code. Please follow our [Code of Conduct](CODE_OF_CONDUCT.md#english-summary).

**Without coding:** Use the templates under
[Issues → New issue](https://github.com/masa3418/archipel/issues/new/choose) to report bugs,
suggest ideas or give balance feedback. English is welcome. A saved game from just before a bug
(**Saved games → Export**) helps a lot. Please report security issues privately as described in
[SECURITY.md](SECURITY.md#english).

**Code:** Fork and clone, then open `index.html` in your browser. There is nothing to install or
build. For development, `node tools/serve.js .` serves the game at http://localhost:8765.

Principles:

- **No dependencies, no build step, no image or audio files.** Plain HTML, CSS and JavaScript with
  classic `<script>` tags, so the game runs by double-clicking `index.html`. Graphics and sound are
  generated in code.
- **Two languages:** every visible text needs a German and an English version – `tt('deutsch', 'english')`
  in the code, `data-en="…"` or paired `data-lang="de"`/`"en"` blocks in `index.html`.
- Code comments and commit messages are in German; if that's a hurdle, write in English and the
  maintainer will take care of it.
- **Security:** never output saved-game data via `innerHTML` unchecked, escape texts with `esc()`,
  add new state fields to `sanitizeState` (`js/game.js`).
- **Combat rules** live only in `combatSpec` (`js/game.js`); update the table in the help as well.
- Style: 2-space indentation, semicolons, single quotes.

Before opening a pull request, check syntax with `for f in js/*.js; do node --check "$f"; done`, try the
change in the browser in both languages (including save/load), and for rule or AI changes mention the
results of a few simulated AI-vs-AI games. One topic per pull request, please.

By contributing you agree that your contribution is published under the project's [MIT license](LICENSE).
