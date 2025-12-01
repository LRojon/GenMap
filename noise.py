import numpy as np
import random

class PerlinNoise:
    
    def __init__(self, seed=None):
        if seed is None:
            seed = random.randint(0, 999999)
        random.seed(seed)
        self.permutation = np.array(list(range(256)))
        np.random.seed(seed)
        np.random.shuffle(self.permutation)
        self.permutation = np.concatenate([self.permutation, self.permutation])
        
    @staticmethod
    def fade(t):
        return t * t * t * (t * (t * 6 - 15) + 10)
    
    @staticmethod
    def lerp(a, b, t):
        return a + t * (b - a)
    
    @staticmethod
    def grad(hash_val, x, y):
        h = hash_val & 3
        u = np.where(h < 2, x, -x)
        v = np.where((h == 0) | (h == 2), y, -y)
        return u + v
    
    def noise_grid(self, x_grid, y_grid):
        """Calcule le bruit Perlin pour une grille complète (vectorisé)."""
        xi = x_grid.astype(int) & 255
        yi = y_grid.astype(int) & 255
        
        xf = x_grid - x_grid.astype(int)
        yf = y_grid - y_grid.astype(int)
        
        u = self.fade(xf)
        v = self.fade(yf)
        
        aa = self.permutation[self.permutation[xi] + yi]
        ab = self.permutation[self.permutation[xi] + yi + 1]
        ba = self.permutation[self.permutation[xi + 1] + yi]
        bb = self.permutation[self.permutation[xi + 1] + yi + 1]
        
        x1 = self.lerp(self.grad(aa, xf, yf), self.grad(ba, xf - 1, yf), u)
        x2 = self.lerp(self.grad(ab, xf, yf - 1), self.grad(bb, xf - 1, yf - 1), u)
        
        return self.lerp(x1, x2, v)
    
    def octave_noise_grid(self, width, height, octaves=4, persistence=0.5, scale=0.1):
        """
        Génère le bruit d'octave pour une grille complète (ultra-rapide).
        width: largeur de la grille
        height: hauteur de la grille
        octaves: nombre d'octaves
        persistence: influence de chaque octave
        scale: échelle du bruit
        """
        # Créer les grilles de coordonnées une seule fois
        y_coords, x_coords = np.mgrid[0:height, 0:width]
        
        value = np.zeros((height, width), dtype=np.float32)
        amplitude = 1.0
        frequency = scale
        max_value = 0.0
        
        for _ in range(octaves):
            value += self.noise_grid(x_coords * frequency, y_coords * frequency) * amplitude
            max_value += amplitude
            amplitude *= persistence
            frequency *= 2
        
        return value / max_value
