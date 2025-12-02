import random
import time

# ========== Générateur procédural de noms ==========
class ProcNameGenerator:
    """Génère des noms procéduraux déterministes."""
    
    # Sillabaires régionaux
    SYLLABLES = {
        'consonants': ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z'],
        'vowels': ['a', 'e', 'i', 'o', 'u'],
        'clusters': ['br', 'ch', 'dr', 'fl', 'gr', 'sh', 'sk', 'sl', 'sp', 'st', 'th', 'tr', 'tw', 'wh'],
    }
    
    @staticmethod
    def generate_city_name(seed: int, regional_seed: int = 0) -> str:
        """Génère un nom de ville procédural."""
        rng = random.Random(seed ^ (regional_seed * 12345))
        
        # Longueur du nom: 2-4 syllabes
        num_syllables = rng.randint(2, 4)
        name = ""
        
        for i in range(num_syllables):
            # Alterner consonnes/voyelles avec quelques variations
            if rng.random() < 0.3 and i == 0:  # 30% de chance de cluster initial
                name += rng.choice(ProcNameGenerator.SYLLABLES['clusters'])
            elif rng.random() < 0.7:
                name += rng.choice(ProcNameGenerator.SYLLABLES['consonants'])
            
            name += rng.choice(ProcNameGenerator.SYLLABLES['vowels'])
            
            # Occasionnellement ajouter une consonne finale
            if rng.random() < 0.3:
                name += rng.choice(ProcNameGenerator.SYLLABLES['consonants'])
        
        return name.capitalize()
    
    @staticmethod
    def generate_country_name(seed: int) -> str:
        """Génère un nom de pays procédural."""
        rng = random.Random(seed)
        
        # Noms de pays plus longs: 2-3 syllabes + suffixe
        num_syllables = rng.randint(2, 3)
        name = ""
        
        for i in range(num_syllables):
            if rng.random() < 0.4 and i == 0:
                name += rng.choice(ProcNameGenerator.SYLLABLES['clusters'])
            else:
                name += rng.choice(ProcNameGenerator.SYLLABLES['consonants'])
            
            name += rng.choice(ProcNameGenerator.SYLLABLES['vowels'])
        
        # Ajouter un suffixe de pays
        suffixes = ['ia', 'land', 'shire', 'stan', 'ia', 'kingdom']
        name += rng.choice(suffixes)
        
        return name.capitalize()
    
    @staticmethod
    def generate_religion_name(seed: int) -> str:
        """Génère un nom de religion procédural avec structures thématiques."""
        rng = random.Random(seed)
        
        # Structures thématiques pour religions
        templates = [
            "Le Culte de {}", 
            "Les Enfants de {}",
            "L'Ordre de {}",
            "La Foi de {}",
            "Le Chemin de {}",
            "Les Gardiens de {}",
            "La Bénédiction de {}",
            "Le Temple de {}",
            "L'Alliance de {}",
            "La Voie de {}",
            "Les Disciples de {}",
            "La Communion de {}",
        ]
        
        # Thèmes religieux
        deities = [
            "l'Aube", "la Lune", "l'Étoile du Nord",
            "la Terre Mère", "l'Esprit Ancien", "le Grand Arbre",
            "la Flamme Éternelle", "l'Océan Primordial", "les Anciens",
            "la Lumière", "l'Ombre", "l'Équilibre",
            "la Mort et la Renaissance", "la Tempête", "les Montagnes",
            "la Forêt Sacrée", "le Ciel", "le Cristal",
            "l'Infini", "la Destinée", "l'Harmonie",
        ]
        
        template = rng.choice(templates)
        deity = rng.choice(deities)
        
        return template.format(deity)
    
    @staticmethod
    def generate_culture_name(seed: int) -> str:
        """Génère un nom de culture procédural avec 50% ancien système."""
        rng = random.Random(seed)
        
        # 50% chance d'utiliser l'ancien système
        if rng.random() < 0.5:
            # Ancien système: 1-2 syllabes + suffixe culturel
            num_syllables = rng.randint(1, 2)
            name = ""
            
            for i in range(num_syllables):
                if rng.random() < 0.4 and i == 0:
                    name += rng.choice(ProcNameGenerator.SYLLABLES['clusters'])
                else:
                    name += rng.choice(ProcNameGenerator.SYLLABLES['consonants'])
                name += rng.choice(ProcNameGenerator.SYLLABLES['vowels'])
            
            # Suffixes culturels
            suffixes = ['ian', 'folk', 'kin', 'ic', 'ers', 'ian']
            name += rng.choice(suffixes)
            
            return name.capitalize()
        
        # 50% chance: Nouveau système thématique
        # Structures thématiques pour cultures
        templates = [
            "La Tradition {}",
            "L'Héritage {}",
            "Les {} Folk",
            "La Dynastie {}",
            "Le Peuple {}",
            "L'École {}",
            "La Lignée {}",
            "Les Maîtres {}",
            "La Caste {}",
            "La Fraternité {}",
            "L'Ascendance {}",
            "Les Artisans {}",
        ]
        
        # Adjectifs/noms culturels
        traits = [
            "de la Forge", "du Vent", "de la Mer",
            "de la Montagne", "de la Rivière", "de la Forêt",
            "de la Pierre", "de l'Acier", "de l'Argent",
            "du Feu", "du Ciel", "de la Terre",
            "de la Sagesse", "de la Vaillance", "de l'Honneur",
            "des Moissons", "des Maisons", "des Ancêtres",
            "du Passé", "de l'Avenir", "de la Paix",
        ]
        
        template = rng.choice(templates)
        trait = rng.choice(traits)
        
        # Remplacer {} dans le template
        if "{}" in template:
            return template.format(trait)
        else:
            return template


class City:
    def __init__(self, position: tuple[int, int], seed: int = 0, altitude: int = 127, climate: int = 127) -> None:
        self.position = position
        self.seed = seed
        self.altitude = altitude  # Altitude du terrain
        self.climate = climate    # Valeur de climat (0-255)
        
        # Infos générées procéduralement
        self.name = ProcNameGenerator.generate_city_name(seed)
        self.population = 0  # À calculer
        self.city_type = "village"  # village, town, city, metropolis
        self.religion = None
        self.culture = None
        self.government = None
        self.founded_year = 0  # Année de fondation
        self.country = None
        self.score = 0
        self.is_capital = False
        
        # Ressources (basées sur terrain/climat)
        self.resources = {
            'agriculture': 0,
            'mining': 0,
            'forestry': 0,
            'fishing': 0,
            'trade': 0,  # Basé sur routes
        }
        
    def generate_full_data(self, map_height: int, map_width: int, year: int = 0):
        """Génère toutes les données de la ville."""
        rng = random.Random(self.seed)
        
        # Population basée sur le score
        base_pop = int(self.score * 50) + 500
        self.population = base_pop + rng.randint(-int(base_pop * 0.1), int(base_pop * 0.1))
        
        # Type de ville
        if self.population < 1000:
            self.city_type = "village"
        elif self.population < 5000:
            self.city_type = "town"
        elif self.population < 20000:
            self.city_type = "city"
        else:
            self.city_type = "metropolis"
        
        # Année de fondation (aléatoire dans le passé)
        self.founded_year = year - rng.randint(100, 1000)
        
        # Religion et Culture - générées procéduralement
        self.religion = ProcNameGenerator.generate_religion_name(self.seed ^ 12345)
        self.culture = ProcNameGenerator.generate_culture_name(self.seed ^ 54321)
        self.government = rng.choice(['Democratic', 'Aristocratic', 'Theocratic', 'Mercantile'])
        
        # Ressources basées sur altitude et climat
        self._generate_resources()
    
    def _generate_resources(self):
        """Génère les ressources en fonction du terrain."""
        rng = random.Random(self.seed)
        
        # Agriculture: bon pour climates modérés et altitudes basses/moyennes
        if 100 < self.altitude < 180 and 80 < self.climate < 170:
            self.resources['agriculture'] = 70 + rng.randint(-20, 20)
        elif 100 < self.altitude < 200:
            self.resources['agriculture'] = 40 + rng.randint(-20, 20)
        else:
            self.resources['agriculture'] = 20 + rng.randint(-10, 10)
        
        # Mining: bon pour altitudes hautes
        if self.altitude > 160:
            self.resources['mining'] = 60 + rng.randint(-20, 20)
        else:
            self.resources['mining'] = 20 + rng.randint(-15, 15)
        
        # Forestry: bon pour climat tempéré/froid
        if 60 < self.climate < 140:
            self.resources['forestry'] = 65 + rng.randint(-20, 20)
        else:
            self.resources['forestry'] = 25 + rng.randint(-15, 15)
        
        # Fishing: bon pour zones côtières (altitude basse)
        if self.altitude < 130:
            self.resources['fishing'] = 55 + rng.randint(-20, 20)
        else:
            self.resources['fishing'] = 10 + rng.randint(-5, 10)
        
        # Trade: sera calculé après generation des routes (pour maintenant: base faible)
        self.resources['trade'] = 20 + rng.randint(-10, 10)
        
        # Clamp values to 0-100
        for resource in self.resources:
            self.resources[resource] = max(0, min(100, self.resources[resource]))
    
    def calculate_trade_from_routes(self, routes: list, all_cities: list):
        """Calcule la ressource trade basée sur les routes connectant cette ville."""
        rng = random.Random(self.seed ^ 777)
        
        # Vérifier si cette ville est sur au moins une route
        trade_value = 20  # Base minimale
        routes_connected = 0
        
        for route in routes:
            if route is None or not hasattr(route, '__iter__'):
                continue
            
            # Convertir route en liste de points si nécessaire
            try:
                route_points = list(route)
            except:
                continue
            
            # Vérifier si un point de la route est proche de cette ville
            for point in route_points:
                if isinstance(point, (tuple, list)) and len(point) >= 2:
                    dist = ((point[0] - self.position[0])**2 + (point[1] - self.position[1])**2)**0.5
                    if dist < 15:  # Rayon de détection de route
                        routes_connected += 1
                        break
        
        # Augmenter le trade basé sur le nombre de routes connectées
        if routes_connected > 0:
            trade_value = min(100, 30 + routes_connected * 20)
        
        self.resources['trade'] = int(trade_value)
        
class Cities:

    def get_min_score(self):
        if not self.cities:
            return 0
        return min(city.score for city in self.cities)

    def get_max_score(self):
        if not self.cities:
            return 1
        return max(city.score for city in self.cities)

    def __init__(self) -> None:
        self.cities: list[City] = []
    
    def generateCity(self, position: tuple[int, int], score: int = 0, seed: int = 0, altitude: int = 127, climate: int = 127) -> None:
        """Crée et ajoute une ville."""
        random.seed(seed if seed != 0 else time.time_ns() % (2**32))
        city = City(position, seed, altitude, climate)
        city.score = score
        city.generate_full_data(400, 400)  # Génère toutes les données
        self.cities.append(city)
        