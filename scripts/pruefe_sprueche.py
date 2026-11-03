#!/usr/bin/env python3
"""Prüft die Sprüche der Browser-Startseite WMC & WMA (V-11 bis V-15).

Aufruf: python3 scripts/pruefe_sprueche.py DATEI
Nur Python-Standardbibliothek. Sammelt alle Fehler und bricht nicht beim ersten ab.

Ohne Fehler: genau eine Zeile „OK: N Sprüche“, Exit-Code 0.
Mit Fehlern: je Fehler eine Zeile „FEHLER: FUNDSTELLE: MELDUNG“, Exit-Code 1.
Fehlender Dateiname: Hinweis zum Aufruf, Exit-Code 2.
"""

import json
import sys
from datetime import date

SPRUCH_MIN = 1
SPRUCH_MAX = 90


def pruefe(daten, fehler):
    """Prüft eine geladene Struktur und sammelt Fehler (V-11 bis V-14)."""
    if not isinstance(daten, dict):
        fehler.append("stand: Die Datei muss ein JSON-Objekt mit stand und sprueche sein.")
        return

    unbekannt = set(daten) - {"stand", "sprueche"}
    for feld in sorted(unbekannt):
        fehler.append(
            f"{feld}: Unbekanntes Feld. Erlaubt sind nur: stand, sprueche."
        )

    for feld in ("stand", "sprueche"):
        if feld not in daten:
            fehler.append(f"{feld}: Das Feld fehlt.")

    # stand (V-11, V-12)
    stand = daten.get("stand")
    if stand is not None:
        if not isinstance(stand, str):
            fehler.append("stand: Das Datum muss eine Zeichenkette sein.")
        else:
            if len(stand) != 10 or stand[4] != "-" or stand[7] != "-":
                fehler.append(
                    f"stand: Das Datum muss das Format JJJJ-MM-TT haben "
                    f"(ist „{stand}“)."
                )
            else:
                try:
                    jahr, monat, tag = (int(x) for x in stand.split("-"))
                    date(jahr, monat, tag)
                except ValueError:
                    fehler.append(
                        f"stand: „{stand}“ ist kein echtes Kalenderdatum. "
                        "Prüfen Sie Monat und Tag."
                    )

    # sprueche (V-11, V-13, V-14)
    sprueche = daten.get("sprueche")
    if sprueche is not None and not isinstance(sprueche, list):
        fehler.append("sprueche: Der Wert muss eine Liste von Sätzen sein.")
    if isinstance(sprueche, list):
        if len(sprueche) < 1:
            fehler.append("sprueche: Es braucht mindestens einen Satz.")
        for i, satz in enumerate(sprueche):
            fundstelle = f"sprueche[{i}]"
            if not isinstance(satz, str):
                fehler.append(f"{fundstelle}: Jeder Satz muss eine Zeichenkette sein.")
                continue
            if len(satz) < SPRUCH_MIN:
                fehler.append(f"{fundstelle}: Der Satz darf nicht leer sein.")
            if len(satz) > SPRUCH_MAX:
                fehler.append(
                    f"{fundstelle}: Der Satz darf höchstens {SPRUCH_MAX} Zeichen haben "
                    f"(hat {len(satz)} Zeichen)."
                )
            if satz != satz.strip():
                fehler.append(
                    f"{fundstelle}: Der Satz darf keine Leerzeichen am Anfang "
                    "oder Ende haben."
                )

        # V-14: Kein Satz kommt zweimal vor; jede Stelle nennen.
        for i, satz in enumerate(sprueche):
            if not isinstance(satz, str):
                continue
            vorkommen = sum(
                1 for j, kandidat in enumerate(sprueche)
                if isinstance(kandidat, str) and kandidat == satz
            )
            if vorkommen > 1:
                fehler.append(
                    f"sprueche[{i}]: Der Satz „{satz}“ kommt mehrfach vor. "
                    "Jeder Satz darf nur einmal vorkommen."
                )


def laenge(daten):
    """Zählt die Sätze in einer (mindestens strukturell) gültigen Datei."""
    if isinstance(daten, dict):
        sprueche = daten.get("sprueche")
        if isinstance(sprueche, list):
            return len(sprueche)
    return 0


def main(argv):
    if len(argv) != 2:
        print("Aufruf: python3 scripts/pruefe_sprueche.py DATEI")
        return 2

    datei = argv[1]

    # V-11: lesbares UTF-8 und gültiges JSON
    try:
        with open(datei, "r", encoding="utf-8") as quelle:
            text = quelle.read()
    except FileNotFoundError:
        print(f"FEHLER: {datei}: Datei nicht gefunden.")
        return 1
    except (UnicodeDecodeError, OSError) as fehler:
        print(f"FEHLER: {datei}: Die Datei lässt sich nicht als UTF-8 lesen "
              f"({fehler.__class__.__name__}).")
        return 1

    try:
        daten = json.loads(text)
    except json.JSONDecodeError as fehler:
        print(f"FEHLER: (Zeile {fehler.lineno}, Spalte {fehler.colno}): "
              "Die Datei ist kein gültiges JSON.")
        return 1

    fehler = []
    pruefe(daten, fehler)

    if fehler:
        for meldung in fehler:
            print(f"FEHLER: {meldung}")
        return 1

    anzahl = laenge(daten)
    print(f"OK: {anzahl} Sprüche")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
