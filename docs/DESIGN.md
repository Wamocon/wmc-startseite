# Gestaltung: Entwurf D

Grundlage ist das WAMOCON-CI: Weiß trägt die Fläche, ein warmes Schwarz den Text, Rot die Aufmerksamkeit. Kein zweiter Markenton, keine Verläufe, keine Schatten, keine Animationen. Die Screenshots in `docs/design/` zeigen das Ziel; dieses Dokument beschreibt dasselbe in Zahlen, damit es sich auch ohne Bilder umsetzen lässt.

## Farben

| Rolle | Wert | Verwendung |
|---|---|---|
| Fläche | `#FFFFFF` | Seite, Karten, Kacheln, Suchfeld |
| Text | `#140B0B` | Fließtext, Überschriften, Linknamen |
| Sekundärtext | `#5F3E3E` | Beschreibungen, Infozeile, Fuß, Etiketten, Hinweise |
| Signalrot | `#F40E0E` | nur die 4-px-Linie unter dem Kopf |
| Rot für Text | `#B90808` | Abschnittsüberschriften, Links, „Bearbeiten“, aktiver Stern, Fokusrahmen |
| Rot dunkel | `#7B0606` | Link beim Überfahren, Fehlerzustand |
| Linie | `#D2C7C7` | Rahmen von Karten und Kacheln, Trennstrich im Kopf, Linie über dem Fuß |
| Linie Bedienelement | `#956D6D` | Rahmen des Suchfelds, gestrichelter Rahmen „Hinzufügen“ |
| Fläche grau | `#F3F2F2` | Kürzelfeld, Trennlinien zwischen Linkzeilen |
| Symbol | `#7A5555` | Lupe, inaktiver Stern, Platzhaltertext |
| Academy-Fläche | `#FEEBEB` | Academy-Karte, Kürzelfeld von Academy-Links in der Favoritenleiste |
| Academy-Rahmen | `#FBAFAF` | Rahmen der Academy-Karte und ihres Etiketts |
| Academy-Trennlinie | `#FDD7D7` | Trennlinien zwischen Zeilen der Academy-Karte |

`#F40E0E` ist nie Textfarbe.

## Schrift

Inter, selbst gehostet: `assets/fonts/inter-latin-{400,500,600,700,800}-normal.woff2`, `font-display: swap`, Ersatz `"Helvetica Neue", Arial, sans-serif`. Grundschrift 16 px, Zeilenhöhe 24 px.

| Element | Größe / Zeilenhöhe | Gewicht | Sonstiges |
|---|---|---|---|
| Begrüßung `h1` | 36 / 40 px | 800 | Laufweite −0,035em, zentriert |
| Abschnittsüberschrift `h2` | 12 / 16 px | 800 | Versalien per CSS, Laufweite 0,12em, `#B90808` |
| Kartenüberschrift `h3` | 18 / 24 px | 700 | Laufweite −0,02em |
| Linkname | 15 / 20 px | 600 | |
| Beschreibung | 13 / 18 px | 400 | `#5F3E3E` |
| Kachelname | 13 / 16 px | 600 | zentriert |
| Etikett | 12 / 16 px | 700 | Laufweite 0,06em |
| Infozeile, Hinweise | 14 / 21 px | 400 | `#5F3E3E` |
| Suchfeld | 18 px | 400 | |
| Fuß | 13 / 20 px | 400 | `#5F3E3E` |

## Abstände und Formen

Raster in 4er-Schritten. Radien: 4 px für kleine Flächen (Kürzel in Zeilen, Buttons), 8 px für Karten, Kacheln und Suchfeld, 999 px nur für Etiketten. Rahmen 1 px.

## Aufbau Desktop (1280 px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [WMC-Logo]  │  [WMA-Logo]                                            │  Kopf, Innenabstand 16 / 24 px
╞══════════════════════════════════════════════════════════════════════╡  4 px #F40E0E
│                                                                      │
│                          Guten Morgen                                │  h1, 56 px Abstand oben
│        ┌────────────────────────────────────────────────────┐        │
│        │ ⌕  Anwendung oder Link suchen                        │        │  Suchfeld 720 px breit, 56 px hoch
│        └────────────────────────────────────────────────────┘        │
│                                                                      │  40 px
│ MEINE FAVORITEN                                          Bearbeiten  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌┄┄┄┄┄┄┐                │  Kacheln 112 × 112, Abstand 16
│ │  OL  │ │  TE  │ │  JI  │ │  ZE  │ │  IT  │ ┊  +   ┊                │
│ │Outlook│ │Teams │ │ Jira │ │Zeit… │ │IT-T… │ ┊Hinzu-┊                │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └┄┄┄┄┄┄┘                │
│                                                                      │  40 px
│ ALLE LINKS                   Zentral gepflegt von der IT · Stand …   │
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐ │  Raster, Abstand 24
│ │Kommunikation WMC·WMA│ │Projekte & Wissen WMC│ │Personal & Org. … │ │
│ │──────────────────── │ │──────────────────── │ │───────────────── │ │
│ │[OL] Outlook       ☆ │ │[JI] Jira          ★ │ │[ZE] Zeiterfas. ★ │ │
│ │     E-Mail und Kal. │ │     Aufgaben und T. │ │     Arbeitszeit… │ │
│ │──────────────────── │ │──────────────────── │ │───────────────── │ │
│ │ …                   │ │ …                   │ │ …                │ │
│ └─────────────────────┘ └─────────────────────┘ └──────────────────┘ │
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐ │
│ │IT & Support         │ │WAMOCON Academy  WMA │ │Websites          │ │  Academy-Karte rosa
│ └─────────────────────┘ └─────────────────────┘ └──────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤  1 px #D2C7C7
│ Links gepflegt von der IT. Ihre …       Link fehlt oder ist veraltet? IT-Ticket erstellen │
└──────────────────────────────────────────────────────────────────────┘
```

## Bausteine

**Seite.** Hintergrund `#FFFFFF`. Kopf, Hauptteil und Fuß haben je einen Innenbereich von höchstens 1200 px Breite, mittig, mit 24 px Rand links und rechts (unter 600 px: 16 px).

**Kopf.** Logos nebeneinander, 24 px Abstand, dazwischen ein Strich 1 × 40 px `#D2C7C7`. WMC-Logo 48 px hoch, WMA-Logo 45 px hoch, Breite automatisch, senkrecht mittig. Unterkante 4 px `#F40E0E`.

**Hauptteil.** Innenabstand 56 px oben, 48 px unten. Zwischen Begrüßung mit Suche, Favoriten und „Alle Links“ je 40 px.

**Begrüßung und Suche.** Block höchstens 720 px breit, mittig, 20 px zwischen `h1` und Suchfeld. Suchfeld 100 % breit, 56 px hoch, Rahmen 1 px `#956D6D`, Radius 8 px, Innenabstand links 52 px, rechts 18 px, Schrift 18 px. Lupe 22 px, 18 px vom linken Rand, senkrecht mittig, `#7A5555`, nicht klickbar.

**Abschnittskopf.** Zeile mit `h2` links und Zusatz rechts (Button „Bearbeiten“ bzw. Infozeile), umbrechend, 12 px bzw. 16 px Abstand zum Inhalt darunter.

**Button „Bearbeiten“/„Fertig“.** Ohne Rahmen und Fläche, 44 px hoch, Innenabstand 0 12 px, Radius 4 px, Text 14 / 20 px, 600, `#B90808`.

**Favoritenkachel.** 112 × 112 px, Rahmen 1 px `#D2C7C7`, Radius 8 px, Inhalt senkrecht und waagerecht mittig, 10 px Abstand. Oben das Kürzelfeld 44 × 44 px, Radius 8 px, Schrift 14 px, 700. Darunter der Name, höchstens zwei Zeilen. Kacheln umbrechen mit 16 px Abstand.

**Kürzelfeld-Farben.** Normal: Fläche `#F3F2F2`, Schrift `#5F3E3E`. Links aus Bereichen mit `marke` `wma`: in der Favoritenleiste Fläche `#FEEBEB`, Schrift `#B90808`; in der Academy-Karte Fläche `#FFFFFF`, Schrift `#B90808`.

**Kachel „Hinzufügen“.** Wie eine Favoritenkachel, aber Rahmen 1 px gestrichelt `#956D6D`, mit Plus-Symbol 22 px und Text „Hinzufügen“, beides `#5F3E3E`.

**Entfernen im Bearbeiten-Modus.** Klickfläche 44 × 44 px, ihr Mittelpunkt sitzt auf der oberen rechten Ecke der Kachel (oben und rechts je −14 px). Sichtbar ist ein Kreis 22 px `#140B0B` mit weißem Kreuz 12 px.

**Karten unter „Alle Links“.** Raster `repeat(auto-fill, minmax(min(100%, 320px), 1fr))`, Abstand 24 px; bei 1280 px drei Spalten. Karte: Innenabstand 20 px oben und seitlich, 12 px unten, Rahmen 1 px `#D2C7C7`, Radius 8 px. Kopfzeile mit `h3` links und Etikett rechts, 8 px Abstand nach unten. Etikett: Rahmen 1 px `#D2C7C7`, Radius 999 px, Innenabstand 2 × 8 px, Schrift 12 px, 700, `#5F3E3E`.

**Academy-Karte** (`marke` `wma`). Fläche `#FEEBEB`, Rahmen `#FBAFAF`, `h3` und Etikett in `#B90808`, Etikettrahmen `#FBAFAF`, Zeilentrenner `#FDD7D7`.

**Linkzeile.** Waagerecht, 12 px Abstand, oben eine Linie 1 px `#F3F2F2`. Kürzelfeld 36 × 36 px, Radius 4 px, Schrift 12 px, 700. Dann der Link (Name über Beschreibung, 6 px Innenabstand oben und unten, nicht unterstrichen, beim Überfahren Name unterstrichen), füllt die Breite. Rechts der Stern-Button 44 × 44 px ohne Rahmen und Fläche.

**Stern.** 20 px. Nicht ausgewählt: Kontur `#7A5555`, keine Füllung. Ausgewählt: Kontur und Füllung `#B90808`.

**Infozeile, Hinweise, „Kein Treffer“.** 14 / 21 px `#5F3E3E`; „Kein Treffer“ 15 / 22 px mit 24 px Abstand oben und unten. Links darin `#B90808`.

**Fehlerzustand.** Kasten mit Rahmen 1 px `#7B0606`, Radius 8 px, Innenabstand 16 px. Links ein Warnsymbol 20 px in `#7B0606`, daneben der Text in `#140B0B`.

**Fuß.** Linie 1 px `#D2C7C7` oben, Innenabstand 16 / 24 px, zwei Textteile links und rechts, umbrechend, 13 / 20 px `#5F3E3E`, Link `#B90808`.

**Links allgemein.** `#B90808`, beim Überfahren `#7B0606`.

**Fokus.** Für alle Bedienelemente `outline: 2px solid #B90808; outline-offset: 2px` bei `:focus-visible`.

## Unter 600 px

Rand 16 px, Hauptteil 32 px Abstand oben, `h1` 28 / 34 px. Karten einspaltig (ergibt sich aus dem Raster). Kopf und Fuß dürfen umbrechen. Kein waagerechtes Scrollen bei 360 px.

## Symbole (SVG, Kontur, `stroke-linecap="round"`)

| Symbol | viewBox | Pfad |
|---|---|---|
| Lupe | `0 0 24 24` | `<circle cx="11" cy="11" r="6.5"/>` und `M16 16l4.5 4.5`, Strich 1,8 |
| Stern | `0 0 24 24` | `M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z`, Strich 1,8, `stroke-linejoin="round"` |
| Plus | `0 0 24 24` | `M12 5v14M5 12h14`, Strich 1,8 |
| Kreuz | `0 0 12 12` | `M3 3l6 6M9 3l-6 6`, Strich 1,8 |
| Warnung | `0 0 24 24` | `<circle cx="12" cy="12" r="9"/>` und `M12 7.5v5.5M12 16.5v.01`, Strich 2 |

Symbole sind für Screenreader verborgen (`aria-hidden="true"`); die Buttons tragen ihre Bezeichnung per `aria-label`.

## Screenshots

| Datei | Zeigt |
|---|---|
| `design/d-desktop.png` | Startzustand bei 1280 px, Standardfavoriten |
| `design/d-bearbeiten.png` | Bearbeiten-Modus mit Entfernen-Buttons und Hinweis |
| `design/d-suche.png` | Suche „it“: gefilterte Karten, Infozeile mit Trefferzahl |
| `design/d-kein-treffer.png` | Suche ohne Treffer |
| `design/d-leer.png` | Keine Favoriten gewählt |
| `design/d-fehler.png` | Linkliste nicht ladbar |
| `design/d-mobil.png` | 390 px Breite |
