"""Unit-Tests für scripts/pruefe_links.py (T-01).

Ausführung: python3 -m unittest discover -s tests
Je mindestens ein Test je Regel V-02 bis V-09.
"""

import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import pruefe_links  # noqa: E402

BEISPIELDATEI = os.path.join(os.path.dirname(__file__), "..", "daten", "beispiel",
                             "links.json")


def beispieldatei():
    with open(BEISPIELDATEI, "r", encoding="utf-8") as quelle:
        return json.load(quelle)


def pruefen(daten):
    """Liefert die Liste der gemeldeten Fehler für eine Struktur."""
    fehler = []
    pruefe_links.pruefe(daten, fehler)
    return fehler


class TestV01(unittest.TestCase):
    """V-01: Lesbares UTF-8 und gültiges JSON, fehlende Datei."""

    def test_gueltige_datei_gibt_ok(self):
        ergebnis = subprocess.run(
            [sys.executable, "scripts/pruefe_links.py", "daten/beispiel/links.json"],
            capture_output=True, text=True, cwd=os.path.join(os.path.dirname(__file__), ".."))
        self.assertEqual(ergebnis.returncode, 0)
        self.assertEqual(ergebnis.stdout.strip(), "OK: 6 Bereiche, 20 Links")

    def test_fehlende_datei_gibt_exit_1(self):
        ergebnis = subprocess.run(
            [sys.executable, "scripts/pruefe_links.py", "daten/gibt-es-nicht.json"],
            capture_output=True, text=True, cwd=os.path.join(os.path.dirname(__file__), ".."))
        self.assertEqual(ergebnis.returncode, 1)
        self.assertIn("FEHLER", ergebnis.stdout)

    def test_ungueltiges_json_gibt_exit_1(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
            tmp.write("{ dies ist kein json ")
            name = tmp.name
        try:
            ergebnis = subprocess.run(
                [sys.executable, "scripts/pruefe_links.py", name],
                capture_output=True, text=True)
            self.assertEqual(ergebnis.returncode, 1)
            self.assertIn("JSON", ergebnis.stdout)
        finally:
            os.unlink(name)

    def test_fehlender_dateiname_gibt_exit_2(self):
        ergebnis = subprocess.run(
            [sys.executable, "scripts/pruefe_links.py"],
            capture_output=True, text=True, cwd=os.path.join(os.path.dirname(__file__), ".."))
        self.assertEqual(ergebnis.returncode, 2)
        self.assertIn("Aufruf", ergebnis.stdout)


class TestV02(unittest.TestCase):
    """V-02: Pflichtfelder, Typen, erlaubte Werte, unbekannte Felder."""

    def test_unbekanntes_topfeld(self):
        daten = beispieldatei()
        daten["unbekannt"] = True
        fehler = pruefen(daten)
        self.assertTrue(any("unbekannt" in f and "Unbekanntes Feld" in f for f in fehler))

    def test_fehlendes_pflichtfeld(self):
        daten = beispieldatei()
        del daten["stand"]
        fehler = pruefen(daten)
        self.assertTrue(any(f.startswith("stand:") and "fehlt" in f for f in fehler))

    def test_falscher_typ(self):
        daten = beispieldatei()
        daten["standardFavoriten"] = "outlook"
        fehler = pruefen(daten)
        self.assertTrue(any("Liste" in f for f in fehler))

    def test_marke_ausserhalb_der_werte(self):
        daten = beispieldatei()
        daten["bereiche"][0]["marke"] = "x"
        fehler = pruefen(daten)
        self.assertTrue(any("marke" in f and "wma" in f for f in fehler))

    def test_unbekanntes_linkfeld(self):
        daten = beispieldatei()
        daten["bereiche"][0]["links"][0]["zusatz"] = 1
        fehler = pruefen(daten)
        self.assertTrue(any("zusatz" in f and "Unbekanntes Feld" in f for f in fehler))


class TestV03(unittest.TestCase):
    """V-03: stand ist ein echtes Kalenderdatum."""

    def test_unmoegliches_datum(self):
        daten = beispieldatei()
        daten["stand"] = "2026-02-30"
        fehler = pruefen(daten)
        self.assertTrue(any("2026-02-30" in f and "Kalenderdatum" in f for f in fehler))

    def test_falsches_format(self):
        daten = beispieldatei()
        daten["stand"] = "21.10.2026"
        fehler = pruefen(daten)
        self.assertTrue(any("JJJJ-MM-TT" in f for f in fehler))

    def test_gueltiges_datum_kein_fehler(self):
        daten = beispieldatei()
        daten["stand"] = "2026-02-28"
        fehler = [f for f in pruefen(daten) if f.startswith("stand:")]
        self.assertEqual(fehler, [])


class TestV04(unittest.TestCase):
    """V-04: Bereichs-IDs eindeutig."""

    def test_doppelte_bereichs_id(self):
        daten = beispieldatei()
        daten["bereiche"][1]["id"] = "kommunikation"
        fehler = pruefen(daten)
        self.assertTrue(any("kommunikation" in f and "Bereich-ID" in f for f in fehler))


class TestV05(unittest.TestCase):
    """V-05: Link-IDs über alle Bereiche eindeutig."""

    def test_doppelte_link_id_across_bereiche(self):
        daten = beispieldatei()
        # outlook liegt in Bereich 0; kopiere die ID nach Bereich 1 (jira)
        daten["bereiche"][1]["links"][0]["id"] = "outlook"
        fehler = pruefen(daten)
        self.assertTrue(any("outlook" in f and "Link-ID" in f for f in fehler))


class TestV06(unittest.TestCase):
    """V-06: URLs beginnen mit http(s) und enthalten keine Leerzeichen."""

    def test_url_ohne_protokoll(self):
        daten = beispieldatei()
        daten["bereiche"][0]["links"][0]["url"] = "outlook.office.com/mail/"
        fehler = pruefen(daten)
        self.assertTrue(any("https://" in f or "http://" in f for f in fehler))

    def test_url_mit_leerzeichen(self):
        daten = beispieldatei()
        daten["bereiche"][0]["links"][0]["url"] = "https://example .com/x"
        fehler = pruefen(daten)
        self.assertTrue(any("Leerzeichen" in f for f in fehler))

    def test_hilfe_url_ohne_protokoll(self):
        daten = beispieldatei()
        daten["hilfe"]["url"] = "example.com/it-ticket"
        fehler = pruefen(daten)
        self.assertTrue(any(f.startswith("hilfe.url") for f in fehler))


class TestV07(unittest.TestCase):
    """V-07: standardFavoriten referenzieren existente Link-IDs."""

    def test_unbekannte_favoriten_id(self):
        daten = beispieldatei()
        daten["standardFavoriten"].append("keine-gueltige-id")
        fehler = pruefen(daten)
        self.assertTrue(any("keine-gueltige-id" in f and "standardFavoriten" in f
                            for f in fehler))


class TestV08(unittest.TestCase):
    """V-08: Längen und Muster."""

    def test_name_zu_lang(self):
        daten = beispieldatei()
        daten["bereiche"][0]["links"][0]["name"] = "x" * 41
        fehler = pruefen(daten)
        self.assertTrue(any("name" in f and "40" in f for f in fehler))

    def test_beschreibung_zu_lang(self):
        daten = beispieldatei()
        daten["bereiche"][0]["links"][0]["beschreibung"] = "x" * 61
        fehler = pruefen(daten)
        self.assertTrue(any("beschreibung" in f and "60" in f for f in fehler))

    def test_id_zu_lang(self):
        daten = beispieldatei()
        daten["bereiche"][0]["links"][0]["id"] = "a" * 41
        fehler = pruefen(daten)
        self.assertTrue(any("id" in f and "40" in f for f in fehler))

    def test_id_groesser_buchstaben(self):
        daten = beispieldatei()
        daten["bereiche"][0]["links"][0]["id"] = "Outlook"
        fehler = pruefen(daten)
        self.assertTrue(any("links[0].id" in f and "Ungültige ID" in f for f in fehler))

    def test_kuerzel_zu_lang(self):
        daten = beispieldatei()
        daten["bereiche"][0]["links"][0]["kuerzel"] = "ABCDEF"
        fehler = pruefen(daten)
        self.assertTrue(any("kuerzel" in f and "Ungültiges Kürzel" in f for f in fehler))

    def test_kuerzel_ungueltiges_zeichen(self):
        daten = beispieldatei()
        daten["bereiche"][0]["links"][0]["kuerzel"] = "a"
        fehler = pruefen(daten)
        self.assertTrue(any("kuerzel" in f and "Ungültiges Kürzel" in f for f in fehler))

    def test_kuerzel_mit_umlaut_gueltig(self):
        daten = beispieldatei()
        daten["bereiche"][0]["links"][0]["kuerzel"] = "ÄÖ"
        fehler = [f for f in pruefen(daten) if "kuerzel" in f]
        self.assertEqual(fehler, [])


class TestV09(unittest.TestCase):
    """V-09: Ausgabeformat und Exit-Codes."""

    def test_ok_ausgabe_exakt(self):
        ergebnis = subprocess.run(
            [sys.executable, "scripts/pruefe_links.py", "daten/beispiel/links.json"],
            capture_output=True, text=True, cwd=os.path.join(os.path.dirname(__file__), ".."))
        zeilen = ergebnis.stdout.strip().splitlines()
        self.assertEqual(len(zeilen), 1)
        self.assertEqual(zeilen[0], "OK: 6 Bereiche, 20 Links")

    def test_fehler_zeilen_format(self):
        daten = beispieldatei()
        daten["bereiche"][2]["links"][0]["url"] = "example.com/zeiterfassung"
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
            json.dump(daten, tmp)
            name = tmp.name
        try:
            ergebnis = subprocess.run(
                [sys.executable, "scripts/pruefe_links.py", name],
                capture_output=True, text=True)
            self.assertEqual(ergebnis.returncode, 1)
            zeilen = ergebnis.stdout.strip().splitlines()
            self.assertTrue(all(z.startswith("FEHLER: ") for z in zeilen))
            self.assertTrue(any("bereiche[2].links[0].url" in z for z in zeilen))
        finally:
            os.unlink(name)


class TestV10(unittest.TestCase):
    """V-10: Fehlermeldungen auf Deutsch und nachvollziehbar."""

    def test_meldung_besreibt_den_grund(self):
        daten = beispieldatei()
        daten["bereiche"][0]["marke"] = "falsch"
        fehler = pruefen(daten)
        meldung = next(f for f in fehler if "marke" in f)
        # Nennt die erlaubten Werte, damit die IT den Fehler ohne Hilfe findet.
        self.assertIn("wmc", meldung)
        self.assertIn("wma", meldung)
        self.assertIn("beide", meldung)


if __name__ == "__main__":
    unittest.main()
