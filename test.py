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
noise2 = PerlinNoise(seed=seed2)
n2 = noise2.octave_noise_grid(width, height, 8, 0.5, 0.01)
noise3 = PerlinNoise(seed=seed3)
n3 = noise3.octave_noise_grid(width, height, 8, 0.5, 0.01)

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

            r = int((nv1 + 1) / 2 * 255)
            g = int((nv2 + 1) / 2 * 255)
            b = int((nv3 + 1) / 2 * 255)

            window.set_at((x, y), (r, g, b))

    pygame.display.flip()