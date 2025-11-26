/**
 * Rate Limiter - Protection contre le flood et les attaques DDoS
 *
 * Utilise l'algorithme "Sliding Window" pour limiter le nombre de requêtes
 * par domaine/IP sur une période donnée.
 *
 * Standards:
 * - nginx: limit_req (sliding window)
 * - Cloudflare: Rate Limiting (10 req/s par IP)
 * - AWS WAF: Rate-based rules
 */

import { logger } from './logger';

interface RequestWindow {
    timestamps: number[];  // Sliding window de timestamps
    blocked: number;       // Nombre de requêtes bloquées (stats)
}

interface RateLimitConfig {
    maxRequests: number;   // Max requêtes dans la fenêtre
    windowMs: number;      // Taille de la fenêtre en ms
    blockDuration: number; // Durée de blocage en ms après dépassement
}

// Configuration par défaut (standard pro)
const DEFAULT_CONFIG: RateLimitConfig = {
    maxRequests: 100,      // 100 requêtes max
    windowMs: 10000,       // Sur 10 secondes
    blockDuration: 60000   // Blocage 1 minute si dépassement
};

// Maps pour tracking
const domainWindows = new Map<string, RequestWindow>();
const blockedUntil = new Map<string, number>();

/**
 * Nettoie les vieilles entrées (garbage collection)
 * Standard: Exécuté toutes les 60 secondes
 */
function cleanup() {
    const now = Date.now();
    const cutoff = now - DEFAULT_CONFIG.windowMs;

    // Nettoyer les windows expirées
    for (const [domain, window] of domainWindows.entries()) {
        // Retirer les timestamps trop anciens
        window.timestamps = window.timestamps.filter(ts => ts > cutoff);

        // Supprimer l'entrée si vide
        if (window.timestamps.length === 0) {
            domainWindows.delete(domain);
        }
    }

    // Nettoyer les blocages expirés
    for (const [domain, until] of blockedUntil.entries()) {
        if (now > until) {
            blockedUntil.delete(domain);
        }
    }
}

// Cleanup toutes les 60 secondes
setInterval(cleanup, 60000);

/**
 * Vérifie si un domaine est rate-limité
 *
 * Algorithme Sliding Window:
 * 1. Récupère la fenêtre actuelle
 * 2. Retire les timestamps trop anciens (> windowMs)
 * 3. Compte les requêtes dans la fenêtre
 * 4. Bloque si > maxRequests
 *
 * @param domain - Domaine à vérifier
 * @returns { limited: boolean, reason?: string, stats?: object }
 */
export function checkRateLimit(domain: string): {
    limited: boolean;
    reason?: string;
    remaining?: number;
    resetAt?: number;
} {
    const now = Date.now();

    // Vérifier si déjà bloqué
    const blockedTime = blockedUntil.get(domain);
    if (blockedTime && now < blockedTime) {
        return {
            limited: true,
            reason: 'Rate Limit Exceeded - Temporarily Blocked',
            remaining: 0,
            resetAt: blockedTime
        };
    }

    // Récupérer ou créer la fenêtre
    let window = domainWindows.get(domain);
    if (!window) {
        window = { timestamps: [], blocked: 0 };
        domainWindows.set(domain, window);
    }

    // Nettoyer les timestamps hors de la fenêtre (sliding window)
    const cutoff = now - DEFAULT_CONFIG.windowMs;
    window.timestamps = window.timestamps.filter(ts => ts > cutoff);

    // Vérifier si limite atteinte
    if (window.timestamps.length >= DEFAULT_CONFIG.maxRequests) {
        // Bloquer le domaine
        const blockUntil = now + DEFAULT_CONFIG.blockDuration;
        blockedUntil.set(domain, blockUntil);
        window.blocked++;

        logger.warn(`[Rate Limiter] Domain blocked: ${domain} (${window.timestamps.length} req in ${DEFAULT_CONFIG.windowMs}ms)`, {
            domain,
            requests: window.timestamps.length,
            windowMs: DEFAULT_CONFIG.windowMs,
            blockUntil: new Date(blockUntil).toISOString()
        });

        return {
            limited: true,
            reason: `Rate Limit: ${DEFAULT_CONFIG.maxRequests} req/${DEFAULT_CONFIG.windowMs}ms exceeded`,
            remaining: 0,
            resetAt: blockUntil
        };
    }

    // Ajouter le timestamp actuel
    window.timestamps.push(now);

    // Retourner info pour headers HTTP (comme nginx)
    const remaining = DEFAULT_CONFIG.maxRequests - window.timestamps.length;
    const oldestTimestamp = window.timestamps[0];
    const resetAt = oldestTimestamp + DEFAULT_CONFIG.windowMs;

    return {
        limited: false,
        remaining,
        resetAt
    };
}

/**
 * Réinitialise le rate limit pour un domaine
 * Utile pour whitelist ou déblocage manuel
 */
export function resetRateLimit(domain: string): void {
    domainWindows.delete(domain);
    blockedUntil.delete(domain);
    logger.info(`[Rate Limiter] Reset for domain: ${domain}`);
}

/**
 * Obtient les statistiques globales
 * Pour affichage dans l'UI
 */
export function getRateLimitStats(): {
    trackedDomains: number;
    blockedDomains: number;
    totalBlocked: number;
    config: RateLimitConfig;
} {
    let totalBlocked = 0;

    for (const window of domainWindows.values()) {
        totalBlocked += window.blocked;
    }

    return {
        trackedDomains: domainWindows.size,
        blockedDomains: blockedUntil.size,
        totalBlocked,
        config: DEFAULT_CONFIG
    };
}

/**
 * Met à jour la configuration du rate limiter
 * Permet à l'utilisateur de configurer via UI
 */
export function updateRateLimitConfig(config: Partial<RateLimitConfig>): void {
    Object.assign(DEFAULT_CONFIG, config);
    logger.info('[Rate Limiter] Configuration updated', DEFAULT_CONFIG);
}

/**
 * Obtient les domaines actuellement bloqués
 */
export function getBlockedDomains(): Array<{ domain: string; until: number }> {
    const now = Date.now();
    const blocked: Array<{ domain: string; until: number }> = [];

    for (const [domain, until] of blockedUntil.entries()) {
        if (now < until) {
            blocked.push({ domain, until });
        }
    }

    return blocked.sort((a, b) => b.until - a.until);
}

export default {
    checkRateLimit,
    resetRateLimit,
    getRateLimitStats,
    updateRateLimitConfig,
    getBlockedDomains
};
