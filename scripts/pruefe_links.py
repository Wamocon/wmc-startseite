#!/usr/bin/env python3
"""Prüft die Linkliste der Browser-Startseite WMC & WMA (V-01 bis V-10).

Aufruf: python3 scripts/pruefe_links.py DATEI
Nur Python-Standardbibliothek. Sammelt alle Fehler und bricht nicht beim ersten ab.

Ohne Fehler: genau eine Zeile „OK: B Bereiche, L Links“, Exit-Code 0.
Mit Fehlern: je Fehler eine Zeile „FEHLER: FUNDSTELLE: MELDUNG“, Exit-Code 1.
Fehlender Dateiname: Hinweis zum Aufruf, Exit-Code 2.
"""

import json
import re
import sys
from datetime import date

ID_MUSTER = r"^[a-z0-9]+(-[a-z0-9]+)*$"
KURZEL_MUSTER = r"^[A-Z0-9ÄÖÜ]{1,3}$"
MARKE_WERTE = {"wmc", "wma", "beide"}

TOPPFELDER = ["stand", "hilfe", "standardFavoriten", "bereiche"]
BEREICHSFELDER = ["id", "titel", "marke", "links"]
LINKFELDER = ["id", "name", "beschreibung", "url", "kuerzel"]
HILFEFELDER = ["name", "url"]

ID_MAX = 40
NAME_MAX = 40
TITEL_MAX = 40
BESCHREIBUNG_MAX = 60
URL_MAX = 500


def _id_pruefen(wert, fundstelle, fehler):
    """V-02 (Typ), V-05 (einzigartig über alle Bereiche), V-08 (Muster, Länge)."""
    if not isinstance(wert, str):
        fehler.append(f"{fundstelle}: Die ID muss eine Zeichenkette sein.")
        return None
    if len(wert) > ID_MAX:
        fehler.append(
            f"{fundstelle}: Die ID darf höchstens {ID_MAX} Zeichen haben "
            f"(hat {len(wert)} Zeichen)."
        )
    if not re.match(ID_MUSTER, wert):
        fehler.append(
            f"{fundstelle}: Ungültige ID „{wert}“. Erlaubt sind Kleinbuchstaben und "
            "Ziffern, getrennt durch Bindestriche, ohne Leerzeichen am Anfang oder "
            "Ende, z. B. „it-ticket“."
        )
    return wert


def _zeichenketten_pruefen(wert, fundstelle, fehler, max_laeufe=None, min_laeufe=1):
    """V-02 (Typ) und V-08 (Länge)."""
    if not isinstance(wert, str):
        fehler.append(f"{fundstelle}: Dieser Wert muss eine Zeichenkette sein.")
        return
    if len(wert) < min_laeufe:
        fehler.append(f"{fundstelle}: Der Text darf nicht leer sein.")
    if max_laeufe is not None and len(wert) > max_laeufe:
        fehler.append(
            f"{fundstelle}: Der Text darf höchstens {max_laeufe} Zeichen haben "
            f"(hat {len(wert)} Zeichen)."
        )


def _url_pruefen(wert, fundstelle, fehler):
    """V-02 (Typ), V-06 (http(s) und keine Leerzeichen), V-08 (Länge)."""
    if not isinstance(wert, str):
        fehler.append(f"{fundstelle}: Die URL muss eine Zeichenkette sein.")
        return
    if " " in wert or "\t" in wert:
        fehler.append(
            f"{fundstelle}: Die URL darf keine Leerzeichen enthalten."
        )
    if not (wert.startswith("https://") or wert.startswith("http://")):
        fehler.append(
            f"{fundstelle}: Die URL muss mit „https://“ oder „http://“ beginnen "
            f"(ist „{wert}“)."
        )
    if len(wert) > URL_MAX:
        fehler.append(
            f"{fundstelle}: Die URL darf höchstens {URL_MAX} Zeichen haben "
            f"(hat {len(wert)} Zeichen)."
        )


def pruefe(daten, fehler):
    """Prüft eine geladene Struktur und sammelt Fehler (V-02 bis V-09)."""
    if not isinstance(daten, dict):
        fehler.append("stand: Die Datei muss ein JSON-Objekt mit stand, hilfe, "
                      "standardFavoriten und bereiche sein.")
        return

    unbekannt = set(daten) - set(TOPPFELDER)
    for feld in sorted(unbekannt):
        fehler.append(
            f"{feld}: Unbekanntes Feld. Erlaubt sind nur: "
            + ", ".join(TOPPFELDER) + "."
        )

    for feld in TOPPFELDER:
        if feld not in daten:
            fehler.append(f"{feld}: Das Feld fehlt.")

    # stand (V-02, V-03)
    stand = daten.get("stand")
    if isinstance(stand, str):
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
    elif stand is not None:
        fehler.append("stand: Das Datum muss eine Zeichenkette sein.")

    # hilfe (V-02, V-06, V-08)
    hilfe = daten.get("hilfe")
    if isinstance(hilfe, dict):
        for feld in ("name", "url"):
            if feld not in hilfe:
                fehler.append(f"hilfe.{feld}: Das Feld fehlt.")
        for feld in ("name", "url"):
            if feld in hilfe:
                if feld == "url":
                    _url_pruefen(hilfe[feld], "hilfe.url", fehler)
                else:
                    _zeichenketten_pruefen(hilfe[feld], "hilfe.name", fehler,
                                           max_laeufe=NAME_MAX)
        unbekannt = set(hilfe) - set(HILFEFELDER)
        for feld in sorted(unbekannt):
            fehler.append(
                f"hilfe.{feld}: Unbekanntes Feld. Erlaubt sind nur: "
                + ", ".join(HILFEFELDER) + "."
            )
    elif hilfe is not None:
        fehler.append("hilfe: Der Wert muss ein Objekt mit name und url sein.")

    # standardFavoriten (V-02, V-07, V-08)
    favoriten = daten.get("standardFavoriten")
    if favoriten is not None and not isinstance(favoriten, list):
        fehler.append("standardFavoriten: Der Wert muss eine Liste von Link-IDs sein.")
    if isinstance(favoriten, list):
        for i, wert in enumerate(favoriten):
            _id_pruefen(wert, f"standardFavoriten[{i}]", fehler)

    # bereiche (V-02, V-04, V-05, V-06, V-07, V-08)
    bereiche = daten.get("bereiche")
    if bereiche is not None and not isinstance(bereiche, list):
        fehler.append("bereiche: Der Wert muss eine Liste sein.")
    if isinstance(bereiche, list) and len(bereiche) < 1:
        fehler.append("bereiche: Es braucht mindestens einen Bereich.")

    bereich_ids = []
    link_ids = []
    if isinstance(bereiche, list):
        for i, bereich in enumerate(bereiche):
            basis = f"bereiche[{i}]"
            if not isinstance(bereich, dict):
                fehler.append(f"{basis}: Der Bereich muss ein Objekt sein.")
                continue

            unbekannt = set(bereich) - set(BEREICHSFELDER)
            for feld in sorted(unbekannt):
                fehler.append(
                    f"{basis}.{feld}: Unbekanntes Feld. Erlaubt sind nur: "
                    + ", ".join(BEREICHSFELDER) + "."
                )
            for feld in BEREICHSFELDER:
                if feld not in bereich:
                    fehler.append(f"{basis}.{feld}: Das Feld fehlt.")

            if "id" in bereich:
                wert = _id_pruefen(bereich["id"], f"{basis}.id", fehler)
                if wert is not None:
                    bereich_ids.append(wert)

            if "titel" in bereich:
                _zeichenketten_pruefen(bereich["titel"], f"{basis}.titel", fehler,
                                       max_laeufe=TITEL_MAX)

            if "marke" in bereich:
                marke = bereich["marke"]
                if not isinstance(marke, str) or marke not in MARKE_WERTE:
                    fehler.append(
                        f"{basis}.marke: Erlaubt sind nur „wmc“, „wma“ und "
                        f"„beide“ (ist „{marke}“)."
                    )

            links = bereich.get("links")
            if links is not None and not isinstance(links, list):
                fehler.append(f"{basis}.links: Der Wert muss eine Liste sein.")
            if isinstance(links, list):
                if len(links) < 1:
                    fehler.append(f"{basis}.links: Es braucht mindestens einen Link.")
                for j, link in enumerate(links):
                    lbasis = f"{basis}.links[{j}]"
                    if not isinstance(link, dict):
                        fehler.append(f"{lbasis}: Der Link muss ein Objekt sein.")
                        continue

                    unbekannt = set(link) - set(LINKFELDER)
                    for feld in sorted(unbekannt):
                        fehler.append(
                            f"{lbasis}.{feld}: Unbekanntes Feld. Erlaubt sind nur: "
                            + ", ".join(LINKFELDER) + "."
                        )
                    for feld in ("id", "name", "beschreibung", "url"):
                        if feld not in link:
                            fehler.append(f"{lbasis}.{feld}: Das Feld fehlt.")

                    if "id" in link:
                        wert = _id_pruefen(link["id"], f"{lbasis}.id", fehler)
                        if wert is not None:
                            link_ids.append(wert)

                    if "name" in link:
                        _zeichenketten_pruefen(link["name"], f"{lbasis}.name",
                                               fehler, max_laeufe=NAME_MAX)

                    if "beschreibung" in link:
                        _zeichenketten_pruefen(
                            link["beschreibung"], f"{lbasis}.beschreibung", fehler,
                            max_laeufe=BESCHREIBUNG_MAX)

                    if "url" in link:
                        _url_pruefen(link["url"], f"{lbasis}.url", fehler)

                    if "kuerzel" in link:
                        kuerzel = link["kuerzel"]
                        if not isinstance(kuerzel, str):
                            fehler.append(
                                f"{lbasis}.kuerzel: Der Wert muss eine "
                                "Zeichenkette sein.")
                        else:
                            if not re.match(KURZEL_MUSTER, kuerzel):
                                fehler.append(
                                    f"{lbasis}.kuerzel: Ungültiges Kürzel "
                                    f"„{kuerzel}“. Erlaubt sind 1 bis 3 Zeichen "
                                    "aus A–Z, Ä, Ö, Ü und 0–9.")

    # V-04: Bereichs-IDs eindeutig
    for wert in set(bereich_ids):
        if bereich_ids.count(wert) > 1:
            fehler.append(
                f"bereiche: Die Bereich-ID „{wert}“ kommt mehrfach vor. "
                "Jede Bereich-ID darf nur einmal vorkommen."
            )

    # V-05: Link-IDs über alle Bereiche eindeutig
    for wert in set(link_ids):
        if link_ids.count(wert) > 1:
            fehler.append(
                f"bereiche: Die Link-ID „{wert}“ kommt mehrfach vor. "
                "Jede Link-ID darf über alle Bereiche hinweg nur einmal vorkommen."
            )

    # V-07: standardFavoriten referenzieren existente Link-IDs
    if isinstance(favoriten, list):
        for i, wert in enumerate(favoriten):
            if isinstance(wert, str) and wert not in link_ids:
                fehler.append(
                    f"standardFavoriten[{i}]: Die ID „{wert}“ gibt es nicht als "
                    "Link-ID in den Bereichen."
                )


def laenge_zahlen(daten):
    """Zählt Bereiche und Links in einer (mindestens strukturell) gültigen Datei."""
    bereiche = 0
    links = 0
    if isinstance(daten, dict):
        b = daten.get("bereiche")
        if isinstance(b, list):
            bereiche = len(b)
            for bereich in b:
                if isinstance(bereich, dict) and isinstance(bereich.get("links"), list):
                    links += len(bereich["links"])
    return bereiche, links


def main(argv):
    if len(argv) != 2:
        print("Aufruf: python3 scripts/pruefe_links.py DATEI")
        return 2

    datei = argv[1]

    # V-01: lesbares UTF-8 und gültiges JSON
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

    bereiche, links = laenge_zahlen(daten)
    print(f"OK: {bereiche} Bereiche, {links} Links")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
