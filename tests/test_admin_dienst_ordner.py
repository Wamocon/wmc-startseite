#!/usr/bin/env python3
"""A-0104: Dienst liest und schreibt die Liste mit --daten ORDNER (B-05)."""
import json
import os
import tempfile
import unittest


class TestDienstOrdner(unittest.TestCase):
    """Der Dienst nimmt einen Ordner als --daten und liest links.json darin."""

    def test_liest_und_schreibt_links_json_im_Ordner(self):
        """Aufruf wie in B-05: --daten ist ein Ordner, links.json liegt darin."""
        import admin.kern as kern

        with tempfile.TemporaryDirectory() as tmp:
            daten_ordner = os.path.join(tmp, "daten")
            sicherungen_ordner = os.path.join(tmp, "sicherungen")
            protokoll_pfad = os.path.join(tmp, "protokoll.jsonl")
            passwort_pfad = os.path.join(tmp, "passwort.json")

            # Passwort anlegen.
            with open(passwort_pfad, "w", encoding="utf-8") as f:
                json.dump({"passwort": "test"}, f)

            # Beispielliste in den Ordner kopieren.
            with open("daten/beispiel/links.json", "r", encoding="utf-8") as f:
                liste = json.load(f)

            os.makedirs(daten_ordner, exist_ok=True)
            links_pfad = os.path.join(daten_ordner, "links.json")
            with open(links_pfad, "w", encoding="utf-8") as f:
                json.dump(liste, f, indent=2)

            # Zustand wie in dienst.main bauen.
            z = kern.zustand(
                daten_pfad=os.path.abspath(links_pfad),
                sicherungen_pfad=os.path.abspath(sicherungen_ordner),
                protokoll_pfad=os.path.abspath(protokoll_pfad),
                passwort_pfad=os.path.abspath(passwort_pfad),
                sperre_sekunden=600,
            )
            os.makedirs(z.sicherungen_pfad, exist_ok=True)

            # Liste lesen.
            gelesene = kern.liste_lesen(z.daten_pfad)
            self.assertTrue(
                "bereiche" in gelesene,
                "Die gelesene Liste hat kein 'bereiche'-Feld.",
            )
            self.assertEqual(
                len(gelesene["bereiche"]),
                len(liste["bereiche"]),
                "Anzahl der Bereiche stimmt nicht.",
            )

            # Unverändert speichern ergibt dieselbe Liste, nur 'stand' ist heute.
            kern.liste_schreiben(gelesene, z.daten_pfad)
            geschriebene = kern.liste_lesen(z.daten_pfad)
            for b in liste["bereiche"]:
                gefunden = [x for x in geschriebene["bereiche"] if x["id"] == b["id"]]
                self.assertTrue(
                    len(gefunden) == 1,
                    f"Bereich {b['id']} fehlt nach dem Schreiben.",
                )
                self.assertEqual(
                    gefunden[0]["titel"],
                    b["titel"],
                    f"Bereiche {b['id']}: Titel stimmt nicht.",
                )


if __name__ == "__main__":
    unittest.main()
