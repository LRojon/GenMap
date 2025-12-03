"""Système complet de propagation religieuse et culturelle avec historique."""

import random
import numpy as np
from collections import deque
from typing import Dict, List, Tuple, Set


class ReligionEvent:
    """Représente un événement religieux (fondation, schisme, etc.)."""
    
    def __init__(self, year: int, event_type: str, description: str, location: Tuple[int, int]):
        self.year = year
        self.event_type = event_type  # 'foundation', 'schism', 'conflict', 'syncretism'
        self.description = description
        self.location = location


class Religion:
    """Représente une religion avec histoire et propagation."""
    
    def __init__(self, religion_id: int, name: str, founding_city: Tuple[int, int], 
                 founding_year: int, seed: int, deity_theme: str = ""):
        self.id = religion_id
        self.name = name
        self.founding_city = founding_city
        self.founding_year = founding_year
        self.seed = seed
        self.deity_theme = deity_theme
        self.events: List[ReligionEvent] = []
        self.followers: Dict[Tuple[int, int], int] = {}  # city_pos -> follower_count
        self.schisms: List['Religion'] = []  # Sous-branches
        self.parent_religion = None  # Pour les schismes
        self.conflict_religions: Set[int] = set()  # Religions incompatibles
        self.color = self._generate_color()
    
    def _generate_color(self) -> Tuple[int, int, int]:
        """Génère une couleur unique basée sur le seed."""
        rng = random.Random(self.seed ^ 999)
        return (rng.randint(50, 200), rng.randint(50, 200), rng.randint(50, 200))
    
    def add_event(self, event: ReligionEvent):
        """Enregistre un événement historique."""
        self.events.append(event)
    
    def create_schism(self, schism_name: str, year: int, location: Tuple[int, int], 
                      seed: int) -> 'Religion':
        """Crée une sous-branche religieuse (schisme)."""
        schism = Religion(len(self.schisms), schism_name, location, year, seed, self.deity_theme)
        schism.parent_religion = self
        self.schisms.append(schism)
        return schism


class Culture:
    """Représente une culture avec traits et hérédité."""
    
    def __init__(self, culture_id: int, name: str, seed: int, 
                 origin_region_id: int, climate_type: str = ""):
        self.id = culture_id
        self.name = name
        self.seed = seed
        self.origin_region_id = origin_region_id
        self.climate_type = climate_type  # desert, forest, mountain, etc.
        self.traits: Dict[str, str] = {}  # values, architecture, symbols, etc.
        self.influenced_by: List[int] = []  # culture_ids des influences
        self.color = self._generate_color()
    
    def _generate_color(self) -> Tuple[int, int, int]:
        """Génère une couleur unique basée sur le seed."""
        rng = random.Random(self.seed ^ 777)
        return (rng.randint(50, 200), rng.randint(50, 200), rng.randint(50, 200))
    
    def add_influence(self, other_culture_id: int):
        """Ajoute une influence culturelle."""
        if other_culture_id not in self.influenced_by:
            self.influenced_by.append(other_culture_id)


class ReligionSystem:
    """Système complet de propagation religieuse."""
    
    def __init__(self, seed: int, map_obj):
        self.seed = seed
        self.map_obj = map_obj
        self.religions: Dict[int, Religion] = {}
        self.cultures: Dict[int, Culture] = {}
        self.foundational_religions: Dict[int, Religion] = {}  # Religions fondamentales (capitales/villes majeures)
        self.major_cultures: Dict[int, Culture] = {}  # Cultures majeures (par pays/région majeure)
        self.religion_map = None  # Carte spatiale des religions (region_id -> religion_id)
        self.culture_map = None   # Carte spatiale des cultures (region_id -> culture_id)
        # Note: random.seed() est déjà appelé dans map.py avant ReligionSystem
    
    def generate_foundational_religions(self):
        """Crée les religions initiales dans les villes majeures."""
        # Sélectionner villes majeures comme foyers religieux (villes capitales + grandes villes)
        major_cities = []
        for country_id, country in self.map_obj.countries.countries.items():
            if country.capital:
                major_cities.append((country.capital, country_id, True))  # (city, country_id, is_capital)
        
        # Trier par population et garder les 5-8 plus grandes
        major_cities.sort(key=lambda x: x[0].population if hasattr(x[0], 'population') else 0, reverse=True)
        major_cities = major_cities[:min(8, len(major_cities))]
        
        religion_id = 0
        
        # Générer une religion par ville majeure
        for city, country_id, is_capital in major_cities:
            # Générer un seed unique depuis le RNG global (cohérence avec le reste du programme)
            religion_seed = random.randint(0, 2**31 - 1)
            
            # Générer nom religieux
            from city import ProcNameGenerator
            religion_name = ProcNameGenerator.generate_religion_name(religion_seed)
            
            # Créer la religion
            religion = Religion(
                religion_id=religion_id,
                name=religion_name,
                founding_city=city.position,
                founding_year=city.founded_year,
                seed=religion_seed,
                deity_theme=self._get_deity_theme_from_biome(city)
            )
            
            # Enregistrer événement fondateur
            founding_event = ReligionEvent(
                year=city.founded_year,
                event_type='foundation',
                description=f"Fondation de {religion_name} à {city.name}",
                location=city.position
            )
            religion.add_event(founding_event)
            
            self.religions[religion_id] = religion
            religion_id += 1
        
        # Stocker aussi les religions fondamentales pour affichage UI
        self.foundational_religions = self.religions.copy()
    
    def propagate_religions(self):
        """Propage les religions depuis leurs villes d'origine."""
        
        if not hasattr(self.map_obj, 'cities') or not self.map_obj.cities:
            return
        
        # Mapping: ville -> liste d'objets religieux présents
        city_religions: Dict[Tuple[int, int], List[Religion]] = {}
        
        # Initialiser: assigner chaque religion à sa ville de fondation
        for religion in self.religions.values():
            founding_pos = religion.founding_city
            city_religions[founding_pos] = [religion]
            religion.followers[founding_pos] = 100  # 100% au départ
        
        # BFS de propagation: chaque religion se propage via les routes
        for religion in self.religions.values():
            self._propagate_single_religion(religion, city_religions)
        
        # Assigner religions aux villes
        self._assign_religions_to_cities(city_religions)
    
    def _propagate_single_religion(self, religion: Religion, city_religions: Dict):
        """Propage UNE religion via BFS depuis sa ville d'origine."""
        
        # Créer queue BFS
        queue = deque([religion.founding_city])
        visited = {religion.founding_city}
        propagation_strength = 100  # Force initiale
        
        while queue and propagation_strength > 10:
            current_pos = queue.popleft()
            current_city = self._find_city_by_position(current_pos)
            
            if not current_city:
                continue
            
            # BONUS: Villes avec gouvernement religieux propagent mieux
            propagation_multiplier = 1.0
            if hasattr(current_city, 'government') and 'religious' in current_city.government.lower():
                propagation_multiplier = 1.5  # +50% de portée
            
            # Trouver les villes voisines (via routes)
            neighbors = self._find_city_neighbors(current_city)
            
            for neighbor_city in neighbors:
                if neighbor_city.position not in visited:
                    visited.add(neighbor_city.position)
                    
                    # Calculer force de propagation avec distance
                    distance = self._calculate_distance(current_pos, neighbor_city.position)
                    strength = propagation_strength * propagation_multiplier * (1.0 / (1.0 + distance * 0.1))
                    
                    # Ajouter à la queue si force > 10
                    if strength > 10:
                        queue.append(neighbor_city.position)
                        
                        # Enregistrer les followers
                        if neighbor_city.position not in religion.followers:
                            religion.followers[neighbor_city.position] = 0
                        religion.followers[neighbor_city.position] += int(strength)
                    
                    propagation_strength *= 0.9  # Décroissance avec distance
    
    def _get_deity_theme_from_biome(self, city) -> str:
        """Retourne un thème de déité basé sur le biome (altitude + climat)."""
        if not hasattr(city, 'altitude') or not hasattr(city, 'climate'):
            return "Terre"
        
        # Déterminer le biome basé sur altitude + climat
        altitude = city.altitude
        climate = city.climate
        
        # Même logique que genBiomes() pour classifier
        if altitude <= 127:  # SEA_LEVEL
            biome_type = 'water'
        elif altitude <= 135:
            biome_type = 'beach'
        elif 135 <= altitude <= 180 and climate >= 170:
            biome_type = 'jungle'
        elif 120 <= altitude <= 140 and climate >= 120 and climate <= 170:
            biome_type = 'swamp'
        elif 135 <= altitude <= 160:
            if climate >= 200:
                biome_type = 'desert'
            elif climate >= 160:
                biome_type = 'forest'
            elif climate >= 80:
                if climate >= 120:
                    biome_type = 'forest'
                else:
                    biome_type = 'plain'
            else:
                biome_type = 'plain'
        elif 160 <= altitude <= 180:
            if climate >= 200:
                biome_type = 'desert'
            else:
                biome_type = 'hills'
        elif 180 <= altitude <= 200:
            biome_type = 'mountain'
        else:
            biome_type = 'mountain'
        
        # Mapper biome_type à thème religieux
        biome_themes = {
            'water': 'Océan Primordial',
            'beach': 'Côte',
            'plain': 'Prairie',
            'forest': 'Forêt Sacrée',
            'desert': 'Désert',
            'mountain': 'Montagne',
            'jungle': 'Jungle',
            'swamp': 'Marécage',
            'hills': 'Collines',
        }
        
        return biome_themes.get(biome_type, "Terre")
    
    def _find_city_by_position(self, position: Tuple[int, int]):
        """Trouve une ville à une position donnée."""
        for city in self.map_obj.cities.cities:
            if city.position == position:
                return city
        return None
    
    def _find_city_neighbors(self, city) -> List:
        """Trouve les villes voisines d'une ville (proches et connectées par routes)."""
        neighbors = []
        max_distance = 40  # Distance maximale pour connexion
        
        for other_city in self.map_obj.cities.cities:
            if other_city.position != city.position:
                dist = self._calculate_distance(city.position, other_city.position)
                if dist < max_distance:
                    neighbors.append(other_city)
        
        # Trier par distance
        neighbors.sort(key=lambda c: self._calculate_distance(city.position, c.position))
        
        return neighbors[:5]  # Max 5 voisins
    
    def _calculate_distance(self, pos1: Tuple[int, int], pos2: Tuple[int, int]) -> float:
        """Calcule distance euclidienne."""
        return ((pos1[0] - pos2[0])**2 + (pos1[1] - pos2[1])**2)**0.5
    
    def _assign_religions_to_cities(self, city_religions: Dict):
        """Assigne une religion dominante à chaque ville."""
        for city in self.map_obj.cities.cities:
            # Trouver la religion la plus influente dans cette ville
            if city.position in city_religions:
                # Calculer influence totale
                total_influence = sum(r.followers.get(city.position, 0) 
                                    for r in city_religions[city.position])
                
                if total_influence > 0:
                    # Tirage aléatoire pondéré
                    rng = random.Random(self.seed ^ hash(city.position))
                    choice = rng.random() * total_influence
                    
                    cumulative = 0
                    for religion in city_religions[city.position]:
                        cumulative += religion.followers.get(city.position, 0)
                        if choice <= cumulative:
                            city.religion = religion.name
                            break
    
    def generate_culture_from_regions(self):
        """Placeholder - la génération de cultures se fait maintenant dans propagate_cultures()."""
        # Désormais intégré à propagate_cultures()
    
    def propagate_cultures(self):
        """Propage les cultures via influence régionale par BFS.
        
        Crée 3-8 cultures majeures (berceaux) selon la taille du monde.
        L'influence initiale est aléatoire entre 50 et 100.
        L'influence se propage aux régions voisines en déclinant de 15% par région.
        Quand deux cultures se rencontrent, la plus influente l'emporte.
        """
        
        if not hasattr(self.map_obj, 'regions') or not hasattr(self.map_obj, 'region_to_country'):
            return
        
        from city import ProcNameGenerator
        
        # ÉTAPE 0: Calculer le nombre de berceaux selon la taille du monde
        num_terrestrial_regions = 0
        terrestrial_regions = []
        
        for region_id, region in enumerate(self.map_obj.regions):
            if not hasattr(region, 'vertices') or not region.vertices:
                continue
            
            # Calculer altitude moyenne de la région
            altitudes = []
            for vertex in region.vertices:
                x, y = int(vertex[0]), int(vertex[1])
                if 0 <= x < self.map_obj.width and 0 <= y < self.map_obj.height:
                    alt = int(self.map_obj.map[y, x])  # Convertir en int pour éviter overflow
                    altitudes.append(alt)
            
            if altitudes:
                avg_altitude = sum(altitudes) / len(altitudes)
                if avg_altitude > 127:  # Terre ferme
                    num_terrestrial_regions += 1
                    terrestrial_regions.append(region_id)
        
        # Déterminer nombre de berceaux: 3-8 selon surface terrestre
        # Formule: 3 + (num_regions - 50) / 50, clampé entre 3 et 8
        num_seeds = max(3, min(8, 3 + (num_terrestrial_regions - 50) // 50))
        
        # ÉTAPE 1: Sélectionner aléatoirement les régions berceaux
        culture_seeds = {}  # region_id -> (culture_id, influence, culture_obj)
        region_to_culture_influence = {}  # region_id -> {culture_id: influence}
        culture_id = 0
        used_culture_names = set()
        
        # Sélectionner aléatoirement num_seeds régions terrestres comme berceaux
        if len(terrestrial_regions) >= num_seeds:
            selected_seed_regions = random.sample(terrestrial_regions, num_seeds)
        else:
            selected_seed_regions = terrestrial_regions
        
        for seed_region_id in selected_seed_regions:
            # Générer une culture pour ce berceau
            culture_seed = random.randint(0, 2**31 - 1)
            culture_name = ProcNameGenerator.generate_culture_name(culture_seed)
            
            # Éviter les doublons
            counter = 0
            while culture_name in used_culture_names and counter < 50:
                counter += 1
                culture_seed = random.randint(0, 2**31 - 1)
                culture_name = ProcNameGenerator.generate_culture_name(culture_seed)
            
            used_culture_names.add(culture_name)
            
            # Créer la culture
            climate_type = self._get_biome_variant_for_region(seed_region_id)
            culture = Culture(
                culture_id=culture_id,
                name=culture_name,
                seed=culture_seed,
                origin_region_id=seed_region_id,
                climate_type=climate_type if climate_type else 'terre'
            )
            
            # Ajouter traits
            climate_str = climate_type if climate_type else 'plains'
            culture.traits['values'] = self._generate_cultural_values(climate_str)
            culture.traits['architecture'] = self._generate_architecture(climate_str)
            culture.traits['symbols'] = self._generate_symbols(climate_str)
            
            self.cultures[culture_id] = culture
            self.major_cultures[culture_id] = culture
            
            # Influence initiale aléatoire entre 50 et 100
            initial_influence = random.randint(50, 100)
            
            culture_seeds[seed_region_id] = (culture_id, initial_influence, culture)
            region_to_culture_influence[seed_region_id] = {culture_id: initial_influence}
            
            culture_id += 1
        
        # ÉTAPE 2: Propagation BFS de l'influence depuis chaque berceau
        
        for origin_region_id, (origin_culture_id, initial_influence, origin_culture) in culture_seeds.items():
            # BFS depuis ce berceau
            queue = deque([
                (origin_region_id, initial_influence)  # (region_id, current_influence)
            ])
            visited = {origin_region_id}
            
            while queue:
                current_region_id, current_influence = queue.popleft()
                
                # Si influence <= 0, arrêter propagation
                if current_influence <= 0:
                    continue
                
                # Trouver voisins de cette région
                neighbors = self._find_voronoi_neighbors(current_region_id)
                
                # Décroissance: influence * 0.85 pour chaque région voisine
                next_influence = current_influence * 0.85
                
                for neighbor_id in neighbors:
                    if neighbor_id not in visited:
                        visited.add(neighbor_id)
                        
                        # Initialiser la région si pas encore assignée
                        if neighbor_id not in region_to_culture_influence:
                            region_to_culture_influence[neighbor_id] = {}
                        
                        # Ajouter/mettre à jour influence de cette culture
                        current_influences = region_to_culture_influence[neighbor_id]
                        if origin_culture_id not in current_influences or next_influence > current_influences[origin_culture_id]:
                            current_influences[origin_culture_id] = next_influence
                        
                        # Continuer propagation si influence encore significative
                        if next_influence > 1:  # Seuil minimum
                            queue.append((neighbor_id, next_influence))
        
        # ÉTAPE 3: Résoudre conflits - pour chaque région, la culture avec la plus grande influence l'emporte
        
        region_to_culture = {}  # region_id -> culture_id
        
        for region_id, culture_influences in region_to_culture_influence.items():
            if culture_influences:
                # Trouver la culture avec la plus grande influence
                winning_culture_id = max(culture_influences.items(), key=lambda x: x[1])[0]
                region_to_culture[region_id] = winning_culture_id
        
        # Assigner les régions sans culture à une culture voisine (fallback)
        for region_id in range(len(self.map_obj.regions)):
            if region_id not in region_to_culture:
                # Trouver la culture du voisin avec la plus grande influence
                neighbors = self._find_voronoi_neighbors(region_id)
                neighbor_cultures = [
                    (region_to_culture.get(n), region_to_culture_influence.get(n, {}).get(region_to_culture.get(n), 0))
                    for n in neighbors
                    if n in region_to_culture
                ]
                
                if neighbor_cultures:
                    # Prendre le voisin avec la meilleure influence
                    winning_neighbor_culture_id = max(neighbor_cultures, key=lambda x: x[1])[0]
                    if winning_neighbor_culture_id is not None:
                        region_to_culture[region_id] = winning_neighbor_culture_id
        
        # Stocker le mapping
        self.region_to_culture = region_to_culture
    
    def _get_biome_variant_for_region(self, region_id: int):
        """Détermine la variante biome d'une région (côtier, montagne, etc.)."""
        if not hasattr(self.map_obj, 'regions') or region_id >= len(self.map_obj.regions):
            return None
        
        region = self.map_obj.regions[region_id]
        
        if not hasattr(region, 'vertices') or not region.vertices:
            return None
        
        # Calculer centroid et analyser altitude
        altitudes = []
        sea_count = 0
        mountain_count = 0
        
        for vertex in region.vertices:
            x, y = int(vertex[0]), int(vertex[1])
            if 0 <= x < self.map_obj.width and 0 <= y < self.map_obj.height:
                alt = int(self.map_obj.map[y, x])  # Convertir en int pour éviter overflow
                altitudes.append(alt)
                
                if alt <= 127:  # Eau
                    sea_count += 1
                elif alt > 180:  # Montagne
                    mountain_count += 1
        
        if not altitudes:
            return None
        
        avg_altitude = sum(altitudes) / len(altitudes)
        
        # Déterminer le biome
        if sea_count > len(altitudes) * 0.3:  # Plus de 30% d'eau
            return 'coastal'
        elif mountain_count > len(altitudes) * 0.3:  # Plus de 30% montagne
            return 'mountain'
        elif avg_altitude < 140:  # Altitude basse
            return 'forest'
        elif avg_altitude > 170:  # Altitude haute
            return 'desert'
        else:
            return 'plains'
    
    def _apply_cultural_diffusion_at_borders(self, region_to_culture: Dict[int, int]):
        """Applique métissage culturel léger aux frontières entre pays."""
        # Créer zone tampon: régions frontières reçoivent légère influence du voisin
        
        if not hasattr(self.map_obj, 'regions'):
            return
        
        diffusion_map = region_to_culture.copy()
        
        for region_id in region_to_culture.keys():
            # Trouver les voisins
            neighbors = self._find_voronoi_neighbors(region_id)
            
            # Vérifier si à la frontière (voisin d'un pays différent)
            is_border = False
            if hasattr(self.map_obj, 'region_to_country'):
                current_country = self.map_obj.region_to_country.get(region_id, -1)
                for neighbor_id in neighbors:
                    neighbor_country = self.map_obj.region_to_country.get(neighbor_id, -1)
                    if neighbor_country != current_country and neighbor_country != -1:
                        is_border = True
                        break
            
            # Si région frontière, 20% de chance de recevoir influence du voisin
            if is_border and random.random() < 0.2:
                neighbor_cultures = [
                    region_to_culture.get(n, region_to_culture[region_id])
                    for n in neighbors
                    if n in region_to_culture
                ]
                
                if neighbor_cultures:
                    # Créer une culture mixte (variante)
                    base_culture_id = region_to_culture[region_id]
                    neighbor_culture_id = random.choice(neighbor_cultures)
                    
                    if base_culture_id != neighbor_culture_id:
                        # 20% d'influence du voisin
                        base_culture = self.cultures.get(base_culture_id)
                        if base_culture:
                            variant_name = f"{base_culture.name} (Métisse)"
                            variant_seed = random.randint(0, 2**31 - 1)
                            
                            mixed_culture = Culture(
                                culture_id=len(self.cultures) + random.randint(10000, 99999),
                                name=variant_name,
                                seed=variant_seed,
                                origin_region_id=region_id
                            )
                            
                            mixed_culture.add_influence(base_culture_id)
                            mixed_culture.add_influence(neighbor_culture_id)
                            self.cultures[mixed_culture.id] = mixed_culture
                            
                            diffusion_map[region_id] = mixed_culture.id
        
        # Appliquer les changements
        region_to_culture.update(diffusion_map)
    
    def _find_voronoi_neighbors(self, region_id: int) -> List[int]:
        """Trouve les régions Voronoi voisines d'une région donnée."""
        if not hasattr(self.map_obj, 'regions') or region_id >= len(self.map_obj.regions):
            return []
        
        region = self.map_obj.regions[region_id]
        if not hasattr(region, 'vertices') or not region.vertices:
            return []
        
        neighbors = set()
        region_vertices = set(region.vertices)
        
        # Trouver toutes les régions qui partagent des vertices avec cette région
        for other_id, other_region in enumerate(self.map_obj.regions):
            if other_id != region_id and hasattr(other_region, 'vertices') and other_region.vertices:
                other_vertices = set(other_region.vertices)
                # Si elles partagent au moins un vertex, elles sont voisines
                if region_vertices & other_vertices:
                    neighbors.add(other_id)
        
        return list(neighbors)
    
    def _get_region_climate(self, region) -> str:
        """Détermine le type de climat d'une région."""
        # Basé sur le centre du polygone
        return "temperate"  # TODO: implémenter selon la géographie
    
    def _generate_cultural_values(self, climate_type: str) -> str:
        """Génère les valeurs culturelles selon le climat."""
        values_map = {
            'desert': 'Survie, Honneur, Tradition',
            'mountain': 'Force, Spiritualité, Indépendance',
            'forest': 'Harmonie, Mystère, Liberté',
            'plains': 'Commerce, Hospitalité, Communauté',
            'coast': 'Aventure, Échange, Audace',
        }
        return values_map.get(climate_type, 'Équilibre, Sagesse')
    
    def _generate_architecture(self, climate_type: str) -> str:
        """Génère le style architectural selon le climat."""
        architecture_map = {
            'desert': 'Adobe et pierre, tours defensives',
            'mountain': 'Pierre massive, fortifications',
            'forest': 'Bois travaillé, intégration nature',
            'plains': 'Briques, structures ouvertes',
            'coast': 'Bois et corail, ports',
        }
        return architecture_map.get(climate_type, 'Architecture mixte')
    
    def _generate_symbols(self, climate_type: str) -> str:
        """Génère les symboles culturels selon le climat."""
        symbols_map = {
            'desert': '☀️ Soleil, 🐪 Chameau, 🌵 Dune',
            'mountain': '⛰️ Montagne, 🦅 Aigle, ❄️ Cristal',
            'forest': '🌲 Arbre, 🦌 Cerf, 🌿 Feuille',
            'plains': '🌾 Blé, 🐴 Cheval, 🌅 Horizon',
            'coast': '🌊 Vague, 🐚 Coquille, ⛵ Bateau',
        }
        return symbols_map.get(climate_type, '✨ Étoile, 🔮 Destin')
    
    def apply_cultural_diffusion(self, iterations: int = 2):
        """Applique diffusion culturelle depuis les régions vers les régions voisines."""
        
        try:
            import scipy.ndimage as ndimage
            
            # TODO: Implémenter diffusion spatiale
            for _ in range(iterations):
                pass
        except:
            pass
    
    def get_religion_map(self) -> np.ndarray:
        """Retourne la carte spatiale des religions."""
        # TODO: Mapper religions aux pixels basé sur regions
        return np.array([])
    
    def get_culture_map(self) -> np.ndarray:
        """Retourne la carte spatiale des cultures."""
        # TODO: Mapper cultures aux pixels basé sur regions
        return np.array([])
