# Übergabe WMCNL-2781

Ausgefüllt von: Gregor · Datum: 21.10.2026 · Letzter Commit: siehe Meldung auf der Karte

## Zusammenfassung

Die Browser-Startseite für WMC und WMA ist komplett gebaut: Prüfskript mit Unit-Tests (grün, 30 Tests), die drei Seitendateien nach DESIGN.md, nginx-Konfiguration, Dockerfile und docker-compose.yml sowie die README. Das Prüfskript meldet für die Beispieldatei „OK: 6 Bereiche, 20 Links“. Die sechs Prüffehler F-21, F-22, F-32, F-02, B-03 und V-09 sind in A-0038 behoben (siehe „Nachbesserung A-0038“). Was ich wegen der Umgebung nicht testen konnte (Browser, HTTP-Server, Docker), ist in der Spalte „Stand“ mit „teilweise“ und in „Annahmen und Abweichungen“ ausgewiesen — das soll Erwin bei der Abnahme nachprüfen.

## Stand je Anforderung

Stand ist „erfüllt“, „teilweise“ oder „nicht erfüllt“. Nachweis: Datei und Stelle, Testname oder kurze Beschreibung, wie du es geprüft hast.

| ID | Stand | Nachweis / Hinweis |
|---|---|---|
| F-01 | erfüllt | `site/app.js`: `lade()` ruft `fetch("daten/links.json")` auf; Bereiche und Links werden in Dateireihenfolge gerendert (`renderBereiche`). |
| F-02 | teilweise | `site/app.js`: `fehlerAnzeigen()` versteckt beide Abschnitte (`favoritenAbschnitt.hidden = true`, `alleLinksKopf.hidden = true`, `BereichsContainer.hidden = true`) und zeigt den Kasten mit `role="alert"`; `fetch` ist in `try/catch`, kein unbehandelter Fehler. Nachbesserung A-0038 und A-0077 (Alle-Links-Kopf ausblenden). Nicht im Browser geprüft. |
| F-03 | erfüllt | `site/app.js`: nur `textContent` und `createElement`; kein `innerHTML`/`document.write`. `urlIstGueltig()` filtert Links ohne `http(s)://`. |
| F-04 | erfüllt | `site/app.js`: `kuerzelFormen()` nimmt die ersten zwei Buchstaben, überspringt Ziffern/Satzzeichen, macht Großbuchstaben. |
| F-10 | erfüllt | `site/index.html`: WMC-Logo (48 px, `alt="WAMOCON IT-Testmanagement"`), Trennstrich, WMA-Logo (45 px, `alt="WAMOCON Academy IT-Bildungszentrum"`); 4-px-Linie in `site/styles.css` (`.kopf`). |
| F-11 | erfüllt | `site/app.js`: `begruesungText()` nach Uhrzeit; genau eine `h1` in `site/index.html`. |
| F-20 | erfüllt | `site/index.html`: `<input type="search">` mit Platzhalter und zugeordnetem, visuell verstecktem `<label>`. |
| F-21 | teilweise | `site/app.js`: `renderSuche()`/`linkPasst()` filtern bei jeder Eingabe, groß/klein egal, nicht passende Zeilen und Karten ohne Treffer `hidden`. Nachbesserung A-0038 (Logik) und A-0077 (CSS: `[hidden]`-Regeln für `.linkzeile`, `.stern`, `.karten-raster`). Nicht im Browser geprüft. |
| F-22 | teilweise | `site/app.js`: `renderSuche()` setzt die Infozeile; `trefferAnzahl()` zählt die Links aus `linksById` (eine Zahl je Link) — Nachbesserung A-0038 (vorher: doppelte Zählung über DOM-Elemente). Logik nachgeprüft; nicht im Browser geprüft. |
| F-23 | erfüllt | `site/app.js`: `keinTreffer`-Block mit `hilfe.name`/`hilfe.url`. |
| F-24 | erfüllt | `site/app.js`: `keydown`-Listener auf `Escape` leert die Suche. |
| F-25 | erfüllt | `site/app.js`: Suche filtert nur `#bereiche`, nie die Favoriten. |
| F-30 | erfüllt | `site/app.js`: `renderFavoriten()` baut die Kacheln plus „Hinzufügen“ auf `#alle-links`. |
| F-31 | erfüllt | `site/app.js`: Stern-Button mit `aria-label="Favorit: NAME"` und `aria-pressed`; Klick nimmt auf oder entfernt. |
| F-32 | teilweise | `site/app.js`: Bearbeiten-Button schaltet `bearbeitenModus`; Entfernen-Button ruft `preventDefault()` und `stopPropagation()` auf, damit der Kachel-Link nicht geöffnet wird (Nachbesserung A-0038); das Kreuz trägt jetzt die Klasse `kreuz` und ist sichtbar (weiß auf `#140B0B`, 12 px, nach DESIGN.md). Nicht im Browser geprüft (kein Browser verfügbar). |
| F-33 | erfüllt | `site/app.js`: bei leeren Favoriten Hinweis vor „Hinzufügen“. |
| F-34 | teilweise | `site/app.js`: `speicherLesen`/`speicherSchreiben` mit allen Regeln (Standardfavoriten, leeres Array, unbekannte IDs, gesperrtes localStorage). Nicht im Browser geprüft (keine echte `localStorage`-Umgebung). |
| F-40 | erfüllt | `site/app.js`: `karteErstellen()` mit `h3`, Markenetikett (WMC/WMA/WMC·WMA) und Academy-Optik (`marke` `wma`). |
| F-41 | erfüllt | `site/app.js`: Linkzeile mit Kürzel, Name, Beschreibung (Name+Beschreibung als Link) und Stern. |
| F-42 | erfüllt | `site/app.js`: keine `target="_blank"`; Links öffnen im selben Tab. |
| F-50 | erfüllt | `site/index.html`: Fuß mit Text und `hilfe`-Link; `site/app.js` füllt `hilfe` ein. |
| N-01 | erfüllt | Genau `site/index.html`, `site/styles.css`, `site/app.js`; ES-Modul in `index.html`. |
| N-02 | erfüllt | Schrift aus `site/assets/fonts/`, Logos aus `site/assets/`, SVG im Code; kein `style="…"` im HTML, kein Inline-Skript. |
| N-03 | teilweise | `lang="de"`, `title`, Fokusrahmen, 44-px-Buttons umgesetzt. axe-core-Prüfung nicht ausgeführt (kein Browser). |
| N-04 | teilweise | 360-px-Regeln in `site/styles.css` (Media-Query, einspaltig, `max-width:100%`). Visuell nicht bei 360 px geprüft (kein Browser). |
| N-05 | erfüllt | Nur Farben/Größen/Abstände aus DESIGN.md; kein dunkles Thema. |
| V-01 | erfüllt | `scripts/pruefe_links.py`: UTF-8 + JSON lesen, fehlende Datei, ungültiges JSON, fehlender Dateiname (Exit-Codes 1/2). Test `TestV01`. |
| V-02 | erfüllt | Pflichtfelder, Typen, erlaubte Werte, unbekannte Felder. Test `TestV02`. |
| V-03 | erfüllt | Echtes Kalenderdatum (2026-02-30 ist Fehler). Test `TestV03`. |
| V-04 | erfüllt | Bereichs-IDs eindeutig. Test `TestV04`. |
| V-05 | erfüllt | Link-IDs über alle Bereiche eindeutig. Test `TestV05`. |
| V-06 | erfüllt | `http(s)://` und keine Leerzeichen (auch `hilfe.url`). Test `TestV06`. |
| V-07 | erfüllt | `standardFavoriten` referenzieren existente Link-IDs. Test `TestV07`. |
| V-08 | erfüllt | Längen und Muster (ID, Name, Beschreibung, Kürzel). Test `TestV08`. |
| V-09 | erfüllt | Ausgabe „OK: B Bereiche, L Links“ (Exit 0), Fehlerzeilen „FEHLER: …“ (Exit 1), Fundstellen. Nachbesserung A-0038: doppelte Bereichs- und Link-IDs nennen jetzt die Stelle (`bereiche[1].id`, `bereiche[1].links[0].id`), nicht nur „bereiche“. Tests `TestV09.test_doppelte_bereichs_id_weist_die_stelle_aus` und `TestV09.test_doppelte_link_id_weist_alle_stellen_aus`. |
| V-10 | erfüllt | Fehlermeldungen auf Deutsch, beschreiben den Grund. Test `TestV10`. |
| B-01 | teilweise | `Dockerfile` (nginx 1.27.3-alpine, mehrstufig, Prüfskript im Build). Build nicht ausgeführt (kein Docker). |
| B-02 | teilweise | `docker-compose.yml` (Port 8080, `LINKS_VERZEICHNIS`-Verzeichnis `:ro`, `restart`, `healthcheck`). Nicht gestartet (kein Docker). |
| B-03 | teilweise | `nginx/startseite.conf`: CSP, `nosniff`, `no-referrer`, `no-cache` für Seite/links.json, 7 Tage für `/assets/`, `server_tokens off`, kein Listing. Nachbesserung A-0038: die drei Sicherheitsheader standen nur im `server`-Block, die `location`-Blocks überschrieben sie — jetzt stehen sie in jedem `location`-Block. Nicht per `curl` geprüft (kein Docker). |
| B-04 | erfüllt | `README.md` (lokal starten, Docker, Links pflegen, Tests). |
| T-01 | erfüllt | `tests/test_pruefe_links.py`, 30 Tests, alle grün (`python3 -m unittest discover -s tests`). |
| T-02 | teilweise | Browser-Nachweis nicht möglich (kein Browser verfügbar); Code-Pfade sind oben je ID nachgewiesen. |
| P-01 | erfüllt | Zweig `gregor/startseite` ab `main`; `main` unverändert. |
| P-02 | erfüllt | Kleine Commits, deutsche Nachrichten „Bereich: was“. |
| P-03 | erfüllt | Geschützte Dateien (`docs/AUFTRAG.md`, `ANFORDERUNGEN.md`, `DESIGN.md`, `docs/design/`, `schema/`, `daten/beispiel/links.json`, `site/assets/`, `AGENTS.md`, `CLAUDE.md`) nicht angefasst. |
| P-04 | erfüllt | Diese Datei, jede ID mit Stand und Nachweis. |

## Nachbesserung A-0038

Die Prüfung der A-0037 hat sechs Fehler gefunden; alle sind behoben, je Punkt ein Commit nach „Bereich: was“.

| Fehler | Was vorher | Was jetzt | Wie geprüft |
|---|---|---|---|
| F-21 | Bei einer Suche blieben nicht passende Links in sichtbaren Karten (z. B. „jira“ → Confluence, Testmanagement) | `renderSuche()` setzt `element.hidden` je Zeile und `karte.hidden`, wenn keine Zeile passt | Logik nachgeprüft in `site/app.js`; nicht im Browser geprüft → teilweise |
| F-22 | Trefferzahl doppelt so hoch (DOM-Elemente statt Links gezählt) | `trefferAnzahl()` zählt die Links aus `linksById`; `renderSuche()` zählt vor dem Filtern | Logik nachgeprüft; „jira“ → 1 Treffer; nicht im Browser geprüft → teilweise |
| F-32 | Klick auf das Kreuz öffnete den Kachel-Link; Kreuz unsichtbar (schwarzer Kreis ohne weißes Kreuz) | `entfernenButton()` ruft `preventDefault()` und `stopPropagation()` auf; `svgKreuz()` trägt die Klasse `kreuz` (weiß, 12 px, Strich 1,8) | Logik nachgeprüft; Kreuz nach DESIGN.md (Kreis 22 px `#140B0B`, Kreuz 12 px weiß); nicht im Browser geprüft → teilweise |
| F-02 | „Meine Favoriten“ blieb mit „Favoriten werden geladen …“ stehen | `fehlerAnzeigen()` setzt `favoritenAbschnitt.hidden = true`, beide Abschnitte verschwinden, Kasten mit `role="alert"` erscheint | Logik nachgeprüft; nicht im Browser geprüft → teilweise |
| B-03 | Sicherheitsheader kamen bei echten Dateien nicht an (nur 404) | CSP, `X-Content-Type-Options`, `Referrer-Policy` in jedem `location`-Block wiederholt | `nginx/startseite.conf` nachgelesen; nginx vererbt `add_header` nur, wenn der `location`-Block keine eigenen hat; nicht per `curl` geprüft (kein Docker) → teilweise |
| V-09 | Doppelte IDs: Fundstelle nur „bereiche“ | `bereich_ids`/`link_ids` tragen jetzt (Wert, Fundstelle); Meldungen nennen `bereiche[1].id` bzw. `bereiche[0].links[0].id` und `bereiche[1].links[0].id` | Neue Unit-Tests `TestV09.test_doppelte_bereichs_id_weist_die_stelle_aus` und `TestV09.test_doppelte_link_id_weist_alle_stellen_aus`; `python3 -m unittest discover -s tests` → 30 Tests, alle grün |

## Fokus beim Laden (A-0040)

Beim Laden der Seite steht der Cursor im Suchfeld, damit man sofort tippen kann.

| Was vorher | Was jetzt | Wie geprüft |
|---|---|---|
| Das Suchfeld hatte nach dem Laden keinen Fokus | `lade()` ruft am Ende `suchfeld.focus({ preventScroll: true })` auf, sobald die Daten geladen sind | Logik in `site/app.js` nachgeprüft; `node --check site/app.js` → keine Syntaxfehler; 30 Unit-Tests grün. Nicht im Browser geprüft (kein Browser verfügbar). |

## Nachbesserung A-0077 (F-21 und F-02)

Die Prüfung im Browser (Werkbank, 27.10.2026) hat zwei Fehler gefunden.

| Fehler | Ursache | Was jetzt | Wie geprüft |
|---|---|---|---|
| F-21 | `renderSuche()` setzt `hidden` an den Linkzeilen, aber die CSS-Regel `.linkzeile { display: flex; }` hebt das Attribut wieder auf; dasselbe für `.stern` und `.karten-raster` | `[hidden] { display: none; }`-Regeln für `.linkzeile`, `.stern`, `.karten-raster` und `.abschnitts-kopf` ergänzt | `node --check site/app.js` → keine Syntaxfehler; 30 Unit-Tests grün; Logik in `site/styles.css` nachgeprüft. Nicht im Browser geprüft (kein Browser verfügbar) → teilweise. |
| F-02 | Im Fehlerzustand blieb die Überschrift „Alle Links“ samt Infozeile über dem Fehlerkasten sichtbar | `fehlerAnzeigen()` setzt jetzt auch `alleLinksKopf.hidden = true`; die `.abschnitts-kopf[hidden]`-Regel in `site/styles.css` blendet sie aus | `node --check site/app.js` → keine Syntaxfehler; 30 Unit-Tests grün; Logik in `site/app.js` und `site/index.html` nachgeprüft. Nicht im Browser geprüft (kein Browser verfügbar) → teilweise. |

## Wie getestet

- `python3 -m unittest discover -s tests` → 30 Tests, alle grün (28 aus A-0037 + 2 neue aus A-0038).
- `python3 scripts/pruefe_links.py daten/beispiel/links.json` → `OK: 6 Bereiche, 20 Links` (Exit 0).
- `node --check site/app.js` → keine Syntaxfehler.
- `git status` auf `gregor/startseite` → Arbeitsverzeichnis sauber; `main` unverändert.
- Nicht möglich (Umgebung): Browser (F-21, F-22, F-32, F-02: Kachel-Klick, Suche, Fehlerzustand), `python3 -m http.server`, `docker compose up -d --build` und `curl -I` für B-03. Dafür kein Werkzeug vorhanden; die betroffenen IDs sind als „teilweise“ markiert.

## Annahmen und Abweichungen

- **Browser und HTTP-Server waren nicht verfügbar.** Die Seite konnte nicht geöffnet, geklickt oder bei 360 px geprüft werden; auch `axe-core` lief nicht. Die betroffenen IDs sind als „teilweise“ markiert (F-02, F-21, F-22, F-32, F-34, N-03, N-04, T-02). Das ist kein Hinweis auf einen Fehler, sondern auf fehlende Prüfmöglichkeit — Erwin prüft diese Punkte bei der Abnahme.
- **Docker war nicht verfügbar.** `Dockerfile`, `docker-compose.yml` und `nginx/startseite.conf` sind geschrieben, aber nicht gebaut/geprüft (B-01 bis B-03).
- **Kürzel-Fall (F-04).** Bei fehlendem `kuerzel` nimmt die Seite die ersten zwei Buchstaben des Namens und überspringt Ziffern und Satzzeichen (Beispiel „wamocon.com“ → „WA“). Damit sind beide Beispiele aus F-04 abgedeckt.
- **Trefferzahl (F-22).** „N Treffer“ zählt die Links aus `links.json`, die auf den Suchtext passen (ein Link = ein Treffer, unabhängig davon, in wie vielen DOM-Elementen er vorkommt).

## Offene Fragen

- Keine. Bei Abweichungen zwischen `ANFORDERUNGEN.md` und `DESIGN.md` habe ich die Anforderungen als Maßstab genommen.

## Hinweise für den Betrieb

- Echte Linkliste: JSON im Format `schema/links.schema.json`, liegt außerhalb des Repos. `LINKS_VERZEICHNIS` auf das Verzeichnis setzen, das die Datei enthält (die Datei heißt dort `links.json`).
- Nach einer Dateiänderung reicht das Prüfskript: `python3 scripts/pruefe_links.py <Pfad>/links.json`. Ist das Verzeichnis eingebunden, ist die Änderung beim nächsten Öffnen sichtbar, ohne Neustart.
- Die Seite lädt nichts von fremden Servern; CSP und Header wie in B-03.
