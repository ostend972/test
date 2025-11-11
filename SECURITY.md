# Politique de Sécurité - CalmWeb

## 🔒 Versions Supportées

Nous publions régulièrement des mises à jour de sécurité pour CalmWeb. Les versions suivantes reçoivent des correctifs de sécurité:

| Version | Supportée          | Fin de support |
| ------- | ------------------ | -------------- |
| 1.0.x   | ✅ Oui             | -              |
| < 1.0   | ❌ Non             | 2025-11-11     |

**Recommandation**: Utilisez toujours la dernière version stable pour bénéficier des dernières protections de sécurité.

## 🚨 Signaler une Vulnérabilité

La sécurité de nos utilisateurs est notre priorité absolue. Si vous découvrez une vulnérabilité de sécurité, nous vous remercions de nous aider à protéger nos utilisateurs.

### ⚠️ NE PAS

- ❌ Créer une issue publique sur GitHub
- ❌ Discuter de la vulnérabilité publiquement
- ❌ Exploiter la vulnérabilité à des fins malveillantes

### ✅ À FAIRE

**Option 1: Email sécurisé (Recommandé)**

Envoyez un email détaillé à: **security@calmweb.local**

Utilisez notre clé PGP pour chiffrer les informations sensibles:
```
-----BEGIN PGP PUBLIC KEY BLOCK-----
[Clé PGP - À remplacer par votre vraie clé]
-----END PGP PUBLIC KEY BLOCK-----
```

**Option 2: GitHub Security Advisory**

1. Allez sur [Security Advisories](https://github.com/ostend972/test/security/advisories)
2. Cliquez sur "Report a vulnerability"
3. Remplissez le formulaire de signalement

### 📋 Informations à inclure

Pour accélérer le traitement de votre signalement, incluez:

1. **Description de la vulnérabilité**
   - Type de vulnérabilité (XSS, injection, etc.)
   - Impact potentiel
   - Composants affectés

2. **Étapes de reproduction**
   - Instructions détaillées étape par étape
   - Captures d'écran ou vidéo (si applicable)
   - Code Proof-of-Concept (si disponible)

3. **Environnement**
   - Version de CalmWeb
   - Version de Windows
   - Configuration particulière

4. **Impact estimé**
   - Critique / Élevé / Moyen / Faible
   - Justification de la sévérité

### 📊 Exemple de signalement

```markdown
## Vulnérabilité: Injection SQL dans la recherche de logs

**Sévérité**: Élevée

**Description**:
La fonction de recherche dans les logs techniques ne valide pas correctement
l'entrée utilisateur, permettant une injection SQL.

**Reproduction**:
1. Ouvrir le dashboard CalmWeb
2. Aller dans "Logs Techniques"
3. Dans le champ de recherche, entrer: `' OR 1=1--`
4. Observer que tous les logs sont affichés

**Impact**:
Un attaquant peut exfiltrer toutes les données de logs, incluant
potentiellement des informations sensibles.

**Environnement**:
- CalmWeb v1.0.7
- Windows 11 Pro 22H2
```

## ⏱️ Processus de traitement

### 1. Accusé de réception (24-48h)

Nous accuserons réception de votre signalement dans les 24-48 heures ouvrables.

### 2. Évaluation initiale (3-5 jours)

- Validation de la vulnérabilité
- Évaluation de la sévérité
- Identification des versions affectées

### 3. Développement du correctif (variable)

Le délai dépend de la complexité:
- **Critique**: 1-7 jours
- **Élevée**: 1-2 semaines
- **Moyenne**: 2-4 semaines
- **Faible**: 1-2 mois

### 4. Publication du correctif

- Release d'une version patchée
- Mise à jour automatique pour tous les utilisateurs
- Publication d'un Security Advisory (si nécessaire)

### 5. Divulgation publique

Après publication du correctif, nous attendons **30 jours** avant de divulguer publiquement les détails de la vulnérabilité.

## 🏆 Programme de Reconnaissance

Nous reconnaissons les contributeurs qui nous aident à améliorer la sécurité de CalmWeb.

### Hall of Fame

Les chercheurs en sécurité qui signalent des vulnérabilités valides seront:

- ✨ Mentionnés dans notre Hall of Fame (avec leur permission)
- 📢 Crédités dans les notes de release
- 🙏 Remerciés publiquement

**Note**: Actuellement, nous n'offrons pas de récompenses monétaires (bug bounty).

## 🛡️ Mesures de Sécurité Implémentées

### Architecture

- **Context Isolation** : Isolation complète entre le processus principal et le renderer
- **Sandbox** : Renderer process sandboxé par défaut
- **Content Security Policy** : CSP stricte pour prévenir XSS
- **Node Integration désactivé** : Dans le renderer process

### Validation des entrées

```typescript
// Exemple: Validation des domaines
function isValidDomain(domain: string): boolean {
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain) && domain.length <= 253;
}
```

### Rate Limiting

```typescript
// Protection contre les abus
const rateLimiter = {
  limit: 999999,  // Appels par minute
  window: 60000   // Fenêtre de temps (ms)
};
```

### Logs d'audit

Tous les événements de sécurité sont loggés:
- Tentatives de blocage
- Modifications de configuration
- Erreurs de validation
- Accès IPC

## 🔐 Meilleures Pratiques pour les Utilisateurs

### Installation sécurisée

1. **Téléchargez uniquement depuis GitHub Releases officiel**
   - ✅ https://github.com/ostend972/test/releases
   - ❌ Sites tiers, liens directs inconnus

2. **Vérifiez la signature numérique** (à venir)
   ```powershell
   Get-AuthenticodeSignature "CalmWeb-Setup-1.0.7.exe"
   ```

3. **Vérifiez le checksum SHA-256**
   ```powershell
   certutil -hashfile "CalmWeb-Setup-1.0.7.exe" SHA256
   ```

### Configuration sécurisée

- ✅ Gardez CalmWeb toujours à jour (mises à jour automatiques activées)
- ✅ Utilisez un compte Windows standard (non-admin) après l'installation
- ✅ Revoyez régulièrement votre whitelist/blocklist
- ✅ Surveillez les logs pour détecter des activités suspectes

### Détection des compromissions

**Signes d'alerte**:
- CalmWeb ne bloque plus les domaines malveillants
- Augmentation soudaine des connexions autorisées
- Modifications non autorisées de la configuration
- Proxy redirigé vers une adresse inconnue

**Action à prendre**:
1. Déconnectez-vous d'Internet immédiatement
2. Désinstallez CalmWeb
3. Analysez votre système avec un antivirus
4. Réinstallez la dernière version depuis GitHub
5. Signalez l'incident à security@calmweb.local

## 📜 Divulgations Précédentes

Aucune vulnérabilité n'a encore été publiquement divulguée.

Cette section sera mise à jour lorsque des vulnérabilités seront découvertes et corrigées.

## 🔄 Mises à Jour de cette Politique

Cette politique de sécurité peut être mise à jour périodiquement. Les changements majeurs seront communiqués via:

- Release notes sur GitHub
- Notification dans l'application
- Email aux utilisateurs inscrits (si disponible)

**Dernière mise à jour**: 2025-11-11

## 📞 Contact

- **Email sécurité**: security@calmweb.local
- **GitHub Security**: [Security Advisories](https://github.com/ostend972/test/security/advisories)
- **Issues publiques** (non-sécurité): [GitHub Issues](https://github.com/ostend972/test/issues)

---

**Merci de contribuer à la sécurité de CalmWeb et de ses utilisateurs!** 🛡️

CalmWeb Security Team
