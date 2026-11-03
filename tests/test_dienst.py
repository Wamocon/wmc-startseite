"""End-to-End-Test für den Dienst (A-0104, T-03).

Läuft mit:
    python3 tests/test_dienst.py

oder, wenn die Umgebung es erlaubt:
    python3 -m unittest discover -s tests

Voraussetzung: `python3` darf aus `tests/` importieren. Die Tests brauchen
keine externe Verbindung – der Dienst läuft auf 127.0.0.1 auf einem
zufälligen Port, den der Test wählt.
"""

import json
import os
import socket
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
import http.server

# admin/ importieren
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "admin"))
import kern  # noqa: E402
import dienst  # noqa: E402


def frei_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def http_json(url, methode="GET", daten=None, kopfe=None):
    kopfe = dict(kopfe or {})
    byts = None
    if daten is not None:
        byts = json.dumps(daten).encode("utf-8")
        kopfe["Content-Type"] = "application/json"
    anfrage = urllib.request.Request(url, data=byts, method=methode, headers=kopfe)
    try:
        mit_urllib = urllib.request.urlopen(anfrage, timeout=5)
        roher = mit_urllib.read().decode("utf-8")
        status = mit_urllib.status
        antwort_kopfe = dict(mit_urllib.headers)
    except urllib.error.HTTPError as fehler:
        roher = fehler.read().decode("utf-8")
        status = fehler.code
        antwort_kopfe = dict(fehler.headers)
    try:
        parsed = json.loads(roher) if roher else {}
    except json.JSONDecodeError:
        parsed = {"roher": roher}
    return status, parsed, antwort_kopfe


class TestDienst(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        basis = self.tmp.name
        self.daten_pfad = os.path.join(basis, "links.json")
        self.sicherungen_pfad = os.path.join(basis, "sicherungen")
        self.protokoll_pfad = os.path.join(basis, "protokoll.jsonl")
        self.passwort_pfad = os.path.join(basis, "passwort.json")
        os.makedirs(self.sicherungen_pfad, exist_ok=True)

        # Beispiel-Liste (gültig, 1 Bereich, 1 Link).
        liste = {
            "stand": "2026-10-30",
            "hilfe": {"name": "IT-Support", "url": "https://it.wamocon.de"},
            "standardFavoriten": [],
            "bereiche": [
                {
                    "id": "arbeitsplaetze",
                    "titel": "Arbeitsplätze",
                    "marke": "beide",
                    "links": [
                        {
                            "id": "github",
                            "name": "GitHub",
                            "beschreibung": "Quellcode-Verwaltung",
                            "url": "https://github.com/Wamocon",
                        },
                    ],
                },
            ],
        }
        with open(self.daten_pfad, "w", encoding="utf-8") as ziel:
            ziel.write(json.dumps(liste, ensure_ascii=False, indent=2))

        kern.passwort_datei_schreiben("geheim", self.passwort_pfad)

        self.port = frei_port()
        self.zustand = kern.zustand(
            daten_pfad=self.daten_pfad,
            sicherungen_pfad=self.sicherungen_pfad,
            protokoll_pfad=self.protokoll_pfad,
            passwort_pfad=self.passwort_pfad,
            sperre_sekunden=600,
        )
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", self.port), dienst.handler)
        self.server.zustand = self.zustand
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)

    # ---- T-03: Anmeldung ---------------------------------------------------

    def test_anmelden_ok(self):
        status, parsed, kopfe = http_json(
            f"http://127.0.0.1:{self.port}/admin/api/anmelden",
            "POST", {"passwort": "geheim"})
        self.assertEqual(status, 200)
        self.assertIn("token", parsed)
        cookie = kopfe.get("Set-Cookie", "")
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)

    def test_anmelden_falsches_passwort(self):
        status, parsed, _ = http_json(
            f"http://127.0.0.1:{self.port}/admin/api/anmelden",
            "POST", {"passwort": "falsch"})
        self.assertEqual(status, 401)
        self.assertIn("fehler", parsed)

    def test_anmelden_leer(self):
        status, parsed, _ = http_json(
            f"http://127.0.0.1:{self.port}/admin/api/anmelden",
            "POST", {"passwort": ""})
        self.assertEqual(status, 400)

    # ---- T-03: Sperre nach Fehlversuchen ------------------------------------

    def test_sperre_nach_fuenf_falschen(self):
        url = f"http://127.0.0.1:{self.port}/admin/api/anmelden"
        for _ in range(5):
            status, _, _ = http_json(url, "POST", {"passwort": "falsch"})
            self.assertEqual(status, 401)
        # Der 6. Versuch wird gesperrt, auch mit richtigem Passwort.
        status, parsed, _ = http_json(url, "POST", {"passwort": "geheim"})
        self.assertEqual(status, 429)
        self.assertIn("Zu viele", parsed["fehler"])

    # ---- T-03: Prüfung beim Speichern ----------------------------------------

    def test_speichern_ungueltig(self):
        status, parsed, _ = self._anmelden_und_speichern(
            {"daten": {"bereiche": []}, "version": 0, "name": "Erwin"})
        self.assertEqual(status, 400)

    def test_speichern_ok(self):
        liste = {
            "stand": "2026-10-30",
            "hilfe": {"name": "IT-Support", "url": "https://it.wamocon.de"},
            "standardFavoriten": [],
            "bereiche": [
                {
                    "id": "arbeitsplaetze",
                    "titel": "Arbeitsplätze",
                    "marke": "beide",
                    "links": [
                        {
                            "id": "github",
                            "name": "GitHub",
                            "beschreibung": "Quellcode-Verwaltung",
                            "url": "https://github.com/Wamocon",
                        },
                    ],
                },
            ],
        }
        status, parsed, _ = self._anmelden_und_speichern(
            {"daten": liste, "version": 0, "name": "Erwin"})
        self.assertEqual(status, 200)
        self.assertEqual(parsed["version"], 1)

    # ---- T-03: Versionskonflikt ----------------------------------------------

    def test_versionskonflikt(self):
        url = f"http://127.0.0.1:{self.port}/admin/api/speichern"
        token, cookie = self._anmelden()
        liste = {
            "stand": "2026-10-30",
            "hilfe": {"name": "IT-Support", "url": "https://it.wamocon.de"},
            "standardFavoriten": [],
            "bereiche": [
                {
                    "id": "arbeitsplaetze",
                    "titel": "Arbeitsplätze",
                    "marke": "beide",
                    "links": [
                        {
                            "id": "github",
                            "name": "GitHub",
                            "beschreibung": "Quellcode-Verwaltung",
                            "url": "https://github.com/Wamocon",
                        },
                    ],
                },
            ],
        }
        status, parsed, _ = http_json(
            url, "POST",
            {"daten": liste, "version": 0, "name": "Erwin"},
            kopfe={"Cookie": cookie, "X-CSRF-Token": token})
        self.assertEqual(status, 200)
        # Zweiter Versuch mit der alten Version.
        status, parsed, _ = http_json(
            url, "POST",
            {"daten": liste, "version": 0, "name": "Erwin"},
            kopfe={"Cookie": cookie, "X-CSRF-Token": token})
        self.assertEqual(status, 409)
        self.assertIn("Bitte neu laden", parsed["fehler"])

    # ---- T-03: CSRF ------------------------------------------------------------

    def test_csrf_fehlt(self):
        url = f"http://127.0.0.1:{self.port}/admin/api/speichern"
        _, cookie = self._anmelden()
        status, parsed, _ = http_json(
            url, "POST",
            {"daten": {"bereiche": []}, "version": 0, "name": "Erwin"},
            kopfe={"Cookie": cookie})
        self.assertEqual(status, 400)
        self.assertIn("Token", parsed["fehler"])

    def test_csrf_falsch(self):
        url = f"http://127.0.0.1:{self.port}/admin/api/speichern"
        _, cookie = self._anmelden()
        status, parsed, _ = http_json(
            url, "POST",
            {"daten": {"Bereiche": []}, "version": 0, "name": "Erwin"},
            kopfe={"Cookie": cookie, "X-CSRF-Token": "falsch"})
        self.assertEqual(status, 400)

    # ---- T-03: Sicherung --------------------------------------------------------

    def test_sicherung_wird_gelegt(self):
        liste = {
            "stand": "2026-10-30",
            "hilfe": {"name": "IT-Support", "url": "https://it.wamocon.de"},
            "standardFavoriten": [],
            "bereiche": [
                {
                    "id": "arbeitsplaetze",
                    "titel": "Arbeitsplätze",
                    "marke": "beide",
                    "links": [
                        {
                            "id": "github",
                            "name": "GitHub",
                            "beschreibung": "Quellcode-Verwaltung",
                            "url": "https://github.com/Wamocon",
                        },
                    ],
                },
            ],
        }
        status, parsed, _ = self._anmelden_und_speichern(
            {"daten": liste, "version": 0, "name": "Erwin"})
        self.assertEqual(status, 200)
        sicherungen = os.listdir(self.sicherungen_pfad)
        self.assertTrue(any(n.startswith("links.") and n.endswith(".json")
                            for n in sicherungen))

    # ---- T-03: Protokoll -----------------------------------------------------------

    def test_protokoll_zeile(self):
        liste = {
            "stand": "2026-10-30",
            "hilfe": {"name": "IT-Support", "url": "https://it.wamocon.de"},
            "standardFavoriten": [],
            "bereiche": [
                {
                    "id": "arbeitsplaetze",
                    "titel": "Arbeitsplätze",
                    "marke": "beide",
                    "links": [
                        {
                            "id": "github",
                            "name": "GitHub",
                            "beschreibung": "Quellcode-Verwaltung",
                            "url": "https://github.com/Wamocon",
                        },
                    ],
                },
            ],
        }
        status, _, _ = self._anmelden_und_speichern(
            {"daten": liste, "version": 0, "name": "Erwin"})
        self.assertEqual(status, 200)
        with open(self.protokoll_pfad, "r", encoding="utf-8") as quelle:
            zeile = json.loads(quelle.readline())
        self.assertEqual(zeile["name"], "Erwin")
        self.assertEqual(zeile["version"], 1)

    # ---- T-03: Zurückholen -----------------------------------------------------------

    def test_zurueckholen(self):
        liste = {
            "stand": "2026-10-30",
            "hilfe": {"name": "IT-Support", "url": "https://it.wamocon.de"},
            "standardFavoriten": [],
            "bereiche": [
                {
                    "id": "arbeitsplaetze",
                    "titel": "Arbeitsplätze",
                    "marke": "beide",
                    "links": [
                        {
                            "id": "github",
                            "name": "GitHub",
                            "beschreibung": "Quellcode-Verwaltung",
                            "url": "https://github.com/Wamocon",
                        },
                    ],
                },
            ],
        }
        status, parsed, _ = self._anmelden_und_speichern(
            {"daten": liste, "version": 0, "name": "Erwin"})
        self.assertEqual(status, 200)
        sicherungen = os.listdir(self.sicherungen_pfad)
        sicherung = next(n for n in sicherungen
                         if n.startswith("links.") and n.endswith(".json"))
        url = f"http://127.0.0.1:{self.port}/admin/api/zurueckholen"
        token, cookie = self._anmelden()
        status, parsed, _ = http_json(
            url, "POST",
            {"sicherung": sicherung, "version": parsed["version"], "name": "Erwin"},
            kopfe={"Cookie": cookie, "X-CSRF-Token": token})
        self.assertEqual(status, 200)

    # ---- T-03: 256 KB ------------------------------------------------------------

    def test_zu_gross(self):
        url = f"http://127.0.0.1:{self.port}/admin/api/speichern"
        token, cookie = self._anmelden()
        zu_gross = "x" * (256 * 1024 + 1)
        kopfe = {
            "Cookie": cookie,
            "X-CSRF-Token": token,
            "Content-Type": "application/json",
            "Content-Length": str(len(zu_gross) + 50),
        }
        status, parsed, _ = http_json(
            url, "POST",
            {"daten": {"bereiche": []}, "version": 0, "name": zu_gross},
            kopfe=kopfe)
        # Name ist zu lang -> 400 (Name-Prüfung schlägt zuerst an)
        self.assertIn(status, (400, 413))

    # ---- Helfer --------------------------------------------------------------------

    def _anmelden(self):
        url = f"http://127.0.0.1:{self.port}/admin/api/anmelden"
        status, parsed, kopfe = http_json(url, "POST", {"passwort": "geheim"})
        self.assertEqual(status, 200)
        cookie = kopfe["Set-Cookie"].split(";")[0]
        return parsed["token"], cookie

    def _anmelden_und_speichern(self, koerper):
        token, cookie = self._anmelden()
        url = f"http://127.0.0.1:{self.port}/admin/api/speichern"
        return http_json(url, "POST", koerper,
                         kopfe={"Cookie": cookie, "X-CSRF-Token": token})


if __name__ == "__main__":
    unittest.main(verbosity=2)
