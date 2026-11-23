# Änderungen

Alle veröffentlichten Versionen von Archipel. Die Offline-Fassung jeder Version gibt es unter
[Releases](https://github.com/masa3418/archipel/releases).

## 1.9.3

Zwei Korrekturen.

- **Einheit ohne Züge:** Klickst du mit einer Einheit, die in dieser Runde keine Züge mehr hat, auf ein Ziel daneben, bleibt sie
  ausgewählt, und die Meldung nennt den Grund. Vorher sprang die Auswahl still zur nächsten wartenden Einheit – stand die direkt
  neben demselben Ziel, griff beim nächsten Klick sie an, etwa eine Infanterie einen Zerstörer. Hinweiszeile und Karte zeigen an
  einem Ziel daneben keine Siegchance und keinen roten Rahmen mehr, solange die gewählte Einheit keine Züge hat. Dasselbe gilt für
  „Ausladen“, wenn kein Feld frei ist.
- **Lupe (Taste O):** Städte tragen auch unter der Lupe Stadtmauer und Eckwinkel wie auf der Karte.

*English:* clicking a target next to a unit that has no moves left this turn now keeps that unit selected and says why. Before,
the selection silently jumped to the next waiting unit – if that one stood next to the same target, your next click made it
attack, for example an infantry attacking a destroyer. While the selected unit has no moves, the info line and the map no longer
show a win chance or a red frame on targets next to it; the same applies to “Unload” when no tile is free. The magnifier (key O)
now shows city walls and corner brackets on cities, as the map does.

## 1.9.2

Schlachtschiff und Träger schneller, ihre Wirkung auf der Karte sichtbar.

- **Schlachtschiff und Träger fahren 3 statt 2 Felder:** Sie halten mit einem beladenen Transporter Schritt und kommen nicht
  mehr erst an, wenn der Kampf um eine Insel schon entschieden ist. Die Schwierigkeitsstufen bleiben laut Messung gleich.
- **Feuerunterstützung auf der Karte:** Gegner an Land neben deinem Schlachtschiff tragen Eckwinkel – deine Bodentruppen
  treffen sie dort zu 67 %. Es zählt das Feld, das angegriffen wird, nicht der Standort deiner Truppe. Truppen neben einem
  Schlachtschiff ihres Besitzers tragen einen Zinnenkranz und werden nur zu 33 % getroffen – deine wie die des Gegners;
  geschützte Städte umgibt eine Stadtmauer. Alles bleibt im eigenen Feld, Einheiten und Städte mit Zeichen sind dafür etwas kleiner.
- **Luftdeckung auf der Karte:** Schiffe neben einem Träger mit Jägern an Bord tragen einen hellen Schirmring an ihrer Marke
  statt eines Rings um das Feld.
- **Gegnerzüge:** In der Wiedergabe erscheinen fremde Einheiten erst dort, wo du sie tatsächlich siehst – vorher stand etwa ein
  getauchtes U-Boot schon sichtbar auf seinem Startfeld.
- **Gegner ab Schwer:** Seine Schiffe sehen nach jedem Feld neu hin und weichen einer überlegenen Einheit aus, die sie unterwegs
  entdecken.
- **Grafiken:** Das Piratenschiff der Segelzeit trägt eine große schwarze Flagge mit Totenkopf. Die Grafik-Übersicht erklärt bei
  Weltraum und Segelzeit, was jedes Bild zeigt, und öffnet sich jetzt über ☰ Menü → Hilfe → Grafiken.

*English:* battleships and carriers now move 3 tiles instead of 2, so they keep up with a loaded transport; difficulty levels
measured unchanged. The map shows fire support: enemies on land next to your battleship get corner brackets, troops next to a
battleship of their own side get a ring of battlements, protected cities a city wall; ships under a carrier's air cover get a
light ring around their marker. Marked units and cities are drawn slightly smaller so everything stays inside its tile. In the
replay of enemy moves, foreign units only appear where you actually see them. From Hard upwards, enemy ships look around after
every tile and steer clear of superior units they discover. The pirate ship flies a large black skull-and-crossbones flag, and
the graphics overview (☰ Menu → Help → Graphics) explains the pictures of the space and age-of-sail sets.

## 1.9.1

Viel mehr Platz für Spielstände.

- **Gepackte Spielstände:** Benannte Spielstände belegen im Browserspeicher nur noch etwa ein Zehntel – statt rund 15 späten
  Partien auf der großen Karte passen jetzt etwa 200 hinein. Exportierte Dateien sind etwa fünfmal kleiner. Der automatische
  Spielstand bleibt ungepackt. Vorhandene Spielstände werden beim Start einmal nachgepackt, ältere exportierte Dateien laden
  weiter. Gepackte Spielstände und Dateien lassen sich mit Version 1.9.0 und älter nicht mehr öffnen.
- **Grafik-Übersicht nach Sets:** Oben im Fenster „Grafiken“ (Einstellungen → Anzeige) wählst du Inselwelt, Weltraum oder
  Segelzeit – Einheiten, Städte, Gelände, Markierungen und Animationen samt Klängen erscheinen dann im gewählten Set.

*English:* named saved games are now packed and take only about a tenth of the browser storage (about 200 late games on the
large map instead of 15); exported files are about five times smaller. The autosave stays unpacked; existing saved games are
packed once at start, and older exported files still load. Packed saved games and files cannot be opened with version 1.9.0 or
older. The graphics overview has a set switch at the top that applies to all its tabs.

## 1.9.0

Drei Grafik-Sets: Inselwelt, Weltraum und Segelzeit.

- **Grafik-Sets:** Unter „Ansicht“ (das Auge oben) wählst du, wie die Welt aussieht – Einheiten, Städte, Landschaft, Kartenrand
  und Klänge passen jeweils zusammen. Regeln und Namen der Einheiten bleiben in allen Sets gleich, es ist nur ein anderes Bild.
  - **Weltraum:** Das Meer wird zum All mit Sternen und Nebeln, das Land zu Asteroiden, die Städte zu Raumstationen; dazu
    Raumsoldat, Rover, Raumjäger, Frachter, Korvette, Tarnkappenschiff, Kreuzer, Mutterschiff und Schlachtschiff. Im
    Asteroidengürtel steht neben der Karte eine Sonne – nahe bei ihr Eisen-, weit weg Eis-Asteroiden, dazwischen Gestein,
    vereinzelt Kristall.
  - **Segelzeit:** eine alte, scheinbar von Hand kolorierte Karte mit Wellen und Küsten in Tinte und der alten Seekarte ringsum;
    Musketier, Kavallerie, Heißluftballon, Handelsschiff, Schaluppe, Piratenschiff, Fregatte, Ballonschiff und Linienschiff,
    die Städte als Festungen. Mit Klimazonen: Eismeer im Norden und Süden, Wüste in der Mitte, vereinzelt Tropen.
  - **Eigene Klänge:** Triebwerke, Düsen und Servos im Weltraum, Hufschlag, Ballonbrenner und knarrende Segelschiffe in der
    Segelzeit – gleich laut eingemessen wie die bisherigen. Der Klangtest zeigt sie nach Sets.
- **Einfach wählen:** Ein Set bringt seine Landschaft mit Klimazonen und den passenden Rand mit. Einzelne Landschaften (nur
  Wüste, nur Eis …) und andere Ränder stehen im neuen Fenster „Aussehen der Karte“ – unter „Ansicht“ und in den Einstellungen.
- **Kräfteverhältnis klarer:** Der Balken zeigt nur noch die Anteile in Farben, ohne Prozentzahlen (sie passten nicht zur
  Schwelle fürs vorzeitige Ende); die Städtezahlen stehen beim Zeigen mit der Maus, die Rechnung per Klick. Die Kurve darunter
  zeigt die ganze Partie, ein Klick auf sie öffnet den Zeitraffer – ebenso ein neuer Knopf im Fenster „Kräfteverhältnis“.

*English:* three graphics sets – island world, space and age of sail – each with its own units, cities, landscapes, map border
and sounds; rules and unit names stay the same. Space turns the sea into stars and nebulae and the land into asteroids (in the
asteroid belt a sun beside the map sorts them into iron, rock and ice); the age of sail shows an old map that looks hand-coloured,
with sailing ships, cavalry and fortified towns, also with climate zones. You pick a set under “View”; single landscapes and other
borders are in the new “Map appearance” window. The balance-of-power bar no longer shows percentages, and its curve now covers
the whole game and opens the time-lapse when clicked.

## 1.8.8

Stufenloser Zoom und ein Rand nach Wahl.

- **Stufenloser Zoom:** Mausrad, Spreizgeste am Touchpad und die Knöpfe „+“ / „−“ zoomen fließend – jede Feldgröße zwischen 14
  und 48 Pixeln ist möglich statt neun fester Stufen. Jede Raste gleitet sanft, ohne nachzufedern, und der Punkt unter der Maus
  bleibt, wo er ist. Abschaltbar unter Einstellungen → Ton & Steuerung.
- **Kartenrand nach Wahl:** Was außerhalb der Karte liegt, wenn du an ihren Rand scrollst oder weit herauszoomst – offenes Meer
  in der Wasserfarbe der Landschaft, eine alte Seekarte mit Windrose und Seeungeheuern, ein Holztisch, das Weltall mit funkelnden
  Sternen oder schlicht wie bisher. Wählbar unter „Ansicht“ und in den Einstellungen.

*English:* stepless zoom – mouse wheel, pinch and the zoom buttons now zoom smoothly to any size, and the point under the mouse
stays put (can be switched off under Settings → Sound & controls). You can also choose what lies around the map: open sea in the
colour of the landscape, an old sea chart with compass rose and sea serpents, a wooden table, outer space or plain as before.

## 1.8.7

Mehr Übersicht auf der Karte, verborgene Besatzungen und ein würdiges Ende.

- **Die gewählte Einheit findet man leichter:** Wechselt das Spiel zur nächsten Einheit, zieht sich ein Suchring auf sie
  zusammen. Der Ring um die Einheit hat einen dunklen Saum und einen leichten Herzschlag, und die Karte rückt sie früher in
  die Mitte – auch wenn sie unter der Tastenlegende oder einem Tipp liegt.
- **Weniger Springen:** „Nächste Einheit“ (N) nimmt immer die nächstgelegene wartende Einheit; nach einer Eroberung oder
  einem Verlust geht es in der Nähe weiter. Märsche, Patrouillen und Erkunden laufen beim Rundenwechsel räumlich geordnet –
  die Kamera der Wiedergabe fährt nur noch einen Bruchteil der bisherigen Wege.
- **Verborgene Besatzung:** Feindliche Städte zeigen nur noch, dass sie besetzt sind (Schild mit Fragezeichen). Welche Einheit
  verteidigt, zeigt sich erst im Kampf; gegen eine besetzte Stadt gibt es deshalb keine Siegchance mehr.
- **Kapitulation:** Mit mehreren Gegnern gibt eine Partei auf, die schon einmal vier Städte hatte und zehn Runden lang nur
  noch höchstens zwei besitzt – ihre Städte werden neutral. Das Angebot zum vorzeitigen Sieg ist ein eigenes Fenster
  geworden: „Deine Gegner kapitulieren!“, die Rechnung dazu zum Aufklappen.
- **Transporter des Computers:** Seine Truppen greifen jetzt auch nach der letzten Fahrt des Transporters vom Schiff aus an.
  Auf Schwer und Brutal flüchtet ein bedrohter Transporter in einen nahen eigenen Hafen – diese Stufen sind dadurch etwas härter.
- **Korrigiert:** Der Ring der Luftdeckung fährt in der Wiedergabe mit dem Träger, statt am Ziel zu warten; versenkte
  Einheiten verschwinden auch bei langen Gegnerzügen rechtzeitig; der Jäger klingt nicht mehr lauter als die anderen Einheiten.

*English:* a locator ring and a gentle pulse make the selected unit easier to find, and “Next unit” as well as standing orders
now go by distance, so the map jumps far less. Enemy cities only show that they are garrisoned – the defender is revealed in
battle. With several opponents, a party reduced to two cities for ten turns surrenders, and the offer of an early victory has
its own celebratory window. Computer transports let their troops attack after the last move and, on Hard and Brutal, flee into
a nearby port. Fixes for the air cover ring and sunk units during the replay, and the fighter is no longer louder than the rest.

## 1.8.6

Eine Datei zum Offline-Spielen.

- **Neuer Name:** Die Offline-Fassung heißt jetzt `archipel-offline.html` (bisher `archipel.html`). Herunterladen und
  doppelklicken – wie bisher steckt das ganze Spiel in dieser einen Datei.
- **Kein eigenes ZIP mehr:** Das ZIP mit den einzelnen Dateien lief genauso wie die Einzeldatei und war nur zum
  Hineinschauen nützlich. Dafür hängt GitHub jedem Release ohnehin den Quelltext als „Source code“ an.
- **Release-Texte** auf GitHub brechen nicht mehr mitten im Satz um; die Texte der früheren Releases sind berichtigt.

*English:* the offline version is now called `archipel-offline.html` (formerly `archipel.html`) and is the only download –
the separate ZIP is gone, as GitHub attaches the individual files to every release as “Source code” anyway. Release notes
no longer break lines in the middle of sentences.

## 1.8.5

Mehr Grün in den Klimazonen, und die Landschaft bleibt eingestellt.

- **Klimazonen mit mehr Grün:** Grün nimmt jetzt rund zwei Drittel des Landes ein (vorher ein Drittel), Wüste und Schnee sind schmalere
  Gürtel. Kleinere Inseln werden nach ihrer Lage von Nord nach Süd eingeteilt: Die nördlichsten und südlichsten sind Schneeinseln,
  die mittleren Wüsteninseln – so hat jede Inselkarte ein paar davon, auch wenn am Kartenrand nur Wasser liegt.
- **Die Landschaft bleibt eingestellt:** Was du über „Ansicht“ oder in den Einstellungen wählst, gilt sofort und auch für alle
  neuen Partien. Gespeicherte Partien zeigen beim Laden die Landschaft, mit der sie gespeichert wurden.

*English:* more green in the climate zones – about two thirds of the land instead of one third; smaller islands are sorted from north
to south, so every island map has a few snow and desert islands. The landscape you pick under View or in the settings now stays set
and applies to new games too; saved games keep the landscape they were saved with.

## 1.8.4

Klimazonen – jede Insel sieht anders aus.

- **Neue Landschaft „Klimazonen“**, jetzt der Standard: Schnee im Norden und Süden, Wüste in der Mitte, Grün dazwischen und
  vereinzelt Lava. Kleine Inseln sind einfarbig, große Landmassen gehen von Zone zu Zone über. Gleiche Kartennummer, gleiches Bild.
- Jede neue Partie beginnt in den Klimazonen; die Auswahl im Fenster „Neues Spiel“ entfällt. Grüne Inseln, Wüste, Schnee, Lava und
  fremder Planet lassen sich weiterhin jederzeit über **Ansicht** (das Auge oben) einschalten.
- **Neutrale Städte** haben einen dunklen Rand. Eine Prüfung aller Parteifarben auf allen Landschaften ergab, dass sie auf Sand und
  Schnee fast verschwanden; die Einheiten aller Parteien waren überall gut zu erkennen.

*English:* a new landscape, **climate zones**, is now the default: snow in the north and south, desert in the middle, green in
between and the odd lava field; small islands have a single zone. Every new game starts in climate zones – the choice in the New
game window is gone, the other landscapes remain available under View. Neutral cities now have a dark rim, as they almost vanished
on sand and snow.

## 1.8.3

Das Kräfteverhältnis zählt Städte.

- **Nur noch Städte:** Der Balken zeigt, wie viele von allen Städten dir, jedem Gegner und niemandem gehören – die neutralen grau.
  Am Anfang ist er fast ganz grau; so sieht man auch, wie weit die Partie ist. Bisher wurde eine Stärke aus Einheiten und Städten
  berechnet. In Testpartien sagt der Städteanteil den Sieger etwa ebenso gut voraus; er zählt aber keine Armeen – eine Flotte auf
  dem Weg zu dir sieht man erst, wenn Städte fallen.
- **Einschätzung** („Überlegen“ …), Kurve und das Angebot zum vorzeitigen Ende vergleichen deine Städte mit denen des stärksten
  Gegners. „Erdrückend überlegen“ und „Aussichtslos“ beginnen genau dort, wo Sieg bzw. Aufgeben angeboten werden – sie folgen also
  der Schwelle in den Einstellungen.
- **Kräftefenster** vereinfacht: Städte je Partei und neutral, Anteile, und wie gezählt wird. Der Haken „Zahlen des Gegners
  aufdecken“ entfällt – seine Städtezahl zeigt der Balken jetzt ohnehin.
- Der **Zeitraffer** zeigt die Städte aller Parteien übereinander, oben grau die neutralen.
- **Ältere Spielstände** bekommen ihren Verlauf beim Laden aus dem Zeitraffer nachgerechnet.

*English:* the balance of power now counts cities only. The bar shows how many of all cities you, each enemy and nobody own –
neutral ones in grey. The assessment, the curve and the early-end offer compare your cities with the strongest enemy's; the
outer levels (“Overwhelming”, “Hopeless”) follow the early-end threshold in the settings. The balance-of-power window is simpler,
the time-lapse curve shows everyone's cities, and older saves get their history rebuilt from the time-lapse when loaded.

## 1.8.2

Kleinigkeiten für den Einstieg.

- **Tipps fallen mehr auf:** Ein neuer Tipp gleitet herein, leuchtet dreimal gelb auf und gibt einen leisen Ton. Das Kästchen ist
  gelb statt blau gerahmt und hebt sich so von der übrigen Oberfläche ab.
- **Neue Partie beginnt nah herangezoomt,** mit der Startstadt in der Bildmitte – am Anfang füllt der Nebel so weniger vom Bild.
  Herauszoomen geht wie immer mit dem Mausrad oder der Taste −.
- **Tipps berichtigt:** Der Tipp nach dem ersten Sieg erklärte die Reparatur falsch. Richtig ist: Schiffe werden in einer eigenen
  Hafenstadt repariert, einen Trefferpunkt je Runde; Panzer lassen sich nicht reparieren. Der Tipp zum ersten Feindkontakt nennt
  jetzt die Taste K für die Reichweite der Gegner.
- **Handbuch:** Die Angabe, wie oft der Testspieler auf Schwer gewinnt, passt wieder zu den Regeln (etwa jede sechste Partie).

*English:* small things for getting started. A new tip slides in, glows amber three times and chimes softly; its box is amber
instead of blue. A new game starts zoomed in close on your first city. The tip after your first win explained repairs wrongly
(ships are repaired in your own ports, one hit point per turn; tanks cannot be repaired), and the enemy-contact tip now mentions
key K for the enemy reach.

## 1.8.1

Ein fairerer Anfang, kein verfrühtes Siegangebot und eine Lupe.

**Sicherer Anfang**

- Solange ein Spieler weniger als drei Städte besitzt, fällt eine **neutrale Stadt sicher** – die ersten beiden Eroberungen gelingen
  also immer. Das gilt für alle, auch für den Computergegner; Städte eines Gegners bleiben bei 50 %.
- Grund: Pech bei den ersten Würfen entschied bisher zu viel. In Testpartien zweier gleich starker Gegner gewann, wer am Anfang
  weniger Infanterie verlor, 65 % der Partien (mit Pech 37 %); mit der neuen Regel ist das ausgeglichen. Auf Schwer und Brutal
  startet auch der Gegner schneller – diese Stufen sind dadurch etwas härter.

**Vorzeitiges Ende**

- Das Spiel bietet Sieg oder Aufgeben erst an, wenn höchstens die **Hälfte der Städte noch neutral** ist – und den Sieg nur, wenn du
  den Gegner **gefunden** hast. Vorher konnte „Der Sieg ist dir sicher“ schon nach wenigen Runden kommen, wenn der Gegner schwach
  gestartet war.

**Lupe**

- Taste **O** gedrückt halten: ein runder, scharf vergrößerter Ausschnitt der Karte unter der Maus. Loslassen schließt ihn.
- Bäume, Hügel und Wellen stehen auf allen Karten etwas anders als bisher (nur die Verzierung, nicht die Karte selbst).

*English:* a fairer start – as long as a player owns fewer than three cities, a neutral city falls for certain, so the first two
captures always succeed (for everyone, the computer too; enemy cities stay at 50 %). The early-end offer no longer comes too soon:
only once at most half of the cities are still neutral, and victory only after you have found the enemy. New magnifier: hold **O**
for a round, sharply enlarged view of the map under the mouse.

## 1.8.0

Zwei neue Welten, eine neue Ebene und eine aufgeräumte Kopfzeile.

**Neue Welten**

- **Kontinente:** Jeder beginnt auf seinem eigenen Kontinent – zwei Spieler links und rechts, drei im Dreieck, vier in den Ecken.
  Dazwischen liegt das Meer mit kleinen Inseln als Trittsteinen. Die Kontinente sind zerklüftet, mit Buchten und Halbinseln.
- **Binnenmeer:** Land ringsherum, in der Mitte ein Meer mit einigen kleinen Inseln. Der Landweg führt außen herum, der kurze Weg geht
  übers Wasser.
- Beide sind gegen die bisherigen Welten vermessen: Die Schwierigkeitsstufen liegen wie gewohnt, es gibt mehr Seekrieg und weniger
  festgefahrene Partien als auf dem Festland.

**Reichweite der Gegner**

- Neue zuschaltbare Ebene (Taste **K** oder über „Ansicht“): Rot getönt sind alle Felder, auf denen eine sichtbare gegnerische Einheit
  in ihrem nächsten Zug angreifen könnte; nur schraffiert ist, was allein Jäger erreichen.
- Die Ebene verrät nichts, was du nicht siehst: keine Einheiten im Nebel, keine Ladung, in fremden Städten nur die gezeigte Einheit.

**Kopfzeile und Tastenlegende**

- Der neue Knopf **Ansicht** (das Auge neben „Zentrieren“) bündelt alles, was die Anzeige der Karte betrifft: Tastenkürzel, Wegvorschau,
  Kräfteverhältnis, Wege und Marschziele, Reichweite der Gegner – und die fünf Landschaften. Die Liste bleibt beim Klicken offen.
- Die **Wege** (Taste G) sind dorthin umgezogen; der Schalter in der Seitenleiste hat nur noch Einheiten | Produktion.
- Die **Tastenlegende** lässt sich am oberen Rand verschieben und merkt sich ihre Stelle. Das × klappt sie nur noch zu einem
  Schildchen „Tasten“ unten links ein, statt sie verschwinden zu lassen – ein Klick klappt sie wieder auf.

*English:* two new worlds – **Continents** (everyone starts on a continent of their own: left and right for two players, a triangle
for three, the corners for four) and **Inland sea** (land all around, a sea with a few small islands in the middle). A new layer,
**enemy reach** (key K), tints every tile a visible enemy unit could attack on its next turn; it reveals nothing you cannot see.
The new **View** button in the header gathers the display switches, the routes, the enemy reach and the five landscapes. The key
legend can be dragged and now collapses to a small “Keys” chip instead of disappearing.

## 1.7.7

Landschaft auf Knopfdruck.

- **Neuer Knopf in der Kopfzeile** (neben „Zentrieren“): Er öffnet eine kleine Liste der fünf Landschaften – ein Klick, und die Karte
  wechselt mitten im Spiel ihr Aussehen. Die Auswahl in den Einstellungen und im Fenster „Neues Spiel“ bleibt.
- Im Fenster **Neues Spiel** ist jetzt zufällig eine von **allen fünf** Landschaften vorgewählt, also auch Lava und Fremder Planet.
- Die **allererste Partie** beginnt immer in der grünen Welt.

*English:* a new button in the header (next to “centre”) opens a small list of the five landscapes – one click changes the look of
the map in the middle of a game. The New game window now preselects one of all five landscapes at random; your very first game always
starts in the green world.

## 1.7.6

Neue Landschaften – dieselbe Inselwelt in fünf Gewändern.

**Landschaften**

- Die Karte gibt es jetzt in fünf Landschaften: **Grüne Inseln**, **Wüste**, **Schnee**, **Lava** und **Fremder Planet**. Es ändert sich
  nur das Aussehen – Karte, Regeln und Kartennummer bleiben gleich.
- Im Fenster **Neues Spiel** wählst du die Landschaft; vorgewählt ist zufällig Grün, Wüste oder Schnee. „Diese Welt noch einmal“
  übernimmt auch die Landschaft.
- Unter **Einstellungen → Anzeige** lässt sie sich jederzeit umschalten, auch mitten in der Partie. Sie wird mit der Partie gespeichert;
  ältere Spielstände und die Beispiele bleiben grün.

**Städte**

- Städte zeigen die Farbe ihres Besitzers jetzt auf dem ganzen Platz statt nur auf Dächern und Fähnchen. Die Parteien sind damit auch
  herausgezoomt auf einen Blick zu unterscheiden; neutrale Städte bleiben beige.

**Handbuch**

- Neu unter „Über das Spiel“: **Vorbilder** – woher die Idee stammt (Empire: Wargame of the Century und Carrier Command auf dem Amiga).

*English:* five landscapes for the same island world – green islands, desert, snow, lava and alien planet. Only the look changes; map,
rules and map number stay the same. You pick the landscape in the New game window (green, desert or snow is preselected at random) and
can switch it at any time under Settings → Display; it is saved with the game. Cities now show their owner's colour on the whole plaza,
so the sides are easy to tell apart even when zoomed out. The handbook gains a short note on the games that inspired Archipel.

## 1.7.5

Aufgeräumt: klarere Befehle, übersichtlichere Einstellungen und ein entschlacktes Handbuch.

**Befehle**

- **Befehle, die gerade nichts bewirken, sind grau** – in der Seitenleiste, im Rechtsklick-Menü und in der Tastenlegende. Der
  Hinweistext nennt den Grund, zum Beispiel „Hier gibt es nichts mehr zu erkunden“ oder „Steht schon in einer eigenen Stadt“.
  Wer die Taste trotzdem drückt, bekommt dieselbe Meldung.
- **Erkunden** meldet sofort, wenn es nichts mehr zu entdecken gibt, statt den Befehl anzunehmen und ihn erst später zu beenden.

**Einstellungen**

- Vier **Reiter** statt einer langen Liste: Anzeige, Spielablauf, Ton & Steuerung, Schummeln & Zurücksetzen. Jede Seite passt
  ohne Scrollen ins Fenster.
- Neu: **Zurücksetzen** – löscht nach einer Rückfrage alle Einstellungen, die gesehenen Tipps und die laufende Partie; das Spiel
  beginnt wie beim ersten Besuch. Praktisch, wenn sich mehrere einen Rechner teilen. Gespeicherte Spielstände bleiben, außer man
  setzt in der Rückfrage den Haken.
- Schummeln und Zurücksetzen stehen abgesetzt in einem eigenen Kasten: Sie sind keine gewöhnlichen Einstellungen.
- „Willkommensfenster noch einmal zeigen“ steht jetzt unter **Spielablauf** (vorher im Handbuch).
- Das **vorzeitige Ende** wird standardmäßig ab 20 % Stärkeanteil angeboten statt ab 10 %. In 288 Testpartien war die Partie bei
  20 % praktisch immer entschieden (ein Irrtum); das Angebot kommt 30 bis 45 Runden früher. Wer selbst einen Wert gewählt hat, behält ihn.

**Handbuch**

- **Beispiel-Spielstände** zum Aufklappen: Jede Partie zeigt ihre Eckdaten und schildert die Lage, erst dann folgt „Diese Partie laden“.
- **Über das Spiel**, **Steuerung** und **Gegner & Stufen** sind aufgeräumt: Das Wichtige steht offen, Hintergrund und lange
  Erläuterungen klappen auf.
- Berichtigt: der Verweis auf „Nebel aus“ in den Einstellungen, und Umschalt + Klick nennt jetzt auch das An-Bord-Gehen.

**Unter der Haube**

- Automatische Tests für Regeln und Oberfläche; sie laufen bei jeder Änderung und müssen vor einem Release bestehen.
- Die installierte App räumt nicht mehr benötigte Dateien aus ihrem Zwischenspeicher.
- Im Lizenzhinweis steht jetzt masa3418, wie das Repository.

*English:* a tidy-up release. Commands that would do nothing right now are greyed out in the side panel, the right-click menu and
the key legend, with the reason as a tooltip; Explore says at once when nothing is left to discover. The settings have four tabs
and a new **Reset** that restores the game to its first-visit state (saved games are kept unless you tick the box); cheats and reset
sit in their own box. The early-end offer now defaults to 20 % instead of 10 %. In the handbook, the example games open up with a
description before the load button, and long background texts are collapsible. Under the hood: automated tests that must pass
before every release.

## 1.7.4

Leichterer Einstieg – nach dem Test mit einem Erstspieler.

**Einstiegstipps**

- Kurze Hinweise oben links über der Karte führen durch die ersten Runden: der erste Zug, Maus und Karte, Städte erobern, die erste
  eigene Stadt, Transporter und Zerstörer, der erste Feindkontakt. Jeder Tipp erscheint einmal, sobald er zur Lage passt.
- Weitere Tipps erklären jede Einheitenart, sobald du die erste bekommst, und besondere Momente: erster Sieg und Verlust, abgestürzter
  Jäger, versenkter Transporter, verlorene Stadt, die erste Stadt des Gegners – dazu Heimkehr, Wache, Marschziel und
  Produktionsansicht, wenn sie gerade helfen.
- Eingeschaltet beim allerersten Besuch; abschaltbar auf der Karte oder unter **Einstellungen → Spielablauf** (Einschalten beginnt von vorn).

**Wegvorschau**

- Ist eine Einheit gewählt, zeigt die Karte zum Feld unter der Maus den **Weg und die Dauer in Runden** – oder warum die Einheit
  nicht hinkommt („Schiffe fahren nicht an Land“, „Bodentruppen kommen nicht übers Wasser“, „Transporter ist voll“). Was die Vorschau
  als unerreichbar zeigt, lehnt auch der Klick ab.
- **Jäger:** orange „kein Rückweg!“, wenn der Treibstoff hin, aber nicht mehr zurück reicht; rot, wenn das Ziel außer Reichweite liegt.
- **Eigene Stadt erst ansehen:** Der erste Klick auf eine entfernte eigene Stadt zeigt sie in der Seitenleiste, der zweite schickt die
  Einheit hin. Vorher marschierte die gewählte Einheit sofort los, wenn man die Stadt nur ansehen wollte.
- Hinweise auf **Umschalt + Klick**: zu einem entfernten Transporter oder Träger marschieren und an Bord gehen, oder auf das Feld
  einer eigenen Einheit marschieren.
- Abschaltbar unter **Einstellungen → Anzeige**.

**Karte und Regeln**

- **Rand um die Karte:** Jedes Feld lässt sich in die Bildmitte holen. Der Startplatz liegt jetzt immer mittig – auch in einer
  Kartenecke, wo er vorher am Bildrand und teils unter der Tastenlegende lag. Die Karte ist gerahmt, der Bereich außerhalb schraffiert.
- **Jäger auf dem Marsch:** In den Runden nach dem Befehl hält ein Jäger an, bevor der Treibstoff für den Rückweg nicht mehr reicht,
  statt von selbst in den Absturz zu fliegen. In der Runde des Befehls fliegt er wie befohlen.
- Esc verwirft zuerst nur einen festgehaltenen Weg; die Einheit bleibt gewählt.

*English:* an easier start, after watching a first-time player. Short tips at the top left of the map lead through the first turns
and explain each unit type and special moments when they come up; they can be switched off. With a unit selected, the map shows the
route and the number of turns to the tile under the mouse – or why the unit cannot get there – with fuel warnings for fighters.
Clicking one of your distant cities first shows the city, the second click sends the unit. A margin around the map lets every tile
be centred, so the starting position is always in the middle. On a multi-turn march a fighter now stops before it would lose its way
back.

## 1.7.3

Eine Übersicht aller Grafiken – mit dem SVG-Code der Einheitensymbole.

**Grafik-Übersicht**

- Neu unter **☰ Menü → Einstellungen → Anzeige → Grafiken**, wie der Klangtest: alle Bilder und Animationen des Spiels in vier
  Reitern – Einheiten in allen Farben samt den Zeichen an der Marke (Wache, Marsch, Ladung, beschädigt …), Städte und Gelände,
  Markierungen auf der Karte und sieben Animationen, die sich mit Ton abspielen lassen (Bewegung, Angriff, Salve, Luftdeckung,
  Eroberung …).
- **SVG-Code:** Für jede Einheit lässt sich der Code des Abzeichens anzeigen, kopieren oder als Datei speichern – wahlweise das
  Abzeichen wie im Spiel oder nur das Symbol. Ebenso für das App-Symbol und den Knopf „Zentrieren“.
- Die Übersicht zeichnet mit denselben Bausteinen wie die Karte; ändert sich eine Grafik im Spiel, ändert sie sich dort mit.

**Bedienung**

- **Esc schließt jedes Fenster**, auch wenn darin gerade ein Eingabefeld, Häkchen oder Regler aktiv ist – vorher blieb zum Beispiel
  „Spielstände“ offen, weil das Namensfeld den Cursor hat. Ein Suchfeld mit Text leert Esc zuerst.
- Die Online-Fassung holt nach einem Update sofort die neuen Dateien; vorher konnte ein Browser bis zu zehn Minuten die alte
  Fassung zeigen.

*English:* a new graphics overview under ☰ Menu → Settings → Display → Graphics, like the sound test: all pictures and animations
of the game – units in every colour with their marks, cities and terrain, map markers and seven animations you can play with
sound. The SVG code of every unit badge (or just the symbol), of the app icon and of the “Centre” button can be shown, copied or
saved. Esc now closes every window, even with an input field focused. The online version picks up updates immediately.

## 1.7.2

Beispiel-Spielstände zum Ausprobieren und Anschauen.

**Beispiel-Spielstände**

- **Sieben Partien in ganz verschiedenen Lagen:** vom ersten Erkunden im Inselreich über Seekrieg, Landkrieg auf dem Festland und
  drei Gegner bis zur schweren Lage auf Stufe Schwer und einem Sieg gegen drei Gegner – jeweils mit Zeitraffer und Kräftekurve
  vom ersten Zug an.
- **Online direkt im Handbuch laden:** unter „Über das Spiel“ → „Beispiel-Spielstände“ genügt ein Klick auf „Laden“. Läuft gerade
  eine Partie, fragt das Spiel vorher nach. Ein Hinweis unter „Erste Schritte“ führt dorthin.
- Die Offline-Fassung enthält die Beispiele nicht; ihr Handbuch verweist auf die Dateien bei GitHub (herunterladen, dann
  „☰ Menü → Spielstände → Aus Datei laden“).

**Behoben**

- Meldungen lagen hinter geöffneten Fenstern und waren nicht zu sehen – etwa „Gelöscht“ oder „Speicher voll“ im Fenster
  „Spielstände“. Jetzt erscheinen sie immer obenauf.

*English:* seven example games in very different situations – from the first exploring to a victory over three opponents, each
with the timelapse from the first turn. In the online version they load right from the handbook (About → Example games); the
offline copy points to the files on GitHub. Fixed: messages were hidden behind open windows, e.g. “Deleted” in the saved games
window.

## 1.7.1

Der Hafen als Schutzraum und ein Kräfteverhältnis für alle Parteien.

**Seekampf**

- **Der eigene Hafen schützt:** Zerstörer und U-Boote schießen nicht mehr in Städte – auch nicht auf Schiffe im Hafen. Ein
  Transporter im eigenen Hafen ist vor ihnen sicher. Kreuzer, Schlachtschiffe und Jäger erreichen Schiffe im Hafen weiterhin.
- **Zerstörer greifen keine Jäger über Land an**, nur über Wasser. Auf Einheiten an Land oder darüber schießen von den Schiffen
  nur Kreuzer und Schlachtschiffe.

**Mehrere Gegner**

- **Kräfteverhältnis mit allen Parteien:** Der Balken zeigt den Anteil jeder Partei an der Stärke aller, jede in ihrer Farbe;
  Kurve und Trend darunter deinen Anteil. Die Einschätzung („Überlegen“ …) vergleicht dich weiter mit dem stärksten Gegner.
- Auch die Kurve im Zeitraffer und im Abschlussfenster zeigt alle Parteien, gestapelt in ihren Farben.
- **Behoben:** Die Hinweiszeile über einer eigenen Stadt warnte nur vor Schlachtschiffen von Rot, nicht von Gelb und Violett.

**Handbuch**

- Neuer Abschnitt **„Städtenamen“** unter „Über das Spiel“: Das Spiel setzt die Namen zufällig aus Silben zusammen. Ergibt sich
  dabei ein Name, der in irgendeiner Sprache unpassend klingt, ist das nicht beabsichtigt.

Die Schwierigkeitsstufen bleiben gültig (nachgemessen mit 672 bis 864 Partien je Änderung).

*English:* your own port is now a safe haven: destroyers and submarines no longer fire into cities, not even at ships in port,
and destroyers no longer attack fighters over land. With several opponents the balance-of-power bar shows every party's share
of the total strength, and the timelapse curve shows all of them. Fixed: the hint line over your own city only warned about
red battleships. New handbook section “City names”: the names are put together from random syllables, so any unsuitable
meaning in some language is unintended.

## 1.7.0

Mehrere Gegner – jeder gegen jeden.

**Mehrere Computergegner**

- Im Fenster „Neues Spiel“ wählst du, gegen wie viele Computergegner du antrittst: auf der kleinen Karte bis zu zwei, auf der
  mittleren und großen bis zu drei. Die Gegner (Rot, Gelb, Violett) bekämpfen sich auch untereinander; die Schwierigkeit gilt
  für alle gleich.
- Sie ziehen nacheinander, über der Karte steht, wer gerade dran ist („Gelb zieht …“). Die Startplätze liegen weit
  auseinander, möglichst auf verschiedenen Landmassen.
- Neben der Stufe oben zeigt je Gegner ein Farbpunkt, wer noch im Spiel ist. Der Kräftebalken vergleicht dich mit dem
  stärksten Gegner, das Kräftefenster hat eine Spalte je Gegner (deren Zahlen wie bisher nur mit dem Spoiler-Haken).
- Abschlussfenster, Statistik, Zeitraffer, Übersichtskarte und Meldungen nennen die Gegner mit ihrer Farbe; die Spielstände
  merken sich die Zahl der Gegner. Ältere Spielstände laufen unverändert weiter.

**Ausscheiden**

- Ein Gegner, der keine Stadt mehr hat, scheidet aus, und alle seine Einheiten verschwinden. Das gilt auch mit nur einem
  Gegner: Sobald er keine Stadt mehr hat, hast du gewonnen – seine letzten Truppen musst du nicht mehr jagen. Du selbst
  verlierst wie bisher erst, wenn du weder eine Stadt noch Truppen zum Erobern hast.

**Computergegner**

- Auf dem Festland setzt der Gegner jetzt Transporter ein: Hat er mehr Truppen, als er braucht – etwa vor einer Engstelle –,
  holt er sie an der Küste ab und landet in deinem Hinterland, bei Städten weit hinter der Front. Partien fahren sich dort
  seltener fest.

Die Schwierigkeitsstufen bleiben gültig (gemessen mit je 96 Partien je Stufe). Gegen zwei oder drei Gegner ist es schwerer:
Der Testspieler gewann auf Normal 40 % bzw. ein Drittel der Partien statt rund 60 %.

*English:* play against up to three computer opponents (two on the small map) – everyone against everyone, each in its own
colour. An opponent left without cities is out and all its units disappear; with a single opponent that means you win at
once. On the mainland the computer now uses transports to land behind your lines when its army is stuck.

## 1.6.1

Erklärvideos.

- **Zehn kurze Erklärvideos** mit Ton und Texteinblendungen auf Deutsch und Englisch zu den Regeln, die man am leichtesten
  übersieht: Nebel und Erkunden, Städte erobern, Nachschub halb automatisch, Stege und Stau, Jäger-Reichweite, Luftdeckung,
  U-Boot und Sonar, Küstenangriff, Landung mit Schlachtschiff, Feuerschutz. Dazu ein Teaser „Seeschlacht im Inselreich“.
- Alle Videos stehen auf einer eigenen **Videoseite** im Internet (https://masa3418.github.io/archipel/docs/videos/).
- **Im Spiel verlinkt:** im Menü unter der neuen Gruppe „Hilfe“ (dort auch das Handbuch), oben im Handbuch („Erste Schritte“)
  und im Willkommensfenster – überall als „online ↗“ gekennzeichnet, die Seite öffnet sich in einem neuen Reiter und in der
  Sprache des Spiels. Das Spiel selbst lädt weiterhin nichts aus dem Internet.

*English:* ten short explainer videos with sound and captions (German and English) on the trickier rules, plus a sea battle
teaser, on a video page on the web. The game links to it from the menu (new “Help” group), the handbook and the welcome
window, always marked “online ↗”.

## 1.6.0

Klare Rollen zur See, Luftdeckung zum Zuschauen und ein Gegner, der nicht mehr in deine Transporter schaut.

**Seekampf**

- **Der Zerstörer ist der U-Boot-Jäger:** Torpedos richten an ihm nur 2 statt 3 Schaden an. Greift er ein U-Boot an, gewinnt
  er in 89 % der Fälle (vorher 67 %); greift ein U-Boot ihn an, nur noch in 25 % (vorher 50 %).
- **U-Boote tauchen vor allen großen Schiffen ab:** Kreuzer und Träger können getauchte U-Boote kaum noch bekämpfen
  (Kreuzer 44 % statt 88 %, Träger 16 % statt 69 %), wie bisher schon das Schlachtschiff. Große Schiffe brauchen
  Zerstörer oder Jäger als Schutz.
- **U-Boote greifen nur Schiffe an**, keine Jäger mehr.
- **Der Träger greift nicht mehr selbst an** – wie der Transporter. Verteidigen kann er sich weiterhin; angreifen sollen
  seine Jäger.
- **Luftdeckung schützt auch Transporter:** Unter Luftdeckung wehrt sich ein Transporter gegen Jäger mit Stärke 1. Ein Jäger
  gewinnt dort nur noch in 33 % der Fälle statt immer.

**Luftdeckung sichtbar**

- Greift ein Jäger ein Schiff unter Luftdeckung an, steigen zwei Abfangjäger vom Träger auf und feuern, um das
  geschützte Schiff leuchtet der Schutzring. Dazu ein eigener Klang (auch im Klangtest).
- Während der Wiedergabe des Gegnerzugs behalten Schiffe ihren Ring, bis sie wirklich angegriffen werden.

**Verborgene Stärke**

- Wie viele Einheiten der Gegner in einer Stadt oder an Bord eines Transporters oder Trägers hat, siehst du nicht mehr:
  Fremde Marken tragen keine Zahl, die Hinweiszeile nennt nur die Einheit, die das Feld verteidigen würde. Nach Spielende
  oder mit dem Schummeln „Nebel des Krieges aus“ wird alles aufgedeckt.
- Auch der Computergegner kennt die Ladung deiner Transporter nicht mehr.

**Handbuch**

- „Wer schlägt wen“ hat zwei Ansichten: **Siegchance** (einer gegen einen) und **Wirtschaftlichkeit** – wie viel Bauzeit
  ein Angriff zerstört je Bauzeit, die er kostet. So sieht man etwa, dass zwei Infanterien einen Panzer im Schnitt
  ausgleichen, Panzer an der Küste Zerstörer günstig versenken und U-Boote gegen große Schiffe sich lohnen.
- Ein Punkt in der Ecke markiert Paarungen mit Sonderregel; beim Überfahren steht, welche.
- Neue Zeile „Verborgene Stärke“, angepasste Texte zu U-Boot, Zerstörer, Kreuzer, Träger und Transporter.

Die Schwierigkeitsstufen bleiben gültig (gemessen mit je 192 Partien je Stufe).

*English:* clearer naval roles – the destroyer is the submarine hunter, submerged submarines dive away from all large
ships, submarines no longer attack fighters, and the carrier no longer attacks itself. Under air cover even a transport fights
back against fighters, and interceptors now take off visibly from the carrier. The number of enemy units in a city or on
board is hidden (revealed after the game or with the fog cheat). The “Who beats whom” table has a second view for cost
efficiency.

## 1.5.2

Bessere Wegsuche.

- **Stau an Brücken und Engstellen:** Steht eine eigene Einheit auf dem einzigen Übergang, gibt eine marschierende Einheit
  nicht mehr mit „kein Weg zum Ziel gefunden“ auf, sondern rückt bis an den Stau vor und wartet. Ist der Weg nach fünf
  Runden immer noch versperrt, bricht sie mit einer Meldung ab. Patrouillen warten, bis der Weg frei ist. Das gilt auch für
  Schiffe in engen Wasserstraßen und auf Flüssen.
- **Marschziele von Städten** lassen sich jetzt auch hinter einer besetzten Brücke setzen: Für die Route zählen Einheiten
  nicht, wer gerade wo steht, ändert sich ja. Die neu gebauten Einheiten folgen ihr und warten notfalls am Stau.
- **Schiffe im Nebel:** Liegt das Ende einer Insel noch im Nebel, planten Schiffe quer hindurch und drehten erst davor ab.
  Jetzt bevorzugen sie bekannte Wege an unerforschten Küsten; über unbekanntes offenes Meer fahren sie wie bisher.
  In Testfällen sanken die Umwege von 26 auf 10 Felder.
- **Jäger:** Ein Marschbefehl weiter als der Treibstoff reicht, wird abgelehnt (vorher stürzte der Jäger unterwegs ab).
  Kommt er hin, aber nicht mehr zurück, gibt es eine Warnung.

*English:* better pathfinding – units wait at a bridge or narrow strait blocked by their own units instead of giving up,
city rally points can be set behind occupied bridges, ships no longer plan straight through islands whose far end is still
in the fog, and fighters can no longer be ordered beyond their fuel range.

## 1.5.1

Ruhigeres Bild, aufgeräumte Fenster, nichts geht mehr verloren.

**Bewegung auf dem Bildschirm**

- **Wiedergabe der Züge** (Einstellungen): langsam, normal, schnell oder aus. Gilt für Gegnerzüge, eigene Märsche und
  Patrouillen, eigene Züge und die Kamerafahrten. „Aus“ zeigt keine Bewegung – die Einheiten stehen sofort am Ziel, die Karte
  bewegt sich nur, wenn sie muss. Für alle, die schnelles Hin und Her auf dem Bildschirm nicht gut vertragen; ist im System
  „Bewegung reduzieren“ eingestellt, beginnt das Spiel mit „aus“. Das neue „normal“ ist ruhiger als bisher.
- Beim Gegnerzug springt die Karte nicht mehr vorzeitig zur eigenen Einheit – Gegnerzüge im aktuellen Ausschnitt blieben
  sonst ungesehen.

**Fenster und Menü**

- **Einstellungen** im eigenen Fenster, nach Ton, Anzeige, Spielablauf, Steuerung und Schummeln geordnet, mit einem
  erklärenden Satz je Einstellung. Das ☰ Menü ist wieder kurz und hat einen Eintrag „Kräfteverhältnis“.
- **Spielstände** nach Partie gruppiert (Welt, Größe, Stufe, Kartennummer), die laufende oben; kompakte Zeilen, Suche ab
  sieben Spielständen, ganze Partie löschen.
- **Statistik:** Welt und Kartennummer stehen vorn.

**Speichern**

- Das Spiel speichert jetzt **nach jedem Zug** und beim Schließen der Seite – nach dem Neuladen geht es genau dort weiter.
  Ein verlorener Kampf lässt sich damit nicht mehr durch Neuladen wiederholen.
- **Strg+S** (Mac ⌘+S) öffnet die Spielstände; nochmals drücken oder Enter speichert.

**Tasten**

- Die Taste K (Klangtest) entfällt; N wirkt auch in der Produktionsansicht; das Handbuch nennt alle Tasten vollständig.
- Neue Spieler sehen die Tastenlegende über der Karte von Anfang an (wegklicken wird gemerkt).

**Online als App**

- Die Online-Version lässt sich in Chrome und Edge als App installieren (eigenes Fenster, Symbol im Startmenü) und startet
  danach auch ohne Internet. Die Offline-Fassung bleibt, wie sie ist.

*English:* a calmer screen and tidier windows. A new setting “Replay of moves” (slow, normal, fast, off) controls all movement
and camera pans – “off” shows no movement at all, and it is the default if your system asks for reduced motion. Settings
have their own window, saved games are grouped by game, the game saves after every move, and Ctrl+S opens the saved games.
The online version can be installed as an app in Chrome and Edge.

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
