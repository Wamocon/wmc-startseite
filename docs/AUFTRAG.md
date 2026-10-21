# Auftrag: Browser-Startseite WMC & WMA

| | |
|---|---|
| Jira | WMCNL-2781 |
| Auftraggeber | Erwin Moretz, IT |
| Ausführung | Gregor, KI-Mitarbeiter Entwicklung |
| Prüfung | Claude; danach Abnahme durch Erwin |
| Zweig | `gregor/startseite` |

## Ziel

Alle Mitarbeitenden der WAMOCON GmbH (WMC) und der WAMOCON Academy GmbH (WMA) bekommen im Browser dieselbe Startseite mit allen wichtigen Links. Die IT pflegt die Links in einer Datei auf dem Server; eine Änderung ist beim nächsten Öffnen bei allen sichtbar. Jede Person legt sich aus den Links eigene Favoriten an, die im Browser gespeichert werden.

## Was im Repo schon liegt

| Pfad | Inhalt |
|---|---|
| `docs/ANFORDERUNGEN.md` | Was gebaut wird, mit IDs (F, N, V, B, T, P). Maßgeblich. |
| `docs/DESIGN.md`, `docs/design/*.png` | Wie es aussieht: Farben, Maße, Zustände, Screenshots |
| `schema/links.schema.json` | Format der Linkliste |
| `daten/beispiel/links.json` | Beispiel-Linkliste mit Platzhalter-Links |
| `site/assets/` | Logos und Schrift Inter (Lizenz OFL) |
| `docs/UEBERGABE.md` | Vorlage für deine Übergabe |

## Was du lieferst

| Pfad | Inhalt |
|---|---|
| `site/index.html`, `site/styles.css`, `site/app.js` | die Seite |
| `scripts/pruefe_links.py` | Prüfskript für die Linkliste |
| `tests/` | Unit-Tests für das Prüfskript |
| `nginx/` | nginx-Konfiguration |
| `Dockerfile`, `docker-compose.yml` | Betrieb |
| `README.md` | ersetzt die jetzige README |
| `docs/UEBERGABE.md` | ausgefüllt |
| `.dockerignore` | optional |

## Vorgehen

1. Lies `docs/ANFORDERUNGEN.md` und `docs/DESIGN.md` vollständig.
2. Lege den Zweig an: `git switch -c gregor/startseite`.
3. Baue `scripts/pruefe_links.py` und die Tests in `tests/` (V-01 bis V-10, T-01). Commit.
4. Baue `site/index.html` und `site/styles.css` nach DESIGN.md: Kopf, Begrüßung, Suche, die beiden Abschnitte, Fuß. Commit.
5. Baue `site/app.js`: Laden, Karten, Suche, Favoriten, Speichern, Fehlerzustand. Gern in mehreren Commits.
6. Baue `nginx/`, `Dockerfile` und `docker-compose.yml` (B-01 bis B-03). Commit.
7. Prüfe selbst:
   - `python3 -m unittest discover -s tests`
   - `python3 scripts/pruefe_links.py daten/beispiel/links.json` muss „OK: 6 Bereiche, 20 Links“ ausgeben.
   - Seite lokal öffnen: `mkdir -p site/daten && cp daten/beispiel/links.json site/daten/ && python3 -m http.server 8000 -d site`, dann http://localhost:8000/ (der Ordner `site/daten/` ist per `.gitignore` ausgeschlossen).
   - Alle Zustände aus `docs/design/` nachstellen, auch 360 px Breite und eine kaputte `links.json`.
   - Wenn Docker verfügbar ist: `docker compose up -d --build`, dann `curl -I http://localhost:8080/` und `curl -I http://localhost:8080/daten/links.json`. Die Ausgaben kommen in die Übergabe.
8. Schreibe `README.md` (B-04) und fülle `docs/UEBERGABE.md` aus. Commit.
9. Melde Erwin: „WMCNL-2781 fertig, Zweig gregor/startseite, letzter Commit HASH“.

## Regeln

- Ändere die Dateien aus P-03 nicht. Fehlt dir dort etwas oder ist etwas falsch, frag nach.
- Für die Seite gibt es keine Bibliotheken, kein npm und keinen Build-Schritt. Python nur mit Standardbibliothek.
- Die Seite lädt nichts von fremden Servern.
- Erfinde keine Firmenlinks; die Beispieldaten bleiben, wie sie sind.
- Keine Passwörter, Schlüssel oder Zugangsdaten ins Repo.
- Fehlt ein Werkzeug (z. B. Docker oder ein Browser), umgehe das nicht, sondern schreib es in die Übergabe.

## Rückfragen

Bei Widerspruch oder Lücke: erst in ANFORDERUNGEN.md und DESIGN.md nachsehen. Bleibt es unklar, schick Erwin eine Frage mit ID, kurzem Zitat und deinem Vorschlag. Arbeite bis zur Antwort mit deinem Vorschlag weiter und trag ihn in der Übergabe unter „Annahmen“ ein.

## Fertig, wenn

- [ ] Jede ID steht in `docs/UEBERGABE.md` mit Stand (erfüllt, teilweise, nicht erfüllt) und Nachweis.
- [ ] `python3 -m unittest discover -s tests` ist grün.
- [ ] Das Prüfskript meldet für die Beispieldatei „OK: 6 Bereiche, 20 Links“.
- [ ] Die Seite ist lokal geprüft: Startzustand, Suche, kein Treffer, Escape, Bearbeiten, leere Favoriten, Fehlerzustand, 360 px.
- [ ] Alles ist auf `gregor/startseite` committet; `main` ist unverändert.

## Wie geprüft wird

Claude prüft jede ID automatisch im Browser, am HTTP-Verhalten der nginx-Konfiguration und am Code, dazu Zweig, Commits und geschützte Dateien. Was sich nicht automatisch prüfen lässt, sieht sich Claude an. Die Abnahme macht Erwin.
