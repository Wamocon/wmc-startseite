<#
.SYNOPSIS
    Setzt die Browser-Startseite WMC & WMA in Microsoft Edge und Google Chrome als
    Startseite, als Seite beim Start und als neue Tab-Seite (Umsetzungsplan, Schritt 4).

.DESCRIPTION
    Schreibt Richtlinien unter HKLM\SOFTWARE\Policies für beide Browser:
    HomepageLocation, HomepageIsNewTabPage = 0, ShowHomeButton = 1,
    RestoreOnStartup = 4 mit RestoreOnStartupURLs und NewTabPageLocation.
    Andere Richtlinien unter diesen Schlüsseln bleiben unberührt.

    Wichtig: Edge übernimmt HomepageLocation, RestoreOnStartupURLs und
    NewTabPageLocation unter Windows nur auf Geräten, die in einer Active-Directory-
    Domäne, in Entra ID oder in einer Geräteverwaltung (MDM) sind (Microsoft Learn,
    Richtlinienreferenz Edge). Auf anderen Geräten stehen die Werte in der Registry,
    werden aber nicht angewandt. Nach dem Setzen deshalb edge://policy und
    chrome://policy öffnen und nachsehen, ob die Werte als angewandt gelten.

    Ohne Parameter -Pruefen oder -WhatIf braucht das Skript Administratorrechte.

.PARAMETER Adresse
    Adresse der Startseite, etwa http://SERVER:PORT/ . Steht nicht im Repository,
    sondern in der Kurzanleitung der IT.

.PARAMETER Entfernen
    Nimmt die Werte dieses Skripts wieder heraus.

.PARAMETER Pruefen
    Zeigt, was gesetzt ist, und ob das Gerät in einer Domäne, in Entra ID oder in
    einer Geräteverwaltung ist. Ändert nichts.

.EXAMPLE
    .\browser-richtlinien.ps1 -Pruefen

.EXAMPLE
    .\browser-richtlinien.ps1 -Adresse http://SERVER:PORT/ -WhatIf

.EXAMPLE
    .\browser-richtlinien.ps1 -Adresse http://SERVER:PORT/

.EXAMPLE
    .\browser-richtlinien.ps1 -Entfernen
#>
[CmdletBinding(SupportsShouldProcess = $true, DefaultParameterSetName = 'Pruefen')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Setzen')]
    [ValidatePattern('^https?://\S+$')]
    [string]$Adresse,

    [Parameter(Mandatory = $true, ParameterSetName = 'Entfernen')]
    [switch]$Entfernen,

    [Parameter(ParameterSetName = 'Pruefen')]
    [switch]$Pruefen
)

$ErrorActionPreference = 'Stop'

$Browser = [ordered]@{
    'Edge'   = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'
    'Chrome' = 'HKLM:\SOFTWARE\Policies\Google\Chrome'
}
$Werte = @('HomepageLocation', 'HomepageIsNewTabPage', 'ShowHomeButton', 'RestoreOnStartup', 'NewTabPageLocation')
$Liste = 'RestoreOnStartupURLs'

function Test-Administrator {
    $ich = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    return $ich.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-Verwaltung {
    # dsregcmd sagt, ob Windows in einer Domäne, in Entra ID oder in einer Geräteverwaltung ist.
    $ausgabe = & dsregcmd.exe /status 2>$null
    $zeile = { param($name) ($ausgabe | Select-String -Pattern ("^\s*" + $name + "\s*:\s*(.*)$") | Select-Object -First 1) }
    $wert = { param($name) $z = & $zeile $name; if ($z) { $z.Matches[0].Groups[1].Value.Trim() } else { '' } }
    [pscustomobject]@{
        Domaene  = (& $wert 'DomainJoined') -eq 'YES'
        EntraID  = (& $wert 'AzureAdJoined') -eq 'YES'
        MDM      = [bool](& $wert 'MdmUrl')
    }
}

function Set-Wert($Pfad, $Name, $Inhalt, $Typ) {
    New-ItemProperty -Path $Pfad -Name $Name -Value $Inhalt -PropertyType $Typ -Force | Out-Null
}

function Show-Stand {
    foreach ($name in $Browser.Keys) {
        $pfad = $Browser[$name]
        Write-Output "== $name ($pfad)"
        if (-not (Test-Path $pfad)) { Write-Output '   nichts gesetzt'; continue }
        $eintrag = Get-ItemProperty -Path $pfad
        foreach ($w in $Werte) {
            $inhalt = $eintrag.$w
            if ($null -ne $inhalt) { Write-Output ("   {0} = {1}" -f $w, $inhalt) }
        }
        $listenpfad = Join-Path $pfad $Liste
        if (Test-Path $listenpfad) {
            $urls = Get-ItemProperty -Path $listenpfad
            $urls.PSObject.Properties | Where-Object { $_.Name -match '^\d+$' } |
                ForEach-Object { Write-Output ("   {0}\{1} = {2}" -f $Liste, $_.Name, $_.Value) }
        }
    }
    $v = Get-Verwaltung
    Write-Output ("== Gerät: Domäne {0}, Entra ID {1}, Geräteverwaltung {2}" -f $v.Domaene, $v.EntraID, $v.MDM)
    if (-not ($v.Domaene -or $v.EntraID -or $v.MDM)) {
        Write-Output '   Edge wendet Startseite, Seiten beim Start und neue Tab-Seite auf diesem Gerät nicht an (edge://policy prüfen).'
    }
}

if ($PSCmdlet.ParameterSetName -eq 'Pruefen') {
    Show-Stand
    return
}

if (-not $WhatIfPreference -and -not (Test-Administrator)) {
    throw 'Bitte in einer PowerShell als Administrator ausführen (oder mit -WhatIf nur anzeigen).'
}

foreach ($name in $Browser.Keys) {
    $pfad = $Browser[$name]
    $listenpfad = Join-Path $pfad $Liste
    if ($Entfernen) {
        if ($PSCmdlet.ShouldProcess($pfad, 'Werte der Browser-Startseite entfernen')) {
            if (Test-Path $pfad) {
                foreach ($w in $Werte) { Remove-ItemProperty -Path $pfad -Name $w -ErrorAction SilentlyContinue }
                if (Test-Path $listenpfad) { Remove-Item -Path $listenpfad -Recurse }
            }
        }
        continue
    }
    if ($PSCmdlet.ShouldProcess($pfad, "Startseite $Adresse setzen")) {
        # Den Schlüssel nur anlegen, wenn er fehlt: New-Item -Force würde vorhandene Werte löschen.
        if (-not (Test-Path $pfad)) { New-Item -Path $pfad | Out-Null }
        Set-Wert $pfad 'HomepageLocation' $Adresse 'String'
        Set-Wert $pfad 'HomepageIsNewTabPage' 0 'DWord'
        Set-Wert $pfad 'ShowHomeButton' 1 'DWord'
        Set-Wert $pfad 'RestoreOnStartup' 4 'DWord'
        Set-Wert $pfad 'NewTabPageLocation' $Adresse 'String'
        if (Test-Path $listenpfad) { Remove-Item -Path $listenpfad -Recurse }
        New-Item -Path $listenpfad | Out-Null
        Set-Wert $listenpfad '1' $Adresse 'String'
    }
}

if (-not $WhatIfPreference) {
    Show-Stand
    Write-Output 'Danach Edge und Chrome neu starten und edge://policy bzw. chrome://policy prüfen.'
}
