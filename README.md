# Archipel

Rundenbasiertes Eroberungsspiel im Stil der klassischen Strategiespiele der 80er:
eine zufällige Inselwelt im Nebel des Krieges, Städte erobern, Einheiten bauen,
Truppen per Schiff übersetzen – gegen einen Computergegner.

Läuft komplett im Browser, ohne Installation und ohne externe Bibliotheken.
Grafik und Klänge werden im Programm erzeugt, es gibt keine Bild- oder Audiodateien.

*English:* a turn-based island conquest game in the spirit of the classic 80s strategy games – explore,
capture cities, build units and ship your troops across the sea against a computer opponent. The game
is available in English: use the language button in the top bar.

![Archipel: Inselwelt mit Städten, eigenen Einheiten und feindlichen Schiffen vor der Küste; rechts Übersichtskarte, Kräfteverhältnis und Einheiteninfo](docs/screenshot.png)

## Spielen

Direkt im Browser: **https://masa3418.github.io/archipel/**

Oder lokal: `index.html` doppelklicken. Das Spiel speichert nach jeder Runde automatisch im Browser;
über **Spielstände** lassen sich beliebig viele benannte Stände anlegen und als Datei
exportieren. Hilfe und Tastenbelegung: Knopf **Hilfe** oder Taste `H`.

## Inhalt

- Deutsch und Englisch (Sprachknopf oben in der Leiste)
- Zufällige Karten in drei Größen mit Kontinenten, Inseln, Wäldern und Bergen
- Nebel des Krieges, Städte erobern (50 % Chance, der Eroberer geht in der Stadt auf) und Produktion wählen
- Neun Einheiten: Infanterie, Panzer, Jäger (mit Treibstoff), Transporter, Zerstörer,
  U-Boot, Kreuzer, Träger, Schlachtschiff
- Stärken und Schwächen (Torpedo, Sonar, Wasserbomben, Küstenbatterien),
  die angezeigte Siegchance berücksichtigt sie
- Befehle: Marsch, Wache, Patrouille, Erkunden, Ein-/Ausladen
- Computergegner in vier Schwierigkeitsstufen; auf Leicht/Normal muss er die Karte
  wie du erkunden und macht gelegentlich Fehler
- Animationen, Kamerafahrten bei Gegnerzügen, Kräfteverhältnis, Statistik
- Synthetisierte Soundeffekte und Klangteppiche je Einheitentyp, Klangtest-Fenster

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Seite, Stile, Dialoge |
| `js/data.js` | Einheitentypen, Schwierigkeitsgrade (hier lässt sich das Balancing ändern) |
| `js/map.js` | Kartengenerator, Städte, Startpositionen |
| `js/game.js` | Spielregeln: Bewegung, Kampf, Eroberung, Produktion, Sicht, Wegsuche, Speichern |
| `js/ai.js` | Computergegner |
| `js/gfx.js` | Grafik: Gelände, Städte, Einheiten-Symbole |
| `js/sfx.js` | Klänge (Web Audio) |
| `js/ui.js` | Darstellung, Animationen, Bedienung, Seitenleiste, Dialoge |
| `tools/serve.js` | Kleiner lokaler Webserver nur für die Entwicklung (`node tools/serve.js .`) |

## Datenschutz

- **Keine Cookies, kein Tracking, keine Analyse-Dienste.**
- **Keine externen Inhalte:** Das Spiel lädt nichts von anderen Servern – auch keine Schriften
  oder Bibliotheken.
- **Speicherung nur lokal:** Spielstände und Einstellungen liegen im Browser (localStorage) und
  verlassen den Rechner nicht, außer man exportiert selbst eine Datei.
- **Hosting:** Die Online-Version liegt auf GitHub Pages. GitHub verarbeitet dabei technisch
  notwendige Daten wie die IP-Adresse, siehe
  [Datenschutzerklärung von GitHub](https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement).

## Mitmachen

Fehler, Ideen und Balancing-Rückmeldungen sind willkommen – siehe
[CONTRIBUTING.md](CONTRIBUTING.md) und den [Verhaltenskodex](CODE_OF_CONDUCT.md).
Sicherheitslücken bitte vertraulich melden: [SECURITY.md](SECURITY.md).

## Lizenz

MIT – siehe [LICENSE](LICENSE).
