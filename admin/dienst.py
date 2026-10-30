"""Dienst zum Speichern der Linkliste (B-05, L-02 bis L-15, T-03).

Aufruf:
    python3 admin/dienst.py --adresse ADRESSE --port PORT --daten ORDNER \
        --sicherungen ORDNER --protokoll DATEI --passwort DATEI \
        [--sperre SEKUNDEN]

Voreinstellungen: --adresse 127.0.0.1 --port 8081 --sperre 600.

Nur Python-Standardbibliothek (L-02, B-05). Die Logik liegt in
`admin/kern.py`; dieser Dienst stellt nur die HTTP-Schnittstelle.

Schnittstelle unter /admin/api/ (L-01 bis L-15):
    POST anmelden      {"passwort": "…"}
    POST abmelden      {}
    GET  liste         -> {version, daten}
    POST speichern      {"daten": …, "version": n, "name": "…"}
    GET  protokoll     -> {eintraege: [...]}
    GET  sicherungen   -> {sicherungen: [...]}
    POST zurueckholen  {"sicherung": "…", "version": n, "name": "…"}

Fehler: {"fehler": "…"} mit Status 400, 401, 409, 413 oder 429.
"""

import argparse
import json
import os
import secrets
import sys
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kern  # noqa: E402


# ---- Interne Fehlerarten ------------------------------------------------------

class _zu_gross(Exception):
    """Der Korper ist zu groß (L-13)."""


class _ungueltiges_json(Exception):
    """Der Korper ist kein gültiges JSON."""


class _gebrochen(Exception):
    """Die Anfrage wurde abgebrochen (401/400/409)."""


# ---- HTTP-Handler ---------------------------------------------------------------

class handler(BaseHTTPRequestHandler):
    server_version = "wmc-admin/1"

    def log_message(self, format, *args):  # noqa: A002
        pass

    # ---- Antworten -----------------------------------------------------------

    def _antworten(self, status: int, koerper: dict,
                   set_cookie: str = None,
                   additional_header: dict = None):
        text = json.dumps(koerper, ensure_ascii=False)
        byts = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(byts)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        if set_cookie is not None:
            self.send_header("Set-Cookie", set_cookie)
        if additional_header:
            for name, wert in additional_header.items():
                self.send_header(name, wert)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(byts)

    def _fehler(self, status: int, meldung: str):
        self._antworten(status, {"fehler": meldung})

    def _lesekopf(self, name: str) -> str:
        wert = self.headers.get(name)
        return wert if wert is not None else ""

    def _lesetoken(self) -> str:
        cookie = SimpleCookie(self._lesekopf("Cookie"))
        if kern.COOKIE_NAME in cookie:
            return cookie[kern.COOKIE_NAME].value
        return ""

    def _lesecsrftoken(self) -> str:
        return self._lesekopf(kern.CSRF_HEADER)

    def _korper(self) -> bytes:
        laenge = int(self._lesekopf("Content-Length") or 0)
        if laenge > kern.MAX_BODY_BYTES:
            raise _zu_gross()
        return self.rfile.read(laenge) if laenge > 0 else b""

    def _koerper_json(self):
        byts = self._korper()
        if not byts:
            return {}
        try:
            return json.loads(byts.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise _ungueltiges_json()

    def _z(self):
        return self.server.zustand

    def _erfordert_sitzung(self) -> str:
        token = self._lesetoken()
        sitzung = self._z().sitzung_lesen(token)
        if sitzung is None:
            self._fehler(HTTPStatus.UNAUTHORIZED,
                         "Die Sitzung ist abgelaufen. Bitte wieder anmelden.")
            raise _gebrochen()
        return token

    def _erfordert_csrf(self, token: str):
        sitzung = self._z().sitzungen.get(token)
        if sitzung is None or "csrf" not in sitzung:
            self._fehler(HTTPStatus.BAD_REQUEST,
                         "Der Token fehlt oder ist ungültig.")
            raise _gebrochen()
        erwartet = sitzung["csrf"]
        vorgelegt = self._lesecsrftoken()
        if not vorgelegt or not __import__("hmac").compare_digest(vorgelegt, erwartet):
            self._fehler(HTTPStatus.BAD_REQUEST, "Der Token passt nicht.")
            raise _gebrochen()

    def _pfad(self) -> str:
        return self.path.split("?", 1)[0]

    # ---- Routen ---------------------------------------------------------------

    def do_POST(self):
        pfad = self._pfad()
        try:
            if pfad == "/admin/api/anmelden":
                self._anmelden()
            elif pfad == "/admin/api/abmelden":
                self._abmelden()
            elif pfad == "/admin/api/speichern":
                self._speichern()
            elif pfad == "/admin/api/zurueckholen":
                self._zurueckholen()
            else:
                self._fehler(HTTPStatus.NOT_FOUND, "Unbekannte Adresse.")
        except _zu_gross:
            self._fehler(HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                         "Die Anfrage ist zu groß (maximal 256 KB).")
        except _ungueltiges_json:
            self._fehler(HTTPStatus.BAD_REQUEST,
                         "Die Anfrage ist kein gültiges JSON.")
        except _gebrochen:
            pass
        except Exception:  # noqa: BLE001
            self._fehler(HTTPStatus.INTERNAL_SERVER_ERROR,
                         "Der Dienst konnte die Anfrage nicht verarbeiten.")

    def do_GET(self):
        pfad = self._pfad()
        try:
            if pfad == "/admin/api/liste":
                self._liste()
            elif pfad == "/admin/api/protokoll":
                self._protokoll()
            elif pfad == "/admin/api/sicherungen":
                self._sicherungen()
            else:
                self._fehler(HTTPStatus.NOT_FOUND, "Unbekannte Adresse.")
        except _gebrochen:
            pass
        except Exception:  # noqa: BLE001
            self._fehler(HTTPStatus.INTERNAL_SERVER_ERROR,
                         "Der Dienst konnte die Anfrage nicht verarbeiten.")

    # ---- Anmeldung / Abmeldung ------------------------------------------------

    def _anmelden(self):
        z = self._z()
        koerper = self._koerper_json()
        passwort = koerper.get("passwort") if isinstance(koerper, dict) else None
        if not isinstance(passwort, str) or not passwort:
            self._fehler(HTTPStatus.BAD_REQUEST,
                         "Das Passwort fehlt oder ist leer.")
            return

        zeit = time.time()
        gesperrt_bis = z.gesperrt_bis(zeit)
        if gesperrt_bis > 0:
            sekunden = int(gesperrt_bis - zeit) + 1
            self._fehler(HTTPStatus.TOO_MANY_REQUESTS,
                         f"Zu viele falsche Anmeldungen. "
                         f"Versuchen Sie es in {sekunden} Sekunden erneut.")
            return

        try:
            daten = kern.passwort_datei_lesen(z.passwort_pfad)
        except (FileNotFoundError, OSError, json.JSONDecodeError, KeyError, ValueError):
            self._fehler(HTTPStatus.INTERNAL_SERVER_ERROR,
                         "Die Passwortdatei ist nicht lesbar.")
            return

        if not kern.passwort_pruefen(passwort, daten["salz"], daten["hash"]):
            z.falsche_anmeldung_melden(zeit)
            self._fehler(HTTPStatus.UNAUTHORIZED, "Das Passwort ist falsch.")
            return

        token = secrets.token_urlsafe(32)
        z.sitzung_anlegen(token)
        csrf = z.sitzungen[token]["csrf"]
        cookie = (f"{kern.COOKIE_NAME}={token}; "
                  f"Max-Age={kern.SITZUNG_LEBEN_SEKUNDEN}; "
                  f"Path=/admin; HttpOnly; SameSite=Strict")
        self._antworten(HTTPStatus.OK, {"token": csrf}, set_cookie=cookie)

    def _abmelden(self):
        z = self._z()
        token = self._lesetoken()
        z.sitzung_loeschen(token)
        cookie = (f"{kern.COOKIE_NAME}=; Max-Age=0; "
                  f"Path=/admin; HttpOnly; SameSite=Strict")
        self._antworten(HTTPStatus.OK, {"ok": True}, set_cookie=cookie)

    # ---- Gelesen ---------------------------------------------------------------

    def _liste(self):
        token = self._erfordert_sitzung()
        z = self._z()
        version = z.aktuelle_version()
        try:
            daten = kern.liste_lesen(z.daten_pfad)
        except (FileNotFoundError, OSError, json.JSONDecodeError):
            self._fehler(HTTPStatus.INTERNAL_SERVER_ERROR,
                         "Die Linkliste ist nicht lesbar.")
            raise _gebrochen()
        self._antworten(HTTPStatus.OK, {"version": version, "daten": daten})

    def _protokoll(self):
        self._erfordert_sitzung()
        z = self._z()
        eintraege = kern.protokoll_lesen(z.protokoll_pfad, kern.PROTOKOLL_ANZAHL)
        self._antworten(HTTPStatus.OK, {"eintraege": eintraege})

    def _sicherungen(self):
        self._erfordert_sitzung()
        z = self._z()
        sicherungen = kern.sicherungen_auflisten(
            z.sicherungen_pfad, z.protokoll_pfad, kern.SICHERUNGEN_ANZAHL)
        self._antworten(HTTPStatus.OK, {"sicherungen": sicherungen})

    # ---- Schreiben --------------------------------------------------------------

    def _speichern(self):
        z = self._z()
        token = self._erfordert_sitzung()
        self._erfordert_csrf(token)
        koerper = self._koerper_json()
        if not isinstance(koerper, dict):
            self._fehler(HTTPStatus.BAD_REQUEST,
                         "Die Anfrage muss ein JSON-Objekt sein.")
            return

        name = koerper.get("name")
        if not kern.name_pruefen(name):
            self._fehler(HTTPStatus.BAD_REQUEST,
                         "„Ihr Name“ braucht 1 bis 40 Zeichen "
                         "(ohne Leerzeichen am Rand).")
            return

        version = koerper.get("version")
        if not isinstance(version, int) or isinstance(version, bool):
            self._fehler(HTTPStatus.BAD_REQUEST,
                         "Die Versionsnummer fehlt oder ist keine Zahl.")
            return

        daten = koerper.get("daten")
        if not isinstance(daten, dict):
            self._fehler(HTTPStatus.BAD_REQUEST,
                         "Die Linkliste fehlt oder ist kein Objekt.")
            return

        # L-11: Versionskonflikt.
        aktuell = z.aktuelle_version()
        if version != aktuell:
            eintraege = kern.protokoll_lesen(z.protokoll_pfad, 1)
            name_fremd = ""
            zeit_fremd = ""
            if eintraege:
                letzter = eintraege[0]
                name_fremd = letzter.get("name", "")
                zeit_fremd = letzter.get("zeit", "")
            self._fehler(HTTPStatus.CONFLICT,
                         kern.fehlermeldung_versionskonflikt(name_fremd, zeit_fremd))
            return

        # L-10: Prüfung mit denselben Funktionen wie pruefe_links.py.
        fehler = kern.liste_pruefen(daten)
        if fehler:
            meldungen = "\n".join(fehler)
            self._fehler(HTTPStatus.BAD_REQUEST,
                         f"Die Linkliste besteht nicht:\n{meldungen}")
            return

        # L-10: stand auf heute setzen.
        daten = dict(daten)
        daten["stand"] = kern.stand_heute()

        # L-10: Sicherung, atomares Schreiben, Protokoll.
        with z._lock:
            new_version = z.version_erhoehen()
            try:
                sicherung_name = kern.sicherung_legen(z.daten_pfad, z.sicherungen_pfad)
            except OSError:
                self._fehler(HTTPStatus.INTERNAL_SERVER_ERROR,
                             "Die Sicherung konnte nicht angelegt werden.")
                return
            try:
                kern.liste_schreiben(daten, z.daten_pfad)
            except OSError:
                self._fehler(HTTPStatus.INTERNAL_SERVER_ERROR,
                             "Die Linkliste konnte nicht geschrieben werden.")
                return
            zeit = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime())
            kern.protokoll_zeile(z.protokoll_pfad, {
                "zeit": zeit,
                "name": name.strip(),
                "version": new_version,
                "sicherung": sicherung_name,
                "links_neu": 0,
                "links_geaendert": 0,
                "links_geloesch": 0,
                "bereiche_neu": 0,
                "bereiche_geloesch": 0,
            })
            z.sicherung_melden(sicherung_name, zeit, new_version, name.strip())
        self._antworten(HTTPStatus.OK, {
            "ok": True,
            "version": new_version,
            "stand": daten["stand"],
        })

    def _zurueckholen(self):
        z = self._z()
        token = self._erfordert_sitzung()
        self._erfordert_csrf(token)
        koerper = self._koerper_json()
        if not isinstance(koerper, dict):
            self._fehler(HTTPStatus.BAD_REQUEST,
                         "Die Anfrage muss ein JSON-Objekt sein.")
            return

        name = koerper.get("name")
        if not kern.name_pruefen(name):
            self._fehler(HTTPStatus.BAD_REQUEST,
                         "„Ihr Name“ braucht 1 bis 40 Zeichen "
                         "(ohne Leerzeichen am Rand).")
            return

        version = koerper.get("version")
        if not isinstance(version, int) or isinstance(version, bool):
            self._fehler(HTTPStatus.BAD_REQUEST,
                         "Die Versionsnummer fehlt oder ist keine Zahl.")
            return

        sicherung_name = koerper.get("sicherung")
        if not isinstance(sicherung_name, str) or not sicherung_name:
            self._fehler(HTTPStatus.BAD_REQUEST, "Die Sicherung fehlt.")
            return
        if not kern.sicherung_name_ist_gueltig(sicherung_name):
            self._fehler(HTTPStatus.BAD_REQUEST, "Die Sicherung ist unbekannt.")
            return

        # L-11: Versionskonflikt.
        aktuell = z.aktuelle_version()
        if version != aktuell:
            eintraege = kern.protokoll_lesen(z.protokoll_pfad, 1)
            name_fremd = ""
            zeit_fremd = ""
            if eintraege:
                letzter = eintraege[0]
                name_fremd = letzter.get("name", "")
                zeit_fremd = letzter.get("zeit", "")
            self._fehler(HTTPStatus.CONFLICT,
                         kern.fehlermeldung_versionskonflikt(name_fremd, zeit_fremd))
            return

        # L-15: Sicherung laden und prüfen.
        try:
            daten = kern.sicherung_laden(z.sicherungen_pfad, sicherung_name)
        except (FileNotFoundError, OSError, json.JSONDecodeError):
            self._fehler(HTTPStatus.NOT_FOUND, "Die Sicherung gibt es nicht.")
            return
        fehler = kern.liste_pruefen(daten)
        if fehler:
            meldungen = "\n".join(fehler)
            self._fehler(HTTPStatus.BAD_REQUEST,
                         f"Die Sicherung besteht nicht:\n{meldungen}")
            return

        # L-15: stand auf heute, Sicherung des aktuellen Stands, Schreiben.
        daten = dict(daten)
        daten["stand"] = kern.stand_heute()
        with z._lock:
            new_version = z.version_erhoehen()
            try:
                neue_sicherung = kern.sicherung_legen(z.daten_pfad, z.sicherungen_pfad)
            except OSError:
                self._fehler(HTTPStatus.INTERNAL_SERVER_ERROR,
                             "Die Sicherung konnte nicht angelegt werden.")
                return
            try:
                kern.liste_schreiben(daten, z.daten_pfad)
            except OSError:
                self._fehler(HTTPStatus.INTERNAL_SERVER_ERROR,
                             "Die Linkliste konnte nicht geschrieben werden.")
                return
            zeit = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime())
            kern.protokoll_zeile(z.protokoll_pfad, {
                "zeit": zeit,
                "name": name.strip(),
                "version": new_version,
                "sicherung": neue_sicherung,
                "zurueckgeholt": sicherung_name,
            })
            z.sicherung_melden(neue_sicherung, zeit, new_version, name.strip())
        self._antworten(HTTPStatus.OK, {
            "ok": True,
            "version": new_version,
            "stand": daten["stand"],
        })


# ---- main ----------------------------------------------------------------------

def parse_args(argv):
    parser = argparse.ArgumentParser(description="Dienst zum Speichern der Linkliste.")
    parser.add_argument("--adresse", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8081)
    parser.add_argument("--daten", required=True)
    parser.add_argument("--sicherungen", required=True)
    parser.add_argument("--protokoll", required=True)
    parser.add_argument("--passwort", required=True)
    parser.add_argument("--sperre", type=int, default=600)
    return parser.parse_args(argv)


def main(argv):
    args = parse_args(argv)
    # B-05: --daten ist ein Ordner, links.json liegt darin.
    os.makedirs(args.daten, exist_ok=True)
    daten_pfad = os.path.abspath(os.path.join(args.daten, "links.json"))
    z = kern.zustand(
        daten_pfad=daten_pfad,
        sicherungen_pfad=os.path.abspath(args.sicherungen),
        protokoll_pfad=os.path.abspath(args.protokoll),
        passwort_pfad=os.path.abspath(args.passwort),
        sperre_sekunden=args.sperre,
    )
    os.makedirs(z.sicherungen_pfad, exist_ok=True)
    server = ThreadingHTTPServer((args.adresse, args.port), handler)
    server.zustand = z
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
