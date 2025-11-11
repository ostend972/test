/**
 * Vérifie si l'application tourne avec des privilèges administrateur
 * et relance en admin si nécessaire
 */

const { exec } = require('child_process');
const { app } = require('electron');
const path = require('path');

/**
 * Vérifie si l'application a les droits admin
 */
function isAdmin() {
  try {
    // Sur Windows, essayer d'accéder à un dossier système
    const fs = require('fs');
    const testPath = 'C:\\Windows\\System32\\config\\systemprofile';
    try {
      fs.accessSync(testPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Relance l'application en administrateur
 */
function relaunchAsAdmin() {
  const fs = require('fs');
  const os = require('os');

  // Créer un script VBScript temporaire pour l'élévation UAC
  const vbsPath = path.join(os.tmpdir(), 'elevate-calmweb.vbs');

  // Construire les arguments
  const args = process.argv.slice(1).map(arg => `"${arg}"`).join(' ');

  // Script VBScript pour demander l'élévation UAC
  const vbsScript = `Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "${process.execPath.replace(/\\/g, '\\\\')}", "${args}", "", "runas", 1`;

  try {
    // Écrire le script VBS temporaire
    fs.writeFileSync(vbsPath, vbsScript, 'utf8');

    const { spawn } = require('child_process');

    // Exécuter le script VBS (cela déclenche l'UAC)
    const vbs = spawn('wscript.exe', [vbsPath], {
      detached: true,
      stdio: 'ignore'
    });

    vbs.unref();

    // Nettoyer le fichier temporaire après un délai
    setTimeout(() => {
      try {
        fs.unlinkSync(vbsPath);
      } catch (e) {
        // Ignorer les erreurs de suppression
      }
    }, 2000);

    // Quitter l'instance actuelle
    setTimeout(() => {
      app.quit();
    }, 500);
  } catch (error) {
    console.error('[Admin] Erreur lors de la création du script d\'élévation:', error);
    app.quit();
  }
}

/**
 * Vérifie et demande les droits admin au démarrage
 */
function checkAndRequestAdmin() {
  if (!isAdmin()) {
    console.log('[Admin] L\'application nécessite des droits administrateur');
    console.log('[Admin] Relance en cours...');

    const { dialog } = require('electron');

    // Afficher un message à l'utilisateur
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Privilèges Administrateur Requis',
      message: 'CalmWeb nécessite des privilèges administrateur pour configurer le proxy système.',
      detail: 'L\'application va se relancer avec les droits administrateur. Veuillez accepter la demande UAC.',
      buttons: ['OK']
    });

    relaunchAsAdmin();
    return false;
  }

  console.log('[Admin] ✓ Droits administrateur confirmés');
  return true;
}

module.exports = {
  isAdmin,
  checkAndRequestAdmin
};
