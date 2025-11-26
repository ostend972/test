import { spawn } from 'child_process';
import { SystemIntegrity } from './types';
import store from './store';

/**
 * Execute command safely using spawn
 */
const spawnAsync = (command: string, args: string[]): Promise<string> => {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, { shell: false });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => stdout += data.toString());
        proc.stderr.on('data', (data) => stderr += data.toString());

        proc.on('error', (error) => reject(error));
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            } else {
                resolve(stdout);
            }
        });
    });
};

/**
 * Check if Windows proxy is configured to use our proxy
 */
export async function checkProxySettings(): Promise<boolean> {
    try {
        const stdout = await spawnAsync('reg', [
            'query',
            'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
            '/v',
            'ProxyEnable'
        ]);
        const enabled = stdout.includes('0x1');

        if (!enabled) return false;

        const serverOutput = await spawnAsync('reg', [
            'query',
            'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
            '/v',
            'ProxyServer'
        ]);
        const proxyPort = (store as any).get('proxyPort') || 8081;
        const expectedProxy = `127.0.0.1:${proxyPort}`;

        return serverOutput.includes(expectedProxy);
    } catch (error) {
        console.error('Failed to check proxy settings:', error);
        return false;
    }
}

/**
 * Configure Windows proxy settings
 */
export async function enableProxySettings(): Promise<void> {
    const proxyPort = (store as any).get('proxyPort') || 8080;
    const proxyServer = `127.0.0.1:${proxyPort}`;

    try {
        // Enable proxy
        await spawnAsync('reg', [
            'add',
            'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
            '/v', 'ProxyEnable',
            '/t', 'REG_DWORD',
            '/d', '1',
            '/f'
        ]);

        // Set proxy server
        await spawnAsync('reg', [
            'add',
            'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
            '/v', 'ProxyServer',
            '/t', 'REG_SZ',
            '/d', proxyServer,
            '/f'
        ]);

        // Bypass local addresses - include localhost, 127.0.0.1, and local networks
        await spawnAsync('reg', [
            'add',
            'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
            '/v', 'ProxyOverride',
            '/t', 'REG_SZ',
            '/d', 'localhost;127.*;192.168.*;10.*;172.16.*;*.local;<local>',
            '/f'
        ]);
    } catch (error) {
        console.error('Failed to configure proxy:', error);
        throw error;
    }
}

/**
 * Disable Windows proxy settings
 */
export async function disableProxySettings(): Promise<void> {
    try {
        await spawnAsync('reg', [
            'add',
            'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
            '/v', 'ProxyEnable',
            '/t', 'REG_DWORD',
            '/d', '0',
            '/f'
        ]);
    } catch (error) {
        console.error('Failed to disable proxy:', error);
        throw error;
    }
}

/**
 * Check if CalmWeb firewall rule exists
 */
export async function checkFirewallStatus(): Promise<boolean> {
    try {
        const ruleName = 'CalmWeb Proxy';
        await spawnAsync('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${ruleName}`]);
        // If command succeeds, rule exists
        return true;
    } catch (error) {
        // Rule doesn't exist
        return false;
    }
}

/**
 * Add Windows Firewall rule for CalmWeb
 */
export async function addFirewallRule(exePath: string): Promise<void> {
    const ruleName = 'CalmWeb Proxy';

    try {
        // Check if rule already exists
        const exists = await checkFirewallStatus();
        if (exists) {
            console.log('[Firewall] Rule already exists, skipping');
            return;
        }

        // Create the rule
        await spawnAsync('netsh', [
            'advfirewall',
            'firewall',
            'add',
            'rule',
            `name=${ruleName}`,
            'dir=in',
            'action=allow',
            `program=${exePath}`,
            'enable=yes',
            'profile=any',
            'description=Allow CalmWeb proxy to accept connections'
        ]);

        console.log('[Firewall] ✓ Firewall rule added successfully');
    } catch (error: any) {
        console.error('[Firewall] ✗ Failed to add firewall rule:', error.message);
        throw error;
    }
}

/**
 * Remove Windows Firewall rule for CalmWeb
 */
export async function removeFirewallRule(): Promise<void> {
    const ruleName = 'CalmWeb Proxy';

    try {
        await spawnAsync('netsh', ['advfirewall', 'firewall', 'delete', 'rule', `name=${ruleName}`]);
        console.log('[Firewall] ✓ Firewall rule removed successfully');
    } catch (error: any) {
        console.warn('[Firewall] ⚠ Failed to remove firewall rule:', error.message);
    }
}

/**
 * Check if auto-start task is scheduled
 */
export async function checkAutoStart(): Promise<boolean> {
    try {
        const stdout = await spawnAsync('schtasks', ['/query', '/tn', 'CalmWeb', '/fo', 'LIST']);
        return stdout.includes('CalmWeb');
    } catch (error) {
        // Task doesn't exist
        return false;
    }
}

/**
 * Create auto-start task
 */
export async function createAutoStartTask(exePath: string): Promise<void> {
    try {
        // Remove existing task if it exists
        await spawnAsync('schtasks', ['/delete', '/tn', 'CalmWeb', '/f']).catch(() => { });

        // Create new task
        await spawnAsync('schtasks', [
            '/create',
            '/tn', 'CalmWeb',
            '/tr', exePath,
            '/sc', 'onlogon',
            '/rl', 'highest',
            '/f'
        ]);
    } catch (error) {
        console.error('Failed to create auto-start task:', error);
        throw error;
    }
}

/**
 * Delete auto-start task
 */
export async function deleteAutoStartTask(): Promise<void> {
    try {
        await spawnAsync('schtasks', ['/delete', '/tn', 'CalmWeb', '/f']);
        console.log('[Auto-Start] Task deleted successfully');
    } catch (error) {
        console.warn('[Auto-Start] Task may not exist or failed to delete:', error);
    }
}

/**
 * Get system integrity status
 */
export async function getSystemIntegrity(): Promise<SystemIntegrity> {
    const [proxyConfigured, firewallActive, autoStartScheduled] = await Promise.all([
        checkProxySettings(),
        checkFirewallStatus(),
        checkAutoStart()
    ]);

    return {
        proxyConfigured,
        firewallActive,
        autoStartTaskScheduled: autoStartScheduled
    };
}

/**
 * Repair system integrity issues
 */
export async function repairSystemIntegrity(exePath?: string): Promise<void> {
    const { logger } = await import('./logger');
    const integrity = await getSystemIntegrity();

    logger.info('System integrity check:', {
        proxyConfigured: integrity.proxyConfigured,
        firewallActive: integrity.firewallActive,
        autoStartTaskScheduled: integrity.autoStartTaskScheduled
    });

    // Fix proxy if not configured
    if (!integrity.proxyConfigured) {
        logger.info('Proxy not configured, attempting to configure...');
        try {
            await enableProxySettings();
            logger.info('Proxy configured successfully');
        } catch (error: any) {
            logger.error('Failed to configure proxy:', error.message);
            throw error;
        }
    } else {
        logger.info('Proxy already configured, skipping');
    }

    // Create auto-start task if not scheduled
    if (!integrity.autoStartTaskScheduled && exePath) {
        logger.info('Auto-start task not found, creating...');
        try {
            await createAutoStartTask(exePath);
            logger.info('Auto-start task created successfully');
        } catch (error: any) {
            logger.error('Failed to create auto-start task:', error.message);
            throw error;
        }
    } else if (integrity.autoStartTaskScheduled) {
        logger.info('Auto-start task already exists, skipping');
    } else {
        logger.warn('Auto-start task creation skipped (no exe path provided)');
    }

    // Create firewall rule if needed
    if (!integrity.firewallActive && exePath) {
        logger.info('Firewall rule not found, creating...');
        try {
            await addFirewallRule(exePath);
            logger.info('Firewall rule created successfully');
        } catch (error: any) {
            logger.error('Failed to create firewall rule:', error.message);
            logger.warn('⚠️ CalmWeb may be blocked by Windows Firewall. Please allow it manually in Windows Security.');
        }
    } else if (integrity.firewallActive) {
        logger.info('Firewall rule already exists');
    } else {
        logger.warn('Firewall rule creation skipped (no exe path provided)');
    }
}
