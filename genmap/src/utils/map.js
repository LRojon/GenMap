import { generatePerlinNoise } from './perlin';
import { getNextSeed } from './seedGenerator';

export class Map {
  constructor() {
    this.heightMap = null;
    this.climateMap = null;
  }


  generate(width, height, seed, maskStrength = 1.5) {
    this.genHeightMap(width, height, seed);
    this.genVariation(width, height, getNextSeed(seed, 1), maskStrength);
    this.genClimate(width, height, getNextSeed(seed, 2));
  }

  genHeightMap(width, height, seed) {
    console.log('Generating height map with Perlin Noise...');
    
    const perlinNoise = generatePerlinNoise(width, height, seed, 8, 0.5, 250);
    
    this.heightMap = new Array(height);
    for (let y = 0; y < height; y++) {
      this.heightMap[y] = new Array(width);
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        this.heightMap[y][x] = perlinNoise[idx];
      }
    }
    
    console.log('Height map generated');
    return this.heightMap;
  }

  genVariation(width, height, seed, maskStrength = 3) { 
    if (!this.heightMap) {
      throw new Error('heightMap must be generated first with genHeightMap()');
    }
    const variationNoise = generatePerlinNoise(width, height, seed, 8, 0.5, 100);
    
    // Centre de la carte
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        const noiseNormalized = variationNoise[idx] / 255;
        const factor = 0.5 + (noiseNormalized * 1.0);
        
        let newValue = this.heightMap[y][x] * factor * 1.2;
        
        // Appliquer le mask radial pour créer l'apparance d'îles
        // Distance du centre
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Falloff graduel vers les bords (force ajustable)
        const falloff = 1 - Math.pow(dist / maxDist, maskStrength);
        
        // Appliquer le falloff à la hauteur
        newValue *= falloff;
        
        
        newValue = Math.max(0, Math.min(255, newValue));
        this.heightMap[y][x] = Math.floor(newValue);
      }
    }
    
    return this.heightMap;
  }


  getHeightMap1D() {
    if (!this.heightMap) {
      return null;
    }

    const width = this.heightMap[0].length;
    const height = this.heightMap.length;
    const result = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result[y * width + x] = this.heightMap[y][x];
      }
    }

    return result;
  }

  genClimate(width, height, seed) {
    console.log('Generating climate map with Perlin Noise...');
    
    const climateNoise = generatePerlinNoise(width, height, seed, 6, 0.6, 125);
    
    this.climateMap = new Array(height);
    for (let y = 0; y < height; y++) {
      this.climateMap[y] = new Array(width);
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        // Normaliser entre 0 et 255
        // climateNoise est entre 0 et 255, donc juste copier
        this.climateMap[y][x] = Math.floor(climateNoise[idx]);
      }
    }
    
    console.log('Climate map generated');
    return this.climateMap;
  }

  getClimateMap1D() {
    if (!this.climateMap) {
      return null;
    }

    const width = this.climateMap[0].length;
    const height = this.climateMap.length;
    const result = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result[y * width + x] = this.climateMap[y][x];
      }
    }

    return result;
  }
}
