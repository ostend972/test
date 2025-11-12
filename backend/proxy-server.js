const http = require('http');
const net = require('net');
const url = require('url');
const { extractHostnameFromPath, extractPortFromPath, looksLikeIP, isStandardPort } = require('./utils');
const logger = require('./logger');

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

    // Vérifier les règles de blocage
    const blockResult = this.shouldBlock(hostname, port, false);

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

    // Ajouter aux connexions actives
    this.activeConnections.add(clientSocket);
    clientSocket.on('close', () => {
      this.activeConnections.delete(clientSocket);
    });

    // Vérifier les règles de blocage
    const blockResult = this.shouldBlock(hostname, targetPort, true);

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
   * @returns {object} { blocked: boolean, reason?: string, source?: string }
   */
  shouldBlock(hostname, port, isHTTPS) {
    const config = this.configManager.get();

    // Si la protection est désactivée, ne rien bloquer
    if (!config.protectionEnabled) {
      return { blocked: false };
    }

    // 1. Vérifier la whitelist d'abord (bypass tout) - avec cache LRU pour performance
    if (this.whitelistManager.isWhitelistedWithCache(hostname)) {
      return { blocked: false };
    }

    // 2. Vérifier si c'est un accès direct par IP
    if (config.blockDirectIPs && looksLikeIP(hostname)) {
      return { blocked: true, reason: 'IP Block', source: 'Règle Système' };
    }

    // 3. Vérifier si c'est du HTTP (force HTTPS)
    if (config.blockHTTPTraffic && !isHTTPS) {
      return { blocked: true, reason: 'HTTP Block', source: 'Règle Système' };
    }

    // 4. Vérifier les ports non-standard
    if (config.blockNonStandardPorts && !isStandardPort(port)) {
      return { blocked: true, reason: 'Port Block', source: 'Règle Système' };
    }

    // 5. Vérifier la blocklist - avec cache LRU pour performance
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
   * Détermine le type de menace basé sur le nom de domaine
   */
  determineThreatType(domain) {
    const lowerDomain = domain.toLowerCase();

    // Patterns de détection
    if (lowerDomain.includes('teamviewer') || lowerDomain.includes('anydesk') ||
        lowerDomain.includes('logmein') || lowerDomain.includes('remotedesktop')) {
      return 'Remote Desktop';
    }

    if (lowerDomain.includes('scam') || lowerDomain.includes('free-money') ||
        lowerDomain.includes('prize') || lowerDomain.includes('winner')) {
      return 'Scam';
    }

    if (lowerDomain.includes('phishing') || lowerDomain.includes('secure-bank') ||
        lowerDomain.includes('paypal-verify') || lowerDomain.includes('account-verify')) {
      return 'Phishing';
    }

    if (lowerDomain.includes('ad') || lowerDomain.includes('ads') ||
        lowerDomain.includes('doubleclick') || lowerDomain.includes('analytics')) {
      return 'Adware';
    }

    if (lowerDomain.includes('malware') || lowerDomain.includes('virus') ||
        lowerDomain.includes('trojan') || lowerDomain.includes('download')) {
      return 'Malware';
    }

    // Par défaut
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
      'Content-Length': Buffer.byteLength(html)
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
   * Obtient les statistiques
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      activeConnections: this.activeConnections.size,
      ...logger.getStats()
    };
  }
}

module.exports = ProxyServer;
