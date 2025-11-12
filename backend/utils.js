const dns = require('dns').promises;

/**
 * Utilitaires pour le projet CalmWeb
 */

/**
 * Vérifie si une chaîne ressemble à une adresse IP (IPv4 ou IPv6)
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

  // IPv6: contient des : (support complet)
  if (isValidIPv6(str)) {
    return true;
  }

  return false;
}

/**
 * Valide une adresse IPv6 complète
 * @param {string} ip
 * @returns {boolean}
 */
function isValidIPv6(ip) {
  if (!ip) return false;

  // Pattern IPv6 complet (avec compression ::)
  const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;

  return ipv6Pattern.test(ip);
}

/**
 * Valide la longueur d'un domaine selon RFC 1035 (DoS protection)
 * @param {string} domain
 * @returns {boolean}
 */
function validateDomainLength(domain) {
  if (!domain) return false;

  // RFC 1035: 253 caractères max pour un FQDN
  if (domain.length > 253) {
    return false;
  }

  // RFC 1035: Chaque label max 63 caractères
  const labels = domain.split('.');
  for (const label of labels) {
    if (label.length > 63) {
      return false;
    }
  }

  return true;
}

/**
 * Valide le format d'un domaine (Injection prevention)
 * @param {string} domain
 * @returns {boolean}
 */
function validateDomainFormat(domain) {
  if (!domain) return false;

  // Permettre wildcards (*.example.com)
  if (domain.startsWith('*.')) {
    domain = domain.substring(2);
  }

  // Permettre CIDR (192.168.0.0/16)
  if (domain.includes('/')) {
    const [ip, bits] = domain.split('/');
    const bitsNum = parseInt(bits, 10);

    // Valider IPv4 CIDR
    if (looksLikeIP(ip) && bitsNum >= 0 && bitsNum <= 32) {
      return true;
    }

    // Valider IPv6 CIDR
    if (isValidIPv6(ip) && bitsNum >= 0 && bitsNum <= 128) {
      return true;
    }

    return false;
  }

  // Vérifier si c'est une IP (valide)
  if (looksLikeIP(domain)) {
    return true;
  }

  // Pattern strict pour domaine
  // Autorise: lettres, chiffres, tirets, points
  // Ne commence/termine pas par tiret, pas de points consécutifs
  const domainPattern = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})*$/i;

  return domainPattern.test(domain);
}

/**
 * Calcule l'entropie de Shannon d'une chaîne (pour détecter DNS tunneling)
 * @param {string} str
 * @returns {number} Entropie (0-8 bits)
 */
function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;

  const freq = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;

  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Détecte les patterns suspects de DNS tunneling (Advanced threat detection)
 * @param {string} domain
 * @returns {object} { suspicious: boolean, reasons: string[] }
 */
function detectDNSTunneling(domain) {
  if (!domain) return { suspicious: false, reasons: [] };

  const reasons = [];
  const cleaned = cleanDomain(domain);

  // 1. Longueur de domaine excessive (>50 caractères)
  if (cleaned.length > 50) {
    reasons.push('Longueur excessive');
  }

  // 2. Nombre de sous-domaines excessif (>4)
  const labels = cleaned.split('.');
  if (labels.length > 5) {
    reasons.push('Trop de sous-domaines');
  }

  // 3. Labels très longs (>20 caractères)
  const longLabels = labels.filter(l => l.length > 20);
  if (longLabels.length > 0) {
    reasons.push('Labels très longs');
  }

  // 4. Entropie élevée (>4.5 bits = données encodées)
  const entropy = calculateEntropy(cleaned.replace(/\./g, ''));
  if (entropy > 4.5) {
    reasons.push('Entropie élevée (données encodées)');
  }

  // 5. Présence de patterns base64/hex suspects
  const base64Pattern = /[A-Za-z0-9+/=]{20,}/;
  const hexPattern = /[0-9a-fA-F]{32,}/;

  for (const label of labels) {
    if (base64Pattern.test(label)) {
      reasons.push('Pattern Base64 détecté');
      break;
    }
    if (hexPattern.test(label)) {
      reasons.push('Pattern hexadécimal détecté');
      break;
    }
  }

  // 6. Trop de chiffres (>60% = suspect)
  const digitCount = (cleaned.match(/\d/g) || []).length;
  const digitRatio = digitCount / cleaned.length;
  if (digitRatio > 0.6) {
    reasons.push('Trop de chiffres');
  }

  return {
    suspicious: reasons.length >= 2, // 2+ indicateurs = suspect
    reasons,
    entropy: entropy.toFixed(2)
  };
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
 * Vérifie si un port est autorisé (configurab le)
 * @param {number} port
 * @param {array} allowedPorts - Liste des ports autorisés (optionnel)
 * @returns {boolean}
 */
function isStandardPort(port, allowedPorts = null) {
  // Ports par défaut si non spécifié
  const defaultPorts = [80, 443, 3478, 5060, 5061, 8080, 8443];
  const portsToCheck = allowedPorts || defaultPorts;
  return portsToCheck.includes(port);
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
  isValidIPv6,
  validateDomainLength,
  validateDomainFormat,
  calculateEntropy,
  detectDNSTunneling,
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
