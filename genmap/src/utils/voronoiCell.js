/**
 * VoronoiCell représente une cellule Voronoi
 * Chaque cellule a:
 * - Un point générateur (position x, y)
 * - Un ensemble de cellules voisines (par ID)
 * - Les pixels qui composent la cellule (arêtes implicites par les pixels)
 */
export class VoronoiCell {
  constructor(id, pointX, pointY) {
    this.id = id;
    this.pointX = pointX;
    this.pointY = pointY;
    
    // Références aux cellules voisines (par ID)
    this.neighbors = new Set();
    
    // Pixels composant cette cellule (indices 1D)
    this.pixels = [];
  }

  /**
   * Ajoute une cellule voisine
   */
  addNeighbor(neighborId) {
    if (neighborId !== this.id) {
      this.neighbors.add(neighborId);
    }
  }

  /**
   * Récupère les voisins sous forme d'Array
   */
  getNeighbors() {
    return Array.from(this.neighbors);
  }

  /**
   * Ajoute un pixel à cette cellule
   */
  addPixel(pixelIdx) {
    this.pixels.push(pixelIdx);
  }

  /**
   * Retourne le nombre de pixels
   */
  getPixelCount() {
    return this.pixels.length;
  }

  /**
   * Nettoie la cellule
   */
  cleanup() {
    this.pixels = [];
  }
}
