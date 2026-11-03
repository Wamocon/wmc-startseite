# Startseite in Edge und Chrome einstellen

Schritt 4 des Umsetzungsplans: Nach dem Browserstart öffnet sich die Startseite, der Home-Button führt dorthin, und ein neuer Tab zeigt sie. Das Skript `scripts/browser-richtlinien.ps1` setzt dafür in Microsoft Edge und Google Chrome diese Richtlinien unter `HKLM\SOFTWARE\Policies`:

| Richtlinie | Wert |
|---|---|
| `HomepageLocation` | Adresse der Startseite |
| `HomepageIsNewTabPage` | 0 |
| `ShowHomeButton` | 1 |
| `RestoreOnStartup` | 4 (Liste von Seiten öffnen) |
| `RestoreOnStartupURLs\1` | Adresse der Startseite |
| `NewTabPageLocation` | Adresse der Startseite |

Andere Richtlinien unter diesen Schlüsseln bleiben, wie sie sind. Die Adresse steht nicht in diesem Repository; sie steht in der Kurzanleitung der IT.

## Ablauf

1. Auf einem Testgerät eine PowerShell als Administrator öffnen.
2. Stand ansehen, ohne etwas zu ändern: `.\scripts\browser-richtlinien.ps1 -Pruefen`
3. Anzeigen, was gesetzt würde: `.\scripts\browser-richtlinien.ps1 -Adresse http://SERVER:PORT/ -WhatIf`
4. Setzen: `.\scripts\browser-richtlinien.ps1 -Adresse http://SERVER:PORT/`
5. Edge und Chrome ganz schließen und neu starten, dann `edge://policy` und `chrome://policy` öffnen. Jede der sechs Richtlinien muss dort als angewandt erscheinen, nicht als ignoriert oder mit Fehler.
6. Erst wenn das auf dem Testgerät stimmt, auf die übrigen Geräte übertragen.
7. Zurücknehmen: `.\scripts\browser-richtlinien.ps1 -Entfernen`

## Grenze bei Edge

Edge wendet `HomepageLocation`, `RestoreOnStartupURLs` und `NewTabPageLocation` unter Windows nur auf Geräten an, die in einer Active-Directory-Domäne, in Entra ID oder in einer Geräteverwaltung (MDM) sind. So steht es in der Richtlinienreferenz von Microsoft (Microsoft Learn, „Microsoft Edge Browser Policy Documentation“, Seiten HomepageLocation, RestoreOnStartupURLs und NewTabPageLocation). Auf anderen Geräten stehen die Werte in der Registry, Edge zeigt sie in `edge://policy` aber nicht als angewandt. `-Pruefen` sagt, ob das Gerät in einer Domäne, in Entra ID oder in einer Geräteverwaltung ist.

Für Chrome sagt Google, dass die Registry auch auf Geräten ohne Domäne ein Weg ist (Chrome Enterprise Help, „Manage Chrome policies with Windows registry“). Ob Chrome die drei Adress-Richtlinien dort anwendet, zeigt `chrome://policy` auf dem Testgerät.

Ohne Domäne, Entra ID oder Geräteverwaltung stellt jede Person die Startseite in Edge selbst ein; wie, steht in der Kurzanleitung.
