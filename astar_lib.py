from astar import AStar
import numpy as np

class GridAStar(AStar):
    def __init__(self, grid, cost_fn=None):
        self.grid = grid
        self.cost_fn = cost_fn
        self.height, self.width = grid.shape
        super().__init__()

    def neighbors(self, node):
        x, y = node
        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1), (-1,-1), (1,1), (-1,1), (1,-1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < self.width and 0 <= ny < self.height:
                yield (nx, ny)

    def cost(self, current, neighbor):
        # Distance de base (1 pour orthogonal, sqrt(2) pour diagonale)
        dx = abs(current[0] - neighbor[0])
        dy = abs(current[1] - neighbor[1])
        base = 1.4142 if dx and dy else 1
        if self.cost_fn:
            return base + self.cost_fn(neighbor)
        return base


    def heuristic(self, node, goal):
        return np.linalg.norm(np.array(node) - np.array(goal))

    def distance_between(self, n1, n2):
        # Utilisé par la lib astar pour le coût entre deux voisins
        dx = abs(n1[0] - n2[0])
        dy = abs(n1[1] - n2[1])
        base = 1.4142 if dx and dy else 1
        if self.cost_fn:
            return base + self.cost_fn(n2)
        return base

    def heuristic_cost_estimate(self, n1, n2):
        # Utilisé par la lib astar pour l'estimation heuristique
        return np.linalg.norm(np.array(n1) - np.array(n2))

def astar_lib(grid, start, goal, cost_fn=None):
    astar = GridAStar(grid, cost_fn)
    result = astar.astar(start, goal)
    if result is None:
        return None
    path = list(result)
    return path if path else None
