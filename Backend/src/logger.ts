/**
 * Simple in-memory logger for system events
 */

const MAX_LOGS = 500; // Keep last 500 logs in memory
const systemLogs: string[] = [];

// Save original console methods to avoid infinite recursion
const originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    debug: console.debug.bind(console)
};

/**
 * Log levels
 */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

// Log level priority for filtering
const LOG_LEVELS: Record<LogLevel, number> = {
    'ERROR': 0,
    'WARN': 1,
    'INFO': 2,
    'DEBUG': 3
};

/**
 * Check if message should be logged based on configured log level
 */
function shouldLog(messageLevel: LogLevel): boolean {
    try {
        // Lazy import to avoid circular dependencies
        const storeModule = require('./store');
        const store = storeModule.default;
        const configuredLevel = (store as any).get('logLevel') || 'INFO';
        return LOG_LEVELS[messageLevel] <= LOG_LEVELS[configuredLevel as LogLevel];
    } catch (e) {
        // If store not available, log everything
        return true;
    }
}

/**
 * Add a log entry
 */
export function log(level: LogLevel, message: string, ...args: any[]) {
    // Check if we should log this message based on configured level
    if (!shouldLog(level)) {
        return; // Skip logging
    }

    const timestamp = new Date().toISOString();

    // Format arguments properly - stringify objects for readability
    const formattedArgs = args.length > 0 ? ' ' + args.map(a => {
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        if (typeof a === 'object') {
            try {
                return JSON.stringify(a);
            } catch (e) {
                return String(a);
            }
        }
        return String(a);
    }).join(' ') : '';

    const logEntry = `[${timestamp}] [${level}] ${message}${formattedArgs}`;

    // Add to in-memory array
    systemLogs.push(logEntry);

    // Trim if exceeds max
    if (systemLogs.length > MAX_LOGS) {
        systemLogs.shift(); // Remove oldest
    }

    // Use ORIGINAL console methods to avoid infinite recursion
    const consoleMethod = level === 'ERROR' ? originalConsole.error :
                         level === 'WARN' ? originalConsole.warn :
                         level === 'DEBUG' ? originalConsole.debug : originalConsole.log;
    consoleMethod(logEntry);
}

/**
 * Convenience methods
 */
export const logger = {
    info: (message: string, ...args: any[]) => log('INFO', message, ...args),
    warn: (message: string, ...args: any[]) => log('WARN', message, ...args),
    error: (message: string, ...args: any[]) => log('ERROR', message, ...args),
    debug: (message: string, ...args: any[]) => log('DEBUG', message, ...args),
};

/**
 * Get all logs
 */
export function getSystemLogs(): string[] {
    return [...systemLogs]; // Return a copy
}

/**
 * Clear all logs
 */
export function clearSystemLogs() {
    systemLogs.length = 0;
    log('INFO', 'System logs cleared');
}

/**
 * Override console methods to capture all logs
 */
export function interceptConsole() {
    console.log = (...args) => {
        // Convert first arg to string message, rest as additional args
        const message = args.length > 0 ? String(args[0]) : '';
        const restArgs = args.slice(1);
        log('INFO', message, ...restArgs);
    };

    console.error = (...args) => {
        const message = args.length > 0 ? String(args[0]) : '';
        const restArgs = args.slice(1);
        log('ERROR', message, ...restArgs);
    };

    console.warn = (...args) => {
        const message = args.length > 0 ? String(args[0]) : '';
        const restArgs = args.slice(1);
        log('WARN', message, ...restArgs);
    };

    console.debug = (...args) => {
        const message = args.length > 0 ? String(args[0]) : '';
        const restArgs = args.slice(1);
        log('DEBUG', message, ...restArgs);
    };
}
