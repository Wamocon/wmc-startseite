"""Unit-Tests für scripts/pruefe_sprueche.py (T-01, Regeln V-11 bis V-15).

Ausführung: python3 -m unittest discover -s tests
Je mindestens ein Test je Regel V-11 bis V-15.
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import pruefe_sprueche  # noqa: E402


def beispieldatei():
    return {
        "stand": "2026-10-28",
        "sprueche": [
            "Heute ist ein wunderbarer Tag, um Großartiges zu schaffen.",
            "Auch ein kleiner Erfolg ist ein Erfolg.",
            "Lernen ist nie verlorene Zeit.",
            "Manchmal ist der einfachste Weg auch der beste.",
            "Gute IT merkt man daran, dass man sie nicht merkt.",
        ],
    }


def pruefen(daten):
    """Liefert die Liste der gemeldeten Fehler für eine Struktur."""
    fehler = []
    pruefe_sprueche.pruefe(daten, fehler)
    return fehler


def schreiben(daten):
    """Schreibt eine Struktur in eine temporäre Datei und liefert den Namen."""
    tmp = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
    json.dump(daten, tmp, ensure_ascii=False)
    tmp.close()
    return tmp.name


class TestV11(unittest.TestCase):
    """V-11: Lesbares UTF-8, gültiges JSON, Objekt mit genau stand und sprueche."""

    def test_unbekanntes_topfeld(self):
        daten = beispieldatei()
        daten["zusatz"] = True
        fehler = pruefen(daten)
        self.assertTrue(any("zusatz" in f and "Unbekanntes Feld" in f for f in fehler))

    def test_fehlendes_pflichtfeld_stand(self):
        daten = beispieldatei()
        del daten["stand"]
        fehler = pruefen(daten)
        self.assertTrue(any(f.startswith("stand:") and "fehlt" in f for f in fehler))

    def test_fehlendes_pflichtfeld_sprueche(self):
        daten = beispieldatei()
        del daten["sprueche"]
        fehler = pruefen(daten)
        self.assertTrue(any(f.startswith("sprueche:") and "fehlt" in f for f in fehler))

    def test_nicht_objekt(self):
        fehler = pruefen([1, 2, 3])
        self.assertTrue(any("JSON-Objekt" in f for f in fehler))

    def test_sprueche_falscher_typ(self):
        daten = beispieldatei()
        daten["sprueche"] = "ein einzelner Satz"
        fehler = pruefen(daten)
        self.assertTrue(any("Liste" in f for f in fehler))

    def test_ungueltiges_json_gibt_exit_1(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
            tmp.write("{ dies ist kein json ")
            name = tmp.name
        try:
            ergebnis = subprocess.run(
                [sys.executable, "scripts/pruefe_sprueche.py", name],
                capture_output=True, text=True)
            self.assertEqual(ergebnis.returncode, 1)
            self.assertIn("JSON", ergebnis.stdout)
        finally:
            os.unlink(name)


class TestV12(unittest.TestCase):
    """V-12: stand ist ein echtes Kalenderdatum JJJJ-MM-TT."""

    def test_unmoegliches_datum(self):
        daten = beispieldatei()
        daten["stand"] = "2026-02-30"
        fehler = pruefen(daten)
        self.assertTrue(any("2026-02-30" in f and "Kalenderdatum" in f for f in fehler))

    def test_falsches_format(self):
        daten = beispieldatei()
        daten["stand"] = "28.10.2026"
        fehler = pruefen(daten)
        self.assertTrue(any("JJJJ-MM-TT" in f for f in fehler))

    def test_keine_zeichenkette(self):
        daten = beispieldatei()
        daten["stand"] = 20261028
        fehler = pruefen(daten)
        self.assertTrue(any(f.startswith("stand:") and "Zeichenkette" in f for f in fehler))

    def test_gueltiges_datum_kein_fehler(self):
        daten = beispieldatei()
        daten["stand"] = "2026-12-31"
        fehler = [f for f in pruefen(daten) if f.startswith("stand:")]
        self.assertEqual(fehler, [])


class TestV13(unittest.TestCase):
    """V-13: Liste mit mindestens einem Eintrag, Zeichenketten 1 bis 90 Zeichen,
    ohne Leerzeichen am Anfang und Ende."""

    def test_leere_liste(self):
        daten = beispieldatei()
        daten["sprueche"] = []
        fehler = pruefen(daten)
        self.assertTrue(any("mindestens einen Satz" in f for f in fehler))

    def test_keine_zeichenkette(self):
        daten = beispieldatei()
        daten["sprueche"][0] = 42
        fehler = pruefen(daten)
        self.assertTrue(any("sprueche[0]" in f and "Zeichenkette" in f for f in fehler))

    def test_leerer_satz(self):
        daten = beispieldatei()
        daten["sprueche"][1] = ""
        fehler = pruefen(daten)
        self.assertTrue(any("sprueche[1]" in f and "nicht leer" in f for f in fehler))

    def test_satz_zu_lang(self):
        daten = beispieldatei()
        daten["sprueche"][2] = "x" * 91
        fehler = pruefen(daten)
        self.assertTrue(any("sprueche[2]" in f and "90" in f for f in fehler))

    def test_satz_mit_leerzeichen_am_anfang(self):
        daten = beispieldatei()
        daten["sprueche"][3] = " Vorname"
        fehler = pruefen(daten)
        self.assertTrue(any("sprueche[3]" in f and "Leerzeichen" in f for f in fehler))

    def test_satz_mit_leerzeichen_am_ende(self):
        daten = beispieldatei()
        daten["sprueche"][4] = "Nachname "
        fehler = pruefen(daten)
        self.assertTrue(any("sprueche[4]" in f and "Leerzeichen" in f for f in fehler))

    def test_satz_genau_90_zeichen_gueltig(self):
        daten = beispieldatei()
        daten["sprueche"][0] = "x" * 90
        fehler = [f for f in pruefen(daten) if "sprueche[0]" in f]
        self.assertEqual(fehler, [])


class TestV14(unittest.TestCase):
    """V-14: Kein Satz kommt zweimal vor."""

    def test_doppelter_satz(self):
        daten = beispieldatei()
        daten["sprueche"].append(daten["sprueche"][0])
        fehler = pruefen(daten)
        meldungen = [f for f in fehler if "mehrfach" in f]
        self.assertEqual(len(meldungen), 2)
        # Beide Stellen werden genannt.
        self.assertTrue(any(f.startswith("sprueche[0]:") for f in meldungen))
        self.assertTrue(any(f.startswith(f"sprueche[{len(daten['sprueche']) - 1}]:")
                            for f in meldungen))

    def test_unterschiedliche_saetze_kein_fehler(self):
        daten = beispieldatei()
        fehler = [f for f in pruefen(daten) if "mehrfach" in f]
        self.assertEqual(fehler, [])


class TestV15(unittest.TestCase):
    """V-15: Ausgabe wie V-09: OK-Zeile, FEHLER-Zeilen, Exit-Codes."""

    def test_ok_ausgabe_exakt(self):
        name = schreiben(beispieldatei())
        try:
            ergebnis = subprocess.run(
                [sys.executable, "scripts/pruefe_sprueche.py", name],
                capture_output=True, text=True)
            self.assertEqual(ergebnis.returncode, 0)
            zeilen = ergebnis.stdout.strip().splitlines()
            self.assertEqual(len(zeilen), 1)
            self.assertEqual(zeilen[0], "OK: 5 Sprüche")
        finally:
            os.unlink(name)

    def test_fehler_zeilen_format(self):
        daten = beispieldatei()
        daten["sprueche"][0] = ""
        daten["sprueche"][1] = "x" * 91
        name = schreiben(daten)
        try:
            ergebnis = subprocess.run(
                [sys.executable, "scripts/pruefe_sprueche.py", name],
                capture_output=True, text=True)
            self.assertEqual(ergebnis.returncode, 1)
            zeilen = ergebnis.stdout.strip().splitlines()
            self.assertEqual(len(zeilen), 2)
            self.assertTrue(all(z.startswith("FEHLER: ") for z in zeilen))
            self.assertTrue(any("sprueche[0]" in z for z in zeilen))
            self.assertTrue(any("sprueche[1]" in z for z in zeilen))
        finally:
            os.unlink(name)

    def test_fehlender_dateiname_gibt_exit_2(self):
        ergebnis = subprocess.run(
            [sys.executable, "scripts/pruefe_sprueche.py"],
            capture_output=True, text=True,
            cwd=os.path.join(os.path.dirname(__file__), ".."))
        self.assertEqual(ergebnis.returncode, 2)
        self.assertIn("Aufruf", ergebnis.stdout)

    def test_fehlende_datei_gibt_exit_1(self):
        ergebnis = subprocess.run(
            [sys.executable, "scripts/pruefe_sprueche.py",
             "daten/gibt-es-nicht.json"],
            capture_output=True, text=True,
            cwd=os.path.join(os.path.dirname(__file__), ".."))
        self.assertEqual(ergebnis.returncode, 1)
        self.assertIn("FEHLER", ergebnis.stdout)

    def test_meldungen_auf_deutsch(self):
        daten = beispieldatei()
        daten["sprueche"][0] = ""
        fehler = pruefen(daten)
        meldung = next(f for f in fehler if "sprueche[0]" in f)
        # Deutsch: „nicht leer“ statt „empty“.
        self.assertIn("nicht leer", meldung)


if __name__ == "__main__":
    unittest.main()
