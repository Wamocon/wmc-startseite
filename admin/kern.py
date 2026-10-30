"""Kernlogik für die Admin-Ansicht (A-0104, B-05, L-02 bis L-15).

Diese Datei ist importierbar und hat keine Seiteneffekte beim Import,
damit `tests/test_kern.py` sie über `python3 scripts/pruefe_links.py`
oder über `python3 -m unittest` laden kann.

Nur Python-Standardbibliothek (L-02, B-05).
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import time
from datetime import date
from http import HTTPStatus

# ---- Prüfungen: dieselben Funktionen wie scripts/pruefe_links.py ------------
# Der Dienst prüft die Linkliste mit denselben Funktionen wie das Prüfskript.
# Damit importiert er das Modul statt es zu kopieren (A-0104).
import sys as _sys
_sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
import pruefe_links  # noqa: E402

# ---- Konstanten -------------------------------------------------------------

SITZUNG_LEBEN_SEKUNDEN = 8 * 60 * 60
SPERRE_FELDLESENDER = 5
SPERRE_FENSTER_SEKUNDEN = 10 * 60
MAX_BODY_BYTES = 256 * 1024
PROTOKOLL_ANZAHL = 20
SICHERUNGEN_ANZAHL = 20
FAVORITEN_MAX = 5
NAME_MIN = 1
NAME_MAX = 40

ID_MUSTER = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
NAEM_ZU_ID = re.compile(r"[^a-z0-9]+")
SICHERUNG_MUSTER = re.compile(
    r"^links\.(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})\.json$"
)

COOKIE_NAME = "wmc_admin_sitzung"
CSRF_HEADER = "X-CSRF-Token"


# ---- Passwort (L-02) --------------------------------------------------------

def hashen(passwort: str, salz: bytes) -> str:
    """PBKDF2-SHA256 mit 200 000 Runden (L-02)."""
    wert = hashlib.pbkdf2_hmac("sha256", passwort.encode("utf-8"), salz, 200_000)
    return wert.hex()


def passwort_pruefen(passwort: str, salz: bytes, hashwert: str) -> bool:
    """Vergleicht ein Passwort mit dem Hash (zeitkonstanter Vergleich)."""
    ergebnis = hashen(passwort, salz)
    return hmac.compare_digest(ergebnis, hashwert)


def passwort_datei_lesen(pfad: str) -> dict:
    """Liest die Passwortdatei: {"salz": hex, "hash": hex}."""
    with open(pfad, "r", encoding="utf-8") as quelle:
        rohes = json.load(quelle)
    return {
        "salz": bytes.fromhex(rohes["salz"]),
        "hash": rohes["hash"],
    }


def passwort_datei_schreiben(passwort: str, pfad: str) -> str:
    """Setzt das Passwort: PBKDF2-SHA256, 200 000 Runden, eigenes Salz (L-02)."""
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


# ---- ID aus dem Namen (L-04) ------------------------------------------------

def id_aus_name(name: str, bestehende) -> str:
    """Bildet aus einem Namen eine eindeutige ID.

    Kleinbuchstaben, Ziffern, Bindestriche. Leerzeichen und Sonderzeichen
    werden zu Bindestrichen, aufeinanderfolgende Bindestriche werden
    zusammengefasst, am Ende stehen keine Bindestriche.
    Ist die ID bereits vergeben, folgt eine Ziffer: „name-2“, „name-3“.
    """
    grund = NAEM_ZU_ID.sub("-", name.lower()).strip("-")
    if not grund:
        grund = "link"
    if grund not in bestehende:
        return grund
    zahl = 2
    while f"{grund}-{zahl}" in bestehende:
        zahl += 1
    return f"{grund}-{zahl}"


# ---- Name (L-10) -------------------------------------------------------------

def name_pruefen(name) -> bool:
    """L-10: „Ihr Name“ hat 1 bis 40 Zeichen, Rand-Leerzeichen gelten nicht."""
    if not isinstance(name, str):
        return False
    name = name.strip()
    if len(name) < NAME_MIN or len(name) > NAME_MAX:
        return False
    return True


# ---- Stand (L-10) -------------------------------------------------------------

def stand_heute() -> str:
    """L-10: Der Dienst setzt stand auf heute (JJJJ-MM-TT)."""
    return date.today().isoformat()


# ---- Sicherung (L-10) ---------------------------------------------------------

def sicherung_name_ist_gueltig(name: str) -> bool:
    """L-15: Nur Namen der Form links.JJJJ-MM-TT-HHMMSS.json."""
    m = SICHERUNG_MUSTER.match(name)
    if not m:
        return False
    jahr, monat, tag, stunde, minute, sekunde = (int(x) for x in m.groups())
    try:
        date(jahr, monat, tag)
    except ValueError:
        return False
    if stunde > 23 or minute > 59 or sekunde > 59:
        return False
    return True


def sicherung_legen(alt_datei_pfad: str, ziel_verzeichnis: str) -> str:
    """Legt eine Sicherung links.JJJJ-MM-TT-HHMMSS.json an (L-10)."""
    zeit = time.localtime()
    name = "links.%04d-%02d-%02d-%02d%02d%02d.json" % (
        zeit.tm_year, zeit.tm_mon, zeit.tm_mday,
        zeit.tm_hour, zeit.tm_min, zeit.tm_sec,
    )
    ziel_pfad = os.path.join(ziel_verzeichnis, name)
    with open(alt_datei_pfad, "r", encoding="utf-8") as quelle:
        inhalt = quelle.read()
    with open(ziel_pfad, "w", encoding="utf-8") as ziel:
        ziel.write(inhalt)
    return name


def sicherung_laden(verzeichnis: str, name: str) -> dict:
    """L-15: Lädt eine Sicherung und gibt die Daten zurück."""
    pfad = os.path.join(verzeichnis, name)
    if not os.path.exists(pfad):
        raise FileNotFoundError(name)
    with open(pfad, "r", encoding="utf-8") as quelle:
        return json.load(quelle)


# ---- Schreiben (L-10) -----------------------------------------------------------

def liste_schreiben(daten: dict, pfad: str) -> None:
    """L-10: Atomares Schreiben: neue Datei, dann umbenennen."""
    verzeichnis = os.path.dirname(pfad) or "."
    zeit = time.localtime()
    vorname = "links.tmp.%04d%02d%02d-%02d%02d%02d.%d" % (
        zeit.tm_year, zeit.tm_mon, zeit.tm_mday,
        zeit.tm_hour, zeit.tm_min, zeit.tm_sec, os.getpid(),
    )
    vor_pfad = os.path.join(verzeichnis, vorname)
    text = json.dumps(daten, ensure_ascii=False, indent=2)
    with open(vor_pfad, "w", encoding="utf-8") as ziel:
        ziel.write(text)
        ziel.flush()
        os.fsync(ziel.fileno())
    os.replace(vor_pfad, pfad)


def liste_lesen(pfad: str) -> dict:
    with open(pfad, "r", encoding="utf-8") as quelle:
        return json.load(quelle)


def liste_pruefen(daten: dict) -> list:
    """Prüft die Liste mit denselben Funktionen wie pruefe_links.py."""
    fehler = []
    pruefe_links.pruefe(daten, fehler)
    return fehler


# ---- Protokoll (L-12) -------------------------------------------------------------

def protokoll_zeile(schreibpfad: str, eintrag: dict) -> None:
    zeile = json.dumps(eintrag, ensure_ascii=False)
    with open(schreibpfad, "a", encoding="utf-8") as quelle:
        quelle.write(zeile + "\n")


def protokoll_lesen(schreibpfad: str, anzahl: int = PROTOKOLL_ANZAHL) -> list:
    """Liest die letzten `anzahl` Einträge des Protokolls, neueste zuerst."""
    if not os.path.exists(schreibpfad):
        return []
    eintraege = []
    with open(schreibpfad, "r", encoding="utf-8") as quelle:
        for zeile in quelle:
            zeile = zeile.strip()
            if not zeile:
                continue
            try:
                eintraege.append(json.loads(zeile))
            except json.JSONDecodeError:
                continue
    return eintraege[-anzahl:][::-1]


def protokoll_version_lesen(schreibpfad: str) -> int:
    """Die höchste bisherige Versionsnummer aus dem Protokoll."""
    hoechste = 0
    for eintrag in protokoll_lesen(schreibpfad, 1000000):
        if isinstance(eintrag, dict) and isinstance(eintrag.get("version"), int):
            hoechste = max(hoechste, eintrag["version"])
    return hoechste


# ---- Sicherungen-Liste (L-15) ------------------------------------------------------

def sicherungen_auflisten(verzeichnis: str, protokoll_pfad: str,
                          anzahl: int = SICHERUNGEN_ANZAHL) -> list:
    """L-15: Die letzten `anzahl` Sicherungen, neueste zuerst."""
    if not os.path.isdir(verzeichnis):
        return []
    names = []
    for name in os.listdir(verzeichnis):
        if name.startswith("links.") and name.endswith(".json"):
            names.append(name)

    def schluessel(name: str):
        return name[len("links."):-len(".json")]

    names.sort(key=schluessel, reverse=True)
    names = names[:anzahl]

    eintraege = []
    if os.path.exists(protokoll_pfad):
        with open(protokoll_pfad, "r", encoding="utf-8") as quelle:
            for zeile in quelle:
                zeile = zeile.strip()
                if not zeile:
                    continue
                try:
                    eintraege.append(json.loads(zeile))
                except json.JSONDecodeError:
                    continue

    ergebnis = []
    for name in names:
        personen_name = ""
        for eintrag in eintraege:
            if eintrag.get("sicherung") == name:
                personen_name = eintrag.get("name", "")
                break
        stueck = name[len("links."):-len(".json")]
        ergebnis.append({
            "name": name,
            "zeit": stueck,
            "name_person": personen_name,
        })
    return ergebnis


# ---- Versionskonflikt (L-11) --------------------------------------------------------

def fehlermeldung_versionskonflikt(name_fremd: str, zeit_fremd: str) -> str:
    """L-11: Die Meldung, wenn die Versionsnummer nicht passt."""
    return (
        f"Inzwischen hat {name_fremd} um {zeit_fremd} gespeichert. "
        "Bitte neu laden; Ihre Änderungen gehen dabei verloren."
    )


# ---- Zustand (Sitzungen, Sperren) -----------------------------------------------------

class zustand:
    """Geteilter Zustand des Dienstes (einstufige Sperre)."""

    def __init__(self, daten_pfad, sicherungen_pfad, protokoll_pfad,
                 passwort_pfad, sperre_sekunden):
        self.daten_pfad = daten_pfad
        self.sicherungen_pfad = sicherungen_pfad
        self.protokoll_pfad = protokoll_pfad
        self.passwort_pfad = passwort_pfad
        self.sperre_sekunden = sperre_sekunden
        import threading
        self._lock = threading.Lock()
        self.version = protokoll_version_lesen(protokoll_pfad)
        self.sitzungen = {}
        self.falsche_login = []
        self.sperre_bis = 0.0
        self.sicherungen = []

    # ---- Sitzungen ---------------------------------------------------------

    def sitzung_lesen(self, token):
        if not token:
            return None
        mit = self.sitzungen.get(token)
        if mit is None:
            return None
        if mit["ablauf"] < time.time():
            del self.sitzungen[token]
            return None
        return mit

    def sitzung_anlegen(self, token):
        self.sitzungen[token] = {
            "ablauf": time.time() + SITZUNG_LEBEN_SEKUNDEN,
            "csrf": secrets.token_urlsafe(32),
        }
        return self.sitzungen[token]

    def sitzung_loeschen(self, token):
        self.sitzungen.pop(token, None)

    # ---- Sperren (L-02) -----------------------------------------------------

    def falsche_anmeldung_melden(self, zeit):
        mit = self._lock
        with mit:
            self.falsche_login = [t for t in self.falsche_login
                                  if zeit - t <= SPERRE_FENSTER_SEKUNDEN]
            self.falsche_login.append(zeit)
            if len(self.falsche_login) >= SPERRE_FELDLESENDER:
                self.sperre_bis = zeit + self.sperre_sekunden
                self.falsche_login = []

    def gesperrt_bis(self, zeit):
        mit = self._lock
        with mit:
            return self.sperre_bis if self.sperre_bis > zeit else 0.0

    # ---- Version (L-11) ------------------------------------------------------

    def version_erhoehen(self):
        """Erhöht die Versionsnummer um 1 und gibt sie zurück.

        Rufen Sie nur außerhalb eines Locks auf;
        `speichern` und `zurueckholen` halten den Lock bereits.
        """
        self.version += 1
        return self.version

    def aktuelle_version(self):
        mit = self._lock
        with mit:
            return self.version

    # ---- Sicherungen-Liste (L-15) --------------------------------------------

    def sicherung_melden(self, name, zeit, version, name_person):
        """Legt eine Sicherung in die Liste (L-15).

        Rufen Sie nur außerhalb eines Locks auf;
        `speichern` und `zurueckholen` halten den Lock bereits.
        """
        self.sicherungen.insert(0, {
            "name": name, "zeit": zeit,
            "version": version, "name_person": name_person,
        })
        self.sicherungen = self.sicherungen[:200]
