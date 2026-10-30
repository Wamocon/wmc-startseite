// Admin-Ansicht zum Pflegen der Links (L-01 bis L-15).
// Kein Inline-Skript (N-02, B-03), keine fremden Server (L-13).

// ---- Zustand -----------------------------------------------------------------

let sitzung = null;          // {csrf} oder null
let version = 0;             // Versionsnummer der geladenen Liste
let daten = { Bereiche: [], Standardeinstellung: {} };
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
  for (const b of daten.Bereiche) {
    for (const l of (b.Links || [])) s.add(l.id);
  }
  return s;
}

function rendern() {
  const container = $("#bereiche");
  container.innerHTML = "";
  daten.Bereiche.forEach((bereich, bi) => {
    const el = document.createElement("div");
    el.className = "bereich";
    el.dataset.bereich = bi;
    el.innerHTML = bereichHtml(bereich, bi);
    container.appendChild(el);
    bindenBereich(el, bi);
  });
  rendernFavoriten();
  rendernHilfe();
  speicherStatus();
}

function bereichHtml(bereich, bi) {
  const marke = bereich.Marke || "";
  const linksHtml = (bereich.Links || []).map((link, li) => linkZeileHtml(bereich, link, bi, li)).join("");
  return `
    <div class="bereich-kopf">
      <div class="marke" aria-hidden="true">${escapeHtml(marke)}</div>
      <h3>${escapeHtml(bereich.Titel)}</h3>
      <div class="handlung">
        <button type="button" class="btn klein" data-aktion="bereich-nach-oben" ${bi === 0 ? "disabled" : ""}>Nach oben</button>
        <button type="button" class="btn klein" data-aktion="bereich-nach-unten" ${bi === daten.Bereiche.length - 1 ? "disabled" : ""}>Nach unten</button>
        <button type="button" class="btn klein" data-aktion="bereich-umbenennen">Umbenennen</button>
        <button type="button" class="btn klein" data-aktion="bereich-loeschen" ${(bereich.Links || []).length ? "disabled title=Der Bereich ist nicht leer." : ""}>Löschen</button>
        <button type="button" class="btn klein primär" data-aktion="link-hinzufuegen">Link hinzufügen</button>
      </div>
    </div>
    <div class="links">${linksHtml}</div>
    <div class="formular-container"></div>
  `;
}

function linkZeileHtml(bereich, link, bi, li) {
  const isStandard = (daten.Standardeinstellung?.Favoriten || []).some((f) => f.id === link.id);
  return `
    <div class="link-zeile" data-link="${escapeHtml(link.id)}">
      <div class="info">
        <div class="zeile-oben">
          <span class="name">${escapeHtml(link.Name)}</span>
          ${link.Kuerzel ? `<span class="kuerzel">${escapeHtml(link.Kuerzel)}</span>` : ""}
          ${isStandard ? `<span class="kuerzel standard">Standardfavorit</span>` : ""}
        </div>
        ${link.Beschreibung ? `<div class="beschreibung">${escapeHtml(link.Beschreibung)}</div>` : ""}
        <div class="adresse">${escapeHtml(link.Adresse)}</div>
      </div>
      <div class="handlung">
        <button type="button" class="btn klein" data-aktion="link-nach-oben" ${li === 0 ? "disabled" : ""}>Nach oben</button>
        <button type="button" class="btn klein" data-aktion="link-nach-unten" ${li === (bereich.Links || []).length - 1 ? "disabled" : ""}>Nach unten</button>
        <button type="button" class="btn klein" data-aktion="link-aelteren">Ändern</button>
        <button type="button" class="btn klein" data-aktion="link-loeschen">Löschen</button>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bindenBereich(el, bi) {
  el.querySelectorAll("[data-aktion]").forEach((btn) => {
    btn.addEventListener("click", () => aktion(btn.dataset.aktion, bi, btn));
  });
}

// ---- Aktionen ----------------------------------------------------------------

function aktion(name, bi, btn) {
  const bereich = daten.Bereiche[bi];
  const linkId = btn ? btn.closest("[data-link]")?.dataset.link : null;

  switch (name) {
    case "bereich-nach-oben":
      if (bi > 0) {
        const tmp = daten.Bereiche[bi];
        daten.Bereiche[bi] = daten.Bereiche[bi - 1];
        daten.Bereiche[bi - 1] = tmp;
        markierenUngespeichert();
        rendern();
      }
      break;
    case "bereich-nach-unten":
      if (bi < daten.Bereiche.length - 1) {
        const tmp = daten.Bereiche[bi];
        daten.Bereiche[bi] = daten.Bereiche[bi + 1];
        daten.Bereiche[bi + 1] = tmp;
        markierenUngespeichert();
        rendern();
      }
      break;
    case "bereich-umbenennen":
      umbenennenBereich(bi);
      break;
    case "bereich-loeschen":
      if ((bereich.Links || []).length) {
        meldung($("#speichern-meldung"), "Der Bereich ist nicht leer.", "fehler");
        return;
      }
      if (confirm(`„${bereich.Titel}“ wirklich löschen?`)) {
        daten.Bereiche.splice(bi, 1);
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
      const link = (bereich.Links || []).find((l) => l.id === linkId);
      if (!link) return;
      const isStandard = (daten.Standardeinstellung?.Favoriten || []).some((f) => f.id === link.id);
      const text = isStandard
        ? `„${link.Name}“ wirklich löschen? Er wird auch aus den Standardfavoriten entfernt.`
        : `„${link.Name}“ wirklich löschen?`;
      if (confirm(text)) {
        bereich.Links = (bereich.Links || []).filter((l) => l.id !== linkId);
        daten.Standardeinstellung.Favoriten = (daten.Standardeinstellung?.Favoriten || [])
          .filter((f) => f.id !== linkId);
        markierenUngespeichert();
        rendern();
      }
      break;
    }
    case "link-nach-oben": {
      const links = bereich.Links || [];
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
      const links = bereich.Links || [];
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
  const bereich = daten.Bereiche[bi];
  const neuerTitel = prompt("Neuer Titel:", bereich.Titel);
  if (neuerTitel === null) return;
  if (!neuerTitel.trim()) {
    meldung($("#speichern-meldung"), "Der Titel fehlt.", "fehler");
    return;
  }
  if (neuerTitel !== bereich.Titel) {
    bereich.Titel = neuerTitel;
    markierenUngespeichert();
    rendern();
  }
  const neueMarke = prompt("Neue Marke (ein Buchstabe):", bereich.Marke || "");
  if (neueMarke === null) return;
  if (neueMarke !== bereich.Marke) {
    bereich.Marke = neueMarke;
    markierenUngespeichert();
    rendern();
  }
}

function formularOeffnen(bi, linkId) {
  const bereich = daten.Bereiche[bi];
  const container = document.querySelector(`[data-bereich="${bi}"] .formular-container`);
  if (!container) return;
  const link = linkId ? (bereich.Links || []).find((l) => l.id === linkId) : null;

  container.innerHTML = `
    <form class="formular" novalidate>
      <div class="feld">
        <label for="f-bereich">Bereich</label>
        <select id="f-bereich" name="bereich">
          ${daten.Bereiche.map((b, i) => `<option value="${i}" ${i === bi ? "selected" : ""}>${escapeHtml(b.Titel)}</option>`).join("")}
        </select>
        <div class="meldung" id="f-bereich-meldung"></div>
      </div>
      <div class="feld">
        <label for="f-name">Name</label>
        <input id="f-name" name="name" type="text" maxlength="120" value="${link ? escapeHtml(link.Name) : ""}" required>
        <div class="meldung" id="f-name-meldung"></div>
      </div>
      <div class="feld">
        <label for="f-beschreibung">Beschreibung</label>
        <input id="f-beschreibung" name="beschreibung" type="text" maxlength="200" value="${link ? escapeHtml(link.Beschreibung || "") : ""}">
        <div class="meldung" id="f-beschreibung-meldung"></div>
      </div>
      <div class="feld">
        <label for="f-adresse">Adresse</label>
        <input id="f-adresse" name="adresse" type="text" maxlength="500" value="${link ? escapeHtml(link.Adresse) : ""}" required>
        <div class="meldung" id="f-adresse-meldung"></div>
      </div>
      <div class="feld">
        <label for="f-kuerzel">Kürzel (freiwillig)</label>
        <input id="f-kuerzel" name="kuerzel" type="text" maxlength="4" value="${link ? escapeHtml(link.Kuerzel || "") : ""}">
        <div class="meldung" id="f-kuerzel-meldung"></div>
      </div>
      <div class="handlung">
        <button type="button" class="btn" data-aktion="formular-abbrechen">Abbrechen</button>
        <button type="submit" class="btn primär">${link ? "Speichern" : "Anlegen"}</button>
      </div>
    </form>
  `;

  const form = container.querySelector("form");
  form.querySelector("[data-aktion=formular-abbrechen]").addEventListener("click", () => {
    container.innerHTML = "";
  });

  // V-02, V-06, V-08: beim Verlassen jedes Feldes prüfen.
  form.querySelector("#f-name").addEventListener("blur", (e) =>
    meldung(form.querySelector("#f-name-meldung"), pruefen_name(e.target.value), "fehler"));
  form.querySelector("#f-adresse").addEventListener("blur", (e) =>
    meldung(form.querySelector("#f-adresse-meldung"), pruefen_adresse(e.target.value), "fehler"));
  form.querySelector("#f-beschreibung").addEventListener("blur", (e) =>
    meldung(form.querySelector("#f-beschreibung-meldung"), pruefen_beschreibung(e.target.value), "fehler"));
  form.querySelector("#f-kuerzel").addEventListener("blur", (e) =>
    meldung(form.querySelector("#f-kuerzel-meldung"), pruefen_kuerzel(e.target.value), "fehler"));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fehler =
      pruefen_name(form.querySelector("#f-name").value) ||
      pruefen_adresse(form.querySelector("#f-adresse").value);
    if (fehler) {
      meldung(form.querySelector("#f-name-meldung"), fehler, "fehler");
      return;
    }
    speichernLink(bi, linkId, form);
  });
}

function speichernLink(bi, linkId, form) {
  const neuerBi = parseInt(form.querySelector("#f-bereich").value, 10);
  const wert = {
    Name: form.querySelector("#f-name").value.trim(),
    Beschreibung: form.querySelector("#f-beschreibung").value.trim(),
    Adresse: form.querySelector("#f-adresse").value.trim(),
    Kuerzel: form.querySelector("#f-kuerzel").value.trim(),
  };

  if (linkId) {
    const alt = daten.Bereiche[bi].Links.find((l) => l.id === linkId);
    if (!alt) return;
    if (neuerBi === bi) {
      alt.Name = wert.Name;
      alt.Beschreibung = wert.Beschreibung;
      alt.Adresse = wert.Adresse;
      alt.Kuerzel = wert.Kuerzel || undefined;
    } else {
      daten.Bereiche[bi].Links = daten.Bereiche[bi].Links.filter((l) => l.id !== linkId);
      daten.Bereiche[neuerBi].Links.push({
        id: alt.id,
        Name: wert.Name,
        Beschreibung: wert.Beschreibung,
        Adresse: wert.Adresse,
        Kuerzel: wert.Kuerzel || undefined,
      });
    }
  } else {
    const bestehende = alleLinkIds();
    const id = idAusName(wert.Name, bestehende);
    daten.Bereiche[neuerBi].Links.push({
      id,
      Name: wert.Name,
      Beschreibung: wert.Beschreibung,
      Adresse: wert.Adresse,
      Kuerzel: wert.Kuerzel || undefined,
    });
  }

  markierenUngespeichert();
  rendern();
}

// ---- Standardfavoriten ---------------------------------------------------------

function rendernFavoriten() {
  const container = $("#favoriten");
  if (!container) return;
  const favoriten = daten.Standardeinstellung?.Favoriten || [];
  const alleLinks = [];
  daten.Bereiche.forEach((b) => (b.Links || []).forEach((l) => alleLinks.push(l)));

  container.innerHTML = "";
  alleLinks.forEach((link) => {
    const ist = favoriten.findIndex((f) => f.id === link.id);
    const el = document.createElement("div");
    el.className = "eintrag";
    if (ist !== -1) {
      el.innerHTML = `
        <span class="rang">${ist + 1}.</span>
        <span class="name">${escapeHtml(link.Name)}</span>
        <div class="handlung">
          <button type="button" class="btn klein" data-aktion="fav-oben" ${ist === 0 ? "disabled" : ""}>Nach oben</button>
          <button type="button" class="btn klein" data-aktion="fav-unten" ${ist === favoriten.length - 1 ? "disabled" : ""}>Nach unten</button>
          <button type="button" class="btn klein" data-aktion="fav-loeschen">Entfernen</button>
        </div>
      `;
    } else {
      el.innerHTML = `
        <span class="rang">–</span>
        <span class="name">${escapeHtml(link.Name)}</span>
        <div class="handlung">
          <button type="button" class="btn klein" data-aktion="fav-hinzufuegen" ${favoriten.length >= 5 ? "disabled title=Höchstens 5." : ""}>Hinzufügen</button>
        </div>
      `;
    }
    el.querySelectorAll("[data-aktion]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const akt = btn.dataset.aktion;
        if (akt === "fav-hinzufuegen") {
          if (favoriten.length >= 5) return;
          favoriten.push({ id: link.id, name: link.Name });
        } else if (akt === "fav-loeschen") {
          daten.Standardeinstellung.Favoriten = favoriten.filter((f) => f.id !== link.id);
        } else if (akt === "fav-oben") {
          const idx = favoriten.findIndex((f) => f.id === link.id);
          if (idx > 0) {
            const t = favoriten[idx];
            favoriten[idx] = favoriten[idx - 1];
            favoriten[idx - 1] = t;
          }
        } else if (akt === "fav-unten") {
          const idx = favoriten.findIndex((f) => f.id === link.id);
          if (idx < favoriten.length - 1) {
            const t = favoriten[idx];
            favoriten[idx] = favoriten[idx + 1];
            favoriten[idx + 1] = t;
          }
        }
        daten.Standardeinstellung.Favoriten = favoriten;
        markierenUngespeichert();
        rendernFavoriten();
      });
    });
    container.appendChild(el);
  });
}

// ---- Hilfe-Link -----------------------------------------------------------------

function rendernHilfe() {
  const hilfe = daten.Standardeinstellung?.Hilfe || {};
  const hilfeName = hilfe.name || "Link fehlt?";
  const hilfeAdresse = hilfe.adresse || "";
  $("#hilfe-name").value = hilfeName;
  $("#hilfe-adresse").value = hilfeAdresse;
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
  const adresse = $("#hilfe-adresse").value.trim();
  const fehlerName = pruefen_name(name);
  const fehlerAdresse = pruefen_adresse(adresse);
  meldung($("#hilfe-name-meldung"), fehlerName, "fehler");
  meldung($("#hilfe-adresse-meldung"), fehlerAdresse, "fehler");
  if (fehlerName || fehlerAdresse) return;
  if (!daten.Standardeinstellung) daten.Standardeinstellung = {};
  daten.Standardeinstellung.Hilfe = { name, adresse };
  markierenUngespeichert();
}

// ---- Protokoll -------------------------------------------------------------------

function rendernProtokoll(eintraege) {
  const tbody = $("#protokoll-zeilen");
  if (!tbody) return;
  tbody.innerHTML = "";
  eintraege.forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="zeit">${escapeHtml(zeitKurz(e.zeit))}</td>
      <td>${escapeHtml(e.name)}</td>
      <td>${e.links_neu ?? 0}</td>
      <td>${e.links_geaendert ?? 0}</td>
      <td>${e.links_geloesch ?? 0}</td>
      <td>${e.zurueckgeholt ? "Stand zurückgeholt" : escapeHtml(e.sicherung || "")}</td>
    `;
    tbody.appendChild(tr);
  });
  if (!eintraege.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="leer">Noch keine Einträge.</td>`;
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
  container.innerHTML = "";
  liste.forEach((s) => {
    const el = document.createElement("div");
    el.className = "eintrag";
    el.innerHTML = `
      <span class="zeit">${escapeHtml(zeitKurz(s.zeit))}</span>
      <span class="name-person">${escapeHtml(s.name_person || "–")}</span>
      <div class="handlung">
        <button type="button" class="btn klein" data-namen="${escapeHtml(s.name)}">Diesen Stand zurückholen</button>
      </div>
    `;
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
    el.innerHTML = `<span class="name-person">Noch keine Sicherungen.</span>`;
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
