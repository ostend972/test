# Installation de la tâche de nettoyage du proxy CalmWeb
# Exécuter en tant qu'administrateur

$TaskName = "CalmWeb Proxy Cleanup"
$ScriptPath = Join-Path $PSScriptRoot "cleanup-proxy.js"
$NodePath = (Get-Command node).Source

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Installation de la tâche de nettoyage CalmWeb" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Vérifier les privilèges administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "✗ Ce script nécessite des privilèges administrateur" -ForegroundColor Red
    Write-Host "  Clic droit > Exécuter en tant qu'administrateur" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

# Supprimer la tâche existante si elle existe
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "⚠ Tâche existante trouvée - Suppression..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "✓ Tâche existante supprimée" -ForegroundColor Green
}

# Créer l'action (exécuter le script Node.js)
$Action = New-ScheduledTaskAction -Execute $NodePath -Argument "`"$ScriptPath`""

# Créer le déclencheur (au démarrage du système)
$Trigger = New-ScheduledTaskTrigger -AtStartup

# Délai de 10 secondes après le démarrage
$Trigger.Delay = "PT10S"

# Paramètres de la tâche
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

# Principal (SYSTEM avec privilèges élevés)
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Créer la tâche
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -Description "Nettoie le proxy CalmWeb au démarrage si l'application n'est pas active" `
        -ErrorAction Stop | Out-Null

    Write-Host ""
    Write-Host "✓ Tâche planifiée créée avec succès !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Nom de la tâche   : $TaskName" -ForegroundColor Cyan
    Write-Host "Déclencheur       : Au démarrage du système (délai 10s)" -ForegroundColor Cyan
    Write-Host "Script            : $ScriptPath" -ForegroundColor Cyan
    Write-Host "Privilèges        : SYSTEM (Élevés)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  La tâche nettoiera automatiquement le proxy" -ForegroundColor White
    Write-Host "  au démarrage si CalmWeb n'est pas lancé" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""

    # Tester la tâche
    Write-Host "Voulez-vous tester la tâche maintenant ? (O/N)" -ForegroundColor Yellow
    $test = Read-Host

    if ($test -eq "O" -or $test -eq "o") {
        Write-Host ""
        Write-Host "Exécution de la tâche..." -ForegroundColor Cyan
        Start-ScheduledTask -TaskName $TaskName
        Start-Sleep -Seconds 3

        # Afficher le log
        $logPath = Join-Path $env:APPDATA "calmweb\cleanup-proxy.log"
        if (Test-Path $logPath) {
            Write-Host ""
            Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
            Write-Host "  LOG DE LA TÂCHE" -ForegroundColor White
            Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
            Get-Content $logPath -Tail 20
        }
    }

    Write-Host ""
    Write-Host "✓ Installation terminée" -ForegroundColor Green
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "✗ Erreur lors de la création de la tâche" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

pause
