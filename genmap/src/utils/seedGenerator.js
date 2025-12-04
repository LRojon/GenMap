/**
 * Génère une nouvelle seed à partir d'une seed existante
 * Utilise un algorithme pseudo-aléatoire déterministe (XOR shift)
 * @param {number} seed - La seed initiale
 * @param {number} iteration - Le nombre d'itérations (par défaut 1)
 * @returns {number} La nouvelle seed générée
 */
export function getNextSeed(seed, iteration = 1) {
  // Pour les petites itérations, utiliser une méthode rapide
  if (iteration === 0) return seed;
  if (iteration === 1) {
    // XOR shift rapide
    let x = seed ^ (seed << 13);
    x = x ^ (x >> 17);
    return x ^ (x << 5);
  }
  
  // Pour les itérations multiples, appliquer récursivement
  let result = seed;
  for (let i = 0; i < iteration; i++) {
    let x = result ^ (result << 13);
    x = x ^ (x >> 17);
    result = x ^ (x << 5);
  }
  
  return result >>> 0; // Retourner un nombre positif (32-bit)
}

/**
 * Génère une séquence de seeds à partir d'une seed initiale
 * @param {number} seed - La seed initiale
 * @param {number} count - Le nombre de seeds à générer
 * @returns {number[]} Tableau contenant les seeds générées
 */
export function getNextSeeds(seed, count) {
  const seeds = [];
  let currentSeed = seed;

  for (let i = 0; i < count; i++) {
    currentSeed = getNextSeed(currentSeed);
    seeds.push(currentSeed);
  }

  return seeds;
}
