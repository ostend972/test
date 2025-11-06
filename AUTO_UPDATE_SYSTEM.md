# 🔄 Système de Mise à Jour Automatique CalmWeb

## 📋 Vue d'ensemble

Le système de mise à jour automatique permet à CalmWeb de se mettre à jour automatiquement depuis GitHub de manière **totalement silencieuse** sans intervention de l'utilisateur.

## 🏗️ Architecture

### Composants principaux :

1. **`app_updater.py`** - Module principal de gestion des mises à jour
2. **`api_app_update_handlers.py`** - API REST pour contrôler les mises à jour
3. **Intégration dans `main.py`** - Démarrage automatique du service
4. **Dashboard** - Interface utilisateur pour surveiller/contrôler

## ⚡ Fonctionnement

### 1. **Vérification automatique**
- ✅ Vérification toutes les **1 heure** par défaut
- 🔍 Utilise l'**API GitHub** (`/repos/ostend972/calmweb/releases/latest`)
- 📊 Compare les versions avec **semantic versioning**

### 2. **Téléchargement silencieux**
- 📥 Téléchargement en arrière-plan dès qu'une nouvelle version est détectée
- 🛡️ Validation de l'intégrité du fichier
- 💾 Stockage temporaire sécurisé

### 3. **Installation automatique**
- 🔄 Sauvegarde de l'exécutable actuel
- 📁 Remplacement silencieux du fichier
- ✅ Vérification que la nouvelle version fonctionne
- 🚀 Redémarrage automatique de l'application

## 📡 API REST

### Endpoints disponibles :

```http
GET  /api/app-update/status      # Statut des mises à jour
GET  /api/app-update/settings    # Paramètres du système
POST /api/app-update/check       # Forcer une vérification
POST /api/app-update/install     # Forcer une installation
POST /api/app-update/settings    # Modifier les paramètres
```

### Exemple de réponse status :
```json
{
  "success": true,
  "data": {
    "status": "idle",
    "current_version": "1.1.0",
    "available_version": "1.2.0",
    "update_available": true,
    "last_check": "2024-11-06T15:30:00",
    "last_check_human": "2 minutes ago"
  }
}
```

## 🔧 Configuration

### Paramètres modifiables :

| Paramètre | Valeur par défaut | Description |
|-----------|------------------|-------------|
| `check_interval` | 3600 secondes | Intervalle entre les vérifications |
| `github_repo` | "ostend972/calmweb" | Dépôt GitHub source |
| `auto_check_enabled` | `true` | Activation des vérifications auto |

### Fichiers de configuration :
- **Status**: `%APPDATA%\CalmWeb\app_update_status.json`
- **Logs**: Intégrés dans le système de logs principal

## 🚀 Mise en Production

### 1. **Workflow GitHub Actions** (Recommandé)
```yaml
name: Auto-Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build CalmWeb
        run: |
          pip install -r requirements.txt
          pyinstaller CalmWeb_Final.spec
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/CalmWeb.exe
          name: "CalmWeb ${{ github.ref_name }}"
          generate_release_notes: true
```

### 2. **Publication manuelle**
1. Build l'application : `build.bat`
2. Tag la version : `git tag v1.2.0`
3. Créer une release GitHub avec le `.exe`

## 🛡️ Sécurité

### Mesures de protection :
- ✅ **Validation HTTPS** - Téléchargements sécurisés uniquement
- 🔐 **Vérification d'intégrité** - Contrôle de la validité des fichiers
- 💾 **Sauvegarde automatique** - Rollback en cas d'échec
- 🔒 **Permissions limitées** - Exécution avec droits minimaux

### Points d'attention :
- ⚠️ Nécessite des **droits administrateur** pour remplacer l'exécutable
- 🔧 Peut être **désactivé** via les paramètres si besoin
- 📊 **Logs détaillés** pour traçabilité

## 🧪 Tests

### Script de test inclus :
```bash
python test_updater.py
```

### Tests effectués :
- ✅ Vérification de connectivité GitHub
- ✅ Comparaison de versions
- ✅ Téléchargement et validation
- ✅ API REST endpoints

## 📊 Monitoring Dashboard

### Informations affichées :
- 📱 Version actuelle et disponible
- ⏰ Dernière vérification
- 📥 Statut de téléchargement/installation
- ⚙️ Configuration du système

### Actions disponibles :
- 🔄 **Forcer une vérification**
- 📥 **Forcer une installation**
- ⚙️ **Modifier les paramètres**
- 📊 **Voir les logs détaillés**

## 🚨 Dépannage

### Problèmes courants :

#### 1. **Pas d'accès GitHub**
```
Erreur: Update check error: Connection timeout
Solution: Vérifier la connexion Internet et les proxies
```

#### 2. **Droits insuffisants**
```
Erreur: Installation failed: Access denied
Solution: Relancer CalmWeb en administrateur
```

#### 3. **Version corrompue**
```
Erreur: New executable test failed
Solution: Le système restaure automatiquement la sauvegarde
```

### Logs de diagnostic :
```
%APPDATA%\CalmWeb\logs\calmweb.log
%APPDATA%\CalmWeb\app_update_status.json
```

## 🔮 Évolutions futures

### Améliorations prévues :
- 🎯 **Mise à jour delta** - Télécharger seulement les différences
- 🕐 **Planification** - Choisir les heures de mise à jour
- 📧 **Notifications** - Alertes par email des mises à jour
- 🔄 **Rollback automatique** - Retour version précédente si problème

---

## 💡 Utilisation

### Démarrage automatique :
Le système se lance automatiquement avec CalmWeb, aucune configuration requise !

### Contrôle manuel :
Accédez au dashboard sur `http://127.0.0.1:8081` > Section "Mises à jour de l'application"

**🎉 Votre CalmWeb restera toujours à jour automatiquement !**