# Changelog

Toutes les modifications notables de CalmWeb seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

#### Page Logs (LogPage.tsx)
- **Boutons dynamiques liste blanche/noire** : Les boutons "Ajouter" se transforment en "Retirer" si le domaine est déjà présent dans la liste correspondante
- **Filtre par type** : Nouveau filtre permettant de filtrer les événements par "Bloqués", "Autorisés" ou "Tous les types"
- **Auto-refresh** : Actualisation automatique des logs toutes les 5 secondes pour afficher les événements en temps réel
- **Mutations de suppression** : Ajout des fonctions `deleteWhitelistDomain` et `deleteBlocklistDomain` pour retirer des domaines des listes

#### Tableau de Bord (Dashboard)
- **Carte "Autorisés aujourd'hui"** : Nouvelle carte statistique affichant le nombre de connexions autorisées dans la journée
- **Auto-refresh ThreatAnalysis** : Actualisation automatique de l'analyse des menaces toutes les 30 secondes
- **Auto-refresh ProtectionStatus** : Actualisation automatique de l'état de protection toutes les 10 secondes
- **Auto-refresh BlockChart** : Actualisation automatique du graphique des blocages toutes les 60 secondes
- **Auto-refresh TopThreats** : Actualisation automatique du top des menaces toutes les 15 secondes
- **Throttling BlockChart** : Limitation des mises à jour WebSocket à 1 par seconde maximum pour éviter les problèmes de performance lors de blocages massifs

### Modifié

#### Backend (logger.js)
- **Rotation des logs** : Augmentation de la durée de conservation des logs de 30 à 31 jours
  - Modification de la date limite de suppression (lignes 377-379, 407-408)
  - Mise à jour de l'intervalle de nettoyage (ligne 431-432)
  - Mise à jour du commentaire de documentation (ligne 57)

#### Page Logs (LogPage.tsx)
- **Optimisation des performances** : Utilisation de `Set` avec `useMemo` pour des recherches O(1) au lieu de `.some()` O(n) lors de la vérification de la présence d'un domaine dans les listes
- **Grille de filtres** : Passage de 3 à 4 colonnes pour inclure le nouveau filtre par type

#### Tableau de Bord (Dashboard)
- **StatsCards.tsx** : Layout modifié de 3 à 4 colonnes (`md:grid-cols-3` → `lg:grid-cols-4`) pour afficher la nouvelle carte
- **BlockChart.tsx** :
  - Ajout de `useRef` pour le throttling
  - Configuration améliorée de l'axe X : `interval={2}`, `angle={-45}`, `textAnchor="end"`, `height={60}`

### Corrigé

#### Tableau de Bord (Dashboard)
- **BlockChart** : Correction de la disposition des heures sur l'axe X
  - Les labels s'affichent maintenant tous les 2 heures au lieu de tous
  - Rotation des labels à -45° pour éviter les chevauchements
  - Augmentation de la hauteur de l'axe X pour un meilleur affichage

### Performances

#### Page Logs
- **Recherche dans les listes** : Amélioration de la complexité algorithmique de O(n) à O(1) pour la vérification des domaines dans les listes blanche/noire

#### Tableau de Bord
- **BlockChart WebSocket** : Throttling des mises à jour à 1 par seconde maximum pour éviter les re-renders excessifs lors de blocages en rafale

---

## [1.0.0] - Date de sortie initiale

### Ajouté
- Interface utilisateur complète avec React et Electron
- Système de proxy de filtrage HTTP/HTTPS
- Protection contre les sites malveillants, phishing et arnaques
- Blocage des logiciels de contrôle à distance (TeamViewer, AnyDesk)
- Blocage des connexions IP directes
- Listes blanche et noire personnalisables
- Intégration de listes de blocage externes (StevenBlack, Easylist FR, Hagezi, Red Flag Domains)
- Tableau de bord avec statistiques en temps réel
- Graphique des blocages sur 24 heures
- Système de logs persistants avec rotation automatique
- Configuration système automatique (Proxy Windows, Pare-feu, Démarrage automatique)
- WebSocket pour les mises à jour en temps réel
- Tests de sécurité (validation des entrées, prévention d'injection de commandes)
