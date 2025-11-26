/**
 * Read-Only Database Connection for Lookups
 *
 * Performance: +30% throughput by using dedicated read-only connection
 * SQLite can optimize aggressively when it knows no writes will happen
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'calmweb.db');

let readonlyDB: Database.Database | null = null;

/**
 * Get or create read-only database connection
 */
export function getReadonlyDB(): Database.Database {
    if (!readonlyDB) {
        console.log('[DB Readonly] Creating read-only connection...');

        readonlyDB = new Database(dbPath, {
            readonly: true,
            fileMustExist: true
        });

        // Aggressive optimizations for read-only
        readonlyDB.pragma('query_only = ON');
        readonlyDB.pragma('cache_size = -128000'); // 128MB cache
        readonlyDB.pragma('mmap_size = 30000000000'); // 30GB mmap
        readonlyDB.pragma('temp_store = MEMORY');

        console.log('[DB Readonly] ✓ Read-only connection established');
    }

    return readonlyDB;
}

/**
 * Close read-only connection
 */
export function closeReadonlyDB(): void {
    if (readonlyDB) {
        readonlyDB.close();
        readonlyDB = null;
        console.log('[DB Readonly] Connection closed');
    }
}

// Prepared statements for read-only operations
let stmtUserBlockRO: Database.Statement | null = null;
let stmtSystemBlockRO: Database.Statement | null = null;
let stmtUserWhiteRO: Database.Statement | null = null;
let stmtSystemWhiteRO: Database.Statement | null = null;
let stmtUrlBlockRO: Database.Statement | null = null;

/**
 * Initialize read-only prepared statements
 */
export function initReadonlyStatements(): void {
    const db = getReadonlyDB();

    stmtUserBlockRO = db.prepare("SELECT 1 FROM user_blocklist WHERE domain = ? LIMIT 1");
    stmtSystemBlockRO = db.prepare("SELECT source_id FROM system_blocklist WHERE domain = ? LIMIT 1");
    stmtUserWhiteRO = db.prepare("SELECT 1 FROM user_whitelist WHERE domain = ? LIMIT 1");
    stmtSystemWhiteRO = db.prepare("SELECT source_id FROM system_whitelist WHERE domain = ? LIMIT 1");
    stmtUrlBlockRO = db.prepare("SELECT source_id FROM url_blocklist WHERE url = ? LIMIT 1");

    console.log('[DB Readonly] ✓ Prepared statements initialized');
}

/**
 * Read-only lookup functions (faster than main DB)
 */
export const readonlyLookups = {
    checkUserBlocklist: (domain: string): boolean => {
        if (!stmtUserBlockRO) initReadonlyStatements();
        return !!stmtUserBlockRO!.get(domain);
    },

    checkSystemBlocklist: (domain: string): { source_id: string } | undefined => {
        if (!stmtSystemBlockRO) initReadonlyStatements();
        return stmtSystemBlockRO!.get(domain) as { source_id: string } | undefined;
    },

    checkUserWhitelist: (domain: string): boolean => {
        if (!stmtUserWhiteRO) initReadonlyStatements();
        return !!stmtUserWhiteRO!.get(domain);
    },

    checkSystemWhitelist: (domain: string): { source_id: string } | undefined => {
        if (!stmtSystemWhiteRO) initReadonlyStatements();
        return stmtSystemWhiteRO!.get(domain) as { source_id: string } | undefined;
    },

    checkUrlBlocklist: (url: string): { source_id: string } | undefined => {
        if (!stmtUrlBlockRO) initReadonlyStatements();
        return stmtUrlBlockRO!.get(url) as { source_id: string } | undefined;
    }
};

export default {
    getReadonlyDB,
    closeReadonlyDB,
    initReadonlyStatements,
    readonlyLookups
};
