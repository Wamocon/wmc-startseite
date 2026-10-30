#!/usr/bin/env python3
"""A-0104: admin.js liest und setzt nur Felder aus dem Schema, kein innerHTML."""
import json
import re
import unittest
from pathlib import Path


def schema_lesen():
    with open("schema/links.schema.json", "r", encoding="utf-8") as f:
        return json.load(f)


def admin_js_lesen():
    with open("site/admin/admin.js", "r", encoding="utf-8") as f:
        return f.read()


def felder_im_schema():
    """Sammelt alle Felder aus dem Schema für Liste, Bereich, Link und Hilfe."""
    s = schema_lesen()
    props = s.get("properties", {})
    return {
        "liste": set(props.keys()),
        "bereich": set(s.get("$defs", {}).get("bereich", {}).get("properties", {}).keys()),
        "link": set(s.get("$defs", {}).get("link", {}).get("properties", {}).keys()),
        "hilfe": set(props.get("hilfe", {}).get("properties", {}).keys()),
    }


def felder_in_admin_js():
    """Extrahiert Feldzugriffe aus admin.js: daten.X, bereich.X, link.X, hilfe.X."""
    js = admin_js_lesen()
    return {
        "liste": set(re.findall(r"daten\.(\w+)", js)),
        "bereich": set(re.findall(r"bereich\.(\w+)", js)),
        "link": set(re.findall(r"link\.(\w+)", js)),
        "hilfe": set(re.findall(r"hilfe\.(\w+)", js)),
    }


class TestAdminFelder(unittest.TestCase):
    """admin.js darf nur Felder verwenden, die im Schema stehen."""

    def test_kein_innerHTML(self):
        """admin.js enthält kein innerHTML (L-13)."""
        js = admin_js_lesen()
        self.assertNotIn("innerHTML", js)

    def test_felder_im_schema(self):
        """Jedes Feld, das admin.js liest oder setzt, steht im Schema."""
        schema = felder_im_schema()
        js = felder_in_admin_js()

        # Liste: alle Felder von admin.js dürfen im Schema sein.
        # (Ausnahme: "bereiche" ist das eigentliche Feld, "stand", "hilfe", "standardFavoriten")
        fehlende_liste = js["liste"] - schema["liste"]
        self.assertTrue(
            len(fehlende_liste) == 0,
            f"admin.js verwendet Liste-Felder, die im Schema fehlen: {fehlende_liste}",
        )

        # Bereich: alle Felder von admin.js dürfen im Schema sein.
        fehlende_bereich = js["bereich"] - schema["bereich"]
        self.assertTrue(
            len(fehlende_bereich) == 0,
            f"admin.js verwendet Bereich-Felder, die im Schema fehlen: {fehlende_bereich}",
        )

        # Link: alle Felder von admin.js dürfen im Schema sein.
        fehlende_link = js["link"] - schema["link"]
        self.assertTrue(
            len(fehlende_link) == 0,
            f"admin.js verwendet Link-Felder, die im Schema fehlen: {fehlende_link}",
        )

        # Hilfe: alle Felder von admin.js dürfen im Schema sein.
        fehlende_hilfe = js["hilfe"] - schema["hilfe"]
        self.assertTrue(
            len(fehlende_hilfe) == 0,
            f"admin.js verwendet Hilfe-Felder, die im Schema fehlen: {fehlende_hilfe}",
        )


if __name__ == "__main__":
    unittest.main()
