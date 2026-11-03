"""Test für den Kern der Admin-Ansicht (A-0104, T-03).

Dieser Test läuft über `python3 scripts/pruefe_links.py` und prüft die
Logik, die `admin/dienst.py` benutzt: Passwort-Hash, ID aus dem Namen,
Name-Prüfung, Versionskonflikt-Meldung und das Lesen der Passwortdatei.

Die eigentlichen End-to-End-Tests (Anmeldung, Sperre, Sicherung,
atomares Schreiben, CSRF, Zurückholen) brauchen einen laufenden Dienst
und stehen in `tests/test_dienst.py` – sie laufen, wenn `python3
admin/test_dienst.py` ausführbar ist.
"""

import json
import unittest
import os
import sys
import tempfile

# admin/kern.py importieren (sys.path).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "admin"))
import kern  # noqa: E402


class TestKern(unittest.TestCase):
    def test_passwort_hash_und_pruefen(self):
        salz = b"0123456789abcdef"
        hashwert = kern.hashen("geheim", salz)
        self.assertTrue(kern.passwort_pruefen("geheim", salz, hashwert))
        self.assertFalse(kern.passwort_pruefen("falsch", salz, hashwert))

    def test_id_aus_name_eindeutig(self):
        bestehende = set()
        self.assertEqual(kern.id_aus_name("GitHub", bestehende), "github")
        bestehende.add("github")
        self.assertEqual(kern.id_aus_name("GitHub", bestehende), "github-2")
        bestehende.add("github-2")
        self.assertEqual(kern.id_aus_name("GitHub", bestehende), "github-3")

    def test_id_aus_name_speziale_zichen(self):
        bestehende = set()
        self.assertEqual(kern.id_aus_name("GitHub Projects", bestehende), "github-projects")
        self.assertEqual(kern.id_aus_name("Jira / Wamocon", bestehende), "jira-wamocon")
        self.assertEqual(kern.id_aus_name("--", bestehende), "link")

    def test_name_pruefen(self):
        self.assertTrue(kern.name_pruefen("Erwin"))
        self.assertTrue(kern.name_pruefen("x" * 40))
        self.assertFalse(kern.name_pruefen(""))
        self.assertFalse(kern.name_pruefen("   "))
        self.assertFalse(kern.name_pruefen("x" * 41))
        self.assertFalse(kern.name_pruefen(None))

    def test_sicherung_name_gueltig(self):
        self.assertTrue(kern.sicherung_name_ist_gueltig("links.2026-10-30-123456.json"))
        self.assertTrue(kern.sicherung_name_ist_gueltig("links.2026-10-30-123456-2.json"))
        self.assertFalse(kern.sicherung_name_ist_gueltig("links.2026-13-40-123456.json"))
        self.assertFalse(kern.sicherung_name_ist_gueltig("foo.json"))
        self.assertFalse(kern.sicherung_name_ist_gueltig("links.2026-10-30-250000.json"))

    def test_protokoll_lesen_leer(self):
        with tempfile.TemporaryDirectory() as tmp:
            pfad = os.path.join(tmp, "protokoll.jsonl")
            self.assertEqual(kern.protokoll_lesen(pfad), [])

    def test_protokoll_lesen_und_reihenfolge(self):
        with tempfile.TemporaryDirectory() as tmp:
            pfad = os.path.join(tmp, "protokoll.jsonl")
            for i in range(1, 6):
                with open(pfad, "a", encoding="utf-8") as ziel:
                    ziel.write(json.dumps({"version": i, "name": f"p{i}"}) + "\n")
            eintraege = kern.protokoll_lesen(pfad, 3)
            # neueste zuerst
            self.assertEqual([e["version"] for e in eintraege], [5, 4, 3])

    def test_liste_schreiben_atomar(self):
        with tempfile.TemporaryDirectory() as tmp:
            pfad = os.path.join(tmp, "links.json")
            kern.liste_schreiben({"Bereiche": []}, pfad)
            with open(pfad, "r", encoding="utf-8") as quelle:
                selbst = json.load(quelle)
            self.assertEqual(selbst, {"Bereiche": []})

    def test_passwort_datei_lesen_schreiben(self):
        with tempfile.TemporaryDirectory() as tmp:
            pfad = os.path.join(tmp, "passwort.json")
            kern.passwort_datei_schreiben("geheim", pfad)
            daten = kern.passwort_datei_lesen(pfad)
            self.assertTrue(kern.passwort_pruefen("geheim", daten["salz"], daten["hash"]))
            self.assertFalse(kern.passwort_pruefen("falsch", daten["salz"], daten["hash"]))

    def test_stand_heute_format(self):
            heute = kern.stand_heute()
            import re
            self.assertTrue(re.match(r"^\d{4}-\d{2}-\d{2}$", heute))

    def test_fehlermeldung_versionskonflikt_zeigt_uhrzeit(self):
        meldung = kern.fehlermeldung_versionskonflikt("Erwin", "2026-10-30T12:34:56")
        self.assertIn("Inzwischen hat Erwin um 12:34 gespeichert.", meldung)

    def test_fehlermeldung_versionskonflikt(self):
        meldung = kern.fehlermeldung_versionskonflikt("Erwin", "30.10. 12:34")
        self.assertIn("Erwin", meldung)
        self.assertIn("12:34", meldung)
        self.assertIn("Bitte neu laden", meldung)


if __name__ == "__main__":
    import unittest
    unittest.main()
