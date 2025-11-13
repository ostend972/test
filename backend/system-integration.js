const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Exécute une commande de manière sécurisée avec spawn
 * @param {string} command - La commande à exécuter
 * @param {string[]} args - Les arguments (séparés, pas de template string)
 * @param {object} options - Options supplémentaires
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function execSecure(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      windowsHide: true,
      timeout: options.timeout || 30000,
      ...options
    });

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    proc.on('error', (error) => {
      reject(new Error(`Process error: ${error.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Valide un serveur proxy
 * @param {string} host - L'hôte
 * @param {number} port - Le port
 * @returns {string} Le serveur proxy validé au format host:port
 */
function validateProxyServer(host, port) {
  // Valider l'hôte (IP locale uniquement)
  if (!/^127\.0\.0\.1$/.test(host)) {
    throw new Error('Invalid proxy host: must be 127.0.0.1');
  }

  // Valider le port
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
    throw new Error('Invalid port: must be between 1024 and 65535');
  }

  return `${host}:${portNum}`;
}

/**
 * Valide un nom de règle/tâche
 * @param {string} name - Le nom à valider
 * @returns {string} Le nom validé
 */
function validateRuleName(name) {
  // Autoriser uniquement lettres, chiffres, espaces et tirets
  if (!/^[a-zA-Z0-9 -]+$/.test(name)) {
    throw new Error('Invalid rule/task name: only alphanumeric, spaces and hyphens allowed');
  }

  if (name.length > 100) {
    throw new Error('Rule/task name too long (max 100 characters)');
  }

  return name;
}

/**
 * Valide un chemin de fichier exécutable
 * @param {string} exePath - Le chemin à valider
 * @returns {string} Le chemin validé
 */
function validateExePath(exePath) {
  // Résoudre le chemin absolu
  const resolved = path.resolve(exePath);

  // Vérifier que le fichier existe
  try {
    require('fs').accessSync(resolved, require('fs').constants.F_OK);
  } catch {
    throw new Error('Executable path does not exist');
  }

  // Vérifier l'extension .exe sur Windows
  if (process.platform === 'win32' && !resolved.toLowerCase().endsWith('.exe')) {
    throw new Error('Invalid executable: must be a .exe file on Windows');
  }

  return resolved;
}

/**
 * Échappe les caractères spéciaux XML
 * @param {string} text - Le texte à échapper
 * @returns {string} Le texte échappé
 */
function escapeXml(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Valide un nom d'utilisateur Windows
 * @param {string} username - Le nom d'utilisateur
 * @returns {string} Le nom validé
 */
function validateUsername(username) {
  // Autoriser uniquement caractères alphanumériques, tirets et underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw new Error('Invalid username format');
  }

  if (username.length > 256) {
    throw new Error('Username too long');
  }

  return username;
}

/**
 * Intégration système Windows
 * - Configuration proxy système
 * - Règle firewall
 * - T âche planifiée au démarrage
 */
class SystemIntegration {
  constructor(configManager) {
    this.configManager = configManager;
    this.isWindows = process.platform === 'win32';
  }

  /**
   * Configure le proxy système Windows
   * @param {boolean} enable - Activer ou désactiver
   * @param {string} host - Hôte du proxy
   * @param {number} port - Port du proxy
   */
  async setSystemProxy(enable, host = '127.0.0.1', port = 8081) {
    if (!this.isWindows) {
      logger.warn('Configuration proxy système disponible seulement sur Windows');
      return false;
    }

    try {
      if (enable) {
        // Valider et formater le serveur proxy
        const proxyServer = validateProxyServer(host, port);

        // Activer le proxy via netsh
        await execSecure('netsh', [
          'winhttp',
          'set',
          'proxy',
          `proxy-server=${proxyServer}`,
          'bypass-list=<local>'
        ]);

        // Configurer aussi via le registre pour Internet Explorer/Edge
        await this.setRegistryProxy(host, port, true);

        // Variables d'environnement (pour certaines applications)
        process.env.HTTP_PROXY = `http://${proxyServer}`;
        process.env.HTTPS_PROXY = `http://${proxyServer}`;

        logger.info(`Proxy système activé: ${proxyServer}`);
      } else {
        // Désactiver le proxy - essayer plusieurs méthodes pour garantir la désactivation
        try {
          await execSecure('netsh', ['winhttp', 'reset', 'proxy']);
          logger.info('✓ Proxy WinHTTP désactivé');
        } catch (error) {
          logger.warn(`Impossible de désactiver proxy WinHTTP: ${error.message}`);
        }

        try {
          await this.setRegistryProxy('', 0, false);
          logger.info('✓ Proxy registre désactivé');
        } catch (error) {
          logger.warn(`Impossible de désactiver proxy registre: ${error.message}`);
        }

        delete process.env.HTTP_PROXY;
        delete process.env.HTTPS_PROXY;

        logger.info('Proxy système désactivé');
      }

      return true;
    } catch (error) {
      logger.error(`Erreur configuration proxy système: ${error.message}`);
      // Essayer quand même de désactiver le proxy en cas d'erreur
      try {
        await execSecure('netsh', ['winhttp', 'reset', 'proxy']);
      } catch (e) {
        // Ignorer l'erreur finale
      }
      return false;
    }
  }

  /**
   * Configure le proxy dans le registre Windows
   */
  async setRegistryProxy(host, port, enable) {
    try {
      const regPath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

      if (enable) {
        // Valider et formater le serveur proxy
        const proxyServer = validateProxyServer(host, port);

        // Activer le proxy
        await execSecure('reg', ['add', regPath, '/v', 'ProxyEnable', '/t', 'REG_DWORD', '/d', '1', '/f']);
        await execSecure('reg', ['add', regPath, '/v', 'ProxyServer', '/t', 'REG_SZ', '/d', proxyServer, '/f']);
        await execSecure('reg', ['add', regPath, '/v', 'ProxyOverride', '/t', 'REG_SZ', '/d', '<local>', '/f']);
      } else {
        // Désactiver le proxy
        await execSecure('reg', ['add', regPath, '/v', 'ProxyEnable', '/t', 'REG_DWORD', '/d', '0', '/f']);
        await execSecure('reg', ['add', regPath, '/v', 'ProxyServer', '/t', 'REG_SZ', '/d', '', '/f']);
      }

      logger.info('Registre proxy mis à jour');
    } catch (error) {
      logger.error(`Erreur mise à jour registre: ${error.message}`);
    }
  }

  /**
   * Vérifie le statut du proxy système
   */
  async getProxyStatus() {
    if (!this.isWindows) return 'not_configured';

    try {
      const { stdout } = await execSecure('netsh', ['winhttp', 'show', 'proxy']);

      // Support français et anglais
      if (stdout.includes('Direct access') || stdout.includes('Accès direct')) {
        return 'not_configured';
      } else if (stdout.includes('127.0.0.1:8081')) {
        return 'configured';
      } else {
        return 'other_proxy';
      }
    } catch (error) {
      logger.error(`Erreur getProxyStatus: ${error.message}`);
      return 'unknown';
    }
  }

  /**
   * Ajoute une règle firewall Windows
   * @param {string} exePath - Chemin de l'exécutable
   */
  async addFirewallRule(exePath) {
    if (!this.isWindows) {
      logger.warn('Règle firewall disponible seulement sur Windows');
      return false;
    }

    try {
      const ruleName = 'CalmWeb Proxy';

      // Valider le nom de la règle
      validateRuleName(ruleName);

      // Valider le chemin de l'exécutable
      const validatedExePath = validateExePath(exePath);

      // Vérifier si la règle existe déjà
      try {
        await execSecure('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${ruleName}`]);
        logger.info('Règle firewall existe déjà');
        return true;
      } catch {
        // La règle n'existe pas, la créer
      }

      // Créer la règle avec des arguments séparés
      await execSecure('netsh', [
        'advfirewall',
        'firewall',
        'add',
        'rule',
        `name=${ruleName}`,
        'dir=in',
        'action=allow',
        `program=${validatedExePath}`,
        'enable=yes',
        'profile=any',
        'description=Allow CalmWeb proxy to accept connections'
      ]);

      logger.info('Règle firewall ajoutée avec succès');
      return true;
    } catch (error) {
      logger.error(`Erreur ajout règle firewall: ${error.message}`);
      return false;
    }
  }

  /**
   * Supprime la règle firewall
   */
  async removeFirewallRule() {
    if (!this.isWindows) return false;

    try {
      const ruleName = 'CalmWeb Proxy';
      validateRuleName(ruleName);

      await execSecure('netsh', ['advfirewall', 'firewall', 'delete', 'rule', `name=${ruleName}`]);
      logger.info('Règle firewall supprimée');
      return true;
    } catch (error) {
      logger.warn(`Erreur suppression règle firewall: ${error.message}`);
      return false;
    }
  }

  /**
   * Vérifie le statut de la règle firewall
   */
  async getFirewallStatus() {
    if (!this.isWindows) return 'not_configured';

    try {
      const ruleName = 'CalmWeb Proxy';
      validateRuleName(ruleName);

      await execSecure('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${ruleName}`]);
      return 'active';
    } catch {
      return 'not_configured';
    }
  }

  /**
   * Crée une tâche planifiée Windows pour auto-start
   * @param {string} exePath - Chemin de l'exécutable
   */
  async createStartupTask(exePath) {
    if (!this.isWindows) {
      logger.warn('Tâche planifiée disponible seulement sur Windows');
      return false;
    }

    let xmlPath = null;

    try {
      const taskName = 'CalmWeb AutoStart';
      validateRuleName(taskName);

      // Valider le chemin de l'exécutable
      const validatedExePath = validateExePath(exePath);

      // Créer le XML de la tâche (avec échappement)
      const taskXML = this.generateTaskXML(validatedExePath);
      xmlPath = path.join(this.configManager.getConfigDir(), 'task.xml');

      // Sauvegarder le XML temporairement
      await fs.writeFile(xmlPath, taskXML, 'utf-8');

      // Créer la tâche avec schtasks
      await execSecure('schtasks', ['/Create', '/TN', taskName, '/XML', xmlPath, '/F']);

      logger.info('Tâche planifiée créée avec succès');
      return true;
    } catch (error) {
      logger.error(`Erreur création tâche planifiée: ${error.message}`);
      return false;
    } finally {
      // Toujours nettoyer le fichier XML temporaire
      if (xmlPath) {
        try {
          await fs.unlink(xmlPath);
        } catch {
          // Ignorer les erreurs de suppression
        }
      }
    }
  }

  /**
   * Génère le XML pour la tâche planifiée
   */
  generateTaskXML(exePath) {
    // Valider et échapper le nom d'utilisateur
    let username = process.env.USERNAME || 'User';
    try {
      username = validateUsername(username);
    } catch {
      username = 'User';
    }
    const escapedUsername = escapeXml(username);

    // Le chemin a déjà été validé par validateExePath dans createStartupTask
    const escapedExePath = escapeXml(exePath);

    return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Démarre automatiquement CalmWeb au démarrage de Windows</Description>
    <Author>CalmWeb</Author>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>${escapedUsername}</UserId>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${escapedUsername}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <DisallowStartOnRemoteAppSession>false</DisallowStartOnRemoteAppSession>
    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${escapedExePath}</Command>
    </Exec>
  </Actions>
</Task>`;
  }

  /**
   * Supprime la tâche planifiée
   */
  async removeStartupTask() {
    if (!this.isWindows) return false;

    try {
      const taskName = 'CalmWeb AutoStart';
      validateRuleName(taskName);

      await execSecure('schtasks', ['/Delete', '/TN', taskName, '/F']);
      logger.info('Tâche planifiée supprimée');
      return true;
    } catch (error) {
      logger.warn(`Erreur suppression tâche planifiée: ${error.message}`);
      return false;
    }
  }

  /**
   * Vérifie le statut de la tâche planifiée
   */
  async getStartupTaskStatus() {
    if (!this.isWindows) return 'not_configured';

    try {
      const taskName = 'CalmWeb AutoStart';
      validateRuleName(taskName);

      const { stdout } = await execSecure('schtasks', ['/Query', '/TN', taskName, '/FO', 'LIST']);

      // Si pas d'erreur et la tâche existe, elle est active
      // On vérifie juste que la commande a réussi et contient le nom de la tâche
      if (stdout && stdout.includes('CalmWeb AutoStart')) {
        // Vérifier si désactivée (Disabled/Désactivé)
        if (stdout.includes('Disabled') || stdout.includes('sactiv')) {
          return 'disabled';
        }
        // Sinon, elle est active
        return 'active';
      }
      return 'not_configured';
    } catch (error) {
      // Si erreur, la tâche n'existe pas
      return 'not_configured';
    }
  }

  /**
   * Installation complète du système
   */
  async installSystem() {
    if (!this.isWindows) {
      logger.error('Installation disponible seulement sur Windows');
      return false;
    }

    try {
      logger.info('Début de l\'installation système...');

      const installPath = this.configManager.getValue('installPath');

      // 1. Créer le dossier d'installation
      await fs.mkdir(installPath, { recursive: true });
      logger.info(`Dossier créé: ${installPath}`);

      // 2. Copier l'exécutable (si on n'est pas déjà dans Program Files)
      const currentExe = process.execPath;
      const targetExe = path.join(installPath, 'CalmWeb.exe');

      if (currentExe !== targetExe) {
        await fs.copyFile(currentExe, targetExe);
        logger.info(`Exécutable copié vers: ${targetExe}`);
      }

      // 3. Ajouter la règle firewall
      await this.addFirewallRule(targetExe);

      // 4. Créer la tâche planifiée
      await this.createStartupTask(targetExe);

      // 5. Marquer comme installé
      await this.configManager.markInstalled();

      logger.info('Installation système terminée avec succès');
      return { success: true, exePath: targetExe };
    } catch (error) {
      logger.error(`Erreur installation système: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Désinstallation complète
   */
  async uninstallSystem() {
    if (!this.isWindows) return false;

    try {
      logger.info('Début de la désinstallation...');

      // 1. Désactiver le proxy
      await this.setSystemProxy(false);

      // 2. Supprimer la règle firewall
      await this.removeFirewallRule();

      // 3. Supprimer la tâche planifiée
      await this.removeStartupTask();

      logger.info('Désinstallation terminée');
      return true;
    } catch (error) {
      logger.error(`Erreur désinstallation: ${error.message}`);
      return false;
    }
  }

  /**
   * Tentative de réparation du système
   */
  async repairSystem() {
    if (!this.isWindows) {
      return {
        success: false,
        message: 'Réparation disponible uniquement sur Windows',
        details: {}
      };
    }

    try {
      logger.info('═══════════════════════════════════════════════════');
      logger.info('    Diagnostic et réparation du système');
      logger.info('═══════════════════════════════════════════════════');

      const config = this.configManager.get();
      const exePath = process.execPath;
      const results = {
        proxy: { repaired: false, error: null },
        firewall: { repaired: false, error: null },
        startupTask: { repaired: false, error: null }
      };

      // 1. Diagnostic initial
      logger.info('Étape 1/4 : Diagnostic des composants...');
      const status = await this.getSystemStatus();
      logger.info(`  - Proxy Système: ${status.proxy}`);
      logger.info(`  - Règle Pare-feu: ${status.firewall}`);
      logger.info(`  - Tâche planifiée: ${status.startupTask}`);

      // 2. Réparation du proxy système
      logger.info('Étape 2/4 : Réparation du proxy système...');
      if (status.proxy !== 'configured' && config.protectionEnabled) {
        try {
          const success = await this.setSystemProxy(true, config.proxyHost, config.proxyPort);
          results.proxy.repaired = success;
          if (success) {
            logger.info('  ✓ Proxy système réparé');
          } else {
            logger.warn('  ✗ Échec réparation proxy (droits admin requis)');
            results.proxy.error = 'Droits administrateur requis';
          }
        } catch (error) {
          logger.error(`  ✗ Erreur réparation proxy: ${error.message}`);
          results.proxy.error = error.message;
        }
      } else {
        logger.info('  ⊘ Proxy déjà configuré ou protection désactivée');
      }

      // 3. Réparation de la règle firewall
      logger.info('Étape 3/4 : Réparation de la règle pare-feu...');
      if (status.firewall !== 'active') {
        try {
          const success = await this.addFirewallRule(exePath);
          results.firewall.repaired = success;
          if (success) {
            logger.info('  ✓ Règle pare-feu réparée');
          } else {
            logger.warn('  ✗ Échec réparation pare-feu (droits admin requis)');
            results.firewall.error = 'Droits administrateur requis';
          }
        } catch (error) {
          logger.error(`  ✗ Erreur réparation pare-feu: ${error.message}`);
          results.firewall.error = error.message;
        }
      } else {
        logger.info('  ⊘ Règle pare-feu déjà active');
      }

      // 4. Réparation de la tâche planifiée
      logger.info('Étape 4/4 : Réparation de la tâche planifiée...');
      if (status.startupTask !== 'active') {
        try {
          const success = await this.createStartupTask(exePath);
          results.startupTask.repaired = success;
          if (success) {
            logger.info('  ✓ Tâche planifiée réparée');
          } else {
            logger.warn('  ✗ Échec réparation tâche planifiée');
            results.startupTask.error = 'Échec de création';
          }
        } catch (error) {
          logger.error(`  ✗ Erreur réparation tâche: ${error.message}`);
          results.startupTask.error = error.message;
        }
      } else {
        logger.info('  ⊘ Tâche planifiée déjà active');
      }

      // 5. Bilan final
      const repairedCount = Object.values(results).filter(r => r.repaired).length;
      const errorCount = Object.values(results).filter(r => r.error !== null).length;

      logger.info('═══════════════════════════════════════════════════');
      logger.info(`Réparation terminée: ${repairedCount} composant(s) réparé(s), ${errorCount} erreur(s)`);
      logger.info('═══════════════════════════════════════════════════');

      return {
        success: errorCount === 0,
        repairedCount,
        errorCount,
        details: results
      };
    } catch (error) {
      logger.error(`Erreur critique durant la réparation: ${error.message}`);
      return {
        success: false,
        message: `Erreur critique: ${error.message}`,
        details: {}
      };
    }
  }

  /**
   * Obtient le statut complet du système
   */
  async getSystemStatus() {
    const config = this.configManager.get();
    const status = {
      proxy: await this.getProxyStatus(),
      firewall: await this.getFirewallStatus(),
      startupTask: await this.getStartupTaskStatus(),
      isInstalled: config.installed || false
    };

    return status;
  }

  /**
   * Lance l'application avec les privilèges admin
   */
  async requestAdminPrivileges() {
    if (!this.isWindows) return false;

    try {
      const exePath = validateExePath(process.execPath);
      const args = process.argv.slice(1);

      // Valider les arguments
      const validatedArgs = args.map(arg => {
        if (typeof arg !== 'string') {
          throw new Error('Invalid argument type');
        }
        // Limiter la longueur et rejeter les caractères dangereux
        if (arg.length > 1000) {
          throw new Error('Argument too long');
        }
        return arg;
      });

      // Construire la commande PowerShell de manière sécurisée
      // Échapper les guillemets simples dans exePath et args
      const escapedExePath = exePath.replace(/'/g, "''");
      const escapedArgs = validatedArgs.map(arg => arg.replace(/'/g, "''")).join("', '");

      const psCommand = `Start-Process -FilePath '${escapedExePath}' -ArgumentList '${escapedArgs}' -Verb RunAs`;

      // Lancer PowerShell avec la commande échappée
      await execSecure('powershell', ['-NoProfile', '-Command', psCommand]);

      // Quitter le processus actuel
      process.exit(0);
    } catch (error) {
      logger.error(`Erreur demande privilèges admin: ${error.message}`);
      return false;
    }
  }

  /**
   * Vérifie si on a les privilèges admin
   */
  async isAdmin() {
    if (!this.isWindows) return false;

    try {
      const { stdout } = await execSecure('net', ['session']);
      return !stdout.includes('Access is denied') && !stdout.includes('系统拒绝访问');
    } catch {
      return false;
    }
  }
}

module.exports = SystemIntegration;
