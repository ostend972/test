# Modifications apportées à CalmWeb

## 🔄 Résumé des changements

### 1. Rotation des logs (backend/logger.js)
- **AVANT** : Logs conservés pendant 30 jours
- **APRÈS** : Logs conservés pendant 31 jours

### 2. Tableau de Bord - Cartes statistiques (components/Dashboard/StatsCards.tsx)
- **AVANT** : 3 cartes affichées
  - Bloqués aujourd'hui
  - Total bloqués
  - Dernière menace
- **APRÈS** : 4 cartes affichées
  - Bloqués aujourd'hui
  - **Autorisés aujourd'hui** ← NOUVELLE CARTE
  - Total bloqués
  - Dernière menace
- Layout changé de `md:grid-cols-3` à `lg:grid-cols-4`
- Auto-refresh activé (toutes les 5 secondes)

### 3. Tableau de Bord - Graphique BlockChart (components/Dashboard/BlockChart.tsx)
- **AVANT** : Heures superposées et illisibles
- **APRÈS** :
  - Heures espacées (affichage tous les 2 heures)
  - Labels tournés à -45°
  - Hauteur de l'axe X augmentée à 60px
- Throttling WebSocket : 1 update max par seconde
- Auto-refresh : toutes les 60 secondes

### 4. Page Logs (components/Logs/LogPage.tsx)
- **AVANT** : 3 filtres
  - Recherche par domaine
  - Filtre par Raison
  - Filtre par Source
- **APRÈS** : 4 filtres
  - Recherche par domaine
  - **Filtre par Type (Bloqués/Autorisés/Tous)** ← NOUVEAU
  - Filtre par Raison
  - Filtre par Source

#### Boutons dynamiques
- **AVANT** : Boutons statiques "Ajouter à la liste blanche/noire"
- **APRÈS** : Boutons qui changent selon l'état
  - Si domaine DANS liste blanche → "Retirer de la liste blanche"
  - Si domaine PAS dans liste blanche → "Ajouter à la liste blanche"
  - Pareil pour liste noire

#### Performance
- **AVANT** : Recherche O(n) avec `.some()`
- **APRÈS** : Recherche O(1) avec `Set.has()`
- Auto-refresh : toutes les 5 secondes

### 5. Autres composants Dashboard
- **ThreatAnalysis** : Auto-refresh toutes les 30 secondes
- **ProtectionStatus** : Auto-refresh toutes les 10 secondes
- **TopThreats** : Auto-refresh toutes les 15 secondes

## 📁 Fichiers modifiés

1. `backend/logger.js` - Rotation 31 jours
2. `components/Dashboard/StatsCards.tsx` - 4ème carte + auto-refresh
3. `components/Dashboard/BlockChart.tsx` - Fixes chart + throttling
4. `components/Dashboard/ThreatAnalysis.tsx` - Auto-refresh
5. `components/Dashboard/ProtectionStatus.tsx` - Auto-refresh
6. `components/Dashboard/TopBlockedCategories.tsx` - Auto-refresh
7. `components/Logs/LogPage.tsx` - 4 filtres + boutons dynamiques + perf
8. `vite.config.ts` - Forcer nouveau hash à chaque build
9. `main.js` - Cache désactivé

## ✅ Comment vérifier

### Dans l'application :
1. **Aller sur le Tableau de Bord**
   - Compter les cartes : il devrait y en avoir **4**
   - La 2ème carte devrait dire "Autorisés aujourd'hui"

2. **Regarder le graphique**
   - Les heures sur l'axe X ne devraient PAS se superposer
   - Elles devraient être inclinées à -45°

3. **Aller sur la page Logs**
   - Compter les filtres : il devrait y en avoir **4**
   - Le nouveau devrait dire "Tous les types" / "Bloqués" / "Autorisés"
   - Ajouter un domaine à la liste blanche puis regarder : le bouton devrait changer

### Si vous ne voyez RIEN :
1. Ouvrir les DevTools (F12)
2. Aller dans Console
3. Vérifier s'il y a des erreurs en rouge
4. M'envoyer une capture d'écran
