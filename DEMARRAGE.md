# 🚀 Comment Démarrer CalmWeb

## ⚡ Démarrage Rapide

### 1️⃣ Build du Frontend
```bash
cd C:\Users\Alan\Desktop\Firewall
npx vite build
```

### 2️⃣ Lancer l'Application
```bash
npm start
```

## 🔧 Séquence Complète (Première Fois)

```bash
# 1. Aller dans le dossier
cd C:\Users\Alan\Desktop\Firewall

# 2. Installer les dépendances (si pas déjà fait)
npm install

# 3. Builder le frontend React
npx vite build

# 4. Lancer l'application
npm start
```

## ✅ Ce Qui Doit Se Passer

### Backend (dans la console)
```
✓ Configuration chargée
✓ Whitelist: 9 entrées
✓ Blocklist: 513,953 domaines
✓ Serveur proxy démarré sur 127.0.0.1:8081
```

### Frontend (dans la fenêtre Electron)
- Dashboard CalmWeb avec statistiques
- Graphique 24h des blocages
- Feed temps réel
- Navigation (Dashboard, Whitelist, Blocklist, Settings, Logs)

## 🐛 Si Vous Voyez Un Écran Blanc

1. **Vérifiez que le build s'est bien passé** :
   ```bash
   ls dist/
   ```
   Vous devez voir : `index.html` et un dossier `assets/`

2. **Rechargez la page** dans Electron : `Ctrl+R`

3. **Ouvrez DevTools** : `F12` et regardez les erreurs dans Console

4. **Rebuildez** :
   ```bash
   npx vite build
   npm start
   ```

## 📝 Scripts Disponibles

- `npm start` - Lance l'application (nécessite build avant)
- `npx vite build` - Build le frontend React
- `npm run build:win` - Crée l'exécutable Windows

## 🎯 Après le Premier Lancement

Vous n'avez plus besoin de rebuilder à chaque fois, sauf si vous modifiez le code frontend.

Pour juste relancer l'app :
```bash
npm start
```

## 🛡️ Protection Active

Une fois lancé, CalmWeb :
- ✅ Bloque 513,953+ domaines malveillants
- ✅ Filtre le trafic HTTP/HTTPS
- ✅ Protège contre phishing, malware, scams
- ✅ Bloque les outils de contrôle à distance

## ⚠️ Erreurs Connues

### Port 8081 Already in Use
- Fermez toutes les fenêtres Electron
- Ou tuez les processus Node/Electron dans le Gestionnaire des Tâches

### Proxy Système (Besoin Admin)
- Lancez en tant qu'administrateur pour configurer le proxy système
- Click-droit sur le terminal > "Exécuter en tant qu'administrateur"
- Puis relancez `npm start`

## 📦 Build Production

Pour créer un exécutable :
```bash
npx vite build
npm run build:win
```

L'installateur sera dans `dist/CalmWeb Setup 1.0.0.exe`

---

**Version 1.0.0** - Application Production-Ready ! 🎉
