# Guide de Contribution - CalmWeb

Merci de votre intérêt pour contribuer à CalmWeb! Ce document fournit les guidelines pour contribuer au projet.

## 📋 Table des matières

- [Code de Conduite](#code-de-conduite)
- [Comment contribuer](#comment-contribuer)
- [Processus de développement](#processus-de-développement)
- [Standards de code](#standards-de-code)
- [Commits et Pull Requests](#commits-et-pull-requests)
- [Tests](#tests)

## 🤝 Code de Conduite

En participant à ce projet, vous vous engagez à maintenir un environnement respectueux et inclusif pour tous.

### Nos engagements

- Utiliser un langage accueillant et inclusif
- Respecter les points de vue et expériences différents
- Accepter les critiques constructives avec grâce
- Se concentrer sur ce qui est meilleur pour la communauté

## 🚀 Comment contribuer

### Signaler un bug

1. Vérifiez que le bug n'a pas déjà été signalé dans [Issues](https://github.com/ostend972/test/issues)
2. Créez une nouvelle issue avec le template "Bug Report"
3. Incluez:
   - Description claire du problème
   - Étapes pour reproduire
   - Comportement attendu vs actuel
   - Captures d'écran si applicable
   - Version de Windows
   - Version de CalmWeb

### Suggérer une amélioration

1. Vérifiez que la fonctionnalité n'a pas déjà été demandée
2. Créez une issue avec le template "Feature Request"
3. Décrivez clairement:
   - Le problème que cela résout
   - La solution proposée
   - Les alternatives considérées

### Soumettre une Pull Request

1. Fork le repository
2. Créez une branche depuis `master`:
   ```bash
   git checkout -b feature/ma-fonctionnalite
   ```
3. Faites vos modifications
4. Testez vos changements
5. Committez avec des messages descriptifs
6. Push vers votre fork
7. Ouvrez une Pull Request

## 🔧 Processus de développement

### Installation de l'environnement de développement

```bash
# Cloner le repository
git clone https://github.com/ostend972/test.git
cd test

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

### Structure du projet

```
CalmWeb/
├── main.js              # Processus principal Electron
├── preload.js          # Script de préchargement
├── index.html          # Point d'entrée HTML
├── backend/            # Logique backend
│   ├── proxy.js       # Serveur proxy
│   ├── blocklist.js   # Gestion des blocklists
│   ├── firewall.js    # Règles firewall
│   └── updater.js     # Système de mise à jour
├── components/         # Composants React
│   ├── Dashboard/
│   ├── Settings/
│   ├── Logs/
│   └── About/
├── services/          # Services API
├── stores/            # State management (Zustand)
└── types.ts           # Types TypeScript
```

## 📝 Standards de code

### TypeScript/JavaScript

```typescript
// ✅ Bon - Types explicites
interface Config {
  proxyPort: number;
  autoStart: boolean;
}

function updateConfig(config: Config): void {
  // ...
}

// ❌ Mauvais - Pas de types
function updateConfig(config) {
  // ...
}
```

### Conventions de nommage

- **Variables/Fonctions**: `camelCase`
- **Classes/Interfaces**: `PascalCase`
- **Constantes**: `UPPER_SNAKE_CASE`
- **Fichiers**: `kebab-case.tsx` ou `PascalCase.tsx` pour les composants

### Format du code

```bash
# Vérifier le formatage
npm run lint

# Corriger automatiquement
npm run lint:fix
```

### Commentaires

```typescript
/**
 * Bloque un domaine dans la liste noire
 * @param domain - Le domaine à bloquer (sans protocole)
 * @returns true si le blocage a réussi
 */
function blockDomain(domain: string): boolean {
  // Valider le format du domaine
  if (!isValidDomain(domain)) {
    return false;
  }

  // Ajouter à la blocklist
  blocklist.add(domain);
  return true;
}
```

## 💬 Commits et Pull Requests

### Messages de commit

Utilisez le format [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[corps optionnel]

[footer optionnel]
```

**Types**:
- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `docs`: Documentation uniquement
- `style`: Formatage (pas de changement de code)
- `refactor`: Refactoring du code
- `test`: Ajout ou modification de tests
- `chore`: Maintenance (dépendances, etc.)

**Exemples**:

```bash
feat(proxy): ajouter support HTTPS avec SNI
fix(blocklist): corriger la validation des sous-domaines
docs(readme): mettre à jour les instructions d'installation
refactor(dashboard): simplifier la logique des statistiques
```

### Pull Requests

**Titre**: Suivre le format des commits
```
feat(proxy): Ajouter support HTTPS avec SNI
```

**Description**: Inclure
- Résumé des changements
- Motivation
- Tests effectués
- Captures d'écran (si UI)
- Breaking changes (si applicable)

**Exemple**:

```markdown
## 📝 Description

Ajout du support HTTPS avec Server Name Indication (SNI) pour améliorer la compatibilité.

## ✨ Changements

- Implémentation du parsing SNI dans `backend/proxy.js`
- Ajout de tests pour la validation SNI
- Mise à jour de la documentation

## 🧪 Tests

- [x] Tests unitaires passent
- [x] Tests d'intégration passent
- [x] Testé manuellement avec Chrome, Firefox, Edge

## 📸 Captures d'écran

[Si applicable]

## ⚠️ Breaking Changes

Aucun
```

## 🧪 Tests

### Exécuter les tests

```bash
# Tous les tests
npm test

# Tests avec couverture
npm run test:coverage

# Tests de sécurité
npm run test:security

# Mode watch
npm run test:watch
```

### Écrire des tests

```typescript
// backend/__tests__/blocklist.test.js
describe('Blocklist', () => {
  test('should block malicious domain', () => {
    const blocklist = new Blocklist();
    blocklist.add('malicious.com');

    expect(blocklist.isBlocked('malicious.com')).toBe(true);
    expect(blocklist.isBlocked('safe.com')).toBe(false);
  });

  test('should block subdomains', () => {
    const blocklist = new Blocklist();
    blocklist.add('ads.example.com');

    expect(blocklist.isBlocked('tracker.ads.example.com')).toBe(true);
  });
});
```

### Couverture de code

Visez une couverture de **80%** minimum pour les nouvelles fonctionnalités.

## 🔒 Sécurité

### Signaler une vulnérabilité

**NE PAS** créer une issue publique pour les vulnérabilités de sécurité.

Consultez [SECURITY.md](SECURITY.md) pour les instructions de signalement sécurisé.

### Guidelines de sécurité

- ✅ Valider toutes les entrées utilisateur
- ✅ Échapper les données dans les requêtes
- ✅ Utiliser Context Isolation dans Electron
- ✅ Éviter `eval()` et code dynamique
- ✅ Limiter les permissions IPC
- ❌ Ne jamais exposer le processus principal
- ❌ Ne pas logger de données sensibles

## 📋 Checklist avant soumission

- [ ] Le code suit les standards du projet
- [ ] Les tests passent (`npm test`)
- [ ] La documentation est à jour
- [ ] Les messages de commit suivent les conventions
- [ ] Aucun fichier de debug/test temporaire
- [ ] Le CHANGELOG.md est mis à jour (si applicable)

## 🎯 Priorités actuelles

### Fonctionnalités recherchées

- Support de configurations proxy multiples
- Interface de gestion des règles avancées
- Statistiques détaillées par application
- Export/Import de configuration

### Améliorations techniques

- Migration vers Electron 29+
- Amélioration de la couverture de tests
- Optimisation des performances du proxy
- Documentation API complète

## 💡 Ressources

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## 📞 Contact

- **Issues**: [GitHub Issues](https://github.com/ostend972/test/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ostend972/test/discussions)

---

Merci de contribuer à rendre le web plus sûr! 🛡️

**CalmWeb Team**
