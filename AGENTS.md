# Hinweise für KI-Agenten

Projekt: Browser-Startseite für WAMOCON GmbH (WMC) und WAMOCON Academy GmbH (WMA). Sprache in Code-Kommentaren, Texten und Commits: Deutsch.

Lies zuerst `docs/AUFTRAG.md`. Maßgeblich für den Inhalt ist `docs/ANFORDERUNGEN.md`, für das Aussehen `docs/DESIGN.md`.

## Kurzregeln

- Arbeite auf dem Zweig `gregor/startseite`, nie auf `main`.
- Commit-Nachrichten: „Bereich: was“, z. B. „Suche: Filter und Infozeile“.
- Nicht ändern: `docs/AUFTRAG.md`, `docs/ANFORDERUNGEN.md`, `docs/DESIGN.md`, `docs/design/`, `schema/`, `daten/beispiel/links.json`, `site/assets/`, `AGENTS.md`, `CLAUDE.md`.
- Seite: nur HTML, CSS und JavaScript ohne Bibliotheken. Python: nur Standardbibliothek.
- Keine Inline-Stile (`style="…"`) und keine Inline-Skripte: die Content-Security-Policy sperrt sie.

## Befehle

```
python3 -m unittest discover -s tests
python3 scripts/pruefe_links.py daten/beispiel/links.json
mkdir -p site/daten && cp daten/beispiel/links.json site/daten/ && python3 -m http.server 8000 -d site
docker compose up -d --build
```
