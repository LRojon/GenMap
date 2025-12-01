import heapq
import numpy as np

def heuristic(a, b):
    # Distance euclidienne
    return np.linalg.norm(np.array(a) - np.array(b))

def astar(grid, start, goal, cost_fn=None):
    """
    A* sur une grille 2D. grid : numpy array, start/goal : (x, y)
    cost_fn : fonction optionnelle pour coût supplémentaire (ex : relief)
    """
    h, w = grid.shape
    open_set = []
    heapq.heappush(open_set, (0 + heuristic(start, goal), 0, start, [start]))
    closed_set = set()
    while open_set:
        est_total, cost, current, path = heapq.heappop(open_set)
        if current == goal:
            return path
        if current in closed_set:
            continue
        closed_set.add(current)
        x, y = current
        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h:
                npos = (nx, ny)
                if npos in closed_set:
                    continue
                move_cost = 1  # coût de déplacement de base (orthogonal)
                if cost_fn:
                    move_cost += cost_fn(npos)
                heapq.heappush(open_set, (cost + move_cost + heuristic(npos, goal), cost + move_cost, npos, path + [npos]))
    return None
