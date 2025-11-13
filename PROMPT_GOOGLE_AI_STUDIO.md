# Prompt pour Google AI Studio - CalmWeb Frontend

## 🎯 Contexte du Projet

Tu es un expert en développement frontend React/TypeScript pour une application Electron. Tu dois créer une interface utilisateur moderne et sécurisée pour **CalmWeb**, une application de protection web complète avec proxy de filtrage.

## 📋 Description de l'Application

**CalmWeb** est une application de cybersécurité pour Windows qui protège les utilisateurs contre :
- Phishing et sites malveillants
- Malware et adware
- Arnaques (scam)
- Contrôle à distance non autorisé (Remote Desktop)
- Publicités intrusives

**Architecture technique :**
- **Frontend** : React 19 + TypeScript + TailwindCSS (CDN)
- **Backend** : Electron IPC + Node.js
- **Build** : Vite 7.2.2
- **State Management** : Zustand + @tanstack/react-query
- **Charting** : Recharts

## 🔌 APIs Backend Disponibles (Electron IPC)

Toutes les APIs sont accessibles via `window.electronAPI` grâce au preload script :

### 📊 Dashboard & Statistiques
```typescript
// Statistiques du tableau de bord
getDashboardStats(): Promise<DashboardStats>
// Retourne: { blockedToday: {value, trend}, totalBlocked, lastThreat, proxyStatus }

// Données pour graphiques (bloquages dans le temps)
getChartData(): Promise<ChartDataPoint[]>
// Retourne: [{ time: "14:30", blocks: 45 }, ...]

// Top des catégories bloquées
getTopBlockedCategories(): Promise<BlockedCategory[]>
// Retourne: [{ name: "Phishing", count: 1234 }, ...]

// Analyse des menaces (IA)
getThreatAnalysis(): Promise<ThreatAnalysis>
// Retourne: { title, summary, recommendation }

// Top des domaines bloqués
getTopBlockedDomains(): Promise<TopBlockedDomain[]>
// Retourne: [{ domain, count, threatType, source }, ...]

// Détails du statut de protection
getProtectionStatusDetails(): Promise<ProtectionStatusDetails>
// Retourne: { layers: [{ id, name, description, status }, ...] }

// Statut de l'intégrité système
getSystemIntegrityStatus(): Promise<SystemIntegrityStatus>
// Retourne: { proxy, firewall, startupTask }
```

### 🔐 Proxy & Protection
```typescript
// Statut du proxy
getProxyStatus(): Promise<'active' | 'inactive'>

// Désactiver la protection (urgence)
disableProtection(): Promise<void>

// Réparer le système
repairSystem(): Promise<void>
```

### 📝 Listes Blanche/Noire
```typescript
// Liste blanche
getWhitelist(): Promise<Domain[]>
addWhitelistDomain(domain: string): Promise<void>
deleteWhitelistDomain(domain: string): Promise<void>
exportWhitelist(): Promise<{ content: string, filename: string }>
importWhitelist({ filename: string, content: string }): Promise<void>

// Liste noire
getBlocklist(): Promise<Domain[]>
addBlocklistDomain(domain: string): Promise<void>
deleteBlocklistDomain(domain: string): Promise<void>
exportBlocklist(): Promise<{ content: string, filename: string }>
importBlocklist({ filename: string, content: string }): Promise<void>
```

### ⚙️ Configuration
```typescript
getConfig(): Promise<Config>
updateConfig(config: Partial<Config>): Promise<void>

// Config contient :
interface Config {
  protectionEnabled: boolean;
  blockDirectIPs: boolean;
  blockRemoteDesktop: boolean;
  blockHTTPTraffic?: boolean;
  blockNonStandardPorts?: boolean;
  updateInterval: number;
  proxyPort: number;
  blocklistSources: Record<string, boolean>;
  whitelistGitHubURL?: string;
  usefulDomainsURL?: string;
  enableUsefulDomains?: boolean;
  enableGeoBlocking?: boolean;
  geoBlockedCountries?: string[];
}
```

### 📜 Logs & Événements
```typescript
// Logs techniques
getLogs(filters?: { level?: LogLevel }, page?: number, pageSize?: number): Promise<Log[]>
exportLogs(): Promise<{ content: string, filename: string }>

// Événements de sécurité (historique)
getSecurityEvents(filters?: any, page?: number, pageSize?: number): Promise<SecurityEvent[]>

// Rapport de diagnostic
generateDiagnosticReport(): Promise<{ content: string, filename: string }>
```

### 🔄 Mises à Jour
```typescript
checkForUpdates(): Promise<void>
downloadUpdate(): Promise<void>
installUpdate(): Promise<void>
getUpdateInfo(): Promise<UpdateInfo>

// Events disponibles via preload :
window.electronAPI.onUpdateAvailable((info) => {})
window.electronAPI.onUpdateNotAvailable(() => {})
window.electronAPI.onUpdateDownloadProgress((progress) => {})
window.electronAPI.onUpdateDownloaded((info) => {})
window.electronAPI.onUpdateError((error) => {})
```

### 🔔 Événements Temps Réel
```typescript
// Abonnement aux événements en temps réel
window.electronAPI.onSecurityEvent((event: RealtimeEvent) => {
  // event: { type, domain, timestamp, reason?, source? }
})

window.electronAPI.onStatsUpdated((stats: DashboardStats) => {
  // Mise à jour automatique des stats
})

window.electronAPI.onLog((log: Log) => {
  // Nouveau log technique
})
```

## 🎨 Design System à Respecter

### Palette de Couleurs (TailwindCSS)
```css
/* Couleurs primaires */
--primary: #3B82F6 (blue-500)
--success: #10B981 (green-500)
--warning: #F59E0B (amber-500)
--danger: #EF4444 (red-500)

/* Texte */
--text-main: #1F2937 (gray-800)
--text-subtle: #6B7280 (gray-500)

/* Backgrounds */
--bg-card: #FFFFFF (white)
--bg-hover: #F3F4F6 (gray-100)
--bg-subtle: #F9FAFB (gray-50)

/* Borders */
--border-color: #E5E7EB (gray-200)
--border-subtle: #F3F4F6 (gray-100)
```

### Composants UI Existants
Les composants suivants sont déjà disponibles dans `components/ui/` :

```typescript
// Button.tsx
<Button
  variant="primary" | "secondary" | "danger" | "success"
  isLoading={boolean}
  onClick={() => {}}
>
  Texte
</Button>

// Card.tsx
<Card>
  <h2>Titre</h2>
  <p>Contenu...</p>
</Card>

// ToggleSwitch.tsx
<ToggleSwitch
  id="myToggle"
  label="Label"
  checked={boolean}
  onChange={(checked) => {}}
/>

// Toast.tsx (notifications)
import { useToast } from '../ui/Toast';
const toast = useToast();
toast.showSuccess('Message de succès');
toast.showError('Message d\'erreur');
toast.showWarning('Avertissement');
toast.showInfo('Information');
```

## 📱 Structure des Pages Actuelles

### 1. Dashboard (Tableau de bord)
**Composants :**
- `StatsCards.tsx` - Cartes de statistiques (bloqués aujourd'hui, total, dernière menace)
- `StatusIndicator.tsx` - Indicateur de statut du proxy (actif/inactif)
- `BlockChart.tsx` - Graphique des blocages dans le temps (Recharts)
- `RealtimeFeed.tsx` - Flux en temps réel des événements
- `TopBlockedCategories.tsx` - Top des catégories bloquées (barres)
- `ThreatAnalysis.tsx` - Analyse IA des menaces
- `ProtectionStatus.tsx` - Détails des couches de protection
- `AdvancedSecurityMetrics.jsx` - Métriques avancées

### 2. Liste Blanche/Noire
**Composants :**
- `WhitelistManager.tsx` - Gestion de la liste blanche
- `BlocklistManager.tsx` - Gestion de la liste noire
- `DomainTable.tsx` - Table avec recherche, tri, pagination

### 3. Configuration (Settings)
**Composants :**
- `SettingsPage.tsx` - Page principale de configuration
- `GeoBlockingSettings.jsx` - Paramètres de géo-blocking
- `UpdateSection.jsx` - Section des mises à jour

### 4. Logs
**Composants :**
- `LogPage.tsx` - Page des journaux avec deux onglets :
  - **Historique de Sécurité** : Événements bloqués/autorisés avec filtres
  - **Logs Techniques** : Logs INFO/WARNING/ERROR avec pagination

## ✅ Règles de Sécurité CRITIQUES

### 🔒 Validation des Entrées
```typescript
// TOUJOURS valider les domaines avant ajout
function validateDomain(domain: string): boolean {
  // Pas d'espaces, caractères spéciaux malveillants
  const domainRegex = /^[a-zA-Z0-9-_.]+$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

// Sanitize avant affichage
function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, ''); // Supprimer HTML
}
```

### 🚫 Interdictions
- **JAMAIS** utiliser `dangerouslySetInnerHTML`
- **JAMAIS** utiliser `eval()`, `Function()`, ou similaires
- **JAMAIS** afficher des données brutes du backend sans validation
- **TOUJOURS** utiliser des composants contrôlés pour les formulaires
- **TOUJOURS** vérifier `Array.isArray()` avant `.map()`

### ✨ Bonnes Pratiques
```typescript
// Vérification des tableaux
const safeLogs = Array.isArray(logs) ? logs : [];
safeLogs.map(log => <LogItem key={log.id} log={log} />)

// Optional chaining pour les objets
const statusColor = statusMap[status]?.color || 'text-gray-500';

// Gestion d'erreur avec try-catch
try {
  await addWhitelistDomain(domain);
  toast.showSuccess('Domaine ajouté');
} catch (error) {
  toast.showError(error.message);
}
```

## 🎯 Tâches Potentielles à Générer

### Exemples de Prompts Possibles :

**1. Créer un nouveau composant de statistiques**
```
Crée un composant React TypeScript "SecurityScoreCard.tsx" qui :
- Affiche un score de sécurité de 0 à 100
- Utilise un cercle de progression (SVG)
- Change de couleur selon le score : <50 rouge, 50-80 orange, >80 vert
- Utilise TailwindCSS et les couleurs du design system
- Inclut une icône de bouclier
```

**2. Améliorer une page existante**
```
Améliore la page Dashboard avec :
- Une section "Alertes Récentes" affichant les 5 dernières menaces
- Un bouton "Tout effacer" pour réinitialiser les stats
- Une animation de pulsation sur le StatusIndicator quand le proxy est actif
- Utilise @tanstack/react-query pour le rafraîchissement automatique
```

**3. Créer un nouveau workflow**
```
Crée une page "Assistant de Configuration" (ConfigWizard.tsx) qui :
- Guide l'utilisateur en 4 étapes pour configurer CalmWeb
- Étape 1 : Choix du niveau de protection (Faible/Moyen/Fort)
- Étape 2 : Sélection des sources de blocklist
- Étape 3 : Configuration du géo-blocking
- Étape 4 : Résumé et activation
- Utilise des transitions smooth entre les étapes
```

**4. Améliorer l'accessibilité**
```
Améliore l'accessibilité de DomainTable.tsx :
- Ajoute les attributs ARIA appropriés
- Assure la navigation au clavier (Tab, Enter, Esc)
- Ajoute des labels pour les screen readers
- Améliore le contraste des couleurs pour WCAG 2.1 AA
```

**5. Créer une feature de recherche avancée**
```
Crée un composant "AdvancedSearch.tsx" pour les logs de sécurité avec :
- Recherche par domaine (regex supporté)
- Filtres multiples : type (blocked/allowed), raison, source, date range
- Sauvegarde des filtres favoris dans localStorage
- Export des résultats filtrés en CSV
- Interface responsive avec TailwindCSS
```

## 📚 Dépendances Disponibles

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.90.7",
    "electron-updater": "^6.1.7",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "recharts": "^3.3.0",
    "zustand": "^5.0.8"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.1.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.13.3",
    "vite": "^7.2.2"
  }
}
```

## 🚀 Instructions de Génération

Quand tu génères du code :

1. **Utilise TypeScript** pour tous les nouveaux fichiers `.tsx`
2. **Importe les types** depuis `../../types.ts`
3. **Utilise React Query** pour les appels API avec cache et rafraîchissement
4. **Gère les erreurs** avec try-catch et affiche les toasts
5. **Vérifie les types** avant d'accéder aux propriétés (optional chaining)
6. **Ajoute Array.isArray()** avant tout `.map()`
7. **Utilise les composants UI** existants (Button, Card, ToggleSwitch, Toast)
8. **Suis le design system** TailwindCSS défini plus haut
9. **Ajoute les commentaires JSDoc** pour les fonctions complexes
10. **Respecte l'accessibilité** (ARIA labels, navigation clavier)

## 📝 Template de Composant

```typescript
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToast } from '../ui/Toast';
import { MonType } from '../../types';

/**
 * Description du composant
 *
 * @component
 * @example
 * <MonComposant data={data} onAction={handleAction} />
 */
export const MonComposant: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [localState, setLocalState] = useState<string>('');

  // Query pour récupérer les données
  const { data, isLoading, isError, error } = useQuery<MonType[], Error>({
    queryKey: ['maClé'],
    queryFn: async () => {
      return await window.electronAPI.getMaDonnée();
    },
    refetchInterval: 5000, // Rafraîchir toutes les 5s
  });

  // Mutation pour modifier les données
  const mutation = useMutation({
    mutationFn: async (param: string) => {
      return await window.electronAPI.updateMaDonnée(param);
    },
    onSuccess: () => {
      toast.showSuccess('Modification réussie');
      queryClient.invalidateQueries({ queryKey: ['maClé'] });
    },
    onError: (err: Error) => {
      toast.showError(`Erreur: ${err.message}`);
    },
  });

  // Sécurité : vérifier que data est un tableau
  const safeData = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <Card>
        <p className="text-center text-text-subtle">Chargement...</p>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <p className="text-center text-danger">
          Erreur: {error?.message || 'Erreur inconnue'}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Mon Titre</h2>

      {safeData.length === 0 ? (
        <p className="text-text-subtle italic">Aucune donnée disponible</p>
      ) : (
        <div className="space-y-2">
          {safeData.map((item) => (
            <div key={item.id} className="p-3 border border-border-color rounded-lg">
              {/* Contenu de l'item */}
            </div>
          ))}
        </div>
      )}

      <Button
        variant="primary"
        onClick={() => mutation.mutate('param')}
        isLoading={mutation.isPending}
      >
        Action
      </Button>
    </Card>
  );
};
```

## 🎯 Points d'Attention

### Performance
- Utiliser `useMemo` pour les calculs coûteux
- Utiliser `useCallback` pour les fonctions passées en props
- Limiter les re-renders avec `React.memo` si nécessaire

### Responsive Design
- Mobile-first avec TailwindCSS
- Classes : `sm:`, `md:`, `lg:` pour les breakpoints
- Tables responsive avec scroll horizontal sur mobile

### Tests
- Tester avec des données vides (`[]`, `null`, `undefined`)
- Tester les cas d'erreur réseau
- Vérifier l'accessibilité avec un screen reader

---

**Version du projet** : CalmWeb 1.0.0
**Date** : 2025-11-13
**Technologie** : Electron + React + TypeScript + TailwindCSS
