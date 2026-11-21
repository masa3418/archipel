# Archipel

Rundenbasiertes Eroberungsspiel im Stil der klassischen Strategiespiele der 80er:
eine zufällige Inselwelt im Nebel des Krieges, Städte erobern, Einheiten bauen,
Truppen per Schiff übersetzen – gegen einen Computergegner oder bis zu drei, jeder gegen jeden.

Läuft komplett im Browser, ohne Installation und ohne externe Bibliotheken – [online](https://masa3418.github.io/archipel/) oder als
[einzelne Datei zum Herunterladen](https://github.com/masa3418/archipel/releases/latest) auch ganz ohne Internet.
Grafik und Klänge werden im Programm erzeugt, es gibt keine Bild- oder Audiodateien.

*English:* a turn-based island conquest game in the spirit of the classic 80s strategy games – explore,
capture cities, build units and ship your troops across the sea against one computer opponent or up to three,
everyone against everyone. The game
is available in English: use the language button in the top bar. Play it
[online](https://masa3418.github.io/archipel/) or download the single-file
[offline copy](https://github.com/masa3418/archipel/releases/latest) and double-click it.

![Archipel: Seeschlacht zwischen Inseln – Zerstörer versenkt ein U-Boot, ein Jäger scheitert an der Luftdeckung, ein U-Boot torpediert den feindlichen Träger, das Schlachtschiff versenkt den Kreuzer](docs/seeschlacht.gif)

*Seeschlacht im Inselreich* ([als Video mit Ton](docs/videos/seeschlacht.mp4)): Deine Flotte (blau) trifft auf einen
feindlichen Verband. Dein Zerstörer ortet das getauchte U-Boot und versenkt es. Ein Jäger von deinem Träger greift
den Kreuzer an – doch der feindliche Träger gibt Luftdeckung, seine Abfangjäger schießen ihn ab. Dann torpediert dein
U-Boot den Träger, und dein Schlachtschiff versenkt den Kreuzer, der jetzt ohne Schutz dasteht.

*The scene:* a sea battle in the archipelago ([video with sound](docs/videos/seeschlacht.mp4)). Your destroyer locates and
sinks a submerged submarine, a fighter is shot down by the enemy carrier's air cover, then your submarine torpedoes
the carrier and your battleship sinks the now unprotected cruiser.

## Spielen

- **Online:** https://masa3418.github.io/archipel/
- **Offline:** Unter [Releases](https://github.com/masa3418/archipel/releases/latest) die Datei `archipel.html`
  herunterladen und doppelklicken. Das ganze Spiel steckt in dieser einen Datei; es wird nichts installiert und
  keine Internetverbindung gebraucht. Wer lieber einzelne Dateien hat, nimmt `archipel-offline.zip`.
- **Aus dem Quelltext:** Repository herunterladen und `index.html` doppelklicken.

Das Spiel speichert nach jeder Runde automatisch im Browser; über **Spielstände** lassen sich beliebig viele
benannte Stände anlegen und als Datei exportieren. Online- und Offline-Fassung haben getrennte Spielstände – per
Export und „Aus Datei laden“ wandern sie von der einen zur anderen. Das **Handbuch** (Knopf **Hilfe** oder Taste `H`)
erklärt in sieben Reitern erste Schritte, Einheiten, Transporter, Kampf, Steuerung und die Gegner.

## Erklärvideos

Kurze Videos mit Ton und Texteinblendungen (Deutsch und Englisch) zu den Regeln, die man am leichtesten übersieht –
am bequemsten anzuschauen auf der **[Videoseite](https://masa3418.github.io/archipel/docs/videos/)**. Sie gehören nicht
zum Spiel und nicht zur Offline-Fassung. *Short videos with sound and captions (German and English) explaining the
trickier rules – best watched on the [video page](https://masa3418.github.io/archipel/docs/videos/).*

| Video | Was es zeigt |
|---|---|
| [Landung mit Schlachtschiff](docs/videos/landung.mp4) | Feuerunterstützung (die Stadt fällt zu 75 % statt 50 %), Sturm vom Schiff, Schiffe im Hafen gehen mit unter |
| [Feuerschutz](docs/videos/feuerschutz.mp4) | Ein Schlachtschiff neben der eigenen Stadt macht sie fast uneinnehmbar |
| [U-Boot und Sonar](docs/videos/uboot.mp4) | Getauchte U-Boote sind unsichtbar, Ortung aus einem Feld, Auftauchen nach dem Angriff, der Zerstörer als Jäger |
| [Küstenangriff](docs/videos/kueste.mp4) | Bodentruppen treffen Schiffe an der Küste dreifach – außer Kreuzer und Schlachtschiff |
| [Luftdeckung](docs/videos/luftdeckung.mp4) | Ein Träger mit Jäger schützt die Schiffe nebenan, selbst Transporter wehren sich |
| [Nachschub halb automatisch](docs/videos/nachschub.mp4) | Marschziel einer Stadt und Transporter, die die Wartenden im Hafen mitnehmen |
| [Jäger: Reichweite](docs/videos/jaeger.mp4) | Treibstoff und Rückweg, Tanken in Stadt oder auf dem Träger, Patrouille mit selbstständigem Tankstopp |
| [Städte erobern](docs/videos/eroberung.mp4) | 50 % je Versuch, der Eroberer geht in der Stadt auf, eine Besatzung muss erst geschlagen werden |
| [Stege, Brücken und Stau](docs/videos/steg.mp4) | Diagonal über Ecken, Brücken auf dem Festland, Kolonnen warten vor einem besetzten Übergang |
| [Nebel und Erkunden](docs/videos/nebel.mp4) | Der Nebel des Krieges, Befehl „Erkunden“, Kartengedächtnis und neutrale Städte |

## Beispiel-Spielstände

Sieben Spielstände zum Ausprobieren und Anschauen – mitten in einer Partie, mit Zeitraffer und Kräftekurve vom ersten Zug an.
In der [Online-Fassung](https://masa3418.github.io/archipel/) lädst du sie direkt im **Handbuch** unter **Über das Spiel → Beispiel-Spielstände**.
Die Offline-Fassung enthält sie nicht: Datei hier anklicken, auf GitHub oben rechts **„Download raw file“** wählen und im Spiel unter
**☰ Menü → Spielstände → Aus Datei laden …** öffnen. *Seven saved games to try out, each with the timelapse from the first turn. In the
online version, load them right from the handbook (About → Example games); for the offline copy, download a file (“Download raw file”
on GitHub) and open it via ☰ Menu → Saved games → Load from file.*

| Spielstand | Lage |
|---|---|
| [Inselreich, Anfang](docs/spielstaende/beispiel-1-inselreich-anfang.json) | Runde 43, mittlere Karte, Normal: die ersten Städte und Transporter, die Inseln noch kaum erkundet |
| [Inselreich, Seekrieg](docs/spielstaende/beispiel-2-inselreich-seekrieg.json) | Runde 108, ausgeglichen (11 : 11 Städte), Flotten und Transporter auf beiden Seiten |
| [Festland, Front](docs/spielstaende/beispiel-3-festland-front.json) | Runde 90, Landkrieg mit Binnenmeeren, Flüssen und Brücken (22 : 17 Städte) |
| [Drei Gegner](docs/spielstaende/beispiel-4-drei-gegner.json) | Runde 90, Gemischt, jeder gegen jeden – Rot, Gelb und Violett sind alle noch im Spiel |
| [Kurz vor dem Sieg](docs/spielstaende/beispiel-5-kurz-vor-dem-sieg.json) | Runde 179, kleine Karte: 27 : 4 Städte, der Gegner hält sich noch auf seinen letzten Inseln |
| [Schwere Lage](docs/spielstaende/beispiel-6-schwere-lage.json) | Runde 60, Stufe Schwer: du bist klar unterlegen (9 : 15 Städte) – schaffst du die Wende? |
| [Sieg gegen drei](docs/spielstaende/beispiel-7-sieg-gegen-drei.json) | Gewonnene Partie (Runde 209): öffnet sofort das Abschlussfenster mit dem Zeitraffer der ganzen Partie |

## Inhalt

- Deutsch und Englisch (Sprachknopf oben in der Leiste)
- Zufällige Karten in drei Größen und drei Weltarten (Inselreich, Gemischt, Festland mit Binnenmeeren und Flüssen) mit Wäldern und Bergen
- Nebel des Krieges, Städte erobern (50 % Chance, der Eroberer geht in der Stadt auf) und Produktion wählen
- Neun Einheiten: Infanterie, Panzer, Jäger (mit Treibstoff), Transporter, Zerstörer,
  U-Boot, Kreuzer, Träger, Schlachtschiff
- Stärken und Schwächen (Torpedo, Sonar, Wasserbomben, Küstenbatterien, Luftangriffe,
  Feuerunterstützung durch Schlachtschiffe, getarnte U-Boote, Luftdeckung durch Träger),
  die angezeigte Siegchance berücksichtigt sie
- Befehle: Marsch, Wache, Patrouille, Erkunden, Heimkehr, Ein-/Ausladen – auch über ein Rechtsklick-Menü
- Computergegner in vier Schwierigkeitsstufen; auf Leicht/Normal muss er die Karte
  wie du erkunden und macht gelegentlich Fehler, auf Schwer/Brutal spielt er umsichtiger
  (Geleitschutz, lauernde U-Boote, Träger); steckt seine Armee auf dem Festland fest, landet er per Transporter in deinem Hinterland
- Bis zu drei Computergegner (Rot, Gelb, Violett), die sich auch untereinander bekämpfen – jeder gegen jeden;
  auf der kleinen Karte höchstens zwei
- Handbuch im Spiel mit Einheitenkarten und einer Tabelle „Wer schlägt wen“, die sich aus den Regeln selbst berechnet
- Animationen, Kamerafahrten bei Gegnerzügen, Kräfteverhältnis, Statistik
- Bedienung mit Maus, Tastatur und Touchpad
- Offline-Fassung als einzelne Datei, siehe [Änderungen je Version](CHANGELOG.md)
- Synthetisierte Soundeffekte und Klangteppiche je Einheitentyp, Klangtest-Fenster

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Seite, Stile, Dialoge |
| `js/data.js` | Sprache, Einheitentypen, Weltarten, Schwierigkeitsgrade (hier lässt sich das Balancing ändern) |
| `js/map.js` | Kartengenerator, Städte, Startpositionen |
| `js/game.js` | Spielregeln: Bewegung, Kampf, Eroberung, Produktion, Sicht, Wegsuche, Speichern |
| `js/ai.js` | Computergegner |
| `js/gfx.js` | Grafik: Gelände, Städte, Einheiten-Symbole |
| `js/sfx.js` | Klänge (Web Audio) |
| `js/ui.js` | Darstellung, Animationen, Bedienung, Seitenleiste, Dialoge, Handbuch |
| `tools/serve.js` | Kleiner lokaler Webserver nur für die Entwicklung (`node tools/serve.js .`) |
| `tools/pack.js` | Verpackt die Offline-Fassung für einen Release (läuft automatisch auf GitHub) |
| `tools/video/` | Nimmt die Erklärvideos im Browser Bild für Bild auf (nur Entwicklung, braucht ffmpeg) |
| `CHANGELOG.md` | Änderungen je Version |

## Datenschutz

- **Keine Cookies, kein Tracking, keine Analyse-Dienste.**
- **Keine externen Inhalte:** Das Spiel lädt nichts von anderen Servern – auch keine Schriften
  oder Bibliotheken. Einzig der Verweis auf die Erklärvideos (als „online ↗“ gekennzeichnet) öffnet auf Klick eine
  Seite auf GitHub Pages in einem neuen Reiter.
- **Speicherung nur lokal:** Spielstände und Einstellungen liegen im Browser (localStorage) und
  verlassen den Rechner nicht, außer man exportiert selbst eine Datei.
- **Hosting:** Die Online-Version liegt auf GitHub Pages. GitHub verarbeitet dabei technisch
  notwendige Daten wie die IP-Adresse, siehe
  [Datenschutzerklärung von GitHub](https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement).

## Vorbilder

Archipel ist aus meiner Begeisterung für die Strategiespiele der 1980er entstanden, die ich auf dem Amiga gespielt habe. Die eigentliche
Vorlage ist **Empire: Wargame of the Century**. Walter Bright schrieb Empire 1977 für einen Großrechner am Caltech; ich habe es erst in der
Fassung kennengelernt, die 1987 bei Interstel für Heimcomputer erschien, gemeinsam mit Mark Baldwin neu gestaltet. Eine Stadt, eine Armee,
ringsum Nebel – und der Sog, noch eine Runde zu spielen: Das wollte ich wiederfinden.

Sehr viel gespielt habe ich auch **Carrier Command** von Realtime Games (1988). Es ist ein ganz anderes Spiel, in Echtzeit und vom
Flugzeugträger aus, und nur in einigen Punkten vergleichbar: eine Inselwelt, die man Insel für Insel einnimmt, und Inseln, die danach für
einen produzieren.

Archipel ist ein eigenes Spiel, kein Nachbau: Regeln, Grafik und Programm sind neu, und es steht in keiner Verbindung zu den Rechteinhabern
der genannten Spiele.

*English:* Archipel grew out of my enthusiasm for the strategy games of the 1980s, which I played on the Amiga – above all
**Empire: Wargame of the Century** (Walter Bright, 1977; published by Interstel in 1987, redesigned with Mark Baldwin), and in a few respects
**Carrier Command** (Realtime Games, 1988). It is a game of its own, not a remake, and not connected with the rights holders of those games.

## Mitmachen

Fehler, Ideen und Balancing-Rückmeldungen sind willkommen – siehe
[CONTRIBUTING.md](CONTRIBUTING.md) und den [Verhaltenskodex](CODE_OF_CONDUCT.md).
Sicherheitslücken bitte vertraulich melden: [SECURITY.md](SECURITY.md).

## Lizenz

MIT – siehe [LICENSE](LICENSE).
