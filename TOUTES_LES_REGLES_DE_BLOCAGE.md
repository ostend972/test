# TOUTES LES RÈGLES DE BLOCAGE DE CALMWEB

Ce document liste **TOUTES** les conditions qui peuvent bloquer un domaine dans CalmWeb.

## ORDRE DE VÉRIFICATION (backend/proxy-server.js:249-291)

### 0️⃣ **PROTECTION DÉSACTIVÉE**
- Si `protectionEnabled = false` → **RIEN N'EST BLOQUÉ**

### 1️⃣ **WHITELIST** (Priorité absolue)
- Si le domaine est dans la whitelist → **JAMAIS BLOQUÉ** (bypass toutes les autres règles)
- Fichier: `C:\Users\Alan\AppData\Roaming\CalmWeb\whitelist.json`

---

## RÈGLES DE BLOCAGE (vérifiées dans l'ordre)

### 2️⃣ **BLOCAGE DES IPs DIRECTES**
- **Condition**: `blockDirectIPs = true` ET domaine ressemble à une IP (ex: `192.168.1.1`)
- **Raison affichée**: "IP Block"
- **Source**: "Règle Système"
- **Exemple bloqué**: `http://192.168.1.1`, `https://8.8.8.8`
- **Code**: proxy-server.js:263-265

### 3️⃣ **BLOCAGE HTTP (force HTTPS)**
- **Condition**: `blockHTTPTraffic = true` ET la requête est en HTTP (pas HTTPS)
- **Raison affichée**: "HTTP Block"
- **Source**: "Règle Système"
- **Exemple bloqué**: `http://example.com` (HTTP sera bloqué)
- **Exemple autorisé**: `https://example.com` (HTTPS passe)
- **Code**: proxy-server.js:268-270

### 4️⃣ **BLOCAGE DES PORTS NON-STANDARD**
- **Condition**: `blockNonStandardPorts = true` ET port n'est pas 80 ou 443
- **Raison affichée**: "Port Block"
- **Source**: "Règle Système"
- **Ports autorisés**: 80 (HTTP), 443 (HTTPS)
- **Ports bloqués**: Tous les autres (8080, 3000, 8888, etc.)
- **Exemple bloqué**: `example.com:8080`, `site.com:3000`
- **Code**: proxy-server.js:273-275

### 5️⃣ **BLOCKLIST - DOMAINES BLOQUÉS**
- **Condition**: Le domaine (ou un domaine parent) est dans la blocklist
- **Source**: "Blocklists" (listes externes) ou "Liste Personnalisée" (ajouts manuels)
- **Raison affichée**: Détectée automatiquement (voir section suivante)
- **Code**: proxy-server.js:278-287

#### 5.1 - Blocklist Principale (71,762 domaines)
- Fichier: `C:\Users\Alan\AppData\Roaming\CalmWeb\blocklist_cache.txt`
- Sources:
  - URLhaus (malware)
  - Phishing Army (phishing)
  - Hagezi Ultimate (protection large)
  - StevenBlack (multi-usage)
  - Easylist FR (publicités françaises)

#### 5.2 - Blocklist Personnalisée
- Fichier: `C:\Users\Alan\AppData\Roaming\CalmWeb\custom_blocklist.json`
- Domaines ajoutés manuellement par l'utilisateur

#### 5.3 - Remote Desktop (si activé)
- **Condition**: `blockRemoteDesktop = true`
- **Domaines bloqués**: TeamViewer, AnyDesk, LogMeIn, Chrome Remote Desktop, etc.
- **Liste complète**: backend/blocklist-manager.js:365-418

#### 5.4 - Vérification des sous-domaines
- Si `example.com` est bloqué → `sub.example.com` est aussi bloqué
- Si `sub.example.com` est bloqué → `example.com` reste autorisé
- **Code**: backend/blocklist-manager.js:475-489

---

## DÉTECTION AUTOMATIQUE DU TYPE DE MENACE

Quand un domaine est bloqué par la blocklist, le système détecte automatiquement le type de menace basé sur le nom de domaine:

### 🖥️ **Remote Desktop**
- Mots-clés: `teamviewer`, `anydesk`, `logmein`, `remotedesktop`
- **Raison affichée**: "Remote Desktop"

### 💰 **Scam**
- Mots-clés: `scam`, `free-money`, `prize`, `winner`
- **Raison affichée**: "Scam"

### 🎣 **Phishing**
- Mots-clés: `phishing`, `secure-bank`, `paypal-verify`, `account-verify`
- **Raison affichée**: "Phishing"

### 📢 **Adware**
- Mots-clés: `ad`, `ads`, `doubleclick`, `analytics`
- **Raison affichée**: "Adware"

### 🦠 **Malware**
- Mots-clés: `malware`, `virus`, `trojan`, `download`
- **Raison affichée**: "Malware"

### 📋 **Par défaut**
- Si aucun pattern ne correspond
- **Raison affichée**: La raison fournie par la blocklist (généralement "Malware")

**Code**: proxy-server.js:296-326

---

## RÉSUMÉ: QUAND UN DOMAINE EST-IL BLOQUÉ?

Un domaine est bloqué SI:

1. ✅ Protection activée (`protectionEnabled = true`)
2. ❌ PAS dans la whitelist
3. ET au moins une de ces conditions:
   - C'est une IP directe ET `blockDirectIPs = true`
   - C'est du HTTP ET `blockHTTPTraffic = true`
   - Port non-standard ET `blockNonStandardPorts = true`
   - Domaine dans la blocklist (principale, custom, ou remote desktop)
   - Un domaine parent est dans la blocklist

## CONFIGURATION PAR DÉFAUT

```json
{
  "protectionEnabled": true,
  "blockDirectIPs": true,
  "blockHTTPTraffic": true,
  "blockNonStandardPorts": true,
  "blockRemoteDesktop": true,
  "blocklistSources": {
    "urlhaus": true,
    "stevenBlack": true,
    "hageziUltimate": true,
    "phishingArmy": true,
    "easylistFR": true
  }
}
```

---

## EXEMPLE CONCRET: `fls-eu.amazon.fr`

Vérifions si `fls-eu.amazon.fr` serait bloqué:

1. ✅ Protection activée? → Oui
2. ❌ Dans la whitelist? → Non
3. ❌ C'est une IP? → Non (`fls-eu.amazon.fr` est un domaine)
4. ⚠️ C'est du HTTP? → Dépend de la requête (HTTPS = OK, HTTP = bloqué si `blockHTTPTraffic = true`)
5. ⚠️ Port non-standard? → Dépend du port (80/443 = OK, autres = bloqués si `blockNonStandardPorts = true`)
6. ❌ Dans la blocklist? → **NON** (vérifié dans test-amazon-blocking.js)
7. ❌ Parent dans la blocklist? → **NON** (`amazon.fr` n'est pas bloqué)

**RÉSULTAT**: `fls-eu.amazon.fr` n'est **PAS BLOQUÉ** (sauf si HTTP ou port non-standard selon config)

---

## FICHIERS DE RÉFÉRENCE

- **Logique de blocage**: `backend/proxy-server.js` (lignes 249-326)
- **Vérification blocklist**: `backend/blocklist-manager.js` (lignes 447-492)
- **Configuration**: `C:\Users\Alan\AppData\Roaming\CalmWeb\config.json`
- **Whitelist**: `C:\Users\Alan\AppData\Roaming\CalmWeb\whitelist.json`
- **Blocklist principale**: `C:\Users\Alan\AppData\Roaming\CalmWeb\blocklist_cache.txt`
- **Blocklist custom**: `C:\Users\Alan\AppData\Roaming\CalmWeb\custom_blocklist.json`
