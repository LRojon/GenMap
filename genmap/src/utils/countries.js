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
    console.log(`\n🏛️ Country Generation Started`);
    const countryStart = performance.now();

    // Étape 0: Calculer le nombre de pays et sélectionner les capitales
    const capitalCities = this._selectCapitalCities(seed);
    console.log(`🏛️ Selected ${capitalCities.length} capital cities for countries`);

    // Étape 1: Créer un pays pour chaque capitale
    this._initializeCountries(capitalCities, seed);

    // Étape 2: Initialiser l'influence map avec les villes
    this._initializeInfluenceMap();

    // Étape 3: Propager l'influence
    this._propagateInfluence(seed);

    // Étape 4: Assigner les pixels aux pays
    this._assignPixelsToCountries();

    // Étape 4.5: Gérer les îles
    this._handleIslands();

    // Étape 5: Réassigner les villes capturées
    this._reassignCapturedCities();

    // Étape 6: Placer les petits villages (3-5 par pays avec score < 100)
    this._placeSmallVillages(seed);

    const countryTime = performance.now() - countryStart;
    console.log(`%c✓ Countries generated in ${countryTime.toFixed(2)}ms`, 'color: #48bb78;');
    console.log(`📊 Total countries: ${this.countries.length}`);

    return this.countries;
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

    console.log(`📊 Area: ${area} | Base: ${baseCountries} | Variation: ${variation.toFixed(2)} | Final: ${numCountries}`);

    // Trier les villes par score décroissant
    const sortedCities = [...this.cities].sort((a, b) => b.score - a.score);

    // Prendre les X meilleures villes comme capitales
    const capitalCities = sortedCities.slice(0, Math.min(numCountries, sortedCities.length));

    console.log(`🏙️ Top capital scores: ${capitalCities.map(c => c.score).join(', ')}`);

    return capitalCities;
  }

  _initializeCountries(capitalCities, seed) {
    for (let i = 0; i < capitalCities.length; i++) {
      const city = capitalCities[i];
      const citySeed = getNextSeed(seed, i);
      const country = new Country(i, city, citySeed);
      this.countries.push(country);
    }
    console.log(`🏛️ Created ${this.countries.length} countries (1 per top capital)`);
  }

  _initializeInfluenceMap() {
    // Initialiser la carte d'influence: une influence par ville
    for (let countryId = 0; countryId < this.countries.length; countryId++) {
      const city = this.countries[countryId].capitalCity;
      const [x, y] = city.position;
      const idx = y * this.width + x;
      
      // Placer l'influence initiale à la ville
      // Utiliser un score plus élevé pour que tous les pays aient une chance de se développer
      // Score initial augmenté: min 150, max 250 pour donner plus de puissance de propagation
      const baseInfluence = Math.max(150, Math.min(250, city.score * 2));
      this.influenceMap[idx] = [baseInfluence, countryId];
    }

    console.log(`📍 Influence initialized at ${this.cities.length} cities`);
  }

  _propagateInfluence() {
    console.log(`🌊 Propagating influence...`);
    const propagationStart = performance.now();

    // Créer une map rapide des villes par position
    const cityMap = new Map();
    for (const city of this.cities) {
      const [x, y] = city.position;
      const idx = y * this.width + x;
      cityMap.set(idx, city);
    }

    // Utiliser une priorité queue simple avec tri une seule fois au départ
    const visited = new Uint8Array(this.width * this.height);
    const queue = [];

    // Initialiser la queue avec tous les pixels ayant une influence
    for (let i = 0; i < this.width * this.height; i++) {
      const [influence, countryId] = this.influenceMap[i];
      if (influence > 0) {
        queue.push([i, influence, countryId]);
      }
    }

    // Tri une seule fois au départ par influence décroissante
    queue.sort((a, b) => b[1] - a[1]);

    let processed = 0;
    let queueIndex = 0;

    // Boucle principale: tant qu'il y a des pixels à traiter
    while (queueIndex < queue.length) {
      // Prendre le pixel avec la plus haute influence
      const [pixelIdx, influence, countryId] = queue[queueIndex];
      queueIndex++;

      // Ignorer si déjà traité
      if (visited[pixelIdx]) continue;
      visited[pixelIdx] = 1;
      processed++;

      // Vérifier les 4 voisins
      const x = pixelIdx % this.width;
      const y = Math.floor(pixelIdx / this.width);

      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

        const neighborIdx = ny * this.width + nx;
        
        // Ignorer si déjà traité
        if (visited[neighborIdx]) continue;

        const altitude = this.heightMap[neighborIdx];

        // Calculer la perte d'influence (y compris pour l'eau)
        const loss = this._calculateInfluenceLoss(altitude, countryId);
        let newInfluence = influence * (1 - loss);

        // Vérifier si ce pixel contient une ville
        const cityAtPixel = cityMap.get(neighborIdx);
        if (cityAtPixel) {
          // Booster l'influence avec le score de la ville
          newInfluence = Math.max(newInfluence, cityAtPixel.score);
        }

        // Vérifier si cette nouvelle influence est meilleure que l'actuelle
        const [currentInfluence] = this.influenceMap[neighborIdx];

        // Très seuil minimal: on propage PARTOUT même avec une influence quasi nulle
        // L'important c'est que chaque pixel soit assigné à un pays via influenceMap
        if (newInfluence > currentInfluence) {
          this.influenceMap[neighborIdx] = [newInfluence, countryId];
          
          // Ajouter à la queue pour traitement futur - toujours
          queue.push([neighborIdx, newInfluence, countryId]);
        }
      }
    }

    const propagationTime = performance.now() - propagationStart;
    console.log(`✓ Propagation complete: ${processed} pixels processed in ${propagationTime.toFixed(2)}ms`);
  }

  _calculateInfluenceLoss(altitude, countryId) {
    // Malus TRÈS FORT pour l'eau (90% loss) pour qu'elle serve de pont temporaire
    if (altitude <= SEA_LEVEL) {
      return 0.90; // 90% loss dans l'eau = influence réduite de 90%
    }

    // Malus altitude: [0 - 0.2]% selon l'altitude terrestre [128 - 255]
    // (altitude - SEA_LEVEL) / (255 - SEA_LEVEL) = 0 à 1
    const altitudeRatio = Math.max(0, Math.min(1, (altitude - SEA_LEVEL) / (255 - SEA_LEVEL)));
    const altitudeLoss = altitudeRatio * 0.002; // [0 - 0.2]%

    // Perte aléatoire: [0 - 0.05]%
    const randomSeed = (altitude * 73856093) ^ (countryId * 19349663);
    let x = randomSeed >>> 0;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    const randomLoss = ((x >>> 0) / 0x100000000) * 0.0005; // [0 - 0.05]%

    return Math.max(0, altitudeLoss + randomLoss); // Total max: 0.25%
  }

  _assignPixelsToCountries() {
    // Assigner chaque pixel au pays avec l'influence la plus haute
    for (let i = 0; i < this.width * this.height; i++) {
      const [influence, countryId] = this.influenceMap[i];

      if (countryId >= 0 && influence > 0) {
        this.countries[countryId].addPixel(i);
      }
    }

    // Retirer TOUS les pixels d'eau des pays
    // La propagation a traversé l'eau pour créer des ponts entre îles, 
    // mais on ne veut pas que les pays possèdent l'eau
    for (let i = 0; i < this.width * this.height; i++) {
      const altitude = this.heightMap[i];
      const [, countryId] = this.influenceMap[i];
      
      if (altitude <= SEA_LEVEL && countryId >= 0) {
        // C'est de l'eau assignée à un pays: la retirer définitivement
        const country = this.countries[countryId];
        const pixelIndex = country.pixels.indexOf(i);
        if (pixelIndex > -1) {
          country.pixels.splice(pixelIndex, 1);
          country.area--;
        }
      }
    }

    console.log(`📍 Pixels assigned to countries (water removed)`);
  }

  _handleIslands() {
    console.log(`🏝️ Handling islands...`);
    // Avec la nouvelle logique, l'eau n'est plus un obstacle
    // Les îles se connectent naturellement via la propagation à travers l'eau (avec fort malus)
    // Les pixels d'eau sont retirés dans _assignPixelsToCountries()
    console.log(`✓ Islands handled via water propagation`);
  }

  _reassignCapturedCities() {
    // Pour chaque ville, vérifier si elle est capturée par un pays
    for (let cityIdx = 0; cityIdx < this.cities.length; cityIdx++) {
      const city = this.cities[cityIdx];
      const [x, y] = city.position;
      const idx = y * this.width + x;
      const [, ownerCountryId] = this.influenceMap[idx];

      // Vérifier si la ville a un pays d'origine valide
      // (elle peut ne pas être une capitale)
      if (ownerCountryId >= 0 && ownerCountryId < this.countries.length) {
        const ownerCountry = this.countries[ownerCountryId];
        
        // Ajouter la ville au pays qui la contrôle
        if (!ownerCountry.cities.includes(city)) {
          ownerCountry.addCity(city);
        }
      }
    }

    console.log(`✓ Cities reassigned to their controlling countries`);
  }

  _placeSmallVillages(seed) {
    let villagesPlaced = 0;
    
    // Créer une seed de base pour la génération des villages (différente de celle des villes)
    const villageBaseSeed = getNextSeed(seed, 999);

    // Pour chaque pays, placer 3-5 petits villages de manière déterministe
    for (let countryIdx = 0; countryIdx < this.countries.length; countryIdx++) {
      const country = this.countries[countryIdx];
      
      // Créer une seed unique et stable pour ce pays basée sur l'index
      const countrySeed = getNextSeed(villageBaseSeed, countryIdx);
      
      // Seed séparée pour le nombre de villages (ne pas affecter les positions)
      const numVillagesSeed = getNextSeed(countrySeed, 0);
      let numRngState = numVillagesSeed;
      const numRandom = () => {
        numRngState = (numRngState * 1103515245 + 12345) >>> 0;
        return (numRngState >>> 0) / 0x100000000;
      };
      
      const numVillagesToPlace = 3 + Math.floor(numRandom() * 3); // Entre 3 et 5
      
      // Créer UNE SEULE FOIS la liste triée des pixels du pays (sans eau!)
      // Utiliser country.pixels qui a déjà l'eau retirée
      const countryPixels = [...country.pixels];
      
      if (countryPixels.length === 0) continue;
      
      countryPixels.sort((a, b) => a - b);
      
      // ÉTAPE 1: Créer des candidats pour TOUS les villages, pré-générés avec RNG
      const villageSpecs = [];
      for (let v = 0; v < numVillagesToPlace; v++) {
        const villagePositionSeed = getNextSeed(numVillagesSeed, v + 1);
        let positionRngState = villagePositionSeed;
        
        const positionRandom = () => {
          positionRngState = (positionRngState * 1103515245 + 12345) >>> 0;
          return (positionRngState >>> 0) / 0x100000000;
        };
        
        // Générer 50 candidats de position
        const positionCandidates = [];
        for (let attempt = 0; attempt < 50; attempt++) {
          const pixelIndex = Math.floor(positionRandom() * countryPixels.length);
          positionCandidates.push(pixelIndex);
        }
        
        villageSpecs.push({
          villageIdx: v,
          countrySeed,
          positionCandidates,
          placed: false,
          position: null,
          score: 0
        });
      }
      
      // ÉTAPE 2: Placer les villages en itérant sur les candidats
      // Les candidats valides doivent être testés pour proximité
      
      for (let v = 0; v < villageSpecs.length; v++) {
        const spec = villageSpecs[v];
        let found = false;
        
        for (let attempt = 0; attempt < spec.positionCandidates.length && !found; attempt++) {
          const selectedPixelIdx = countryPixels[spec.positionCandidates[attempt]];
          
          const x = selectedPixelIdx % this.width;
          const y = Math.floor(selectedPixelIdx / this.width);

          // Vérifier que le pixel est valide (pas l'eau)
          if (this.heightMap[selectedPixelIdx] <= 0.4) continue; // SEA_LEVEL ~= 0.4

          // Calculer le score potentiel de cet emplacement
          const altitude = this.heightMap[selectedPixelIdx];
          const climate = this.climateMap[selectedPixelIdx];
          let pixelScore = this._calculateLocationScore(altitude, climate);
          
          // Vérifier que le score est < 100
          if (pixelScore >= 100) continue;

          // Vérifier qu'il n'y a pas déjà une ville trop proche
          let tooClose = false;
          for (const city of country.cities) {
            const dist = Math.hypot(city.position[0] - x, city.position[1] - y);
            if (dist < 30) { // Minimum 30 pixels de distance
              tooClose = true;
              break;
            }
          }

          if (!tooClose) {
            // Créer le petit village avec une seed déterministe unique
            const villageSeed = getNextSeed(countrySeed, v + 1000);
            
            // Utiliser une seed séparée pour la variation du score (déterministe)
            let scoreRngState = getNextSeed(countrySeed, v + 2000);
            scoreRngState = (scoreRngState * 1103515245 + 12345) >>> 0;
            const scoreVariation = ((scoreRngState >>> 0) / 0x100000000);
            const villageScore = pixelScore * (0.9 + scoreVariation * 0.2); // Score avec variation ±10%
            
            const village = new City(
              [x, y],
              villageSeed,
              Math.floor(altitude * 255),
              Math.floor(climate * 255),
              this.biomeMap[selectedPixelIdx]
            );
            village.score = villageScore;
            village.generateFullData();
            village.country = country.name;

            country.addCity(village);
            this.cities.push(village);
            villagesPlaced++;
            spec.placed = true;
            spec.position = [x, y];
            spec.score = villageScore;
            found = true;
          }
        }
      }
    }

    console.log(`✓ ${villagesPlaced} small villages placed (3-5 per country)`);
    
    // DEBUG: Log village positions for determinism testing
    const villageData = this.cities
      .filter(c => c.score < 100)
      .map(c => ({
        pos: `[${c.position[0]},${c.position[1]}]`,
        score: c.score.toFixed(1),
        name: c.name
      }));
    
    if (villageData.length > 0) {
      console.log(`🎯 Village Details:`);
      villageData.forEach((v, i) => {
        console.log(`  V${i + 1}: ${v.pos} Score=${v.score} Name="${v.name}"`);
      });
      
      const positionString = villageData.map(v => v.pos).join('|');
      console.log(`📍 VILLAGE_POSITIONS: ${positionString}`);
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
