import pygame
import sys
import random
import time
from noise import PerlinNoise

seed1 = int(sys.argv[1]) if len(sys.argv) > 1 else int(time.time())
seed2 = seed1 + 1 if seed1 is not None else None
seed3 = seed2 + 1 if seed2 is not None else None

pygame.init()
width, height = 400, 400


window = pygame.display.set_mode((width, height))
pygame.display.set_caption("Map")

noise1 = PerlinNoise(seed=seed1)
n1 = noise1.octave_noise_grid(width, height, 8, 0.5, 0.01)
c1 = (255, 128, 128)
noise2 = PerlinNoise(seed=seed2)
n2 = noise2.octave_noise_grid(width, height, 8, 0.5, 0.01)
c2 = (128, 255, 128)
noise3 = PerlinNoise(seed=seed3)
n3 = noise3.octave_noise_grid(width, height, 8, 0.5, 0.01)
c3 = (128, 128, 255)

running = True

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
    window.fill((0, 0, 0))

    for x in range(width):
        for y in range(height):
            nv1 = n1[x][y]
            nv2 = n2[x][y]
            nv3 = n3[x][y]

            color = (0, 0, 0)
            if nv1 >= nv2 and nv1 >= nv3:
                color = c1
            elif nv2 >= nv1 and nv2 >= nv3:
                color = c2
            elif nv3 >= nv1 and nv3 >= nv2:
                color = c3

            window.set_at((x, y), color)

    pygame.display.flip()