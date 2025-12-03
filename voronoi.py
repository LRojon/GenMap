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
        from voronoi_utils import voronoi_finite_polygons_2d
        from shapely.geometry import Polygon, box as shapely_box
        vor = SciVoronoi(points)
        regions, vertices = voronoi_finite_polygons_2d(vor)
        rect = shapely_box(0, 0, width, height)
        # Build cells and edges
        for cell_idx, (region, pt) in enumerate(zip(regions, points)):
            polygon = vertices[region]
            if len(polygon) < 4:
                continue
            poly = Polygon(polygon).intersection(rect)
            if poly.is_empty or poly.geom_type != 'Polygon':
                continue
            # Sommets du polygone de la cellule
            verts = [tuple(map(int, p)) for p in poly.exterior.coords]
            # Edges
            cell_edges = []
            for i in range(len(verts)-1):
                edge = Edge(verts[i], verts[i+1])
                self.edges.append(edge)
                cell_edges.append(edge)
            # Point d'origine (centre de la cellule)
            origin = tuple(map(int, pt))
            cell = Cell(id=cell_idx, edges=cell_edges, neighbors=[], vertices=verts, origin=origin)
            self.cells.append(cell)
        
        # Calculer les voisins en fonction des arêtes partagées
        self._compute_neighbors()
    
    def _compute_neighbors(self):
        """Calcule les voisins des cellules Voronoi en fonction des vertices partagées."""
        # Deux cellules sont voisines si elles partagent au moins un vertex (arête)
        num_cells = len(self.cells)
        
        for i in range(num_cells):
            cell_i = self.cells[i]
            cell_i_vertices = set(cell_i.vertices)
            
            for j in range(i + 1, num_cells):
                cell_j = self.cells[j]
                cell_j_vertices = set(cell_j.vertices)
                
                # Vérifier si les deux cellules partagent au moins 2 vertices (une arête)
                shared_vertices = cell_i_vertices & cell_j_vertices
                if len(shared_vertices) >= 2:
                    # Cellules voisines
                    if j not in cell_i.neighbors:
                        cell_i.neighbors.append(j)
                    if i not in cell_j.neighbors:
                        cell_j.neighbors.append(i)
