const dns = require('dns').promises;

/**
 * Utilitaires pour le projet CalmWeb
 */

/**
 * Vérifie si une chaîne ressemble à une adresse IP
 * @param {string} str
 * @returns {boolean}
 */
function looksLikeIP(str) {
  if (!str) return false;

  // IPv4: xxx.xxx.xxx.xxx
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(str)) {
    const parts = str.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6: contient des :
  if (str.includes(':') && !str.includes('::ffff:')) {
    return true;
  }

  return false;
}

/**
 * Extrait le hostname depuis une URL ou path de requête HTTP
 * @param {string} path
 * @returns {string|null}
 */
function extractHostnameFromPath(path) {
  try {
    if (!path) return null;

    // Si c'est juste un hostname:port (CONNECT method)
    if (!path.startsWith('http://') && !path.startsWith('https://')) {
      const hostPort = path.split(':')[0];
      return hostPort;
    }

    // Si c'est une URL complète
    const url = new URL(path);
    return url.hostname;
  } catch (e) {
    return null;
  }
}

/**
 * Extrait le port depuis un path
 * @param {string} path
 * @returns {number}
 */
function extractPortFromPath(path) {
  try {
    if (!path) return 80;

    // Pour CONNECT: hostname:port
    if (!path.startsWith('http://') && !path.startsWith('https://')) {
      const parts = path.split(':');
      if (parts.length > 1) {
        const port = parseInt(parts[1], 10);
        return isNaN(port) ? 443 : port;
      }
      return 443;
    }

    // Pour URL complète
    const url = new URL(path);
    if (url.port) return parseInt(url.port, 10);
    return url.protocol === 'https:' ? 443 : 80;
  } catch (e) {
    return 80;
  }
}

/**
 * Vérifie si un domaine correspond à un pattern (supporte wildcards)
 * @param {string} domain - Le domaine à vérifier
 * @param {string} pattern - Le pattern (ex: *.google.com)
 * @returns {boolean}
 */
function matchesDomainPattern(domain, pattern) {
  if (!domain || !pattern) return false;

  // Exact match
  if (domain === pattern) return true;

  // Wildcard match: *.example.com
  if (pattern.startsWith('*.')) {
    const baseDomain = pattern.substring(2);
    return domain === baseDomain || domain.endsWith('.' + baseDomain);
  }

  return false;
}

/**
 * Vérifie si une IP est dans un range CIDR
 * @param {string} ip - L'adresse IP à vérifier
 * @param {string} cidr - Le range CIDR (ex: 192.168.1.0/24)
 * @returns {boolean}
 */
function isIPInCIDR(ip, cidr) {
  try {
    if (!cidr.includes('/')) {
      // Pas de CIDR, simple comparaison
      return ip === cidr;
    }

    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  } catch (e) {
    return false;
  }
}

/**
 * Convertit une IP en nombre
 * @param {string} ip
 * @returns {number}
 */
function ipToNumber(ip) {
  const parts = ip.split('.');
  return parts.reduce((acc, part, i) => {
    return acc + (parseInt(part, 10) << (8 * (3 - i)));
  }, 0) >>> 0;
}

/**
 * Résout un nom de domaine en adresse IP avec timeout
 * @param {string} hostname
 * @param {number} timeout - Timeout en ms (défaut: 5000)
 * @returns {Promise<string|null>}
 */
async function resolveHostname(hostname, timeout = 5000) {
  try {
    // Créer une promesse de timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('DNS resolution timeout')), timeout);
    });

    // Race entre la résolution DNS et le timeout
    const addresses = await Promise.race([
      dns.resolve4(hostname),
      timeoutPromise
    ]);

    return addresses[0] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Vérifie si un port est standard (80, 443) ou VoIP (3478, 5060, 5061)
 * @param {number} port
 * @returns {boolean}
 */
function isStandardPort(port) {
  const allowedPorts = [80, 443, 3478, 5060, 5061];
  return allowedPorts.includes(port);
}

/**
 * Nettoie un nom de domaine (enlève espaces, www., etc.)
 * Préserve les wildcards (*.) et les CIDR (/)
 * @param {string} domain
 * @returns {string}
 */
function cleanDomain(domain) {
  if (!domain) return '';

  let cleaned = domain.toLowerCase().trim();

  // Ne pas modifier les CIDR (contient /)
  if (cleaned.includes('/')) {
    return cleaned; // Préserver tel quel
  }

  // Ne pas modifier les wildcards (commence par *.)
  if (cleaned.startsWith('*.')) {
    return cleaned; // Préserver tel quel
  }

  // Enlever le www. au début (seulement pour les domaines normaux)
  if (cleaned.startsWith('www.')) {
    cleaned = cleaned.substring(4);
  }

  // Enlever le slash final
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
}

/**
 * Parse une ligne de fichier hosts (format: IP domain)
 * @param {string} line
 * @returns {string|null} Le domaine extrait ou null
 */
function parseHostsLine(line) {
  if (!line) return null;

  const trimmed = line.trim();

  // Ignorer les commentaires et lignes vides
  if (trimmed.startsWith('#') || trimmed === '') return null;

  // Format: 0.0.0.0 domain ou 127.0.0.1 domain
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;

  const [ip, domain] = parts;

  // Vérifier que c'est bien une IP de blocage
  if (ip === '0.0.0.0' || ip === '127.0.0.1') {
    return cleanDomain(domain);
  }

  return null;
}

/**
 * Parse une ligne de liste simple (juste le domaine)
 * @param {string} line
 * @returns {string|null}
 */
function parseSimpleListLine(line) {
  if (!line) return null;

  const trimmed = line.trim();

  // Ignorer les commentaires et lignes vides
  if (trimmed.startsWith('#') || trimmed === '') return null;

  return cleanDomain(trimmed);
}

/**
 * Extrait le domaine depuis une URL complète
 * @param {string} url - URL complète (ex: http://example.com:8080/path)
 * @returns {string|null} Le domaine ou null
 */
function extractDomainFromURL(url) {
  try {
    if (!url) return null;

    // Ajouter le protocole si manquant pour permettre le parsing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }

    const urlObj = new URL(url);
    return cleanDomain(urlObj.hostname);
  } catch (e) {
    return null;
  }
}

/**
 * Parse une ligne CSV URLhaus avec gestion des guillemets
 * Format: "id","dateadded","url","url_status",...
 * @param {string} line - Ligne CSV
 * @param {string} statusFilter - Statut à filtrer (ex: "online", null pour tout)
 * @returns {string|null} Le domaine extrait ou null
 */
function parseCSVLine(line, statusFilter = 'online') {
  try {
    if (!line) return null;

    const trimmed = line.trim();

    // Ignorer les commentaires
    if (trimmed.startsWith('#') || trimmed === '') return null;

    // Ignorer la ligne d'en-tête
    if (trimmed.startsWith('"id",')) return null;

    // Parser le CSV avec guillemets doubles
    const columns = [];
    let currentColumn = '';
    let insideQuotes = false;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        columns.push(currentColumn);
        currentColumn = '';
      } else {
        currentColumn += char;
      }
    }
    // Ajouter la dernière colonne
    columns.push(currentColumn);

    // Vérifier qu'on a au moins 4 colonnes
    if (columns.length < 4) return null;

    // Colonne 3 (index 2) = URL
    // Colonne 4 (index 3) = Status
    const url = columns[2];
    const status = columns[3];

    // Filtrer par statut si demandé
    if (statusFilter && status !== statusFilter) {
      return null;
    }

    // Extraire le domaine de l'URL
    return extractDomainFromURL(url);
  } catch (e) {
    return null;
  }
}

/**
 * Delay async
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry une fonction async avec backoff exponentiel
 * @param {Function} fn
 * @param {number} maxRetries
 * @param {number} baseDelay
 * @returns {Promise<any>}
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i);
        await delay(delayTime);
      }
    }
  }

  throw lastError;
}

module.exports = {
  looksLikeIP,
  extractHostnameFromPath,
  extractPortFromPath,
  matchesDomainPattern,
  isIPInCIDR,
  ipToNumber,
  resolveHostname,
  isStandardPort,
  cleanDomain,
  parseHostsLine,
  parseSimpleListLine,
  extractDomainFromURL,
  parseCSVLine,
  delay,
  retryWithBackoff
};
