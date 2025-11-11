; ═══════════════════════════════════════════════════════════════
; Script NSIS pour CalmWeb - Installation Simple
; ═══════════════════════════════════════════════════════════════

!include "LogicLib.nsh"

; Variables globales
Var KEEP_DATA
Var OLD_PROXY_ENABLE
Var OLD_PROXY_SERVER

; ═══════════════════════════════════════════════════════════════
; Initialisation
; ═══════════════════════════════════════════════════════════════

!macro customInit
  ; Valeurs par défaut
!macroend

; ═══════════════════════════════════════════════════════════════
; Lancement après installation
; ═══════════════════════════════════════════════════════════════

!macro customInstallMode
  SetOutPath $INSTDIR
!macroend

; Personnalisation de la page de fin
!macro customFinishPage
  Function StartApp
    ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\CalmWeb.exe" "open" "--minimized"
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_FINISHPAGE_RUN_TEXT "Lancer CalmWeb en mode minimisé"
  !insertmacro MUI_PAGE_FINISH
!macroend

; ═══════════════════════════════════════════════════════════════
; Installation
; ═══════════════════════════════════════════════════════════════

!macro customInstall
  DetailPrint "═══════════════════════════════════════"
  DetailPrint "INSTALLATION DE CALMWEB"
  DetailPrint "═══════════════════════════════════════"

  ; Fermer l'application si elle tourne
  DetailPrint "Arrêt de CalmWeb si en cours d'exécution..."
  nsExec::ExecToLog 'taskkill /F /IM CalmWeb.exe 2>nul'

  ; Créer le dossier de configuration
  DetailPrint "Création des répertoires de configuration..."
  CreateDirectory "$APPDATA\CalmWeb"

  ; Créer la configuration initiale (protection activée par défaut)
  FileOpen $0 "$APPDATA\CalmWeb\initial-config.json" w
  FileWrite $0 "{$\r$\n"
  FileWrite $0 '  "proxyPort": 8081,$\r$\n'
  FileWrite $0 '  "protectionEnabled": true$\r$\n'
  FileWrite $0 "}$\r$\n"
  FileClose $0

  ; Créer stats.json initial
  FileOpen $0 "$APPDATA\CalmWeb\stats.json" w
  FileWrite $0 "{$\r$\n"
  FileWrite $0 '  "totalBlocked": 0,$\r$\n'
  FileWrite $0 '  "totalAllowed": 0,$\r$\n'
  FileWrite $0 '  "blockedToday": 0,$\r$\n'
  FileWrite $0 '  "allowedToday": 0,$\r$\n'
  FileWrite $0 '  "yesterdayBlocked": 0,$\r$\n'
  FileWrite $0 '  "lastThreat": null,$\r$\n'
  FileWrite $0 '  "startOfDay": 0,$\r$\n'
  FileWrite $0 '  "lastSaved": ""$\r$\n'
  FileWrite $0 "}$\r$\n"
  FileClose $0

  ; Créer la tâche planifiée (démarrage automatique avec droits admin)
  DetailPrint "Configuration du démarrage automatique..."
  nsExec::ExecToStack 'schtasks /Create /TN "CalmWeb AutoStart" /TR "\"$INSTDIR\CalmWeb.exe\" --minimized" /SC ONLOGON /RL HIGHEST /F'
  Pop $0
  ${If} $0 == 0
    DetailPrint "✓ Démarrage automatique configuré"
  ${Else}
    DetailPrint "⚠ Impossible de configurer le démarrage automatique"
  ${EndIf}

  ; Créer la règle pare-feu
  DetailPrint "Configuration du pare-feu..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="CalmWeb Proxy" 2>nul'
  nsExec::ExecToStack 'netsh advfirewall firewall add rule name="CalmWeb Proxy" dir=in action=allow program="$INSTDIR\CalmWeb.exe" enable=yes profile=any'
  Pop $0
  ${If} $0 == 0
    DetailPrint "✓ Règle pare-feu créée"
  ${Else}
    DetailPrint "⚠ Impossible de créer la règle pare-feu"
  ${EndIf}

  DetailPrint "═══════════════════════════════════════"
  DetailPrint "INSTALLATION TERMINÉE"
  DetailPrint "═══════════════════════════════════════"

  ; Relancer automatiquement l'application après une mise à jour silencieuse
  ${If} ${Silent}
    DetailPrint "Relancement automatique de CalmWeb..."
    ; Utiliser CreateShortCut temporaire pour lancer avec droits admin
    Exec '"$INSTDIR\CalmWeb.exe" --minimized'
  ${EndIf}
!macroend

; ═══════════════════════════════════════════════════════════════
; Désinstallation
; ═══════════════════════════════════════════════════════════════

!macro customUnInstall
  DetailPrint "═══════════════════════════════════════"
  DetailPrint "DÉSINSTALLATION DE CALMWEB"
  DetailPrint "═══════════════════════════════════════"

  ; Toujours conserver les données lors d'une mise à jour automatique
  ; (Pour éviter le popup lors des mises à jour silencieuses)
  ${IfNot} ${Silent}
    ; Installation interactive - demander à l'utilisateur
    MessageBox MB_YESNO|MB_ICONQUESTION "Voulez-vous conserver vos listes blanches/noires et statistiques ?$\r$\n$\r$\n(Les données sont stockées dans %APPDATA%\CalmWeb)" IDYES keep_data
    StrCpy $KEEP_DATA "0"
    Goto continue_uninstall
    keep_data:
      StrCpy $KEEP_DATA "1"
  ${Else}
    ; Installation silencieuse (mise à jour automatique) - toujours conserver
    DetailPrint "Mise à jour automatique détectée - conservation des données"
    StrCpy $KEEP_DATA "1"
  ${EndIf}

  continue_uninstall:

  ; Fermer l'application
  DetailPrint "Arrêt de CalmWeb..."
  nsExec::ExecToLog 'taskkill /F /IM CalmWeb.exe 2>nul'

  ; Supprimer la tâche planifiée
  DetailPrint "Suppression du démarrage automatique..."
  nsExec::ExecToLog 'schtasks /Delete /TN "CalmWeb AutoStart" /F 2>nul'

  ; Supprimer la règle pare-feu
  DetailPrint "Suppression de la règle pare-feu..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="CalmWeb Proxy" 2>nul'

  ; Désactiver le proxy système si activé
  DetailPrint "Restauration des paramètres proxy..."
  nsExec::ExecToLog 'reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f'

  ; Supprimer les données utilisateur si demandé
  ${If} $KEEP_DATA == "0"
    DetailPrint "Suppression des données utilisateur..."
    RMDir /r "$APPDATA\CalmWeb"
  ${Else}
    DetailPrint "Conservation des données utilisateur"
  ${EndIf}

  DetailPrint "═══════════════════════════════════════"
  DetailPrint "DÉSINSTALLATION TERMINÉE"
  DetailPrint "═══════════════════════════════════════"
!macroend
