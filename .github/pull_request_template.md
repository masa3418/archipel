## Was ändert sich?

<!-- Kurz beschreiben, was dieser Pull Request macht. -->

## Warum?

<!-- Welches Problem löst er, oder was wird besser? -->

Behebt #<!-- Issue-Nummer, falls vorhanden -->

## Art der Änderung

- [ ] Fehlerbehebung
- [ ] Neue Funktion
- [ ] Balancing (Einheiten, Schwierigkeit, Computergegner)
- [ ] Grafik / Klänge / Bedienung
- [ ] Dokumentation
- [ ] Sonstiges

## Screenshots

<!-- Bei sichtbaren Änderungen bitte vorher/nachher einfügen. -->

## Geprüft

- [ ] Syntax geprüft: `for f in js/*.js; do node --check "$f"; done`
- [ ] Im Browser ausprobiert (auch per Doppelklick auf `index.html`)
- [ ] Speichern und Laden funktioniert weiterhin
- [ ] Bei Regel-/KI-/Balancing-Änderungen: KI-gegen-KI-Partien simuliert, Ergebnis:
      <!-- z. B. Normal 9/16 Siege auf Spielerplatz -->

## Grundsätze eingehalten

- [ ] Keine neuen Abhängigkeiten, kein Build-Schritt, keine Bild- oder Audiodateien
- [ ] Texte in der Oberfläche auf Deutsch
- [ ] Neue Felder im Spielzustand in `sanitizeState` aufgenommen, Ausgaben mit `esc()` maskiert
- [ ] Hilfe (`index.html`) angepasst, falls sich Regeln oder Bedienung ändern

Siehe auch [CONTRIBUTING.md](../CONTRIBUTING.md).
