const crypto = require('crypto');

/**
 * Bloom Filter pour optimiser la mémoire de la blocklist
 * Taux de faux positifs: ~0.1% avec 10 fonctions de hash et taille appropriée
 */
class BloomFilter {
  /**
   * @param {number} expectedElements - Nombre d'éléments attendus
   * @param {number} falsePositiveRate - Taux de faux positifs (défaut: 0.001 = 0.1%)
   */
  constructor(expectedElements, falsePositiveRate = 0.001) {
    this.expectedElements = expectedElements;
    this.falsePositiveRate = falsePositiveRate;

    // Calculer la taille optimale du filtre (en bits)
    this.size = this.optimalFilterSize(expectedElements, falsePositiveRate);

    // Calculer le nombre optimal de fonctions de hash
    this.numHashes = this.optimalNumHashes(this.size, expectedElements);

    // Créer le tableau de bits (représenté par un Uint8Array)
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));

    // Compteur d'éléments ajoutés
    this.count = 0;

    // Statistiques
    this.stats = {
      adds: 0,
      checks: 0,
      hits: 0,
      misses: 0
    };
  }

  /**
   * Calcule la taille optimale du filtre (formule Bloom)
   * m = -(n * ln(p)) / (ln(2)^2)
   */
  optimalFilterSize(n, p) {
    const size = Math.ceil(-(n * Math.log(p)) / (Math.log(2) ** 2));
    return size;
  }

  /**
   * Calcule le nombre optimal de fonctions de hash
   * k = (m/n) * ln(2)
   */
  optimalNumHashes(m, n) {
    const k = Math.ceil((m / n) * Math.log(2));
    return Math.max(1, Math.min(k, 20)); // Entre 1 et 20
  }

  /**
   * Génère un hash pour un élément avec une seed
   * @param {string} item
   * @param {number} seed
   * @returns {number}
   */
  hash(item, seed) {
    const hash = crypto.createHash('sha256');
    hash.update(item + seed.toString());
    const digest = hash.digest();

    // Convertir les premiers 4 bytes en nombre
    let value = 0;
    for (let i = 0; i < 4; i++) {
      value = (value * 256 + digest[i]) >>> 0;
    }

    return value % this.size;
  }

  /**
   * Ajoute un élément au filtre
   * @param {string} item
   */
  add(item) {
    if (!item) return;

    const itemStr = item.toString().toLowerCase();

    for (let i = 0; i < this.numHashes; i++) {
      const position = this.hash(itemStr, i);
      const byteIndex = Math.floor(position / 8);
      const bitIndex = position % 8;

      this.bitArray[byteIndex] |= (1 << bitIndex);
    }

    this.count++;
    this.stats.adds++;
  }

  /**
   * Vérifie si un élément est possiblement dans le filtre
   * @param {string} item
   * @returns {boolean} true si possiblement présent, false si définitivement absent
   */
  has(item) {
    if (!item) return false;

    this.stats.checks++;
    const itemStr = item.toString().toLowerCase();

    for (let i = 0; i < this.numHashes; i++) {
      const position = this.hash(itemStr, i);
      const byteIndex = Math.floor(position / 8);
      const bitIndex = position % 8;

      // Si un seul bit n'est pas set, l'élément n'est définitivement pas dans le filtre
      if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
        this.stats.misses++;
        return false;
      }
    }

    // Tous les bits sont set, l'élément est possiblement présent
    this.stats.hits++;
    return true;
  }

  /**
   * Réinitialise le filtre
   */
  clear() {
    this.bitArray.fill(0);
    this.count = 0;
  }

  /**
   * Calcule le taux de remplissage du filtre
   * @returns {number} Entre 0 et 1
   */
  getFillRate() {
    let setBits = 0;
    for (let i = 0; i < this.bitArray.length; i++) {
      for (let j = 0; j < 8; j++) {
        if ((this.bitArray[i] & (1 << j)) !== 0) {
          setBits++;
        }
      }
    }
    return setBits / this.size;
  }

  /**
   * Calcule le taux de faux positifs actuel
   * @returns {number}
   */
  getActualFalsePositiveRate() {
    const fillRate = this.getFillRate();
    return Math.pow(fillRate, this.numHashes);
  }

  /**
   * Obtient les statistiques du filtre
   * @returns {object}
   */
  getStats() {
    const memoryBytes = this.bitArray.byteLength;
    const memoryKB = (memoryBytes / 1024).toFixed(2);
    const memoryMB = (memoryBytes / (1024 * 1024)).toFixed(2);

    return {
      expectedElements: this.expectedElements,
      actualElements: this.count,
      size: this.size,
      numHashes: this.numHashes,
      fillRate: (this.getFillRate() * 100).toFixed(2) + '%',
      memoryBytes,
      memoryKB: `${memoryKB} KB`,
      memoryMB: `${memoryMB} MB`,
      expectedFalsePositiveRate: (this.falsePositiveRate * 100).toFixed(3) + '%',
      actualFalsePositiveRate: (this.getActualFalsePositiveRate() * 100).toFixed(3) + '%',
      checks: this.stats.checks,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.checks > 0 ? ((this.stats.hits / this.stats.checks) * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * Exporte le filtre en Buffer
   * @returns {Buffer}
   */
  export() {
    return Buffer.from(this.bitArray);
  }

  /**
   * Importe un filtre depuis un Buffer
   * @param {Buffer} buffer
   */
  import(buffer) {
    if (buffer.length !== this.bitArray.byteLength) {
      throw new Error('Buffer size mismatch');
    }
    this.bitArray = new Uint8Array(buffer);
  }
}

module.exports = BloomFilter;
