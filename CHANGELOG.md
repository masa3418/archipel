# Änderungen

Alle veröffentlichten Versionen von Archipel. Die Offline-Fassung jeder Version gibt es unter
[Releases](https://github.com/masa3418/archipel/releases).

## 1.5.0

Neue Welten, Zeitraffer und ein würdiges Spielende.

**Welten**

- **Inselreich** (jetzt die empfohlene Karte): keine großen Inseln mehr. Früher wuchsen geplante Inseln an den Küsten oft
  zusammen – die größte nahm bis zu drei Viertel des Landes ein. Jetzt bleiben sie getrennt; die größte Insel hat 15–22 %
  des Landes, jede Startinsel mindestens 4 Städte. Ohne Seekrieg geht hier nichts.
- **Gemischt:** mehrere gleich große, mittelgroße Landmassen – je nach Kartengröße drei, vier oder fünf –, dazwischen viele
  kleine Inseln. Erst das eigene Land sichern, dann über See weiter.
- **Festland** (ersetzt „Kontinente“): Die ganze Welt ist eine Landmasse mit großen Binnenmeeren und Flüssen. Schiffe fahren
  auf Seen und Flüssen, Bodentruppen kommen an Brücken über die Flüsse. Landengen und Brücken sind die Engstellen – dort
  lauern Kreuzer und Schlachtschiffe von den Seen aus. Häfen gibt es nur an Seen und am Meer.
- **Kartennummer:** Jede Welt hat eine Nummer. Gleiche Nummer, Größe und Welt ergeben dieselbe Karte – zum Wiederholen oder
  Vergleichen mit Freunden. Eingabe im Fenster „Neues Spiel“ (auch Wörter gehen), dazu „Diese Welt noch einmal“; die Nummer
  steht in der Statistik und im Abschlussfenster.
- In Simulationen bleiben die Schwierigkeitsstufen auf allen drei Welten gültig.

**Rückblick**

- **Zeitraffer** (Menü, Taste T): spielt die Partie Runde für Runde ab – entdeckte Karte, Städte und ihr Umland in der
  Farbe des Besitzers, darunter das Kräfteverhältnis. Während des Spiels nur, was du damals wusstest; nach dem Ende die
  ganze Karte. Ältere Spielstände zeichnen ab dem Laden auf.
- **Abschlussfenster:** Sieg oder Niederlage jetzt mit festlichem Kopf, dem Zeitraffer der ganzen Partie und einer
  Endstatistik – Eckdaten und je Einheitentyp gebaut und verloren, für beide Seiten.

**Klänge**

- **Startmelodie:** der Anfang der „Morgenstimmung“ von Edvard Grieg (gemeinfrei, im Spiel selbst erzeugt) – beim Start
  einer neuen Partie und beim allerersten Besuch. Ein Hinweis im Handbuch würdigt den Komponisten.
- **Sieg und Niederlage** klingen jetzt etwa acht Sekunden lang: Fanfare mit Pauken und Becken bzw. getragene Mollakkorde
  mit einsamem Horn.

**Bedienung**

- **Zentrieren** (Fadenkreuz oben, Taste F): Karte auf die ausgewählte Einheit, nachdem du dich umgesehen hast.
- **Tastenlegende** über der Karte, im Menü einschaltbar; was gerade nicht geht, ist abgeblendet.
- Das Spielstandfenster schließt sich nach dem Speichern.

**Gegner**

- Schiffe des Gegners bleiben nicht mehr auf einem bedrohten Feld stehen (z. B. ein U-Boot neben deinem Zerstörer), sondern
  fliehen.
- Städte im Binnenland bauen nicht mehr massenhaft Jäger.

**Korrigiert**

- Öffnete sich das Landefenster oder das Eroberungsfenster, schwenkte die Karte darunter schon zur nächsten Einheit.
- Über einem U-Boot neben Infanterie stand eine Siegchance, obwohl Bodentruppen U-Boote nicht angreifen können.

*English:* new worlds – the archipelago (now recommended) no longer has large islands, “mixed” has several medium-sized land
masses depending on the map size, and the new “mainland” is a single land mass with large inland seas, rivers and bridges.
Every world has a map number to replay or share it. A time-lapse replays the game turn by turn, and the end of a game shows
it together with final statistics. The game start plays the opening of Grieg’s “Morning Mood”; victory and defeat have longer
music. Also new: a centre button (F), an optional keyboard legend on the map, and enemy ships that flee instead of waiting
to be sunk.

## 1.4.0

Seekrieg an der Küste und Landungen.

**Neue Regeln**

- **Küstenangriff:** Schiffe an der Küste sind jetzt in Gefahr. Bodentruppen, die ein Schiff auf einem Nachbarfeld
  angreifen, richten dreifachen Schaden an: Infanterie versenkt einen Zerstörer zu 50 %, ein Panzer zu 75 %, einen Träger
  zu 31 %. Kreuzer und Schlachtschiffe sind für die Küste gebaut und bleiben sicher. Erkundung mit Zerstörern entlang
  fremder Küsten wird damit riskanter.
- **U-Boote** können von Bodentruppen nicht mehr angegriffen werden.
- **Beschuss von Land:** Von den Schiffen können nur noch Kreuzer und Schlachtschiffe Einheiten an Land angreifen, auch in
  Städten an der Küste. Zerstörer, U-Boote und Träger kämpfen nur gegen Schiffe und Flugzeuge.
- In Simulationen (je 192 Partien pro Stufe) ändern sich die Schwierigkeitsstufen durch die neuen Regeln nicht spürbar.

**Landungen**

- **Rückfrage vor fremden Städten:** Liegt ein beladener Transporter ohne Befehl vor einer neutralen oder feindlichen Stadt,
  fragt das Spiel, ob die Truppen angreifen sollen – angreifen, nur an Land setzen oder nicht angreifen. Die Runde endet
  nicht, bevor du dich entschieden hast, auch wenn der Transporter selbst keinen Zug mehr hat.
- **Feind am Ufer:** Steht eine feindliche Einheit auf einem Landfeld neben dem Transporter (Bodentruppen, auch ein Jäger
  über Land) und hat der Transporter keinen Zug mehr, fragt das Spiel ebenfalls. Wer siegt, geht dabei an Land.
- **Angriff direkt auf der Karte:** Über dem Ziel stehen ein Zielkreuz und die Chance. Ein Klick darauf oder die
  Richtungstaste dorthin löst den Angriff vom Schiff aus, vor Städten auch die Taste U.
- **„Ausladen, wenn möglich“:** neuer Schalter je Transporter für Landemanöver an freier Küste. Sobald er Land berührt,
  werden die Truppen nacheinander zum Aussteigen angeboten, bis kein Feld mehr frei ist. Ist er leer, schaltet sich der
  Schalter ab. Ein kleiner Pfeil an der Marke zeigt, bei welchen Transportern er an ist.
- Wer einen Transporter ohne Zug bewegen will, dessen Truppen noch angreifen können, bekommt jetzt eine Erklärung statt
  „Keine Bewegungspunkte mehr“.

**Handbuch**

- „Erste Schritte“ ist wieder kurz. Alles zum Beladen, Landen und Angreifen vom Schiff steht gesammelt auf der neuen Seite
  „Transporter“ – mit dem Tipp, wie man über Marschziele Nachschub in einer Hafenstadt sammelt und mit dem Transporter
  einfach abholt.

**Korrigiert**

- Eine Einheit, die vom Schiff aus einen Gegner an Land besiegte, zog zwar an Land, zählte aber weiter als Ladung und sprang
  beim Weiterfahren des Transporters zurück an Bord.

*English:* naval warfare at the coast – ground troops deal triple damage to ships next to the coast (cruisers and
battleships excepted, submarines out of their reach), and only cruisers and battleships can attack units on land. Landings
are safer: the game asks whether the troops on board should attack a city or an enemy on the shore, the attack can be
started by clicking the target, and a new per-transport switch “Unload when possible” offers the troops for disembarking as
soon as the transport touches land. The handbook has a new “Transports” page.

## 1.3.0

Transporter nehmen dem Spieler Handgriffe ab.

- **Mitnehmen beim Auslaufen:** Verlässt ein Transporter eine eigene Stadt, nimmt er die Infanterie und Panzer, die dort
  warten (ohne Befehl oder auf Wache), von selbst mit, soweit der Laderaum reicht. Es genügt also, Truppen in einer Stadt
  zu sammeln und mit dem Transporter hindurchzufahren. Wer in einer eigenen Stadt selbst auslädt, lässt die Truppen dort.
- **Laden bis voll** (Taste L): Der Transporter bleibt liegen und nimmt auf, was in seiner Stadt oder direkt neben ihm
  wartet – auch in den folgenden Runden, bis er voll ist. Der Befehl geht jetzt überall, nicht nur im Hafen.
- **Sofortangriff vom Schiff:** Liegt der Transporter neben einer neutralen oder feindlichen Stadt, greifen die Truppen mit
  „Ausladen“ (Taste U) direkt vom Schiff aus an – erst Infanterie, dann Panzer, bis die Stadt fällt. Bisher kostete das
  Aussteigen ihren Zug, und der Angriff kam erst in der nächsten Runde. „Nur an Land setzen“ gibt es weiterhin.

*English:* transports now do more by themselves – they take waiting infantry and tanks along when leaving one of your
cities, “Load until full” (L) keeps them in place until the hold is full, and next to a neutral or enemy city “Unload”
(U) makes the troops attack straight from the ship instead of a turn later.

## 1.2.4

Fehlerkorrektur.

- **Jäger-Patrouille:** Eine Patrouille mit Jägern endete nach dem ersten Tankflug – der Jäger stand danach ohne Befehl
  in der Stadt. Jetzt fliegt er rechtzeitig zum Tanken in die nächste eigene Stadt und setzt die Patrouille beim selben
  Wegpunkt fort. Liegt ein Wegpunkt außer Reichweite (mehr als 8 Felder von der nächsten Stadt), bricht er mit einer
  Meldung ab und fliegt heim.

*English:* bug fix – a fighter patrol used to end after the first refuelling flight, leaving the fighter in the city
without orders. Fighters now refuel in your nearest city and carry on with the patrol; a waypoint out of range ends
the patrol with a message.

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
