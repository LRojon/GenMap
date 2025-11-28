import random

class PerlinNoise:
    
    def __init__(self, seed=None):
        if seed is None:
            seed = random.randint(0, 999999)
        random.seed(seed)
        self.permutation = list(range(256))
        random.shuffle(self.permutation)
        self.permutation *= 2
        
    def fade(self, t):
        return t * t * t * (t * (t * 6 - 15) + 10)
    
    def lerp(self, a, b, t):
        return a + t * (b - a)
    
    def grad(self, hash_val, x, y):
        h = hash_val & 3
        if h == 0: return x + y
        elif h == 1: return -x + y
        elif h == 2: return x - y
        else: return -x - y
    
    def noise(self, x, y):
        xi = int(x) & 255
        yi = int(y) & 255
        
        xf = x - int(x)
        yf = y - int(y)
        
        u = self.fade(xf)
        v = self.fade(yf)
        
        aa = self.permutation[self.permutation[xi] + yi]
        ab = self.permutation[self.permutation[xi] + yi + 1]
        ba = self.permutation[self.permutation[xi + 1] + yi]
        bb = self.permutation[self.permutation[xi + 1] + yi + 1]
        
        x1 = self.lerp(self.grad(aa, xf, yf), self.grad(ba, xf - 1, yf), u)
        x2 = self.lerp(self.grad(ab, xf, yf - 1), self.grad(bb, xf - 1, yf - 1), u)
        
        return self.lerp(x1, x2, v)
    
    def octave_noise(self, x, y, octaves=4, persistence=0.5, scale=0.1):
        value = 0
        amplitude = 1
        frequency = scale
        max_value = 0
        
        for _ in range(octaves):
            value += self.noise(x * frequency, y * frequency) * amplitude
            max_value += amplitude
            amplitude *= persistence
            frequency *= 2
        
        return value / max_value
