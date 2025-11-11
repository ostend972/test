/**
 * Module de validation pour les entrées IPC
 * Protège contre les injections, données malformées et DoS
 */

const path = require('path');

/**
 * Validateurs de types de base
 */
const validators = {
  /**
   * Valide un nom de domaine
   */
  domain(value) {
    if (typeof value !== 'string') {
      throw new Error('Domain must be a string');
    }

    // Limiter la longueur
    if (value.length === 0 || value.length > 253) {
      throw new Error('Domain length must be between 1 and 253 characters');
    }

    // Pattern de domaine valide (RFC 1123)
    const domainPattern = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;

    if (!domainPattern.test(value)) {
      throw new Error('Invalid domain format');
    }

    return value.toLowerCase();
  },

  /**
   * Valide une configuration object
   */
  config(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Config must be an object');
    }

    const validated = {};
    const allowedKeys = [
      'protectionEnabled',
      'proxyHost',
      'proxyPort',
      'blockRemoteDesktop',
      'blockDirectIPs',
      'blockHTTPTraffic',
      'blockNonStandardPorts',
      'blocklistSources',
      'blocklistURLs',
      'communityBlocklistURL',
      'autoUpdate',
      'updateInterval',
      'lastUpdate',
      'installed',
      'installPath',
      'version',
      'createdAt',
      'updatedAt',
      'logLevel',
      'whitelistGitHubURL',
      'usefulDomainsURL',
      'enableUsefulDomains',
      'whitelistGitHubLoaded',
      'usefulDomainsLoaded'
    ];

    // Valider chaque clé
    for (const [key, val] of Object.entries(value)) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`Unknown config key: ${key}`);
      }

      // Valider le type selon la clé
      switch (key) {
        case 'protectionEnabled':
        case 'blockRemoteDesktop':
        case 'blockDirectIPs':
        case 'blockHTTPTraffic':
        case 'blockNonStandardPorts':
        case 'autoUpdate':
        case 'enableUsefulDomains':
        case 'whitelistGitHubLoaded':
        case 'usefulDomainsLoaded':
          if (typeof val !== 'boolean') {
            throw new Error(`${key} must be a boolean`);
          }
          validated[key] = val;
          break;

        case 'proxyHost':
          if (typeof val !== 'string' || !/^127\.0\.0\.1$/.test(val)) {
            throw new Error('proxyHost must be 127.0.0.1');
          }
          validated[key] = val;
          break;

        case 'proxyPort':
          const port = parseInt(val, 10);
          if (isNaN(port) || port < 1024 || port > 65535) {
            throw new Error('proxyPort must be between 1024 and 65535');
          }
          validated[key] = port;
          break;

        case 'updateInterval':
          const interval = parseInt(val, 10);
          if (isNaN(interval) || interval < 1) {
            throw new Error('updateInterval must be a positive number');
          }
          // Accepter les valeurs en heures (1-168) ou en secondes (3600-604800)
          if (interval > 168 && interval < 3600) {
            throw new Error('updateInterval must be 1-168 hours or 3600-604800 seconds');
          }
          if (interval > 604800) {
            throw new Error('updateInterval cannot exceed 7 days (168 hours or 604800 seconds)');
          }
          validated[key] = interval;
          break;

        case 'logLevel':
          const allowedLevels = ['debug', 'info', 'warn', 'error'];
          if (typeof val !== 'string' || !allowedLevels.includes(val)) {
            throw new Error('logLevel must be one of: debug, info, warn, error');
          }
          validated[key] = val;
          break;

        case 'whitelistGitHubURL':
        case 'usefulDomainsURL':
        case 'communityBlocklistURL':
          if (typeof val !== 'string' || !val.startsWith('https://')) {
            throw new Error(`${key} must be a valid HTTPS URL`);
          }
          validated[key] = val;
          break;

        case 'blocklistSources':
          if (typeof val !== 'object' || val === null || Array.isArray(val)) {
            throw new Error('blocklistSources must be an object');
          }
          const allowedSources = ['urlhaus', 'urlhausRecent', 'stevenBlack', 'hageziUltimate', 'phishingArmy', 'easylistFR'];
          const validatedSources = {};
          for (const [source, enabled] of Object.entries(val)) {
            if (!allowedSources.includes(source)) {
              throw new Error(`Unknown blocklist source: ${source}`);
            }
            if (typeof enabled !== 'boolean') {
              throw new Error(`blocklistSources.${source} must be a boolean`);
            }
            validatedSources[source] = enabled;
          }
          validated[key] = validatedSources;
          break;

        case 'blocklistURLs':
          if (typeof val !== 'object' || val === null || Array.isArray(val)) {
            throw new Error('blocklistURLs must be an object');
          }
          // Valider que toutes les valeurs sont des strings (URLs)
          const validatedURLs = {};
          for (const [source, url] of Object.entries(val)) {
            if (typeof url !== 'string' || url.length === 0 || url.length > 2000) {
              throw new Error(`blocklistURLs.${source} must be a valid URL string`);
            }
            validatedURLs[source] = url;
          }
          validated[key] = validatedURLs;
          break;

        default:
          validated[key] = val;
      }
    }

    return validated;
  },

  /**
   * Valide un contenu CSV pour import
   */
  csvContent(value) {
    if (typeof value !== 'string') {
      throw new Error('CSV content must be a string');
    }

    // Limiter la taille (10 MB max)
    if (value.length > 10 * 1024 * 1024) {
      throw new Error('CSV content too large (max 10 MB)');
    }

    // Limiter le nombre de lignes (100k max)
    const lines = value.split('\n').length;
    if (lines > 100000) {
      throw new Error('CSV has too many lines (max 100,000)');
    }

    return value;
  },

  /**
   * Valide un chemin de fichier (pour export)
   */
  filePath(value, allowedDir) {
    if (typeof value !== 'string') {
      throw new Error('File path must be a string');
    }

    if (value.length === 0 || value.length > 500) {
      throw new Error('File path length must be between 1 and 500 characters');
    }

    // Résoudre le chemin absolu
    const resolved = path.resolve(value);

    // Si un répertoire autorisé est spécifié, vérifier qu'on reste dedans
    if (allowedDir) {
      const allowedResolved = path.resolve(allowedDir);
      if (!resolved.startsWith(allowedResolved)) {
        throw new Error('Path traversal detected: file must be in allowed directory');
      }
    }

    // Vérifier l'extension
    const ext = path.extname(resolved).toLowerCase();
    const allowedExtensions = ['.csv', '.json', '.txt', '.log'];
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`);
    }

    return resolved;
  },

  /**
   * Valide des filtres de logs
   */
  logFilters(value) {
    if (typeof value !== 'object' || value === null) {
      return {}; // Pas de filtres
    }

    const validated = {};

    if (value.level !== undefined) {
      const allowedLevels = ['debug', 'info', 'warn', 'error'];
      if (typeof value.level !== 'string' || !allowedLevels.includes(value.level)) {
        throw new Error('Invalid log level filter');
      }
      validated.level = value.level;
    }

    if (value.startDate !== undefined) {
      const date = new Date(value.startDate);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid startDate format');
      }
      validated.startDate = value.startDate;
    }

    if (value.endDate !== undefined) {
      const date = new Date(value.endDate);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid endDate format');
      }
      validated.endDate = value.endDate;
    }

    if (value.limit !== undefined) {
      const limit = parseInt(value.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 10000) {
        throw new Error('Limit must be between 1 and 10000');
      }
      validated.limit = limit;
    }

    return validated;
  },

  /**
   * Valide une valeur booléenne
   */
  boolean(value) {
    if (typeof value !== 'boolean') {
      throw new Error('Value must be a boolean');
    }
    return value;
  },

  /**
   * Valide un nombre
   */
  number(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Value must be a number');
    }

    // Vérifier que c'est un entier positif (pour page et pageSize)
    if (value < 1 || !Number.isInteger(value)) {
      throw new Error('Value must be a positive integer');
    }

    // Limiter pour éviter les DoS
    if (value > 1000000) {
      throw new Error('Number too large (max 1000000)');
    }

    return value;
  },

  /**
   * Valide une chaîne générique
   */
  string(value, maxLength = 1000) {
    if (typeof value !== 'string') {
      throw new Error('Value must be a string');
    }

    if (value.length > maxLength) {
      throw new Error(`String too long (max ${maxLength} characters)`);
    }

    return value;
  }
};

/**
 * Wrapper de validation pour les handlers IPC
 * @param {object} schema - Schéma de validation { paramName: validatorName }
 * @param {function} handler - Handler IPC original
 * @returns {function} Handler IPC avec validation
 */
function validateIpc(schema, handler) {
  return async (event, ...args) => {
    try {
      // Construire l'objet de paramètres
      const params = {};

      // Si un seul argument et c'est un objet, l'utiliser directement
      if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        Object.assign(params, args[0]);
      } else {
        // Sinon, mapper les arguments par position
        const schemaKeys = Object.keys(schema);
        args.forEach((arg, index) => {
          if (index < schemaKeys.length) {
            params[schemaKeys[index]] = arg;
          }
        });
      }

      // Valider chaque paramètre selon le schéma
      const validated = {};
      for (const [key, validatorName] of Object.entries(schema)) {
        const value = params[key];

        // Si le paramètre est requis mais manquant
        if (value === undefined) {
          // Paramètres optionnels (suffixe ?)
          if (validatorName.endsWith('?')) {
            continue;
          }
          throw new Error(`Missing required parameter: ${key}`);
        }

        // Obtenir le validateur
        const actualValidator = validatorName.replace('?', '');
        const validator = validators[actualValidator];

        if (!validator) {
          throw new Error(`Unknown validator: ${actualValidator}`);
        }

        // Valider la valeur
        validated[key] = validator(value);
      }

      // Appeler le handler avec les valeurs validées
      return await handler(event, validated);
    } catch (error) {
      console.error(`[IPC Validation Error] ${error.message}`);
      throw new Error(`Validation failed: ${error.message}`);
    }
  };
}

module.exports = {
  validators,
  validateIpc
};
