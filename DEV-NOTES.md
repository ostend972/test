# Notes pour le Développement - CalmWeb

## 🚨 IMPORTANT : Droits Administrateur

CalmWeb nécessite les **droits administrateur** pour fonctionner correctement, car il doit :
- Configurer le proxy système Windows
- Créer des règles de pare-feu
- Gérer les tâches planifiées

### Mode Développement

Pour lancer l'application en mode développement avec les droits admin :

#### Option 1 : Script PowerShell (Recommandé)
```powershell
.\start-admin.ps1
```
Ce script demandera automatiquement les droits admin et lancera `npm start`.

#### Option 2 : Terminal Admin Manuel
1. Ouvrir PowerShell ou CMD en tant qu'administrateur (clic droit → "Exécuter en tant qu'administrateur")
2. Naviguer vers le dossier du projet
3. Lancer `npm start`

### Mode Production (Installateur)

L'installateur NSIS configure automatiquement :

1. ✅ **Exécutable (.exe)** : Demande toujours les droits admin (`requestedExecutionLevel: requireAdministrator` dans package.json)
2. ✅ **Raccourcis** : Bureau et Menu Démarrage configurés pour s'exécuter en admin (PowerShell dans installer.nsh)
3. ✅ **Tâche planifiée** : Auto-démarrage avec niveau `/RL HIGHEST` (droits admin)

Pour compiler l'installateur :
```bash
npm run build:win
```

L'exécutable sera dans `dist/CalmWeb Setup 1.0.0.exe`.

## 🐛 Dépannage

### "Le proxy ne fonctionne pas / Les domaines ne sont pas bloqués"

**Symptôme** : Vous ajoutez un domaine à la liste noire mais vous pouvez toujours y accéder.

**Cause** : L'application n'a pas les droits administrateur et ne peut donc pas configurer le proxy système Windows.

**Vérification** : Dans les logs, vous verrez :
```
[ERROR] Erreur configuration proxy système: Accès refusé
proxy: 'not_configured'
```

**Solution** : Relancer avec les droits admin (voir section "Mode Développement" ci-dessus).

### Vérifier si l'application tourne avec les droits admin

Dans PowerShell :
```powershell
Get-Process -Name electron | Select-Object -Property Name, Id, SI
```

Si `SI` (Session ID) est 0, l'application tourne en mode admin.

## 📝 Fichiers Modifiés pour les Droits Admin

- **package.json** (ligne 57) : `"requestedExecutionLevel": "requireAdministrator"`
- **installer.nsh** (ligne 303-329) : Script PowerShell pour configurer les raccourcis
- **start-admin.ps1** : Script de lancement en mode admin pour le développement

## 🔧 Structure des Données

En mode développement, les données sont stockées dans :
```
C:\Users\[USER]\AppData\Roaming\calmweb\
```

En mode production (installé), les données sont dans :
```
C:\Users\[USER]\AppData\Roaming\CalmWeb\
```

Fichiers créés :
- `config.json` : Configuration de l'application
- `whitelist.json` : Liste blanche
- `custom_blocklist.json` : Liste noire personnalisée
- `blocklist_cache.txt` : Cache des listes de blocage (500k+ domaines)
- `stats.json` : Statistiques de blocage
- `calmweb-startup.log` : Logs de démarrage

## 🎯 Workflow Recommandé

1. **Développement** : Utiliser `.\start-admin.ps1` pour tester avec droits admin
2. **Tests** : Vérifier que les domaines ajoutés à la liste noire sont bien bloqués
3. **Compilation** : `npm run build:win` pour créer l'installateur
4. **Installation** : Tester l'installation complète
5. **Vérification** : S'assurer que tous les raccourcis demandent bien les droits admin

## 📦 Contenu de l'Installateur

L'installateur NSIS effectue les opérations suivantes :

1. **Affichage des informations** : Page avec statistiques et fonctionnalités
2. **Configuration** : Page pour choisir port proxy, options de protection
3. **Installation des fichiers** : Copie de l'exécutable et ressources
4. **Configuration initiale** : Création de `initial-config.json` et `stats.json`
5. **Proxy système** : Configuration du proxy Windows (si demandé)
6. **Tâche planifiée** : Création de "CalmWeb AutoStart" avec `/RL HIGHEST`
7. **Règle pare-feu** : Autorisation de CalmWeb dans le pare-feu
8. **Raccourcis admin** : Configuration des raccourcis pour s'exécuter en admin
9. **Page finale** : Option pour lancer CalmWeb en mode minimisé

## 🛡️ Sécurité

- Tous les chemins de fichiers sont validés (protection contre path traversal)
- Les commandes shell utilisent `spawn()` avec paramètres séparés (protection contre command injection)
- Les entrées IPC sont validées avec le système `ipc-validator.js`
- Le proxy système est toujours configuré sur 127.0.0.1 (localhost uniquement)

---

**Dernière mise à jour** : 2025-11-10
