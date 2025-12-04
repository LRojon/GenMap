/**
 * Implémentation du bruit de Perlin 2D en JavaScript
 * Basée sur l'implémentation classique de Perlin
 */

class PerlinNoise {
  constructor(seed = 0) {
    this.permutation = [
      151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
      140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
      247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
      57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
      74, 165, 71, 134, 139, 48, 27, 166, 102, 143, 54, 65, 25, 63, 161, 1,
      215, 104, 3, 226, 35, 18, 126, 55, 192, 130, 6, 72, 161, 139, 228, 188,
      143, 157, 47, 87, 77, 24, 207, 200, 62, 25, 63, 156, 16, 140, 86, 34,
      212, 191, 26, 167, 129, 103, 10, 225, 126, 48, 161, 0, 42, 127, 109, 149,
      159, 164, 84, 128, 10, 50, 71, 201, 103, 19, 29, 126, 39, 232, 145, 127,
      123, 21, 103, 174, 228, 41, 215, 146, 180, 47, 19, 21, 239, 59, 97, 19,
      16, 9, 136, 74, 64, 180, 171, 170, 24, 118, 51, 197, 152, 66, 69, 88,
      150, 132, 75, 3, 227, 108, 205, 205, 50, 131, 115, 62, 220, 59, 180, 102,
      149, 249, 216, 234, 185, 216, 187, 119, 79, 242, 193, 20, 140, 154, 11, 56,
      152, 174, 182, 167, 118, 223, 134, 218, 200, 75, 142, 66, 255, 167, 38, 123,
      192, 231, 48, 25, 106, 224, 48, 194, 42, 55, 68, 66, 149, 43, 106, 183,
      36, 25, 227, 149, 88, 25, 88, 3, 45, 85, 134, 143, 181, 77, 172, 31,
    ];

    // Dupliquer la permutation pour éviter les modulos
    this.p = [...this.permutation, ...this.permutation];

    // Appliquer le seed
    if (seed) {
      const random = this.seededRandom(seed);
      for (let i = 0; i < this.permutation.length; i++) {
        const j = Math.floor(random() * (i + 1));
        [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        this.p[i + 256] = this.p[i];
      }
    }
  }

  seededRandom(seed) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }

  grad(hash, x, y) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 8 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.p[this.p[xi] + yi];
    const ab = this.p[this.p[xi] + yi + 1];
    const ba = this.p[this.p[xi + 1] + yi];
    const bb = this.p[this.p[xi + 1] + yi + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));

    return (this.lerp(v, x1, x2) + 1) / 2; // Normaliser entre 0 et 1
  }
}

export function generatePerlinNoise(width, height, seed = 0, octaves = 8, persistence = 0.5, scale = 50) {
  const perlin = new PerlinNoise(seed);
  const heightMap = new Uint8Array(width * height);

  const lacunarity = 2;
  const amplitude = 1;
  const frequency = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      let maxValue = 0;
      let currentAmplitude = amplitude;
      let currentFrequency = frequency;

      for (let i = 0; i < octaves; i++) {
        const sampleX = (x / scale) * currentFrequency;
        const sampleY = (y / scale) * currentFrequency;

        value += perlin.noise(sampleX, sampleY) * currentAmplitude;
        maxValue += currentAmplitude;

        currentAmplitude *= persistence;
        currentFrequency *= lacunarity;
      }

      value /= maxValue;
      heightMap[y * width + x] = Math.floor(value * 255);
    }
  }

  return heightMap;
}
