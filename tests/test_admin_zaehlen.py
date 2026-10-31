#!/usr/bin/env python3
"""L-12: Das Protokoll zählt neue, geänderte und gelöschte Links und Bereiche."""
import copy
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "admin"))
import kern  # noqa: E402


def beispiel():
    pfad = os.path.join(os.path.dirname(__file__), "..", "daten", "beispiel", "links.json")
    with open(pfad, "r", encoding="utf-8") as quelle:
        return json.load(quelle)


class TestAenderungenZaehlen(unittest.TestCase):

    def test_unveraendert_zaehlt_nichts(self):
        alt = beispiel()
        zaehlung = kern.aenderungen_zaehlen(alt, copy.deepcopy(alt))
        self.assertEqual(set(zaehlung.values()), {0})

    def test_link_neu_geaendert_geloescht(self):
        alt = beispiel()
        neu = copy.deepcopy(alt)
        links = neu["bereiche"][0]["links"]
        geloescht = links.pop()
        links[0]["name"] = links[0]["name"] + " neu"
        links.append({"id": "ganz-neu", "name": "Neu", "beschreibung": "Neu", "url": "https://example.org"})
        zaehlung = kern.aenderungen_zaehlen(alt, neu)
        self.assertEqual(zaehlung["links_neu"], 1)
        self.assertEqual(zaehlung["links_geaendert"], 1)
        self.assertEqual(zaehlung["links_geloesch"], 1)
        self.assertNotEqual(geloescht["id"], "ganz-neu")

    def test_link_in_anderen_bereich_ist_geaendert(self):
        alt = beispiel()
        neu = copy.deepcopy(alt)
        link = neu["bereiche"][0]["links"].pop(0)
        neu["bereiche"][1]["links"].append(link)
        zaehlung = kern.aenderungen_zaehlen(alt, neu)
        self.assertEqual(zaehlung["links_geaendert"], 1)
        self.assertEqual(zaehlung["links_neu"] + zaehlung["links_geloesch"], 0)

    def test_bereiche(self):
        alt = beispiel()
        neu = copy.deepcopy(alt)
        neu["bereiche"][0]["titel"] = "Anders"
        neu["bereiche"].append({"id": "neuer-bereich", "titel": "Neu", "marke": "wmc", "links": []})
        zaehlung = kern.aenderungen_zaehlen(alt, neu)
        self.assertEqual(zaehlung["bereiche_neu"], 1)
        self.assertEqual(zaehlung["bereiche_geaendert"], 1)
        self.assertEqual(zaehlung["bereiche_geloesch"], 0)

    def test_ohne_alte_liste(self):
        zaehlung = kern.aenderungen_zaehlen({}, beispiel())
        self.assertGreater(zaehlung["links_neu"], 0)
        self.assertEqual(zaehlung["links_geloesch"], 0)


if __name__ == "__main__":
    unittest.main()
