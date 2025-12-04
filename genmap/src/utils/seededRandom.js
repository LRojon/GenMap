/**
 * Implémentation d'un générateur de nombres aléatoires déterministe
 * basé sur un seed (compatible avec Python's random module)
 */

export class SeededRandom {
  constructor(seed) {
    this.seed = seed >>> 0; // Convertir en uint32
    this.a = 1664525;
    this.c = 1013904223;
    this.m = 2 ** 32;
  }

  /**
   * Génère le prochain nombre aléatoire
   */
  next() {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed / this.m; // Retourner [0, 1)
  }

  /**
   * Génère un nombre entier aléatoire dans [min, max)
   */
  randint(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Choisit un élément aléatoire d'un tableau
   */
  choice(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[this.randint(0, arr.length)];
  }

  /**
   * Retourne true avec une probabilité donnée [0, 1]
   */
  random() {
    return this.next();
  }

  /**
   * Génère un nombre aléatoire dans [0, 1)
   */
  uniform() {
    return this.next();
  }
}
