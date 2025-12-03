import numpy as np
import random
import time
from scipy.ndimage import median_filter, minimum_filter, distance_transform_edt
from noise import PerlinNoise
from city import Cities
from astar_lib import astar_lib
import itertools
from concurrent.futures import ThreadPoolExecutor
from collections import deque
from voronoi import Voronoi


class Map:
    SEA_LEVEL = 127

    def generate_regions(self):
        from voronoi import Voronoi
        import random
        points = [city.position for city in self.cities.cities]
        
        # Ajouter plus de points aléatoires pour enrichir les régions
        # Base: 1 point par 4000 pixels, augmentée à 3x pour plus de détails
        nb_rand = max(20, (self.width * self.height) // 1300)  # Augmenté de 4000 à 1300
        random.seed(self.seed)
        for _ in range(nb_rand):
            px = random.randint(0, self.width-1)
            py = random.randint(0, self.height-1)
            points.append((px, py))
        
        vor = Voronoi(points, self.width, self.height)
        self.regions = vor.cells
        self.region_edges = vor.edges

    def __init__(self, width: int, height: int, seed: int = 0) -> None:
        from country import Countries
        self.cities = Cities()
        self.countries = Countries()  # Gestion des pays
        self.map = np.zeros((height, width), dtype=np.uint8)
        self.climate = np.zeros((height, width), dtype=np.uint8)  # Carte de climat (0-255)
        self.biomes = np.zeros((height, width), dtype=np.uint8)  # Carte de biomes
        self.religions = np.zeros((height, width), dtype=np.uint32)  # ID région Voronoi pour religion
        self.cultures = np.zeros((height, width), dtype=np.uint32)  # ID région Voronoi pour culture
        self.religion_names = {}  # region_id -> religion name
        self.culture_names = {}   # region_id -> culture name
        self.seed = seed if seed != 0 else time.time_ns() % (2**32)
        self.rivers = []
        self.routes = []
        self.regions = []
        self.width = width
        self.height = height
        self.map, self.seed, self.rivers, self.cities = self.generate(self.seed)

    def _smooth_path_catmull_rom(self, path, segments=1):
        """Lisse un chemin avec une spline Catmull-Rom pour un effet organique."""
        if len(path) < 2:
            return path
        
        smoothed = []
        
        # Ajouter des points fantômes au début et à la fin pour la continuité
        points = [path[0]] + list(path) + [path[-1]]
        
        # Pour chaque segment, générer des points intermédiaires lissés
        for i in range(len(path) - 1):
            p0 = np.array(points[i])
            p1 = np.array(points[i + 1])
            p2 = np.array(points[i + 2])
            p3 = np.array(points[i + 3]) if i + 3 < len(points) else p2 + (p2 - p1)
            
            smoothed.append(tuple(p1.astype(int)))
            
            # Générer des points intermédiaires (réduit à 1 pour moins de points)
            for t in np.linspace(0, 1, segments + 1)[1:]:
                # Formule Catmull-Rom
                t2 = t * t
                t3 = t2 * t
                
                q = 0.5 * (
                    2 * p1 +
                    (-p0 + p2) * t +
                    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
                )
                
                pt = tuple(q.astype(int))
                # Éviter les doublons
                if pt != smoothed[-1]:
                    smoothed.append(pt)
        
        # Ajouter le dernier point
        smoothed.append(tuple(path[-1]))
        
        return smoothed

    def generate_routes_between_cities(self):
        """Génère les routes avec Delaunay + Perlin Drift + optimisations intelligentes."""
        if not hasattr(self.cities, 'cities') or len(self.cities.cities) < 2:
            return
        
        cities = self.cities.cities
        positions = np.array([city.position for city in cities])
        city_indices = list(range(len(cities)))
        
        # ========== ÉTAPE 1: Triangulation Delaunay ==========
        from scipy.spatial import Delaunay
        try:
            tri = Delaunay(positions)
            edges_delaunay = set()
            for simplex in tri.simplices:
                for i, j in [(simplex[0], simplex[1]), (simplex[1], simplex[2]), (simplex[0], simplex[2])]:
                    edge = tuple(sorted([i, j]))
                    edges_delaunay.add(edge)
        except Exception as e:
            edges_delaunay = set(itertools.combinations(range(len(positions)), 2))
        
        # ========== ÉTAPE 2: Filtrer les arêtes invalides ==========
        valid_edges_delaunay = []
        for i, j in edges_delaunay:
            start = tuple(positions[i].astype(int))
            goal = tuple(positions[j].astype(int))
            if self._check_edge_validity(start, goal):
                valid_edges_delaunay.append((i, j, np.linalg.norm(positions[i] - positions[j])))
        
        # ========== ÉTAPE 2b: Hybride Delaunay + Filtrage intelligent ==========
        # Garder Delaunay pour l'organicité, mais filtrer pour réduire la surcharge
        valid_edges = self._filter_delaunay_edges(valid_edges_delaunay, len(positions))
        # ========== ÉTAPE 2c: Assurer la connexité complète ==========
        # Ajouter des arêtes supplémentaires pour connecter les villes isolées
        valid_edges = self._ensure_connectivity(positions, valid_edges)
        
        # ========== ÉTAPE 3: Grouper les villes proches par région ==========
        city_groups = self._group_nearby_cities(positions, valid_edges, threshold=80)
        
        # ========== ÉTAPE 4: Générer les routes brutes ==========
        raw_routes = {}  # (i, j) -> path
        for i, j in valid_edges:
            start = tuple(positions[i].astype(int))
            goal = tuple(positions[j].astype(int))
            path = self._generate_path_perlin_drift(start, goal)
            if path and len(path) > 0:
                raw_routes[(i, j)] = path
        
        # ========== ÉTAPE 5: Fusionner les routes au départ ==========
        merged_routes = self._merge_routes_at_departure(raw_routes, positions, city_groups, merge_distance=50)
        
        # ========== ÉTAPE 6: Contourner lacs/rivières intelligemment ==========
        smart_routes = self._smart_avoid_obstacles(merged_routes, valid_edges, positions)
        
        # ========== ÉTAPE 7 & 8: Optimisations finales ==========
        # Au lieu de faire regroupement parallèle + intersection separately, 
        # on garde toutes les routes et on les affiche directement
        self.routes = list(smart_routes.values()) if isinstance(smart_routes, dict) else smart_routes
        
    def _build_mst_from_edges(self, valid_edges_with_dist, num_cities):
        """Construire un MST (Minimum Spanning Tree) à partir des arêtes valides."""
        # Trier par distance
        sorted_edges = sorted(valid_edges_with_dist, key=lambda x: x[2])
        
        # Union-Find pour Kruskal
        parent = list(range(num_cities))
        
        def find(x):
            if parent[x] != x:
                parent[x] = find(parent[x])
            return parent[x]
        
        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py
                return True
            return False
        
        mst_edges = []
        for i, j, dist in sorted_edges:
            if union(i, j):
                mst_edges.append((i, j))
                if len(mst_edges) == num_cities - 1:
                    break
        
        return mst_edges

    def _filter_delaunay_edges(self, valid_edges_with_dist, num_cities, max_degree=4):
        """Filtrer les arêtes Delaunay pour garder un nombre raisonnable tout en préservant l'organicité."""
        # Trier par distance (priorité aux arêtes courtes)
        sorted_edges = sorted(valid_edges_with_dist, key=lambda x: x[2])
        
        # Construire un graphe avec limitation de degré
        degree = {i: 0 for i in range(num_cities)}
        filtered_edges = []
        
        # D'abord, ajouter les arêtes courtes jusqu'à atteindre le max_degree par nœud
        for i, j, dist in sorted_edges:
            if degree[i] < max_degree and degree[j] < max_degree:
                filtered_edges.append((i, j))
                degree[i] += 1
                degree[j] += 1
        
        return filtered_edges

    def _ensure_connectivity(self, positions, valid_edges):
        """Assurer que toutes les villes sont connectées."""
        # Construire un graphe des connexions actuelles
        edges_list = list(valid_edges)
        graph = {i: [] for i in range(len(positions))}
        for i, j in edges_list:
            graph[i].append(j)
            graph[j].append(i)
        
        # Trouver les composantes connexes
        visited = set()
        components = []
        
        def dfs(node, component):
            if node in visited:
                return
            visited.add(node)
            component.append(node)
            for neighbor in graph[node]:
                dfs(neighbor, component)
        
        for i in range(len(positions)):
            if i not in visited:
                component = []
                dfs(i, component)
                components.append(component)
        
        # Si plusieurs composantes, les connecter
        if len(components) > 1:
            # Pour chaque composante, trouver la ville la plus proche d'une autre composante
            for c1_idx in range(len(components) - 1):
                c1 = components[c1_idx]
                min_dist = float('inf')
                best_pair = None
                best_c2_idx = -1
                
                # Trouver la connexion la plus courte entre c1 et les autres composantes
                for c2_idx in range(c1_idx + 1, len(components)):
                    c2 = components[c2_idx]
                    for i in c1:
                        for j in c2:
                            dist = np.linalg.norm(positions[i] - positions[j])
                            if dist < min_dist:
                                min_dist = dist
                                best_pair = (i, j)
                                best_c2_idx = c2_idx
                
                if best_pair and best_c2_idx >= 0:
                    i, j = best_pair
                    # Vérifier si l'arête est valide
                    start = tuple(positions[i].astype(int))
                    goal = tuple(positions[j].astype(int))
                    
                    if self._check_edge_validity(start, goal):
                        edges_list.append((i, j))
                        # Mettre à jour le graphe
                        graph[i].append(j)
                        graph[j].append(i)
                        # Fusionner les composantes
                        components[c1_idx].extend(components[best_c2_idx])
                        components.pop(best_c2_idx)
                    else:
                        # Si direct invalide, chercher via une ville intermédiaire
                        # Trouver la ville la plus proche dans c1 qui peut se connecter à j
                        for intermediate in c1:
                            inter_pos = tuple(positions[intermediate].astype(int))
                            if self._check_edge_validity(inter_pos, goal):
                                if (intermediate, j) not in edges_list and (j, intermediate) not in edges_list:
                                    edges_list.append((intermediate, j))
                                break
        
        return edges_list

    def _group_nearby_cities(self, positions, edges, threshold=80):
        """Grouper les villes proches en régions."""
        groups = {}
        for city_idx in range(len(positions)):
            groups[city_idx] = [city_idx]
            
            # Trouver les villes proches
            for i, j in edges:
                other = j if i == city_idx else (i if j == city_idx else None)
                if other is not None:
                    dist = np.linalg.norm(positions[city_idx] - positions[other])
                    if dist < threshold:
                        if other not in groups[city_idx]:
                            groups[city_idx].append(other)
        
        return groups

    def _merge_routes_at_departure(self, raw_routes, positions, city_groups, merge_distance=50):
        """Fusionner les routes qui partent d'une même région (DÉSACTIVÉ TEMPORAIREMENT)."""
        # Pour l'instant, retourner les routes sans fusion pour vérifier l'affichage
        return raw_routes

    def _fuse_paths_at_start(self, routes_with_paths, merge_distance):
        """Fusionner plusieurs chemins au départ."""
        if not routes_with_paths:
            return []
        
        main_route, main_path = routes_with_paths[0]
        fused_path = list(main_path)
        
        # Pour chaque point du chemin principal
        for step in range(min(merge_distance, len(fused_path))):
            main_point = fused_path[step]
            
            # Vérifier si d'autres chemins passent près de ce point
            for _, other_path in routes_with_paths[1:]:
                if step < len(other_path):
                    other_point = other_path[step]
                    dist = np.linalg.norm(np.array(main_point) - np.array(other_point))
                    if dist < 5:  # Si très proche, ignorer
                        continue
                    # Sinon, faire converger progressivement
                    if step > 10:  # Après les premiers pas
                        break
        
        return fused_path

    def _smart_avoid_obstacles(self, routes, valid_edges, positions):
        """Contourner intelligemment lacs et rivières."""
        smart_routes = {}
        
        for edge_key, path in routes.items():
            # Analyser le chemin pour détecter les passages difficiles
            problematic_segments = self._find_problematic_segments(path)
            
            if problematic_segments:
                # Essayer de contourner
                improved_path = self._improve_path_around_obstacles(path, problematic_segments)
                smart_routes[edge_key] = improved_path if improved_path else path
            else:
                smart_routes[edge_key] = path
        
        return smart_routes

    def _find_problematic_segments(self, path):
        """Trouver les segments du chemin qui passent par des obstacles."""
        problematic = []
        
        for i, (x, y) in enumerate(path):
            if not (0 <= x < self.width and 0 <= y < self.height):
                continue
            
            val = self.map[y, x]
            # Rivière difficile ou relief très haut
            if (128 <= val <= 132) or val > 220:
                problematic.append(i)
        
        return problematic

    def _improve_path_around_obstacles(self, path, problematic_indices):
        """Améliorer le chemin autour des obstacles."""
        if not problematic_indices:
            return path
        
        # Simplification : lisser les zones problématiques
        improved = list(path)
        for idx in problematic_indices:
            if 0 < idx < len(improved) - 1:
                # Moyenne avec les voisins pour lisser
                prev_pt = np.array(improved[idx - 1])
                next_pt = np.array(improved[idx + 1])
                improved[idx] = tuple(((prev_pt + next_pt) / 2).astype(int))
        
        return improved

    def _group_parallel_routes(self, routes, threshold=15):
        """Regrouper les routes parallèles proches (DÉSACTIVÉ TEMPORAIREMENT)."""
        # Pour l'instant, retourner les routes sans regroupement
        return routes

    def _are_paths_parallel(self, path1, path2, threshold):
        """Vérifier si deux chemins sont parallèles et proches."""
        if len(path1) < 10 or len(path2) < 10:
            return False
        
        # Comparer les directions à plusieurs points
        directions_match = 0
        for i in range(0, min(len(path1), len(path2)), max(1, len(path1) // 5)):
            pt1 = np.array(path1[i])
            pt2 = np.array(path2[i])
            dist = np.linalg.norm(pt1 - pt2)
            
            if dist < threshold:
                directions_match += 1
        
        return directions_match > 2

    def _average_parallel_paths(self, paths):
        """Moyenne plusieurs chemins parallèles."""
        if len(paths) == 1:
            return paths[0]
        
        max_len = max(len(p) for p in paths)
        averaged = []
        
        for i in range(max_len):
            points = []
            for path in paths:
                if i < len(path):
                    points.append(np.array(path[i]))
            
            if points:
                avg_point = np.mean(points, axis=0)
                averaged.append(tuple(avg_point.astype(int)))
        
        return averaged

    def _optimize_intersections(self, routes):
        """Optimiser les carrefours où 3+ routes se croisent."""
        # Convertir en liste pour traitement
        final_routes = list(routes.values())
        
        # Trouver les points d'intersection fréquents
        intersection_map = {}
        for route_idx, path in enumerate(final_routes):
            for point in path:
                point_key = tuple(point)
                if point_key not in intersection_map:
                    intersection_map[point_key] = []
                intersection_map[point_key].append(route_idx)
        
        # Identifier les hubs (3+ routes)
        hubs = {pt: routes for pt, routes in intersection_map.items() if len(routes) >= 3}
        
        return final_routes

    def _check_edge_validity(self, start, goal):
        """Vérifier si une arête passe par la mer ou trop haut en montagne."""
        x0, y0 = start
        x1, y1 = goal
        
        # Bresenham pour tracer la ligne
        steps = max(abs(x1 - x0), abs(y1 - y0))
        if steps == 0:
            return True
        
        for step in range(steps + 1):
            t = step / steps
            x = int(x0 + (x1 - x0) * t)
            y = int(y0 + (y1 - y0) * t)
            
            if 0 <= x < self.width and 0 <= y < self.height:
                val = self.map[y, x]
                # Invalide si mer ou montagne trop haute
                if val <= Map.SEA_LEVEL or val > 200:
                    return False
        
        return True

    def _generate_path_perlin_drift(self, start, goal, step_size=1.0):
        """Génère un chemin avec Perlin Drift (direction guidée par Perlin noise)."""
        path = [start]
        current = np.array(start, dtype=np.float32)
        goal = np.array(goal, dtype=np.float32)
        
        # Pré-calculer la grille Perlin une seule fois pour toute la carte
        noise_gen = PerlinNoise(self.seed)
        perlin_grid = noise_gen.octave_noise_grid(self.width, self.height, octaves=4, persistence=0.5, scale=0.08)
        
        max_steps = int(np.linalg.norm(goal - current) * 2)  # Limite pour éviter les boucles
        steps = 0
        
        while steps < max_steps and np.linalg.norm(goal - current) > 1.5:
            steps += 1
            
            # Direction vers l'objectif
            direction = goal - current
            dist = np.linalg.norm(direction)
            if dist < 0.1:
                break
            direction = direction / dist
            
            # Obtenir la perturbation Perlin à la position actuelle
            px, py = int(np.clip(current[0], 0, self.width - 1)), int(np.clip(current[1], 0, self.height - 1))
            perlin_val = perlin_grid[py, px]
            
            # Angle de perturbation (radians)
            perlin_angle = perlin_val * np.pi / 2  # ±90 degrés max
            
            # Appliquer la rotation au vecteur direction
            cos_a = np.cos(perlin_angle)
            sin_a = np.sin(perlin_angle)
            rotated = np.array([
                direction[0] * cos_a - direction[1] * sin_a,
                direction[0] * sin_a + direction[1] * cos_a
            ])
            
            # Avancer dans la direction perturbée
            next_pos = current + rotated * step_size
            
            # Vérifier les limites
            nx, ny = int(next_pos[0]), int(next_pos[1])
            if not (0 <= nx < self.width and 0 <= ny < self.height):
                break
            
            # Vérifier l'altitude
            if self.map[ny, nx] <= Map.SEA_LEVEL or self.map[ny, nx] > 200:
                # Essayer de contourner
                for angle_offset in [0.3, -0.3, 0.6, -0.6]:
                    test_angle = perlin_angle + angle_offset
                    cos_a = np.cos(test_angle)
                    sin_a = np.sin(test_angle)
                    test_dir = np.array([
                        direction[0] * cos_a - direction[1] * sin_a,
                        direction[0] * sin_a + direction[1] * cos_a
                    ])
                    test_pos = current + test_dir * step_size
                    tx, ty = int(test_pos[0]), int(test_pos[1])
                    if (0 <= tx < self.width and 0 <= ty < self.height and
                        self.map[ty, tx] > Map.SEA_LEVEL and self.map[ty, tx] <= 200):
                        next_pos = test_pos
                        break
                else:
                    break
            
            current = next_pos
            path.append(tuple(current.astype(int)))
        
        # Ajouter le point final
        path.append(tuple(goal.astype(int)))
        
        # Éliminer les doublons
        path = list(dict.fromkeys(path))
        return path

    def generate(self, seed: int = 0, erosionPasses: int = 200):
        random.seed(seed)
        np.random.seed(seed)
        starttime = time.time()
        
        # ========== Génération du terrain (vectorisé) ==========
        self.map, self.seed = self.genTerrain(octaves=8)
        time_terrain = time.time() - starttime
        print(f"⏱ Terrain généré en {time_terrain:.2f}s")
        starttime = time.time()
        
        # === Variations avec Perlin (vectorisé) ===
        self.map = self.genVariations(octaves=6, persistence=0.5, scale=0.01)
        print(f"⏱ Variations générées en {time.time() - starttime:.2f}s")
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
            if river is not None:
                self.rivers.append(river)
        
        print(f"⏱ Rivières générées en {time.time() - starttime:.2f}s")
        starttime = time.time()
        
        # ========== Placement des villes ==========
        nbCities = (self.width * self.height) // 10000
        nbCities = int(nbCities * random.uniform(0.8, 1.2))
        self.placeCities(nbCities)
        print(f"⏱ {nbCities} villes placées en {time.time() - starttime:.2f}s")
        starttime = time.time()

        # ========== Génération des routes ==========
        self.generate_routes_between_cities()
        print(f"⏱ {len(self.routes)} routes générées en {time.time() - starttime:.2f}s")
        starttime = time.time()
        
        # ========== Calculer ressource trade basée sur les routes ==========
        starttime = time.time()
        for city in self.cities.cities:
            city.calculate_trade_from_routes(self.routes, self.cities.cities)
        print(f"⏱ Ressource trade calculée en {time.time() - starttime:.2f}s")

        # ========== Génération des régions et pays ==========
        starttime = time.time()
        self.generate_regions()
        print(f"⏱ Régions générées en {time.time() - starttime:.2f}s")
        
        starttime = time.time()
        self.generate_countries()
        print(f"⏱ Pays générés en {time.time() - starttime:.2f}s")


        # ========== Génération du climat et des biomes ==========
        starttime = time.time()
        self.genClimate()
        print(f"⏱ Climat généré en {time.time() - starttime:.2f}s")
        starttime = time.time()
        
        self.genBiomes()
        print(f"⏱ Biomes générés en {time.time() - starttime:.2f}s")
        starttime = time.time()
        
        # ========== Générer religions et cultures avec propagation organique ==========
        self.generate_religions_and_cultures_new()
        print(f"⏱ Religions et cultures générées en {time.time() - starttime:.2f}s")

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

        # Appliquer la variation
        self.map = (self.map * ((variation + 3) / 2)).astype(np.float32)
        
        # Créer le masque circulaire (vectorisé)
        cx, cy = self.width / 2, self.height / 2
        y_coords, x_coords = np.mgrid[0:self.height, 0:self.width]
        
        dist = np.sqrt((x_coords - cx) ** 2 + (y_coords - cy) ** 2)
        maxDist = np.sqrt((self.width / 2) ** 2 + (self.height / 2) ** 2) * 1.5
        factor = 1 - (dist / maxDist)
        
        # Appliquer le masque
        self.map = (self.map * factor)
        self.map = np.clip(self.map, 0, 255).astype(np.uint8)
        # Lissage pour supprimer les pics isolés
        self.map = median_filter(self.map, size=3)
        return self.map

    def genClimate(self, octaves: int = 6, persistence: float = 0.6, scale: float = 0.008):
        """Génère une carte de climat avec Perlin noise (0-255).
        
        Climat: 0=Polaire/Glacial, 85=Tempéré froid, 127=Tempéré, 170=Tropical, 255=Désertique
        """
        noise = PerlinNoise(self.seed ^ 0xDEADBEEF)  # Seed différent pour le climat
        
        # Générer le bruit de climat
        climate_noise = noise.octave_noise_grid(self.width, self.height, octaves, persistence, scale)
        
        # Normaliser entre 0 et 255
        self.climate = ((climate_noise + 1) / 2 * 255).astype(np.uint8)
        
        return self.climate
    
    def genBiomes(self):
        """Génère une carte de biomes basée sur altitude + climat.
        
        Biomes (basés sur NOAA classification):
        0 = Eau (altitude <= 127)
        1 = Plage/Côte (altitude 127-135)
        2 = Plaine tempérée (altitude 135-160, climat tempéré)
        3 = Forêt tempérée (altitude 135-160, climat tempéré+humide)
        4 = Prairie (altitude 135-160, climat sec)
        5 = Désert (altitude 135-180, climat désertique)
        6 = Collines (altitude 160-180)
        7 = Montagne (altitude 180-200)
        8 = Pics/Neige (altitude 200+)
        9 = Jungle (altitude 120-180, climat tropical)
        10 = Marécage (altitude 120-140, climate humide)
        """
        self.biomes = np.zeros((self.height, self.width), dtype=np.uint8)
        
        for y in range(self.height):
            for x in range(self.width):
                altitude = self.map[y, x]
                climate = self.climate[y, x]
                
                # Eau
                if altitude <= self.SEA_LEVEL:
                    self.biomes[y, x] = 0
                # Plage/Côte
                elif altitude <= 135:
                    self.biomes[y, x] = 1
                # Climat tropical (170-255) -> Jungle
                elif 135 <= altitude <= 180 and climate >= 170:
                    self.biomes[y, x] = 9
                # Climat très humide + altitude basse -> Marécage
                elif 120 <= altitude <= 140 and climate >= 120 and climate <= 170:
                    self.biomes[y, x] = 10
                # Altitude basse-moyenne (135-160)
                elif 135 <= altitude <= 160:
                    if climate >= 200:  # Désertique
                        self.biomes[y, x] = 5
                    elif climate >= 160:  # Tropical/Humide
                        self.biomes[y, x] = 3  # Forêt
                    elif climate >= 80:  # Tempéré
                        if climate >= 120:
                            self.biomes[y, x] = 3  # Forêt tempérée
                        else:
                            self.biomes[y, x] = 2  # Plaine
                    else:  # Froid
                        self.biomes[y, x] = 2  # Prairie froide
                # Altitude moyenne (160-180) -> Collines
                elif 160 <= altitude <= 180:
                    if climate >= 200:  # Très chaud
                        self.biomes[y, x] = 5  # Désert montagneux
                    else:
                        self.biomes[y, x] = 6  # Collines
                # Altitude haute (180-200) -> Montagne
                elif 180 <= altitude <= 200:
                    self.biomes[y, x] = 7
                # Altitude très haute (200+) -> Pics/Neige
                else:
                    self.biomes[y, x] = 8
        
        return self.biomes

    def generate_religions_and_cultures(self):
        """Génère les cartes de religions et cultures basées sur pays + diffusion."""
        from city import ProcNameGenerator
        
        if not hasattr(self, 'regions') or not self.regions or not hasattr(self, 'region_to_country'):
            return
        
        # Créer des mappages: country_id -> religion/culture name
        country_religions = {}
        country_cultures = {}
        
        # Assigner une religion et culture unique à chaque pays
        for country_id in self.countries.countries.keys():
            country_obj = self.countries.countries[country_id]
            country_religions[country_id] = country_obj.religion
            country_cultures[country_id] = country_obj.culture
        
        # Remplir les cartes de religions et cultures (par région, propagation depuis pays)
        try:
            from skimage.draw import polygon as ski_polygon
            
            # Tracking des noms utilisés pour éviter les doublons
            used_religions = set()
            used_cultures = set()
            
            # D'abord, remplir par région Voronoi basé sur le pays
            for region_id, region in enumerate(self.regions):
                if hasattr(region, 'vertices') and region.vertices and len(region.vertices) >= 3:
                    # Trouver quel pays contrôle cette région
                    country_id = self.region_to_country.get(region_id, -1)
                    
                    # Déterminer religion/culture
                    if country_id >= 0 and country_id in country_religions:
                        religion_name = country_religions[country_id]
                        culture_name = country_cultures[country_id]
                        
                        # IMPORTANT: Vérifier aussi les doublons pour les pays
                        # Si plusieurs régions du même pays, on veut des noms différents par région
                        counter = 0
                        while religion_name in used_religions and counter < 50:
                            counter += 1
                            religion_name = ProcNameGenerator.generate_religion_name(int(self.seed ^ region_id ^ (counter * 12345)))
                        
                        counter = 0
                        while culture_name in used_cultures and counter < 100:
                            counter += 1
                            culture_name = ProcNameGenerator.generate_culture_name(int(self.seed ^ (region_id * 999) ^ (counter * 54321)))
                    else:
                        # Fallback: générer unique pour la région
                        # Générer religion avec garantie d'unicité
                        religion_name = ProcNameGenerator.generate_religion_name(int(self.seed ^ region_id))
                        counter = 0
                        while religion_name in used_religions and counter < 50:
                            # Si doublon, régénérer avec seed modifié (multiplicateur plus agressif)
                            counter += 1
                            religion_name = ProcNameGenerator.generate_religion_name(int(self.seed ^ region_id ^ (counter * 12345)))
                        
                        # Générer culture avec garantie d'unicité (plus de tentatives car 50% aléatoire)
                        culture_name = ProcNameGenerator.generate_culture_name(int(self.seed ^ (region_id * 999)))
                        counter = 0
                        while culture_name in used_cultures and counter < 100:
                            # Si doublon, régénérer avec seed modifié (multiplicateur très agressif pour 50% aléa)
                            counter += 1
                            culture_name = ProcNameGenerator.generate_culture_name(int(self.seed ^ (region_id * 999) ^ (counter * 54321)))
                    
                    # Stocker les noms et les marquer comme utilisés
                    self.religion_names[region_id] = religion_name
                    self.culture_names[region_id] = culture_name
                    used_religions.add(religion_name)
                    used_cultures.add(culture_name)
                    
                    # Remplir les pixels de la région
                    vertices = region.vertices
                    rr, cc = ski_polygon([v[1] for v in vertices], 
                                        [v[0] for v in vertices], 
                                        shape=(self.height, self.width))
                    
                    for r, c in zip(rr, cc):
                        if 0 <= r < self.height and 0 <= c < self.width:
                            self.religions[r, c] = region_id
                            self.cultures[r, c] = region_id
            
            # Diffusion légère: influence des régions voisines pour "mélange" aux frontières
            self._diffuse_religions_and_cultures()
            
        except Exception as e:
            pass
    
    def _diffuse_religions_and_cultures(self, iterations: int = 2):
        """Applique une légère diffusion pour créer des transitions organiques."""
        import scipy.ndimage as ndimage
        
        try:
            # Appliquer un léger flou pour créer des transitions douces aux frontières
            for _ in range(iterations):
                # Léger filtrage médian pour lisser les transitions
                self.religions = ndimage.median_filter(self.religions, size=3)
                self.cultures = ndimage.median_filter(self.cultures, size=3)
        except:
            pass  # Si scipy échoue, on continue sans diffusion

    def generate_religions_and_cultures_new(self):
        """Système complet de propagation religieuse avec historique et traits culturels."""
        from religion_system import ReligionSystem
        
        try:
            # Créer système religieux
            religion_sys = ReligionSystem(self.seed, self)
            
            # Générer religions fondamentales dans villes majeures
            religion_sys.generate_foundational_religions()
            
            # Propager religions depuis leurs villes d'origine
            religion_sys.propagate_religions()
            
            # Générer cultures par région
            religion_sys.generate_culture_from_regions()
            
            # Propager cultures depuis leurs villes d'origine
            religion_sys.propagate_cultures()
            
            # Appliquer diffusion culturelle
            religion_sys.apply_cultural_diffusion()
            
            # Stocker les religions et cultures pour utilisation dans UI
            self.religion_system = religion_sys
            
            # Créer les cartes spatiales pour visualisation
            self._create_religion_culture_maps_from_system(religion_sys)
            
            # Stocker les dictionnaires de religions/cultures fondamentales pour affichage UI (propre)
            self.religion_names_foundational = {}
            self.culture_names_major = {}
            
            # Mapper religions fondamentales
            for religion_id, religion in religion_sys.foundational_religions.items():
                # Trouver la première région avec cette religion
                for region_id, region_religion in enumerate(self.region_to_country.items() if hasattr(self, 'region_to_country') else []):
                    self.religion_names_foundational[religion_id] = religion.name
                    break
            
            # Mapper cultures majeures
            for culture_id, culture in religion_sys.major_cultures.items():
                self.culture_names_major[culture_id] = culture.name
            
        except Exception as e:
            # Fallback vers l'ancienne méthode
            self.generate_religions_and_cultures()
    
    def _create_religion_culture_maps_from_system(self, religion_sys):
        """Crée les cartes spatiales de religions/cultures depuis le ReligionSystem."""
        from skimage.draw import polygon as ski_polygon
        
        # Initialiser les cartes si nécessaire
        if not hasattr(self, 'religions') or self.religions is None:
            self.religions = np.zeros((self.height, self.width), dtype=np.uint32)
        if not hasattr(self, 'cultures') or self.cultures is None:
            self.cultures = np.zeros((self.height, self.width), dtype=np.uint32)
        if not hasattr(self, 'religion_names'):
            self.religion_names = {}
        if not hasattr(self, 'culture_names'):
            self.culture_names = {}
        
        # Remplir les cartes spatiales depuis les régions
        try:
            # Mapper religions aux régions Voronoi
            region_religions = {}  # region_id -> religion_id
            region_cultures = {}   # region_id -> culture_id
            
            # Assigner religions aux régions basé sur city.religion (propagation)
            for region_id, region in enumerate(self.regions):
                if hasattr(region, 'vertices') and region.vertices and len(region.vertices) >= 3:
                    # Trouver le centroid de la région
                    vertices = region.vertices
                    centroid_x = sum(v[0] for v in vertices) / len(vertices)
                    centroid_y = sum(v[1] for v in vertices) / len(vertices)
                    centroid = (centroid_x, centroid_y)
                    
                    # Trouver la ville la plus proche du centroid
                    closest_city = None
                    min_dist = float('inf')
                    
                    for city in self.cities.cities:
                        dist = ((city.position[0] - centroid[0])**2 + (city.position[1] - centroid[1])**2)**0.5
                        if dist < min_dist:
                            min_dist = dist
                            closest_city = city
                    
                    # Assigner la religion de la ville la plus proche
                    if closest_city and hasattr(closest_city, 'religion') and closest_city.religion:
                        religion_name = closest_city.religion
                        religion_id = hash(religion_name) % (2**31)
                        region_religions[region_id] = religion_id
                        
                        if region_id not in self.religion_names:
                            self.religion_names[region_id] = religion_name
            
            # Cultures: utiliser la propagation par régions voisines du ReligionSystem
            if hasattr(religion_sys, 'region_to_culture'):
                for region_id, culture_id_source in religion_sys.region_to_culture.items():
                    culture = religion_sys.cultures.get(culture_id_source)
                    if culture:
                        # Utiliser directement l'ID de culture de ReligionSystem
                        region_cultures[region_id] = culture_id_source
                        
                        if region_id not in self.culture_names:
                            self.culture_names[region_id] = culture.name
            
            # Remplir les pixels des régions Voronoi
            for region_id, region in enumerate(self.regions):
                if hasattr(region, 'vertices') and region.vertices and len(region.vertices) >= 3:
                    vertices = region.vertices
                    try:
                        rr, cc = ski_polygon([v[1] for v in vertices], 
                                            [v[0] for v in vertices], 
                                            shape=(self.height, self.width))
                        
                        religion_id = region_religions.get(region_id, -1)  # -1 si pas trouvé
                        culture_id = region_cultures.get(region_id, -1)    # -1 si pas trouvé
                        
                        for r, c in zip(rr, cc):
                            if 0 <= r < self.height and 0 <= c < self.width:
                                if religion_id >= 0:
                                    self.religions[r, c] = religion_id
                                if culture_id >= 0:
                                    self.cultures[r, c] = culture_id
                    except:
                        pass
            
            # Appliquer diffusion légère
            self._diffuse_religions_and_cultures(iterations=2)
            
        except Exception as e:
            pass

    def genRiver(self, start: tuple[int, int], seed: int = 0, width: int = 1):
        """Génération de rivière (optimisée)."""
        river_path = [start]
        current = start
        visited = {start}
    # Ne pas réinitialiser le seed ici pour éviter de casser la randomisation globale
        
        if self.map[current[1], current[0]] <= Map.SEA_LEVEL:
            return None
        
    # Limite plus stricte sur le nombre d'itérations pour accélérer
        max_iterations = (self.width + self.height) * 1000000
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
            
            # if current_height >= last_height:
            #     stuck_counter += 1
            #     if stuck_counter > 10000:
            #         break
            # else:
            #     stuck_counter = 0
            
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
            score_value = int(score_map[selected_position[1], selected_position[0]])
            altitude = int(self.map[selected_position[1], selected_position[0]])
            climate = int(self.climate[selected_position[1], selected_position[0]]) if self.climate is not None else 127
            self.cities.generateCity(selected_position, score=score_value, seed=random.randint(0, 2**31), 
                                    altitude=altitude, climate=climate)
            
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

    def generate_countries(self):
        """Génère les pays par propagation d'influence depuis les capitales.
        
        Règles:
        1. Chaque capitale engendre un pays avec influence = score de la capitale
        2. L'influence se propage région par région voisine
        3. L'influence décline de 5-15% (aléatoire) entre régions
        4. La propagation s'arrête à influence ≤ 0
        5. Si rencontre un autre pays: compare les influences
           - Si propagation > pays actuel: région conquise
           - Sinon: propagation s'arrête
        """
        if not hasattr(self.cities, 'cities') or len(self.cities.cities) < 2:
            return
        
        start_time = time.time()
        
        # ÉTAPE 1: Initialiser les capitales
        # Sélectionner les villes les plus importantes comme capitales
        cities_sorted = sorted(self.cities.cities, key=lambda c: c.score, reverse=True)
        
        # Nombre de pays = fonction du score total (plus il y a de bonnes villes, plus de pays)
        total_score = sum(c.score for c in self.cities.cities)
        num_countries = max(2, min(len(self.cities.cities), int(len(self.cities.cities) * 0.4)))  # 40% des villes sont capitales
        
        # Sélectionner les capitales (les N meilleures villes)
        capital_cities = cities_sorted[:num_countries]
        
        # ÉTAPE 2: Créer pays et assigner régions par propagation d'influence
        region_to_country = {}  # region_id -> country_id
        region_influence = {}    # region_id -> influence_value
        
        for country_id, capital_city in enumerate(capital_cities):
            # Créer le pays
            country_seed = self.seed ^ (country_id * 12345)
            self.countries.create_country(country_id, seed=country_seed)
            country_obj = self.countries.get_country(country_id)
            if country_obj:
                country_obj.set_capital(capital_city)
                capital_city.country = country_id
                
                # Trouver la région de la capitale
                closest_region = self._find_closest_region_influence(capital_city.position)
                if closest_region is not None and closest_region >= 0 and closest_region < len(self.regions):
                    # Initialiser la propagation d'influence
                    region_to_country[closest_region] = country_id
                    region_influence[closest_region] = capital_city.score
                    country_obj.add_region(closest_region)
        
        # ÉTAPE 3: Propagation d'influence (BFS avec influence décroissante)
        # Créer un mapping region -> capital pour tracker les capitales conquises
        region_to_capital = {}  # region_id -> capital_city
        for country_id, capital in enumerate(capital_cities):
            closest_region = self._find_closest_region_influence(capital.position)
            if closest_region is not None:
                region_to_capital[closest_region] = capital
        
        self._propagate_influence(region_to_country, region_influence, capital_cities, region_to_capital)
        
        # ÉTAPE 4: Assigner les villes aux pays
        city_to_country = {}
        for city in self.cities.cities:
            if city in capital_cities:
                # Capitale déjà assignée
                country_id = capital_cities.index(city)
                city.country = country_id
            else:
                # Trouver sa région et son pays
                closest_region = self._find_closest_region_influence(city.position)
                if closest_region in region_to_country:
                    country_id = region_to_country[closest_region]
                    city.country = country_id
                else:
                    # Assigner au pays le plus proche
                    closest_country = self._find_closest_country(city.position, region_to_country)
                    country_id = closest_country
                    city.country = country_id
            
            if country_id not in city_to_country:
                city_to_country[country_id] = []
            city_to_country[country_id].append(city)
            
            # Ajouter au pays
            country_obj = self.countries.get_country(country_id)
            if country_obj:
                country_obj.add_city(city)
        
        # ÉTAPE 5: Générer les données complètes des pays
        for country_obj in self.countries.countries.values():
            country_obj.generate_full_data()
        
        self.city_to_country = city_to_country
        self.region_to_country = region_to_country
        
        # ÉTAPE 6: Créer zones diplomatiques
        self._create_diplomatic_zones(region_to_country)
        
        elapsed = time.time() - start_time

    def _kmeans_cluster_regions(self, region_centers, num_clusters, max_iters=10):
        """K-means optimisé pour regrouper les régions Voronoi en pays."""
        num_regions = len(region_centers)
        
        # Initialiser les centroïdes aléatoirement parmi les régions
        np.random.seed(self.seed)
        centroid_indices = np.random.choice(num_regions, num_clusters, replace=False)
        centroids = region_centers[centroid_indices].copy()
        
        assignments = np.zeros(num_regions, dtype=np.int32)
        
        for iteration in range(max_iters):
            # Assigner chaque région au centroïde le plus proche (vectorisé)
            distances = np.linalg.norm(region_centers[:, np.newaxis, :] - centroids[np.newaxis, :, :], axis=2)
            new_assignments = np.argmin(distances, axis=1)
            
            # Vérifier convergence
            if np.array_equal(assignments, new_assignments):
                break
            
            assignments = new_assignments
            
            # Recalculer centroïdes (vectorisé)
            for cluster_id in range(num_clusters):
                mask = assignments == cluster_id
                if np.any(mask):
                    centroids[cluster_id] = np.mean(region_centers[mask], axis=0)
        
        # Retourner dict pour compatibilité
        return {region_id: int(assignments[region_id]) for region_id in range(num_regions)}
    
    def _find_closest_region(self, position):
        """Trouve la région Voronoi la plus proche d'une position (avec cache)."""
        if not self.regions:
            return 0
        
        # Utiliser cache si disponible
        if not hasattr(self, '_closest_region_cache'):
            self._closest_region_cache = {}
            # Pré-calculer les origines
            if hasattr(self, '_region_origins_array'):
                pass
            else:
                self._region_origins_array = np.array([r.origin if r.origin else (0, 0) for r in self.regions])
        
        pos_key = tuple(position)
        if pos_key in self._closest_region_cache:
            return self._closest_region_cache[pos_key]
        
        # Calcul vectorisé sur un subset de régions (pas toutes)
        position_arr = np.array(position)
        distances = np.linalg.norm(self._region_origins_array - position_arr, axis=1)
        closest = int(np.argmin(distances))
        
        self._closest_region_cache[pos_key] = closest
        return closest
    
    def _find_closest_region_influence(self, position):
        """Trouve la région Voronoi la plus proche d'une position."""
        if not self.regions:
            return None
        
        position_arr = np.array(position)
        min_dist = float('inf')
        closest = None
        
        for region_id, region in enumerate(self.regions):
            if region.origin:
                dist = np.linalg.norm(position_arr - np.array(region.origin))
                if dist < min_dist:
                    min_dist = dist
                    closest = region_id
        
        return closest
    
    def _propagate_influence(self, region_to_country, region_influence, capital_cities, region_to_capital):
        """Propage l'influence des capitales dans les régions voisines.
        
        Règles:
        - L'influence se propage région par région voisine
        - L'influence décline de 5-15% aléatoirement
        - Si rencontre un autre pays: compare les influences
        - Arrête si influence ≤ 0
        - Si une région avec capitale est conquise: la capitale perd son statut
        """
        from collections import deque
        
        # BFS avec priorité d'influence
        queue = deque()
        
        # Initialiser queue avec les capitales
        for country_id, capital in enumerate(capital_cities):
            closest_region = self._find_closest_region_influence(capital.position)
            if closest_region is not None and closest_region in region_to_country:
                queue.append((closest_region, country_id, capital.score))
        
        # Déclin d'influence aléatoire (5-15% par région)
        np.random.seed(self.seed)
        
        while queue:
            current_region, country_id, current_influence = queue.popleft()
            
            # Arrêter si influence trop faible
            if current_influence <= 0:
                continue
            
            # Vérifier les régions voisines
            if current_region >= len(self.regions):
                continue
            
            region_obj = self.regions[current_region]
            if not region_obj.neighbors:
                continue
            
            for neighbor_region in region_obj.neighbors:
                if neighbor_region < 0 or neighbor_region >= len(self.regions):
                    continue
                
                # Calculer l'influence propagée
                decline_rate = np.random.uniform(0.05, 0.15)  # 5-15% de déclin
                next_influence = current_influence * (1 - decline_rate)
                
                # Vérifier si la région a déjà un pays
                if neighbor_region in region_to_country:
                    neighbor_country = region_to_country[neighbor_region]
                    neighbor_influence = region_influence.get(neighbor_region, 0)
                    
                    # Comparer les influences
                    if next_influence > neighbor_influence:
                        # Conquête!
                        region_to_country[neighbor_region] = country_id
                        region_influence[neighbor_region] = next_influence
                        
                        # Ajouter à la queue pour continuer la propagation
                        queue.append((neighbor_region, country_id, next_influence))
                        
                        # Mettre à jour les villes dans cette région (y compris les capitales!)
                        self._update_cities_in_region(neighbor_region, country_id)
                        
                        # Si la région conquise a une capitale: retirer son statut
                        if neighbor_region in region_to_capital:
                            fallen_capital = region_to_capital[neighbor_region]
                            if fallen_capital.is_capital:
                                # Retirer le statut de capitale
                                fallen_capital.is_capital = False
                                old_country = self.countries.get_country(neighbor_country)
                                if old_country:
                                    old_country.capital = None
                        
                        # Mettre à jour le pays
                        old_country = self.countries.get_country(neighbor_country)
                        if old_country and neighbor_region in old_country.regions:
                            old_country.regions.remove(neighbor_region)
                        
                        new_country = self.countries.get_country(country_id)
                        if new_country:
                            new_country.add_region(neighbor_region)
                    # Sinon propagation s'arrête
                else:
                    # Région libre: l'annexer
                    region_to_country[neighbor_region] = country_id
                    region_influence[neighbor_region] = next_influence
                    
                    # Ajouter à la queue
                    queue.append((neighbor_region, country_id, next_influence))
                    
                    # Mettre à jour les villes dans cette région
                    self._update_cities_in_region(neighbor_region, country_id)
                    
                    # Si la région annexée a une capitale: retirer son statut
                    if neighbor_region in region_to_capital:
                        fallen_capital = region_to_capital[neighbor_region]
                        if fallen_capital.is_capital:
                            # Retirer le statut de capitale
                            fallen_capital.is_capital = False
                            # La ville passe au pays conquérant mais perd son statut de capitale
                    
                    # Ajouter au pays
                    country_obj = self.countries.get_country(country_id)
                    if country_obj:
                        country_obj.add_region(neighbor_region)
    
    def _update_cities_in_region(self, region_id, new_country_id):
        """Met à jour le pays de toutes les villes dans une région."""
        if not hasattr(self, 'regions') or region_id >= len(self.regions):
            return
        
        region = self.regions[region_id]
        if not hasattr(region, 'vertices') or not region.vertices:
            return
        
        new_country = self.countries.get_country(new_country_id)
        old_country = None
        
        # Chercher toutes les villes dans cette région
        for city in self.cities.cities:
            # Trouver la région la plus proche de la ville
            closest_region = self._find_closest_region_influence(city.position)
            if closest_region == region_id:
                # Retirer la ville de l'ancien pays
                if city.country is not None:
                    old_country = self.countries.get_country(city.country)
                    if old_country and city in old_country.cities:
                        old_country.cities.remove(city)
                
                # Ajouter la ville au nouveau pays
                city.country = new_country_id
                if new_country and city not in new_country.cities:
                    new_country.cities.append(city)
        
        # Recalculer les stats des pays affectés
        if new_country:
            new_country.generate_full_data()
        if old_country:
            old_country.generate_full_data()
    
    def _find_closest_country(self, position, region_to_country):
        """Trouve le pays le plus proche d'une position."""
        closest_region = self._find_closest_region_influence(position)
        if closest_region is not None and closest_region in region_to_country:
            return region_to_country[closest_region]
        
        # Si aucune région trouvée, chercher parmi les régions assignées
        min_dist = float('inf')
        closest_country = 0
        
        for region_id, country_id in region_to_country.items():
            if region_id < len(self.regions) and self.regions[region_id].origin:
                dist = np.linalg.norm(np.array(position) - np.array(self.regions[region_id].origin))
                if dist < min_dist:
                    min_dist = dist
                    closest_country = country_id
        
        return closest_country
    
    def _adjust_borders_by_geography(self, countries):
        """Ajuste les frontières en fonction de la géographie (vectorisé).
        
        OPTIMISATION: Au lieu de boucler sur CHAQUE pixel (160 000 itérations),
        on traite uniquement les frontières et les zones critiques.
        """
        # Créer un mapping rapide region_id -> country_id
        region_to_country_fast = np.zeros(len(self.regions), dtype=np.int32)
        for region_id, country_id in countries.items():
            if region_id < len(self.regions):
                region_to_country_fast[region_id] = country_id
        
        # Identifier rapidement les pixels critiques (montagne/eau)
        high_altitude_mask = self.map > 200
        low_altitude_mask = self.map <= self.SEA_LEVEL
        
        # Traiter les frontières critiques (frontières entre régions + géographie)
        for region_id in range(len(self.regions)):
            if not self.regions[region_id].neighbors:
                continue
            
            neighbors = self.regions[region_id].neighbors
            current_country = region_to_country_fast[region_id]
            
            # Vérifier chaque voisin
            for neighbor_id in neighbors:
                if neighbor_id < len(self.regions):
                    neighbor_country = region_to_country_fast[neighbor_id]
                    
                    # Si pays différents, cette frontière est critique
                    # La géographie (rivières, montagnes) sera source de conflit
                    if current_country != neighbor_country:
                        # Marquer cette frontière (pas besoin de modifier, juste noter)
                        pass
    
    def _smooth_and_clean_borders(self, countries):
        """Lisse les frontières et supprime les petites enclaves (optimisé)."""
        cleaned = dict(countries)
        
        # Compter les régions par pays en une seule passe (pas de dictionnaire complexe)
        region_counts = {}
        for region_id, country_id in cleaned.items():
            region_counts[country_id] = region_counts.get(country_id, 0) + 1
        
        # Fusionner régions isolées avec le pays voisin le plus grand
        for region_id, country_id in list(cleaned.items()):
            # Vérifier si région isolée
            if region_counts.get(country_id, 0) == 1 and region_id < len(self.regions) and self.regions[region_id].neighbors:
                neighbor_regions = self.regions[region_id].neighbors
                
                # Compter rapidement les pays voisins
                neighbor_country_counts = {}
                for nr in neighbor_regions:
                    if nr != region_id and nr in cleaned:
                        nc = cleaned[nr]
                        if nc != country_id:
                            neighbor_country_counts[nc] = neighbor_country_counts.get(nc, 0) + 1
                
                if neighbor_country_counts:
                    # Attacher au pays voisin le plus fréquent
                    most_common_neighbor = max(neighbor_country_counts.items(), key=lambda x: x[1])[0]
                    
                    # Mise à jour rapide
                    cleaned[region_id] = most_common_neighbor
                    region_counts[country_id] = region_counts.get(country_id, 1) - 1
                    region_counts[most_common_neighbor] = region_counts.get(most_common_neighbor, 0) + 1
                    
                    # Mettre à jour les pays
                    old_country_obj = self.countries.get_country(country_id)
                    if old_country_obj and region_id in old_country_obj.regions:
                        old_country_obj.regions.remove(region_id)
                    
                    new_country_obj = self.countries.get_country(most_common_neighbor)
                    if new_country_obj:
                        new_country_obj.add_region(region_id)
        
        return cleaned
    
    def _create_diplomatic_zones(self, region_to_country):
        """Crée des zones tampons/diplomatiques entre pays (optimisé)."""
        # Utiliser un set pour éviter les doublons
        self.border_regions = set()
        
        # Créer un mapping region_id -> country_id pour accès rapide
        self.region_to_country = region_to_country.copy() if isinstance(region_to_country, dict) else {}
        
        # Pré-convertir en array pour accès O(1)
        region_countries_array = np.full(len(self.regions), -1, dtype=np.int32)
        for region_id, country_id in region_to_country.items():
            if region_id < len(self.regions):
                region_countries_array[region_id] = country_id
        
        # Identifier rapidement les frontières
        for region_id in range(len(self.regions)):
            country_id = region_countries_array[region_id]
            if country_id == -1 or not self.regions[region_id].neighbors:
                continue
            
            # Vérifier chaque voisin
            for neighbor_id in self.regions[region_id].neighbors:
                if neighbor_id < len(self.regions):
                    neighbor_country = region_countries_array[neighbor_id]
                    if neighbor_country != country_id and neighbor_country != -1:
                        self.border_regions.add(region_id)
                        self.border_regions.add(neighbor_id)
                        break  # Pas besoin de vérifier autres voisins
    
    def get_country_color_for_region(self, region_id):
        """Retourne la couleur du pays pour une région donnée."""
        if not hasattr(self, 'region_to_country'):
            return (150, 150, 150)  # Gris par défaut
        
        country_id = self.region_to_country.get(region_id, -1)
        if country_id >= 0:
            country_obj = self.countries.get_country(country_id)
            if country_obj:
                return country_obj.color
        
        return (150, 150, 150)  # Gris par défaut