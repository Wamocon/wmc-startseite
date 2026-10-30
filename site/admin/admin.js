// Admin-Ansicht zum Pflegen der Links (L-01 bis L-15).
// Kein Inline-Skript (N-02, B-03), keine fremden Server (L-13).

// ---- Zustand -----------------------------------------------------------------

let sitzung = null;          // {csrf} oder null
let version = 0;             // Versionsnummer der geladenen Liste
let daten = null;            // geladene Linkliste
let ungespeichert = false;   // „Nicht gespeicherte Änderungen“

// ---- Helfer ------------------------------------------------------------------

function $(sel) {
  return document.querySelector(sel);
}

function status(text, klasse = "") {
  const el = $("#status");
  if (el) {
    el.textContent = text;
    el.className = "status " + klasse;
  }
}

function meldung(el, text, klasse = "") {
  if (el) {
    el.textContent = text;
    el.className = "meldung " + klasse;
  }
}

function speicherStatus() {
  const el = $("#status");
  if (!el) return;
  if (ungespeichert) {
    el.textContent = "Nicht gespeicherte Änderungen";
    el.className = "status ungespeichert";
  } else {
    el.textContent = "Gespeichert";
    el.className = "status";
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
  if (wert.length > 120) return "Der Name hat höchstens 120 Zeichen.";
  return "";
}

function pruefen_adresse(wert) {
  if (!wert || !wert.trim()) return "Die Adresse fehlt.";
  const url = wert.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return "Die Adresse braucht http:// oder https://.";
  }
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
  if (wert && wert.length > 200) return "Die Beschreibung hat höchstens 200 Zeichen.";
  return "";
}

function pruefen_kuerzel(wert) {
  if (!wert) return "";
  if (!/^[a-z]{1,4}$/.test(wert)) return "Das Kürzel braucht 1 bis 4 Kleinbuchstaben.";
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
    const el = document.createElement("div");
    el.className = "bereich";
    el.dataset.bereich = bi;
    el.appendChild(bereichBauen(bereich, bi));
    container.appendChild(el);
    bindenBereich(el, bi);
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

function knopf(text, aktion, zusatzKlasse = "") {
  const b = el("button", "btn klein" + (zusatzKlasse ? " " + zusatzKlasse : ""));
  b.type = "button";
  b.textContent = text;
  b.dataset.aktion = aktion;
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

function bindenBereich(el, bi) {
  el.querySelectorAll("[data-aktion]").forEach((kn) => {
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
  if (neuerTitel !== bereich.titel) {
    bereich.titel = neuerTitel;
    markierenUngespeichert();
    rendern();
  }
  const neueMarke = prompt("Neue Marke (ein Buchstabe):", bereich.marke || "");
  if (neueMarke === null) return;
  if (neueMarke !== bereich.marke) {
    bereich.marke = neueMarke;
    markierenUngespeichert();
    rendern();
  }
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
  inputName.maxLength = 120;
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
  inputBeschreibung.maxLength = 200;
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
  inputKuerzel.maxLength = 4;
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
  const speichern = el("button", "btn primär");
  speichern.type = "submit";
  speichern.textContent = link ? "Speichern" : "Anlegen";
  handlung.appendChild(speichern);
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
    const fehler =
      pruefen_name(inputName.value) ||
      pruefen_adresse(inputAdresse.value);
    if (fehler) {
      meldung(container.querySelector("#f-name-meldung"), fehler, "fehler");
      return;
    }
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

  while (container.firstChild) container.removeChild(container.firstChild);
  alleLinks.forEach((link) => {
    const ist = favoriten.indexOf(link.id);
    const el = document.createElement("div");
    el.className = "eintrag";
    if (ist !== -1) {
      el.appendChild(el("span", "rang", ist + 1 + "."));
      el.appendChild(el("span", "name", link.name));
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
      el.appendChild(handlung);
    } else {
      el.appendChild(el("span", "rang", "–"));
      el.appendChild(el("span", "name", link.name));
      const handlung = el("div", "handlung");
      const hinzufuegen = el("button", "btn klein");
      hinzufuegen.type = "button";
      hinzufuegen.textContent = "Hinzufügen";
      hinzufuegen.dataset.aktion = "fav-hinzufuegen";
      hinzufuegen.disabled = favoriten.length >= 5;
      if (favoriten.length >= 5) hinzufuegen.title = "Höchstens 5.";
      handlung.appendChild(hinzufuegen);
      el.appendChild(handlung);
    }
    el.querySelectorAll("[data-aktion]").forEach((kn) => {
      kn.addEventListener("click", () => {
        const akt = kn.dataset.aktion;
        if (akt === "fav-hinzufuegen") {
          if (favoriten.length >= 5) return;
          favoriten.push(link.id);
        } else if (akt === "fav-loeschen") {
          daten.standardFavoriten = favoriten.filter((f) => f !== link.id);
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
    container.appendChild(el);
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
  // V-02, V-06, V-08: beim Verlassen jedes Feldes prüfen.
  $("#hilfe-name").addEventListener("blur", (e) =>
    meldung($("#hilfe-name-meldung"), pruefen_name(e.target.value), "fehler"));
  $("#hilfe-adresse").addEventListener("blur", (e) =>
    meldung($("#hilfe-adresse-meldung"), pruefen_adresse(e.target.value), "fehler"));
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
    tr.appendChild(el("td", "zeit", zeitKurz(e.zeit)));
    tr.appendChild(el("td", null, e.name));
    tr.appendChild(el("td", null, String(e.links_neu ?? 0)));
    tr.appendChild(el("td", null, String(e.links_geaendert ?? 0)));
    tr.appendChild(el("td", null, String(e.links_geloesch ?? 0)));
    tr.appendChild(el("td", null, e.zurueckgeholt ? "Stand zurückgeholt" : (e.sicherung || "")));
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

function zeitKurz(iso) {
  if (!iso) return "";
  // 2026-10-30T12:34:56 -> 30.10.12:34
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
}

// ---- Sicherungen -------------------------------------------------------------------

function rendernSicherungen(liste) {
  const container = $("#sicherungen");
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);
  liste.forEach((s) => {
    const el = document.createElement("div");
    el.className = "eintrag";
    el.appendChild(el("span", "zeit", zeitKurz(s.zeit)));
    el.appendChild(el("span", "name-person", s.name_person || "–"));
    const handlung = el("div", "handlung");
    const zurueckholen = el("button", "btn klein");
    zurueckholen.type = "button";
    zurueckholen.textContent = "Diesen Stand zurückholen";
    zurueckholen.dataset.namen = s.name;
    handlung.appendChild(zurueckholen);
    el.appendChild(handlung);
    el.querySelector("button").addEventListener("click", async () => {
      const text = `Stand von ${zeitKurz(s.zeit)} zurückholen? Nicht gespeicherte Änderungen gehen verloren.`;
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
    container.appendChild(el);
  });
  if (!liste.length) {
    const el = document.createElement("div");
    el.className = "eintrag";
    el.appendChild(el("span", "name-person", "Noch keine Sicherungen."));
    container.appendChild(el);
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
    localStorage.setItem("wmc_admin_name", name);
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
  const speichern = localStorage.getItem("wmc_admin_name");
  if (speichern) {
    $("#name").value = speichern;
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

  // Verlassen der Seite (L-10).
  window.addEventListener("beforeunload", beendenPruefen);

  // Prüfen, ob bereits eine Sitzung besteht.
  (async () => {
    try {
      await api("liste");
      sitzung = { csrf: "existiert" };
      version = 0;
      await laden();
      $("#anmeldung").hidden = true;
      $("#uebersicht").hidden = false;
      status("Angemeldet");
    } catch {
      // Keine Sitzung: Anmeldung zeigen.
      $("#anmeldung").hidden = false;
      $("#uebersicht").hidden = true;
    }
  })();
}

document.addEventListener("DOMContentLoaded", init);
