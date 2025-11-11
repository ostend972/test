/**
 * Script de nettoyage du proxy CalmWeb
 * À exécuter au démarrage Windows pour désactiver le proxy si CalmWeb n'est pas actif
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.env.APPDATA, 'calmweb', 'cleanup-proxy.log');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);

    try {
        fs.appendFileSync(LOG_FILE, logMessage);
    } catch (error) {
        // Ignorer les erreurs de log
    }
}

function isCalmWebRunning() {
    try {
        const result = execSync('tasklist /FI "IMAGENAME eq electron.exe" /NH', { encoding: 'utf8' });
        return result.includes('electron.exe');
    } catch (error) {
        return false;
    }
}

function isProxyActive() {
    try {
        const result = execSync('netsh winhttp show proxy', { encoding: 'utf8' });
        return result.includes('127.0.0.1:8081');
    } catch (error) {
        return false;
    }
}

function disableProxy() {
    try {
        log('Désactivation du proxy système...');
        execSync('netsh winhttp reset proxy', { encoding: 'utf8' });
        log('✓ Proxy désactivé avec succès');
        return true;
    } catch (error) {
        log(`✗ Erreur désactivation proxy: ${error.message}`);
        return false;
    }
}

// Script principal
log('═══════════════════════════════════════════════════');
log('CalmWeb - Nettoyage du proxy au démarrage');
log('═══════════════════════════════════════════════════');

const calmwebRunning = isCalmWebRunning();
const proxyActive = isProxyActive();

log(`CalmWeb en cours d'exécution: ${calmwebRunning ? 'OUI' : 'NON'}`);
log(`Proxy CalmWeb actif: ${proxyActive ? 'OUI' : 'NON'}`);

if (!calmwebRunning && proxyActive) {
    log('⚠ Proxy résiduel détecté sans CalmWeb actif');
    log('Action: Désactivation du proxy...');

    if (disableProxy()) {
        log('✓ Nettoyage terminé avec succès');
        process.exit(0);
    } else {
        log('✗ Échec du nettoyage');
        process.exit(1);
    }
} else if (calmwebRunning && proxyActive) {
    log('✓ CalmWeb actif avec proxy configuré - OK');
    process.exit(0);
} else if (!proxyActive) {
    log('✓ Proxy déjà désactivé - OK');
    process.exit(0);
} else {
    log('✓ Configuration normale - OK');
    process.exit(0);
}
