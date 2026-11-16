## Was ändert sich? / What changes?

<!-- Kurz beschreiben, was dieser Pull Request macht. / Briefly describe what this pull request does. -->

## Warum? / Why?

<!-- Welches Problem löst er, oder was wird besser? / What problem does it solve, or what gets better? -->

Behebt / Fixes #<!-- Issue-Nummer, falls vorhanden / issue number, if any -->

## Art der Änderung / Type of change

- [ ] Fehlerbehebung / Bug fix
- [ ] Neue Funktion / New feature
- [ ] Balancing (Einheiten, Schwierigkeit, Computergegner / units, difficulty, computer opponent)
- [ ] Grafik / Klänge / Bedienung – Graphics / sound / controls
- [ ] Übersetzung / Translation
- [ ] Dokumentation / Documentation
- [ ] Sonstiges / Other

## Screenshots

<!-- Bei sichtbaren Änderungen bitte vorher/nachher einfügen. / For visible changes, please add before/after. -->

## Geprüft / Checked

- [ ] Syntax geprüft / Syntax checked: `for f in js/*.js; do node --check "$f"; done`
- [ ] Im Browser ausprobiert, auch per Doppelklick auf `index.html` / Tried in the browser, also by double-clicking `index.html`
- [ ] In beiden Sprachen angesehen (Knopf DE/EN) / Viewed in both languages (DE/EN button)
- [ ] Speichern und Laden funktioniert weiterhin / Saving and loading still work
- [ ] Bei Regel-/KI-/Balancing-Änderungen: KI-gegen-KI-Partien simuliert, Ergebnis / For rule, AI or balance changes: simulated AI-vs-AI games, result:
      <!-- z. B. / e.g. Normal 9/16 Siege auf Spielerplatz / wins in player slot -->

## Grundsätze eingehalten / Principles followed

- [ ] Keine neuen Abhängigkeiten, kein Build-Schritt, keine Bild- oder Audiodateien / No new dependencies, no build step, no image or audio files
- [ ] Neue Texte in beiden Sprachen: `tt('deutsch', 'english')` im Code, `data-en` bzw. `data-lang` in `index.html` / New texts in both languages
- [ ] Neue Felder im Spielzustand in `sanitizeState` aufgenommen, Ausgaben mit `esc()` maskiert / New state fields added to `sanitizeState`, output escaped with `esc()`
- [ ] Hilfe (`index.html`) in beiden Sprachen angepasst, falls sich Regeln oder Bedienung ändern / Help updated in both languages if rules or controls change

Siehe auch / See also [CONTRIBUTING.md](../CONTRIBUTING.md).
