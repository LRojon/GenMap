import numpy as np
import random
import time
from scipy.ndimage import median_filter, minimum_filter, distance_transform_edt
from noise import PerlinNoise
from city import Cities

class Map:
    SEA_LEVEL = 127

    def __init__(self, width: int, height: int, seed: int = 0) -> None:
        self.cities = Cities()
        self.map = np.zeros((height, width), dtype=np.uint8)
        self.seed = seed if seed != 0 else time.time_ns() % (2**32)
        self.rivers = []
        self.width = width
        self.height = height
        self.map, self.seed, self.rivers, self.cities = self.generate(self.seed)

    def generate(self, seed: int = 0, erosionPasses: int = 200):
        random.seed(seed)
        np.random.seed(seed)
        starttime = time.time()
        
        # ========== Génération du terrain (vectorisé) ==========
        self.map, self.seed = self.genTerrain(octaves=8)
        print(f"Terrain généré en {time.time() - starttime:.2f}s")
        starttime = time.time()
        
        # === Variations avec Perlin (vectorisé) ===
        self.map = self.genVariations(octaves=6, persistence=0.5, scale=0.01)
        print(f"Variations générées en {time.time() - starttime:.2f}s")
        starttime = time.time()

        # ========== Génération des rivières ==========
        river_count = 1 + int((self.width + self.height) / 2) // 100
        for _ in range(river_count):
            start = (0, 0)
            attempts = 0
            while attempts < 50:
                attempts += 1
                start = (random.randint(0, self.width - 1), random.randint(0, self.height - 1))
                if self.map[start[1], start[0]] >= 200:
                    break
            river = self.genRiver(start, 5)
            if river:
                self.rivers.append(river)
        
        print(f"Rivières générée en {time.time() - starttime:.2f}s")
        starttime = time.time()
        # ========== Placement des villes ==========
        nbCities = (self.width * self.height) // 10000
        nbCities = int(nbCities * random.uniform(0.8, 1.2))
        self.placeCities(nbCities)
        print(f"Villes placées en {time.time() - starttime:.2f}s")
        starttime = time.time()

        self.map = np.clip(self.map, 0, 255)
        return self.map, self.seed, self.rivers, self.cities

    def genTerrain(self, octaves: int = 8, persistence: float = 0.5, scale: float = 0.005):
        """Génération vectorisée du terrain."""
        noise = PerlinNoise(self.seed)
        
        # Générer tout le bruit d'un coup (vectorisé)
        noise_values = noise.octave_noise_grid(self.width, self.height, octaves, persistence, scale)
        
        # Normaliser entre 0 et 255
        map_array = ((noise_values + 1) / 2 * 255).astype(np.uint8)
        
        return map_array, self.seed
    
    def genVariations(self, octaves: int = 6, persistence: float = 0.5, scale: float = 0.01):
        """Ajoute des variations avec masque circulaire (vectorisé)."""
        noise = PerlinNoise(self.seed)
        
        # Générer le bruit de variation
        variation = noise.octave_noise_grid(self.width, self.height, octaves, persistence, scale)
        print("min value after variation:", np.min(self.map))
        print("max value after variation:", np.max(self.map))

        # Appliquer la variation
        self.map = (self.map * ((variation + 3) / 2)).astype(np.float32)
        
        # Créer le masque circulaire (vectorisé)
        cx, cy = self.width / 2, self.height / 2
        y_coords, x_coords = np.mgrid[0:self.height, 0:self.width]
        
        dist = np.sqrt((x_coords - cx) ** 2 + (y_coords - cy) ** 2)
        maxDist = np.sqrt((self.width / 2) ** 2 + (self.height / 2) ** 2) * 1.5
        factor = 1 - (dist / maxDist)
        
        # Appliquer le masque
        self.map = (self.map * factor).astype(np.uint8)
        self.map = np.clip(self.map, 0, 255)
        # Lissage pour supprimer les pics isolés
        self.map = median_filter(self.map, size=3)
        return self.map

    def genRiver(self, start: tuple[int, int], seed: int = 0, width: int = 1):
        """Génération de rivière (optimisée)."""
        river_path = [start]
        current = start
        visited = {start}
    # Ne pas réinitialiser le seed ici pour éviter de casser la randomisation globale
        
        if self.map[current[1], current[0]] <= Map.SEA_LEVEL:
            return None
        
    # Limite plus stricte sur le nombre d'itérations pour accélérer
        max_iterations = min(200, (self.width + self.height) // 2)
        iterations = 0
        stuck_counter = 0
        last_height = self.map[current[1], current[0]]
        
        # Convertir rivières existantes en set
        existing_river_points = set()
        for river in self.rivers:
            existing_river_points.update(river)
        
        while iterations < max_iterations:
            iterations += 1
            x, y = current
            current_height = self.map[y, x]
            
            if current_height <= Map.SEA_LEVEL:
                break
            
            if current in existing_river_points and current != start:
                self.rivers.append(river_path)
                self._apply_river_width(river_path, width)
                return river_path
            
            if current_height >= last_height:
                stuck_counter += 1
                if stuck_counter > 10:
                    break
            else:
                stuck_counter = 0
            
            last_height = current_height
            
            # Trouver voisins
            neighbors = []
            for dx, dy in [(-1,-1), (0,-1), (1,-1), (-1,0), (1,0), (-1,1), (0,1), (1,1)]:
                nx, ny = x + dx, y + dy
                
                if 0 <= nx < self.width and 0 <= ny < self.height:
                    if (nx, ny) not in visited:
                        neighbor_height = self.map[ny, nx]
                        neighbors.append(((nx, ny), neighbor_height))
            
            if not neighbors:
                break
            
            neighbors.sort(key=lambda n: n[1])
            
            if random.random() < 0.85:
                next_pos = neighbors[0][0]
            else:
                candidates = neighbors[:min(2, len(neighbors))]
                next_pos = random.choice(candidates)[0]
            
            next_height = self.map[next_pos[1], next_pos[0]]
            if next_height > current_height:
                self.map[next_pos[1], next_pos[0]] = max(Map.SEA_LEVEL + 1, current_height - 1)
            
            current = next_pos
            visited.add(current)
            river_path.append(current)
        
        if len(river_path) > 1:
            self.rivers.append(river_path)
            self._apply_river_width(river_path, width)
            return river_path
        return None
    
    def _apply_river_width(self, river_path: list[tuple[int, int]], width: int):
        """Applique la largeur (vectorisé avec NumPy)."""
        radius = width // 2
        
        for x, y in river_path:
            y_min = max(0, y - radius)
            y_max = min(self.height, y + radius + 1)
            x_min = max(0, x - radius)
            x_max = min(self.width, x + radius + 1)
            
            # Créer une sous-grille
            sub_y, sub_x = np.mgrid[y_min:y_max, x_min:x_max]
            
            # Calculer distances
            dist = np.abs(sub_x - x) + np.abs(sub_y - y)
            
            # Masque pour les pixels à modifier
            mask = (dist <= radius) & (self.map[y_min:y_max, x_min:x_max] > Map.SEA_LEVEL)
            
            # Appliquer l'érosion
            erosion = np.where(dist == 0, 3, np.where(dist == 1, 2, 1))
            new_values = np.maximum(Map.SEA_LEVEL + 1, 
                                   self.map[y_min:y_max, x_min:x_max] - erosion)
            
            self.map[y_min:y_max, x_min:x_max] = np.where(mask, new_values, 
                                                           self.map[y_min:y_max, x_min:x_max])
    
    def placeCities(self, num_cities: int) -> None:
        """Placement de villes (optimisé)."""
        # Convertir rivières en set
        river_tiles = set()
        for river in self.rivers:
            river_tiles.update(river)
        
        # Calculer scores
        score_map = self._calculate_city_scores(river_tiles)
        
        # Créer candidats
        candidates = []
        for y in range(self.height):
            for x in range(self.width):
                if score_map[y, x] > 0:
                    candidates.append(((x, y), score_map[y, x]))
        
        if not candidates:
            return
        
        placed_cities = []
        min_distance = max(self.width, self.height) // 20
        
        attempts = 0
        max_attempts = num_cities * 20

        starttime = time.time()

        while len(placed_cities) < num_cities and attempts < max_attempts:
            attempts += 1
            
            total_weight = sum(score ** 1.5 for _, score in candidates)
            
            if total_weight == 0:
                break
            
            rand = random.random() * total_weight
            cumulative = 0
            selected_position = None
            
            for position, score in candidates:
                cumulative += score ** 1.5
                if cumulative >= rand:
                    selected_position = position
                    break
            
            if not selected_position:
                continue
            
            # Vérifier distance (vectorisé pour les villes déjà placées)
            if placed_cities:
                placed_array = np.array(placed_cities)
                distances = np.sqrt(np.sum((placed_array - np.array(selected_position)) ** 2, axis=1))
                if np.any(distances < min_distance):
                    continue
            
            placed_cities.append(selected_position)
            self.cities.generateCity(selected_position, seed=random.randint(0, 2**31))
            
            # Filtrer candidats
            candidates = [
                (pos, sc) for pos, sc in candidates 
                if abs(pos[0] - selected_position[0]) + abs(pos[1] - selected_position[1]) >= min_distance
            ]
            
            if not candidates:
                break
    
    def _calculate_city_scores(self, river_tiles: set):
        """Calcul des scores (partiellement vectorisé)."""
        score_map = np.zeros((self.height, self.width), dtype=np.float32)
        
        # Masques de base (vectorisés)
        valid_height = (self.map > Map.SEA_LEVEL) & (self.map <= 180)
        
        # Score de base
        score_map[valid_height] = 50.0
        
        # Bonus altitude
        altitude_bonus = np.where(
            (self.map >= 130) & (self.map <= 160), 40,
            np.where((self.map > 160) & (self.map <= 170), 20, 0)
        )
        score_map += altitude_bonus * valid_height
        
        # Pénalité altitude élevée
        high_penalty = np.maximum(0, (self.map - 160) * 0.3)
        score_map -= high_penalty * (self.map > 170) * valid_height
        
        # Proximité rivière (vectorisé)
        if river_tiles:
            river_mask = np.ones((self.height, self.width), dtype=bool)
            for rx, ry in river_tiles:
                river_mask[ry, rx] = False
            river_dist = np.array(distance_transform_edt(river_mask))
            # Appliquer bonus selon la distance
            score_map += (river_dist <= 2).astype(np.float32) * 80
            score_map += ((river_dist > 2) & (river_dist <= 5)).astype(np.float32) * 50
            score_map += ((river_dist > 5) & (river_dist <= 10)).astype(np.float32) * 25
            score_map += ((river_dist > 10) & (river_dist <= 20)).astype(np.float32) * 10

        # Proximité côte (toujours en boucle, car dépend de _distance_to_coast)
        step = round(self.width * self.height * 0.00003)
        print("step:", step)
        for y in range(0, self.height, step):
            for x in range(0, self.width, step):
                if not valid_height[y, x]:
                    continue
                coast_dist = self._distance_to_coast(x, y)
                if coast_dist <= 3:
                    score_map[y, x] += 60
                elif coast_dist <= 10:
                    score_map[y, x] += 30
                elif coast_dist <= 20:
                    score_map[y, x] += 10
                # Variation terrain
                terrain_var = self._calculate_terrain_variation(x, y)
                if terrain_var > 30:
                    score_map[y, x] -= 30
                elif terrain_var > 15:
                    score_map[y, x] -= 15
                # Confluence
                if self._is_near_river_confluence(river_tiles, x, y):
                    score_map[y, x] += 50
                # Facteur aléatoire
                score_map[y, x] *= random.uniform(0.7, 1.3)
                # Bonus surprise
                if random.random() < 0.05:
                    score_map[y, x] += random.uniform(20, 60)
        return np.maximum(0, score_map)
    
    def _distance_to_coast(self, x: int, y: int) -> int:
        """Distance à la côte."""
        search_radius = 20
        for radius in range(1, search_radius + 1):
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    if abs(dx) + abs(dy) > radius:
                        continue
                    
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.width and 0 <= ny < self.height:
                        if self.map[ny, nx] <= Map.SEA_LEVEL:
                            for ddx, ddy in [(-1,0), (1,0), (0,-1), (0,1)]:
                                nnx, nny = nx + ddx, ny + ddy
                                if 0 <= nnx < self.width and 0 <= nny < self.height:
                                    if self.map[nny, nnx] > Map.SEA_LEVEL:
                                        return abs(dx) + abs(dy)
        
        return search_radius
    
    def _calculate_terrain_variation(self, x: int, y: int) -> float:
        """Variation de terrain (vectorisé)."""
        y_min = max(0, y - 3)
        y_max = min(self.height, y + 4)
        x_min = max(0, x - 3)
        x_max = min(self.width, x + 4)
        
        region = self.map[y_min:y_max, x_min:x_max]
        return float(np.max(region) - np.min(region))
    
    def _is_near_river_confluence(self, river_tiles: set, x: int, y: int) -> bool:
        """Détection de confluence."""
        nearby = sum(1 for dy in range(-5, 6) for dx in range(-5, 6) 
                    if (x + dx, y + dy) in river_tiles)
        return nearby > 8