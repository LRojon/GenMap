import { SEA_LEVEL } from './constants.js';
import { getNextSeed } from './seedGenerator.js';

// Générateur de noms procéduraux pour pays
class ProcCountryNameGenerator {
  static SYLLABLES = {
    consonants: ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z'],
    vowels: ['a', 'e', 'i', 'o', 'u'],
    clusters: ['br', 'ch', 'dr', 'fl', 'gr', 'sh', 'sk', 'sl', 'sp', 'st', 'th', 'tr', 'tw', 'wh'],
  };

  static seededRandom(seed) {
    let x = seed >>> 0;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  }

  static generateCountryName(seed) {
    const prng = (i) => this.seededRandom(seed + i);
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

// Classe Country
export class Country {
  constructor(id, capitalCity, seed = 0) {
    this.id = id;
    this.capitalCity = capitalCity;
    this.seed = seed;
    this.name = ProcCountryNameGenerator.generateCountryName(seed);
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
  constructor(heightMap, climateMap, biomeMap, cities, width, height) {
    this.heightMap = heightMap;
    this.climateMap = climateMap;
    this.biomeMap = biomeMap;
    this.cities = cities.cities; // Array de City objects
    this.width = width;
    this.height = height;
    this.countries = [];
    
    // Influence map: [influence, countryId] pour chaque pixel
    this.influenceMap = new Array(width * height);
    for (let i = 0; i < width * height; i++) {
      this.influenceMap[i] = [0, -1]; // [influence, countryId]
    }
  }

  generateCountries(seed = 0) {
    console.log(`\n🏛️ Country Generation Started (${this.cities.length} countries)`);
    const countryStart = performance.now();

    // Étape 1: Créer un pays pour chaque ville
    this._initializeCountries(seed);

    // Étape 2: Initialiser l'influence map avec les villes
    this._initializeInfluenceMap();

    // Étape 3: Propager l'influence
    this._propagateInfluence();

    // Étape 4: Assigner les pixels aux pays
    this._assignPixelsToCountries();

    // Étape 5: Réassigner les villes capturées
    this._reassignCapturedCities();

    const countryTime = performance.now() - countryStart;
    console.log(`%c✓ Countries generated in ${countryTime.toFixed(2)}ms`, 'color: #48bb78;');
    console.log(`📊 Total countries: ${this.countries.length}`);

    return this.countries;
  }

  _initializeCountries(seed) {
    for (let i = 0; i < this.cities.length; i++) {
      const city = this.cities[i];
      const citySeed = getNextSeed(seed, i);
      const country = new Country(i, city, citySeed);
      this.countries.push(country);
    }
    console.log(`🏛️ Created ${this.countries.length} countries (1 per city)`);
  }

  _initializeInfluenceMap() {
    // Initialiser la carte d'influence: une influence par ville
    for (let countryId = 0; countryId < this.countries.length; countryId++) {
      const city = this.countries[countryId].capitalCity;
      const [x, y] = city.position;
      const idx = y * this.width + x;
      
      // Placer l'influence initiale à la ville
      // Normaliser le score (0-100) à une valeur de base (50-150)
      const baseInfluence = Math.max(50, Math.min(150, city.score));
      this.influenceMap[idx] = [baseInfluence, countryId];
    }

    console.log(`📍 Influence initialized at ${this.cities.length} cities`);
  }

  _propagateInfluence() {
    console.log(`🌊 Propagating influence...`);
    const propagationStart = performance.now();

    // Queue pour BFS: [pixelIndex, currentInfluence, countryId]
    const queue = [];
    const visited = new Uint8Array(this.width * this.height);

    // Initialiser la queue avec tous les pixels ayant déjà une influence
    // (set pendant _initializeInfluenceMap)
    for (let i = 0; i < this.width * this.height; i++) {
      const [influence, countryId] = this.influenceMap[i];
      if (influence > 0) {
        visited[i] = 1;
        queue.push([i, influence, countryId]);
      }
    }

    let processed = 0;

    while (queue.length > 0) {
      const [pixelIdx, influence, countryId] = queue.shift();
      processed++;

      // Vérifier les 4 voisins (ou 8 pour plus d'expansion)
      const x = pixelIdx % this.width;
      const y = Math.floor(pixelIdx / this.width);

      // 4 directions: haut, bas, gauche, droite
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

        const neighborIdx = ny * this.width + nx;
        if (visited[neighborIdx]) continue;

        const altitude = this.heightMap[neighborIdx];

        // Ne pas propager dans l'eau
        if (altitude <= SEA_LEVEL) {
          visited[neighborIdx] = 1; // Marquer comme visité mais ne pas propager
          continue;
        }

        visited[neighborIdx] = 1;

        // Calculer la perte d'influence
        const loss = this._calculateInfluenceLoss(altitude, countryId);
        const newInfluence = influence * (1 - loss);

        // Vérifier si cette nouvelle influence est meilleure
        const [currentInfluence] = this.influenceMap[neighborIdx];

        if (newInfluence > currentInfluence && newInfluence > 0) {
          this.influenceMap[neighborIdx] = [newInfluence, countryId];
          queue.push([neighborIdx, newInfluence, countryId]);
        }
      }
    }

    const propagationTime = performance.now() - propagationStart;
    console.log(`✓ Propagation complete: ${processed} pixels processed in ${propagationTime.toFixed(2)}ms`);
  }

  _calculateInfluenceLoss(altitude, countryId) {
    // Base perte: 3% (forte décroissance)
    let baseLoss = 0.03;

    // Malus altitude: plus c'est haut, plus on perd
    // (altitude - SEA_LEVEL) / (255 - SEA_LEVEL) = 0 à 1
    const altitudeRatio = Math.max(0, Math.min(1, (altitude - SEA_LEVEL) / (255 - SEA_LEVEL)));
    const altitudeMalus = altitudeRatio * 0.10; // 0 à 10% malus sur montagne

    // Aléatoire déterministe basé sur position et countryId
    const seed = (altitude * 73856093) ^ (countryId * 19349663);
    let x = seed >>> 0;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    const randomValue = ((x >>> 0) / 0x100000000 - 0.5) * 0.02; // -1% à +1%

    return Math.max(0, Math.min(0.95, baseLoss + altitudeMalus + randomValue)); // Max 95% loss
  }

  _assignPixelsToCountries() {
    // Assigner chaque pixel au pays avec l'influence la plus haute
    for (let i = 0; i < this.width * this.height; i++) {
      const [influence, countryId] = this.influenceMap[i];

      if (countryId >= 0 && influence > 0) {
        this.countries[countryId].addPixel(i);
      }
    }

    console.log(`📍 Pixels assigned to countries`);
  }

  _reassignCapturedCities() {
    // Pour chaque ville, vérifier si elle est capturée par un autre pays
    for (let cityId = 0; cityId < this.cities.length; cityId++) {
      const city = this.cities[cityId];
      const [x, y] = city.position;
      const idx = y * this.width + x;
      const [, ownerCountryId] = this.influenceMap[idx];

      // Si la ville est capturée par un autre pays
      if (ownerCountryId >= 0 && ownerCountryId !== cityId) {
        // Retirer de son pays d'origine
        const originalCountry = this.countries[cityId];
        originalCountry.removeCity(city);

        // Ajouter au pays conquérant
        const conquerorCountry = this.countries[ownerCountryId];
        conquerorCountry.addCity(city);

        console.log(`⚔️ City ${city.name} captured by ${conquerorCountry.name}`);
      }
    }

    console.log(`✓ Cities reassigned`);
  }
}
