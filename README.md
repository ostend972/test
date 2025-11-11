# CalmWeb 🛡️

> **Application de protection web complète avec proxy de filtrage intelligent**

[![Version](https://img.shields.io/github/v/release/ostend972/test?label=Version)](https://github.com/ostend972/test/releases/latest)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE.txt)
[![Windows](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?logo=windows)](https://github.com/ostend972/test/releases/latest)

CalmWeb est une solution de protection web avancée qui protège votre navigation contre le phishing, les malwares, les arnaques et les publicités intrusives. L'application fonctionne via un proxy local intelligent qui filtre les connexions en temps réel.

## ✨ Fonctionnalités principales

- 🛡️ **Protection multicouche** : Blocage phishing, malware, arnaques, publicités
- 🔄 **Mises à jour automatiques** : Système de mise à jour 100% silencieux
- 📊 **Dashboard en temps réel** : Monitoring des connexions et statistiques
- 🎯 **Blocklists externes** : StevenBlack, Hagezi, URLhaus, PhishTank
- ⚙️ **Configuration flexible** : Whitelist/Blocklist personnalisables
- 🔒 **Intégration système** : Proxy Windows, démarrage automatique
- 📝 **Logs persistants** : Historique complet pour audit et diagnostic
- 🚀 **Performances optimales** : Filtrage rapide sans ralentissement

## 📦 Installation

### Pré-requis

- Windows 10/11 (64-bit)
- Droits administrateur (requis pour la configuration du proxy système)

### Téléchargement

[**📥 Télécharger CalmWeb v1.0.7**](https://github.com/ostend972/test/releases/download/v1.0.7/CalmWeb-Setup-1.0.7.exe)

Taille: 162.7 MB

### Installation

1. Téléchargez le fichier d'installation
2. Exécutez `CalmWeb-Setup-1.0.7.exe`
3. Suivez les instructions de l'assistant d'installation
4. L'application se lance automatiquement

## 🚀 Utilisation

### Premier lancement

1. **Démarrage automatique** : CalmWeb démarre avec Windows
2. **Configuration proxy** : Le proxy système (127.0.0.1:8081) est configuré automatiquement
3. **Dashboard** : Accessible depuis l'icône de la barre des tâches

### Fonctionnalités du Dashboard

- **Vue d'ensemble** : Statistiques de blocage en temps réel
- **Paramètres** : Configuration de la whitelist/blocklist
- **Logs de sécurité** : Historique des connexions bloquées/autorisées
- **Logs techniques** : Diagnostic et débogage
- **À propos** : Informations sur la version et mises à jour

### Personnalisation

#### Ajouter des domaines à la whitelist

```
1. Ouvrez le Dashboard
2. Allez dans "Paramètres"
3. Section "Whitelist"
4. Ajoutez le domaine (exemple: example.com)
5. Cliquez sur "Ajouter"
```

#### Ajouter des domaines à la blocklist

```
1. Ouvrez le Dashboard
2. Allez dans "Paramètres"
3. Section "Blocklist personnalisée"
4. Ajoutez le domaine malveillant
5. Cliquez sur "Ajouter"
```

## 🔧 Configuration

### Fichiers de configuration

Les fichiers de configuration sont stockés dans :
```
%APPDATA%\CalmWeb\
├── config.json              # Configuration générale
├── logs-persistent.json     # Logs système
├── whitelist.json          # Domaines autorisés
└── custom_blocklist.json   # Blocklist personnalisée
```

### Proxy

- **Adresse** : 127.0.0.1
- **Port** : 8081 (par défaut)
- **Protocoles** : HTTP, HTTPS

## 🛠️ Développement

### Technologies

- **Frontend** : React 19, TypeScript, Vite
- **Backend** : Node.js, Electron 28
- **State Management** : Zustand, React Query
- **UI** : TailwindCSS
- **Build** : electron-builder

### Installation pour le développement

```bash
# Cloner le repository
git clone https://github.com/ostend972/test.git
cd test

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev

# Compiler pour Windows
npm run build:win
```

### Structure du projet

```
CalmWeb/
├── main.js                 # Processus principal Electron
├── preload.js             # Script de préchargement sécurisé
├── index.html             # Point d'entrée HTML
├── backend/               # Logique serveur
│   ├── proxy.js          # Serveur proxy
│   ├── blocklist.js      # Gestion des blocklists
│   ├── firewall.js       # Règles firewall
│   └── updater.js        # Système de mise à jour
├── components/            # Composants React
├── services/             # Services API
├── stores/               # Stores Zustand
└── dist/                 # Build de production
```

## 📚 Documentation

- [CHANGELOG.md](CHANGELOG.md) - Historique des versions
- [CONTRIBUTING.md](CONTRIBUTING.md) - Guide de contribution
- [SECURITY.md](SECURITY.md) - Politique de sécurité

## 🔒 Sécurité

### Rapporter une vulnérabilité

Si vous découvrez une vulnérabilité de sécurité, veuillez consulter [SECURITY.md](SECURITY.md) pour les instructions de signalement.

### Fonctionnalités de sécurité

- ✅ Validation stricte des domaines
- ✅ Protection contre les injections
- ✅ Sandboxing Electron activé
- ✅ Context isolation
- ✅ Rate limiting des API
- ✅ Logs d'audit complets

## 🤝 Contribution

Les contributions sont les bienvenues! Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines.

### Développeurs

- Code review sur toutes les PR
- Tests requis pour les nouvelles fonctionnalités
- Respect des conventions de code

## 📄 License

Ce projet est sous license GPL-3.0. Voir [LICENSE.txt](LICENSE.txt) pour plus de détails.

## 🔗 Liens

- **Repository** : https://github.com/ostend972/test
- **Releases** : https://github.com/ostend972/test/releases
- **Issues** : https://github.com/ostend972/test/issues

## 📊 Statistiques

- **Version actuelle** : 1.0.7
- **Taille de l'installation** : ~163 MB
- **Plateforme** : Windows 10/11
- **Architecture** : x64

## 💬 Support

Pour toute question ou problème :

1. Consultez la [documentation](https://github.com/ostend972/test/wiki)
2. Recherchez dans les [issues existantes](https://github.com/ostend972/test/issues)
3. Créez une [nouvelle issue](https://github.com/ostend972/test/issues/new) si nécessaire

---

**Développé avec ❤️ pour une navigation web plus sûre**

CalmWeb © 2025 - Tous droits réservés
