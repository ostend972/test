import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { LogEntry, BlocklistSource, WhitelistSource, BlocklistEntry, WhitelistEntry, Stats } from './types';
import { logger } from './logger';

const dbPath = path.join(app.getPath('userData'), 'calmweb.db');
const dbBackupPath = path.join(app.getPath('userData'), 'calmweb.db.backup');
console.log(`[Database] Initializing at: ${dbPath}`);

// ============================================================================
// DATABASE INTEGRITY CHECK & AUTO-REPAIR
// ============================================================================

/**
 * Check database integrity
 * Returns true if database is healthy, false if corrupted
 */
function checkDatabaseIntegrity(database: Database.Database): boolean {
    try {
        const result = database.pragma('integrity_check') as Array<{ integrity_check: string }>;
        if (result.length === 1 && result[0].integrity_check === 'ok') {
            console.log('[Database] ✓ Integrity check passed');
            return true;
        } else {
            console.error('[Database] ✗ Integrity check failed:', result);
            return false;
        }
    } catch (error: any) {
        console.error('[Database] ✗ Integrity check error:', error.message);
        return false;
    }
}

/**
 * Create a backup of the database
 */
function createDatabaseBackup(): boolean {
    try {
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, dbBackupPath);
            console.log('[Database] ✓ Backup created at:', dbBackupPath);
            return true;
        }
        return false;
    } catch (error: any) {
        console.error('[Database] ✗ Backup failed:', error.message);
        return false;
    }
}

/**
 * Restore database from backup
 */
function restoreDatabaseFromBackup(): boolean {
    try {
        if (fs.existsSync(dbBackupPath)) {
            fs.copyFileSync(dbBackupPath, dbPath);
            console.log('[Database] ✓ Database restored from backup');
            return true;
        } else {
            console.warn('[Database] No backup found to restore');
            return false;
        }
    } catch (error: any) {
        console.error('[Database] ✗ Restore failed:', error.message);
        return false;
    }
}

/**
 * Attempt to repair a corrupted database using VACUUM
 */
function attemptDatabaseRepair(database: Database.Database): boolean {
    try {
        console.log('[Database] Attempting repair with VACUUM...');
        database.exec('VACUUM');
        console.log('[Database] ✓ VACUUM completed');
        return true;
    } catch (error: any) {
        console.error('[Database] ✗ VACUUM failed:', error.message);
        return false;
    }
}

/**
 * Delete corrupted database and start fresh
 */
function resetDatabase(): void {
    try {
        // Remove all database files
        const files = [dbPath, dbPath + '-wal', dbPath + '-shm'];
        for (const file of files) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log('[Database] Deleted:', file);
            }
        }
        console.log('[Database] ✓ Database reset - will create fresh on next open');
    } catch (error: any) {
        console.error('[Database] ✗ Reset failed:', error.message);
    }
}

// Copy database from resources if it doesn't exist (first run)
if (!fs.existsSync(dbPath)) {
    const resourceDbPath = process.resourcesPath
        ? path.join(process.resourcesPath, 'calmweb.db')
        : path.join(__dirname, '..', 'assets', 'calmweb.db');

    if (fs.existsSync(resourceDbPath)) {
        console.log('[Database] First run detected - copying pre-loaded database from resources...');
        const userDataDir = app.getPath('userData');
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }
        fs.copyFileSync(resourceDbPath, dbPath);
        console.log('[Database] ✓ Pre-loaded database copied successfully');
    } else {
        console.log('[Database] No pre-loaded database found, will create new database');
    }
}

let db: Database.Database;
let dbOpenAttempts = 0;
const MAX_DB_OPEN_ATTEMPTS = 3;

while (dbOpenAttempts < MAX_DB_OPEN_ATTEMPTS) {
    dbOpenAttempts++;
    try {
        db = new Database(dbPath);
        console.log(`[Database] ✓ Connection established (attempt ${dbOpenAttempts})`);

        // Run integrity check
        if (!checkDatabaseIntegrity(db)) {
            console.warn('[Database] Database integrity check failed, attempting repair...');

            // Try VACUUM first
            if (attemptDatabaseRepair(db)) {
                if (checkDatabaseIntegrity(db)) {
                    console.log('[Database] ✓ Repair successful');
                    break;
                }
            }

            // VACUUM didn't help, close and try backup
            db.close();

            if (restoreDatabaseFromBackup()) {
                console.log('[Database] Trying restored backup...');
                continue; // Retry with backup
            } else {
                // No backup, reset database
                resetDatabase();
                continue; // Retry with fresh database
            }
        }

        // Database is healthy, create backup
        createDatabaseBackup();
        break;

    } catch (error: any) {
        console.error(`[Database] ✗ Failed to open database (attempt ${dbOpenAttempts}):`, error.message);

        if (error.message?.includes('SQLITE_CORRUPT') || error.message?.includes('database disk image is malformed')) {
            console.error('[Database] Database is corrupted!');

            if (restoreDatabaseFromBackup()) {
                continue; // Retry with backup
            } else {
                resetDatabase();
                continue; // Retry with fresh database
            }
        }

        if (dbOpenAttempts >= MAX_DB_OPEN_ATTEMPTS) {
            console.error('[Database] ✗ All attempts failed, creating fresh database');
            resetDatabase();
            db = new Database(dbPath);
            break;
        }
    }
}

// @ts-ignore - db is definitely assigned at this point
if (!db) {
    throw new Error('Failed to initialize database after all attempts');
}

// Performance optimizations for 3M+ domains
try {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -256000'); // 256MB cache for large datasets
    db.pragma('temp_store = MEMORY'); // Store temp tables in memory
    db.pragma('mmap_size = 30000000000'); // 30GB memory-mapped I/O
    db.pragma('page_size = 8192'); // Larger page size for better performance

    // CRITICAL: Busy timeout - wait 10 seconds instead of failing immediately
    // This prevents "database is busy" errors during Bloom filter loading
    db.pragma('busy_timeout = 10000'); // 10 seconds

    console.log('[Database] ✓ Extreme optimizations applied (WAL, 256MB cache, busy_timeout=10s)');
} catch (error: any) {
    console.error('[Database] ✗ Failed to apply optimizations:', error.message);
}

// Migrate old tables to optimized versions WITH WITHOUT ROWID
const migrateToOptimized = () => {
    // Check if migration is needed
    const needsMigration = db.prepare(`
        SELECT sql FROM sqlite_master
        WHERE type='table' AND name='system_blocklist' AND sql NOT LIKE '%WITHOUT ROWID%'
    `).get();

    if (needsMigration) {
        console.log('[Database] Migrating to optimized schema (WITHOUT ROWID)...');

        const transaction = db.transaction(() => {
            // Backup and recreate system_blocklist
            db.exec(`
                CREATE TABLE IF NOT EXISTS system_blocklist_new (
                    domain TEXT PRIMARY KEY,
                    source_id TEXT,
                    added_at TEXT
                ) WITHOUT ROWID;

                INSERT OR IGNORE INTO system_blocklist_new SELECT * FROM system_blocklist;
                DROP TABLE system_blocklist;
                ALTER TABLE system_blocklist_new RENAME TO system_blocklist;
            `);

            // Backup and recreate system_whitelist
            db.exec(`
                CREATE TABLE IF NOT EXISTS system_whitelist_new (
                    domain TEXT PRIMARY KEY,
                    source_id TEXT,
                    added_at TEXT
                ) WITHOUT ROWID;

                INSERT OR IGNORE INTO system_whitelist_new SELECT * FROM system_whitelist;
                DROP TABLE system_whitelist;
                ALTER TABLE system_whitelist_new RENAME TO system_whitelist;
            `);

            // Backup and recreate url_blocklist
            db.exec(`
                CREATE TABLE IF NOT EXISTS url_blocklist_new (
                    url TEXT PRIMARY KEY,
                    source_id TEXT,
                    added_at TEXT
                ) WITHOUT ROWID;

                INSERT OR IGNORE INTO url_blocklist_new SELECT * FROM url_blocklist;
                DROP TABLE url_blocklist;
                ALTER TABLE url_blocklist_new RENAME TO url_blocklist;
            `);
        });

        try {
            transaction();
            console.log('[Database] ✓ Migration to WITHOUT ROWID completed successfully');
        } catch (error: any) {
            console.error('[Database] ✗ Migration failed:', error.message);
        }
    }
};

// Initialize Tables with optimized schema
try {
    console.log('[Database] Creating tables and indexes...');
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    type TEXT,
    domain TEXT,
    reason TEXT,
    method TEXT,
    duration INTEGER
  );

  CREATE TABLE IF NOT EXISTS blocklist_sources (
    id TEXT PRIMARY KEY,
    name TEXT,
    enabled INTEGER,
    url TEXT,
    lastUpdate TEXT,
    domainCount INTEGER,
    category TEXT,
    custom INTEGER
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS whitelist_sources (
    id TEXT PRIMARY KEY,
    name TEXT,
    enabled INTEGER,
    url TEXT,
    lastUpdate TEXT,
    domainCount INTEGER,
    category TEXT,
    custom INTEGER
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS user_blocklist (
    domain TEXT PRIMARY KEY,
    source TEXT,
    created_at TEXT
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS user_whitelist (
    domain TEXT PRIMARY KEY,
    source TEXT,
    created_at TEXT
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS system_blocklist (
    domain TEXT PRIMARY KEY,
    source_id TEXT,
    added_at TEXT
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS system_whitelist (
    domain TEXT PRIMARY KEY,
    source_id TEXT,
    added_at TEXT
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS url_blocklist (
    url TEXT PRIMARY KEY,
    source_id TEXT,
    added_at TEXT
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS analytics_hourly (
    timestamp TEXT PRIMARY KEY,
    blocked INTEGER DEFAULT 0,
    allowed INTEGER DEFAULT 0
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS threat_stats (
    domain TEXT PRIMARY KEY,
    hits INTEGER DEFAULT 0,
    category TEXT,
    last_seen TEXT
  ) WITHOUT ROWID;

  CREATE INDEX IF NOT EXISTS idx_system_blocklist_source ON system_blocklist(source_id);
  CREATE INDEX IF NOT EXISTS idx_system_whitelist_source ON system_whitelist(source_id);
  CREATE INDEX IF NOT EXISTS idx_url_blocklist_source ON url_blocklist(source_id);
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
`);

    // Run migration if needed
    migrateToOptimized();

    console.log('[Database] ✓ All tables and indexes created successfully (WITHOUT ROWID optimized)');
} catch (error: any) {
    console.error('[Database] ✗ Failed to create tables:', error.message);
    throw error;
}

// Initialize Stats if empty
console.log('[Database] Initializing stats...');
const initStats = db.prepare("INSERT OR IGNORE INTO stats (key, value) VALUES (?, ?)");
initStats.run('blockedToday', 0);
initStats.run('allowedToday', 0);
initStats.run('totalBlocked', 0);
initStats.run('totalAllowed', 0);
initStats.run('startTime', Date.now());

// ============================================================================
// STATS CACHE - TTL 30 seconds for performance (avoids recalculating on every call)
// ============================================================================
let statsCache: Stats | null = null;
let statsCacheTime = 0;
const STATS_CACHE_TTL = 30000; // 30 seconds

export const invalidateStatsCache = () => {
    statsCache = null;
    statsCacheTime = 0;
};

// Helper functions
export const getStats = (): Stats => {
    const now = Date.now();

    // Return cached stats if valid
    if (statsCache && (now - statsCacheTime) < STATS_CACHE_TTL) {
        // Update uptime in cached response
        return { ...statsCache, uptime: now - (statsCache as any)._startTime };
    }

    const getVal = db.prepare("SELECT value FROM stats WHERE key = ?");
    const blockedToday = getVal.get('blockedToday') as { value: number };
    const allowedToday = getVal.get('allowedToday') as { value: number };
    const totalBlocked = getVal.get('totalBlocked') as { value: number };
    const totalAllowed = getVal.get('totalAllowed') as { value: number };
    const startTime = getVal.get('startTime') as { value: number };

    const blocklistCount = db.prepare("SELECT SUM(domainCount) as count FROM blocklist_sources WHERE enabled = 1").get() as { count: number };
    const userBlockCount = db.prepare("SELECT COUNT(*) as count FROM user_blocklist").get() as { count: number };

    const whitelistCount = db.prepare("SELECT SUM(domainCount) as count FROM whitelist_sources WHERE enabled = 1").get() as { count: number };
    const userWhiteCount = db.prepare("SELECT COUNT(*) as count FROM user_whitelist").get() as { count: number };

    const result: Stats = {
        blockedToday: blockedToday?.value || 0,
        allowedToday: allowedToday?.value || 0,
        totalBlocked: totalBlocked?.value || 0,
        totalAllowed: totalAllowed?.value || 0,
        blocklistSize: (blocklistCount?.count || 0) + (userBlockCount?.count || 0),
        whitelistSize: (whitelistCount?.count || 0) + (userWhiteCount?.count || 0),
        proxyStatus: 'active',
        uptime: now - (startTime?.value || now),
        lastUpdate: new Date().toISOString()
    };

    // Cache the result
    statsCache = { ...result, _startTime: startTime?.value || now } as any;
    statsCacheTime = now;

    return result;
};

export const addLog = (log: LogEntry) => {
    try {
        // Use transaction for atomic operations
        const transaction = db.transaction(() => {
            const stmt = db.prepare("INSERT INTO logs (id, timestamp, type, domain, reason, method, duration) VALUES (@id, @timestamp, @type, @domain, @reason, @method, @duration)");
            stmt.run(log);

            // Update stats
            if (log.type === 'blocked') {
                db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'blockedToday'").run();
                db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'totalBlocked'").run();
            } else {
                db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'allowedToday'").run();
                db.prepare("UPDATE stats SET value = value + 1 WHERE key = 'totalAllowed'").run();
            }
        });

        transaction();
    } catch (error: any) {
        // If DB is busy, skip logging this event to avoid crashes
        // Logs are not critical - proxy operation is more important
        if (error.message?.includes('busy')) {
            // Silent skip - don't spam console
            return;
        }
        console.error('[Database] Failed to add log:', error.message);
    }
};

export const getLogs = (limit: number, offset: number, type?: string, search?: string): LogEntry[] => {
    let query = "SELECT * FROM logs";
    const params: any[] = [];
    const conditions: string[] = [];

    if (type) {
        conditions.push("type = ?");
        params.push(type);
    }
    if (search) {
        conditions.push("domain LIKE ?");
        params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return db.prepare(query).all(...params) as LogEntry[];
}

/**
 * Clean up old logs (older than 30 days)
 */
export const cleanupOldLogs = (): number => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.toISOString();

        const result = db.prepare("DELETE FROM logs WHERE timestamp < ?").run(cutoffDate);
        const deletedCount = result.changes;

        if (deletedCount > 0) {
            console.log(`[Database] Cleaned up ${deletedCount} old logs (>30 days)`);
        }

        return deletedCount;
    } catch (error) {
        console.error('[Database] Failed to cleanup old logs:', error);
        return 0;
    }
}

// Domain validation - supports domains, wildcards, IPs, and extracts domain from URLs
const DOMAIN_REGEX = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
const WILDCARD_REGEX = /^\*\.([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

/**
 * Normalize and validate domain input
 * Supports: domains, wildcards (*.example.com), IPs, and URLs (extracts domain)
 */
export const normalizeDomain = (input: string): string | null => {
    if (!input || typeof input !== 'string') return null;
    let cleaned = input.trim().toLowerCase();

    // Extract domain from URL if needed
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
        try {
            const url = new URL(cleaned);
            cleaned = url.hostname;
        } catch {
            return null;
        }
    }

    // Remove trailing slashes and paths
    cleaned = cleaned.split('/')[0];

    // Validate formats
    if (DOMAIN_REGEX.test(cleaned)) return cleaned;           // example.com
    if (WILDCARD_REGEX.test(cleaned)) return cleaned;         // *.example.com
    if (IP_REGEX.test(cleaned)) return cleaned;               // 192.168.1.1
    if (cleaned === 'localhost') return cleaned;              // localhost

    return null;
};

export const validateDomain = (domain: string): boolean => {
    return normalizeDomain(domain) !== null;
};

// Blocklist/Whitelist Source management
export const getBlocklistSources = (): BlocklistSource[] => {
    return db.prepare("SELECT * FROM blocklist_sources").all().map((r: any) => ({ ...r, enabled: !!r.enabled, custom: !!r.custom })) as BlocklistSource[];
};

export const toggleBlocklistSource = (id: string, enabled: boolean) => {
    try {
        db.prepare("UPDATE blocklist_sources SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
        refreshEnabledSourcesCache(); // Refresh cache after toggle
    } catch (error: any) {
        if (!error.message?.includes('busy')) {
            console.error('[Database] Failed to toggle blocklist source:', error.message);
        }
        throw error;
    }
};

export const addBlocklistSource = (source: BlocklistSource) => {
    try {
        db.prepare("INSERT INTO blocklist_sources (id, name, enabled, url, lastUpdate, domainCount, category, custom) VALUES (@id, @name, @enabled, @url, @lastUpdate, @domainCount, @category, @custom)").run({ ...source, enabled: source.enabled ? 1 : 0, custom: source.custom ? 1 : 0 });
        refreshEnabledSourcesCache(); // Refresh cache after adding
    } catch (error: any) {
        if (!error.message?.includes('busy')) {
            console.error('[Database] Failed to add blocklist source:', error.message);
        }
        throw error;
    }
};

export const removeBlocklistSource = (id: string) => {
    try {
        db.prepare("DELETE FROM blocklist_sources WHERE id = ?").run(id);
        refreshEnabledSourcesCache(); // Refresh cache after removing
    } catch (error: any) {
        if (!error.message?.includes('busy')) {
            console.error('[Database] Failed to remove blocklist source:', error.message);
        }
        throw error;
    }
};

export const getWhitelistSources = (): WhitelistSource[] => {
    return db.prepare("SELECT * FROM whitelist_sources").all().map((r: any) => ({ ...r, enabled: !!r.enabled, custom: !!r.custom })) as WhitelistSource[];
};

export const toggleWhitelistSource = (id: string, enabled: boolean) => {
    try {
        db.prepare("UPDATE whitelist_sources SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
        refreshEnabledSourcesCache(); // Refresh cache after toggle
    } catch (error: any) {
        if (!error.message?.includes('busy')) {
            console.error('[Database] Failed to toggle whitelist source:', error.message);
        }
        throw error;
    }
};

export const addWhitelistSource = (source: WhitelistSource) => {
    try {
        db.prepare("INSERT INTO whitelist_sources (id, name, enabled, url, lastUpdate, domainCount, category, custom) VALUES (@id, @name, @enabled, @url, @lastUpdate, @domainCount, @category, @custom)").run({ ...source, enabled: source.enabled ? 1 : 0, custom: source.custom ? 1 : 0 });
        refreshEnabledSourcesCache(); // Refresh cache after adding
    } catch (error: any) {
        if (!error.message?.includes('busy')) {
            console.error('[Database] Failed to add whitelist source:', error.message);
        }
        throw error;
    }
};

export const removeWhitelistSource = (id: string) => {
    try {
        db.prepare("DELETE FROM whitelist_sources WHERE id = ?").run(id);
        refreshEnabledSourcesCache(); // Refresh cache after removing
    } catch (error: any) {
        if (!error.message?.includes('busy')) {
            console.error('[Database] Failed to remove whitelist source:', error.message);
        }
        throw error;
    }
};

// User Blocklist/Whitelist entries
export const getUserBlocklist = (): BlocklistEntry[] => {
    return db.prepare("SELECT * FROM user_blocklist ORDER BY created_at DESC").all() as BlocklistEntry[];
};

export const addUserBlocklist = (domain: string) => {
    const normalized = normalizeDomain(domain);
    if (!normalized) {
        throw new Error(`Invalid domain format: ${domain}`);
    }
    try {
        db.prepare("INSERT OR IGNORE INTO user_blocklist (domain, source, created_at) VALUES (?, 'user', ?)").run(normalized, new Date().toISOString());
    } catch (error: any) {
        if (!error.message?.includes('busy')) {
            console.error('[Database] Failed to add user blocklist:', error.message);
        }
        throw error;
    }
};

export const removeUserBlocklist = (domain: string) => {
    try {
        db.prepare("DELETE FROM user_blocklist WHERE domain = ?").run(domain);
    } catch (error: any) {
        if (!error.message?.includes('busy')) {
            console.error('[Database] Failed to remove user blocklist:', error.message);
        }
        throw error;
    }
};

export const getUserWhitelist = (): WhitelistEntry[] => {
    return db.prepare("SELECT * FROM user_whitelist ORDER BY created_at DESC").all() as WhitelistEntry[];
};

export const addUserWhitelist = (domain: string) => {
    const normalized = normalizeDomain(domain);
    if (!normalized) {
        throw new Error(`Invalid domain format: ${domain}`);
    }
    try {
        db.prepare("INSERT OR IGNORE INTO user_whitelist (domain, source, created_at) VALUES (?, 'user', ?)").run(normalized, new Date().toISOString());
    } catch (error: any) {
        if (!error.message?.includes('busy')) {
            console.error('[Database] Failed to add user whitelist:', error.message);
        }
        throw error;
    }
};

export const removeUserWhitelist = (domain: string) => {
    try {
        db.prepare("DELETE FROM user_whitelist WHERE domain = ?").run(domain);
    } catch (error: any) {
        if (!error.message?.includes('busy')) {
            console.error('[Database] Failed to remove user whitelist:', error.message);
        }
        throw error;
    }
};

/**
 * Initialize system whitelist with essential domains for CalmWeb to function
 * These domains are required for the app's UI and updates
 */
export const initializeSystemWhitelist = () => {
    const essentialDomains = [
        // CDN for Tailwind CSS (used by frontend)
        'cdn.tailwindcss.com',

        // Google Fonts (used by frontend)
        'fonts.googleapis.com',
        'fonts.gstatic.com',

        // GitHub (for updates)
        'github.com',
        'api.github.com',
        'raw.githubusercontent.com',
        'objects.githubusercontent.com',

        // Localhost (for development)
        'localhost',
        '127.0.0.1',

        // Common CDNs for updates
        'cdnjs.cloudflare.com',
        'unpkg.com',
        'jsdelivr.net',
        'cdn.jsdelivr.net'
    ];

    try {
        // Use INSERT OR REPLACE to ensure system domains are always present
        // even if user previously deleted them or DB was corrupted
        const stmt = db.prepare("INSERT OR REPLACE INTO user_whitelist (domain, source, created_at) VALUES (?, 'system', ?)");
        const now = new Date().toISOString();

        const transaction = db.transaction((domains: string[]) => {
            for (const domain of domains) {
                stmt.run(domain, now);
            }
        });

        transaction(essentialDomains);

        // Verify insertion
        const count = db.prepare("SELECT COUNT(*) as count FROM user_whitelist WHERE source = 'system'").get() as { count: number };
        logger.info(`[Database] ✓ System whitelist initialized: ${count.count} essential domains in database`);
        logger.info(`[Database] System whitelist domains: ${essentialDomains.join(', ')}`);

        // Clear proxy cache to ensure whitelist takes effect immediately
        try {
            const { clearDomainCache } = require('./proxy');
            clearDomainCache();
            logger.info('[Database] ✓ Proxy cache cleared after whitelist update');
        } catch (e) {
            // Proxy module might not be loaded yet at startup, that's OK
        }
    } catch (error: any) {
        logger.error('[Database] ✗ Failed to initialize system whitelist:', error.message);
        logger.error('[Database] Stack:', error.stack);
    }
};


// Seed initial data - always ensure the 8 main lists exist
const seedData = () => {
    const sources = [
        {
            id: 'urlhaus',
            name: 'URLhaus - Active Malware URLs',
            enabled: 1,
            url: 'https://urlhaus.abuse.ch/downloads/text/',
            lastUpdate: new Date().toISOString(),
            domainCount: 0,
            category: 'Malware URLs',
            custom: 0
        },
        {
            id: 'openphish',
            name: 'OpenPhish - Verified Phishing URLs',
            enabled: 1,
            url: 'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt',
            lastUpdate: new Date().toISOString(),
            domainCount: 0,
            category: 'Phishing URLs',
            custom: 0
        },
        {
            id: 'hagezi_tif',
            name: 'HaGeZi - Threat Intelligence Feeds',
            enabled: 1,
            url: 'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/domains/tif.txt',
            lastUpdate: new Date().toISOString(),
            domainCount: 0,
            category: 'Multi-Threat',
            custom: 0
        },
        {
            id: 'remote_desktop',
            name: 'Remote Desktop Blocker',
            enabled: 1,
            url: 'https://raw.githubusercontent.com/ostend972/Calm-Web-Blockliste/refs/heads/main/REMOTE%20DESKTOP%20BLOCKER',
            lastUpdate: new Date().toISOString(),
            domainCount: 0,
            category: 'Remote Access',
            custom: 0
        },
        {
            id: 'red_flag',
            name: 'Red Flag Domains',
            enabled: 1,
            url: 'https://dl.red.flag.domains/red.flag.domains.txt',
            lastUpdate: new Date().toISOString(),
            domainCount: 0,
            category: 'Scams & Traps',
            custom: 0
        },
        {
            id: 'hagezi_fake',
            name: 'HaGeZi - Fake (Scams & Fakes)',
            enabled: 1,
            url: 'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/adblock/fake.txt',
            lastUpdate: new Date().toISOString(),
            domainCount: 0,
            category: 'Fake Sites',
            custom: 0
        },
        {
            id: 'hagezi_nrd',
            name: 'HaGeZi - Newly Registered Domains',
            enabled: 1,
            url: 'https://cdn.jsdelivr.net/gh/hagezi/dns-blocklists@latest/domains/nrd7.txt',
            lastUpdate: new Date().toISOString(),
            domainCount: 0,
            category: 'Suspicious Domains',
            custom: 0
        }
    ];

    // Use REPLACE to update existing lists with new URLs/names
    const insert = db.prepare("INSERT OR REPLACE INTO blocklist_sources (id, name, enabled, url, lastUpdate, domainCount, category, custom) VALUES (@id, @name, @enabled, @url, @lastUpdate, @domainCount, @category, @custom)");
    sources.forEach(s => insert.run(s));

    // Remove old 'stevenblack' list if it exists
    db.prepare("DELETE FROM blocklist_sources WHERE id = ?").run('stevenblack');
};

seedData();
initializeSystemWhitelist(); // Add essential domains for CalmWeb to function

// In-memory cache for enabled source IDs (avoids JOIN queries)
let enabledBlocklistSources: Set<string> = new Set();
let enabledWhitelistSources: Set<string> = new Set();

// Refresh cache of enabled sources
const refreshEnabledSourcesCache = () => {
    const blockSources = db.prepare("SELECT id FROM blocklist_sources WHERE enabled = 1").all() as Array<{ id: string }>;
    const whiteSources = db.prepare("SELECT id FROM whitelist_sources WHERE enabled = 1").all() as Array<{ id: string }>;

    enabledBlocklistSources = new Set(blockSources.map(s => s.id));
    enabledWhitelistSources = new Set(whiteSources.map(s => s.id));

    console.log(`[Database] Cache refreshed: ${enabledBlocklistSources.size} blocklist sources, ${enabledWhitelistSources.size} whitelist sources enabled`);
};

// Initialize cache on startup
refreshEnabledSourcesCache();

// Override toggle functions to refresh cache
const originalToggleBlocklist = toggleBlocklistSource;
const originalToggleWhitelist = toggleWhitelistSource;

export { originalToggleBlocklist, originalToggleWhitelist };

// Simple SQLite approach with prepared statements (like CalmWeb-Clean)
// No Bloom filter - SQLite is fast enough with proper indexing + busy_timeout

// Read-only database for faster lookups
import { initReadonlyStatements, readonlyLookups, closeReadonlyDB } from './database-readonly';

// Initialize read-only DB after a delay (let main DB initialize first)
setTimeout(() => {
    try {
        initReadonlyStatements();
        console.log('[Database] ✓ Read-only lookups available');
    } catch (error) {
        console.log('[Database] Read-only DB not yet available, will use main DB');
    }
}, 3000);

// Initialize Bloom filters with all domains (NON-BLOCKING)
const refreshBloomFilters = async () => {
    console.log('[Database] Refreshing Bloom filters (async)...');
    const startTime = Date.now();

    try {
        // Use streaming approach to avoid blocking
        // Count first to allocate properly
        const blockCount = db.prepare(`
            SELECT COUNT(DISTINCT domain) as count FROM system_blocklist sb
            JOIN blocklist_sources bs ON sb.source_id = bs.id
            WHERE bs.enabled = 1
        `).get() as any;

        const whiteCount = db.prepare(`
            SELECT COUNT(DISTINCT domain) as count FROM system_whitelist sw
            JOIN whitelist_sources ws ON sw.source_id = ws.id
            WHERE ws.enabled = 1
        `).get() as any;

        const userBlockCount = db.prepare('SELECT COUNT(*) as count FROM user_blocklist').get() as any;
        const userWhiteCount = db.prepare('SELECT COUNT(*) as count FROM user_whitelist').get() as any;

        console.log('[Database] Domain counts:', {
            systemBlock: blockCount.count,
            systemWhite: whiteCount.count,
            userBlock: userBlockCount.count,
            userWhite: userWhiteCount.count
        });

        // Pre-allocate arrays with known size for better performance
        const blocklistDomains: string[] = [];
        const whitelistDomains: string[] = [];

        // Stream blocklist domains in chunks of 100k to avoid memory spike
        const blockStmt = db.prepare(`
            SELECT DISTINCT domain FROM system_blocklist sb
            JOIN blocklist_sources bs ON sb.source_id = bs.id
            WHERE bs.enabled = 1
        `);

        for (const row of blockStmt.iterate()) {
            blocklistDomains.push((row as any).domain);

            // Yield to event loop every 50k domains to keep app responsive
            if (blocklistDomains.length % 50000 === 0) {
                console.log(`[Database] Loaded ${blocklistDomains.length} blocklist domains...`);
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        // Stream whitelist domains
        const whiteStmt = db.prepare(`
            SELECT DISTINCT domain FROM system_whitelist sw
            JOIN whitelist_sources ws ON sw.source_id = ws.id
            WHERE ws.enabled = 1
        `);

        for (const row of whiteStmt.iterate()) {
            whitelistDomains.push((row as any).domain);

            if (whitelistDomains.length % 50000 === 0) {
                console.log(`[Database] Loaded ${whitelistDomains.length} whitelist domains...`);
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        // Add user lists (usually small, no need to stream)
        const userBlocklist = db.prepare('SELECT domain FROM user_blocklist').all().map((r: any) => r.domain);
        const userWhitelist = db.prepare('SELECT domain FROM user_whitelist').all().map((r: any) => r.domain);

        console.log('[Database] All domains loaded in SQLite');

        const totalTime = Date.now() - startTime;
        console.log(`[Database] ✓ Database ready in ${totalTime}ms`);
    } catch (error: any) {
        console.error('[Database] ✗ Failed to refresh Bloom filters:', error.message);
    }
};

// SQLite with proper indexing is fast enough - no Bloom filter needed
// busy_timeout ensures no crashes during concurrent access
console.log('[Database] ✓ Ready - using direct SQLite lookups with prepared statements');

// Blocklist Update Functions
export const updateBlocklistEntries = async (sourceId: string, domains: string[], urls: string[]) => {
    const transaction = db.transaction(() => {
        // Remove old entries for this source
        db.prepare("DELETE FROM system_blocklist WHERE source_id = ?").run(sourceId);
        db.prepare("DELETE FROM url_blocklist WHERE source_id = ?").run(sourceId);

        const now = new Date().toISOString();

        // Insert domains with anti-duplicate (batch insert for better performance)
        const uniqueDomains = [...new Set(domains)];
        const insertDomain = db.prepare("INSERT OR IGNORE INTO system_blocklist (domain, source_id, added_at) VALUES (?, ?, ?)");
        for (const domain of uniqueDomains) {
            insertDomain.run(domain, sourceId, now);
        }

        // Insert URLs with anti-duplicate (batch insert for better performance)
        const uniqueUrls = [...new Set(urls)];
        const insertUrl = db.prepare("INSERT OR IGNORE INTO url_blocklist (url, source_id, added_at) VALUES (?, ?, ?)");
        for (const url of uniqueUrls) {
            insertUrl.run(url, sourceId, now);
        }

        // Update source metadata
        const totalCount = uniqueDomains.length + uniqueUrls.length;
        db.prepare("UPDATE blocklist_sources SET lastUpdate = ?, domainCount = ? WHERE id = ?")
            .run(now, totalCount, sourceId);
    });

    transaction();
    console.log(`[Database] Updated ${domains.length} domains and ${urls.length} URLs for source ${sourceId}`);

    // Cache refreshed automatically by SQLite
};

// Keep old function for backward compatibility
export const updateBlocklistDomains = (sourceId: string, domains: string[]) => {
    updateBlocklistEntries(sourceId, domains, []);
};

export const updateWhitelistDomains = async (sourceId: string, domains: string[]) => {
    const transaction = db.transaction(() => {
        db.prepare("DELETE FROM system_whitelist WHERE source_id = ?").run(sourceId);

        const insert = db.prepare("INSERT OR IGNORE INTO system_whitelist (domain, source_id, added_at) VALUES (?, ?, ?)");
        const now = new Date().toISOString();
        for (const domain of domains) {
            insert.run(domain, sourceId, now);
        }

        db.prepare("UPDATE whitelist_sources SET lastUpdate = ?, domainCount = ? WHERE id = ?")
            .run(now, domains.length, sourceId);
    });

    transaction();

    // Cache refreshed automatically by SQLite
};

// Optimized prepared statements (created once, reused millions of times)
const stmtUserBlock = db.prepare("SELECT 1 FROM user_blocklist WHERE domain = ? LIMIT 1");
const stmtSystemBlock = db.prepare("SELECT source_id FROM system_blocklist WHERE domain = ? LIMIT 1");
const stmtSystemBlockWildcards = db.prepare("SELECT domain, source_id FROM system_blocklist WHERE domain LIKE '*.%'");
const stmtUserWhite = db.prepare("SELECT 1 FROM user_whitelist WHERE domain = ? LIMIT 1");
const stmtSystemWhite = db.prepare("SELECT source_id FROM system_whitelist WHERE domain = ? LIMIT 1");
const stmtSystemWhiteWildcards = db.prepare("SELECT domain, source_id FROM system_whitelist WHERE domain LIKE '*.%'");
const stmtUrlBlock = db.prepare("SELECT source_id FROM url_blocklist WHERE url = ? LIMIT 1");

/**
 * Check if a domain matches a wildcard pattern
 * Examples:
 *   matchesDomainPattern("www.teamviewer.com", "*.teamviewer.com") → true
 *   matchesDomainPattern("teamviewer.com", "*.teamviewer.com") → true
 *   matchesDomainPattern("evil.com", "*.teamviewer.com") → false
 */
const matchesDomainPattern = (domain: string, pattern: string): boolean => {
    // Exact match
    if (domain === pattern) return true;

    // Wildcard match: *.example.com
    if (pattern.startsWith('*.')) {
        const baseDomain = pattern.substring(2); // Remove "*."
        // Match base domain itself OR any subdomain
        return domain === baseDomain || domain.endsWith('.' + baseDomain);
    }

    return false;
};

export const isDomainBlocked = (domain: string): boolean => {
    // STEP 1: Check exact match in user blocklist (fast, PRIMARY KEY index)
    if (stmtUserBlock.get(domain)) return true;

    // STEP 1b: Check user wildcards (e.g., user added *.example.com)
    const userWildcards = db.prepare("SELECT domain FROM user_blocklist WHERE domain LIKE '*.%'").all() as Array<{ domain: string }>;
    for (const wildcard of userWildcards) {
        if (matchesDomainPattern(domain, wildcard.domain)) {
            return true;
        }
    }

    // STEP 2: Check exact match in system blocklist (fast, prepared statement + in-memory cache)
    const result = stmtSystemBlock.get(domain) as { source_id: string } | undefined;
    if (result && enabledBlocklistSources.has(result.source_id)) {
        return true;
    }

    // STEP 3: Check wildcard patterns (e.g., *.teamviewer.com)
    const wildcards = stmtSystemBlockWildcards.all() as Array<{ domain: string; source_id: string }>;
    for (const wildcard of wildcards) {
        // Only check if source is enabled
        if (enabledBlocklistSources.has(wildcard.source_id)) {
            if (matchesDomainPattern(domain, wildcard.domain)) {
                return true;
            }
        }
    }

    return false;
};

export const isDomainWhitelisted = (domain: string): boolean => {
    // STEP 1: Check exact match in user whitelist (fast, PRIMARY KEY index)
    if (stmtUserWhite.get(domain)) return true;

    // STEP 1b: Check user wildcards (e.g., user added *.example.com)
    const userWildcards = db.prepare("SELECT domain FROM user_whitelist WHERE domain LIKE '*.%'").all() as Array<{ domain: string }>;
    for (const wildcard of userWildcards) {
        if (matchesDomainPattern(domain, wildcard.domain)) {
            return true;
        }
    }

    // STEP 2: Check exact match in system whitelist (fast, prepared statement + in-memory cache)
    const result = stmtSystemWhite.get(domain) as { source_id: string } | undefined;
    if (result && enabledWhitelistSources.has(result.source_id)) {
        return true;
    }

    // STEP 3: Check wildcard patterns (e.g., *.github.com)
    const wildcards = stmtSystemWhiteWildcards.all() as Array<{ domain: string; source_id: string }>;
    for (const wildcard of wildcards) {
        // Only check if source is enabled
        if (enabledWhitelistSources.has(wildcard.source_id)) {
            if (matchesDomainPattern(domain, wildcard.domain)) {
                return true;
            }
        }
    }

    return false;
};

export const isUrlBlocked = (fullUrl: string): boolean => {
    // Check exact URL match WITHOUT JOIN (use in-memory cache instead)
    const result = stmtUrlBlock.get(fullUrl) as { source_id: string } | undefined;
    if (result && enabledBlocklistSources.has(result.source_id)) {
        return true;
    }

    return false;
};

// Analytics Functions
export const updateHourlyStats = (type: 'blocked' | 'allowed') => {
    try {
        const now = new Date();
        const hourTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:00:00`;

        // Use transaction for atomic operations
        const transaction = db.transaction(() => {
            const existing = db.prepare("SELECT * FROM analytics_hourly WHERE timestamp = ?").get(hourTimestamp) as { timestamp: string; blocked: number; allowed: number } | undefined;

            if (existing) {
                if (type === 'blocked') {
                    db.prepare("UPDATE analytics_hourly SET blocked = blocked + 1 WHERE timestamp = ?").run(hourTimestamp);
                } else {
                    db.prepare("UPDATE analytics_hourly SET allowed = allowed + 1 WHERE timestamp = ?").run(hourTimestamp);
                }
            } else {
                db.prepare("INSERT INTO analytics_hourly (timestamp, blocked, allowed) VALUES (?, ?, ?)").run(
                    hourTimestamp,
                    type === 'blocked' ? 1 : 0,
                    type === 'allowed' ? 1 : 0
                );
            }
        });

        transaction();
    } catch (error: any) {
        // If DB is busy, skip updating hourly stats to avoid crashes
        if (error.message?.includes('busy')) {
            return; // Silent skip
        }
        console.error('[Database] Failed to update hourly stats:', error.message);
    }
};

export const getHourlyAnalytics = (hours: number = 13): Array<{ time: string; blocked: number; allowed: number }> => {
    const result = db.prepare(`
        SELECT timestamp, blocked, allowed 
        FROM analytics_hourly 
        ORDER BY timestamp DESC 
        LIMIT ?
    `).all(hours) as Array<{ timestamp: string; blocked: number; allowed: number }>;

    // Format for chart (reverse to show oldest first)
    return result.reverse().map(row => ({
        time: new Date(row.timestamp).getHours() + ':00',
        blocked: row.blocked,
        allowed: row.allowed
    }));
};

export const getDailyAnalytics = (days: number = 7): Array<{ day: string; blocked: number; allowed: number }> => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const result = db.prepare(`
        SELECT 
            DATE(timestamp) as date,
            SUM(blocked) as blocked,
            SUM(allowed) as allowed
        FROM analytics_hourly
        WHERE timestamp >= datetime('now', ? || ' days')
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
    `).all(`-${days}`) as Array<{ date: string; blocked: number; allowed: number }>;

    return result.map(row => ({
        day: dayNames[new Date(row.date).getDay()],
        blocked: row.blocked,
        allowed: row.allowed
    }));
};

const categorizeBlocked = (domain: string): string => {
    if (/analytics|tracking|pixel|beacon|telemetry/.test(domain)) return 'Tracker';
    if (/ads?|doubleclick|adservice|advertising/.test(domain)) return 'Ad';
    if (/malware|phish|scam|virus|trojan/.test(domain)) return 'Malware';
    if (/facebook|twitter|social|instagram/.test(domain)) return 'Social';
    return 'Other';
};

export const updateThreatStats = (domain: string) => {
    try {
        const category = categorizeBlocked(domain);
        const now = new Date().toISOString();

        // Use transaction for atomic operations
        const transaction = db.transaction(() => {
            const existing = db.prepare("SELECT * FROM threat_stats WHERE domain = ?").get(domain) as { domain: string; hits: number; category: string } | undefined;

            if (existing) {
                db.prepare("UPDATE threat_stats SET hits = hits + 1, last_seen = ? WHERE domain = ?").run(now, domain);
            } else {
                db.prepare("INSERT INTO threat_stats (domain, hits, category, last_seen) VALUES (?, ?, ?, ?)").run(domain, 1, category, now);
            }
        });

        transaction();
    } catch (error: any) {
        // If DB is busy, skip updating threat stats to avoid crashes
        if (error.message?.includes('busy')) {
            return; // Silent skip
        }
        console.error('[Database] Failed to update threat stats:', error.message);
    }
};

export const getTopThreats = (limit: number = 5): Array<{ domain: string; hits: number; category: string; lastSeen: string }> => {
    const result = db.prepare(`
        SELECT domain, hits, category, last_seen as lastSeen
        FROM threat_stats
        ORDER BY hits DESC
        LIMIT ?
    `).all(limit) as Array<{ domain: string; hits: number; category: string; lastSeen: string }>;

    return result;
};

// ============================================================================
// CONFLICT DETECTION - Whitelist vs Blocklist
// ============================================================================

export interface ListConflict {
    domain: string;
    inWhitelist: 'user' | 'system';
    inBlocklist: 'user' | 'system';
    recommendation: string;
}

/**
 * Detect domains that are in both whitelist and blocklist
 * This can cause unexpected behavior where whitelist takes priority
 */
export const detectListConflicts = (): ListConflict[] => {
    const conflicts: ListConflict[] = [];

    try {
        // Check user blocklist against user whitelist
        const userConflicts = db.prepare(`
            SELECT ub.domain
            FROM user_blocklist ub
            INNER JOIN user_whitelist uw ON ub.domain = uw.domain
        `).all() as Array<{ domain: string }>;

        for (const row of userConflicts) {
            conflicts.push({
                domain: row.domain,
                inWhitelist: 'user',
                inBlocklist: 'user',
                recommendation: 'Remove from one list - whitelist takes priority'
            });
        }

        // Check user blocklist against system whitelist
        const userBlockSystemWhite = db.prepare(`
            SELECT ub.domain
            FROM user_blocklist ub
            INNER JOIN system_whitelist sw ON ub.domain = sw.domain
            INNER JOIN whitelist_sources ws ON sw.source_id = ws.id
            WHERE ws.enabled = 1
        `).all() as Array<{ domain: string }>;

        for (const row of userBlockSystemWhite) {
            conflicts.push({
                domain: row.domain,
                inWhitelist: 'system',
                inBlocklist: 'user',
                recommendation: 'Your block rule will be ignored - domain is system whitelisted'
            });
        }

        // Check system blocklist against user whitelist
        const systemBlockUserWhite = db.prepare(`
            SELECT sb.domain
            FROM system_blocklist sb
            INNER JOIN user_whitelist uw ON sb.domain = uw.domain
            INNER JOIN blocklist_sources bs ON sb.source_id = bs.id
            WHERE bs.enabled = 1 AND uw.source != 'system'
        `).all() as Array<{ domain: string }>;

        for (const row of systemBlockUserWhite) {
            conflicts.push({
                domain: row.domain,
                inWhitelist: 'user',
                inBlocklist: 'system',
                recommendation: 'Domain will be allowed - your whitelist takes priority'
            });
        }

        console.log(`[Database] Conflict detection found ${conflicts.length} conflicts`);
        return conflicts;

    } catch (error: any) {
        console.error('[Database] Failed to detect conflicts:', error.message);
        return [];
    }
};

/**
 * Check if a specific domain has a conflict before adding
 */
export const checkDomainConflict = (domain: string, targetList: 'whitelist' | 'blocklist'): {
    hasConflict: boolean;
    conflictSource?: string;
    message?: string;
} => {
    try {
        if (targetList === 'whitelist') {
            // Check if domain is in blocklist
            const userBlock = db.prepare("SELECT 1 FROM user_blocklist WHERE domain = ?").get(domain);
            if (userBlock) {
                return {
                    hasConflict: true,
                    conflictSource: 'user_blocklist',
                    message: 'This domain is in your blocklist. Adding to whitelist will allow it.'
                };
            }

            const systemBlock = db.prepare(`
                SELECT 1 FROM system_blocklist sb
                INNER JOIN blocklist_sources bs ON sb.source_id = bs.id
                WHERE sb.domain = ? AND bs.enabled = 1
            `).get(domain);
            if (systemBlock) {
                return {
                    hasConflict: true,
                    conflictSource: 'system_blocklist',
                    message: 'This domain is blocked by a protection list. Adding to whitelist will override the protection.'
                };
            }
        } else {
            // Check if domain is in whitelist
            const userWhite = db.prepare("SELECT 1 FROM user_whitelist WHERE domain = ?").get(domain);
            if (userWhite) {
                return {
                    hasConflict: true,
                    conflictSource: 'user_whitelist',
                    message: 'This domain is in your whitelist. It will still be allowed despite being in blocklist.'
                };
            }

            const systemWhite = db.prepare(`
                SELECT 1 FROM system_whitelist sw
                INNER JOIN whitelist_sources ws ON sw.source_id = ws.id
                WHERE sw.domain = ? AND ws.enabled = 1
            `).get(domain);
            if (systemWhite) {
                return {
                    hasConflict: true,
                    conflictSource: 'system_whitelist',
                    message: 'This domain is system whitelisted. Your block rule will be ignored.'
                };
            }
        }

        return { hasConflict: false };

    } catch (error: any) {
        console.error('[Database] Failed to check domain conflict:', error.message);
        return { hasConflict: false };
    }
};

export default db;
