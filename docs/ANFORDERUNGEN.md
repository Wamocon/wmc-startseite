# Anforderungen: Browser-Startseite WMC & WMA

Stand 03.11.2026 · Jira WMCNL-2781 · Gestaltung: [DESIGN.md](DESIGN.md)

Am 28.10.2026 neu oder geändert (Erwin, Auftrag A-0100): F-02, F-11, F-12, F-13, F-14, F-50, V-11 bis V-15, T-01, B-01, B-03, B-04. Wo eine dieser Anforderungen Gestaltung nennt, gilt sie zusätzlich zu DESIGN.md.

Am 29.10.2026 klarer gefasst (Erwin, Entscheidung vom 22.10.): F-04, Ziffern zählen im Kürzel mit, wie die Seite es seit dem 22.10. macht.

Am 03.11.2026 ergänzt (Erwin): Abschnitt 12 Admin-Ansicht mit L-01 bis L-15, dazu B-05 und T-03. Freigegeben am 29.10.2026, bis dahin nur in den Aufträgen A-0104 und A-0105. Außer L-01 und L-13 stehen sie in der Fassung der neuen Pflegeansicht, die Erwin am 02.11.2026 freigegeben hat.

Jede Anforderung hat eine ID. In `docs/UEBERGABE.md` meldest du zu jeder ID den Stand. Texte in „Anführungszeichen“ sind wörtlich so zu übernehmen.

## 1 Daten

**F-01 Linkliste laden.** Die Seite lädt beim Start `daten/links.json` (relativer Pfad, gleicher Server). Bereiche und Links erscheinen in der Reihenfolge der Datei. Das Format ist in `schema/links.schema.json` festgelegt; die Beispieldatei liegt unter `daten/beispiel/links.json`.

**F-02 Fehlerzustand.** Lässt sich `daten/links.json` nicht laden (HTTP-Fehler, Netzfehler) oder ist sie kein gültiges JSON, zeigt die Seite statt der Abschnitte „Meine Favoriten“ und „Alle Links“ ein Element mit `role="alert"` und dem Text „Die Linkliste konnte nicht geladen werden. Bitte wenden Sie sich an die IT.“ In der Browserkonsole darf dabei kein unbehandelter Fehler auftreten. Im Fehlerzustand bewirkt eine Eingabe ins Suchfeld nichts: „Kein Treffer“ erscheint nicht, unter der Suche steht weiter nur der Fehlerkasten.

**F-03 Sichere Ausgabe.** Alle Texte aus `links.json` werden als Text eingesetzt (`textContent`, `createElement`), nie als HTML. `innerHTML`, `outerHTML`, `insertAdjacentHTML` und `document.write` werden für Inhalte aus der Datei nicht verwendet. Ein Link, dessen `url` nicht mit `https://` oder `http://` beginnt, wird nicht angezeigt.

**F-04 Kürzel.** Jeder Link hat ein Kürzelfeld (siehe DESIGN.md). Inhalt ist `kuerzel` aus der Datei. Fehlt das Feld, gelten die ersten zwei Buchstaben oder Ziffern des Namens in Großbuchstaben (Beispiel: „SharePoint“ → „SH“, „wamocon.com“ → „WA“, „123Test“ → „12“). Satzzeichen und Leerzeichen werden dabei übersprungen.

## 2 Kopf und Begrüßung

**F-10 Kopf.** Links das WMC-Logo (`assets/logo-wmc.png`, `alt="WAMOCON IT-Testmanagement"`, Höhe 48 px), ein senkrechter Trennstrich, dann das WMA-Logo (`assets/logo-wma.png`, `alt="WAMOCON Academy IT-Bildungszentrum"`, Höhe 45 px). Unter dem Kopf eine 4 px breite rote Linie. Kein Name, keine Anmeldung, keine weiteren Elemente im Kopf.

**F-11 Begrüßung.** Eine `h1` über dem Suchfeld, abhängig von der Uhrzeit des Browsers beim Laden: 05:00–10:59 „Guten Morgen“, 11:00–17:59 „Guten Tag“, sonst „Guten Abend“. Ist ein Vorname gespeichert (F-14), folgen ein Komma, ein Leerzeichen und der Vorname, z. B. „Guten Morgen, Erwin“. Es gibt genau eine `h1` auf der Seite.

**F-12 Datum.** Über der `h1` ein Absatz mit dem heutigen Datum nach der Uhr des Browsers, Wochentag und Monat ausgeschrieben, z. B. „Mittwoch, 28. Oktober 2026“, so wie `Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })` es liefert. Gestaltung: 14 / 21 px, 400, `#5F3E3E`, zentriert, 8 px Abstand zur `h1`.

**F-13 Spruch des Tages.** Unter der `h1` ein Absatz mit einem Satz aus `daten/sprueche.json`. Format: `{"stand": "JJJJ-MM-TT", "sprueche": ["…", "…"]}`. Angezeigt wird der Satz an der Stelle t mod n, gezählt ab 0. n ist die Zahl der Sätze, t die Zahl der Kalendertage vom 01.01.2026 bis zum heutigen Datum des Browsers; am 01.01.2026 ist t = 0, davor ist t negativ und die Stelle ((t mod n) + n) mod n. Rechne t aus den Kalenderdaten, nicht aus der Ortszeit in Millisekunden, damit die Zeitumstellung den Satz nicht verschiebt. Die Seite lädt die Datei getrennt von `links.json`. Lässt sie sich nicht laden, ist sie kein gültiges JSON oder enthält sie keinen Satz, bleibt der Absatz verborgen; die Links erscheinen trotzdem, es gibt keinen Fehlerkasten und in der Konsole keinen unbehandelten Fehler. Der Satz wird als Text eingesetzt wie in F-03. Gestaltung: 16 / 24 px, 400, `#5F3E3E`, zentriert, 8 px Abstand zur `h1`; die 20 px bis zum Suchfeld bleiben.

**F-14 Vorname.** Fehlt im `localStorage` der Schlüssel `wmc-startseite.vorname`, steht zwischen `h1` und Spruch ein Formular mit dem sichtbaren Label „Wie dürfen wir Sie begrüßen?“, einem Textfeld mit dem Platzhalter „Vorname“ für höchstens 30 Zeichen und den Buttons „Speichern“ und „Ohne Namen“. „Speichern“ oder die Eingabetaste im Feld speichert den Text ohne Leerzeichen am Rand unter `wmc-startseite.vorname`, blendet das Formular aus und zeigt den Namen sofort in der `h1`; ein leerer Text gilt wie „Ohne Namen“. „Ohne Namen“ speichert eine leere Zeichenkette; die `h1` bleibt ohne Namen, und das Formular erscheint nicht wieder. Das Formular lädt die Seite nicht neu und schickt nichts ab. Der Vorname wird als Text eingesetzt wie in F-03. Wirft `localStorage` eine Ausnahme, gilt der Name bis zum Neuladen. Gestaltung: Label 14 / 21 px `#5F3E3E`, Textfeld 44 px hoch mit Rahmen 1 px `#956D6D` und Radius 8 px, Buttons wie „Bearbeiten“ in DESIGN.md; alles in einer Zeile, zentriert, unter 600 px umbrechend.

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

**F-50 Fußzeile.** Links „Links gepflegt von der IT. Ihre Favoriten und Ihr Vorname werden in diesem Browser gespeichert.“ und dahinter ein Button „Vorname ändern“. Er zeigt das Formular aus F-14 mit dem gespeicherten Vornamen im Feld und setzt den Fokus hinein. Rechts „Link fehlt oder ist veraltet?“ und dahinter ein Link mit `hilfe.name` auf `hilfe.url`.

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

**Prüfskript für die Sprüche.** `scripts/pruefe_sprueche.py`, Aufruf `python3 scripts/pruefe_sprueche.py DATEI`, nur Python-Standardbibliothek, sammelt alle Fehler und bricht nicht beim ersten ab.

- **V-11** Die Datei ist lesbares UTF-8 und gültiges JSON, ein Objekt mit genau den Feldern `stand` und `sprueche`.
- **V-12** `stand` ist ein echtes Kalenderdatum JJJJ-MM-TT.
- **V-13** `sprueche` ist eine Liste mit mindestens einem Eintrag; jeder ist eine Zeichenkette mit 1 bis 90 Zeichen ohne Leerzeichen am Anfang und Ende.
- **V-14** Kein Satz kommt zweimal vor.
- **V-15** Ausgabe wie V-09: ohne Fehler genau eine Zeile „OK: N Sprüche“ und Exit-Code 0; mit Fehlern je Fehler eine Zeile „FEHLER: FUNDSTELLE: MELDUNG“ mit Fundstellen wie `stand` oder `sprueche[3]` und Exit-Code 1; ohne Dateinamen ein Hinweis zum Aufruf und Exit-Code 2. Meldungen auf Deutsch.

## 9 Betrieb

**B-01 Container.** `Dockerfile` auf Basis eines offiziellen nginx-Images in fester Version (kein `latest`). Es kopiert `site/` nach `/usr/share/nginx/html/` und die nginx-Konfiguration aus `nginx/`. Der Build führt `pruefe_links.py` auf `daten/beispiel/links.json` aus und bricht ab, wenn die Prüfung fehlschlägt (z. B. mehrstufiger Build mit einem Python-Image). Der Build prüft auch `daten/beispiel/sprueche.json` mit `pruefe_sprueche.py` und bricht ab, wenn die Prüfung fehlschlägt.

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
- `Cache-Control: no-cache` auch für `/daten/sprueche.json`, dort mit denselben drei Sicherheitskopfzeilen wie bei `/daten/links.json`.
- Schriften und Logos unter `/assets/` dürfen bis zu 7 Tage gecacht werden.
- `server_tokens off;` und kein Verzeichnislisting.

**B-04 README.** `README.md` erklärt kurz: lokal starten, mit Docker betreiben, Links pflegen (Datei ändern → Prüfskript → fertig, kein Neustart nötig) und die Tests ausführen. Die README erklärt auch, wie man die Sprüche pflegt.

**B-05 Dienst zum Speichern.** Ein eigener Container aus `python:3.12-slim` mit einem Dienst nur aus der Standardbibliothek (`http.server`, `json`, `hashlib`, `hmac`, `secrets`). nginx leitet `/admin/api/` an ihn weiter und liefert `/admin` als statische Seite aus `site/admin/`. Nur dieser Container bindet `daten/` schreibend ein, dazu `sicherungen/`, `protokoll.jsonl` und die Passwortdatei. nginx liest `daten/` weiter nur (B-02). Der Container läuft mit `TZ: Europe/Berlin`.

## 10 Tests

**T-01** Unit-Tests für `pruefe_links.py` in `tests/`, ausführbar mit `python3 -m unittest discover -s tests`, alle grün. Mindestens ein Test je Regel V-02 bis V-09. Unit-Tests auch für `pruefe_sprueche.py`, mindestens einer je Regel V-11 bis V-15.

**T-02** Kurzer Nachweis in `docs/UEBERGABE.md`, dass die Seite im Browser funktioniert (welche Schritte du geprüft hast, mit welchem Ergebnis). Browser-Tests sind erlaubt, aber keine Pflicht.

**T-03 Tests.** Unit-Tests für den Dienst unter `tests/`: Anmeldung, Sperre nach Fehlversuchen, Prüfung beim Speichern, Sicherung, atomares Schreiben, Versionskonflikt, Protokoll, CSRF, Zurückholen einer Sicherung. Alle grün mit `python3 -m unittest discover -s tests`.

## 11 Ablauf

**P-01** Arbeite auf dem Zweig `gregor/startseite`, abgezweigt von `main`. `main` änderst du nicht.

**P-02** Kleine Commits mit deutschen Nachrichten nach dem Muster „Bereich: was“, z. B. „Suche: Filter und Infozeile“.

**P-03** Diese Dateien bleiben unverändert: `docs/AUFTRAG.md`, `docs/ANFORDERUNGEN.md`, `docs/DESIGN.md`, `docs/design/`, `schema/`, `daten/beispiel/links.json`, `site/assets/`, `AGENTS.md`, `CLAUDE.md`.

**P-04** `docs/UEBERGABE.md` ist ausgefüllt: Stand jeder ID, Nachweis, Abweichungen, offene Fragen.

## 12 Admin-Ansicht

Alle anderen Anforderungen gelten auch hier, besonders F-03, N-01 bis N-05 und B-01 bis B-05.

**L-01 Adresse.** Die Admin-Ansicht liegt unter `/admin` derselben Adresse wie die Startseite. In der Fußzeile der Startseite steht nach dem Text links ein Link „Links pflegen“ auf `/admin`.

**L-02 Anmeldung.** Ohne gültige Sitzung zeigt `/admin` nur ein Formular mit dem Feld „Passwort“ und dem Button „Anmelden“. Es gibt ein gemeinsames Passwort. Es steht weder im Repository noch in der Seite, sondern als Hash (PBKDF2-SHA256 aus der Standardbibliothek, mindestens 200 000 Runden, eigenes Salz) in einer Datei auf dem Server außerhalb von `daten/`. Gesetzt wird es mit `python3 admin/passwort_setzen.py DATEI`, das es zweimal verdeckt abfragt. Nach der Anmeldung gilt eine Sitzung 8 Stunden als Cookie mit `HttpOnly` und `SameSite=Strict`. „Abmelden“ beendet sie; gibt es ungespeicherte Änderungen, fragt es vorher im eigenen Fenster: „Nicht gespeicherte Änderungen gehen beim Abmelden verloren. Trotzdem abmelden?“ Nach 5 falschen Passwörtern in 10 Minuten nimmt der Dienst so lange keine Anmeldung an, wie `--sperre` sagt (Voreinstellung 10 Minuten), und sagt das. Läuft die Sitzung ab, zeigt „Speichern“ die Anmeldung mit „Die Sitzung ist abgelaufen. Bitte wieder anmelden; Ihre Änderungen bleiben erhalten.“ Nach der Anmeldung sind die Änderungen noch da.

**L-03 Übersicht.** Nach der Anmeldung zeigt die Ansicht alle Bereiche in der Reihenfolge der Datei, je Bereich Titel, Marke und die Links mit Kürzel, Name, Beschreibung und Adresse, je Link Symbole zum Ändern und Löschen, je Bereich „Link hinzufügen“. Unter 600 px steht die Adresse in eigener Zeile. Das Feld über der Liste filtert nach Name, Beschreibung, Adresse und Kürzel; beim Filtern sind die Griffe und „Link hinzufügen“ ausgeblendet.

**L-04 Link anlegen und ändern.** Ein Formular mit den Feldern Bereich, Name, Beschreibung, Adresse und Kürzel (freiwillig). Es steht in der Zeile des Links, der Fokus im Namen; ein Klick auf die Zeile öffnet es. Enter übernimmt, Esc bricht ab. Bei einem neuen Link hält „Anlegen und weiter“ die nächste leere Zeile bereit. Die Regeln aus V-02, V-06 und V-08 prüft es beim Verlassen jedes Feldes und zeigt die Meldung unter dem Feld, auf Deutsch. Ein neuer Link bekommt seine ID aus dem Namen (Kleinbuchstaben, Ziffern, Bindestrich, eindeutig, sonst mit Ziffer am Ende). Die ID eines bestehenden Links ändert sich nie, auch nicht mit dem Namen, weil die Favoriten der Nutzer an ihr hängen (F-34). Wird der Bereich geändert, wandert der Link ans Ende des neuen Bereichs.

**L-05 Link löschen.** Löschen fragt nicht nach. Der Link verschwindet aus der Liste, und ein Hinweis nennt ihn und bietet „Rückgängig“: „„NAME“ gelöscht.“, beim Standardfavoriten „„NAME“ gelöscht und aus den Standardfavoriten entfernt.“ In die Datei kommt das erst mit „Speichern“.

**L-06 Reihenfolge.** Links und Bereiche lassen sich am Griff ziehen und mit den Pfeiltasten verschieben; am Rand eines Bereichs wechselt ein Link in den Nachbarbereich. Auf Geräten ohne Maus stehen statt des Griffs Symbole zum Verschieben nach oben und nach unten.

**L-07 Bereiche.** Bereiche lassen sich anlegen (Titel, Marke), umbenennen und in der Marke ändern. Der Titel steht als Feld im Kopf des Bereichs und gilt beim Verlassen; ohne Titel bleibt der alte, und ein Hinweis sagt „Der Titel fehlt.“ Die Marke ist eine Auswahl aus WMC, WMA und WMC · WMA (`wmc`, `wma`, `beide`). „Bereich anlegen“ ist ein Formular und öffnet danach die Zeile für den ersten Link. Einen Bereich ohne Link nimmt „Speichern“ nicht an: „Der Bereich „TITEL“ braucht mindestens einen Link.“ Löschen geht nur bei einem leeren Bereich; sonst ist das Symbol gesperrt und sagt warum: „Der Bereich ist nicht leer.“ Die ID eines Bereichs ändert sich nie.

**L-08 Standardfavoriten.** Eine Auswahl aus allen Links, höchstens fünf, in einer Reihenfolge. Der Stern in der Zeile nimmt einen Link auf oder heraus; beim sechsten sagt ein Hinweis „Höchstens 5 Standardfavoriten. Bitte erst einen entfernen.“ Die Reihenfolge ändert man durch Ziehen oder mit den Pfeiltasten, auf Geräten ohne Maus mit einem Symbol, das den Favoriten eine Stelle nach vorn setzt.

**L-09 Hilfe-Link.** Name und Adresse für „Link fehlt?“ und die Fußzeile, mit den Regeln aus V-06 und V-08, im eigenen Reiter „Hilfe-Link“. Eine ungültige Eingabe bleibt mit Meldung stehen; „Speichern“ springt dorthin, sagt „Der Hilfe-Link stimmt noch nicht.“ und speichert nicht.

**L-10 Speichern.** Änderungen sammeln sich, bis man „Speichern“ drückt; bis dahin steht oben „Nicht gespeicherte Änderungen“, sonst „Gespeichert“, und Verlassen der Seite fragt nach. „Speichern“ ist gesperrt, solange nichts geändert ist, und bleibt ab 600 px Breite beim Scrollen sichtbar. „Rückgängig“ und Strg+Z nehmen Schritt für Schritt zurück; in einem Feld gilt Strg+Z für den Text im Feld. Strg+S speichert auch, was noch im Feld steht. „Speichern“ verlangt das Feld „Ihr Name“ (1 bis 40 Zeichen, bleibt im Browser vorbelegt). Der Dienst setzt `stand` auf heute, prüft die ganze Liste mit den Regeln aus V-01 bis V-10, mit denselben Funktionen wie `scripts/pruefe_links.py`, und schreibt nur, wenn sie besteht. Vorher legt er eine Sicherung `links.JJJJ-MM-TT-HHMMSS.json` in einen Ordner `sicherungen/` neben `daten/`, in derselben Sekunde mit `-2`, `-3` vor `.json`, und er schreibt atomar: neue Datei, dann umbenennen. Bei einem Fehler wird nichts geschrieben, und die Meldung nennt die Stelle wie `pruefe_links.py`.

**L-11 Gleichzeitig bearbeiten.** Hat jemand anders seit dem Laden der Ansicht gespeichert, lehnt der Dienst das Speichern ab: „Inzwischen hat NAME um HH:MM gespeichert. Bitte neu laden; Ihre Änderungen gehen dabei verloren.“ Die Meldung bietet „Neu laden“. Grundlage ist eine Versionsnummer, die bei jedem Speichern wächst.

**L-12 Protokoll.** Jedes Speichern schreibt eine Zeile in `protokoll.jsonl` neben `sicherungen/`: Zeit, Name, Zahl der neuen, geänderten und gelöschten Links und Bereiche, Name der Sicherung. Die Admin-Ansicht zeigt die letzten 20 Einträge im Reiter „Verlauf“.

**L-13 Sicherheit.** Alle Texte werden als Text eingesetzt wie in F-03. Die Admin-Seite lädt nichts von fremden Servern und hat kein Inline-Skript (N-02, B-03). Jede schreibende Anfrage braucht die Sitzung und zusätzlich einen Token im Kopf `X-CSRF-Token`, den die Seite nach der Anmeldung erhält. Die Schnittstelle nimmt nur JSON bis 256 KB an.

**L-14 Gestaltung.** Nach `docs/DESIGN.md`: Felder wie das Suchfeld, Buttons wie „Speichern“ im Vorname-Formular, Abschnittsüberschriften wie auf der Startseite. Bedienbar mit der Tastatur (N-03): Nach der Anmeldung steht der Fokus in der Suche, ein Link lässt sich ganz ohne Maus anlegen. Bei 360 px ohne waagerechtes Scrollen (N-04), die Adresse bleibt in der Zeile sichtbar.

**L-15 Sicherung zurückholen.** Im Reiter „Verlauf“ stehen unter dem Protokoll die letzten 20 Sicherungen mit Zeit und Name dessen, der danach gespeichert hat, je mit dem Button „Diesen Stand zurückholen“. Er fragt im eigenen Fenster nach, „Abbrechen“ ist vorgewählt: „Stand von TT.MM. HH:MM zurückholen? Nicht gespeicherte Änderungen gehen verloren.“ Er verlangt „Ihr Name“ wie L-10. Zurückholen ist ein Speichern: Der Dienst prüft die Sicherung mit V-01 bis V-10, legt vorher eine Sicherung des aktuellen Stands an, setzt `stand` auf heute und schreibt ins Protokoll „Stand von TT.MM. HH:MM zurückgeholt“. Ältere Sicherungen bleiben auf dem Server liegen; nur die Ansicht zeigt 20.
