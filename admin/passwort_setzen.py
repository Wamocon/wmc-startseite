"""Setzt das gemeinsame Passwort für die Admin-Ansicht (L-02).

Aufruf:
    python3 admin/passwort_setzen.py DATEI

Das Passwort wird zweimal verdeckt abgefragt (getpass). Das Ergebnis steht
als PBKDF2-SHA256-Hash (200 000 Runden, eigenes Salz) in DATEI, als JSON:
    {"salz": "<hex>", "hash": "<hex>"}

Die Datei gehört auf dem Server neben daten/ und sicherungen/, nicht ins
Repository.
"""

import argparse
import getpass
import hashlib
import json
import os
import secrets
import sys


def hashen(passwort: str, salz: bytes) -> str:
    """PBKDF2-SHA256 mit 200 000 Runden (L-02)."""
    wert = hashlib.pbkdf2_hmac("sha256", passwort.encode("utf-8"), salz, 200_000)
    return wert.hex()


def pruefen_passwoerter(passwort1: str, passwort2: str):
    """Prüft, dass beide Passwörter gleich und nicht leer sind."""
    if not passwort1:
        raise SystemExit("Das Passwort darf nicht leer sein.")
    if passwort1 != passwort2:
        raise SystemExit("Die Passwörter stimmen nicht überein.")


def setzen(passwort: str, pfad: str):
    salz = secrets.token_bytes(16)
    hashwert = hashen(passwort, salz)
    verzeichnis = os.path.dirname(pfad) or "."
    os.makedirs(verzeichnis, exist_ok=True)
    mit_tmp = pfad + ".tmp"
    with open(mit_tmp, "w", encoding="utf-8") as ziel:
        ziel.write(json.dumps({"salz": salz.hex(), "hash": hashwert}, ensure_ascii=False))
        ziel.flush()
        os.fsync(ziel.fileno())
    os.replace(mit_tmp, pfad)
    os.chmod(pfad, 0o600)
    return pfad


def main(argv):
    parser = argparse.ArgumentParser(description="Setzt das Passwort für die Admin-Ansicht.")
    parser.add_argument("pfad", help="Pfad der Passwortdatei (außerhalb von daten/).")
    args = parser.parse_args(argv)

    passwort1 = getpass.getpass("Neues Passwort: ")
    passwort2 = getpass.getpass("Neues Passwort (wiederholen): ")
    pruefen_passwoerter(passwort1, passwort2)
    pfad = os.path.abspath(args.pfad)
    setzen(passwort1, pfad)
    print(f"Passwort gesetzt in {pfad}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
