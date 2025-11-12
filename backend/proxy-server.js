const http = require('http');
const net = require('net');
const url = require('url');
const {
  extractHostnameFromPath,
  extractPortFromPath,
  looksLikeIP,
  isStandardPort,
  validateDomainLength,
  validateDomainFormat,
  detectDNSTunneling
} = require('./utils');
const logger = require('./logger');
const RateLimiter = require('./rate-limiter');

/**
 * Serveur proxy HTTP/HTTPS avec filtrage
 */
class ProxyServer {
  constructor(configManager, whitelistManager, blocklistManager) {
    this.configManager = configManager;
    this.whitelistManager = whitelistManager;
    this.blocklistManager = blocklistManager;
    this.server = null;
    this.isRunning = false;
    this.activeConnections = new Set();

    // Rate limiter pour protection DoS
    this.rateLimiter = new RateLimiter({
      maxRequests: 100,      // 100 requêtes max
      windowMs: 1000,        // par seconde
      blockDurationMs: 60000 // blocage 1 minute
    });

    // Statistiques des menaces détectées
    this.threatStats = {
      invalidDomains: 0,
      dnsTunneling: 0,
      rateLimitHits: 0,
      bypassAttempts: 0
    };
  }

  /**
   * Démarre le serveur proxy
   */
  async start() {
    const config = this.configManager.get();
    const port = config.proxyPort || 8081;
    const host = config.proxyHost || '127.0.0.1';

    if (this.isRunning) {
      logger.warn('Le serveur proxy est déjà démarré');
      return;
    }

    this.server = http.createServer((req, res) => {
      this.handleHTTPRequest(req, res);
    });

    // Handler pour HTTPS CONNECT tunneling
    this.server.on('connect', (req, clientSocket, head) => {
      this.handleHTTPSConnect(req, clientSocket, head);
    });

    // Gestion des erreurs
    this.server.on('error', (error) => {
      logger.error(`Erreur serveur proxy: ${error.message}`);
    });

    // Gestion de la fermeture
    this.server.on('close', () => {
      logger.info('Serveur proxy arrêté');
      this.isRunning = false;
    });

    return new Promise((resolve, reject) => {
      this.server.listen(port, host, () => {
        this.isRunning = true;
        logger.info(`Serveur proxy démarré sur ${host}:${port}`);
        resolve({ host, port });
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Arrête le serveur proxy
   */
  async stop() {
    if (!this.isRunning || !this.server) {
      return;
    }

    // Fermer toutes les connexions actives
    for (const socket of this.activeConnections) {
      socket.destroy();
    }
    this.activeConnections.clear();

    // Nettoyer le rate limiter
    if (this.rateLimiter) {
      this.rateLimiter.destroy();
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        logger.info('Serveur proxy arrêté');
        resolve();
      });
    });
  }

  /**
   * Gère les requêtes HTTP (GET, POST, etc.)
   */
  async handleHTTPRequest(clientReq, clientRes) {
    const requestURL = clientReq.url;
    const hostname = extractHostnameFromPath(requestURL);
    const port = extractPortFromPath(requestURL);

    // Extraire l'IP du client
    const clientIP = clientReq.socket.remoteAddress || 'unknown';

    // Vérifier les règles de blocage (avec IP pour rate limiting)
    const blockResult = this.shouldBlock(hostname, port, false, clientIP);

    if (blockResult.blocked) {
      this.sendBlockedResponse(clientRes, hostname, blockResult.reason);
      logger.logBlocked(hostname, blockResult.reason, blockResult.source);
      return;
    }

    // Autoriser la requête
    logger.logAllowed(hostname);

    try {
      const parsedURL = url.parse(requestURL);

      const options = {
        hostname: parsedURL.hostname,
        port: parsedURL.port || 80,
        path: parsedURL.path,
        method: clientReq.method,
        headers: clientReq.headers
      };

      // Supprimer le header proxy-connection
      delete options.headers['proxy-connection'];

      const proxyReq = http.request(options, (proxyRes) => {
        // Copier les headers de réponse
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);

        // Pipe la réponse
        const benignPipeErrors = ['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ECANCELED'];
        const resPipe = proxyRes.pipe(clientRes);
        resPipe.on('error', (error) => {
          // Ignorer les erreurs bénignes de connexion fermée
          if (!benignPipeErrors.includes(error.code)) {
            logger.warn(`Erreur pipe réponse HTTP: ${error.message}`);
          }
        });

        // Gérer les erreurs de la réponse
        const benignErrors = ['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND', 'ECANCELED'];
        proxyRes.on('error', (error) => {
          if (!benignErrors.includes(error.code)) {
            logger.error(`Erreur réponse HTTP depuis ${hostname}: ${error.message}`);
          }
        });
      });

      // Gérer les erreurs
      const benignErrors = ['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ETIMEDOUT', 'ENOTFOUND', 'ECANCELED'];

      proxyReq.on('error', (error) => {
        // Ne logger que les erreurs importantes
        if (!benignErrors.includes(error.code)) {
          logger.error(`Erreur requête HTTP vers ${hostname}: ${error.message}`);
        }
        if (!clientRes.headersSent) {
          clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
          clientRes.end('Bad Gateway');
        }
      });

      clientReq.on('error', (error) => {
        // Ne logger que les erreurs importantes
        if (!benignErrors.includes(error.code)) {
          logger.error(`Erreur requête client HTTP: ${error.message}`);
        }
        proxyReq.destroy();
      });

      // Pipe la requête
      const benignPipeErrors = ['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ECANCELED'];
      const reqPipe = clientReq.pipe(proxyReq);
      reqPipe.on('error', (error) => {
        // Ignorer les erreurs bénignes de connexion fermée
        if (!benignPipeErrors.includes(error.code)) {
          logger.warn(`Erreur pipe requête HTTP: ${error.message}`);
        }
      });

    } catch (error) {
      logger.error(`Erreur traitement requête HTTP: ${error.message}`);
      clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
      clientRes.end('Internal Server Error');
    }
  }

  /**
   * Gère le tunneling HTTPS (méthode CONNECT)
   */
  async handleHTTPSConnect(req, clientSocket, head) {
    const [hostname, port] = req.url.split(':');
    const targetPort = parseInt(port) || 443;

    // Extraire l'IP du client
    const clientIP = clientSocket.remoteAddress || 'unknown';

    // Ajouter aux connexions actives
    this.activeConnections.add(clientSocket);
    clientSocket.on('close', () => {
      this.activeConnections.delete(clientSocket);
    });

    // Vérifier les règles de blocage (avec IP pour rate limiting)
    const blockResult = this.shouldBlock(hostname, targetPort, true, clientIP);

    if (blockResult.blocked) {
      clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      clientSocket.end();
      logger.logBlocked(hostname, blockResult.reason, blockResult.source);
      return;
    }

    // Autoriser la connexion
    logger.logAllowed(hostname);

    try {
      // Établir la connexion vers le serveur cible
      const serverSocket = net.connect(targetPort, hostname, () => {
        // Connexion établie, envoyer la réponse OK au client
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

        // Écrire les données head si présentes
        if (head && head.length > 0) {
          serverSocket.write(head);
        }

        // Relay bidirectionnel
        this.setupBidirectionalRelay(clientSocket, serverSocket);
      });

      // Gérer les erreurs de connexion
      serverSocket.on('error', (error) => {
        // Erreurs bénignes normales à ignorer
        const benignErrors = [
          'ECONNRESET',    // Connexion fermée par le pair
          'ECONNABORTED',  // Connexion annulée
          'EPIPE',         // Pipe cassé
          'ETIMEDOUT',     // Timeout
          'ENOTFOUND',     // Domaine inexistant
          'ECANCELED'      // Opération annulée
        ];

        if (!benignErrors.includes(error.code)) {
          logger.error(`Erreur connexion HTTPS vers ${hostname}: ${error.message}`);
        }
        if (!clientSocket.destroyed) {
          clientSocket.end();
        }
      });

      clientSocket.on('error', (error) => {
        // Erreurs bénignes normales à ignorer
        const benignErrors = [
          'ECONNRESET',
          'ECONNABORTED',
          'EPIPE',
          'ETIMEDOUT',
          'ENOTFOUND',
          'ECANCELED'
        ];

        if (!benignErrors.includes(error.code)) {
          logger.error(`Erreur socket client pour ${hostname}: ${error.message}`);
        }
        if (!serverSocket.destroyed) {
          serverSocket.end();
        }
      });

    } catch (error) {
      logger.error(`Erreur tunneling HTTPS: ${error.message}`);
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.end();
    }
  }

  /**
   * Configure le relay bidirectionnel entre client et serveur
   */
  setupBidirectionalRelay(clientSocket, serverSocket) {
    // Optimiser les sockets pour la performance
    this.optimizeSocket(clientSocket);
    this.optimizeSocket(serverSocket);

    // Éviter les erreurs de pipe non gérées
    const clientPipe = clientSocket.pipe(serverSocket);
    const serverPipe = serverSocket.pipe(clientSocket);

    // Gérer les erreurs de pipe (erreurs bénignes ignorées)
    const benignPipeErrors = ['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ECANCELED'];

    clientPipe.on('error', (error) => {
      if (!benignPipeErrors.includes(error.code)) {
        logger.warn(`Erreur pipe client->server HTTPS: ${error.message}`);
      }
    });

    serverPipe.on('error', (error) => {
      if (!benignPipeErrors.includes(error.code)) {
        logger.warn(`Erreur pipe server->client HTTPS: ${error.message}`);
      }
    });

    // Nettoyer à la fermeture
    clientSocket.on('end', () => {
      if (!serverSocket.destroyed) {
        serverSocket.end();
      }
    });

    serverSocket.on('end', () => {
      if (!clientSocket.destroyed) {
        clientSocket.end();
      }
    });

    clientSocket.on('close', () => {
      if (!serverSocket.destroyed) {
        serverSocket.destroy();
      }
      this.activeConnections.delete(clientSocket);
    });

    serverSocket.on('close', () => {
      if (!clientSocket.destroyed) {
        clientSocket.destroy();
      }
    });
  }

  /**
   * Optimise les paramètres du socket pour la performance
   */
  optimizeSocket(socket) {
    try {
      socket.setNoDelay(true);  // Désactiver l'algorithme de Nagle
      socket.setKeepAlive(true, 30000);  // Keep-alive toutes les 30s
    } catch (error) {
      // Ignorer les erreurs
    }
  }

  /**
   * Détermine si une requête doit être bloquée
   * @param {string} hostname - Nom de domaine
   * @param {number} port - Port
   * @param {boolean} isHTTPS - Si c'est HTTPS
   * @param {string} clientIP - IP du client (pour rate limiting)
   * @returns {object} { blocked: boolean, reason?: string, source?: string }
   */
  shouldBlock(hostname, port, isHTTPS, clientIP = null) {
    const config = this.configManager.get();

    // Si la protection est désactivée, ne rien bloquer
    if (!config.protectionEnabled) {
      return { blocked: false };
    }

    // 0. Rate Limiting (DoS protection) - AVANT tout
    if (clientIP) {
      const rateLimitResult = this.rateLimiter.checkRateLimit(clientIP);
      if (!rateLimitResult.allowed) {
        this.threatStats.rateLimitHits++;
        logger.warn(`Rate limit dépassé pour ${clientIP}: ${hostname}`);
        return {
          blocked: true,
          reason: 'Rate Limit',
          source: 'Protection DoS'
        };
      }
    }

    // 1. Validation de longueur de domaine (DoS protection)
    if (!validateDomainLength(hostname)) {
      this.threatStats.invalidDomains++;
      this.logBypassAttempt(hostname, clientIP, 'Longueur invalide (RFC 1035)');
      return {
        blocked: true,
        reason: 'Domaine invalide',
        source: 'Validation Sécurité'
      };
    }

    // 2. Validation du format de domaine (Injection prevention)
    if (!validateDomainFormat(hostname)) {
      this.threatStats.invalidDomains++;
      this.logBypassAttempt(hostname, clientIP, 'Format invalide');
      return {
        blocked: true,
        reason: 'Format invalide',
        source: 'Validation Sécurité'
      };
    }

    // 3. Détection DNS Tunneling (Advanced threat)
    const tunnelingResult = detectDNSTunneling(hostname);
    if (tunnelingResult.suspicious) {
      this.threatStats.dnsTunneling++;
      this.logBypassAttempt(hostname, clientIP, `DNS Tunneling: ${tunnelingResult.reasons.join(', ')}`);
      logger.warn(`DNS Tunneling détecté: ${hostname} (${tunnelingResult.reasons.join(', ')})`);
      return {
        blocked: true,
        reason: 'DNS Tunneling',
        source: 'Détection Avancée'
      };
    }

    // 4. Vérifier la whitelist (bypass tout) - avec cache LRU pour performance
    if (this.whitelistManager.isWhitelistedWithCache(hostname)) {
      return { blocked: false };
    }

    // 5. Vérifier si c'est un accès direct par IP
    if (config.blockDirectIPs && looksLikeIP(hostname)) {
      this.logBypassAttempt(hostname, clientIP, 'Accès direct par IP');
      return { blocked: true, reason: 'IP Block', source: 'Règle Système' };
    }

    // 6. Vérifier si c'est du HTTP (force HTTPS)
    if (config.blockHTTPTraffic && !isHTTPS) {
      return { blocked: true, reason: 'HTTP Block', source: 'Règle Système' };
    }

    // 7. Vérifier les ports non-standard (avec ports configurables)
    if (config.blockNonStandardPorts && !isStandardPort(port, config.allowedPorts)) {
      return { blocked: true, reason: 'Port Block', source: 'Règle Système' };
    }

    // 8. Vérifier la blocklist - avec cache LRU pour performance
    const blocklistResult = this.blocklistManager.isBlockedWithCache(hostname);
    if (blocklistResult.blocked) {
      // Déterminer le type de menace basé sur le domaine
      const threatType = this.determineThreatType(hostname);
      return {
        blocked: true,
        reason: threatType || blocklistResult.reason,
        source: blocklistResult.source
      };
    }

    // Pas de raison de bloquer
    return { blocked: false };
  }

  /**
   * Log des tentatives de bypass (Monitoring)
   * @param {string} hostname
   * @param {string} clientIP
   * @param {string} reason
   */
  logBypassAttempt(hostname, clientIP, reason) {
    this.threatStats.bypassAttempts++;
    logger.warn(`⚠️ Tentative de bypass: ${hostname} depuis ${clientIP || 'unknown'} - ${reason}`);
  }

  /**
   * Détermine le type de menace basé sur le nom de domaine (Classification avancée)
   */
  determineThreatType(domain) {
    const lowerDomain = domain.toLowerCase();

    // 1. Remote Desktop (priorité haute car risque FR)
    const remoteDesktopPatterns = [
      'teamviewer', 'anydesk', 'logmein', 'remotedesktop', 'supremo',
      'splashtop', 'ammyy', 'ultraviewer', 'rustdesk', 'chrome-remote',
      'rdp', 'vnc', 'remote-access'
    ];
    if (remoteDesktopPatterns.some(p => lowerDomain.includes(p))) {
      return 'Remote Desktop';
    }

    // 2. Phishing (usurpation d'identité)
    const phishingPatterns = [
      'secure-', 'verify-', 'account-', 'login-', 'signin-', 'update-',
      'confirm-', 'validate-', 'suspended-', 'locked-', 'alert-',
      'paypal', 'bank', 'netflix', 'amazon', 'microsoft', 'apple',
      'service-', 'security-', 'support-'
    ];
    if (phishingPatterns.some(p => lowerDomain.includes(p))) {
      // Vérifier si c'est un sous-domaine suspect (ex: paypal-secure.evil.com)
      const labels = lowerDomain.split('.');
      if (labels.length >= 3) {
        return 'Phishing';
      }
    }

    // 3. Scam / Arnaque
    const scamPatterns = [
      'scam', 'free-money', 'prize', 'winner', 'lottery', 'jackpot',
      'earn-money', 'quick-cash', 'bitcoin-', 'crypto-gift', 'giveaway',
      'millionaire', 'guaranteed', 'claim-now', 'urgent-action'
    ];
    if (scamPatterns.some(p => lowerDomain.includes(p))) {
      return 'Scam';
    }

    // 4. Malware / Virus
    const malwarePatterns = [
      'malware', 'virus', 'trojan', 'ransomware', 'spyware', 'keylogger',
      'botnet', 'backdoor', 'exploit', 'payload', 'rootkit', 'worm',
      'crack', 'keygen', 'activator', 'loader'
    ];
    if (malwarePatterns.some(p => lowerDomain.includes(p))) {
      return 'Malware';
    }

    // 5. Tracking / Adware
    const adwarePatterns = [
      'doubleclick', 'googleadservices', 'googlesyndication', 'advertising',
      'adserver', 'adsystem', 'adnxs', 'openx', 'pubmatic', 'criteo',
      'outbrain', 'taboola', 'tracking', 'tracker', 'analytics',
      'pixel', 'beacon', 'telemetry'
    ];
    if (adwarePatterns.some(p => lowerDomain.includes(p))) {
      return 'Tracking/Adware';
    }

    // 6. C2 / Botnet (Command & Control)
    const c2Patterns = [
      'c2', 'cnc', 'command-', 'control-', 'botnet', 'bot-',
      'panel', 'admin-panel'
    ];
    if (c2Patterns.some(p => lowerDomain.includes(p))) {
      return 'C2/Botnet';
    }

    // 7. Cryptomining (crypto miners non autorisés)
    const cryptoPatterns = [
      'coinhive', 'jsecoin', 'cryptoloot', 'miner', 'mining-',
      'crypto-pool', 'monero-', 'xmr-'
    ];
    if (cryptoPatterns.some(p => lowerDomain.includes(p))) {
      return 'Cryptomining';
    }

    // 8. Typosquatting (domaines similaires à des marques)
    const typoPatterns = [
      'gooogle', 'micros0ft', 'faceb00k', 'netfl1x', 'amaz0n',
      'yah00', 'g00gle', 'youutube', 'tw1tter', 'inst4gram'
    ];
    if (typoPatterns.some(p => lowerDomain.includes(p))) {
      return 'Typosquatting';
    }

    // Par défaut : Malware générique
    return 'Malware';
  }

  /**
   * Envoie une réponse de blocage au client
   */
  sendBlockedResponse(res, hostname, reason) {
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Site Bloqué - CalmWeb</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            padding: 48px;
            text-align: center;
        }
        .icon {
            font-size: 72px;
            margin-bottom: 24px;
        }
        h1 {
            color: #dc2626;
            font-size: 32px;
            margin: 0 0 16px 0;
        }
        p {
            color: #6b7280;
            font-size: 18px;
            line-height: 1.6;
            margin: 0 0 24px 0;
        }
        .domain {
            background: #fee2e2;
            border-radius: 8px;
            color: #991b1b;
            font-family: monospace;
            font-size: 16px;
            padding: 12px 16px;
            margin: 24px 0;
            word-break: break-all;
        }
        .reason {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            color: #92400e;
            font-size: 14px;
            padding: 12px 16px;
            text-align: left;
            margin: 24px 0;
        }
        .footer {
            color: #9ca3af;
            font-size: 14px;
            margin-top: 32px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🛡️</div>
        <h1>Site Bloqué</h1>
        <p>Site bloqué par sécurité.</p>
        <div class="domain">${hostname}</div>
        <div class="reason">
            <strong>Raison :</strong> ${reason}
        </div>
        <p>Ce site a été identifié comme potentiellement dangereux et a été bloqué pour protéger votre ordinateur et vos données personnelles.</p>
        <div class="footer">
            Protégé par CalmWeb
        </div>
    </div>
</body>
</html>
`;

    res.writeHead(403, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html),
      // Security headers (HSTS/CSP enforcement)
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer'
    });
    res.end(html);
  }

  /**
   * Ferme toutes les connexions actives
   */
  closeAllConnections() {
    if (!this.activeConnections || this.activeConnections.size === 0) {
      return 0;
    }

    const count = this.activeConnections.size;
    logger.info(`Fermeture de ${count} connexions actives pour forcer le rechargement des règles`);

    for (const socket of this.activeConnections) {
      try {
        socket.destroy();
      } catch (error) {
        // Ignorer les erreurs
      }
    }

    this.activeConnections.clear();
    return count;
  }

  /**
   * Obtient le statut du serveur
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.server ? this.server.address()?.port : null,
      activeConnections: this.activeConnections.size
    };
  }

  /**
   * Obtient les statistiques (incluant menaces et rate limiting)
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      activeConnections: this.activeConnections.size,
      ...logger.getStats(),
      rateLimiter: this.rateLimiter.getStats(),
      threats: this.threatStats
    };
  }
}

module.exports = ProxyServer;
