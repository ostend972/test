# Améliorations du système de Blocklist

## ✅ Déjà implémenté

- ✓ Système de métadonnées pour chaque liste (lastUpdate, domainCount, status, priority)
- ✓ Méthodes de chargement/sauvegarde des métadonnées
- ✓ Méthode `getMetadata()` pour l'API/dashboard

## 🔄 À implémenter

### 1. Priorités de téléchargement

**Ordre de priorité:**
1. **Priorité 1** (Sécurité critique):
   - `phishingArmy` - Protection anti-phishing
   - `urlhaus` - Malware/ransomware

2. **Priorité 2** (Protection large):
   - `hageziUltimate` - Protection maximale

3. **Priorité 3** (Malware + Publicités):
   - `stevenBlack` - Liste populaire multi-usage

4. **Priorité 4** (Confort):
   - `easylistFR` - Publicités françaises

**Implémentation:**
```javascript
// Trier les sources par priorité
const sources = this.configManager.getActiveBlocklistURLs();
sources.sort((a, b) => {
  const priorityA = this.listMetadata[a.key]?.priority || 99;
  const priorityB = this.listMetadata[b.key]?.priority || 99;
  return priorityA - priorityB;
});
```

### 2. Mise à jour progressive

**Objectifs:**
- Télécharger les listes une par une
- Appliquer chaque liste dès qu'elle est téléchargée (protection immédiate)
- Continuer même si une liste échoue
- Afficher la progression en temps réel

**Implémentation:**
```javascript
for (const source of sources) {
  try {
    // Télécharger la liste
    const domains = await this.downloadBlocklist(source.url, source.format);

    // Appliquer immédiatement à la blocklist
    domains.forEach(d => this.blockedDomains.add(d));

    // Mettre à jour les métadonnées
    this.listMetadata[source.key].lastUpdate = new Date();
    this.listMetadata[source.key].domainCount = domains.size;
    this.listMetadata[source.key].status = 'success';

    // Sauvegarder le cache progressivement
    await this.saveToCache();
    await this.saveMetadata();

    logger.info(`✓ ${source.name}: ${domains.size} domaines appliqués`);
  } catch (error) {
    // Marquer comme erreur mais continuer
    this.listMetadata[source.key].status = 'error';
    logger.error(`✗ ${source.name}: ${error.message} - Continue avec les autres`);
  }
}
```

### 3. Gestion des âges différents

**Objectifs:**
- Chaque liste a sa propre date de MAJ
- Mettre à jour uniquement les listes > 24h
- Économiser la bande passante

**Implémentation:**
```javascript
async shouldUpdateList(listKey) {
  const metadata = this.listMetadata[listKey];
  if (!metadata.lastUpdate) return true; // Jamais téléchargé

  const ageHours = (Date.now() - new Date(metadata.lastUpdate)) / (1000 * 60 * 60);
  const updateInterval = this.configManager.getValue('updateInterval', 24);

  return ageHours >= updateInterval;
}

// Dans downloadAndUpdate()
for (const source of sources) {
  if (!await this.shouldUpdateList(source.key)) {
    logger.info(`⏭️  ${source.name}: À jour (dernière MAJ: ${formatAge(metadata.lastUpdate)})`);
    continue;
  }
  // ... télécharger
}
```

### 4. Mode cache intelligent

**Objectifs:**
- En cas d'échec réseau, utiliser la version en cache
- Indicateur visuel de l'âge du cache
- Ne jamais laisser l'utilisateur sans protection

**Implémentation:**
```javascript
try {
  const domains = await this.downloadBlocklist(source.url, source.format);
  this.listMetadata[source.key].status = 'success';
} catch (error) {
  // Essayer de charger depuis le cache
  const cached = await this.loadListFromCache(source.key);
  if (cached) {
    logger.warn(`⚠️  ${source.name}: Échec réseau, utilisation du cache (${formatAge(metadata.lastUpdate)})`);
    this.listMetadata[source.key].status = 'cache';
    // Utiliser le cache
    cached.forEach(d => this.blockedDomains.add(d));
  } else {
    logger.error(`✗ ${source.name}: Échec et pas de cache disponible`);
    this.listMetadata[source.key].status = 'error';
  }
}
```

### 5. Dashboard - Affichage des métadonnées

**Ajouter une section dans le dashboard:**

```jsx
<Card>
  <h3>État des listes de blocage</h3>
  {Object.entries(listMetadata).map(([key, meta]) => (
    <div key={key}>
      <div className="flex justify-between">
        <span>{blocklistNames[key]}</span>
        <span>
          {meta.status === 'success' && `✓ ${meta.domainCount.toLocaleString()} domaines`}
          {meta.status === 'cache' && `⚠️  Cache (${formatAge(meta.lastUpdate)})`}
          {meta.status === 'error' && `✗ Erreur`}
          {meta.status === 'pending' && `⏳ En attente`}
        </span>
      </div>
      <div className="text-xs text-gray-500">
        Dernière MAJ: {formatDate(meta.lastUpdate)}
      </div>
    </div>
  ))}
</Card>
```

### 6. Optimisations supplémentaires

**Compression:**
```javascript
// Accepter gzip si disponible
const options = {
  headers: {
    'Accept-Encoding': 'gzip, deflate'
  }
};
```

**Checksums (optionnel):**
```javascript
// Vérifier l'intégrité si un checksum est fourni
if (source.checksum) {
  const hash = crypto.createHash('sha256');
  hash.update(data);
  if (hash.digest('hex') !== source.checksum) {
    throw new Error('Checksum mismatch - liste corrompue');
  }
}
```

## 📊 Bénéfices attendus

1. **Protection immédiate**: Les domaines critiques (phishing/malware) sont appliqués en premier
2. **Résilience**: Une liste en échec n'empêche pas les autres de se charger
3. **Économie de bande passante**: Mise à jour uniquement des listes périmées
4. **Transparence**: L'utilisateur voit l'état exact de chaque liste
5. **Mode dégradé**: En cas de panne réseau, utilisation du cache

## 🎯 Priorité d'implémentation

1. ✅ **Haute** - Métadonnées (FAIT)
2. **Haute** - Mise à jour progressive (protection immédiate)
3. **Moyenne** - Gestion des âges différents (économie de bande passante)
4. **Moyenne** - Mode cache intelligent (résilience)
5. **Basse** - Dashboard métadonnées (UX)
6. **Basse** - Optimisations (compression, checksums)
