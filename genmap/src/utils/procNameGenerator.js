/**
 * Générateur procédural de noms déterministes
 * Basé sur les templates et syllabaires du projet Python
 */

import { SeededRandom } from './seededRandom';

const SYLLABLES = {
  consonants: ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z'],
  vowels: ['a', 'e', 'i', 'o', 'u'],
  clusters: ['br', 'ch', 'dr', 'fl', 'gr', 'sh', 'sk', 'sl', 'sp', 'st', 'th', 'tr', 'tw', 'wh'],
};

export class ProcNameGenerator {
  /**
   * Génère un nom de ville procédural
   * @param {number} seed - Seed pour la génération
   * @param {number} regionalSeed - Seed régional optionnel
   * @returns {string} Nom de la ville
   */
  static generateCityName(seed, regionalSeed = 0) {
    const rng = new SeededRandom(seed ^ (regionalSeed * 12345));
    const numSyllables = rng.randint(2, 5);
    let name = '';

    for (let i = 0; i < numSyllables; i++) {
      // 30% de chance d'utiliser un cluster initial
      if (rng.random() < 0.3 && i === 0) {
        name += rng.choice(SYLLABLES.clusters);
      } else if (rng.random() < 0.7) {
        name += rng.choice(SYLLABLES.consonants);
      }

      name += rng.choice(SYLLABLES.vowels);

      // 30% de chance d'ajouter une consonne finale
      if (rng.random() < 0.3) {
        name += rng.choice(SYLLABLES.consonants);
      }
    }

    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Génère un nom de pays procédural
   * @param {number} seed - Seed pour la génération
   * @returns {string} Nom du pays
   */
  static generateCountryName(seed) {
    const rng = new SeededRandom(seed);
    const numSyllables = rng.randint(2, 4);
    let name = '';

    for (let i = 0; i < numSyllables; i++) {
      if (rng.random() < 0.4 && i === 0) {
        name += rng.choice(SYLLABLES.clusters);
      } else {
        name += rng.choice(SYLLABLES.consonants);
      }

      name += rng.choice(SYLLABLES.vowels);
    }

    const suffixes = ['ia', 'land', 'shire', 'stan', 'kingdom', 'realm'];
    name += rng.choice(suffixes);

    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Génère un nom de religion procédural
   * @param {number} seed - Seed pour la génération
   * @returns {string} Nom de la religion
   */
  static generateReligionName(seed) {
    const rng = new SeededRandom(seed);

    const templates = [
      'Le Culte de {}',
      'Les Enfants de {}',
      "L'Ordre de {}",
      'La Foi de {}',
      'Le Chemin de {}',
      'Les Gardiens de {}',
      'La Bénédiction de {}',
      'Le Temple de {}',
      "L'Alliance de {}",
      'La Voie de {}',
      'Les Disciples de {}',
      'La Communion de {}',
    ];

    const deities = [
      "l'Aube",
      'la Lune',
      "l'Étoile du Nord",
      'la Terre Mère',
      "l'Esprit Ancien",
      'le Grand Arbre',
      'la Flamme Éternelle',
      "l'Océan Primordial",
      'les Anciens',
      'la Lumière',
      "l'Ombre",
      "l'Équilibre",
      'la Mort et la Renaissance',
      'la Tempête',
      'les Montagnes',
      'la Forêt Sacrée',
      'le Ciel',
      'le Cristal',
      "l'Infini",
      'la Destinée',
      "l'Harmonie",
    ];

    const template = rng.choice(templates);
    const deity = rng.choice(deities);

    return template.replace('{}', deity);
  }

  /**
   * Génère un nom de culture procédural
   * @param {number} seed - Seed pour la génération
   * @returns {string} Nom de la culture
   */
  static generateCultureName(seed) {
    const rng = new SeededRandom(seed);

    const templates = [
      'Tradition des {}',
      'Peuple des {}',
      'Fils de {}',
      'Héritiers de {}',
      'Gardiens de {}',
      'Enfants de {}',
      'Disciples de {}',
      'Voie de {}',
      'Sang de {}',
      'Alliance des {}',
    ];

    const themes = [
      'Montagnes',
      'Forêts',
      'Mers',
      'Steppe',
      'Aube',
      'Crépuscule',
      'Tempête',
      'Lumière',
      'Ombre',
      'Anciens',
      'Dragons',
      'Aigles',
      'Loups',
      'Corbeaux',
      'Ours',
      'Cerf',
      'Pierre',
      'Feu',
      'Eau',
      'Vent',
    ];

    const template = rng.choice(templates);
    const theme = rng.choice(themes);

    return template.replace('{}', theme);
  }
}
