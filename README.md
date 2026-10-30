# Browser-Startseite WMC & WMA

Gemeinsame Startseite für die Browser der WAMOCON GmbH (WMC) und der WAMOCON Academy GmbH (WMA): alle wichtigen Links an einem Ort, zentral von der IT gepflegt, mit persönlichen Favoriten je Browser. Jira: WMCNL-2781.

| Pfad | Inhalt |
|---|---|
| `site/` | die Seite: `index.html`, `styles.css`, `app.js`, Logos und Schrift |
| `scripts/pruefe_links.py` | Prüfskript für die Linkliste (V-01 bis V-10) |
| `scripts/pruefe_sprueche.py` | Prüfskript für die Sprüche (V-11 bis V-15) |
| `tests/` | Unit-Tests für die Prüfskripte |
| `schema/links.schema.json` | Format der Linkliste |
| `daten/beispiel/links.json` | Beispiel-Linkliste mit Platzhalter-Links |
| `daten/beispiel/sprueche.json` | Beispiel-Sprüche für die Begrüßung |
| `nginx/`, `Dockerfile`, `docker-compose.yml` | Betrieb im Container |
| `docs/` | Auftrag, Anforderungen, Gestaltung, Übergabe |

Die echte Linkliste liegt nur auf dem Server und nie in diesem Repo.
Schrift: Inter, SIL Open Font License 1.1 (`site/assets/fonts/OFL.txt`).

## Lokal starten

Die Seite lädt `daten/links.json` und `daten/sprueche.json` relativ vom gleichen Server. Für einen lokalen Test legt man Kopien der Beispieldateien nach `site/daten/` (der Ordner ist per `.gitignore` ausgeschlossen) und startet einen einfachen HTTP-Server:

```
mkdir -p site/daten
cp daten/beispiel/links.json site/daten/
cp daten/beispiel/sprueche.json site/daten/
python3 -m http.server 8000 -d site
```

Dann im Browser `http://localhost:8000/` öffnen. Der Ordner `site/daten/` gehört nicht ins Repo.

## Mit Docker betreiben

```
docker compose up -d --build
```

Die Seite ist dann unter `http://localhost:8080/` erreichbar. Der Container führt beim Build das Prüfskript auf der Beispieldatei aus und bricht ab, wenn die Prüfung fehlschlägt.

## Links pflegen

Die IT pflegt die Links in einer JSON-Datei auf dem Server (Format: `schema/links.schema.json`). Nach einer Änderung:

1. Die Datei prüfen: `python3 scripts/pruefe_links.py PFAD/ZUR/links.json`
2. Gilt das Dateiverzeichnis als `LINKS_VERZEICHNIS` eingebunden, ist die Änderung beim nächsten Öffnen in allen Browsern sichtbar — kein Neustart des Containers nötig.

Beim Betrieb mit Docker setzt die IT `LINKS_VERZEICHNIS` auf das Verzeichnis mit der echten Liste (außerhalb des Repos):

```
LINKS_VERZEICHNIS=/pfad/zu/echten/links docker compose up -d
```

Das Verzeichnis wird schreibgeschützt nach `/usr/share/nginx/html/daten` eingebunden. Eine Einzeldatei wird nicht eingebunden, weil Editoren beim Speichern oft eine neue Datei anlegen und eine eingebundene Einzeldatei dann im Container veraltet wäre.

## Sprüche pflegen

Die Sprüche des Tages liegen in `sprueche.json` im selben Verzeichnis wie `links.json` (Format: `stand` und `sprueche`, ein Satz pro Eintrag, höchstens 90 Zeichen). Die Seite zeigt jeden Tag einen anderen Satz; der Tag zählt ab dem 01.01.2026. Nach einer Änderung:

1. Die Datei prüfen: `python3 scripts/pruefe_sprueche.py PFAD/ZUR/sprueche.json` — die Ausgabe ist `OK: N Sprüche`.
2. Gilt das Dateiverzeichnis als `LINKS_VERZEICHNIS` eingebunden, ist die Änderung beim nächsten Öffnen in allen Browsern sichtbar — kein Neustart des Containers nötig.

Fehlt die Datei oder ist sie ungültig, bleibt der Spruch-Absatz verborgen; die Links erscheinen trotzdem.

## Tests ausführen

Unit-Tests für die Prüfskripte (alle Regeln V-02 bis V-09 und V-11 bis V-15):

```
python3 -m unittest discover -s tests
```

Prüfskripte auf den Beispieldateien:

```
python3 scripts/pruefe_links.py daten/beispiel/links.json
python3 scripts/pruefe_sprueche.py daten/beispiel/sprueche.json
```

Erwartete Ausgaben: `OK: 6 Bereiche, 20 Links` und `OK: 5 Sprüche`.
