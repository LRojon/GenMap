import random
import math
import time
from noise import PerlinNoise
from city import Cities

class Map:
    SEA_LEVEL = 127

    def __init__(self, width: int, height: int, seed: int = 0) -> None:
        self.cities = Cities()
        self.map: list[list[int]] = []
        self.seed: int = seed if seed != 0 else time.time_ns() % (2**32)
        self.rivers: list[list[tuple[int, int]]] = []
        self.width = width
        self.height = height
        self.map, self.seed, self.rivers = self.generate(self.seed)

    def generate(
        self,
        seed: int = 0, 
        erosionPasses: int = 200,
    ) -> tuple[list[list[int]], int, list[list[tuple[int, int]]]]:

        # ========== Génération du terrain ==========
        self.map, self.seed = self.genTerrain(octaves=8)
        
        # === Ajout de variations avec une autre couche de Perlin ===
        self.map = self.genVariations(octaves=6, persistence=0.5, scale=0.01)

        # ========== Erosion hydraulique ========== 
        self.map = self.genErosion(erosionPasses)

        # ========== Génération des rivières par propagation descendante et ramification ==========
        river_count = 1 + int((self.width + self.height) / 2) // 100
        for _ in range(river_count):
            start = (0, 0)
            while True:
                start = (random.randint(0, self.width - 1), random.randint(0, self.height - 1))
                if self.map[start[1]][start[0]] >= 200:
                    break
            river = self.genRiver(start, 5)
            if river:
                self.rivers.append(river)


        return self.map, self.seed, self.rivers

    def genTerrain(self, octaves: int = 8, persistence: float = 0.5, scale: float = 0.005) -> tuple[list[list[int]], int]:
        map = [[0 for _ in range(self.width)] for _ in range(self.height)]
        noise = PerlinNoise(self.seed)

        for y in range(self.height):
            for x in range(self.width):
                n = noise.octave_noise(x, y, octaves=octaves, persistence=persistence, scale=scale)
                map[y][x] = int((n + 1) / 2 * 255)
        return map, self.seed
    
    def genVariations(self, octaves: int = 6, persistence: float = 0.5, scale: float = 0.01) -> list[list[int]]:
        noise = PerlinNoise(self.seed)
        for x in range(self.width):
            for y in range(self.height):
                n = noise.octave_noise(x, y, octaves=octaves, persistence=persistence, scale=scale)
                self.map[y][x] = int(self.map[y][x] * ((n + 3) / 2))
                self.map[y][x] = max(0, min(255, self.map[y][x]))

                
                # Masque circulaire pour avoir des hauteurs plus basses sur les bords
                cx, cy = self.width / 2, self.height / 2
                ox, oy = x, y
                dist = math.sqrt((ox - cx) ** 2 + (oy - cy) ** 2)
                maxDist = math.sqrt((self.width / 2) ** 2 + (self.height / 2) ** 2) * 1.5
                factor = 1 - (dist / maxDist)
                self.map[y][x] = int(self.map[y][x] * factor)
        return self.map
    
    def genErosion(self, iterations: int = 100) -> list[list[int]]:
        water = [[0.0 for _ in range(self.width)] for _ in range(self.height)]
        sediment = [[0.0 for _ in range(self.width)] for _ in range(self.height)]
        rain_amount = 0.01  # quantité d'eau ajoutée à chaque itération
        evaporation = 0.02  # proportion d'eau qui s'évapore à chaque itération
        capacity = 2.0      # capacité de transport de sédiments
        erosion_rate = 0.3  # proportion de terrain érodé
        deposition_rate = 0.1  # proportion de sédiments déposés

        for _ in range(iterations):
            for y in range(self.height):
                for x in range(self.width):
                    water[y][x] += rain_amount

            for y in range(1, self.height - 1):
                for x in range(1, self.width - 1):
                    if self.map[y][x] < 128:
                        continue
                    h = self.map[y][x] + water[y][x]
                    min_h = h
                    min_dx, min_dy = 0, 0
                    for dy in [-1, 0, 1]:
                        for dx in [-1, 0, 1]:
                            if dx == 0 and dy == 0:
                                continue
                            nh = self.map[y + dy][x + dx] + water[y + dy][x + dx]
                            if nh < min_h:
                                min_h = nh
                                min_dx, min_dy = dx, dy
                    if min_dx != 0 or min_dy != 0:
                        delta = (h - min_h) / 2.0
                        if delta > 0:
                            flow = min(water[y][x], delta)
                            water[y][x] -= flow
                            water[y + min_dy][x + min_dx] += flow
                            max_erosion = min(self.map[y][x], flow * erosion_rate)
                            sediment[y][x] += max_erosion
                            self.map[y][x] -= int(max_erosion)
                    max_sed = water[y][x] * capacity
                    if sediment[y][x] > max_sed:
                        deposit = (sediment[y][x] - max_sed) * deposition_rate
                        self.map[y][x] += int(deposit)
                        sediment[y][x] -= deposit

            for y in range(self.height):
                for x in range(self.width):
                    water[y][x] *= (1 - evaporation)

        for y in range(self.height):
            for x in range(self.width):
                self.map[y][x] = int(max(0, min(255, self.map[y][x])))
        return self.map
    
    def genRiver(self, start: tuple[int, int], seed: int = 0, width: int = 1):
        river_path = [start]
        current = start
        visited = {start}
        random.seed(seed if seed != 0 else random.randint(0, 999999999))
        
        # Vérifier que le point de départ est valide (au-dessus du niveau de la mer)
        if self.map[current[1]][current[0]] <= Map.SEA_LEVEL:
            return
        
        max_iterations = min(500, self.width + self.height)  # Sécurité contre les boucles infinies
        iterations = 0
        stuck_counter = 0
        last_height = self.map[current[1]][current[0]]
        
        # Convertir les rivières existantes en set pour recherche rapide
        existing_river_points = set()
        for river in self.rivers:
            existing_river_points.update(river)
        
        while iterations < max_iterations:
            iterations += 1
            x, y = current
            current_height = self.map[y][x]
            
            # Arrêt si on atteint la mer
            if current_height <= Map.SEA_LEVEL:
                break
            
            # Arrêt si on rejoint une rivière existante
            if current in existing_river_points and current != start:
                self.rivers.append(river_path)
                self._apply_river_width(river_path, width)
                return
            
            # Détection de blocage : si la hauteur ne descend pas pendant plusieurs itérations
            if current_height >= last_height:
                stuck_counter += 1
                if stuck_counter > 10:  # Bloqué depuis trop longtemps
                    break
            else:
                stuck_counter = 0
            
            last_height = current_height
            
            # Trouver les voisins (8 directions)
            neighbors = []
            for dx, dy in [(-1,-1), (0,-1), (1,-1), (-1,0), (1,0), (-1,1), (0,1), (1,1)]:
                nx, ny = x + dx, y + dy
                
                # Vérifier les limites
                if 0 <= nx < self.width and 0 <= ny < self.height:
                    # Éviter de revenir en arrière
                    if (nx, ny) not in visited:
                        neighbor_height = self.map[ny][nx]
                        neighbors.append(((nx, ny), neighbor_height))
            
            if not neighbors:
                # Aucun voisin disponible, la rivière s'arrête
                break
            
            # Trier par hauteur (du plus bas au plus haut)
            neighbors.sort(key=lambda n: n[1])
            
            # Sélection du prochain point avec une préférence pour les plus bas
            # mais avec un peu d'aléatoire pour plus de naturel
            if random.random() < 0.85:  # 85% du temps, prendre le plus bas
                next_pos = neighbors[0][0]
            else:  # 15% du temps, prendre parmi les 2 plus bas
                candidates = neighbors[:min(2, len(neighbors))]
                next_pos = random.choice(candidates)[0]
            
            # Si la prochaine case est plus haute, creuser légèrement
            next_height = self.map[next_pos[1]][next_pos[0]]
            if next_height > current_height:
                self.map[next_pos[1]][next_pos[0]] = max(Map.SEA_LEVEL + 1, current_height - 1)
            
            current = next_pos
            visited.add(current)
            river_path.append(current)
        
        # Ajouter la rivière complète à la liste
        if len(river_path) > 1:  # Seulement si la rivière a au moins 2 points
            self.rivers.append(river_path)
            self._apply_river_width(river_path, width)
    
    def _apply_river_width(self, river_path: list[tuple[int, int]], width: int):
        """Applique la largeur à la rivière en creusant autour du chemin principal."""
        height = len(self.map)
        map_width = len(self.map[0])
        radius = width // 2
        
        for x, y in river_path:
            # Creuser autour de chaque point de la rivière
            for dx in range(-radius, radius + 1):
                for dy in range(-radius, radius + 1):
                    nx, ny = x + dx, y + dy
                    
                    # Vérifier les limites
                    if 0 <= nx < map_width and 0 <= ny < height:
                        # Distance au centre (pour un effet plus naturel)
                        dist = abs(dx) + abs(dy)
                        
                        if dist <= radius:
                            if self.map[ny][nx] > Map.SEA_LEVEL:
                                # Creuser plus au centre, moins sur les bords
                                erosion = 3 if dist == 0 else (2 if dist == 1 else 1)
                                self.map[ny][nx] = max(Map.SEA_LEVEL + 1, self.map[ny][nx] - erosion)
    
    @staticmethod
    def placeCities(map: list[list[int]], rivers: list[list[tuple[int, int]]], 
                    cities, num_cities: int, seed: int = 0) -> None:
        """
        Place des villes de manière intelligente sur la carte.
        Les villes sont placées près des rivières, des côtes, et évitent les montagnes.
        
        Args:
            map: Tableau 2D des hauteurs (0-255)
            rivers: Liste des rivières existantes
            cities: Instance de Cities où ajouter les villes
            num_cities: Nombre de villes à placer
            seed: Seed pour la génération aléatoire
        """
        if seed != 0:
            random.seed(seed)
        
        height = len(map)
        width = len(map[0])
        
        # Convertir les rivières en set pour recherche rapide
        river_tiles = set()
        for river in rivers:
            river_tiles.update(river)
        
        # Calculer une carte de scores pour chaque position
        score_map = Map._calculate_city_scores(map, river_tiles, width, height)
        
        # Créer une liste de candidats avec leurs scores
        candidates = []
        for y in range(height):
            for x in range(width):
                if score_map[y][x] > 0:
                    candidates.append(((x, y), score_map[y][x]))
        
        # Trier par score décroissant
        candidates.sort(key=lambda c: c[1], reverse=True)
        
        # Placer les villes en respectant une distance minimale
        placed_cities = []
        min_distance = max(width, height) // 20  # Distance minimale entre villes
        
        for position, score in candidates:
            if len(placed_cities) >= num_cities:
                break
            
            # Vérifier la distance avec les villes déjà placées
            too_close = False
            for existing_city in placed_cities:
                dist = math.sqrt((position[0] - existing_city[0])**2 + 
                               (position[1] - existing_city[1])**2)
                if dist < min_distance:
                    too_close = True
                    break
            
            if not too_close:
                placed_cities.append(position)
                cities.generateCity(position, seed=random.randint(0, 2**31))
    
    @staticmethod
    def _calculate_city_scores(map: list[list[int]], river_tiles: set, 
                               width: int, height: int) -> list[list[float]]:
        """
        Calcule un score pour chaque position basé sur plusieurs critères :
        - Proximité aux rivières (bonus important)
        - Proximité aux côtes (bonus moyen)
        - Altitude (préférence pour terrain plat, pas trop haut)
        - Éviter l'eau et les montagnes
        """
        score_map = [[0.0 for _ in range(width)] for _ in range(height)]
        
        for y in range(height):
            for x in range(width):
                terrain_height = map[y][x]
                
                # Conditions de base : pas dans l'eau, pas trop haut
                if terrain_height <= Map.SEA_LEVEL:
                    continue  # Pas de ville dans l'eau
                
                if terrain_height > 180:
                    continue  # Pas de ville en haute montagne
                
                score = 100.0  # Score de base
                
                # 1. Bonus altitude idéale (130-160 = plaines)
                if 130 <= terrain_height <= 160:
                    score += 50
                elif 160 < terrain_height <= 170:
                    score += 20
                else:
                    score -= (terrain_height - 160) * 0.5  # Pénalité si trop haut
                
                # 2. Bonus proximité rivière (très important)
                min_river_dist = float('inf')
                for rx, ry in river_tiles:
                    dist = abs(x - rx) + abs(y - ry)  # Distance Manhattan
                    if dist < min_river_dist:
                        min_river_dist = dist
                
                if min_river_dist <= 2:
                    score += 150  # Très proche d'une rivière
                elif min_river_dist <= 5:
                    score += 80
                elif min_river_dist <= 10:
                    score += 40
                elif min_river_dist <= 20:
                    score += 10
                
                # 3. Bonus proximité côte
                coast_dist = Map._distance_to_coast(map, x, y, width, height)
                if coast_dist <= 3:
                    score += 100  # Ville côtière
                elif coast_dist <= 10:
                    score += 50
                elif coast_dist <= 20:
                    score += 20
                
                # 4. Pénalité si terrain trop accidenté autour
                terrain_variation = Map._calculate_terrain_variation(map, x, y, width, height)
                if terrain_variation > 30:
                    score -= 50  # Terrain trop accidenté
                elif terrain_variation > 15:
                    score -= 20
                
                # 5. Bonus si confluence de rivières à proximité
                if Map._is_near_river_confluence(river_tiles, x, y):
                    score += 100
                
                score_map[y][x] = max(0, score)
        
        return score_map
    
    @staticmethod
    def _distance_to_coast(map: list[list[int]], x: int, y: int, 
                          width: int, height: int) -> int:
        """Calcule la distance approximative à la côte la plus proche."""
        search_radius = 25
        min_dist = search_radius
        
        for dy in range(-search_radius, search_radius + 1):
            for dx in range(-search_radius, search_radius + 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    # Vérifier s'il y a de l'eau adjacente à de la terre
                    if map[ny][nx] <= Map.SEA_LEVEL:
                        # C'est de l'eau, vérifier s'il y a de la terre à côté
                        for ddx, ddy in [(-1,0), (1,0), (0,-1), (0,1)]:
                            nnx, nny = nx + ddx, ny + ddy
                            if 0 <= nnx < width and 0 <= nny < height:
                                if map[nny][nnx] > Map.SEA_LEVEL:
                                    # C'est une côte
                                    dist = abs(dx) + abs(dy)
                                    if dist < min_dist:
                                        min_dist = dist
        
        return min_dist
    
    @staticmethod
    def _calculate_terrain_variation(map: list[list[int]], x: int, y: int,
                                     width: int, height: int) -> float:
        """Calcule la variation de hauteur dans un rayon de 3 pixels."""
        heights = []
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    heights.append(map[ny][nx])
        
        if not heights:
            return 0
        
        return max(heights) - min(heights)
    
    @staticmethod
    def _is_near_river_confluence(river_tiles: set, x: int, y: int) -> bool:
        """Détecte si la position est près d'une confluence de rivières."""
        # Compter le nombre de segments de rivière différents à proximité
        nearby_river_segments = 0
        search_radius = 5
        
        for dy in range(-search_radius, search_radius + 1):
            for dx in range(-search_radius, search_radius + 1):
                if (x + dx, y + dy) in river_tiles:
                    nearby_river_segments += 1
        
        # Si beaucoup de tuiles de rivière à proximité, c'est probablement une confluence
        return nearby_river_segments > 8
