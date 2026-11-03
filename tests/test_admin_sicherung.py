#!/usr/bin/env python3
"""L-10, L-15: Zwei Sicherungen in derselben Sekunde überschreiben sich nicht."""
import os
import sys
import tempfile
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "admin"))
import kern  # noqa: E402

SEKUNDE = time.struct_time((2026, 10, 31, 12, 0, 0, 4, 304, 0))


class TestSicherungLegen(unittest.TestCase):

    def test_zwei_sicherungen_in_derselben_sekunde(self):
        with tempfile.TemporaryDirectory() as ordner:
            liste = os.path.join(ordner, "links.json")
            ziel = os.path.join(ordner, "sicherungen")
            os.mkdir(ziel)
            with mock.patch.object(kern.time, "localtime", return_value=SEKUNDE):
                with open(liste, "w", encoding="utf-8") as datei:
                    datei.write('{"stand": "erster"}')
                erste = kern.sicherung_legen(liste, ziel)
                with open(liste, "w", encoding="utf-8") as datei:
                    datei.write('{"stand": "zweiter"}')
                zweite = kern.sicherung_legen(liste, ziel)
            self.assertEqual(erste, "links.2026-10-31-120000.json")
            self.assertEqual(zweite, "links.2026-10-31-120000-2.json")
            self.assertTrue(kern.sicherung_name_ist_gueltig(zweite))
            self.assertEqual(kern.sicherung_laden(ziel, erste), {"stand": "erster"})
            self.assertEqual(kern.sicherung_laden(ziel, zweite), {"stand": "zweiter"})
            liste_neu = kern.sicherungen_auflisten(ziel, os.path.join(ordner, "fehlt.jsonl"))
            self.assertEqual([s["name"] for s in liste_neu], [zweite, erste])


if __name__ == "__main__":
    unittest.main()
