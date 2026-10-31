// Admin-Ansicht zum Pflegen der Links (L-01 bis L-15).
// Kein Inline-Skript (N-02, B-03), keine fremden Server (L-13).

// ---- Zustand -----------------------------------------------------------------

let sitzung = null;          // {csrf} oder null
let version = 0;             // Versionsnummer der geladenen Liste
let daten = null;            // geladene Linkliste
let ungespeichert = false;   // „Nicht gespeicherte Änderungen“

// ---- Helfer ------------------------------------------------------------------

const NAME_SCHLUESSEL = "wmc_admin_name";
const CSRF_SCHLUESSEL = "wmc_admin_csrf";

// Der Speicher des Browsers kann fehlen (privates Fenster); dann ohne ihn weiter.
function speicherLesen(speicher, schluessel) {
  try {
    return speicher.getItem(schluessel);
  } catch {
    return null;
  }
}

function speicherSchreiben(speicher, schluessel, wert) {
  try {
    if (wert === null) speicher.removeItem(schluessel);
    else speicher.setItem(schluessel, wert);
  } catch {
    // ohne Speicher weiter
  }
}

function $(sel) {
  return document.querySelector(sel);
}

function status(text, klasse = "") {
  const feld = $("#status");
  if (feld) {
    feld.textContent = text;
    feld.className = "status " + klasse;
  }
}

function meldung(ziel, text, klasse = "") {
  if (ziel) {
    ziel.textContent = text;
    ziel.className = "meldung " + klasse;
  }
}

function speicherStatus() {
  const feld = $("#status");
  if (!feld) return;
  if (ungespeichert) {
    feld.textContent = "Nicht gespeicherte Änderungen";
    feld.className = "status ungespeichert";
  } else {
    feld.textContent = "Gespeichert";
    feld.className = "status";
  }
}

// ---- API ---------------------------------------------------------------------

async function api(pfad, { methode = "GET", koerper = null } = {}) {
  const kopfe = { "Content-Type": "application/json" };
  if (sitzung) {
    kopfe["X-CSRF-Token"] = sitzung.csrf;
  }
  const antwort = await fetch("/admin/api/" + pfad, {
    method: methode,
    headers: kopfe,
    credentials: "same-origin",
    body: koerper ? JSON.stringify(koerper) : undefined,
  });
  let parsed = {};
  try {
    parsed = await antwort.json();
  } catch {
    parsed = {};
  }
  if (!antwort.ok) {
    const meldung = parsed.fehler || "Unbekannter Fehler.";
    const fehler = new Error(meldung);
    fehler.status = antwort.status;
    throw fehler;
  }
  return parsed;
}

// ---- Anmeldung / Abmeldung ---------------------------------------------------

async function anmelden() {
  const passwort = $("#passwort").value;
  meldung($("#anmeldung-meldung"), "");
  try {
    const antwort = await api("anmelden", {
      methode: "POST",
      koerper: { passwort },
    });
    sitzung = { csrf: antwort.token };
    speicherSchreiben(sessionStorage, CSRF_SCHLUESSEL, antwort.token);
    version = 0;
    await laden();
    $("#anmeldung").hidden = true;
    $("#uebersicht").hidden = false;
    status("Angemeldet");
    $("#passwort").value = "";
    $("#name").focus();
  } catch (fehler) {
    meldung($("#anmeldung-meldung"), fehler.message, "fehler");
  }
}

async function abmelden() {
  try {
    await api("abmelden", { methode: "POST" });
  } catch {
    // Abmelden schlägt nicht fehl; die Sitzung wird lokal beendet.
  }
  sitzung = null;
  speicherSchreiben(sessionStorage, CSRF_SCHLUESSEL, null);
  ungespeichert = false;
  location.href = "/admin";
}

// ---- Laden -------------------------------------------------------------------

async function laden() {
  const antwort = await api("liste");
  version = antwort.version;
  daten = antwort.daten;
  ungespeichert = false;
  speicherStatus();
  rendern();
  await protokollLaden();
  await sicherungenLaden();
}

async function protokollLaden() {
  try {
    const antwort = await api("protokoll");
    rendernProtokoll(antwort.eintraege || []);
  } catch (fehler) {
    meldung($("#speichern-meldung"), "Protokoll nicht geladen: " + fehler.message, "fehler");
  }
}

async function sicherungenLaden() {
  try {
    const antwort = await api("sicherungen");
    rendernSicherungen(antwort.sicherungen || []);
  } catch (fehler) {
    meldung($("#speichern-meldung"), "Sicherungen nicht geladen: " + fehler.message, "fehler");
  }
}

// ---- Validierung (V-02, V-06, V-08) --------------------------------------------

function pruefen_name(wert) {
  if (!wert || !wert.trim()) return "Der Name fehlt.";
  if (wert.trim().length > 40) return "Der Name hat höchstens 40 Zeichen.";
  return "";
}

function pruefen_adresse(wert) {
  if (!wert || !wert.trim()) return "Die Adresse fehlt.";
  const url = wert.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return "Die Adresse braucht http:// oder https://.";
  }
  if (/\s/.test(url)) return "Die Adresse enthält keine Leerzeichen.";
  if (url.length > 500) return "Die Adresse hat höchstens 500 Zeichen.";
  try {
    const neu = new URL(url);
    if (!neu.hostname) return "Die Adresse ist unvollständig.";
  } catch {
    return "Die Adresse ist unvollständig.";
  }
  return "";
}

function pruefen_beschreibung(wert) {
  if (!wert || !wert.trim()) return "Die Beschreibung fehlt.";
  if (wert.trim().length > 60) return "Die Beschreibung hat höchstens 60 Zeichen.";
  return "";
}

function pruefen_kuerzel(wert) {
  if (!wert) return "";
  if (!/^[A-Z0-9ÄÖÜ]{1,3}$/.test(wert)) return "Das Kürzel hat 1 bis 3 Großbuchstaben oder Ziffern.";
  return "";
}

const MARKEN = ["wmc", "wma", "beide"];

function pruefen_marke(wert) {
  if (MARKEN.indexOf(wert) === -1) return "Die Marke ist wmc, wma oder beide.";
  return "";
}

// ---- IDs ---------------------------------------------------------------------

function idAusName(name, bestehende) {
  let grund = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!grund) grund = "link";
  if (!bestehende.has(grund)) return grund;
  let zahl = 2;
  while (bestehende.has(`${grund}-${zahl}`)) zahl++;
  return `${grund}-${zahl}`;
}

// ---- Rendering ---------------------------------------------------------------

function alleLinkIds() {
  const s = new Set();
  for (const b of (daten && daten.bereiche || [])) {
    for (const l of (b.links || [])) s.add(l.id);
  }
  return s;
}

function rendern() {
  if (!daten || !Array.isArray(daten.bereiche)) return;
  const container = $("#bereiche");
  while (container.firstChild) container.removeChild(container.firstChild);
  daten.bereiche.forEach((bereich, bi) => {
    const kiste = document.createElement("div");
    kiste.className = "bereich";
    kiste.dataset.bereich = bi;
    kiste.appendChild(bereichBauen(bereich, bi));
    container.appendChild(kiste);
    bindenBereich(kiste, bi);
  });
  rendernFavoriten();
  rendernHilfe();
  speicherStatus();
}

// ---- DOM-Helfer (Text statt HTML, L-13) --------------------------------

function el(tag, klasse, text) {
  const n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

function knopf(text, aktionName, zusatzKlasse = "") {
  const b = el("button", "btn klein" + (zusatzKlasse ? " " + zusatzKlasse : ""));
  b.type = "button";
  b.textContent = text;
  b.dataset.aktion = aktionName;
  return b;
}

function bereichBauen(bereich, bi) {
  const wahl = daten.bereiche;
  const links = bereich.links || [];
  const wahlLinks = wahl || [];

  // Kopf.
  const kopf = el("div", "bereich-kopf");
  kopf.appendChild(el("div", "marke", bereich.marke || ""));
  kopf.appendChild(el("h3", null, bereich.titel));
  const handlung = el("div", "handlung");
  handlung.appendChild(knopf("Nach oben", "bereich-nach-oben"));
  handlung.lastChild.disabled = bi === 0;
  const unten = knopf("Nach unten", "bereich-nach-unten");
  unten.disabled = bi === wahlLinks.length - 1;
  handlung.appendChild(unten);
  handlung.appendChild(knopf("Umbenennen", "bereich-umbenennen"));
  const loeschen = knopf("Löschen", "bereich-loeschen");
  if (links.length) {
    loeschen.disabled = true;
    loeschen.title = "Der Bereich ist nicht leer.";
  }
  handlung.appendChild(loeschen);
  const hinzu = knopf("Link hinzufügen", "link-hinzufuegen", " primär");
  handlung.appendChild(hinzu);
  kopf.appendChild(handlung);

  // Links.
  const linksKiste = el("div", "links");
  links.forEach((link, li) => {
    linksKiste.appendChild(linkZeileBauen(bereich, link, bi, li));
  });

  const wurzel = el("div");
  wurzel.appendChild(kopf);
  wurzel.appendChild(linksKiste);
  wurzel.appendChild(el("div", "formular-container"));
  return wurzel;
}

function linkZeileBauen(bereich, link, bi, li) {
  const links = bereich.links || [];
  const favoriten = (daten && daten.standardFavoriten) || [];
  const isStandard = favoriten.indexOf(link.id) !== -1;
  const zeile = el("div", "link-zeile");
  zeile.dataset.link = link.id;

  const info = el("div", "info");
  const oben = el("div", "zeile-oben");
  oben.appendChild(el("span", "name", link.name));
  if (link.kuerzel) oben.appendChild(el("span", "kuerzel", link.kuerzel));
  if (isStandard) oben.appendChild(el("span", "kuerzel standard", "Standardfavorit"));
  info.appendChild(oben);
  if (link.beschreibung) info.appendChild(el("div", "beschreibung", link.beschreibung));
  info.appendChild(el("div", "adresse", link.url));
  zeile.appendChild(info);

  const handlung = el("div", "handlung");
  const nachOben = knopf("Nach oben", "link-nach-oben");
  nachOben.disabled = li === 0;
  handlung.appendChild(nachOben);
  const nachUnten = knopf("Nach unten", "link-nach-unten");
  nachUnten.disabled = li === links.length - 1;
  handlung.appendChild(nachUnten);
  handlung.appendChild(knopf("Ändern", "link-aelteren"));
  handlung.appendChild(knopf("Löschen", "link-loeschen"));
  zeile.appendChild(handlung);
  return zeile;
}

function bindenBereich(kiste, bi) {
  kiste.querySelectorAll("[data-aktion]").forEach((kn) => {
    kn.addEventListener("click", () => aktion(kn.dataset.aktion, bi, kn));
  });
}

// ---- Aktionen ----------------------------------------------------------------

function aktion(name, bi, btn) {
  const bereich = daten.bereiche[bi];
  const linkId = btn ? btn.closest("[data-link]")?.dataset.link : null;

  switch (name) {
    case "bereich-nach-oben":
      if (bi > 0) {
        const tmp = daten.bereiche[bi];
        daten.bereiche[bi] = daten.bereiche[bi - 1];
        daten.bereiche[bi - 1] = tmp;
        markierenUngespeichert();
        rendern();
      }
      break;
    case "bereich-nach-unten":
      if (bi < daten.bereiche.length - 1) {
        const tmp = daten.bereiche[bi];
        daten.bereiche[bi] = daten.bereiche[bi + 1];
        daten.bereiche[bi + 1] = tmp;
        markierenUngespeichert();
        rendern();
      }
      break;
    case "bereich-umbenennen":
      umbenennenBereich(bi);
      break;
    case "bereich-loeschen":
      if ((bereich.links || []).length) {
        meldung($("#speichern-meldung"), "Der Bereich ist nicht leer.", "fehler");
        return;
      }
      if (confirm(`„${bereich.titel}“ wirklich löschen?`)) {
        daten.bereiche.splice(bi, 1);
        markierenUngespeichert();
        rendern();
      }
      break;
    case "link-hinzufuegen":
      formularOeffnen(bi, null);
      break;
    case "link-aelteren":
      formularOeffnen(bi, linkId);
      break;
    case "link-loeschen": {
      const link = (bereich.links || []).find((l) => l.id === linkId);
      if (!link) return;
      const favoriten = (daten && daten.standardFavoriten) || [];
      const isStandard = favoriten.indexOf(link.id) !== -1;
      const text = isStandard
        ? `„${link.name}“ wirklich löschen? Er wird auch aus den Standardfavoriten entfernt.`
        : `„${link.name}“ wirklich löschen?`;
      if (confirm(text)) {
        bereich.links = (bereich.links || []).filter((l) => l.id !== linkId);
        if (daten) daten.standardFavoriten = (daten.standardFavoriten || []).filter((f) => f !== linkId);
        markierenUngespeichert();
        rendern();
      }
      break;
    }
    case "link-nach-oben": {
      const links = bereich.links || [];
      const idx = links.findIndex((l) => l.id === linkId);
      if (idx > 0) {
        const tmp = links[idx];
        links[idx] = links[idx - 1];
        links[idx - 1] = tmp;
        markierenUngespeichert();
        rendern();
      }
      break;
    }
    case "link-nach-unten": {
      const links = bereich.links || [];
      const idx = links.findIndex((l) => l.id === linkId);
      if (idx < links.length - 1) {
        const tmp = links[idx];
        links[idx] = links[idx + 1];
        links[idx + 1] = tmp;
        markierenUngespeichert();
        rendern();
      }
      break;
    }
  }
}

function markierenUngespeichert() {
  ungespeichert = true;
  speicherStatus();
}

function umbenennenBereich(bi) {
  const bereich = daten.bereiche[bi];
  const neuerTitel = prompt("Neuer Titel:", bereich.titel);
  if (neuerTitel === null) return;
  if (!neuerTitel.trim()) {
    meldung($("#speichern-meldung"), "Der Titel fehlt.", "fehler");
    return;
  }
  if (neuerTitel.trim().length > 40) {
    meldung($("#speichern-meldung"), "Der Titel hat höchstens 40 Zeichen.", "fehler");
    return;
  }
  if (neuerTitel !== bereich.titel) {
    bereich.titel = neuerTitel;
    markierenUngespeichert();
    rendern();
  }
  const eingabe = prompt("Marke (wmc, wma oder beide):", bereich.marke || "");
  if (eingabe === null) return;
  const neueMarke = eingabe.trim().toLowerCase();
  const fehlerMarke = pruefen_marke(neueMarke);
  if (fehlerMarke) {
    meldung($("#speichern-meldung"), fehlerMarke, "fehler");
    return;
  }
  if (neueMarke !== bereich.marke) {
    bereich.marke = neueMarke;
    markierenUngespeichert();
    rendern();
  }
}

function bereichAnlegen() {
  const titel = prompt("Titel des neuen Bereichs:", "");
  if (titel === null) return;
  if (!titel.trim()) {
    meldung($("#speichern-meldung"), "Der Titel fehlt.", "fehler");
    return;
  }
  if (titel.trim().length > 40) {
    meldung($("#speichern-meldung"), "Der Titel hat höchstens 40 Zeichen.", "fehler");
    return;
  }
  const eingabe = prompt("Marke (wmc, wma oder beide):", "wmc");
  if (eingabe === null) return;
  const marke = eingabe.trim().toLowerCase();
  const fehlerMarke = pruefen_marke(marke);
  if (fehlerMarke) {
    meldung($("#speichern-meldung"), fehlerMarke, "fehler");
    return;
  }
  const bestehende = new Set(daten.bereiche.map((b) => b.id));
  daten.bereiche.push({ id: idAusName(titel.trim(), bestehende), titel: titel.trim(), marke, links: [] });
  markierenUngespeichert();
  rendern();
  meldung($("#speichern-meldung"),
    "Bereich angelegt. Er braucht mindestens einen Link, bevor die Liste gespeichert werden kann.", "");
}

function formularOeffnen(bi, linkId) {
  const bereich = daten.bereiche[bi];
  const container = document.querySelector(`[data-bereich="${bi}"] .formular-container`);
  if (!container) return;
  const link = linkId ? (bereich.links || []).find((l) => l.id === linkId) : null;

  while (container.firstChild) container.removeChild(container.firstChild);
  const form = el("form", "formular");
  form.setAttribute("novalidate", "");

  const feldBereich = el("div", "feld");
  feldBereich.appendChild(el("label", null, "Bereich"));
  feldBereich.lastChild.htmlFor = "f-bereich";
  const select = el("select");
  select.id = "f-bereich";
  select.name = "bereich";
  daten.bereiche.forEach((b, i) => {
    const option = el("option", null, b.titel);
    option.value = String(i);
    if (i === bi) option.selected = true;
    select.appendChild(option);
  });
  feldBereich.appendChild(select);
  feldBereich.appendChild(el("div", "meldung", ""));
  feldBereich.lastChild.id = "f-bereich-meldung";
  form.appendChild(feldBereich);

  const feldName = el("div", "feld");
  feldName.appendChild(el("label", null, "Name"));
  feldName.lastChild.htmlFor = "f-name";
  const inputName = el("input");
  inputName.id = "f-name";
  inputName.name = "name";
  inputName.type = "text";
  inputName.maxLength = 40;
  inputName.required = true;
  if (link) inputName.value = link.name;
  feldName.appendChild(inputName);
  feldName.appendChild(el("div", "meldung", ""));
  feldName.lastChild.id = "f-name-meldung";
  form.appendChild(feldName);

  const feldBeschreibung = el("div", "feld");
  feldBeschreibung.appendChild(el("label", null, "Beschreibung"));
  feldBeschreibung.lastChild.htmlFor = "f-beschreibung";
  const inputBeschreibung = el("input");
  inputBeschreibung.id = "f-beschreibung";
  inputBeschreibung.name = "beschreibung";
  inputBeschreibung.type = "text";
  inputBeschreibung.maxLength = 60;
  inputBeschreibung.required = true;
  if (link) inputBeschreibung.value = link.beschreibung || "";
  feldBeschreibung.appendChild(inputBeschreibung);
  feldBeschreibung.appendChild(el("div", "meldung", ""));
  feldBeschreibung.lastChild.id = "f-beschreibung-meldung";
  form.appendChild(feldBeschreibung);

  const feldAdresse = el("div", "feld");
  feldAdresse.appendChild(el("label", null, "Adresse"));
  feldAdresse.lastChild.htmlFor = "f-adresse";
  const inputAdresse = el("input");
  inputAdresse.id = "f-adresse";
  inputAdresse.name = "adresse";
  inputAdresse.type = "text";
  inputAdresse.maxLength = 500;
  inputAdresse.required = true;
  if (link) inputAdresse.value = link.url;
  feldAdresse.appendChild(inputAdresse);
  feldAdresse.appendChild(el("div", "meldung", ""));
  feldAdresse.lastChild.id = "f-adresse-meldung";
  form.appendChild(feldAdresse);

  const feldKuerzel = el("div", "feld");
  feldKuerzel.appendChild(el("label", null, "Kürzel (freiwillig)"));
  feldKuerzel.lastChild.htmlFor = "f-kuerzel";
  const inputKuerzel = el("input");
  inputKuerzel.id = "f-kuerzel";
  inputKuerzel.name = "kuerzel";
  inputKuerzel.type = "text";
  inputKuerzel.maxLength = 3;
  inputKuerzel.addEventListener("input", () => {
    inputKuerzel.value = inputKuerzel.value.toUpperCase();
  });
  if (link) inputKuerzel.value = link.kuerzel || "";
  feldKuerzel.appendChild(inputKuerzel);
  feldKuerzel.appendChild(el("div", "meldung", ""));
  feldKuerzel.lastChild.id = "f-kuerzel-meldung";
  form.appendChild(feldKuerzel);

  const handlung = el("div", "handlung");
  const abbrechen = el("button", "btn");
  abbrechen.type = "button";
  abbrechen.textContent = "Abbrechen";
  abbrechen.dataset.aktion = "formular-abbrechen";
  handlung.appendChild(abbrechen);
  const knopfSpeichern = el("button", "btn primär");
  knopfSpeichern.type = "submit";
  knopfSpeichern.textContent = link ? "Speichern" : "Anlegen";
  handlung.appendChild(knopfSpeichern);
  form.appendChild(handlung);

  container.appendChild(form);

  abbrechen.addEventListener("click", () => {
    while (container.firstChild) container.removeChild(container.firstChild);
  });

  // V-02, V-06, V-08: beim Verlassen jedes Feldes prüfen.
  inputName.addEventListener("blur", (e) =>
    meldung(container.querySelector("#f-name-meldung"), pruefen_name(e.target.value), "fehler"));
  inputAdresse.addEventListener("blur", (e) =>
    meldung(container.querySelector("#f-adresse-meldung"), pruefen_adresse(e.target.value), "fehler"));
  inputBeschreibung.addEventListener("blur", (e) =>
    meldung(container.querySelector("#f-beschreibung-meldung"), pruefen_beschreibung(e.target.value), "fehler"));
  inputKuerzel.addEventListener("blur", (e) =>
    meldung(container.querySelector("#f-kuerzel-meldung"), pruefen_kuerzel(e.target.value), "fehler"));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const pruefungen = [
      ["#f-name-meldung", pruefen_name(inputName.value)],
      ["#f-beschreibung-meldung", pruefen_beschreibung(inputBeschreibung.value)],
      ["#f-adresse-meldung", pruefen_adresse(inputAdresse.value)],
      ["#f-kuerzel-meldung", pruefen_kuerzel(inputKuerzel.value.trim())],
    ];
    let fehlerDa = false;
    pruefungen.forEach(([ziel, fehler]) => {
      meldung(container.querySelector(ziel), fehler, "fehler");
      if (fehler) fehlerDa = true;
    });
    if (fehlerDa) return;
    speichernLink(bi, linkId, container);
  });
}

function speichernLink(bi, linkId, container) {
  const form = container.querySelector("form");
  const neuerBi = parseInt(form.querySelector("#f-bereich").value, 10);
  const wert = {
    name: form.querySelector("#f-name").value.trim(),
    beschreibung: form.querySelector("#f-beschreibung").value.trim(),
    url: form.querySelector("#f-adresse").value.trim(),
    kuerzel: form.querySelector("#f-kuerzel").value.trim(),
  };

  if (linkId) {
    const alt = daten.bereiche[bi].links.find((l) => l.id === linkId);
    if (!alt) return;
    if (neuerBi === bi) {
      alt.name = wert.name;
      alt.beschreibung = wert.beschreibung;
      alt.url = wert.url;
      alt.kuerzel = wert.kuerzel || undefined;
    } else {
      daten.bereiche[bi].links = daten.bereiche[bi].links.filter((l) => l.id !== linkId);
      daten.bereiche[neuerBi].links.push({
        id: alt.id,
        name: wert.name,
        beschreibung: wert.beschreibung,
        url: wert.url,
        kuerzel: wert.kuerzel || undefined,
      });
    }
  } else {
    const bestehende = alleLinkIds();
    const id = idAusName(wert.name, bestehende);
    daten.bereiche[neuerBi].links.push({
      id,
      name: wert.name,
      beschreibung: wert.beschreibung,
      url: wert.url,
      kuerzel: wert.kuerzel || undefined,
    });
  }

  markierenUngespeichert();
  rendern();
}

// ---- Standardfavoriten ---------------------------------------------------------

function rendernFavoriten() {
  const container = $("#favoriten");
  if (!container) return;
  const favoriten = (daten && daten.standardFavoriten) || [];
  const alleLinks = [];
  (daten && daten.bereiche || []).forEach((b) => (b.links || []).forEach((l) => alleLinks.push(l)));
  // Erst die Standardfavoriten in ihrer Reihenfolge, dann alle übrigen Links (L-08).
  alleLinks.sort((a, b) => {
    const ia = favoriten.indexOf(a.id);
    const ib = favoriten.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  while (container.firstChild) container.removeChild(container.firstChild);
  alleLinks.forEach((link) => {
    const ist = favoriten.indexOf(link.id);
    const zeile = el("div", "eintrag");
    if (ist !== -1) {
      zeile.appendChild(el("span", "rang", ist + 1 + "."));
      zeile.appendChild(el("span", "name", link.name));
      const handlung = el("div", "handlung");
      const oben = el("button", "btn klein");
      oben.type = "button";
      oben.textContent = "Nach oben";
      oben.dataset.aktion = "fav-oben";
      oben.disabled = ist === 0;
      handlung.appendChild(oben);
      const unten = el("button", "btn klein");
      unten.type = "button";
      unten.textContent = "Nach unten";
      unten.dataset.aktion = "fav-unten";
      unten.disabled = ist === favoriten.length - 1;
      handlung.appendChild(unten);
      const loeschen = el("button", "btn klein");
      loeschen.type = "button";
      loeschen.textContent = "Entfernen";
      loeschen.dataset.aktion = "fav-loeschen";
      handlung.appendChild(loeschen);
      zeile.appendChild(handlung);
    } else {
      zeile.appendChild(el("span", "rang", "–"));
      zeile.appendChild(el("span", "name", link.name));
      const handlung = el("div", "handlung");
      const hinzufuegen = el("button", "btn klein");
      hinzufuegen.type = "button";
      hinzufuegen.textContent = "Hinzufügen";
      hinzufuegen.dataset.aktion = "fav-hinzufuegen";
      hinzufuegen.disabled = favoriten.length >= 5;
      if (favoriten.length >= 5) hinzufuegen.title = "Höchstens 5.";
      handlung.appendChild(hinzufuegen);
      zeile.appendChild(handlung);
    }
    zeile.querySelectorAll("[data-aktion]").forEach((kn) => {
      kn.addEventListener("click", () => {
        const akt = kn.dataset.aktion;
        if (akt === "fav-hinzufuegen") {
          if (favoriten.length >= 5) return;
          favoriten.push(link.id);
        } else if (akt === "fav-loeschen") {
          favoriten.splice(favoriten.indexOf(link.id), 1);
        } else if (akt === "fav-oben") {
          const idx = favoriten.indexOf(link.id);
          if (idx > 0) {
            const t = favoriten[idx];
            favoriten[idx] = favoriten[idx - 1];
            favoriten[idx - 1] = t;
          }
        } else if (akt === "fav-unten") {
          const idx = favoriten.indexOf(link.id);
          if (idx < favoriten.length - 1) {
            const t = favoriten[idx];
            favoriten[idx] = favoriten[idx + 1];
            favoriten[idx + 1] = t;
          }
        }
        daten.standardFavoriten = favoriten;
        markierenUngespeichert();
        rendernFavoriten();
      });
    });
    container.appendChild(zeile);
  });
}

// ---- Hilfe-Link -----------------------------------------------------------------

function rendernHilfe() {
  const hilfe = (daten && daten.hilfe) || {};
  const hilfeName = hilfe.name || "Link fehlt?";
  const hilfeUrl = hilfe.url || "";
  $("#hilfe-name").value = hilfeName;
  $("#hilfe-adresse").value = hilfeUrl;
  meldung($("#hilfe-name-meldung"), "");
  meldung($("#hilfe-adresse-meldung"), "");
}

function hilfeSpeichern() {
  const name = $("#hilfe-name").value.trim();
  const url = $("#hilfe-adresse").value.trim();
  const fehlerName = pruefen_name(name);
  const fehlerUrl = pruefen_adresse(url);
  meldung($("#hilfe-name-meldung"), fehlerName, "fehler");
  meldung($("#hilfe-adresse-meldung"), fehlerUrl, "fehler");
  if (fehlerName || fehlerUrl) return;
  if (!daten) daten = {};
  daten.hilfe = { name, url };
  markierenUngespeichert();
}

// ---- Protokoll -------------------------------------------------------------------

function rendernProtokoll(eintraege) {
  const tbody = $("#protokoll-zeilen");
  if (!tbody) return;
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
  eintraege.forEach((e) => {
    const tr = document.createElement("tr");
    const zellen = [
      ["Zeit", zeitKurz(e.zeit)],
      ["Name", e.name],
      ["Neu", anzahl(e.links_neu, e.bereiche_neu)],
      ["Geändert", anzahl(e.links_geaendert, e.bereiche_geaendert)],
      ["Gelöscht", anzahl(e.links_geloesch, e.bereiche_geloesch)],
      ["Sicherung", e.zurueckgeholt
        ? `Stand von ${zeitAusSicherung(e.zurueckgeholt)} zurückgeholt`
        : (e.sicherung || "")],
    ];
    zellen.forEach(([spalte, text], i) => {
      const td = el("td", i === 0 ? "zeit" : null, text);
      td.dataset.spalte = spalte;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  if (!eintraege.length) {
    const tr = document.createElement("tr");
    const td = el("td", "leer", "Noch keine Einträge.");
    td.colSpan = 6;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

function anzahl(links, bereiche) {
  const l = links || 0;
  const b = bereiche || 0;
  const teile = [l === 1 ? "1 Link" : `${l} Links`];
  if (b) teile.push(b === 1 ? "1 Bereich" : `${b} Bereiche`);
  return teile.join(", ");
}

// links.2026-10-30-173000.json -> 30.10. 17:30
function zeitAusSicherung(name) {
  const m = String(name).match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/);
  if (!m) return name;
  return `${m[3]}.${m[2]}. ${m[4]}:${m[5]}`;
}

function zeitKurzOhneJahr(iso) {
  const m = String(iso || "").match(ZEIT_MUSTER);
  if (!m) return iso || "";
  return `${m[3]}.${m[2]}. ${m[4]}:${m[5]}`;
}

// 2026-10-30T12:34:56 (Protokoll) oder 2026-10-30-123456 (Sicherung)
const ZEIT_MUSTER = /(\d{4})-(\d{2})-(\d{2})[T-](\d{2}):?(\d{2})/;

function zeitKurz(iso) {
  if (!iso) return "";
  // -> 30.10.2026 12:34
  const m = String(iso).match(ZEIT_MUSTER);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
}

// ---- Sicherungen -------------------------------------------------------------------

function rendernSicherungen(liste) {
  const container = $("#sicherungen");
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);
  liste.forEach((s) => {
    const zeile = el("div", "eintrag");
    zeile.appendChild(el("span", "zeit", zeitKurz(s.zeit)));
    zeile.appendChild(el("span", "name-person", s.name_person || "–"));
    const handlung = el("div", "handlung");
    const zurueckholen = el("button", "btn klein");
    zurueckholen.type = "button";
    zurueckholen.textContent = "Diesen Stand zurückholen";
    zurueckholen.dataset.namen = s.name;
    handlung.appendChild(zurueckholen);
    zeile.appendChild(handlung);
    zeile.querySelector("button").addEventListener("click", async () => {
      const text = `Stand von ${zeitKurzOhneJahr(s.zeit)} zurückholen? Nicht gespeicherte Änderungen gehen verloren.`;
      if (!confirm(text)) return;
      const name = $("#name").value.trim();
      if (!name || name.length < 1 || name.length > 40) {
        meldung($("#speichern-meldung"), "„Ihr Name“ braucht 1 bis 40 Zeichen.", "fehler");
        return;
      }
      meldung($("#speichern-meldung"), "Zurückholen läuft …", "");
      try {
        await api("zurueckholen", {
          methode: "POST",
          koerper: { sicherung: s.name, version, name },
        });
        meldung($("#speichern-meldung"), "Stand zurückgeholt und gespeichert.", "ok");
        await laden();
      } catch (fehler) {
        meldung($("#speichern-meldung"), fehler.message, "fehler");
      }
    });
    container.appendChild(zeile);
  });
  if (!liste.length) {
    const leer = el("div", "eintrag");
    leer.appendChild(el("span", "name-person", "Noch keine Sicherungen."));
    container.appendChild(leer);
  }
}

// ---- Speichern ---------------------------------------------------------------------

async function speichern() {
  const name = $("#name").value.trim();
  if (!name || name.length < 1 || name.length > 40) {
    meldung($("#speichern-meldung"), "„Ihr Name“ braucht 1 bis 40 Zeichen.", "fehler");
    return;
  }
  meldung($("#speichern-meldung"), "Speichern läuft …", "");
  try {
    const antwort = await api("speichern", {
      methode: "POST",
      koerper: { daten, version, name },
    });
    version = antwort.version;
    ungespeichert = false;
    speicherStatus();
    meldung($("#speichern-meldung"), `Gespeichert (Stand: ${antwort.stand}).`, "ok");
    speicherSchreiben(localStorage, NAME_SCHLUESSEL, name);
    await protokollLaden();
    await sicherungenLaden();
  } catch (fehler) {
    meldung($("#speichern-meldung"), fehler.message, "fehler");
  }
}

// ---- Verlassen ---------------------------------------------------------------------

function beendenPruefen(e) {
  if (!ungespeichert) return;
  e.preventDefault();
  e.returnValue = "";
  return "";
}

// ---- Init --------------------------------------------------------------------------

function init() {
  // Name vorbelegen (L-10).
  const gespeicherterName = speicherLesen(localStorage, NAME_SCHLUESSEL);
  if (gespeicherterName) {
    $("#name").value = gespeicherterName;
  }

  // Anmeldung.
  $("#anmeldeformular").addEventListener("submit", (e) => {
    e.preventDefault();
    anmelden();
  });

  // Speichern / Abmelden / Hilfe.
  $("#speichern").addEventListener("click", speichern);
  $("#abmelden").addEventListener("click", abmelden);
  $("#hilfeformular").addEventListener("submit", (e) => {
    e.preventDefault();
    hilfeSpeichern();
  });

  // Bereich anlegen (L-07).
  $("#bereich-hinzufuegen").addEventListener("click", bereichAnlegen);

  // Hilfe-Link: beim Verlassen jedes Feldes prüfen (V-06, V-08).
  $("#hilfe-name").addEventListener("blur", (e) =>
    meldung($("#hilfe-name-meldung"), pruefen_name(e.target.value), "fehler"));
  $("#hilfe-adresse").addEventListener("blur", (e) =>
    meldung($("#hilfe-adresse-meldung"), pruefen_adresse(e.target.value), "fehler"));

  // Verlassen der Seite (L-10).
  window.addEventListener("beforeunload", beendenPruefen);

  // Prüfen, ob bereits eine Sitzung besteht. Ohne den Token aus der Anmeldung
  // könnte die Seite nicht speichern (L-13); dann neu anmelden.
  (async () => {
    const csrf = speicherLesen(sessionStorage, CSRF_SCHLUESSEL);
    try {
      if (!csrf) throw new Error("Kein Token");
      sitzung = { csrf };
      await api("liste");
      version = 0;
      await laden();
      $("#anmeldung").hidden = true;
      $("#uebersicht").hidden = false;
      status("Angemeldet");
    } catch {
      // Keine Sitzung: Anmeldung zeigen.
      sitzung = null;
      $("#anmeldung").hidden = false;
      $("#uebersicht").hidden = true;
    }
  })();
}

document.addEventListener("DOMContentLoaded", init);
