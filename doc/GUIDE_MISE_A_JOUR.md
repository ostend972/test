# Guide de Mise à Jour CalmWeb

Ce guide explique comment publier une nouvelle version de CalmWeb avec le système de mise à jour automatique.

---

## Table des matières

1. [Prérequis](#prérequis)
2. [Processus de mise à jour](#processus-de-mise-à-jour)
3. [Publication sur GitHub](#publication-sur-github)
4. [Vérification](#vérification)
5. [Dépannage](#dépannage)

---

## Prérequis

- Git installé sur votre machine
- Accès au repository GitHub : https://github.com/ostend972/test
- Token GitHub (déjà configuré)
- Node.js et npm installés

---

## Processus de mise à jour

### Étape 1 : Modifier le code

1. Faites vos modifications dans le code source
2. Testez localement avec :
   ```bash
   npm start
   ```

### Étape 2 : Mettre à jour la version

1. **Modifiez `package.json`** :
   ```json
   {
     "version": "1.0.2"  // Changez ici (actuellement 1.0.1)
   }
   ```

2. **Mettez à jour `CHANGELOG.md`** :
   ```markdown
   ## [1.0.2] - 2025-11-XX

   ### Ajouté
   - Nouvelle fonctionnalité X

   ### Corrigé
   - Bug Y résolu
   ```

### Étape 3 : Compiler la nouvelle version

```bash
# Nettoyer l'ancien build
rd /s /q dist

# Attendre 2 secondes
timeout /t 2

# Compiler
npm run build:win
```

⏱️ **Temps estimé** : 1-2 minutes

### Étape 4 : Vérifier les fichiers générés

Allez dans le dossier `dist\` et vérifiez que vous avez **3 fichiers** :

```
dist/
├── CalmWeb Setup X.X.X.exe          (≈155 MB)
├── latest.yml                        (≈343 bytes)
└── CalmWeb Setup X.X.X.exe.blockmap (≈164 KB)
```

✅ Ces 3 fichiers sont **ESSENTIELS** pour l'auto-update !

---

## Publication sur GitHub

### Méthode 1 : Interface Web GitHub (Recommandé)

1. **Allez sur** : https://github.com/ostend972/test/releases/new

2. **Remplissez le formulaire** :
   - **Tag** : `v1.0.2` (correspond à la version dans package.json)
   - **Title** : `CalmWeb v1.0.2`
   - **Description** : Copiez la section du CHANGELOG

3. **Uploadez les 3 fichiers** :
   - Cliquez sur "Attach binaries by dropping them here..."
   - Glissez les 3 fichiers depuis `dist\`
   - Attendez que l'upload se termine (peut prendre 1-2 min pour le .exe)

4. **Publiez** :
   - ✅ Cochez "Set as the latest release"
   - Cliquez sur "Publish release"

### Méthode 2 : Ligne de commande (Avancé)

Si GitHub CLI (`gh`) est installé :

```bash
# Créer la release
gh release create v1.0.2 --title "CalmWeb v1.0.2" --notes "Description des changements"

# Uploader les fichiers
cd dist
gh release upload v1.0.2 "CalmWeb Setup 1.0.2.exe" latest.yml "CalmWeb Setup 1.0.2.exe.blockmap"
```

---

## Push du code source (Optionnel)

Le code source sur GitHub sert de **sauvegarde** et d'**historique**, mais n'est **PAS nécessaire** pour l'auto-update.

### Première fois : Initialiser Git

```bash
# Dans le dossier "App windows"
git init
git add .
git commit -m "Initial commit - CalmWeb v1.0.1"
git branch -M main
git remote add origin https://github.com/ostend972/test.git
git push -u origin main
```

### Mises à jour suivantes

```bash
# Ajouter tous les fichiers modifiés
git add .

# Créer un commit avec un message descriptif
git commit -m "Version 1.0.2 - Description des changements"

# Pousser sur GitHub
git push origin main
```

### Fichier .gitignore (Important !)

Créez un fichier `.gitignore` à la racine pour éviter de pousser des fichiers inutiles :

```
# Dépendances
node_modules/

# Build
dist/

# Logs
*.log
logs-persistent.json

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temporaires
*.tmp
*.temp
```

---

## Vérification

### Vérifier que la release est publiée

1. Allez sur : https://github.com/ostend972/test/releases
2. Vérifiez que votre nouvelle version apparaît avec le badge "Latest"
3. Vérifiez que les 3 fichiers sont présents

### Tester l'auto-update

1. **Installez la version précédente** (ex: v1.0.1)
2. **Lancez CalmWeb**
3. **Attendez 10 secondes** (l'app vérifie au démarrage)
4. Une notification devrait apparaître proposant la mise à jour
5. Cliquez sur "Télécharger" et vérifiez l'installation

### Vérifier les logs

Ouvrez `%APPDATA%\CalmWeb\logs-persistent.json` et cherchez :

```json
{
  "message": "Mise à jour disponible: vX.X.X"
}
```

---

## Dépannage

### Erreur 404 sur latest.yml

**Problème** : Le fichier `latest.yml` n'a pas été uploadé.

**Solution** :
1. Allez dans la release GitHub
2. Cliquez sur "Edit release"
3. Uploadez le fichier `latest.yml` manquant

### Erreur 404 sur .blockmap

**Problème** : Le fichier `.blockmap` n'a pas été uploadé.

**Solution** :
1. Vérifiez que le fichier existe dans `dist\`
2. Uploadez-le dans la release GitHub

### L'auto-update ne détecte pas la nouvelle version

**Causes possibles** :
1. ❌ La release n'est pas marquée comme "Latest"
2. ❌ Le numéro de version dans `package.json` ne correspond pas au tag Git
3. ❌ Le fichier `latest.yml` est manquant

**Solution** :
1. Éditez la release sur GitHub
2. Cochez "Set as the latest release"
3. Vérifiez que tous les fichiers sont présents

### Le téléchargement est très lent

**Explication** : Si le fichier `.blockmap` est manquant, l'app télécharge **tout le .exe** (155 MB) au lieu de seulement les différences.

**Solution** : Uploadez toujours le fichier `.blockmap` !

---

## Récapitulatif rapide

```bash
# 1. Modifier le code et tester
npm start

# 2. Changer la version dans package.json et CHANGELOG.md

# 3. Compiler
npm run build:win

# 4. Aller sur GitHub et créer une nouvelle release

# 5. Uploader les 3 fichiers du dossier dist/
#    - CalmWeb Setup X.X.X.exe
#    - latest.yml
#    - CalmWeb Setup X.X.X.exe.blockmap

# 6. Publier la release en cochant "Set as latest"

# 7. (Optionnel) Pousser le code source
git add .
git commit -m "Version X.X.X"
git push origin main
```

---

## Bonnes pratiques

### Versionnement

Suivez le **Semantic Versioning** (semver) :

- **1.0.0** → Première version stable
- **1.0.1** → Correction de bugs (patch)
- **1.1.0** → Nouvelle fonctionnalité (minor)
- **2.0.0** → Changement majeur (major)

### Tests avant publication

1. ✅ Testez la compilation localement
2. ✅ Testez l'installation du .exe
3. ✅ Testez l'application après installation
4. ✅ Vérifiez que tous les fichiers sont dans `dist\`
5. ✅ Vérifiez le CHANGELOG

### Sauvegardes

Conservez toujours une copie de chaque version :
- `CalmWeb-Setup-1.0.0.exe`
- `CalmWeb-Setup-1.0.1.exe`
- `CalmWeb-Setup-1.0.2.exe`
- etc.

---

## Contacts et support

- **Repository GitHub** : https://github.com/ostend972/test
- **Releases** : https://github.com/ostend972/test/releases
- **Documentation Electron-Updater** : https://www.electron.build/auto-update

---

**Dernière mise à jour** : 11 novembre 2025
**Version du guide** : 1.0
