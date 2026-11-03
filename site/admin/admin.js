// Admin-Ansicht zum Pflegen der Links (L-01 bis L-15).
// Kein Inline-Skript (N-02, B-03), keine fremden Server (L-13).

// ---- Zustand -----------------------------------------------------------------

let sitzung = null;       // {csrf} oder null
let version = 0;          // Versionsnummer der geladenen Liste
let daten = null;         // die Liste, wie sie gerade bearbeitet wird
let grundstand = "";      // JSON der Liste beim letzten Laden oder Speichern
const schritte = [];      // frühere Stände für „Rückgängig“
let offen = null;         // offene Zeile {bi, linkId, entwurf, fokus}; linkId null = neuer Link
let suchtext = "";
let gezogen = null;       // {art, id} während des Ziehens
let fokusDanach = null;   // Selektor, der nach dem Zeichnen den Fokus bekommt
let hinweisUhr = 0;

const NAME_SCHLUESSEL = "wmc_admin_name";
const CSRF_SCHLUESSEL = "wmc_admin_csrf";
const MARKEN = [["wmc", "WMC"], ["wma", "WMA"], ["beide", "WMC · WMA"]];
const REITER = ["links", "verlauf", "hilfe"];
const FAVORITEN_HOECHSTENS = 5;

const SYMBOLE = {
  griff: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  stift: "M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z",
  eimer: "M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5",
  stern: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
  plus: "M12 5v14M5 12h14",
  hoch: "M12 19V5M6 11l6-6 6 6",
  runter: "M12 5v14M6 13l6 6 6-6",
  links: "M19 12H5M11 6l-6 6 6 6",
  kreuz: "M6 6l12 12M18 6L6 18",
};

// ---- Helfer ------------------------------------------------------------------

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

// Texte immer als Text, nie als HTML (L-13).
function el(tag, klasse, text) {
  const n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

function symbol(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const pfad = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pfad.setAttribute("d", SYMBOLE[name]);
  svg.appendChild(pfad);
  return svg;
}

function symbolKnopf(name, aktionName, beschriftung, klasse = "") {
  const b = el("button", "symbol-knopf" + (klasse ? " " + klasse : ""));
  b.type = "button";
  b.dataset.aktion = aktionName;
  b.setAttribute("aria-label", beschriftung);
  b.title = beschriftung;
  b.appendChild(symbol(name));
  return b;
}

// Die Klasse nur mit Text: Eine leere Meldung darf nichts verschieben.
function meldung(ziel, text, klasse = "") {
  if (ziel) {
    ziel.textContent = text;
    ziel.className = text && klasse ? "meldung " + klasse : "meldung";
  }
}

function ansagen(text) {
  $("#ansage").textContent = text;
}

function hinweisZeigen(text, mitRueckgaengig = false) {
  $("#hinweis-text").textContent = text;
  $("#hinweis-rueckgaengig").hidden = !mitRueckgaengig;
  $("#hinweis").hidden = false;
  clearTimeout(hinweisUhr);
  hinweisUhr = setTimeout(() => {
    $("#hinweis").hidden = true;
  }, 8000);
}

function istGeaendert() {
  return daten !== null && JSON.stringify(daten) !== grundstand;
}

// Titel und Hilfe-Link kommen erst beim Verlassen des Feldes in die Liste.
// Speichern und der Hinweis müssen aber schon beim Tippen stimmen.
function eingabeOffen() {
  const feld = document.activeElement;
  if (!feld || !daten) return false;
  const hilfe = daten.hilfe || {};
  if (feld.id === "hilfe-name") return feld.value.trim() !== (hilfe.name || "");
  if (feld.id === "hilfe-adresse") return feld.value.trim() !== (hilfe.url || "");
  if (!feld.classList.contains("bereich-titel")) return false;
  const bi = Number(feld.closest("[data-bereich]").dataset.bereich);
  return feld.value.trim() !== daten.bereiche[bi].titel;
}

function feldUebernehmen() {
  const feld = document.activeElement;
  if (!eingabeOffen()) return;
  feld.blur();
  feld.focus();
}

function hilfeFehlerhaft() {
  return $("#hilfe-name-meldung").textContent !== "" || $("#hilfe-adresse-meldung").textContent !== "";
}

function hilfeFehlerLoeschen() {
  meldung($("#hilfe-name-meldung"), "");
  meldung($("#hilfe-adresse-meldung"), "");
}

function speicherStatus() {
  const geaendert = istGeaendert() || eingabeOffen() || hilfeFehlerhaft();
  const feld = $("#status");
  feld.textContent = geaendert ? "Nicht gespeicherte Änderungen" : "Gespeichert";
  feld.classList.toggle("ungespeichert", geaendert);
  // Auch eine offene Zeile lässt sich speichern: speichern() übernimmt sie vorher.
  $("#speichern").disabled = !geaendert && !offen;
  $("#rueckgaengig").disabled = schritte.length === 0;
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
    const fehler = new Error(parsed.fehler || "Unbekannter Fehler.");
    fehler.status = antwort.status;
    throw fehler;
  }
  return parsed;
}

// ---- Anmeldung / Abmeldung ---------------------------------------------------

function ansichtZeigen() {
  $("#anmeldung").hidden = true;
  $("#uebersicht").hidden = false;
}

function anmeldungZeigen(text = "") {
  $("#anmeldung").hidden = false;
  $("#uebersicht").hidden = true;
  meldung($("#anmeldung-meldung"), text, "fehler");
}

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
    // War nur die Sitzung abgelaufen, bleiben die Änderungen stehen.
    if (!istGeaendert()) await laden();
    ansichtZeigen();
    $("#passwort").value = "";
    $("#filter").focus();
  } catch (fehler) {
    meldung($("#anmeldung-meldung"), fehler.message, "fehler");
  }
}

async function abmelden() {
  feldUebernehmen();
  if (istGeaendert() || hilfeFehlerhaft()) {
    const frage = "Nicht gespeicherte Änderungen gehen beim Abmelden verloren. Trotzdem abmelden?";
    if (!(await nachfragen(frage, "Abmelden"))) return;
  }
  try {
    await api("abmelden", { methode: "POST" });
  } catch {
    // Abmelden schlägt nicht fehl; die Sitzung wird lokal beendet.
  }
  sitzung = null;
  speicherSchreiben(sessionStorage, CSRF_SCHLUESSEL, null);
  grundstand = JSON.stringify(daten);
  hilfeFehlerLoeschen();
  location.href = "/admin";
}

function sitzungAbgelaufen() {
  sitzung = null;
  speicherSchreiben(sessionStorage, CSRF_SCHLUESSEL, null);
  anmeldungZeigen("Die Sitzung ist abgelaufen. Bitte wieder anmelden; Ihre Änderungen bleiben erhalten.");
  $("#passwort").focus();
}

// ---- Laden -------------------------------------------------------------------

async function laden() {
  const antwort = await api("liste");
  version = antwort.version;
  daten = antwort.daten;
  grundstand = JSON.stringify(daten);
  schritte.length = 0;
  offen = null;
  hilfeFehlerLoeschen();
  zeichnen();
  await verlaufLaden();
}

async function verlaufLaden() {
  try {
    const antwort = await api("protokoll");
    zeichneProtokoll(antwort.eintraege || []);
    const stand = await api("sicherungen");
    zeichneSicherungen(stand.sicherungen || []);
  } catch (fehler) {
    meldung($("#speichern-meldung"), "Verlauf nicht geladen: " + fehler.message, "fehler");
  }
}

// ---- Ändern und Rückgängig (L-10) ----------------------------------------------

function aendern(schritt, neuZeichnen = true) {
  const vorher = JSON.stringify(daten);
  schritt();
  if (JSON.stringify(daten) !== vorher) {
    schritte.push(vorher);
    if (schritte.length > 200) schritte.shift();
    meldung($("#speichern-meldung"), "");
  }
  if (neuZeichnen) zeichnen();
  else speicherStatus();
}

function rueckgaengig() {
  if (!schritte.length) return;
  daten = JSON.parse(schritte.pop());
  offen = null;
  $("#hinweis").hidden = true;
  hilfeFehlerLoeschen();
  zeichnen();
  ansagen("Rückgängig gemacht.");
}

// ---- Prüfregeln wie im Schema (V-02, V-06, V-08) --------------------------------

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
  if (!/^[A-Z0-9ÄÖÜ]{1,3}$/.test(wert)) return "1 bis 3 Großbuchstaben oder Ziffern.";
  return "";
}

function pruefen_titel(wert) {
  if (!wert || !wert.trim()) return "Der Titel fehlt.";
  if (wert.trim().length > 40) return "Der Titel hat höchstens 40 Zeichen.";
  return "";
}

// ---- IDs und Kürzel -------------------------------------------------------------

function idAusName(name, bestehende) {
  const umlaute = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };
  let grund = name.toLowerCase()
    .replace(/[äöüß]/g, (z) => umlaute[z])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36)
    .replace(/-+$/g, "");
  if (!grund) grund = "link";
  if (!bestehende.has(grund)) return grund;
  let zahl = 2;
  while (bestehende.has(`${grund}-${zahl}`)) zahl++;
  return `${grund}-${zahl}`;
}

function alleLinkIds() {
  const ids = new Set();
  for (const b of daten.bereiche) {
    for (const l of b.links || []) ids.add(l.id);
  }
  return ids;
}

// Dieselbe Regel wie auf der Startseite (F-04).
function kuerzelFormen(name) {
  return (name || "")
    .split("")
    .filter((zeichen) => /[A-Za-zÄÖÜäöü0-9]/.test(zeichen))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function linkFinden(id) {
  for (let bi = 0; bi < daten.bereiche.length; bi++) {
    const li = (daten.bereiche[bi].links || []).findIndex((l) => l.id === id);
    if (li !== -1) return { bi, li };
  }
  return null;
}

function linkNachId(id) {
  const ort = linkFinden(id);
  return ort ? daten.bereiche[ort.bi].links[ort.li] : null;
}

function passt(link) {
  if (!suchtext) return true;
  const text = [link.name, link.beschreibung, link.url, link.kuerzel || ""].join(" ").toLowerCase();
  return suchtext.toLowerCase().split(/\s+/).every((wort) => text.includes(wort));
}

// ---- Zeichnen -------------------------------------------------------------------

function zeichnen() {
  entwurfMerken();
  zeichneFavoriten();
  zeichneBereiche();
  zeichneHilfe();
  speicherStatus();
  fokusNachZeichnen();
}

function fokusNachZeichnen() {
  if (offen && offen.fokus) {
    offen.fokus = false;
    const feld = $("#f-name");
    if (feld) {
      feld.focus();
      feld.select();
      feld.closest(".link-zeile").scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (fokusDanach) {
    const ziel = $(fokusDanach);
    fokusDanach = null;
    if (ziel) ziel.focus();
  }
}

function zeichneBereiche() {
  const wurzel = $("#bereiche");
  wurzel.replaceChildren();
  let treffer = 0;
  daten.bereiche.forEach((bereich, bi) => {
    const zeilen = (bereich.links || []).filter(passt);
    treffer += zeilen.length;
    if (suchtext && !zeilen.length) return;
    wurzel.appendChild(bereichBauen(bereich, bi, zeilen));
  });
  const leer = $("#kein-treffer");
  leer.hidden = !suchtext || treffer > 0;
  leer.textContent = suchtext ? `Kein Treffer für „${suchtext}“.` : "";
}

function bereichBauen(bereich, bi, zeilen) {
  const kiste = el("section", "bereich");
  kiste.dataset.bereich = bi;
  kiste.dataset.marke = bereich.marke;

  const kopf = el("div", "bereich-kopf");
  if (!suchtext) {
    kopf.appendChild(symbolKnopf("griff", "bereich-griff", "", "griff"));
  }

  const ueberschrift = el("h3");
  const titel = el("input", "bereich-titel");
  titel.type = "text";
  titel.maxLength = 40;
  titel.value = bereich.titel;
  titel.setAttribute("aria-label", "Titel des Bereichs");
  ueberschrift.appendChild(titel);
  kopf.appendChild(ueberschrift);

  const wahl = el("select", "marke");
  MARKEN.forEach(([wert, text]) => {
    const option = el("option", null, text);
    option.value = wert;
    option.selected = wert === bereich.marke;
    wahl.appendChild(option);
  });
  kopf.appendChild(wahl);

  if (!suchtext) {
    kopf.appendChild(symbolKnopf("hoch", "bereich-nach-oben", "", "nur-beruehrung"));
    kopf.appendChild(symbolKnopf("runter", "bereich-nach-unten", "", "nur-beruehrung"));
  }
  const loeschen = symbolKnopf("eimer", "bereich-loeschen", "");
  loeschen.disabled = (bereich.links || []).length > 0;
  kopf.appendChild(loeschen);
  kiste.appendChild(kopf);
  bereichBeschriften(kiste, bi);

  const liste = el("ul", "links");
  zeilen.forEach((link) => {
    liste.appendChild(offen && offen.linkId === link.id ? editorBauen(bi, link) : zeileBauen(link));
  });
  if (offen && offen.linkId === null && offen.bi === bi) {
    liste.appendChild(editorBauen(bi, null));
  } else if (!suchtext) {
    const neu = el("li", "link-neu");
    const knopf = el("button", "btn-text");
    knopf.type = "button";
    knopf.dataset.aktion = "link-hinzufuegen";
    knopf.appendChild(symbol("plus"));
    knopf.appendChild(el("span", null, "Link hinzufügen"));
    neu.appendChild(knopf);
    liste.appendChild(neu);
  }
  kiste.appendChild(liste);
  return kiste;
}

// Alles, was den Titel nennt; auch die Bereichswahl einer offenen Zeile.
function bereichBeschriften(kiste, bi) {
  const { titel, links } = daten.bereiche[bi];
  const texte = {
    "bereich-griff": `Bereich „${titel}“ verschieben: ziehen oder Pfeiltasten`,
    "bereich-nach-oben": `Bereich „${titel}“ nach oben`,
    "bereich-nach-unten": `Bereich „${titel}“ nach unten`,
    "bereich-loeschen": (links || []).length ? "Der Bereich ist nicht leer." : `Bereich „${titel}“ löschen`,
  };
  kiste.querySelectorAll(".bereich-kopf [data-aktion]").forEach((knopf) => {
    knopf.setAttribute("aria-label", texte[knopf.dataset.aktion]);
    knopf.title = texte[knopf.dataset.aktion];
  });
  kiste.querySelector(".marke").setAttribute("aria-label", `Marke von „${titel}“`);
  const wahl = document.querySelector(`#f-bereich option[value="${bi}"]`);
  if (wahl) wahl.textContent = titel;
}

function zeileBauen(link) {
  const zeile = el("li", "link-zeile");
  zeile.dataset.link = link.id;
  zeile.draggable = !suchtext;

  if (!suchtext) {
    zeile.appendChild(symbolKnopf("griff", "link-griff",
      `„${link.name}“ verschieben: ziehen oder Pfeiltasten`, "griff"));
  }
  zeile.appendChild(el("span", link.kuerzel ? "kuerzel" : "kuerzel kuerzel-auto",
    link.kuerzel || kuerzelFormen(link.name)));

  const text = el("button", "zeile-text");
  text.type = "button";
  text.dataset.aktion = "link-oeffnen";
  text.setAttribute("aria-label", `„${link.name}“ ändern`);
  text.appendChild(el("span", "name", link.name));
  text.appendChild(el("span", "beschreibung", link.beschreibung));
  zeile.appendChild(text);

  const adresse = el("a", "adresse", link.url.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  adresse.href = link.url;
  adresse.target = "_blank";
  adresse.rel = "noopener noreferrer";
  adresse.title = `${link.url} in neuem Tab öffnen`;
  zeile.appendChild(adresse);

  const handlung = el("div", "handlung");
  const favoriten = daten.standardFavoriten || [];
  const stern = symbolKnopf("stern", "fav-umschalten", `„${link.name}“ als Standardfavorit`, "stern");
  stern.setAttribute("aria-pressed", String(favoriten.includes(link.id)));
  handlung.appendChild(stern);
  if (!suchtext) {
    handlung.appendChild(symbolKnopf("hoch", "link-nach-oben", `„${link.name}“ nach oben`, "nur-beruehrung"));
    handlung.appendChild(symbolKnopf("runter", "link-nach-unten", `„${link.name}“ nach unten`, "nur-beruehrung"));
  }
  handlung.appendChild(symbolKnopf("stift", "link-aelteren", `„${link.name}“ ändern`));
  handlung.appendChild(symbolKnopf("eimer", "link-loeschen", `„${link.name}“ löschen`));
  zeile.appendChild(handlung);
  return zeile;
}

// ---- Zeile bearbeiten (L-04) -----------------------------------------------------

function feldBauen(id, beschriftung, eingabe) {
  const feld = el("div", "feld " + id);
  const schild = el("label", null, beschriftung);
  schild.htmlFor = id;
  feld.appendChild(schild);
  eingabe.id = id;
  feld.appendChild(eingabe);
  const hinweisFeld = el("div", "meldung");
  hinweisFeld.id = id + "-meldung";
  feld.appendChild(hinweisFeld);
  return feld;
}

function eingabeBauen(name, wert, hoechstens) {
  const eingabe = el("input");
  eingabe.type = "text";
  eingabe.name = name;
  eingabe.maxLength = hoechstens;
  eingabe.value = wert;
  eingabe.autocomplete = "off";
  return eingabe;
}

function editorBauen(bi, link) {
  const wert = (offen && offen.entwurf) || {
    bi,
    name: link ? link.name : "",
    beschreibung: link ? link.beschreibung : "",
    url: link ? link.url : "",
    kuerzel: link ? link.kuerzel || "" : "",
  };

  const zeile = el("li", "link-zeile bearbeitet");
  if (link) zeile.dataset.link = link.id;
  const form = el("form", "formular");
  form.noValidate = true;

  const name = eingabeBauen("name", wert.name, 40);
  const beschreibung = eingabeBauen("beschreibung", wert.beschreibung, 60);
  const adresse = eingabeBauen("adresse", wert.url, 500);
  adresse.spellcheck = false;
  const kuerzel = eingabeBauen("kuerzel", wert.kuerzel, 3);
  kuerzel.placeholder = "frei";
  kuerzel.addEventListener("input", () => {
    kuerzel.value = kuerzel.value.toUpperCase();
  });
  const wahl = el("select");
  wahl.name = "bereich";
  daten.bereiche.forEach((b, i) => {
    const option = el("option", null, b.titel);
    option.value = String(i);
    option.selected = i === wert.bi;
    wahl.appendChild(option);
  });

  const felder = el("div", "felder");
  felder.appendChild(feldBauen("f-name", "Name", name));
  felder.appendChild(feldBauen("f-beschreibung", "Beschreibung", beschreibung));
  felder.appendChild(feldBauen("f-adresse", "Adresse", adresse));
  felder.appendChild(feldBauen("f-kuerzel", "Kürzel", kuerzel));
  felder.appendChild(feldBauen("f-bereich", "Bereich", wahl));
  form.appendChild(felder);

  const handlung = el("div", "handlung");
  handlung.appendChild(el("span", "hinweis", "Enter übernimmt, Esc bricht ab."));
  const abbrechen = el("button", "btn", "Abbrechen");
  abbrechen.type = "button";
  abbrechen.dataset.aktion = "formular-abbrechen";
  handlung.appendChild(abbrechen);
  const absenden = el("button", "btn btn-haupt", link ? "Übernehmen" : "Anlegen und weiter");
  absenden.type = "submit";
  handlung.appendChild(absenden);
  form.appendChild(handlung);
  zeile.appendChild(form);

  // V-02, V-06, V-08: beim Verlassen jedes Feldes prüfen.
  const regeln = [
    [name, "#f-name-meldung", pruefen_name],
    [beschreibung, "#f-beschreibung-meldung", pruefen_beschreibung],
    [adresse, "#f-adresse-meldung", pruefen_adresse],
    [kuerzel, "#f-kuerzel-meldung", pruefen_kuerzel],
  ];
  regeln.forEach(([feld, ziel, regel]) => {
    feld.addEventListener("blur", () => {
      meldung($(ziel), regel(feld.value.trim()), "fehler");
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const neu = offen.linkId === null;
    const ziel = Number(wahl.value);
    const benannt = name.value.trim();
    if (!editorAnwenden()) return;
    if (neu && benannt) {
      // Gleich der nächste Link, ohne neu zu klicken.
      offen = { bi: ziel, linkId: null, entwurf: null, fokus: true };
      zeichnen();
      hinweisZeigen(`„${benannt}“ angelegt.`, true);
    }
  });
  form.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      editorSchliessen();
    }
  });
  return zeile;
}

function entwurfMerken() {
  const form = $("#bereiche form.formular");
  if (form && offen) offen.entwurf = editorLesen(form);
}

function editorLesen(form) {
  return {
    bi: Number(form.querySelector("#f-bereich").value),
    name: form.querySelector("#f-name").value.trim(),
    beschreibung: form.querySelector("#f-beschreibung").value.trim(),
    url: form.querySelector("#f-adresse").value.trim(),
    kuerzel: form.querySelector("#f-kuerzel").value.trim(),
  };
}

// Übernimmt die offene Zeile in die Liste. false: Eine Eingabe stimmt nicht.
function editorAnwenden() {
  const form = $("#bereiche form.formular");
  if (!offen) return true;
  if (!form) {
    offen = null;
    return true;
  }
  const wert = editorLesen(form);
  const { bi, linkId } = offen;
  if (linkId === null && !wert.name && !wert.beschreibung && !wert.url && !wert.kuerzel) {
    offen = null;
    zeichnen();
    return true;
  }
  const pruefungen = [
    ["#f-name", pruefen_name(wert.name)],
    ["#f-beschreibung", pruefen_beschreibung(wert.beschreibung)],
    ["#f-adresse", pruefen_adresse(wert.url)],
    ["#f-kuerzel", pruefen_kuerzel(wert.kuerzel)],
  ];
  let erstes = null;
  pruefungen.forEach(([feld, fehler]) => {
    meldung(form.querySelector(feld + "-meldung"), fehler, "fehler");
    if (fehler && !erstes) erstes = form.querySelector(feld);
  });
  if (erstes) {
    reiterWaehlen("links");
    erstes.focus();
    return false;
  }
  offen = null;
  aendern(() => linkSchreiben(bi, linkId, wert));
  return true;
}

function linkSchreiben(bi, linkId, wert) {
  const felder = { name: wert.name, beschreibung: wert.beschreibung, url: wert.url };
  if (wert.kuerzel) felder.kuerzel = wert.kuerzel;
  if (linkId === null) {
    daten.bereiche[wert.bi].links.push({ id: idAusName(wert.name, alleLinkIds()), ...felder });
    return;
  }
  const alte = daten.bereiche[bi].links;
  const stelle = alte.findIndex((l) => l.id === linkId);
  const neu = { id: linkId, ...felder };
  if (wert.bi === bi) {
    alte[stelle] = neu;
  } else {
    // Wechselt der Bereich, wandert der Link ans Ende des neuen Bereichs (L-04).
    alte.splice(stelle, 1);
    daten.bereiche[wert.bi].links.push(neu);
  }
}

function editorOeffnen(bi, linkId) {
  if (!editorAnwenden()) return;
  offen = { bi, linkId, entwurf: null, fokus: true };
  zeichnen();
}

function editorSchliessen() {
  const { bi, linkId } = offen;
  offen = null;
  fokusDanach = linkId
    ? `.link-zeile[data-link="${linkId}"] .zeile-text`
    : `[data-bereich="${bi}"] [data-aktion="link-hinzufuegen"]`;
  zeichnen();
}

// ---- Links und Bereiche ändern -----------------------------------------------------

function linkLoeschen(linkId) {
  const ziel = linkNachId(linkId);
  if (!ziel) return;
  const favorit = (daten.standardFavoriten || []).includes(linkId);
  const benannt = ziel.name;
  aendern(() => {
    const ort = linkFinden(linkId);
    daten.bereiche[ort.bi].links.splice(ort.li, 1);
    daten.standardFavoriten = (daten.standardFavoriten || []).filter((f) => f !== linkId);
  });
  hinweisZeigen(favorit
    ? `„${benannt}“ gelöscht und aus den Standardfavoriten entfernt.`
    : `„${benannt}“ gelöscht.`, true);
}

function linkVerschieben(id, zielBi, zielStelle) {
  aendern(() => {
    const ort = linkFinden(id);
    const [eintrag] = daten.bereiche[ort.bi].links.splice(ort.li, 1);
    let stelle = zielStelle;
    if (ort.bi === zielBi && ort.li < zielStelle) stelle -= 1;
    daten.bereiche[zielBi].links.splice(stelle, 0, eintrag);
  });
}

// Ein Schritt nach oben oder unten, am Rand in den Nachbarbereich (L-06).
function linkSchritt(id, richtung) {
  const ort = linkFinden(id);
  if (!ort) return;
  const liste = daten.bereiche[ort.bi].links;
  let zielBi = ort.bi;
  let zielStelle = ort.li + (richtung < 0 ? -1 : 2);
  if (ort.li + richtung < 0) {
    if (ort.bi === 0) return;
    zielBi = ort.bi - 1;
    zielStelle = daten.bereiche[zielBi].links.length;
  } else if (ort.li + richtung >= liste.length) {
    if (ort.bi === daten.bereiche.length - 1) return;
    zielBi = ort.bi + 1;
    zielStelle = 0;
  }
  fokusDanach = `.link-zeile[data-link="${id}"] .griff`;
  linkVerschieben(id, zielBi, zielStelle);
  const neu = linkFinden(id);
  ansagen(`Stelle ${neu.li + 1} in ${daten.bereiche[neu.bi].titel}`);
}

function bereichSchritt(bi, richtung) {
  const ziel = bi + richtung;
  if (ziel < 0 || ziel >= daten.bereiche.length) return;
  aendern(() => {
    const [teil] = daten.bereiche.splice(bi, 1);
    daten.bereiche.splice(ziel, 0, teil);
  });
  const griff = $(`[data-bereich="${ziel}"] .bereich-kopf .griff`);
  if (griff) griff.focus();
  ansagen(`Bereich an Stelle ${ziel + 1}`);
}

function favoritUmschalten(linkId) {
  const favoriten = daten.standardFavoriten || [];
  const istFavorit = favoriten.includes(linkId);
  if (!istFavorit && favoriten.length >= FAVORITEN_HOECHSTENS) {
    hinweisZeigen(`Höchstens ${FAVORITEN_HOECHSTENS} Standardfavoriten. Bitte erst einen entfernen.`);
    return;
  }
  fokusDanach = `.link-zeile[data-link="${linkId}"] .stern`;
  aendern(() => {
    daten.standardFavoriten = istFavorit
      ? favoriten.filter((f) => f !== linkId)
      : [...favoriten, linkId];
  });
}

function favoritSetzen(id, stelle) {
  aendern(() => {
    const liste = daten.standardFavoriten;
    liste.splice(liste.indexOf(id), 1);
    liste.splice(stelle, 0, id);
  });
}

function bereichAnlegen(titel, marke) {
  const bestehende = new Set(daten.bereiche.map((b) => b.id));
  aendern(() => {
    daten.bereiche.push({ id: idAusName(titel, bestehende), titel, marke, links: [] });
    // Ein Bereich braucht mindestens einen Link (Schema): gleich die Zeile dafür.
    offen = { bi: daten.bereiche.length - 1, linkId: null, entwurf: null, fokus: true };
  });
}

// ---- Klicks, Tasten und Eingaben in der Liste ---------------------------------------

function klickInListe(e) {
  const knopf = e.target.closest("[data-aktion]");
  if (!knopf || knopf.disabled) return;
  const kiste = e.target.closest("[data-bereich]");
  const bi = kiste ? Number(kiste.dataset.bereich) : -1;
  const zeile = e.target.closest("[data-link]");
  const linkId = zeile ? zeile.dataset.link : null;
  switch (knopf.dataset.aktion) {
    case "link-oeffnen":
    case "link-aelteren":
      editorOeffnen(bi, linkId);
      break;
    case "link-hinzufuegen":
      editorOeffnen(bi, null);
      break;
    case "formular-abbrechen":
      editorSchliessen();
      break;
    case "link-loeschen":
      linkLoeschen(linkId);
      break;
    case "fav-umschalten":
      favoritUmschalten(linkId);
      break;
    case "link-nach-oben":
      linkSchritt(linkId, -1);
      break;
    case "link-nach-unten":
      linkSchritt(linkId, 1);
      break;
    case "bereich-nach-oben":
      bereichSchritt(bi, -1);
      break;
    case "bereich-nach-unten":
      bereichSchritt(bi, 1);
      break;
    case "bereich-loeschen": {
      const benannt = daten.bereiche[bi].titel;
      aendern(() => daten.bereiche.splice(bi, 1));
      hinweisZeigen(`Bereich „${benannt}“ gelöscht.`, true);
      break;
    }
    default:
      break;
  }
}

function tasteInListe(e) {
  const griff = e.target.closest(".griff");
  if (griff && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    const richtung = e.key === "ArrowUp" ? -1 : 1;
    const zeile = griff.closest("[data-link]");
    if (zeile) linkSchritt(zeile.dataset.link, richtung);
    else bereichSchritt(Number(griff.closest("[data-bereich]").dataset.bereich), richtung);
    return;
  }
  if (e.target.classList.contains("bereich-titel")) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    } else if (e.key === "Escape") {
      const bi = Number(e.target.closest("[data-bereich]").dataset.bereich);
      e.target.value = daten.bereiche[bi].titel;
      e.target.blur();
    }
  }
}

// Beide ohne neu zu zeichnen: Der Klick oder Tab, der das Feld gerade verlässt,
// träfe sonst einen Knopf, den es nicht mehr gibt.
function aenderungInListe(e) {
  const kiste = e.target.closest("[data-bereich]");
  if (!kiste) return;
  const bi = Number(kiste.dataset.bereich);
  if (e.target.classList.contains("bereich-titel")) {
    const titel = e.target.value.trim();
    const fehler = pruefen_titel(titel);
    if (fehler) {
      e.target.value = daten.bereiche[bi].titel;
      hinweisZeigen(fehler);
      speicherStatus();
      return;
    }
    e.target.value = titel;
    aendern(() => {
      daten.bereiche[bi].titel = titel;
    }, false);
    bereichBeschriften(kiste, bi);
  } else if (e.target.classList.contains("marke")) {
    const marke = e.target.value;
    aendern(() => {
      daten.bereiche[bi].marke = marke;
    }, false);
    kiste.dataset.marke = marke;
  }
}

// ---- Ziehen zum Sortieren (L-06, L-08) -----------------------------------------------

function zielMarkenEntfernen() {
  document.querySelectorAll(".ziel-vor, .ziel-nach").forEach((n) => {
    n.classList.remove("ziel-vor", "ziel-nach");
  });
}

function ziehenBeginnen(e) {
  const zeile = e.target.closest ? e.target.closest(".link-zeile[draggable='true']") : null;
  const kiste = e.target.closest ? e.target.closest(".bereich[draggable='true']") : null;
  const favorit = e.target.closest ? e.target.closest(".eintrag[data-fav]") : null;
  if (kiste && e.target === kiste) gezogen = { art: "bereich", id: Number(kiste.dataset.bereich) };
  else if (zeile) gezogen = { art: "link", id: zeile.dataset.link };
  else if (favorit) gezogen = { art: "favorit", id: favorit.dataset.fav };
  else return;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(gezogen.id));
  e.target.classList.add("gezogen");
}

function zielFinden(e) {
  if (!gezogen || !e.target.closest) return null;
  if (gezogen.art === "favorit") return e.target.closest(".eintrag[data-fav]");
  if (gezogen.art === "bereich") return e.target.closest(".bereich");
  return e.target.closest(".link-zeile[data-link], .link-neu, .bereich-kopf");
}

function ziehenUeber(e) {
  const ziel = zielFinden(e);
  zielMarkenEntfernen();
  if (!ziel) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const r = ziel.getBoundingClientRect();
  const danach = gezogen.art === "favorit"
    ? e.clientX > r.left + r.width / 2
    : e.clientY > r.top + r.height / 2;
  const nurEineSeite = ziel.classList.contains("link-neu") || ziel.classList.contains("bereich-kopf");
  if (nurEineSeite) ziel.classList.add(ziel.classList.contains("link-neu") ? "ziel-vor" : "ziel-nach");
  else ziel.classList.add(danach ? "ziel-nach" : "ziel-vor");
}

function ziehenAblegen(e) {
  const ziel = zielFinden(e);
  if (!ziel) return;
  e.preventDefault();
  const danach = ziel.classList.contains("ziel-nach");
  const was = gezogen;
  gezogen = null;
  zielMarkenEntfernen();
  if (was.art === "favorit") {
    const liste = daten.standardFavoriten;
    let stelle = liste.indexOf(ziel.dataset.fav) + (danach ? 1 : 0);
    if (liste.indexOf(was.id) < stelle) stelle -= 1;
    if (ziel.dataset.fav !== was.id) favoritSetzen(was.id, stelle);
  } else if (was.art === "bereich") {
    const zielBi = Number(ziel.dataset.bereich);
    if (zielBi === was.id) return;
    let stelle = zielBi + (danach ? 1 : 0);
    if (was.id < stelle) stelle -= 1;
    aendern(() => {
      const [teil] = daten.bereiche.splice(was.id, 1);
      daten.bereiche.splice(stelle, 0, teil);
    });
  } else {
    const zielBi = Number(ziel.closest("[data-bereich]").dataset.bereich);
    if (ziel.dataset.link === was.id) return;
    let stelle = 0;
    if (ziel.classList.contains("link-neu")) stelle = daten.bereiche[zielBi].links.length;
    else if (ziel.dataset.link) stelle = linkFinden(ziel.dataset.link).li + (danach ? 1 : 0);
    linkVerschieben(was.id, zielBi, stelle);
  }
}

function ziehenEnde(e) {
  gezogen = null;
  zielMarkenEntfernen();
  if (e.target.classList) e.target.classList.remove("gezogen");
  document.querySelectorAll(".bereich[draggable='true']").forEach((k) => {
    k.draggable = false;
  });
}

// Einen Bereich nur am Griff ziehen, sonst ließe sich im Titel kein Text markieren.
function griffGedrueckt(e) {
  const griff = e.target.closest(".bereich-kopf .griff");
  if (griff) griff.closest(".bereich").draggable = true;
}

// ---- Standardfavoriten (L-08) ---------------------------------------------------------

function zeichneFavoriten() {
  const liste = $("#favoriten");
  liste.replaceChildren();
  const favoriten = daten.standardFavoriten || [];
  $("#favoriten-zahl").textContent = `${favoriten.length} von ${FAVORITEN_HOECHSTENS}`;
  favoriten.forEach((id) => {
    const ziel = linkNachId(id);
    if (!ziel) return;
    const eintrag = el("li", "eintrag");
    eintrag.dataset.fav = id;
    eintrag.draggable = true;
    eintrag.tabIndex = 0;
    eintrag.setAttribute("aria-label", `${ziel.name}: mit Pfeiltasten oder Ziehen verschieben`);
    eintrag.appendChild(el("span", "name", ziel.name));
    eintrag.appendChild(symbolKnopf("links", "fav-nach-vorn", `„${ziel.name}“ eine Stelle nach vorn`, "nur-beruehrung"));
    eintrag.appendChild(symbolKnopf("kreuz", "fav-loeschen", `„${ziel.name}“ aus den Standardfavoriten entfernen`));
    liste.appendChild(eintrag);
  });
  if (!favoriten.length) {
    liste.appendChild(el("li", "hinweis", "Noch keine. Mit dem Stern in einer Zeile wählen."));
  }
}

function klickInFavoriten(e) {
  const knopf = e.target.closest("[data-aktion]");
  if (!knopf) return;
  const id = e.target.closest("[data-fav]").dataset.fav;
  if (knopf.dataset.aktion === "fav-nach-vorn") {
    const stelle = daten.standardFavoriten.indexOf(id);
    if (stelle > 0) favoritSetzen(id, stelle - 1);
    return;
  }
  aendern(() => {
    daten.standardFavoriten = daten.standardFavoriten.filter((f) => f !== id);
  });
}

function tasteInFavoriten(e) {
  const eintrag = e.target.closest(".eintrag[data-fav]");
  if (!eintrag || e.target !== eintrag) return;
  const schritt = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
  if (!schritt) return;
  e.preventDefault();
  const id = eintrag.dataset.fav;
  const stelle = daten.standardFavoriten.indexOf(id) + schritt;
  if (stelle < 0 || stelle >= daten.standardFavoriten.length) return;
  fokusDanach = `#favoriten [data-fav="${id}"]`;
  favoritSetzen(id, stelle);
  ansagen(`Stelle ${stelle + 1} von ${daten.standardFavoriten.length}`);
}

// ---- Hilfe-Link (L-09) ------------------------------------------------------------------

function zeichneHilfe() {
  const hilfe = daten.hilfe || {};
  const name = $("#hilfe-name");
  const adresse = $("#hilfe-adresse");
  // Eine abgelehnte Eingabe bleibt stehen, bis sie berichtigt ist.
  if (hilfeFehlerhaft()) return;
  if (document.activeElement !== name) name.value = hilfe.name || "";
  if (document.activeElement !== adresse) adresse.value = hilfe.url || "";
}

function hilfeAendern() {
  const name = $("#hilfe-name").value.trim();
  const url = $("#hilfe-adresse").value.trim();
  const fehlerName = pruefen_name(name);
  const fehlerUrl = pruefen_adresse(url);
  meldung($("#hilfe-name-meldung"), fehlerName, "fehler");
  meldung($("#hilfe-adresse-meldung"), fehlerUrl, "fehler");
  if (fehlerName || fehlerUrl) {
    speicherStatus();
    return;
  }
  meldung($("#speichern-meldung"), "");
  aendern(() => {
    daten.hilfe = { name, url };
  });
}

// ---- Verlauf: Protokoll (L-12) und Sicherungen (L-15) ---------------------------------------

function anzahl(links, bereiche) {
  const l = links || 0;
  const b = bereiche || 0;
  const teile = [l === 1 ? "1 Link" : `${l} Links`];
  if (b) teile.push(b === 1 ? "1 Bereich" : `${b} Bereiche`);
  return teile.join(", ");
}

// 2026-10-30T12:34:56 (Protokoll) oder 2026-10-30-123456 (Sicherung)
const ZEIT_MUSTER = /(\d{4})-(\d{2})-(\d{2})[T-](\d{2}):?(\d{2})/;

function zeitKurz(wert) {
  const m = String(wert || "").match(ZEIT_MUSTER);
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : String(wert || "");
}

function zeitOhneJahr(wert) {
  const m = String(wert || "").match(ZEIT_MUSTER);
  return m ? `${m[3]}.${m[2]}. ${m[4]}:${m[5]}` : String(wert || "");
}

function zeichneProtokoll(eintraege) {
  const tbody = $("#protokoll-zeilen");
  tbody.replaceChildren();
  eintraege.forEach((e) => {
    const tr = document.createElement("tr");
    const zellen = [
      ["Zeit", zeitKurz(e.zeit)],
      ["Name", e.name],
      ["Neu", anzahl(e.links_neu, e.bereiche_neu)],
      ["Geändert", anzahl(e.links_geaendert, e.bereiche_geaendert)],
      ["Gelöscht", anzahl(e.links_geloesch, e.bereiche_geloesch)],
      ["Sicherung", e.zurueckgeholt
        ? `Stand von ${zeitOhneJahr(e.zurueckgeholt)} zurückgeholt`
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

function zeichneSicherungen(liste) {
  const wurzel = $("#sicherungen");
  wurzel.replaceChildren();
  liste.forEach((s) => {
    const zeile = el("li", "eintrag");
    zeile.appendChild(el("span", "zeit", zeitKurz(s.zeit)));
    zeile.appendChild(el("span", "name-person", s.name_person || "–"));
    const knopf = el("button", "btn", "Diesen Stand zurückholen");
    knopf.type = "button";
    knopf.addEventListener("click", () => standZurueckholen(s));
    zeile.appendChild(knopf);
    wurzel.appendChild(zeile);
  });
  if (!liste.length) {
    wurzel.appendChild(el("li", "eintrag", "Noch keine Sicherungen."));
  }
}

function nachfragen(text, jaText = "Zurückholen") {
  const fenster = $("#nachfrage");
  $("#nachfrage-text").textContent = text;
  $("#nachfrage-ja").textContent = jaText;
  fenster.showModal();
  $("#nachfrage-nein").focus();
  return new Promise((erledigt) => {
    const ende = (antwort) => {
      $("#nachfrage-ja").removeEventListener("click", ja);
      $("#nachfrage-nein").removeEventListener("click", nein);
      fenster.removeEventListener("cancel", nein);
      if (fenster.open) fenster.close();
      erledigt(antwort);
    };
    const ja = () => ende(true);
    const nein = () => ende(false);
    $("#nachfrage-ja").addEventListener("click", ja);
    $("#nachfrage-nein").addEventListener("click", nein);
    fenster.addEventListener("cancel", nein);
  });
}

function nameLesen() {
  const name = $("#name").value.trim();
  if (name.length < 1 || name.length > 40) {
    meldung($("#speichern-meldung"), "„Ihr Name“ braucht 1 bis 40 Zeichen.", "fehler");
    $("#name").focus();
    return "";
  }
  return name;
}

async function standZurueckholen(s) {
  const name = nameLesen();
  if (!name) return;
  const frage = `Stand von ${zeitOhneJahr(s.zeit)} zurückholen? Nicht gespeicherte Änderungen gehen verloren.`;
  if (!(await nachfragen(frage))) return;
  meldung($("#speichern-meldung"), "Zurückholen läuft …");
  try {
    await api("zurueckholen", {
      methode: "POST",
      koerper: { sicherung: s.name, version, name },
    });
    await laden();
    meldung($("#speichern-meldung"), "Stand zurückgeholt und gespeichert.", "ok");
  } catch (fehler) {
    fehlerZeigen(fehler);
  }
}

// ---- Speichern (L-10, L-11) ----------------------------------------------------------------

function fehlerZeigen(fehler) {
  if (fehler.status === 401) {
    sitzungAbgelaufen();
    return;
  }
  const ziel = $("#speichern-meldung");
  meldung(ziel, fehler.message, "fehler");
  if (fehler.status === 409) {
    const knopf = el("button", "btn-text", "Neu laden");
    knopf.type = "button";
    knopf.addEventListener("click", async () => {
      await laden();
      meldung($("#speichern-meldung"), "Neu geladen.", "ok");
    });
    ziel.appendChild(knopf);
  }
}

async function speichern() {
  feldUebernehmen();
  if (hilfeFehlerhaft()) {
    reiterWaehlen("hilfe");
    ($("#hilfe-name-meldung").textContent ? $("#hilfe-name") : $("#hilfe-adresse")).focus();
    meldung($("#speichern-meldung"), "Der Hilfe-Link stimmt noch nicht.", "fehler");
    return;
  }
  if (!editorAnwenden()) return;
  speicherStatus();
  if (!istGeaendert()) return;
  const name = nameLesen();
  if (!name) return;
  const leer = daten.bereiche.find((b) => !(b.links || []).length);
  if (leer) {
    meldung($("#speichern-meldung"), `Der Bereich „${leer.titel}“ braucht mindestens einen Link.`, "fehler");
    return;
  }
  meldung($("#speichern-meldung"), "Speichern läuft …");
  $("#speichern").disabled = true;
  try {
    const antwort = await api("speichern", {
      methode: "POST",
      koerper: { daten, version, name },
    });
    version = antwort.version;
    daten.stand = antwort.stand;
    grundstand = JSON.stringify(daten);
    schritte.length = 0;
    speicherSchreiben(localStorage, NAME_SCHLUESSEL, name);
    speicherStatus();
    meldung($("#speichern-meldung"), `Gespeichert (Stand: ${antwort.stand}).`, "ok");
    $("#hinweis").hidden = true;
    await verlaufLaden();
  } catch (fehler) {
    speicherStatus();
    fehlerZeigen(fehler);
  }
}

// ---- Reiter ---------------------------------------------------------------------------------

function reiterWaehlen(name, fokus = false) {
  REITER.forEach((r) => {
    const aktiv = r === name;
    const knopf = $("#reiter-" + r);
    knopf.setAttribute("aria-selected", String(aktiv));
    knopf.tabIndex = aktiv ? 0 : -1;
    $("#tafel-" + r).hidden = !aktiv;
    if (aktiv && fokus) knopf.focus();
  });
}

function tasteInReitern(e) {
  const schritt = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (!schritt) return;
  e.preventDefault();
  const jetzt = REITER.findIndex((r) => $("#reiter-" + r).getAttribute("aria-selected") === "true");
  reiterWaehlen(REITER[(jetzt + schritt + REITER.length) % REITER.length], true);
}

// ---- Verlassen -------------------------------------------------------------------------------

function beendenPruefen(e) {
  if (!istGeaendert() && !eingabeOffen() && !hilfeFehlerhaft()) return;
  e.preventDefault();
  e.returnValue = "";
}

function tastenkuerzel(e) {
  if (!(e.ctrlKey || e.metaKey) || $("#uebersicht").hidden) return;
  const taste = e.key.toLowerCase();
  if (taste === "s") {
    e.preventDefault();
    speichern();
  } else if (taste === "z" && !e.shiftKey && !e.target.matches("input, textarea")) {
    e.preventDefault();
    rueckgaengig();
  }
}

// ---- Bereich anlegen (L-07) --------------------------------------------------------------------

function bereichFormularOeffnen() {
  const form = $("#bereich-neu");
  form.hidden = false;
  $("#neu-titel").value = "";
  meldung($("#neu-titel-meldung"), "");
  form.scrollIntoView({ block: "nearest" });
  $("#neu-titel").focus();
}

function bereichFormularSchliessen() {
  $("#bereich-neu").hidden = true;
  $("#bereich-hinzufuegen").focus();
}

// ---- Init ----------------------------------------------------------------------------------------

function init() {
  // Name vorbelegen (L-10).
  const gespeicherterName = speicherLesen(localStorage, NAME_SCHLUESSEL);
  if (gespeicherterName) {
    $("#name").value = gespeicherterName;
  }

  $("#anmeldeformular").addEventListener("submit", (e) => {
    e.preventDefault();
    anmelden();
  });

  $("#speichern").addEventListener("click", speichern);
  $("#rueckgaengig").addEventListener("click", rueckgaengig);
  $("#hinweis-rueckgaengig").addEventListener("click", rueckgaengig);
  $("#abmelden").addEventListener("click", abmelden);
  document.addEventListener("keydown", tastenkuerzel);

  REITER.forEach((r) => {
    $("#reiter-" + r).addEventListener("click", () => reiterWaehlen(r));
    $("#reiter-" + r).addEventListener("keydown", tasteInReitern);
  });

  $("#filter").addEventListener("input", (e) => {
    suchtext = e.target.value.trim();
    zeichnen();
  });

  const liste = $("#bereiche");
  liste.addEventListener("click", klickInListe);
  liste.addEventListener("keydown", tasteInListe);
  liste.addEventListener("change", aenderungInListe);
  liste.addEventListener("input", speicherStatus);
  liste.addEventListener("mousedown", griffGedrueckt);

  const favoriten = $("#favoriten");
  favoriten.addEventListener("click", klickInFavoriten);
  favoriten.addEventListener("keydown", tasteInFavoriten);

  const tafel = $("#tafel-links");
  tafel.addEventListener("dragstart", ziehenBeginnen);
  tafel.addEventListener("dragover", ziehenUeber);
  tafel.addEventListener("drop", ziehenAblegen);
  tafel.addEventListener("dragend", ziehenEnde);

  $("#bereich-hinzufuegen").addEventListener("click", bereichFormularOeffnen);
  $("#neu-abbrechen").addEventListener("click", bereichFormularSchliessen);
  $("#bereich-neu").addEventListener("keydown", (e) => {
    if (e.key === "Escape") bereichFormularSchliessen();
  });
  $("#bereich-neu").addEventListener("submit", (e) => {
    e.preventDefault();
    const titel = $("#neu-titel").value.trim();
    const fehler = pruefen_titel(titel);
    meldung($("#neu-titel-meldung"), fehler, "fehler");
    if (fehler || !editorAnwenden()) return;
    $("#bereich-neu").hidden = true;
    bereichAnlegen(titel, $("#neu-marke").value);
  });

  $("#hilfeformular").addEventListener("submit", (e) => e.preventDefault());
  $("#hilfeformular").addEventListener("input", speicherStatus);
  $("#hilfe-name").addEventListener("change", hilfeAendern);
  $("#hilfe-adresse").addEventListener("change", hilfeAendern);

  // Verlassen der Seite (L-10).
  window.addEventListener("beforeunload", beendenPruefen);

  // Prüfen, ob bereits eine Sitzung besteht. Ohne den Token aus der Anmeldung
  // könnte die Seite nicht speichern (L-13); dann neu anmelden.
  (async () => {
    const csrf = speicherLesen(sessionStorage, CSRF_SCHLUESSEL);
    try {
      if (!csrf) throw new Error("Kein Token");
      sitzung = { csrf };
      await laden();
      ansichtZeigen();
    } catch {
      sitzung = null;
      $("#anmeldung").hidden = false;
      $("#uebersicht").hidden = true;
    }
  })();
}

document.addEventListener("DOMContentLoaded", init);
