/**
 * DNS Manager - Gère les serveurs DNS Windows
 *
 * Permet de changer les DNS de toutes les interfaces réseau Windows
 * et de les restaurer à la fermeture de l'application.
 *
 * Nécessite des privilèges administrateur.
 */

import { spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(require('child_process').exec);

interface NetworkInterface {
    name: string;
    originalDNS: string[];
}

interface DNSProvider {
    name: string;
    servers: string[];
}

const DNS_PROVIDERS: Record<string, DNSProvider> = {
    system: {
        name: 'System Default',
        servers: [] // Empty means restore to DHCP
    },
    cloudflare: {
        name: 'Cloudflare',
        servers: ['1.1.1.1', '1.0.0.1']
    },
    google: {
        name: 'Google Public DNS',
        servers: ['8.8.8.8', '8.8.4.4']
    },
    quad9: {
        name: 'Quad9',
        servers: ['9.9.9.9', '149.112.112.112']
    }
};

// Stockage des DNS originaux pour restauration
const originalDNSConfig = new Map<string, string[]>();

/**
 * Obtenir toutes les interfaces réseau actives
 */
async function getActiveInterfaces(): Promise<string[]> {
    try {
        const { stdout } = await execAsync('netsh interface show interface');
        const lines = stdout.split('\n');
        const interfaces: string[] = [];

        for (const line of lines) {
            // Support both English "Connected" and French "Connecté"
            // Skip "Disconnected" / "Déconnecté"
            if ((line.includes('Connected') || line.includes('Connecté')) &&
                !line.includes('Disconnected') && !line.includes('Déconnecté')) {
                const parts = line.trim().split(/\s{2,}/);
                // Interface name is always the last column
                if (parts.length >= 4) {
                    const interfaceName = parts[parts.length - 1];
                    interfaces.push(interfaceName);
                }
            }
        }

        return interfaces;
    } catch (error: any) {
        console.error('[DNS Manager] Erreur lors de la récupération des interfaces:', error.message);
        return [];
    }
}

/**
 * Obtenir les serveurs DNS actuels d'une interface
 */
async function getCurrentDNS(interfaceName: string): Promise<string[]> {
    try {
        const { stdout } = await execAsync(`netsh interface ip show dns "${interfaceName}"`);
        const dnsServers: string[] = [];
        const lines = stdout.split('\n');

        for (const line of lines) {
            // Chercher les lignes avec des adresses IP (format: xxx.xxx.xxx.xxx)
            const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
            if (match) {
                dnsServers.push(match[1]);
            }
        }

        return dnsServers;
    } catch (error: any) {
        console.error(`[DNS Manager] Erreur lors de la récupération DNS pour ${interfaceName}:`, error.message);
        return [];
    }
}

/**
 * Sauvegarder les DNS actuels de toutes les interfaces
 */
async function backupCurrentDNS(): Promise<void> {
    console.log('[DNS Manager] Sauvegarde des DNS actuels...');

    const interfaces = await getActiveInterfaces();

    for (const interfaceName of interfaces) {
        const currentDNS = await getCurrentDNS(interfaceName);
        if (currentDNS.length > 0) {
            originalDNSConfig.set(interfaceName, currentDNS);
            console.log(`[DNS Manager] ✓ Sauvegardé ${interfaceName}: ${currentDNS.join(', ')}`);
        }
    }

    console.log(`[DNS Manager] ${originalDNSConfig.size} interfaces sauvegardées`);
}

/**
 * Définir les serveurs DNS pour une interface
 */
async function setDNSForInterface(interfaceName: string, dnsServers: string[]): Promise<void> {
    try {
        if (dnsServers.length === 0) {
            // Restaurer DHCP
            await execAsync(`netsh interface ip set dns "${interfaceName}" dhcp`);
            console.log(`[DNS Manager] ✓ ${interfaceName} → DHCP`);
            return;
        }

        // Définir le DNS primaire
        await execAsync(`netsh interface ip set dns "${interfaceName}" static ${dnsServers[0]} primary`);
        console.log(`[DNS Manager] ✓ ${interfaceName} → DNS primaire: ${dnsServers[0]}`);

        // Ajouter les DNS secondaires
        for (let i = 1; i < dnsServers.length; i++) {
            await execAsync(`netsh interface ip add dns "${interfaceName}" ${dnsServers[i]} index=${i + 1}`);
            console.log(`[DNS Manager] ✓ ${interfaceName} → DNS secondaire: ${dnsServers[i]}`);
        }
    } catch (error: any) {
        console.error(`[DNS Manager] Erreur lors de la définition DNS pour ${interfaceName}:`, error.message);
        throw error;
    }
}

/**
 * Appliquer un fournisseur DNS à toutes les interfaces actives
 */
export async function applyDNSProvider(provider: 'system' | 'cloudflare' | 'google' | 'quad9'): Promise<void> {
    const dnsProvider = DNS_PROVIDERS[provider];

    if (!dnsProvider) {
        console.error(`[DNS Manager] Fournisseur DNS invalide: ${provider}`);
        return;
    }

    console.log(`[DNS Manager] Application du DNS: ${dnsProvider.name}`);

    // Sauvegarder les DNS actuels si pas encore fait
    if (originalDNSConfig.size === 0) {
        await backupCurrentDNS();
    }

    // Appliquer le nouveau DNS à toutes les interfaces actives
    const interfaces = await getActiveInterfaces();

    for (const interfaceName of interfaces) {
        try {
            await setDNSForInterface(interfaceName, dnsProvider.servers);
        } catch (error: any) {
            console.error(`[DNS Manager] Échec pour ${interfaceName}:`, error.message);
        }
    }

    console.log(`[DNS Manager] ✓ DNS ${dnsProvider.name} appliqué`);
}

/**
 * Restaurer les DNS originaux
 */
export async function restoreDNS(): Promise<void> {
    if (originalDNSConfig.size === 0) {
        console.log('[DNS Manager] Aucun DNS à restaurer');
        return;
    }

    console.log('[DNS Manager] Restauration des DNS originaux...');

    for (const [interfaceName, dnsServers] of originalDNSConfig.entries()) {
        try {
            if (dnsServers.length === 0) {
                // Si pas de DNS sauvegardé, restaurer DHCP
                await setDNSForInterface(interfaceName, []);
            } else {
                await setDNSForInterface(interfaceName, dnsServers);
            }
            console.log(`[DNS Manager] ✓ Restauré ${interfaceName}`);
        } catch (error: any) {
            console.error(`[DNS Manager] Erreur lors de la restauration de ${interfaceName}:`, error.message);
        }
    }

    originalDNSConfig.clear();
    console.log('[DNS Manager] ✓ DNS restaurés');
}

/**
 * Vider le cache DNS Windows
 */
export async function flushDNSCache(): Promise<void> {
    try {
        await execAsync('ipconfig /flushdns');
        console.log('[DNS Manager] ✓ Cache DNS vidé');
    } catch (error: any) {
        console.error('[DNS Manager] Erreur lors du vidage du cache DNS:', error.message);
    }
}

/**
 * Obtenir le statut actuel des DNS
 */
export async function getDNSStatus(): Promise<{ interface: string; dns: string[] }[]> {
    const interfaces = await getActiveInterfaces();
    const status: { interface: string; dns: string[] }[] = [];

    for (const interfaceName of interfaces) {
        const dns = await getCurrentDNS(interfaceName);
        status.push({ interface: interfaceName, dns });
    }

    return status;
}

export default {
    applyDNSProvider,
    restoreDNS,
    flushDNSCache,
    getDNSStatus
};
