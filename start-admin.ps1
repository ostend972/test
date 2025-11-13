# Script PowerShell pour lancer CalmWeb en mode administrateur
# Usage: .\start-admin.ps1

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   CalmWeb - Démarrage en mode Administrateur" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Vérifier si déjà administrateur
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Demande des droits administrateur..." -ForegroundColor Yellow

    # Relancer le script en mode admin
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
    exit
}

Write-Host "✓ Droits administrateur accordés" -ForegroundColor Green
Write-Host ""

# Tuer les processus existants
Write-Host "Nettoyage des processus existants..." -ForegroundColor Yellow
taskkill /F /IM node.exe /T 2>$null
taskkill /F /IM electron.exe /T 2>$null
Start-Sleep -Seconds 2

# Changer le répertoire
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "Lancement de CalmWeb..." -ForegroundColor Green
Write-Host ""

# Lancer npm start
npm start
