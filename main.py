import os
from datetime import datetime
from colors import Colors
from voronoi import Voronoi, Cell, Edge
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
game_map = Map(width, height, seed)
elapsed += time.time() - startTime
print(f"Génération de la map en {time.time() - startTime:.2f}s avec le seed {seed}")
startTime = time.time()
    
# Initialisation de la police pour l'affichage du texte
pygame.font.init()
font = pygame.font.SysFont(None, 24)

running = True
mouse_value = None
mouse_pos = (0, 0)
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
            elif event.key == pygame.K_RETURN:
                # Régénération rapide du monde avec un nouveau seed
                seed = time.time_ns() % (2**32)
                game_map = Map(width, height, seed)
                print(f"Nouveau monde généré avec le seed {seed}")

    window.fill(Colors.getColor(255))

    # Récupérer la position du curseur
    mouse_pos = pygame.mouse.get_pos()
    mx, my = mouse_pos
    if 0 <= mx < width and 0 <= my < height:
        mouse_value = game_map.map[my][mx]
    else:
        mouse_value = None

    for y in range(height):
        for x in range(width):
            window.set_at((x, y), Colors.getColor(game_map.map[y][x]))
    

    for river in game_map.rivers:
        for i in range(len(river)):
            window.set_at(river[i], Colors.getColor(127))


    # Affichage du diagramme de Voronoi (régions)
    for edge in getattr(game_map, 'region_edges', []):
        pygame.draw.line(window, (0, 180, 255), edge.p1, edge.p2, 1)

    # Affichage des routes
    for route in game_map.routes:
        for pt in route:
            window.set_at(pt, (120, 72, 0))  # couleur marron pour route

    min_score = game_map.cities.get_min_score()
    max_score = game_map.cities.get_max_score()
    for city in game_map.cities.cities:
        # Echelle pondérée entre 1 et 5 pixels
        if max_score > min_score:
            norm = (city.score - min_score) / (max_score - min_score)
        else:
            norm = 0.5
        rayon = int(1 + 4 * norm)
        pygame.draw.circle(window, (255, 0, 0), city.position, rayon)

    # Affichage de la valeur de la case sous le curseur en haut à droite
    if mouse_value is not None:
        value_text = f"Case ({mx}, {my}) : {mouse_value}"
    else:
        value_text = "Hors de la carte"
    text_surface = font.render(value_text, True, (0, 0, 0))
    text_rect = text_surface.get_rect(topright=(width - 10, 10))
    window.blit(text_surface, text_rect)

    # for cell in world.cells:
    #     if len(cell.vertices) >= 3:
    #         pygame.draw.polygon(window, Colors.getColor(cell.height), cell.vertices)
        # for edge in cell.edges:
        #     pygame.draw.line(window, Colors.getColor(0), edge.p1, edge.p2, 1)
        # pygame.draw.circle(window, Colors.getColor(128), cell.origin, 2)

    pygame.display.flip()

pygame.quit()