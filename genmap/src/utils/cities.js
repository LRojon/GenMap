import { getNextSeed } from './seedGenerator.js';

// Constantes
const SEA_LEVEL = 100;
const BIOME_TYPES = {
  WATER: 0,
  BEACH: 1,
  PLAIN: 2,
  FOREST: 3,
  GRASSLAND: 4,
  DESERT: 5,
  HILLS: 6,
  MOUNTAIN: 7,
  SNOW: 8,
  JUNGLE: 9,
  SWAMP: 10,
};

// Générateur de noms procéduratifs
export class ProcNameGenerator {
  static SYLLABLES = {
    consonants: ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z'],
    vowels: ['a', 'e', 'i', 'o', 'u'],
    clusters: ['br', 'ch', 'dr', 'fl', 'gr', 'sh', 'sk', 'sl', 'sp', 'st', 'th', 'tr', 'tw', 'wh'],
  };

  static seededRandom(seed) {
    // Simple seeded random using XOR shift
    let x = seed >>> 0;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  }

  static generateCityName(seed, regionalSeed = 0) {
    const combinedSeed = seed ^ (regionalSeed * 12345);
    const prng = (i) => this.seededRandom(combinedSeed + i);

    const numSyllables = 2 + Math.floor(prng(0) * 3); // 2-4 syllabes
    let name = '';

    for (let i = 0; i < numSyllables; i++) {
      // 30% de chance de cluster initial
      if (prng(i * 2) < 0.3 && i === 0) {
        const clusterIdx = Math.floor(prng(i * 2 + 1) * this.SYLLABLES.clusters.length);
        name += this.SYLLABLES.clusters[clusterIdx];
      } else {
        const consonantIdx = Math.floor(prng(i * 2) * this.SYLLABLES.consonants.length);
        name += this.SYLLABLES.consonants[consonantIdx];
      }

      const vowelIdx = Math.floor(prng(i * 2 + 0.5) * this.SYLLABLES.vowels.length);
      name += this.SYLLABLES.vowels[vowelIdx];

      // 30% de chance d'ajouter une consonne finale
      if (prng(i * 3) < 0.3) {
        const consonantIdx = Math.floor(prng(i * 3 + 0.5) * this.SYLLABLES.consonants.length);
        name += this.SYLLABLES.consonants[consonantIdx];
      }
    }

    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}

// Classe City
export class City {
  constructor(position, seed = 0, altitude = 127, climate = 127, biome = 0) {
    this.position = position;
    this.seed = seed;
    this.altitude = altitude;
    this.climate = climate;
    this.biome = biome;
    this.score = 0;
    this.name = ProcNameGenerator.generateCityName(seed);
    this.population = 0;
    this.cityType = 'village'; // village, town, city, metropolis
  }

  generateFullData(year = 0) {
    const seed = this.seed;
    const prng = (i) => this._seededRandom(seed + i);

    // Population basée sur le score
    const basePop = Math.floor(this.score * 50) + 500;
    this.population = basePop + Math.floor(prng(0) * basePop * 0.2 - basePop * 0.1);

    // Type de ville
    if (this.population < 1000) {
      this.cityType = 'village';
    } else if (this.population < 5000) {
      this.cityType = 'town';
    } else if (this.population < 20000) {
      this.cityType = 'city';
    } else {
      this.cityType = 'metropolis';
    }

    // Année de fondation
    this.foundedYear = year - Math.floor(prng(1) * 900 + 100);
  }

  _seededRandom(seed) {
    let x = seed >>> 0;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  }
}

// Classe Cities (collection)
export class Cities {
  constructor() {
    this.cities = [];
  }

  generateCity(position, score = 0, seed = 0, altitude = 127, climate = 127, biome = 0) {
    const city = new City(position, seed, altitude, climate, biome);
    city.score = score;
    city.generateFullData();
    this.cities.push(city);
    return city;
  }

  getMinScore() {
    if (!this.cities.length) return 0;
    return Math.min(...this.cities.map(c => c.score));
  }

  getMaxScore() {
    if (!this.cities.length) return 1;
    return Math.max(...this.cities.map(c => c.score));
  }
}

// Classe principale pour le placement des villes
export class CityPlacer {
  constructor(heightMap, climateMap, biomeMap, riverMap, width, height) {
    this.heightMap = heightMap;
    this.climateMap = climateMap;
    this.biomeMap = biomeMap;
    this.riverMap = riverMap;
    this.width = width;
    this.height = height;
    this.cities = new Cities();
  }

  placeCities(numCities, seed) {
    console.log(`\n🏙 City Placement Started (target: ${numCities} cities)`);
    const placementStart = performance.now();

    const scoreMap = this._calculateCityScores();
    const candidates = this._createCandidates(scoreMap);

    console.log(`📍 Candidates found: ${candidates.length} valid positions`);

    if (!candidates.length) {
      console.log('⚠️ No valid candidates for city placement');
      return this.cities;
    }

    const placedCities = [];
    const minDistance = Math.max(this.width, this.height) / 20;
    let attempts = 0;
    const maxAttempts = numCities * 20;

    // Générateur pseudo-aléatoire basé sur seed
    let rngState = seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };

    while (placedCities.length < numCities && attempts < maxAttempts) {
      attempts++;

      // Sélection pondérée par score
      const totalWeight = candidates.reduce((sum, [, score]) => sum + Math.pow(score, 1.5), 0);

      if (totalWeight === 0) break;

      let rand = seededRandom() * totalWeight;
      let cumulative = 0;
      let selectedPosition = null;
      let selectedScore = 0;

      for (const [position, score] of candidates) {
        // Rejeter les scores négatifs
        if (score < 0) continue;
        
        cumulative += Math.pow(score, 1.5);
        if (cumulative >= rand) {
          selectedPosition = position;
          selectedScore = score;
          break;
        }
      }

      if (!selectedPosition) continue;

      // Vérifier que le score n'est pas négatif (eau/montagne)
      if (selectedScore < 0) {
        continue;
      }

      // Vérifier que la position n'est pas dans l'eau
      const [posX, posY] = selectedPosition;
      const posAltitude = this.heightMap[posY * this.width + posX];
      if (posAltitude <= SEA_LEVEL) {
        // Position dans l'eau, sauter
        console.warn(`⚠️ Selected position in water at (${posX}, ${posY}) with altitude ${posAltitude}`);
        continue;
      }

      // Vérifier la distance minimum avec les autres villes
      let tooClose = false;
      for (const placed of placedCities) {
        const dist = Math.hypot(placed[0] - selectedPosition[0], placed[1] - selectedPosition[1]);
        if (dist < minDistance) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) continue;

      // Créer la ville
      placedCities.push(selectedPosition);
      const [x, y] = selectedPosition;
      const altitude = this.heightMap[y * this.width + x];
      const climate = this.climateMap ? this.climateMap[y * this.width + x] : 127;
      const biome = this.biomeMap ? this.biomeMap[y * this.width + x] : 0;

      // Debug: vérifier altitude
      if (altitude <= SEA_LEVEL) {
        console.warn(`⚠️ City placed in water at (${x}, ${y}) with altitude ${altitude}`);
      }

      const cityIndex = this.cities.cities.length;
      const citySeed = getNextSeed(seed, cityIndex);

      console.log(`🏙️ City ${cityIndex+1} at (${x}, ${y}) with selectedScore=${selectedScore}, altitude=${altitude}`);

      this.cities.generateCity(selectedPosition, Math.floor(selectedScore), citySeed, altitude, climate, biome);

      // Filtrer les candidats proches
      const newCandidates = [];
      for (const [pos, score] of candidates) {
        const dist = Math.abs(pos[0] - selectedPosition[0]) + Math.abs(pos[1] - selectedPosition[1]);
        if (dist >= minDistance) {
          newCandidates.push([pos, score]);
        }
      }
      candidates.splice(0, candidates.length, ...newCandidates);

      if (!candidates.length) break;
    }

    const placementTime = performance.now() - placementStart;
    console.log(`%c✓ Placed ${placedCities.length} cities in ${placementTime.toFixed(2)}ms`, 'color: #48bb78;');

    return this.cities;
  }

  _calculateCityScores() {
    const scoreMap = new Float32Array(this.width * this.height);

    // D'abord scorer les pixels clés (tous les 5 pixels)
    // pour optimisation, puis interpoler pour le reste
    const step = 5;
    const keyScores = {};

    // Debug: compter l'eau
    let waterCount = 0;
    let landCount = 0;

    // Calculer les scores pour les pixels clés
    for (let y = 0; y < this.height; y += step) {
      for (let x = 0; x < this.width; x += step) {
        const idx = y * this.width + x;
        const score = this._calculatePixelScore(x, y);
        keyScores[idx] = score;
        
        const altitude = this.heightMap[idx];
        if (altitude <= SEA_LEVEL) {
          waterCount++;
        } else if (altitude <= 180) {
          landCount++;
        }
      }
    }

    console.log(`🌊 Water pixels (key): ${waterCount}, Land pixels (key): ${landCount}`);

    // Remplir la scoreMap complète (interpolation simple)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        const altitude = this.heightMap[idx];

        // Vérification stricte: eau et montagne = score -100
        if (altitude <= SEA_LEVEL || altitude > 180) {
          scoreMap[idx] = -100;
          continue;
        }

        // Chercher le pixel clé le plus proche
        const keyX = Math.round(x / step) * step;
        const keyY = Math.round(y / step) * step;
        const keyIdx = keyY * this.width + keyX;

        // Utiliser le score du pixel clé nearest
        if (keyIdx in keyScores) {
          scoreMap[idx] = keyScores[keyIdx];
        } else {
          // Fallback: calculer directement
          scoreMap[idx] = this._calculatePixelScore(x, y);
        }
      }
    }

    return scoreMap;
  }

  _calculatePixelScore(x, y) {
    const idx = y * this.width + x;
    const altitude = this.heightMap[idx];

    // Score de base: terrain valide (pas l'eau, pas trop haut)
    if (altitude <= SEA_LEVEL) {
      return -100; // Eau = score très négatif
    }
    
    if (altitude > 180) {
      return -100; // Montagne trop haute = score négatif
    }

    const climate = this.climateMap ? this.climateMap[idx] : 127;
    const biome = this.biomeMap ? this.biomeMap[idx] : 0;

    let score = 50;

    // Bonus altitude favorable (130-160)
    if (altitude >= 130 && altitude <= 160) {
      score += 40;
    } else if (altitude > 160 && altitude <= 170) {
      score += 20;
    }

    // Pénalité altitude très élevée
    if (altitude > 170) {
      score -= (altitude - 170) * 0.3;
    }

    // Bonus/pénalité selon le biome
    const biomeScore = this._getBiomeScore(biome);
    score += biomeScore;

    // Bonus/pénalité selon le climat
    const climateScore = this._getClimateScore(climate);
    score += climateScore;

    // ===== Bonus proximité rivière (eau potable) =====
    const riverScore = this._getRiverProximityBonus(x, y);
    score += riverScore;

    // ===== Bonus proximité côte (commerce maritime) =====
    const coastScore = this._getCoastalProximityBonus(x, y);
    score += coastScore;

    // Debug pour x=y=0 ou autres
    if (x === 0 && y === 0) {
      console.log(`🔍 Score breakdown at (0,0): base=50, altitude=${altitude}, biome=${biomeScore}, climate=${climateScore}, river=${riverScore}, coast=${coastScore}, total=${score}`);
    }

    return score; // Pas de Math.max(0, score) - on garde les scores négatifs
  }

  _getRiverProximityBonus(x, y) {
    if (!this.riverMap) return 0;

    let bonus = 0;
    const searchRadius = 15;

    // Chercher les rivières proches
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

        const riverIdx = ny * this.width + nx;
        if (this.riverMap[riverIdx] === 1) {
          // Rivière trouvée!
          const dist = Math.abs(dx) + Math.abs(dy);
          
          if (dist <= 1) {
            bonus += 80; // Très proche = eau potable directe
          } else if (dist <= 3) {
            bonus += 60; // Proche
          } else if (dist <= 5) {
            bonus += 40; // Moyennement proche
          } else if (dist <= 10) {
            bonus += 20; // Accès à la rivière
          } else {
            bonus += 8;  // Très loin mais quand même un peu utile
          }
          // Ne pas continuer la recherche si on a trouvé une rivière
          return bonus;
        }
      }
    }

    return bonus;
  }

  _getCoastalProximityBonus(x, y) {
    let bonus = 0;
    const searchRadius = 25; // Plus large pour les côtes

    // Chercher les côtes proches
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

        const nearbyIdx = ny * this.width + nx;
        const nearbyAltitude = this.heightMap[nearbyIdx];

        // Détection de la côte (transition terre/mer)
        if (nearbyAltitude <= SEA_LEVEL) {
          // Côte trouvée!
          const dist = Math.abs(dx) + Math.abs(dy);

          if (dist <= 2) {
            bonus += 90; // Port naturel parfait (commerce maritime intense)
          } else if (dist <= 4) {
            bonus += 70; // Accès côtier direct (très bon commerce)
          } else if (dist <= 6) {
            bonus += 50; // Pas trop loin (bon commerce)
          } else if (dist <= 10) {
            bonus += 30; // À portée de la côte
          } else {
            bonus += 15; // Loin mais still influence côtière
          }
          // Trouver la côte la plus proche
          return bonus;
        }
      }
    }

    return bonus;
  }

  _getBiomeScore(biome) {
    // Scores basés sur le type de biome
    const biomeScores = {
      [BIOME_TYPES.WATER]: -100,
      [BIOME_TYPES.BEACH]: 20,
      [BIOME_TYPES.PLAIN]: 50,
      [BIOME_TYPES.FOREST]: 60,
      [BIOME_TYPES.GRASSLAND]: 45,
      [BIOME_TYPES.DESERT]: -30,
      [BIOME_TYPES.HILLS]: 40,
      [BIOME_TYPES.MOUNTAIN]: -40,
      [BIOME_TYPES.SNOW]: -60,
      [BIOME_TYPES.JUNGLE]: 30,
      [BIOME_TYPES.SWAMP]: -20,
    };

    return biomeScores[biome] || 0;
  }

  _getClimateScore(climate) {
    // 0-85: Polaire (très froid)
    // 85-127: Tempéré froid
    // 127-170: Tempéré chaud
    // 170-210: Tropical
    // 210-255: Désertique

    let score = 0;

    if (climate < 85) {
      // Polaire: défavorable
      score -= 40;
    } else if (climate < 127) {
      // Tempéré froid: favorable pour forêts/ressources
      score += 30;
    } else if (climate < 170) {
      // Tempéré chaud: très favorable
      score += 50;
    } else if (climate < 210) {
      // Tropical: favorable mais chaud
      score += 20;
    } else {
      // Désertique: défavorable
      score -= 30;
    }

    return score;
  }

  _createCandidates(scoreMap) {
    const candidates = [];
    let scoreDistribution = { water: 0, low: 0, mid: 0, high: 0 };

    // Optimization: only check every 5th pixel (like we scored)
    const step = 5;

    for (let y = 0; y < this.height; y += step) {
      for (let x = 0; x < this.width; x += step) {
        const idx = y * this.width + x;
        
        // Rejeter les scores négatifs (eau, montagne)
        if (scoreMap[idx] < 0) {
          scoreDistribution.water++;
          continue;
        }
        
        if (scoreMap[idx] > 0) {
          candidates.push([[x, y], scoreMap[idx]]);
          
          // Track score distribution
          if (scoreMap[idx] < 50) scoreDistribution.low++;
          else if (scoreMap[idx] < 100) scoreDistribution.mid++;
          else scoreDistribution.high++;
        }
      }
    }

    console.log(`📊 Score distribution (key pixels only):`, scoreDistribution);
    console.log(`📍 Total candidates from key pixels: ${candidates.length}`);
    return candidates;
  }
}
