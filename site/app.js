// Browser-Startseite WMC & WMA — app.js
// Nur Standard-Web-APIs, ES-Modul, keine Bibliotheken.
// Alle Inhalte aus links.json werden als Text eingesetzt (F-03), nie als HTML.

const SPEICHERSUELSSEL = "wmc-startseite.favoriten";
const SPEICHERSUELSSEL_VORNAME = "wmc-startseite.vorname";
const BASISDATUM = Date.UTC(2026, 0, 1); // 01.01.2026, t = 0 (F-13)

const MARKE_ETIKETT = {
  wmc: "WMC",
  wma: "WMA",
  beide: "WMC · WMA",
};

// ---- Referenzen ----------------------------------------------------------
const begruesung = document.getElementById("begruesung-text");
const datum = document.getElementById("datum");
const spruch = document.getElementById("spruch");
const vornameFormular = document.getElementById("vorname-formular");
const vornameFeld = document.getElementById("vorname-feld");
const vornameOhneNamen = document.getElementById("vorname-ohne-namen");
const vornameAendern = document.getElementById("vorname-aendern");
const suchfeld = document.getElementById("suchfeld");
const favoritenAbschnitt = document.getElementById("favoriten");
const alleLinksKopf = document.getElementById("alle-links-kopf");
const favoritenInhalt = document.getElementById("favoriten-inhalt");
const bearbeitenButton = document.getElementById("bearbeiten");
const BereichsContainer = document.getElementById("bereiche");
const infozeile = document.getElementById("infozeile");
const fehlerKasten = document.getElementById("fehler");
const keinTreffer = document.getElementById("kein-treffer");
const keinTrefferSuchtext = document.getElementById("kein-treffer-suchtext");
const keinTrefferHilfe = document.getElementById("kein-treffer-hilfe");
const fussHilfe = document.getElementById("fuss-hilfe");

// ---- Zustand -------------------------------------------------------------
let daten = null;            // geladene links.json
let linksById = new Map();   // id -> { link, bereich }
let favoriten = [];          // Liste von Link-IDs, in gespeicherter Reihenfolge
let bearbeitenModus = false;

// ---- Symbole (SVG, Kontur) ----------------------------------------------
function svgStern() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const pfad = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pfad.setAttribute("d", "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z");
  svg.appendChild(pfad);
  return svg;
}

function svgPlus() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const pfad = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pfad.setAttribute("d", "M12 5v14M5 12h14");
  svg.appendChild(pfad);
  return svg;
}

function svgKreuz() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("kreuz");
  const pfad = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pfad.setAttribute("d", "M3 3l6 6M9 3l-6 6");
  svg.appendChild(pfad);
  return svg;
}

// ---- Begrüßung (F-11) ----------------------------------------------------
function begruessungText() {
  const stunde = new Date().getHours();
  if (stunde >= 5 && stunde <= 10) return "Guten Morgen";
  if (stunde >= 11 && stunde <= 17) return "Guten Tag";
  return "Guten Abend";
}

// ---- Vorname (F-14) ------------------------------------------------------
let vorname = "";
let vornameSpeicherFehler = false;

function vornameLesen() {
  if (vornameSpeicherFehler) return null;
  try {
    const roh = window.localStorage.getItem(SPEICHERSUELSSEL_VORNAME);
    return roh === null ? null : roh;
  } catch (fehler) {
    vornameSpeicherFehler = true;
    return null;
  }
}

function vornameSchreiben(text) {
  vorname = text;
  begruessungAktualisieren();
  if (vornameSpeicherFehler) return;
  try {
    window.localStorage.setItem(SPEICHERSUELSSEL_VORNAME, text);
  } catch (fehler) {
    // Gesperrtes oder voll gesetztes localStorage: der Name gilt bis zum
    // Neuladen (F-14). Beim nächsten Schreiben wird nicht erneut probiert.
    vornameSpeicherFehler = true;
  }
}

function begruessungAktualisieren() {
  // F-11: Begrüßung plus optionaler Vorname, als Text (F-03).
  if (vorname) {
    begruesung.textContent = `${begruessungText()}, ${vorname}`;
  } else {
    begruesung.textContent = begruessungText();
  }
}

function vornameFormularZeigen(fokus) {
  vornameFormular.hidden = false;
  vornameFeld.value = vorname;
  if (fokus) {
    vornameFeld.focus({ preventScroll: true });
  }
}

function vornameFormularInitialisieren() {
  const gespeichert = vornameLesen();
  if (gespeichert === null) {
    // Fehlt der Schlüssel: Formular zeigen, ohne es zu beantworten (F-14).
    vornameFormularZeigen(false);
  } else {
    vorname = gespeichert;
    vornameFormular.hidden = true;
  }
  begruessungAktualisieren();
}

// ---- Datum (F-12) --------------------------------------------------------
function datumHeute() {
  return Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

// ---- Spruch des Tages (F-13) ---------------------------------------------
function tageZahl(datumObjekt) {
  // t: Kalendertage vom 01.01.2026, aus Kalenderdaten gerechnet (F-13),
  // damit die Zeitumstellung den Satz nicht verschiebt.
  const ziel = Date.UTC(datumObjekt.getFullYear(), datumObjekt.getMonth(), datumObjekt.getDate());
  return Math.round((ziel - BASISDATUM) / 86400000);
}

function spruchStelle(anzahl, heute) {
  if (anzahl <= 0) return null;
  const t = tageZahl(heute);
  return ((t % anzahl) + anzahl) % anzahl;
}

function spruchLaden() {
  return fetch("daten/sprueche.json", { cache: "no-store" })
    .then((antwort) => {
      if (!antwort.ok) throw new Error("HTTP " + antwort.status);
      return antwort.json();
    })
    .then((inhalt) => {
      const satz = spruchWahlen(inhalt);
      if (satz !== null) {
        spruch.textContent = satz; // als Text (F-03)
        spruch.hidden = false;
      } else {
        // Kein einwandfreier Satz: Absatz bleibt verborgen (F-13).
        spruch.hidden = true;
      }
    })
    .catch(() => {
      // Datei fehlt oder ist ungültig: Absatz bleibt verborgen,
      // keine Fehlermeldung, kein unbehandelter Konsole-Fehler (F-13).
      spruch.hidden = true;
    });
}

function spruchWahlen(inhalt) {
  if (!inhalt || !Array.isArray(inhalt.sprueche)) return null;
  const satze = inhalt.sprueche;
  const stelle = spruchStelle(satze.length, new Date());
  if (stelle === null) return null;
  const satz = satze[stelle];
  if (typeof satz !== "string" || satz.length === 0) return null;
  return satz;
}

// ---- Kürzel (F-04) -------------------------------------------------------
function kuerzelFormen(name) {
  const buchstaben = (name || "")
    .split("")
    .filter((zeichen) => /[A-Za-zÄÖÜäöü0-9]/.test(zeichen));
  let ergebnis = "";
  for (const zeichen of buchstaben) {
    if (ergebnis.length >= 2) break;
    ergebnis += zeichen.toUpperCase();
  }
  return ergebnis.slice(0, 2);
}

function kuerzelVomLink(link) {
  if (link && typeof link.kuerzel === "string" && link.kuerzel.length >= 1) {
    return link.kuerzel;
  }
  return kuerzelFormen(link && link.name);
}

// ---- Datum (F-22) --------------------------------------------------------
function standDatum(stand) {
  if (typeof stand !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(stand)) return "";
  const [jahr, monat, tag] = stand.split("-");
  return `${tag}.${monat}.${jahr}`;
}

// ---- Favoritenspeicher (F-34) --------------------------------------------
function speicherLesen() {
  try {
    const roh = window.localStorage.getItem(SPEICHERSUELSSEL);
    if (roh === null) return null; // Fehlt der Schlüssel → Standardfavoriten
    const wert = JSON.parse(roh);
    if (!Array.isArray(wert)) return null;
    if (!wert.every((element) => typeof element === "string")) return null;
    return wert;
  } catch (fehler) {
    return null; // localStorage wirft → Seite läuft ohne Speicher
  }
}

function speicherSchreiben() {
  try {
    window.localStorage.setItem(SPEICHERSUELSSEL, JSON.stringify(favoriten));
  } catch (fehler) {
    // Gesperrtes localStorage: Änderungen gelten nur bis zum Neuladen.
  }
}

function favoritenInitialisieren() {
  let gespeichert = speicherLesen();
  if (gespeichert === null) {
    const standard = Array.isArray(daten.standardFavoriten) ? daten.standardFavoriten : [];
    gespeichert = standard.slice();
  }
  // IDs, die es in links.json nicht (mehr) gibt, werden übergangen.
  favoriten = gespeichert.filter((id) => linksById.has(id));
}

function istFavorit(id) {
  return favoriten.includes(id);
}

function favoritUmschalten(id) {
  const index = favoriten.indexOf(id);
  if (index >= 0) {
    favoriten.splice(index, 1);
  } else {
    favoriten.push(id);
  }
  speicherSchreiben();
  renderFavoriten();
  renderSterne();
}

// ---- Suche (F-21, F-24, F-25) -------------------------------------------
function suchtextNur() {
  return (suchfeld.value || "").trim();
}

function linkPasst(link, suchtext) {
  if (!suchtext) return true;
  const n = suchtext.toLowerCase();
  const name = (link.name || "").toLowerCase();
  const beschreibung = (link.beschreibung || "").toLowerCase();
  return name.includes(n) || beschreibung.includes(n);
}

function renderSuche() {
  const suchtext = suchtextNur();

  // Treffer zuerst zählen, dann filtern (F-22).
  const anzahl = suchtext ? trefferAnzahl() : 0;

  if (suchtext) {
    infozeile.textContent =
      `${anzahl} Treffer für „${suchtext}“`;
  } else {
    infozeile.textContent = `Zentral gepflegt von der IT · Stand ${standDatum(daten.stand)}`;
  }

  // Karten filtern (F-21): Karten ohne passenden Link ganz ausblenden.
  for (const karte of BereichsContainer.querySelectorAll(".karte")) {
    const links = Array.from(karte.querySelectorAll("[data-link-id]"));
    const sichtbare = links.filter((element) => {
      const id = element.getAttribute("data-link-id");
      const einzug = linksById.get(id);
      return einzug && linkPasst(einzug.link, suchtext);
    });
    karte.hidden = sichtbare.length === 0;
    for (const element of links) {
      const id = element.getAttribute("data-link-id");
      const einzug = linksById.get(id);
      element.hidden = !linkPasst(einzug.link, suchtext);
    }
  }

  const gesamtSichtbar = Array.from(BereichsContainer.querySelectorAll("[data-link-id]"))
    .filter((element) => !element.hidden).length;
  const keineKarten = !Array.from(BereichsContainer.querySelectorAll(".karte"))
    .some((karte) => !karte.hidden);

  if (suchtext && (gesamtSichtbar === 0 || keineKarten)) {
    keinTrefferSuchtext.textContent = `„${suchtext}“`;
    keinTreffer.hidden = false;
  } else {
    keinTreffer.hidden = true;
  }
}

function trefferAnzahl() {
  const suchtext = suchtextNur();
  let anzahl = 0;
  for (const [id, einzug] of linksById) {
    if (linkPasst(einzug.link, suchtext)) anzahl += 1;
  }
  return anzahl;
}

// ---- Favoriten-Render (F-30 bis F-33) -----------------------------------
function kachelErstellen(link, bereich) {
  const kachel = document.createElement("a");
  kachel.className = "kachel";
  if (bereich && bereich.marke === "wma") kachel.classList.add("kachel-academy");
  kachel.href = link.url;

  const kuerzel = document.createElement("span");
  kuerzel.className = "kachel-kuerzel";
  kuerzel.textContent = kuerzelVomLink(link);

  const name = document.createElement("span");
  name.className = "kachel-name";
  name.textContent = link.name;

  kachel.appendChild(kuerzel);
  kachel.appendChild(name);
  return kachel;
}

function hinzuKachel() {
  const kachel = document.createElement("a");
  kachel.className = "kachel kachel-hinzufuegen";
  kachel.href = "#alle-links";

  const symbol = document.createElement("span");
  symbol.className = "kachel-symptom";
  symbol.appendChild(svgPlus());

  const name = document.createElement("span");
  name.className = "kachel-name";
  name.textContent = "Hinzufügen";

  kachel.appendChild(symbol);
  kachel.appendChild(name);
  return kachel;
}

function entfernenButton(link) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "kachel-entfernen";
  button.setAttribute("aria-label", `Aus Favoriten entfernen: ${link.name}`);
  const kreis = document.createElement("span");
  kreis.className = "kreis";
  kreis.appendChild(svgKreuz());
  button.appendChild(kreis);
  button.addEventListener("click", (ereignis) => {
    // F-32: Das Kreuz entfernt den Favoriten und öffnet nicht den Kachel-Link.
    ereignis.preventDefault();
    ereignis.stopPropagation();
    favoritUmschalten(link.id);
  });
  return button;
}

function renderFavoriten() {
  favoritenInhalt.textContent = "";

  if (favoriten.length === 0) {
    const hinweis = document.createElement("p");
    hinweis.className = "hinweis";
    hinweis.textContent = "Noch keine Favoriten. Markieren Sie unten einen Link mit dem Stern.";
    favoritenInhalt.appendChild(hinweis);
  }

  for (const id of favoriten) {
    const einzug = linksById.get(id);
    if (!einzug) continue;
    const kachel = kachelErstellen(einzug.link, einzug.bereich);
    if (bearbeitenModus) {
      kachel.appendChild(entfernenButton(einzug.link));
    }
    favoritenInhalt.appendChild(kachel);
  }

  // Letzte Kachel: Hinzufügen (F-30).
  favoritenInhalt.appendChild(hinzuKachel());

  // Hinweis unter den Kacheln im Bearbeiten-Modus (F-32).
  let hinweis = favoritenInhalt.querySelector("#bearbeiten-hinweis");
  if (bearbeitenModus) {
    if (!hinweis) {
      hinweis = document.createElement("p");
      hinweis.id = "bearbeiten-hinweis";
      hinweis.className = "hinweis breiter";
      favoritenInhalt.appendChild(hinweis);
    }
    hinweis.textContent =
      "Mit dem Kreuz entfernen Sie einen Favoriten. Neue Favoriten markieren Sie unten mit dem Stern.";
  } else if (hinweis) {
    hinweis.remove();
  }
}

// ---- Sterne (F-31) -------------------------------------------------------
function renderSterne() {
  for (const button of BereichsContainer.querySelectorAll(".stern")) {
    const id = button.getAttribute("data-link-id");
    const pressed = istFavorit(id) ? "true" : "false";
    button.setAttribute("aria-pressed", pressed);
  }
}

// ---- Alle Links (F-40 bis F-42) -----------------------------------------
function karteErstellen(bereich, links) {
  const karte = document.createElement("article");
  karte.className = "karte";
  if (bereich.marke === "wma") karte.classList.add("karte-academy");

  const kopf = document.createElement("div");
  kopf.className = "karte-kopf";

  const titel = document.createElement("h3");
  titel.textContent = bereich.titel;
  kopf.appendChild(titel);

  const etikett = document.createElement("span");
  etikett.className = "etikett";
  etikett.textContent = MARKE_ETIKETT[bereich.marke] || "";
  kopf.appendChild(etikett);

  karte.appendChild(kopf);

  const zeilen = document.createElement("div");
  zeilen.className = "linkzeilen";

  for (const link of links) {
    const zeile = document.createElement("div");
    zeile.className = "linkzeile";
    zeile.setAttribute("data-link-id", link.id);

    const kuerzel = document.createElement("span");
    kuerzel.className = "linkzeile-kuerzel";
    kuerzel.textContent = kuerzelVomLink(link);

    const textlink = document.createElement("a");
    textlink.className = "linkzeile-text";
    textlink.href = link.url;
    const name = document.createElement("span");
    name.className = "linkzeile-name";
    name.textContent = link.name;
    const beschreibung = document.createElement("span");
    beschreibung.className = "linkzeile-beschreibung";
    beschreibung.textContent = link.beschreibung;
    textlink.appendChild(name);
    textlink.appendChild(beschreibung);

    const stern = document.createElement("button");
    stern.type = "button";
    stern.className = "stern";
    stern.setAttribute("data-link-id", link.id);
    stern.setAttribute("aria-label", `Favorit: ${link.name}`);
    stern.setAttribute("aria-pressed", istFavorit(link.id) ? "true" : "false");
    stern.appendChild(svgStern());
    stern.addEventListener("click", () => favoritUmschalten(link.id));

    zeile.appendChild(kuerzel);
    zeile.appendChild(textlink);
    zeile.appendChild(stern);
    zeilen.appendChild(zeile);
  }

  karte.appendChild(zeilen);
  return karte;
}

function renderBereiche() {
  BereichsContainer.textContent = "";
  for (const bereich of daten.bereiche) {
    const links = Array.isArray(bereich.links) ? bereich.links : [];
    // Links mit ungültiger URL werden nicht angezeigt (F-03).
    const gueltige = links.filter((link) => urlIstGueltig(link.url));
    if (gueltige.length === 0) continue;
    BereichsContainer.appendChild(karteErstellen(bereich, gueltige));
  }
}

function urlIstGueltig(url) {
  return typeof url === "string" &&
    (url.startsWith("https://") || url.startsWith("http://"));
}

// ---- Fehlerzustand (F-02) ------------------------------------------------
function fehlerAnzeigen() {
  // F-02: Die Fehlermeldung steht statt beider Abschnitte.
  favoritenAbschnitt.hidden = true;
  alleLinksKopf.hidden = true;
  BereichsContainer.textContent = "";
  BereichsContainer.hidden = true;
  infozeile.textContent = "";
  keinTreffer.hidden = true;
  suchfeld.disabled = true; // Eingaben ins Suchfeld bewirken nichts (F-02)
  fehlerKasten.hidden = false;
}

// ---- Initialisierung -----------------------------------------------------
function hilfeAnwenden() {
  const hilfe = daten && daten.hilfe;
  const url = hilfe && urlIstGueltig(hilfe.url) ? hilfe.url : "#";
  const name = hilfe && typeof hilfe.name === "string" ? hilfe.name : "IT-Ticket erstellen";
  keinTrefferHilfe.textContent = name;
  keinTrefferHilfe.setAttribute("href", url);
  fussHilfe.textContent = name;
  fussHilfe.setAttribute("href", url);
}

function start() {
  begruessungAktualisieren();
  datum.textContent = datumHeute();
  spruchLaden(); // eigenes Loading; schlägt fehl, bleibt der Absatz verborgen
  vornameFormularInitialisieren();
  // F-14: Speichern und die Eingabetaste laufen über dasselbe Ereignis
  // submit; preventDefault() hält den Browser davon ab, die Seite neu zu
  // laden oder die Eingabe abzuschicken („form-action 'none'“).
  vornameFormular.addEventListener("submit", (ereignis) => {
    ereignis.preventDefault();
    const text = (vornameFeld.value || "").trim();
    vornameSchreiben(text); // leerer Text gilt wie „Ohne Namen“ (F-14)
    vornameFormular.hidden = true;
  });
  vornameOhneNamen.addEventListener("click", () => {
    vornameSchreiben("");
    vornameFormular.hidden = true;
  });
  vornameAendern.addEventListener("click", () => {
    vornameFormularZeigen(true);
  });
  bearbeitenButton.addEventListener("click", () => {
    bearbeitenModus = !bearbeitenModus;
    bearbeitenButton.textContent = bearbeitenModus ? "Fertig" : "Bearbeiten";
    renderFavoriten();
  });
  suchfeld.addEventListener("input", renderSuche);
  suchfeld.addEventListener("keydown", (ereignis) => {
    if (ereignis.key === "Escape") {
      suchfeld.value = "";
      renderSuche();
    }
  });
}

async function lade() {
  try {
    const antwort = await fetch("daten/links.json", { cache: "no-store" });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
    const inhalt = await antwort.json();
    if (!inhalt || !Array.isArray(inhalt.bereiche)) throw new Error("Struktur fehlt");
    daten = inhalt;
  } catch (fehler) {
    // Unbehandelter Fehler soll in der Konsole bleiben (F-02); Seite zeigt den Kasten.
    fehlerAnzeigen();
    return;
  }

  // Index aufbauen.
  linksById = new Map();
  for (const bereich of daten.bereiche) {
    for (const link of bereich.links || []) {
      linksById.set(link.id, { link, bereich });
    }
  }

  favoritenInitialisieren();
  renderBereiche();
  renderFavoriten();
  renderSterne();
  renderSuche();
  hilfeAnwenden();

  // A-0040: Nach dem Laden steht der Cursor im Suchfeld, damit man sofort tippen kann.
  suchfeld.focus({ preventScroll: true });
}

start();
lade().catch(() => {
  // Defensive: kein unbehandelter Promise-Verstoß.
  fehlerAnzeigen();
});
