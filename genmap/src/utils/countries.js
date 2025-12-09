import { SEA_LEVEL } from './constants.js';
import { getNextSeed } from './seedGenerator.js';
import { ProcNameGenerator, City } from './cities.js';




// Classe Country
export class Country {
  constructor(id, capitalCity, seed = 0) {
    this.id = id;
    this.capitalCity = capitalCity;
    this.seed = seed;
    this.name = ProcNameGenerator.generateCountryName(seed);
    this.color = this._generateColor(seed);
    this.pixels = []; // Indices 1D des pixels
    this.cities = [capitalCity]; // Liste des villes du pays
    this.population = capitalCity.population;
    this.area = 0;
    this.mainBiome = capitalCity.biome;
    this.mainClimate = capitalCity.climate;
  }

  _generateColor(seed) {
    // Couleur HSL déterministe basée sur seed
    const h = (seed * 137.508) % 360; // Golden angle pour distribution uniforme
    const s = 70 + ((seed * 12345) % 20); // 70-90% saturation
    const l = 50 + ((seed * 54321) % 15); // 50-65% lightness
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  addPixel(pixelIndex) {
    this.pixels.push(pixelIndex);
    this.area++;
  }

  addCity(city) {
    if (!this.cities.includes(city)) {
      this.cities.push(city);
      this.population += city.population;
    }
  }

  removeCity(city) {
    const idx = this.cities.indexOf(city);
    if (idx > -1) {
      this.cities.splice(idx, 1);
      this.population -= city.population;
    }
  }
}

// Classe principale pour génération des pays
export class CountryGenerator {
  constructor(heightMap, climateMap, biomeMap, cities, width, height, riverMap = null, options = {}, cityCandidates = null) {
    this.heightMap = heightMap;
    this.climateMap = climateMap;
    this.biomeMap = biomeMap;
    this.riverMap = riverMap;
    this.cities = cities.cities; // Array de City objects
    this.width = width;
    this.height = height;
    this.countries = [];
    
    // ⚡ Candidats de CityPlacer pour les smallvillages
    this.cityCandidates = cityCandidates || [];
    
    // Influence map: [influence, countryId] pour chaque pixel
    this.influenceMap = new Array(width * height);
    for (let i = 0; i < width * height; i++) {
      this.influenceMap[i] = [0, -1]; // [influence, countryId]
    }
    
    // Options de perturbation des frontières
    this.borderPerturbationEnabled = options.borderPerturbationEnabled !== false; // true par défaut
    this.perturbationAmount = options.perturbationAmount ?? 0.15; // [0-1] : 0.15 = 15% de variation
    this.perturbationScale = options.perturbationScale ?? 30; // Fréquence du bruit (pixels)
    this.perturbationOctaves = options.perturbationOctaves ?? 2; // Nombre de couches de bruit
  }

  /**
   * Nettoie la mémoire après génération
   * Supprime les structures temporaires volumineuses
   * Garde voronoiRegionMap car il est utilisé par ReligionSystem
   */
  cleanup() {
    // Supprimer les cartes temporaires (occupent beaucoup de RAM)
    // NOTE: garder voronoiRegionMap pour ReligionSystem.propagateReligions()
    this.influenceMap = null;
  }

  generateCountries(seed = 0) {
    const countryStart = performance.now();

    // Étape 0: Calculer le nombre de pays et sélectionner les capitales
    const capitalCities = this._selectCapitalCities(seed);

    // Étape 0.5: Générer les petits villages AVANT les pays (pour inclusion dans Voronoi)
    this._generateSmallVillages(seed, capitalCities.length);

    // Étape 1: Créer un pays pour chaque capitale
    this._initializeCountries(capitalCities, seed);

    // Étape 2: NOUVELLE APPROCHE - Générer Voronoi avec points supplémentaires (incluant smallVillages)
    this._generateVoronoiWithAdditionalPoints(seed);

    // Étape 3: Assigner les pixels aux pays via Voronoi + propagation avec déperdition
    this._assignPixelsThroughVoronoi(seed);

    // Étape 4: Gérer les îles
    this._handleIslands();

    // Étape 5: Réassigner les villes capturées
    this._reassignCapturedCities();

    const countryTime = performance.now() - countryStart;
    console.log(`%c✓ Countries generated in ${countryTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Nettoyer la mémoire temporaire (sauf voronoiRegionMap)
    this.cleanup();

    return this.countries;
  }

  _generateSmallVillages(seed, numCountries) {
    /**
     * Génère des petits villages à partir des candidats CityPlacer
     * ⚡ SUPER OPTIMISÉ: Réutiliser les candidats au lieu de rescanner!
     * Les candidats viennent du scan tous les 5 pixels des villes principales
     */
    
    // Utiliser les candidats du CityPlacer (déjà filtrés, déjà scorés)
    let villagePositions = this.cityCandidates && this.cityCandidates.length > 0 
      ? [...this.cityCandidates]  // Copie pour ne pas modifier l'original
      : [];
    
    // Si pas de candidats, fallback vide (les villes principales suffisent)
    if (villagePositions.length === 0) {
      return;
    }
    
    let rngState = seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };
    
    // Nombre total de villages à générer (3-5 par pays)
    const villageBaseSeed = getNextSeed(seed, 999);
    let numVillagesRngState = villageBaseSeed;
    const numVillagesRandom = () => {
      numVillagesRngState = (numVillagesRngState * 1103515245 + 12345) >>> 0;
      return (numVillagesRngState >>> 0) / 0x100000000;
    };
    
    const totalVillagesToGenerate = numCountries * (3 + Math.floor(numVillagesRandom() * 3)); // 3-5 par pays
    
    // Sélectionner aléatoirement N villages parmi les candidats
    const placedVillages = [];
    const minDistanceVillages = 30; // Minimum entre deux villages
    
    for (let v = 0; v < totalVillagesToGenerate && villagePositions.length > 0; v++) {
      const villageSeed = getNextSeed(villageBaseSeed, v + 1);
      
      // Sélection pondérée par score (bas score = plus probable pour villages)
      const totalWeight = villagePositions.reduce((sum, [, , , score]) => sum + Math.max(0, 100 - score), 0);
      
      if (totalWeight <= 0) break;
      
      let rand = seededRandom() * totalWeight;
      let cumulative = 0;
      let selectedIdx = -1;
      
      for (let i = 0; i < villagePositions.length; i++) {
        const [, , , score] = villagePositions[i];
        const weight = Math.max(0, 100 - score);
        cumulative += weight;
        if (cumulative >= rand) {
          selectedIdx = i;
          break;
        }
      }
      
      if (selectedIdx === -1) break;
      
      const [pixelIdx, x, y, score] = villagePositions[selectedIdx];
      
      // Vérifier distance min avec autres villages placés
      let tooCloseToOtherVillage = false;
      for (const [placeX, placeY] of placedVillages) {
        const dist = Math.hypot(placeX - x, placeY - y);
        if (dist < minDistanceVillages) {
          tooCloseToOtherVillage = true;
          break;
        }
      }
      
      if (tooCloseToOtherVillage) {
        // Supprimer ce candidat et continuer
        villagePositions.splice(selectedIdx, 1);
        continue;
      }
      
      // Position valide, créer le village
      const altitude = this.heightMap[pixelIdx];
      const climate = this.climateMap[pixelIdx];
      const village = new City(
        [x, y],
        villageSeed,
        altitude,
        climate,
        this.biomeMap[pixelIdx]
      );
      
      village.score = score;
      village.generateFullData();
      
      this.cities.push(village);
      placedVillages.push([x, y]);
      
      // Supprimer les candidats proches de celui-ci
      const newPositions = [];
      for (const [pIdx, pX, pY, pScore] of villagePositions) {
        const dist = Math.abs(pX - x) + Math.abs(pY - y);
        if (dist >= minDistanceVillages) {
          newPositions.push([pIdx, pX, pY, pScore]);
        }
      }
      villagePositions.splice(0, villagePositions.length, ...newPositions);
    }
  }

  _selectCapitalCities(seed) {
    // Calculer le nombre de pays
    const area = this.width * this.height;
    const baseCountries = Math.floor(area / 25000);
    
    // Variation aléatoire déterministe ±30%
    let rngState = seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };
    
    const variation = 0.7 + seededRandom() * 0.6; // Entre 0.7 et 1.3
    const numCountries = Math.max(3, Math.floor(baseCountries * variation));

    // Trier les villes par score décroissant
    const sortedCities = [...this.cities].sort((a, b) => b.score - a.score);

    // Prendre les X meilleures villes comme capitales
    const capitalCities = sortedCities.slice(0, Math.min(numCountries, sortedCities.length));

    return capitalCities;
  }

  _initializeCountries(capitalCities, seed) {
    for (let i = 0; i < capitalCities.length; i++) {
      const city = capitalCities[i];
      const citySeed = getNextSeed(seed, i);
      const country = new Country(i, city, citySeed);
      this.countries.push(country);
    }
  }

  _generateVoronoiWithAdditionalPoints(seed) {
    /**
     * Étape 2: Générer Voronoi avec:
     * - Positions des villes
     * - Positions des smallVillages
     * - Points supplémentaires proportionnels à la superficie
     */
    
    // Collecter tous les points Voronoi
    const voronoiPoints = [];
    
    // Ajouter toutes les villes et smallVillages
    for (const city of this.cities) {
      voronoiPoints.push(city.position);
    }
    
    // Calculer le nombre de points supplémentaires proportionnels à la superficie
    const area = this.width * this.height;
    const baseAdditionalPoints = Math.floor(area / 8000); // ~1 point par 8000 pixels
    
    let rngState = seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };
    
    // Générer les points supplémentaires aléatoires
    for (let i = 0; i < baseAdditionalPoints; i++) {
      const x = Math.floor(seededRandom() * this.width);
      const y = Math.floor(seededRandom() * this.height);
      voronoiPoints.push([x, y]);
    }
    
    
    // Créer la carte Voronoi simple (closest point)
    this.voronoiRegionMap = new Uint32Array(this.width * this.height);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let closestIdx = 0;
        let closestDist = Infinity;
        
        for (let i = 0; i < voronoiPoints.length; i++) {
          const [px, py] = voronoiPoints[i];
          const dx = px - x;
          const dy = py - y;
          const dist = dx * dx + dy * dy;
          
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }
        
        this.voronoiRegionMap[y * this.width + x] = closestIdx;
      }
    }
    
    this.voronoiPoints = voronoiPoints;
  }

  _assignPixelsThroughVoronoi(seed) {
    /**
     * Étape 3: Assigner les pixels aux pays via Voronoi + propagation avec déperdition
     */
    
    // Initialiser la map d'influence basée sur Voronoi
    this.influenceMap = new Array(this.width * this.height);
    for (let i = 0; i < this.width * this.height; i++) {
      this.influenceMap[i] = [0, -1];
    }
    
    // Map: voronoi region index -> country id (ou -1 si non assigné)
    const regionToCountry = new Int32Array(this.voronoiPoints.length);
    regionToCountry.fill(-1);
    
    // Map: voronoi point index -> city (pour trouver le pays propriétaire)
    const voronoiPointToCity = new Map();
    for (let i = 0; i < this.voronoiPoints.length; i++) {
      const point = this.voronoiPoints[i];
      for (const city of this.cities) {
        if (city.position[0] === point[0] && city.position[1] === point[1]) {
          voronoiPointToCity.set(i, city);
          break;
        }
      }
    }
    
    // Assigner les régions Voronoi contenant les capitales ET les autres villes aux pays
    // D'abord, assigner les capitales
    for (let countryIdx = 0; countryIdx < this.countries.length; countryIdx++) {
      const capital = this.countries[countryIdx].capitalCity;
      const [cx, cy] = capital.position;
      const capitalIdx = cy * this.width + cx;
      const regionIdx = this.voronoiRegionMap[capitalIdx];
      regionToCountry[regionIdx] = countryIdx;
    }
    
    // Ensuite, assigner les autres villes à leur pays respectif si c'est possible
    for (let i = 0; i < this.voronoiPoints.length; i++) {
      const city = voronoiPointToCity.get(i);
      if (city && regionToCountry[i] === -1) {
        // Chercher le pays auquel appartient cette ville
        for (let countryIdx = 0; countryIdx < this.countries.length; countryIdx++) {
          if (this.countries[countryIdx].cities.includes(city)) {
            regionToCountry[i] = countryIdx;
            break;
          }
        }
      }
    }
    
    let rngState = seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };
    
    // Propagation d'influence avec déperdition aléatoire
    // Utiliser une BFS depuis les régions assignées
    const visited = new Uint8Array(this.voronoiPoints.length);
    const queue = [];
    
    // Initialiser avec les régions des capitales (influence max = 1.0)
    for (let i = 0; i < regionToCountry.length; i++) {
      if (regionToCountry[i] >= 0) {
        queue.push([i, 1.0, regionToCountry[i]]);
        visited[i] = 1;
      }
    }
    
    // Récupérer les voisins des régions Voronoi (deux régions sont voisines si elles partagent une bordure)
    const regionNeighbors = this._computeVoronoiNeighbors();
    
    // BFS avec propagation d'influence
    while (queue.length > 0) {
      const [regionIdx, influence, countryId] = queue.shift();
      
      if (!regionNeighbors.has(regionIdx)) continue;
      
      for (const neighborRegionIdx of regionNeighbors.get(regionIdx)) {
        if (visited[neighborRegionIdx]) continue;
        visited[neighborRegionIdx] = 1;
        
        // Appliquer une déperdition aléatoire (5-15% seulement)
        const randomLoss = 0.05 + seededRandom() * 0.1;
        const newInfluence = influence * (1 - randomLoss);
        
        // Ajouter à la queue seulement si influence > seuil minimal très bas
        if (newInfluence > 0.01) {
          regionToCountry[neighborRegionIdx] = countryId;
          queue.push([neighborRegionIdx, newInfluence, countryId]);
        }
      }
    }
    
    // Assigner les régions orphelines (non visitées) à leur plus proche région assignée
    const unassignedRegions = [];
    for (let i = 0; i < regionToCountry.length; i++) {
      if (regionToCountry[i] === -1) {
        unassignedRegions.push(i);
      }
    }
    
    if (unassignedRegions.length > 0) {
      for (const unassignedRegionIdx of unassignedRegions) {
        // Trouver la région assignée la plus proche
        let closestRegion = -1;
        
        if (regionNeighbors.has(unassignedRegionIdx)) {
          for (const neighborRegionIdx of regionNeighbors.get(unassignedRegionIdx)) {
            if (regionToCountry[neighborRegionIdx] >= 0) {
              closestRegion = neighborRegionIdx;
              break;
            }
          }
        }
        
        // Si pas de voisin assigné, chercher via BFS
        if (closestRegion === -1) {
          const bfsQueue = [unassignedRegionIdx];
          const bfsVisited = new Set([unassignedRegionIdx]);
          
          while (bfsQueue.length > 0 && closestRegion === -1) {
            const currentRegion = bfsQueue.shift();
            
            if (regionNeighbors.has(currentRegion)) {
              for (const neighborRegionIdx of regionNeighbors.get(currentRegion)) {
                if (!bfsVisited.has(neighborRegionIdx)) {
                  bfsVisited.add(neighborRegionIdx);
                  
                  if (regionToCountry[neighborRegionIdx] >= 0) {
                    closestRegion = neighborRegionIdx;
                    break;
                  }
                  
                  bfsQueue.push(neighborRegionIdx);
                }
              }
            }
          }
        }
        
        // Assigner à la région la plus proche trouvée
        if (closestRegion >= 0) {
          regionToCountry[unassignedRegionIdx] = regionToCountry[closestRegion];
        }
      }
    }
    
    // Assigner tous les pixels des régions Voronoi aux pays
    for (let pixelIdx = 0; pixelIdx < this.width * this.height; pixelIdx++) {
      const regionIdx = this.voronoiRegionMap[pixelIdx];
      const countryId = regionToCountry[regionIdx];
      
      if (countryId >= 0) {
        this.countries[countryId].addPixel(pixelIdx);
      }
    }
    
    // Retirer les pixels d'eau des pays
    for (let i = 0; i < this.width * this.height; i++) {
      const altitude = this.heightMap[i];
      
      if (altitude <= SEA_LEVEL) {
        const regionIdx = this.voronoiRegionMap[i];
        const countryId = regionToCountry[regionIdx];
        
        if (countryId >= 0) {
          const country = this.countries[countryId];
          const pixelIndex = country.pixels.indexOf(i);
          if (pixelIndex > -1) {
            country.pixels.splice(pixelIndex, 1);
            country.area--;
          }
        }
      }
    }
  }

  _computeVoronoiNeighbors() {
    /**
     * Calcule les voisins des régions Voronoi
     * Deux régions sont voisines si elles partagent une bordure (pixel voisin)
     */
    const neighbors = new Map();
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pixelIdx = y * this.width + x;
        const regionIdx = this.voronoiRegionMap[pixelIdx];
        
        // Vérifier les 4 voisins
        const neighborCoords = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];
        
        for (const [nx, ny] of neighborCoords) {
          if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
          
          const neighborPixelIdx = ny * this.width + nx;
          const neighborRegionIdx = this.voronoiRegionMap[neighborPixelIdx];
          
          if (neighborRegionIdx !== regionIdx) {
            // Ces deux régions sont voisines
            if (!neighbors.has(regionIdx)) {
              neighbors.set(regionIdx, new Set());
            }
            neighbors.get(regionIdx).add(neighborRegionIdx);
          }
        }
      }
    }
    
    return neighbors;
  }

  _handleIslands() {
    // Islands handled via Voronoi-based approach
  }

  _reassignCapturedCities() {
    // Pour chaque ville, vérifier si elle appartient à un pays
    // Les villes appartiennent déjà aux pays via la région Voronoi
    for (let cityIdx = 0; cityIdx < this.cities.length; cityIdx++) {
      const city = this.cities[cityIdx];
      const [x, y] = city.position;
      const pixelIdx = y * this.width + x;
      const regionIdx = this.voronoiRegionMap[pixelIdx];
      
      // Trouver quel pays possède cette région
      let ownerCountryId = -1;
      for (let countryIdx = 0; countryIdx < this.countries.length; countryIdx++) {
        // Vérifier si cette région appartient au pays
        const hasPixel = this.countries[countryIdx].pixels.some(p => 
          this.voronoiRegionMap[p] === regionIdx
        );
        if (hasPixel) {
          ownerCountryId = countryIdx;
          break;
        }
      }
      
      if (ownerCountryId >= 0) {
        const ownerCountry = this.countries[ownerCountryId];
        if (!ownerCountry.cities.includes(city)) {
          ownerCountry.addCity(city);
        }
      }
    }
  }

  _calculateLocationScore(altitude, climate) {
    // Calcule le score potentiel d'un emplacement basé sur altitude et climat
    // Similar to CityPlacer._calculatePixelScore
    
    if (altitude <= 0.4) {
      return 0; // Eau = score 0
    }
    
    if (altitude > 180 / 255) { // Montagne trop haute (normalisée)
      return 0; // Score 0
    }

    let score = 50;

    // Bonus altitude favorable (130-160 normalisé = 0.51-0.63)
    const altNorm = altitude * 255;
    if (altNorm >= 130 && altNorm <= 160) {
      score += 40;
    } else if (altNorm > 160 && altNorm <= 170) {
      score += 20;
    }

    // Pénalité altitude très élevée
    if (altNorm > 170) {
      score -= (altNorm - 170) * 0.3;
    }

    // Bonus/pénalité selon le climat (normalisé 0-255)
    const climateNorm = climate * 255;
    if (climateNorm < 85) {
      score -= 40; // Polaire
    } else if (climateNorm < 127) {
      score += 30; // Tempéré froid
    } else if (climateNorm < 170) {
      score += 50; // Tempéré chaud
    } else if (climateNorm < 210) {
      score += 20; // Tropical
    } else {
      score -= 30; // Désertique
    }

    // Score minimum 20 pour assurer une population positive
    return Math.max(20, score);
  }
}
