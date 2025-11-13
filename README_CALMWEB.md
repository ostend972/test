# CalmWeb - Protection Web Complète

Application Electron de protection web avec proxy de filtrage intelligent, blocage de sites malveillants, arnaques, publicités et logiciels de contrôle à distance.

## 🛡️ Fonctionnalités

### Protection Multi-Couches
- ✅ **Blocage de sites malveillants** : Phishing, malware, scams
- ✅ **Blocage de publicités** : Sources multiples (StevenBlack, EasyList FR, etc.)
- ✅ **Blocage d'outils de contrôle à distance** : TeamViewer, AnyDesk, LogMeIn
- ✅ **Force HTTPS** : Bloque les connexions HTTP non sécurisées
- ✅ **Blocage d'accès IP directs** : Empêche les contournements
- ✅ **Filtrage de ports** : Autorise seulement les ports standards (80, 443, VoIP)

### Sources de Blocklists (5 sources)
1. **URLhaus** (abuse.ch) - Format hosts
2. **StevenBlack/hosts** - Format hosts
3. **HaGeZi Ultimate** - Format liste simple
4. **Phishing Army** - Format liste simple
5. **Liste FR** (EasyList) - Format hosts

### Gestion Avancée
- **Whitelist/Blocklist personnalisées**
- **Support wildcards** (*.example.com)
- **Support CIDR** (192.168.0.0/16)
- **Import/Export CSV**
- **Dashboard temps réel** avec graphiques
- **Logs de sécurité** complets
- **Analyse de menaces** avec recommandations

### Intégration Système Windows
- Configuration automatique du proxy système
- Règle firewall Windows
- Tâche planifiée pour auto-start
- Installation dans Program Files
- Requiert privilèges administrateur

## 📋 Prérequis

- **Windows 10/11**
- **Node.js 16+** (pour le développement)
- **Privilèges Administrateur** (pour l'installation système)

## 🚀 Installation

### Mode Développement

1. **Cloner/Copier le projet**
```bash
cd C:\Users\Alan\Desktop\Firewall
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Lancer l'application**
```bash
npm start
```

### Build Production

1. **Créer l'exécutable**
```bash
npm run build:win
```

L'exécutable sera dans le dossier `dist/`

2. **Installer l'application**
- Exécuter l'installateur en tant qu'administrateur
- Suivre les instructions
- L'application sera installée dans `C:\Program Files\CalmWeb`
- Une tâche planifiée sera créée pour le démarrage automatique

## 🎯 Utilisation

### Premier Lancement

1. **Lancer CalmWeb** (en tant qu'administrateur la première fois)
2. L'application va :
   - Créer la configuration dans `%APPDATA%\CalmWeb\`
   - Télécharger les blocklists (peut prendre 1-2 minutes)
   - Configurer le proxy système sur `127.0.0.1:8081`
   - Activer la règle firewall

3. **Le dashboard s'ouvre** et affiche :
   - Statut de protection en temps réel
   - Statistiques de blocage
   - Graphique 24h
   - Feed d'événements en direct
   - Top domaines bloqués

### Navigation dans le Dashboard

#### 📊 Dashboard
- Vue d'ensemble de la protection
- Statistiques en temps réel
- Graphique des blocages sur 24h
- Analyse de menaces avec recommandations

#### 📝 Whitelist
- Ajouter des domaines autorisés
- Supporte :
  - Domaines exacts : `google.com`
  - Wildcards : `*.microsoft.com`
  - IP : `192.168.1.1`
  - CIDR : `10.0.0.0/8`
- Import/Export CSV

#### 🚫 Blocklist
- Ajouter des domaines personnalisés à bloquer
- Complémentaire aux blocklists automatiques
- Import/Export CSV

#### ⚙️ Paramètres
- **Activer/Désactiver la protection**
- **Options de blocage** :
  - IP directs
  - HTTP (force HTTPS)
  - Ports non-standard
  - Remote Desktop
- **Sources de blocklists** (activer/désactiver)
- **Intervalle de mise à jour** (1h, 6h, 12h, 24h)
- **Port du proxy** (par défaut 8081)

#### 📋 Logs
- **Historique de sécurité** : Tous les blocages/autorisations
- **Logs techniques** : INFO, WARNING, ERROR
- **Export** : Fichiers TXT
- **Rapport diagnostique** complet

### Bouton d'Urgence 🚨

En haut à droite du dashboard :
- **Désactive temporairement la protection** (15 minutes)
- Utile si un site légitime est bloqué par erreur
- Se réactive automatiquement

## 🔧 Configuration Avancée

### Fichier de Configuration

Emplacement : `%APPDATA%\CalmWeb\config.json`

```json
{
  "protectionEnabled": true,
  "blockDirectIPs": true,
  "blockHTTPTraffic": true,
  "blockNonStandardPorts": true,
  "blockRemoteDesktop": true,
  "proxyPort": 8081,
  "proxyHost": "127.0.0.1",
  "updateInterval": 24,
  "blocklistSources": {
    "urlhaus": true,
    "stevenBlack": true,
    "hageziUltimate": true,
    "phishingArmy": true,
    "easylistFR": true
  }
}
```

### Whitelist

Emplacement : `%APPDATA%\CalmWeb\whitelist.json`

Domaines essentiels pré-configurés :
- `microsoft.com` et `*.microsoft.com`
- `windowsupdate.com` et `*.windowsupdate.com`
- `update.microsoft.com`
- Réseaux locaux : `192.168.0.0/16`, `10.0.0.0/8`, `127.0.0.0/8`

### Blocklist Cache

Emplacement : `%APPDATA%\CalmWeb\blocklist_cache.txt`

- Contient tous les domaines bloqués (plusieurs dizaines de milliers)
- Mis à jour automatiquement selon l'intervalle configuré
- Peut être forcé via le bouton "Mettre à jour" dans les paramètres

## 🛠️ Dépannage

### Le proxy ne démarre pas

1. Vérifier que le port 8081 n'est pas déjà utilisé
2. Lancer en tant qu'administrateur
3. Vérifier les logs dans l'onglet Logs

### Sites légitimes bloqués

1. Ajouter le domaine à la **Whitelist**
2. Ou désactiver temporairement avec le bouton d'urgence
3. Vérifier quelle source a bloqué le site (voir logs)

### Le proxy système n'est pas configuré

1. Aller dans **Paramètres** > Section "Intégrité du Système"
2. Cliquer sur **"Tenter une réparation"**
3. Si ça ne fonctionne pas, relancer l'installation

### Désinstallation

1. **Arrêter CalmWeb**
2. **Aller dans Paramètres** > Désactiver la protection
3. **Désinstaller** via Windows (Ajouter/Supprimer des programmes)
4. Le proxy système sera automatiquement désactivé

## 📁 Structure du Projet

```
Firewall/
├── backend/                   # Backend Node.js
│   ├── index.js              # Orchestrateur principal
│   ├── proxy-server.js       # Serveur proxy HTTP/HTTPS
│   ├── blocklist-manager.js  # Gestion des blocklists
│   ├── whitelist-manager.js  # Gestion de la whitelist
│   ├── config-manager.js     # Configuration
│   ├── system-integration.js # Intégration Windows
│   ├── logger.js             # Système de logging
│   └── utils.js              # Utilitaires
├── components/               # Composants React
│   ├── Dashboard/            # Dashboard principal
│   ├── Lists/                # Gestion listes
│   ├── Settings/             # Paramètres
│   ├── Logs/                 # Logs
│   └── ui/                   # Composants UI
├── services/                 # Services frontend
├── stores/                   # État global (Zustand)
├── hooks/                    # Hooks React personnalisés
├── main.js                   # Electron main process
├── preload.js                # Electron preload (IPC bridge)
├── index.html                # HTML principal
├── App.tsx                   # Composant React principal
└── package.json              # Dépendances et scripts
```

## 🔐 Sécurité

- ✅ **Pas de collecte de données** : Tout est local
- ✅ **Open source** : Code transparent
- ✅ **Mises à jour automatiques** des blocklists
- ✅ **Protection en temps réel**
- ✅ **Blocage DNS** avant la connexion
- ✅ **Logs détaillés** pour audit

## 📊 Performance

- **Temps de démarrage** : 2-5 secondes
- **Utilisation mémoire** : ~100-150 MB
- **Utilisation CPU** : <1% en idle
- **Blocklists** : 50,000+ domaines
- **Latence proxy** : <10ms pour domaines whitelistés
- **Mise en cache** : Blocklists en RAM pour performances optimales

## 🐛 Problèmes Connus

- **Windows Defender** peut signaler l'exécutable au premier lancement (faux positif car non signé)
- **UAC** demandera confirmation pour les privilèges admin
- **Antivirus** tiers peuvent bloquer la modification du proxy système

## 📝 Licence

MIT License - Libre d'utilisation et modification

## 👥 Support

Pour tout problème :
1. Consulter les **Logs** dans l'application
2. Générer un **Rapport Diagnostique**
3. Vérifier ce README

## 🚧 Développement Futur

Fonctionnalités prévues :
- [ ] Mode Tray (icône système)
- [ ] Planification de désactivation automatique
- [ ] Filtrage par catégories personnalisées
- [ ] Support macOS/Linux
- [ ] API REST pour contrôle externe
- [ ] Synchronisation cloud des listes

---

**Développé avec ❤️ pour protéger les utilisateurs vulnérables**

Version 1.0.0 - 2025
