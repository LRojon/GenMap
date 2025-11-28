import pygame
import cProfile
import pstats
from typing import Optional
import os
from datetime import datetime
from astar import AStar, find_path
from colors import Colors
from voronoi import Voronoi, Cell, Edge
import numpy as np
from skimage.draw import polygon
from map import Map
import time
import pygame
import sys

seed = sys.argv[1] if len(sys.argv) > 1 else None

pygame.init()
width, height = 400, 400
window = pygame.display.set_mode((width, height))
pygame.display.set_caption("Map")

startTime = time.time()
elapsed = 0.0
seed = int(seed) if seed is not None else time.time_ns() % (2**32)
map = Map(width, height, seed)
elapsed += time.time() - startTime
print(f"Génération de la map en {time.time() - startTime:.2f}s avec le seed {seed}")
startTime = time.time()
    
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_s:
                os.makedirs('screenshots', exist_ok=True)
                filename = datetime.now().strftime('screenshots/screenshot_%Y%m%d_%H%M%S.png')
                pygame.image.save(window, filename)
                print(f"Screenshot sauvegardé : {filename}")

    window.fill(Colors.getColor(0))

    for y in range(height):
        for x in range(width):
            window.set_at((x, y), Colors.getColor(map.map[y][x]))
    
    for river in map.rivers:
        for i in range(len(river)):
            window.set_at(river[i], Colors.getColor(127))
    
    for city in map.cities.cities:
        pygame.draw.circle(window, (255, 0, 0), city.position, 3)

    # for cell in world.cells:
    #     if len(cell.vertices) >= 3:
    #         pygame.draw.polygon(window, Colors.getColor(cell.height), cell.vertices)
        # for edge in cell.edges:
        #     pygame.draw.line(window, Colors.getColor(0), edge.p1, edge.p2, 1)
        # pygame.draw.circle(window, Colors.getColor(128), cell.origin, 2)

    pygame.display.flip()

pygame.quit()