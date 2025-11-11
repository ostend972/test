/**
 * Module de validation de chemins de fichiers
 * Protège contre les attaques de path traversal
 */

const path = require('path');
const fs = require('fs').promises;

/**
 * Valide un chemin de fichier pour l'export/import
 * @param {string} filepath - Le chemin à valider
 * @param {string} baseDir - Le répertoire de base autorisé (optionnel)
 * @param {string[]} allowedExtensions - Extensions autorisées
 * @returns {string} Le chemin validé (absolu)
 */
async function validateFilePath(filepath, baseDir = null, allowedExtensions = ['.json', '.csv', '.txt']) {
  if (!filepath || typeof filepath !== 'string') {
    throw new Error('Invalid file path: must be a non-empty string');
  }

  if (filepath.length > 500) {
    throw new Error('File path too long (max 500 characters)');
  }

  // Résoudre le chemin absolu
  const resolved = path.resolve(filepath);

  // Si un répertoire de base est spécifié, vérifier qu'on reste dedans
  if (baseDir) {
    const baseResolved = path.resolve(baseDir);

    // Normaliser les chemins pour la comparaison (gestion de casse Windows)
    const normalizedResolved = resolved.toLowerCase();
    const normalizedBase = baseResolved.toLowerCase();

    if (!normalizedResolved.startsWith(normalizedBase)) {
      throw new Error('Path traversal detected: file must be in allowed directory');
    }
  }

  // Vérifier l'extension
  const ext = path.extname(resolved).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`);
  }

  // Vérifier que le chemin ne contient pas de caractères dangereux
  const dangerousChars = /[<>"|?*\x00-\x1f]/;
  if (dangerousChars.test(resolved)) {
    throw new Error('File path contains dangerous characters');
  }

  return resolved;
}

/**
 * Valide et sécurise un chemin pour la lecture
 * @param {string} filepath - Le chemin à valider
 * @param {string} baseDir - Le répertoire de base autorisé (optionnel)
 * @param {string[]} allowedExtensions - Extensions autorisées
 * @returns {Promise<string>} Le chemin validé si le fichier existe
 */
async function validateFilePathForRead(filepath, baseDir = null, allowedExtensions = ['.json', '.csv', '.txt']) {
  const validated = await validateFilePath(filepath, baseDir, allowedExtensions);

  // Vérifier que le fichier existe et est accessible
  try {
    const stats = await fs.stat(validated);

    // Vérifier qu'il s'agit bien d'un fichier (pas un répertoire)
    if (!stats.isFile()) {
      throw new Error('Path must point to a file, not a directory');
    }

    // Vérifier la taille du fichier (max 50 MB)
    if (stats.size > 50 * 1024 * 1024) {
      throw new Error('File too large (max 50 MB)');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('File does not exist');
    }
    if (error.code === 'EACCES') {
      throw new Error('File is not readable');
    }
    throw error;
  }

  return validated;
}

/**
 * Valide et sécurise un chemin pour l'écriture
 * @param {string} filepath - Le chemin à valider
 * @param {string} baseDir - Le répertoire de base autorisé (optionnel)
 * @param {string[]} allowedExtensions - Extensions autorisées
 * @returns {Promise<string>} Le chemin validé
 */
async function validateFilePathForWrite(filepath, baseDir = null, allowedExtensions = ['.json', '.csv', '.txt']) {
  const validated = await validateFilePath(filepath, baseDir, allowedExtensions);

  // Vérifier que le répertoire parent existe et est accessible
  const dir = path.dirname(validated);
  try {
    const dirStats = await fs.stat(dir);
    if (!dirStats.isDirectory()) {
      throw new Error('Parent path is not a directory');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Parent directory does not exist');
    }
    if (error.code === 'EACCES') {
      throw new Error('Parent directory is not accessible');
    }
    throw error;
  }

  // Si le fichier existe déjà, vérifier qu'il est écrasable
  try {
    const fileStats = await fs.stat(validated);
    if (!fileStats.isFile()) {
      throw new Error('Path exists but is not a file');
    }
  } catch (error) {
    // Le fichier n'existe pas, c'est OK (on va le créer)
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  return validated;
}

/**
 * Crée un chemin de fichier sécurisé dans un répertoire donné
 * @param {string} baseDir - Le répertoire de base
 * @param {string} filename - Le nom de fichier souhaité
 * @param {string} extension - L'extension (avec le point)
 * @returns {string} Le chemin complet et sécurisé
 */
function createSafeFilePath(baseDir, filename, extension = '.json') {
  // Nettoyer le nom de fichier
  const safeName = filename
    .replace(/[^a-z0-9_-]/gi, '_')
    .substring(0, 100);

  // Créer le chemin complet
  return path.join(baseDir, safeName + extension);
}

module.exports = {
  validateFilePath,
  validateFilePathForRead,
  validateFilePathForWrite,
  createSafeFilePath
};
