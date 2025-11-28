class Edge:
    def __init__(self, p1, p2):
        self.p1 = p1  # tuple(int, int)
        self.p2 = p2  # tuple(int, int)

class Cell:
    def __init__(self, id, edges=None, neighbors=None, vertices=None, origin=None):
        self.id = id
        self.edges = edges if edges is not None else []  # list of Edge
        self.neighbors = neighbors if neighbors is not None else []  # list of cell ids
        self.vertices = vertices if vertices is not None else []  # sommets du polygone
        self.area = self._compute_area() if self.vertices else 0
        self.origin = origin  # tuple(int, int) : centre de la cellule
        self.height = -1

    def _compute_area(self):
        # Calcul de l'aire d'un polygone (formule du shoelace)
        if len(self.vertices) < 3:
            return 0
        x, y = zip(*self.vertices)
        return 0.5 * abs(sum(x[i] * y[(i+1)%len(self.vertices)] - x[(i+1)%len(self.vertices)] * y[i] for i in range(len(self.vertices))))

class Voronoi:
    def __init__(self, points, width, height):
        self.cells = []  # list of Cell
        self.edges = []  # list of Edge
        self._generate(points, width, height)
        self._normalize_areas()

    def _normalize_areas(self):
        import math
        # Transformation non linéaire (racine carrée) pour étaler les valeurs
        areas = [cell.area for cell in self.cells]
        sqrt_areas = [math.sqrt(a) for a in areas]
        if not sqrt_areas:
            return
        min_area = min(sqrt_areas)
        max_area = max(sqrt_areas)
        for cell, sqrt_area in zip(self.cells, sqrt_areas):
            if max_area > min_area:
                cell.area_norm = (sqrt_area - min_area) / (max_area - min_area)
            else:
                cell.area_norm = 0

    def _generate(self, points, width, height):
        from scipy.spatial import Voronoi as SciVoronoi
        import numpy as np
        vor = SciVoronoi(points)
        # Build edges
        edge_map = {}
        for (p1, p2), (v1, v2) in zip(vor.ridge_points, vor.ridge_vertices):
            if v1 == -1 or v2 == -1:
                continue  # skip infinite edges
            pt1 = tuple(map(int, vor.vertices[v1]))
            pt2 = tuple(map(int, vor.vertices[v2]))
            edge = Edge(pt1, pt2)
            self.edges.append(edge)
            edge_map.setdefault(p1, []).append(edge)
            edge_map.setdefault(p2, []).append(edge)
        # Build cells
        # Première passe : construire la liste des indices valides et le mapping point_index -> cell_id
        valid_indices = []
        for i, region_index in enumerate(vor.point_region):
            region = vor.regions[region_index]
            if -1 in region or len(region) == 0:
                continue
            valid_indices.append(i)
        point_to_cellid = {i: idx for idx, i in enumerate(valid_indices)}

        # Deuxième passe : créer les cellules avec les bons neighbors
        for cell_idx, i in enumerate(valid_indices):
            region_index = vor.point_region[i]
            region = vor.regions[region_index]
            cell_edges = edge_map.get(i, [])
            # Find neighbors (uniquement ceux qui sont aussi valides)
            neighbors = set()
            for j, k in vor.ridge_points:
                if i == j and k in point_to_cellid:
                    neighbors.add(point_to_cellid[k])
                elif i == k and j in point_to_cellid:
                    neighbors.add(point_to_cellid[j])
            # Sommets du polygone de la cellule
            vertices = [tuple(map(int, vor.vertices[v])) for v in region]
            # Point d'origine (centre de la cellule)
            origin = tuple(map(int, points[i]))
            cell = Cell(id=cell_idx, edges=cell_edges, neighbors=list(neighbors), vertices=vertices, origin=origin)
            self.cells.append(cell)
