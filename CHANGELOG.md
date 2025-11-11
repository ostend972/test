# Changelog - CalmWeb

> **🚀 Version de lancement officielle : 1.0.7**
>
> Application de protection web complète avec proxy de filtrage et mises à jour automatiques silencieuses.

Toutes les modifications notables de ce projet seront documentées dans ce fichier selon le format [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [1.0.7] - 2025-11-11 🎉 VERSION DE LANCEMENT OFFICIELLE

**Première release publique stable - Recommandée pour tous les utilisateurs**

### ✨ Amélioré
- **Monitoring en temps réel optimisé** : Les logs techniques se rafraîchissent maintenant sans restriction
  - Rate limiter augmenté de 100 à 999999 appels par minute dans `preload.js:11`
  - Suppression des contraintes de refetch dans React Query (`LogPage.tsx:29-32`)
  - Mise à jour instantanée des logs pour un monitoring optimal
  - Aucun délai d'attente lors de la consultation des logs techniques

### 🎯 Fonctionnalités principales
- ✅ Mises à jour automatiques 100% silencieuses
- ✅ Proxy de filtrage HTTP/HTTPS (127.0.0.1:8081)
- ✅ Protection contre phishing, malware, arnaques et publicités
- ✅ Blocklists externes (StevenBlack, Hagezi, URLhaus, PhishTank)
- ✅ Whitelist et blocklist personnalisables
- ✅ Dashboard de monitoring en temps réel
- ✅ Statistiques de blocage détaillées
- ✅ Intégration Windows (proxy système, démarrage automatique)
- ✅ Logs persistants et diagnostics complets

### 📦 Installation
- **Téléchargement** : [CalmWeb-Setup-1.0.7.exe](https://github.com/ostend972/test/releases/download/v1.0.7/CalmWeb-Setup-1.0.7.exe)
- **Taille** : 162.7 MB
- **Pré-requis** : Windows 10/11
- **Mises à jour futures** : Automatiques et silencieuses

### 📋 Informations techniques
- **Proxy** : 127.0.0.1:8081 par défaut
- **Configuration** : `%APPDATA%\CalmWeb\config.json`
- **Logs** : `%APPDATA%\CalmWeb\logs-persistent.json`
- **Whitelist** : `%APPDATA%\CalmWeb\whitelist.json`

---

<details>
<summary><strong>📜 Historique de développement (versions de test précédentes)</strong></summary>

> Les versions ci-dessous sont des versions de développement et de test qui ont précédé le lancement officiel.
> Elles ne sont plus disponibles au téléchargement.

## [1.0.6] - 2025-11-11 🔧 VERSION DE TEST

**Statut** : Version stable (remplacée par v1.0.7)

### 🐛 Corrigé
- **Popup de désinstallation supprimé** : Le dialogue "Voulez-vous conserver vos données ?" ne s'affiche plus lors des mises à jour automatiques
  - Ajout de détection du mode silencieux dans `installer.nsh:114-128`
  - Conservation automatique des données lors des mises à jour silencieuses

- **Relancement automatique** : L'application se relance automatiquement après une mise à jour silencieuse
  - Implémentation dans `installer.nsh:104-109`
  - Relancement avec le flag `--minimized`

### ✨ Amélioration
- Installation 100% silencieuse sans aucune interaction utilisateur
- Relancement automatique avec le mode minimisé
- Expérience utilisateur optimale pour les mises à jour

---

## [1.0.5] - 2025-11-11 🧪 VERSION DE TEST

**Statut** : Version de test intermédiaire (remplacée par v1.0.6)

### 📝 Note
- Version de validation pour les mises à jour 100% silencieuses
- Aucune modification fonctionnelle
- A permis de valider que la v1.0.4 se mettait à jour automatiquement vers v1.0.5

---

## [1.0.4] - 2025-11-11 🔧 VERSION INTERMÉDIAIRE

**Statut** : Version stable (remplacée par v1.0.6)

### 🐛 Corrigé
- **Popup d'installation supprimé** : Le dialogue "Installer maintenant / Installer à la fermeture" a été désactivé
  - Modification dans `backend/updater.js:105`
  - Commentaire de `showInstallPrompt(info)`

- **Mises à jour 100% silencieuses** : Les mises à jour s'installent sans aucune interaction
  - Installation automatique à la fermeture de l'application
  - Relancement automatique avec droits administrateur après installation

---

## [1.0.3] - 2025-11-11 🧪 VERSION DE TEST

**Statut** : Version de test intermédiaire (remplacée par v1.0.4)

### 📝 Note
- Version de validation pour le système de mise à jour silencieuse
- Aucune modification fonctionnelle
- A permis de valider que la v1.0.2 se mettait à jour automatiquement vers v1.0.3

---

## [1.0.2] - 2025-11-11 🔧 VERSION INTERMÉDIAIRE

**Statut** : Première version avec mises à jour silencieuses (remplacée par v1.0.7)

### ✨ Amélioré
- **Mises à jour silencieuses** : Les mises à jour se téléchargent et s'installent automatiquement sans interaction utilisateur
  - Téléchargement automatique activé (`autoDownload: true`)
  - Installation automatique à la fermeture de l'application
  - Pas de boîte de dialogue de notification
  - Logs détaillés des opérations de mise à jour
  - Interface utilisateur optionnelle via le dashboard (événements IPC)

### 🔧 Technique
- Configuration de `electron-updater` pour le mode silencieux
- Notifications désactivées pour une expérience fluide
- Mise à jour différentielle toujours active via `.blockmap`

---

## [1.0.1] - 2025-11-11 🔧 VERSION INTERMÉDIAIRE

**Statut** : Configuration initiale de l'auto-updater

### ✨ Amélioré
- **Configuration GitHub** : Ajout de la configuration du repository pour les mises à jour automatiques
  - Repository configuré : https://github.com/ostend972/test
  - Auto-updater pleinement fonctionnel

### 🔧 Technique
- Configuration du système de mises à jour automatiques via GitHub Releases
- Version de validation du fonctionnement de l'auto-updater

---

## [1.0.0] - 2025-11-11 🎉 PREMIÈRE VERSION MAJEURE

**Statut** : Première version stable complète (remplacée par v1.0.7)

### ✨ Nouveautés
- **Option "Useful Domains"** : Nouvelle option dans les paramètres permettant aux utilisateurs avancés d'activer une liste de domaines techniques utiles (GitHub, Discord, Chocolatey, etc.)
  - Décochée par défaut pour la sécurité
  - 6 domaines disponibles : github.com, githubusercontent.com, chocolatey.org, discord.com, cdn.discordapp.com, storage.googleapis.com
  - URL configurable : `https://raw.githubusercontent.com/Tontonjo/calmweb/main/filters/usefull_domains.txt`

- **Logs détaillés améliorés** : Les logs affichent maintenant des informations détaillées lors des opérations critiques
  - Nombre exact de domaines téléchargés
  - Détails de chaque domaine ajouté à la whitelist
  - Messages de confirmation visuels avec séparateurs
  - Statistiques complètes lors du rechargement de la blocklist

- **Persistance des logs à vie** : Les logs ne sont plus supprimés automatiquement
  - Désactivation du nettoyage automatique mensuel
  - Historique complet conservé pour l'audit et le débogage

### 🐛 Corrigé
- **Désactivation du proxy à l'extinction** : Le proxy système est maintenant correctement désactivé lors de l'arrêt de Windows
  - Utilisation de commandes synchrones (`execSync`) pour garantir l'exécution
  - Mécanisme de récupération en cas d'erreur
  - Double sécurité avec `before-quit` et `shutdown` events
  - Logs détaillés de l'opération d'arrêt

- **Race condition sur l'écriture des logs** : Correction d'un bug critique où les logs se perdaient
  - Implémentation d'un système de queue pour les écritures séquentielles
  - Les logs ne s'écrasent plus mutuellement lors d'écritures simultanées
  - Garantie de l'ordre chronologique des entrées

- **Chargement de la whitelist GitHub** : Amélioration du processus de téléchargement
  - Logs plus détaillés montrant le nombre de domaines ajoutés
  - Gestion d'erreurs améliorée
  - URL configurée : `https://raw.githubusercontent.com/Tontonjo/calmweb/main/filters/whitelist.txt`

### 🔧 Améliorations
- **Logs de rechargement de la blocklist** : Affichage détaillé lors du rechargement
  - Nombre de domaines externes
  - Nombre de domaines personnalisés
  - Différentiel (+X domaines) par rapport au chargement précédent
  - Format visuel amélioré avec séparateurs

- **Messages d'activation/désactivation** : Messages clairs et informatifs
  - Indication si les domaines ont déjà été téléchargés
  - Compte total de la whitelist
  - Note explicative lors de la désactivation

### 🔧 Technique
- **Système de queue pour les logs** : Nouvelle architecture pour éviter les conflits
  - `logWriteQueue` pour les logs système
  - `eventWriteQueue` pour les événements de sécurité
  - Promesses chaînées garantissant l'ordre d'exécution

- **Nettoyage du code** : Retrait de tous les éléments de debug
  - DevTools désactivés en production
  - Logs `console.log()` de debug supprimés
  - Conservation des logs utilisateur pertinents
  - Code optimisé et commenté

### 📋 Informations techniques
- **Compatibilité** : Windows 10/11
- **Proxy** : 127.0.0.1:8081 par défaut
- **Configuration** : `%APPDATA%\CalmWeb\config.json`
- **Logs** : `%APPDATA%\CalmWeb\logs-persistent.json`
- **Whitelist** : `%APPDATA%\CalmWeb\whitelist.json`

### ⚠️ Breaking Changes
Aucun - Cette version est compatible avec les configurations existantes.

---

## [0.9.0] - Version bêta 🧪

**Statut** : Version de développement initiale (remplacée par v1.0.0)

### 🎯 Fonctionnalités de base
- Proxy de filtrage HTTP/HTTPS
- Blocklists externes (StevenBlack, Hagezi, URLhaus, etc.)
- Whitelist personnalisable
- Intégration système Windows (proxy, firewall, démarrage automatique)
- Dashboard de monitoring en temps réel
- Statistiques de blocage
- Gestion des mises à jour automatiques

</details>

---

## 📚 Légende des symboles

- 🎉 **VERSION DE LANCEMENT OFFICIELLE** : Première release publique stable
- ✨ **Améliorations** : Nouvelles fonctionnalités ou optimisations
- 🐛 **Corrections** : Résolution de bugs
- 🔧 **Technique** : Améliorations techniques et optimisations
- 📋 **Informations** : Informations de déploiement et configuration
- ⚠️ **Breaking Changes** : Changements incompatibles avec les versions précédentes

---

## 🔗 Liens utiles

- **Repository GitHub** : https://github.com/ostend972/test
- **Dernière version** : https://github.com/ostend972/test/releases/latest
- **Toutes les versions** : https://github.com/ostend972/test/releases

---

**Format du changelog** : Ce fichier suit les conventions de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et le [Semantic Versioning](https://semver.org/lang/fr/).
