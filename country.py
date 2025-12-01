import random
import time
import numpy as np


class ProcNameGenerator:
    """Génère des noms procéduraux déterministes."""
    
    SYLLABLES = {
        'consonants': ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z'],
        'vowels': ['a', 'e', 'i', 'o', 'u'],
        'clusters': ['br', 'ch', 'dr', 'fl', 'gr', 'sh', 'sk', 'sl', 'sp', 'st', 'th', 'tr', 'tw', 'wh'],
    }
    
    @staticmethod
    def generate_country_name(seed: int) -> str:
        """Génère un nom de pays procédural."""
        rng = random.Random(seed)
        
        # Noms de pays: 2-3 syllabes + suffixe
        num_syllables = rng.randint(2, 3)
        name = ""
        
        for i in range(num_syllables):
            if rng.random() < 0.4 and i == 0:
                name += rng.choice(ProcNameGenerator.SYLLABLES['clusters'])
            else:
                name += rng.choice(ProcNameGenerator.SYLLABLES['consonants'])
            
            name += rng.choice(ProcNameGenerator.SYLLABLES['vowels'])
        
        # Ajouter un suffixe de pays
        suffixes = ['ia', 'land', 'shire', 'stan', 'kingdom', 'realm']
        name += rng.choice(suffixes)
        
        return name.capitalize()


class Country:
    """Représente un pays avec ses propriétés."""
    
    def __init__(self, country_id: int, seed: int = 0) -> None:
        self.id = country_id
        # S'assurer que seed est un int
        if seed == 0:
            self.seed = int(time.time_ns() % (2**32))
        else:
            self.seed = int(seed)
        
        self.name = ProcNameGenerator.generate_country_name(self.seed)
        self.cities = []  # List of City objects
        self.capital = None  # City object (capitale)
        self.color = self._generate_color()
        self.area = 0  # Nombre de régions Voronoi
        self.regions = []  # List of region ids
        
        # Infos complètes du pays
        self.population = 0  # Calculé à partir des villes
        self.government = None  # Déterminé procéduralement
        self.religion = None  # Religion dominante
        self.culture = None  # Culture dominante
        self.year_founded = 0  # Année de fondation
        self.relations = {}  # country_id -> relation_type ('ally', 'enemy', 'neutral')
        
        # Ressources agrégées
        self.resources = {
            'agriculture': 0,
            'mining': 0,
            'forestry': 0,
            'fishing': 0,
            'trade': 0,
        }
        
    def _generate_color(self):
        """Génère une couleur aléatoire unique pour le pays."""
        local_random = random.Random(int(self.seed))
        
        # Générer des couleurs saturées et distinctes
        r = local_random.randint(50, 230)
        g = local_random.randint(50, 230)
        b = local_random.randint(50, 230)
        
        # Éviter les couleurs trop proches du blanc ou noir
        brightness = (r + g + b) / 3
        if brightness > 200:
            r, g, b = int(r // 1.5), int(g // 1.5), int(b // 1.5)
        elif brightness < 50:
            r, g, b = int(r * 1.5), int(g * 1.5), int(b * 1.5)
        
        return (int(r), int(g), int(b))
    
    def add_city(self, city):
        """Ajoute une ville au pays."""
        if city not in self.cities:
            self.cities.append(city)
            city.country = self.id
    
    def set_capital(self, city):
        """Définit la capitale du pays."""
        self.capital = city
        city.is_capital = True
    
    def add_region(self, region_id):
        """Ajoute une région Voronoi au pays."""
        if region_id not in self.regions:
            self.regions.append(region_id)
            self.area = len(self.regions)
    
    def generate_full_data(self):
        """Génère toutes les données du pays à partir de ses villes."""
        if not self.cities:
            return
        
        rng = random.Random(self.seed)
        
        # Population totale
        self.population = sum(city.population for city in self.cities)
        
        # Gouvernement
        self.government = rng.choice(['Monarchy', 'Democracy', 'Theocracy', 'Oligarchy', 'Federation', 'Aristocracy'])
        
        # Religion dominante (vote des villes)
        if self.cities:
            religions = [city.religion for city in self.cities]
            from collections import Counter
            religion_counts = Counter(religions)
            self.religion = religion_counts.most_common(1)[0][0]
        else:
            self.religion = "Neutral"
        
        # Culture dominante
        if self.cities:
            cultures = [city.culture for city in self.cities]
            from collections import Counter
            culture_counts = Counter(cultures)
            self.culture = culture_counts.most_common(1)[0][0]
        else:
            self.culture = "Mixed"
        
        # Année de fondation (la plus ancienne ville)
        self.year_founded = min(city.founded_year for city in self.cities)
        
        # Ressources agrégées (moyenne des villes)
        if self.cities:
            for resource in self.resources:
                total = sum(city.resources.get(resource, 0) for city in self.cities)
                self.resources[resource] = total // len(self.cities)
    
    def set_relations(self, other_country_id: int, relation_type: str):
        """Définit les relations avec un autre pays."""
        # relation_type: 'ally', 'enemy', 'neutral', 'trade'
        self.relations[other_country_id] = relation_type



class Countries:
    """Gère tous les pays du monde."""
    
    def __init__(self):
        self.countries = {}  # id -> Country object
        self.show_overlay = False  # Toggle pour affichage overlay
    
    def create_country(self, country_id: int, seed: int = 0) -> Country:
        """Crée un nouveau pays."""
        if country_id not in self.countries:
            self.countries[country_id] = Country(country_id, seed)
        return self.countries[country_id]
    
    def get_country(self, country_id: int):
        """Récupère un pays par son ID."""
        return self.countries.get(country_id)
    
    def get_countries(self) -> dict:
        """Retourne tous les pays."""
        return self.countries
    
    def get_num_countries(self) -> int:
        """Retourne le nombre de pays."""
        return len(self.countries)
    
    def toggle_overlay(self):
        """Active/désactive l'affichage de l'overlay."""
        self.show_overlay = not self.show_overlay
        return self.show_overlay
