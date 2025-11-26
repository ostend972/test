import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import https from 'https';
import { logger } from './logger';

// GitHub repository info
const GITHUB_OWNER = 'ostend972';
const GITHUB_REPO = 'test';

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't download automatically
autoUpdater.autoInstallOnAppQuit = true; // Install on quit

export interface UpdateInfo {
    available: boolean;
    version?: string;
    currentVersion?: string;
    releaseNotes?: string;
    releaseDate?: string;
    downloadUrl?: string;
}

/**
 * Fetch release notes directly from GitHub API
 * This ensures we always get the full release notes from the GitHub release
 */
async function fetchGitHubReleaseNotes(version: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/v${version}`,
            method: 'GET',
            headers: {
                'User-Agent': 'CalmWeb-Updater',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        logger.info(`[Updater] Fetching release notes for v${version} from GitHub...`);

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const release = JSON.parse(data);
                        const notes = release.body || '';
                        logger.info(`[Updater] ✓ Got release notes (${notes.length} chars)`);
                        resolve(notes);
                    } catch (error) {
                        logger.warn('[Updater] Failed to parse GitHub release response');
                        resolve('');
                    }
                } else if (res.statusCode === 404) {
                    // Try without 'v' prefix
                    fetchGitHubReleaseNotesWithoutV(version).then(resolve).catch(() => resolve(''));
                } else {
                    logger.warn(`[Updater] GitHub API returned ${res.statusCode}`);
                    resolve('');
                }
            });
        });

        req.on('error', (error) => {
            logger.warn('[Updater] Failed to fetch release notes from GitHub:', error.message);
            resolve(''); // Don't fail the update, just return empty notes
        });

        req.setTimeout(10000, () => {
            req.destroy();
            resolve('');
        });

        req.end();
    });
}

/**
 * Try fetching without 'v' prefix (some releases don't use it)
 */
async function fetchGitHubReleaseNotesWithoutV(version: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${version}`,
            method: 'GET',
            headers: {
                'User-Agent': 'CalmWeb-Updater',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const release = JSON.parse(data);
                        resolve(release.body || '');
                    } catch {
                        resolve('');
                    }
                } else {
                    // Try latest release as fallback
                    fetchLatestGitHubRelease().then(resolve).catch(() => resolve(''));
                }
            });
        });

        req.on('error', () => resolve(''));
        req.setTimeout(5000, () => {
            req.destroy();
            resolve('');
        });
        req.end();
    });
}

/**
 * Fetch the latest release from GitHub
 */
async function fetchLatestGitHubRelease(): Promise<string> {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
            method: 'GET',
            headers: {
                'User-Agent': 'CalmWeb-Updater',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const release = JSON.parse(data);
                        logger.info(`[Updater] ✓ Got latest release notes from GitHub`);
                        resolve(release.body || '');
                    } catch {
                        resolve('');
                    }
                } else {
                    resolve('');
                }
            });
        });

        req.on('error', () => resolve(''));
        req.setTimeout(5000, () => {
            req.destroy();
            resolve('');
        });
        req.end();
    });
}

let mainWindow: BrowserWindow | null = null;

/**
 * Initialize the updater with the main window
 */
export function initUpdater(window: BrowserWindow) {
    mainWindow = window;

    // Event listeners
    autoUpdater.on('checking-for-update', () => {
        logger.info('[Updater] Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        logger.info('[Updater] ✓ Update available:', {
            version: info.version,
            releaseDate: info.releaseDate
        });

        // Notify the renderer
        if (mainWindow) {
            mainWindow.webContents.send('update-available', {
                version: info.version,
                releaseNotes: info.releaseNotes,
                releaseDate: info.releaseDate
            });
        }
    });

    autoUpdater.on('update-not-available', (info) => {
        logger.info('[Updater] No updates available - current version is latest:', info.version);
    });

    autoUpdater.on('error', (err) => {
        logger.error('[Updater] ✗ Update error:', err.message);
        if (mainWindow) {
            mainWindow.webContents.send('update-error', err.message);
        }
    });

    autoUpdater.on('download-progress', (progress) => {
        logger.info(`[Updater] Download progress: ${progress.percent.toFixed(2)}%`);
        if (mainWindow) {
            mainWindow.webContents.send('update-download-progress', {
                percent: progress.percent,
                transferred: progress.transferred,
                total: progress.total,
                bytesPerSecond: progress.bytesPerSecond
            });
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        logger.info('[Updater] ✓ Update downloaded:', info.version);
        logger.info('[Updater] Update ready to install - will install on next restart or when user clicks install');

        if (mainWindow) {
            mainWindow.webContents.send('update-downloaded', {
                version: info.version,
                ready: true
            });
        }
    });

    logger.info('[Updater] Updater initialized');
}

/**
 * Check for updates
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
    try {
        logger.info('[Updater] Starting update check...');

        const result = await autoUpdater.checkForUpdates();

        if (!result) {
            logger.warn('[Updater] No update info returned');
            return { available: false };
        }

        const { updateInfo } = result;

        if (updateInfo && updateInfo.version) {
            logger.info('[Updater] Update check complete:', {
                currentVersion: autoUpdater.currentVersion.version,
                latestVersion: updateInfo.version
            });

            // Parse release notes from electron-updater (can be string or array)
            let releaseNotes = '';
            if (typeof updateInfo.releaseNotes === 'string') {
                releaseNotes = updateInfo.releaseNotes;
            } else if (Array.isArray(updateInfo.releaseNotes)) {
                releaseNotes = updateInfo.releaseNotes
                    .map(note => {
                        if (typeof note === 'string') return note;
                        if (note && typeof note === 'object' && 'note' in note) {
                            return (note as any).note;
                        }
                        return '';
                    })
                    .filter(Boolean)
                    .join('\n\n');
            }

            // If no release notes from electron-updater, fetch directly from GitHub API
            if (!releaseNotes || releaseNotes.trim() === '') {
                logger.info('[Updater] No release notes from electron-updater, fetching from GitHub...');
                releaseNotes = await fetchGitHubReleaseNotes(updateInfo.version);
            }

            return {
                available: true,
                version: updateInfo.version,
                currentVersion: autoUpdater.currentVersion.version,
                releaseNotes,
                releaseDate: updateInfo.releaseDate,
            };
        }

        return { available: false };
    } catch (error: any) {
        logger.error('[Updater] ✗ Failed to check for updates:', error.message);
        throw error;
    }
}

/**
 * Download the update
 */
export async function downloadUpdate(): Promise<void> {
    try {
        logger.info('[Updater] Starting download...');
        await autoUpdater.downloadUpdate();
        logger.info('[Updater] ✓ Download started');
    } catch (error: any) {
        logger.error('[Updater] ✗ Download failed:', error.message);
        throw error;
    }
}

/**
 * Install the update (quits and installs)
 * This should only be called after downloadUpdate() has completed
 */
export function installUpdate(): void {
    logger.info('[Updater] Installing update and restarting...');

    try {
        autoUpdater.quitAndInstall(false, true);
    } catch (error: any) {
        logger.error('[Updater] ✗ Failed to install update:', error.message);
        logger.warn('[Updater] Make sure the update has been downloaded first');
        throw error;
    }
}

/**
 * Download AND install the update (combined for convenience)
 */
export async function downloadAndInstall(): Promise<void> {
    try {
        logger.info('[Updater] Starting download and install process...');

        // First download
        await downloadUpdate();

        // Wait for download to complete
        // The 'update-downloaded' event will be fired when ready
        // Then quitAndInstall will be called
        logger.info('[Updater] Update download started, will install when complete');
    } catch (error: any) {
        logger.error('[Updater] ✗ Download and install failed:', error.message);
        throw error;
    }
}

/**
 * Get current version
 */
export function getCurrentVersion(): string {
    return autoUpdater.currentVersion.version;
}
