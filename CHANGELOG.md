# Änderungen

Alle veröffentlichten Versionen von Archipel. Die Offline-Fassung jeder Version gibt es unter
[Releases](https://github.com/masa3418/archipel/releases).

## 1.2.3

- **Stege:** Wo sich Land nur an einer Ecke berührt, zeigt die Karte jetzt abgerundete Ecken und einen kleinen Holzsteg.
  So sieht man, was dort schon immer galt: Bodentruppen gehen diagonal hinüber, Schiffe fahren diagonal darunter durch.
- **Schummeln – Nebel des Krieges aus:** Im „☰ Menü“ lässt sich die ganze Karte aufdecken; dann sieht man alle Städte,
  alle Einheiten des Gegners und jeden seiner Züge. Praktisch, um dem Gegner beim Spielen zuzusehen. Das Spiel fragt
  vorher nach, ein Schildchen neben der Rundenzahl zeigt es an, und abgeschaltet kehrt der Nebel zurück. Jede neue
  oder geladene Partie beginnt wieder mit Nebel.
- **Korrigiert:** Der Hinweistext am Kräftebalken und die Frage nach dem vorzeitigen Ende nennen vom Gegner jetzt immer
  nur den Prozentwert, auch wenn im Fenster „Zahlen des Gegners aufdecken“ gesetzt ist

*English:* small footbridges now mark the spots where land only touches at a corner (land units cross, ships pass
underneath – as before, but now visible); a cheat in the menu switches off the fog of war after a confirmation; and the
balance-of-power tooltip always stays spoiler-free.

## 1.2.2

- **Kräfteverhältnis zum Nachrechnen:** Ein Klick auf den Balken öffnet ein Fenster mit der genauen Rechnung – Städte,
  Wert der Einheiten, Stärke und Anteil, dazu die eigenen Einheiten je Typ
- **Spoilerfrei:** Vom Gegner steht dort zunächst nur der Prozentwert. Wer mehr wissen will, setzt den Haken „Zahlen des
  Gegners aufdecken“ und sieht seine Städte und den Gesamtwert seiner Einheiten – nie aber, welche Einheiten es sind.
  Dasselbe gilt jetzt für den Hinweistext des Balkens und die Frage nach dem vorzeitigen Ende.

*English:* click the balance-of-power bar to see the exact calculation. By default the enemy is shown as a percentage
only; a checkbox reveals his cities and the total value of his units, but never which units they are.

## 1.2.1

- **Produktionsansicht:** Direkt unter dem Ansichtsschalter steht jetzt eine Tabelle – je Einheitentyp, wie viele Städte
  ihn bauen, wann die nächste Einheit fertig wird und wie viele du schon hast
- **Korrigiert:** Der Hinweis „Gegner zieht …“ über der Karte stand auch da, während die eigenen Einheiten ihre Märsche
  und Patrouillen ausführten. Jetzt wechselt er dann zu „Deine Einheiten führen ihre Befehle aus …“.

*English:* the production view now has a table right below the view switch (per unit type: cities building it, turns
until the next one, units you own), and the “Enemy is moving …” hint no longer shows while your own units carry out
their orders.

## 1.2.0

- **Aufgeräumte Kopfzeile:** Seltenes liegt jetzt im „☰ Menü“ – Neues Spiel, Spielstände, Statistik und die Einstellungen
  (Lautstärke, Klangtest, Mausrad/Touchpad, automatisches Rundenende). Oben bleiben Zoom, Ton, Handbuch und Sprache.
- **Hinweiszeile über der Karte** statt am unteren Rand; „Gegner zieht …“ erscheint an derselben Stelle
- **Schwierigkeitsstufe** steht neben der Rundenzahl; ein Klick öffnet das Handbuch bei „Gegner & Stufen“,
  die Stufe der laufenden Partie ist dort markiert
- **Produktionsansicht** (Taste V): zeigt statt der Einheiten, was jede eigene Stadt baut und wie lange es noch dauert;
  ein Klick auf eine Stadt ändert die Produktion
- **Wegeansicht** (Taste G): zeigt alle Märsche, Patrouillen und Marschziele auf der Karte, das Spiel läuft dabei normal weiter
- **Marschziel je Stadt:** Einheiten, die dort fertig werden, marschieren sofort zum gewählten Feld. Gesetzt wird es in
  der Stadtkarte oder per Rechtsklick auf die Stadt; beim Umstellen der Produktion wird es gelöscht.
- **Statistik:** neuer Abschnitt „Zerstörte Einheiten“ – je Einheitentyp, was du zerstört hast, was der Gegner zerstört
  hat und was sonst verloren ging. Ältere Spielstände zählen ab dem Laden.
- **Neue Einstellungen:** Das Kräfteverhältnis lässt sich ausblenden, und die Schwelle, ab der das Spiel das vorzeitige
  Ende anbietet, ist wählbar (nie, 5 bis 30 %)

*English:* a tidier top bar with a menu for rarely used things and settings, the hint line now above the map, the
difficulty level next to the turn number, a production view (V) and a route view (G), rally points for cities,
destroyed units per type in the statistics, and two new settings (hide the balance of power, choose when the game
offers an early end).

## 1.1.0

- Das Handbuch und die Sprachwahl sind leichter zu finden: Oben rechts stehen jetzt zwei hervorgehobene Knöpfe,
  „❔ Handbuch“ und „🌐 English“ (bzw. „🌐 Deutsch“)
- Neues Willkommensfenster beim ersten Besuch: ein kurzer Einstieg mit Hinweis auf das Handbuch und auf die andere
  Sprache. Es lässt sich im Handbuch unter „Über das Spiel“ noch einmal aufrufen.
- Beim allerersten Start öffnet sich nicht mehr das ganze Handbuch, sondern das kurze Willkommensfenster

*English:* the handbook and the language switch are easier to find (two highlighted buttons at the top right), and a
welcome window on your first visit points to both.

## 1.0.0

Erste veröffentlichte Version.

- Rundenbasiertes Inselstrategiespiel gegen einen Computergegner, komplett im Browser, auf Deutsch und Englisch
- Zufällige Welten in drei Größen und drei Arten: Inselreich, Gemischt, Kontinente
- Neun Einheiten mit eigenen Rollen:
  - Infanterie und Panzer erobern Städte und gehen dabei in der Stadt auf
  - Schlachtschiffe geben Feuerunterstützung im Angriff und in der Verteidigung
  - U-Boote sind getarnt und tauchen nur auf, wenn sie angreifen; Zerstörer orten sie
  - Träger sehen vier Felder weit und geben mit Jägern an Bord Luftdeckung
  - Jäger richten gegen Schlachtschiffe dreifachen Schaden an
- Vier Schwierigkeitsstufen; auf Schwer und Brutal spielt der Gegner umsichtiger (Geleitschutz, lauernde U-Boote, Träger)
- Befehle für Marsch, Wache, Patrouille, Erkunden und Heimkehr, die bei Feindkontakt von selbst anhalten
- Handbuch im Spiel mit Einheitenkarten und einer Tabelle „Wer schlägt wen“, die sich aus den Regeln berechnet
- Bedienung mit Maus, Tastatur und Touchpad
- Spielstände im Browser, Export und Import als Datei
- Grafik und Klänge werden im Programm erzeugt; keine Cookies, kein Tracking, keine fremden Server

*English:* first published version – a turn-based island strategy game against a computer opponent, in German and
English, with nine unit types (fire support from battleships, hidden submarines, carriers with air cover), three kinds
of world, four difficulty levels, an in-game handbook and saved games you can export and import.
