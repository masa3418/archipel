# Sicherheitsrichtlinie

*[English version below](#english)*

Archipel ist ein Hobbyprojekt: ein Browserspiel ohne Server, ohne Benutzerkonten und
ohne Datenbank. Alle Daten – auch die Spielstände – bleiben im Browser der Spielenden.
Trotzdem nehme ich Sicherheitsprobleme ernst und freue mich über Hinweise.

## Unterstützte Versionen

Unterstützt wird nur der aktuelle Stand des Branches `main` und damit die Online-Version
unter https://masa3418.github.io/archipel/. Ältere Stände erhalten keine Korrekturen.

| Version | Unterstützt |
|---|---|
| aktueller Stand von `main` | ja |
| ältere Commits | nein |

## Eine Sicherheitslücke melden

**Bitte melde Sicherheitslücken nicht über ein öffentliches Issue.**

Nutze stattdessen die vertrauliche Meldung von GitHub:
[Sicherheitslücke melden](https://github.com/masa3418/archipel/security/advisories/new)
(Reiter **Security → Report a vulnerability**).

Hilfreich sind:

- eine kurze Beschreibung des Problems und seiner Auswirkung,
- Schritte zum Nachstellen, z. B. ein präparierter Spielstand (`.json`),
- betroffener Browser und Version.

## Was als Sicherheitsproblem gilt

Zum Beispiel:

- Ein präparierter Spielstand, der beim Laden („Spielstände → Aus Datei laden“)
  Schadcode im Browser ausführt (Cross-Site-Scripting).
- Eingaben (etwa Spielstand-Namen), die ungefiltert als HTML dargestellt werden.
- Wege, über die das Spiel Daten aus dem Browser an Dritte überträgt.

Keine Sicherheitsprobleme im Sinne dieser Richtlinie sind z. B. Spielfehler,
Balancing-Fragen oder Manipulationen am eigenen Spielstand („Schummeln“) –
dafür gibt es die normalen [Issue-Vorlagen](https://github.com/masa3418/archipel/issues/new/choose).

## Wie es weitergeht

Da es sich um ein Freizeitprojekt handelt, gibt es keine festen Fristen. Ziel ist:

- eine erste Rückmeldung innerhalb von etwa **7 Tagen**,
- eine Korrektur, sobald das Problem nachvollzogen ist,
- auf Wunsch eine Nennung der meldenden Person, nachdem die Korrektur veröffentlicht ist.

Danke, dass du hilfst, Archipel sicher zu halten!

---

## English

Archipel is a hobby project: a browser game with no server, no user accounts and no database. All
data, including saved games, stays in the player's browser. Security issues are still taken seriously.

**Supported versions:** only the current state of the `main` branch, i.e. the online version at
https://masa3418.github.io/archipel/.

**Reporting a vulnerability:** please do **not** open a public issue. Use GitHub's private reporting
instead: [Report a vulnerability](https://github.com/masa3418/archipel/security/advisories/new)
(tab **Security → Report a vulnerability**). Helpful: a short description and its impact, steps to
reproduce (e.g. a crafted saved game `.json`), and the affected browser and version.

**In scope**, for example: a crafted saved game that runs code when loaded via "Saved games → Load from
file" (cross-site scripting), inputs such as saved-game names rendered as unfiltered HTML, or any way
the game sends browser data to third parties. **Not in scope:** gameplay bugs, balance questions or
editing your own saved game ("cheating") – please use the normal
[issue templates](https://github.com/masa3418/archipel/issues/new/choose) for those.

As this is a spare-time project there are no fixed deadlines. The aim is a first reply within about
**7 days**, a fix once the problem is understood, and credit for the reporter after the fix is
published, if desired.

Thanks for helping to keep Archipel safe!
