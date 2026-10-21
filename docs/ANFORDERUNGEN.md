# Anforderungen: Browser-Startseite WMC & WMA

Stand 21.10.2026 · Jira WMCNL-2781 · Gestaltung: [DESIGN.md](DESIGN.md)

Jede Anforderung hat eine ID. In `docs/UEBERGABE.md` meldest du zu jeder ID den Stand. Texte in „Anführungszeichen“ sind wörtlich so zu übernehmen.

## 1 Daten

**F-01 Linkliste laden.** Die Seite lädt beim Start `daten/links.json` (relativer Pfad, gleicher Server). Bereiche und Links erscheinen in der Reihenfolge der Datei. Das Format ist in `schema/links.schema.json` festgelegt; die Beispieldatei liegt unter `daten/beispiel/links.json`.

**F-02 Fehlerzustand.** Lässt sich `daten/links.json` nicht laden (HTTP-Fehler, Netzfehler) oder ist sie kein gültiges JSON, zeigt die Seite statt der Abschnitte „Meine Favoriten“ und „Alle Links“ ein Element mit `role="alert"` und dem Text „Die Linkliste konnte nicht geladen werden. Bitte wenden Sie sich an die IT.“ In der Browserkonsole darf dabei kein unbehandelter Fehler auftreten.

**F-03 Sichere Ausgabe.** Alle Texte aus `links.json` werden als Text eingesetzt (`textContent`, `createElement`), nie als HTML. `innerHTML`, `outerHTML`, `insertAdjacentHTML` und `document.write` werden für Inhalte aus der Datei nicht verwendet. Ein Link, dessen `url` nicht mit `https://` oder `http://` beginnt, wird nicht angezeigt.

**F-04 Kürzel.** Jeder Link hat ein Kürzelfeld (siehe DESIGN.md). Inhalt ist `kuerzel` aus der Datei. Fehlt das Feld, gelten die ersten zwei Buchstaben des Namens in Großbuchstaben (Beispiel: „SharePoint“ → „SH“, „wamocon.com“ → „WA“). Ziffern und Satzzeichen werden dabei übersprungen.

## 2 Kopf und Begrüßung

**F-10 Kopf.** Links das WMC-Logo (`assets/logo-wmc.png`, `alt="WAMOCON IT-Testmanagement"`, Höhe 48 px), ein senkrechter Trennstrich, dann das WMA-Logo (`assets/logo-wma.png`, `alt="WAMOCON Academy IT-Bildungszentrum"`, Höhe 45 px). Unter dem Kopf eine 4 px breite rote Linie. Kein Name, keine Anmeldung, keine weiteren Elemente im Kopf.

**F-11 Begrüßung.** Eine `h1` über dem Suchfeld, abhängig von der Uhrzeit des Browsers beim Laden: 05:00–10:59 „Guten Morgen“, 11:00–17:59 „Guten Tag“, sonst „Guten Abend“. Es gibt genau eine `h1` auf der Seite.

## 3 Suche

**F-20 Suchfeld.** Ein `<input type="search">` mit sichtbarem Platzhalter „Anwendung oder Link suchen“ und einem zugeordneten `<label>` mit demselben Text (darf visuell verborgen sein).

**F-21 Filtern.** Bei jeder Eingabe werden die Karten unter „Alle Links“ gefiltert. Ein Link passt, wenn der Suchtext in `name` oder `beschreibung` vorkommt; Groß- und Kleinschreibung zählt nicht, Leerzeichen am Anfang und Ende werden ignoriert. Karten ohne passenden Link werden ganz ausgeblendet. Leeres Suchfeld zeigt alles.

**F-22 Infozeile.** Rechts neben der Überschrift „Alle Links“ steht ohne Suche „Zentral gepflegt von der IT · Stand TT.MM.JJJJ“ (Datum aus `stand`, z. B. „Stand 21.10.2026“). Mit Suche steht dort „N Treffer für „SUCHTEXT““, z. B. „1 Treffer für „jira““. SUCHTEXT ist die Eingabe ohne Leerzeichen am Rand.

**F-23 Kein Treffer.** Passt kein Link, erscheint „Kein Treffer für „SUCHTEXT“. Fehlt ein Link?“ und dahinter ein Link mit dem Text aus `hilfe.name` auf `hilfe.url`.

**F-24 Escape.** Die Taste Escape im Suchfeld leert die Suche und zeigt wieder alles.

**F-25 Favoriten bleiben stehen.** Die Suche filtert nur „Alle Links“, nie die Favoriten.

## 4 Favoriten

**F-30 Favoritenleiste.** Abschnitt mit `h2` „Meine Favoriten“. Darunter je Favorit eine Kachel (Kürzel und Name) als ein Link auf die URL des Links, in der gespeicherten Reihenfolge. Als letzte Kachel immer „Hinzufügen“: ein Link auf `#alle-links`.

**F-31 Stern.** Jeder Link in „Alle Links“ hat rechts einen `<button type="button">` mit `aria-label="Favorit: NAME"` und `aria-pressed="true"` bzw. `"false"`. Ein Klick nimmt den Link in die Favoriten auf (ans Ende) oder entfernt ihn. Leiste, Stern und Speicher sind danach sofort aktuell.

**F-32 Bearbeiten.** Rechts neben „Meine Favoriten“ steht ein Button „Bearbeiten“. Er schaltet den Bearbeiten-Modus ein; dann heißt er „Fertig“ und schaltet wieder aus. Im Modus hat jede Favoritenkachel oben rechts einen Button mit `aria-label="Aus Favoriten entfernen: NAME"`, und unter den Kacheln steht „Mit dem Kreuz entfernen Sie einen Favoriten. Neue Favoriten markieren Sie unten mit dem Stern.“

**F-33 Leere Favoriten.** Gibt es keine Favoriten, steht vor der Kachel „Hinzufügen“ der Hinweis „Noch keine Favoriten. Markieren Sie unten einen Link mit dem Stern.“

**F-34 Speichern.** Die Auswahl liegt im `localStorage` unter dem Schlüssel `wmc-startseite.favoriten` als JSON-Array von Link-IDs, z. B. `["outlook","jira"]`. Regeln:
- Fehlt der Schlüssel, gelten die `standardFavoriten` aus `links.json`.
- Ein leeres Array ist eine gültige Auswahl und wird nicht durch die Standardfavoriten ersetzt.
- IDs, die es in `links.json` nicht mehr gibt, werden ohne Fehlermeldung übergangen.
- Ist der gespeicherte Wert kein Array aus Zeichenketten, gelten die Standardfavoriten.
- Wirft `localStorage` eine Ausnahme (z. B. gesperrt), funktioniert die Seite trotzdem; Änderungen gelten dann nur bis zum Neuladen.

## 5 Alle Links

**F-40 Bereichskarten.** Abschnitt mit `id="alle-links"` und `h2` „Alle Links“. Je Bereich eine Karte mit `h3` (`titel`) und einem Markenetikett: `wmc` → „WMC“, `wma` → „WMA“, `beide` → „WMC · WMA“. Bereiche mit `marke` `wma` erhalten die Academy-Optik (DESIGN.md).

**F-41 Linkzeile.** Jede Zeile zeigt Kürzel, Name und Beschreibung. Name und Beschreibung bilden zusammen einen Link auf `url`; rechts steht der Stern aus F-31.

**F-42 Gleicher Tab.** Alle Links öffnen im selben Tab (kein `target="_blank"`).

## 6 Fuß

**F-50 Fußzeile.** Links „Links gepflegt von der IT. Ihre Favoriten werden in diesem Browser gespeichert.“ Rechts „Link fehlt oder ist veraltet?“ und dahinter ein Link mit `hilfe.name` auf `hilfe.url`.

## 7 Qualität

**N-01 Technik.** Nur HTML, CSS und JavaScript, ohne Framework, ohne Build-Schritt, ohne Bibliotheken. Genau diese drei Dateien: `site/index.html`, `site/styles.css`, `site/app.js`. JavaScript als ES-Modul (`<script type="module" src="app.js">`).

**N-02 Keine fremden Server.** Die Seite lädt nichts von anderen Servern: Schrift aus `site/assets/fonts/` (per `@font-face`), Logos aus `site/assets/`, Symbole als SVG im Code. Kein `style="…"` im HTML und kein Inline-Skript, weil die Content-Security-Policy (B-03) beides sperrt.

**N-03 Barrierefreiheit.** WCAG 2.2 Stufe AA:
- Die Seite hat bei einer Prüfung mit axe-core keine Verstöße der Stufen „serious“ oder „critical“.
- Alle Bedienelemente sind mit der Tastatur erreichbar und haben einen sichtbaren Fokusrahmen (2 px `#B90808`, 2 px Abstand).
- Stern, Entfernen-Button und „Bearbeiten“ sind mindestens 44 × 44 px groß.
- `<html lang="de">`, aussagekräftiger `<title>` „Startseite WMC & WMA“.

**N-04 Mobil.** Bei 360 px Breite gibt es kein waagerechtes Scrollen; die Karten stehen dann untereinander.

**N-05 CI.** Nur die Farben, Schriftgrößen, Abstände und Radien aus DESIGN.md. Kein dunkles Thema (das CI hat noch keins).

## 8 Prüfskript für die Linkliste

`scripts/pruefe_links.py`, Aufruf `python3 scripts/pruefe_links.py DATEI`. Nur Python-Standardbibliothek (kein `jsonschema`). Es sammelt alle Fehler und bricht nicht beim ersten ab.

- **V-01** Datei ist lesbares UTF-8 und gültiges JSON.
- **V-02** Pflichtfelder, Typen und erlaubte Werte wie im Schema; unbekannte Felder sind Fehler.
- **V-03** `stand` ist ein echtes Kalenderdatum (2026-02-30 ist ein Fehler).
- **V-04** Bereichs-IDs sind eindeutig.
- **V-05** Link-IDs sind über alle Bereiche hinweg eindeutig.
- **V-06** Jede `url` (auch `hilfe.url`) beginnt mit `https://` oder `http://` und enthält keine Leerzeichen.
- **V-07** Jede ID in `standardFavoriten` gibt es als Link-ID.
- **V-08** Längen und Muster: `titel` und `name` höchstens 40 Zeichen, `beschreibung` höchstens 60, IDs wie im Schema, `kuerzel` 1 bis 3 Zeichen aus A–Z, Ä, Ö, Ü, 0–9.
- **V-09** Ausgabe: Ohne Fehler genau eine Zeile „OK: B Bereiche, L Links“ und Exit-Code 0. Mit Fehlern je Fehler eine Zeile „FEHLER: FUNDSTELLE: MELDUNG“ und Exit-Code 1. Die Fundstelle hat die Form `bereiche[2].links[0].url` (Zählung ab 0) bzw. `stand`, `hilfe.url`, `standardFavoriten[1]`. Fehlender Dateiname: Hinweis zum Aufruf und Exit-Code 2.
- **V-10** Fehlermeldungen auf Deutsch und so, dass die IT den Fehler ohne Hilfe findet.

## 9 Betrieb

**B-01 Container.** `Dockerfile` auf Basis eines offiziellen nginx-Images in fester Version (kein `latest`). Es kopiert `site/` nach `/usr/share/nginx/html/` und die nginx-Konfiguration aus `nginx/`. Der Build führt `pruefe_links.py` auf `daten/beispiel/links.json` aus und bricht ab, wenn die Prüfung fehlschlägt (z. B. mehrstufiger Build mit einem Python-Image).

**B-02 Compose.** `docker-compose.yml` mit dem Dienst `startseite`:
- Seite erreichbar unter `http://localhost:8080/`.
- Das **Verzeichnis** `${LINKS_VERZEICHNIS:-./daten/beispiel}` wird schreibgeschützt nach `/usr/share/nginx/html/daten` eingebunden. Ein Verzeichnis statt einer Einzeldatei, weil Editoren beim Speichern oft eine neue Datei anlegen und eine eingebundene Einzeldatei dann im Container veraltet.
- `restart: unless-stopped` und ein `healthcheck`, der die Startseite abruft.
- Auf dem Server legt die IT die echte Liste in ein eigenes Verzeichnis außerhalb des Repos und setzt `LINKS_VERZEICHNIS`. Die echte Liste kommt nie ins Repo.

**B-03 HTTP-Header** (nginx):
- `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Cache-Control: no-cache` für `/`, `/index.html`, `/app.js`, `/styles.css` und `/daten/links.json`, damit Änderungen beim nächsten Öffnen ankommen.
- Schriften und Logos unter `/assets/` dürfen bis zu 7 Tage gecacht werden.
- `server_tokens off;` und kein Verzeichnislisting.

**B-04 README.** `README.md` erklärt kurz: lokal starten, mit Docker betreiben, Links pflegen (Datei ändern → Prüfskript → fertig, kein Neustart nötig) und die Tests ausführen.

## 10 Tests

**T-01** Unit-Tests für `pruefe_links.py` in `tests/`, ausführbar mit `python3 -m unittest discover -s tests`, alle grün. Mindestens ein Test je Regel V-02 bis V-09.

**T-02** Kurzer Nachweis in `docs/UEBERGABE.md`, dass die Seite im Browser funktioniert (welche Schritte du geprüft hast, mit welchem Ergebnis). Browser-Tests sind erlaubt, aber keine Pflicht.

## 11 Ablauf

**P-01** Arbeite auf dem Zweig `gregor/startseite`, abgezweigt von `main`. `main` änderst du nicht.

**P-02** Kleine Commits mit deutschen Nachrichten nach dem Muster „Bereich: was“, z. B. „Suche: Filter und Infozeile“.

**P-03** Diese Dateien bleiben unverändert: `docs/AUFTRAG.md`, `docs/ANFORDERUNGEN.md`, `docs/DESIGN.md`, `docs/design/`, `schema/`, `daten/beispiel/links.json`, `site/assets/`, `AGENTS.md`, `CLAUDE.md`.

**P-04** `docs/UEBERGABE.md` ist ausgefüllt: Stand jeder ID, Nachweis, Abweichungen, offene Fragen.
