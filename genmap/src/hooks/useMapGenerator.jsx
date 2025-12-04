import { useCallback, useState, useRef } from 'react';
import { generatePerlinNoise } from '../utils/perlin';
import { generateVoronoi } from '../utils/voronoi';

export function useMapGenerator() {
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const generationRef = useRef(null);

  const generateBiomes = useCallback((heightMap, width, height) => {
    const biomes = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const heightVal = heightMap[i];

      if (heightVal < 85) {
        biomes[i] = 0; // Eau
      } else if (heightVal < 100) {
        biomes[i] = 1; // Plage
      } else if (heightVal < 140) {
        biomes[i] = 2; // Plaine
      } else if (heightVal < 160) {
        biomes[i] = 4; // Prairie
      } else if (heightVal < 180) {
        biomes[i] = 6; // Collines
      } else if (heightVal < 210) {
        biomes[i] = 7; // Montagne
      } else {
        biomes[i] = 8; // Neige
      }
    }

    return biomes;
  }, []);

  const generate = useCallback(
    async (config) => {
      try {
        setIsGenerating(true);
        setError(null);
        setProgress(0);

        // Stocker une référence pour pouvoir l'annuler si nécessaire
        const abortController = new AbortController();
        generationRef.current = abortController;

        // Générer la carte de hauteur
        setProgress(10);
        const heightMap = generatePerlinNoise(
          config.width,
          config.height,
          config.seed,
          8
        );

        if (abortController.signal.aborted) return;

        // Générer les biomes
        setProgress(40);
        const biomes = generateBiomes(heightMap, config.width, config.height);

        if (abortController.signal.aborted) return;

        // Générer les régions Voronoi
        setProgress(70);
        const voronoi = generateVoronoi(config.width, config.height, config.seed);

        setProgress(100);

        return {
          heightMap,
          biomes,
          regions: voronoi.regions,
          regionMap: voronoi.regionMap,
        };
      } catch (err) {
        setError(err.message);
        console.error('Map generation error:', err);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [generateBiomes]
  );

  const cancel = useCallback(() => {
    if (generationRef.current) {
      generationRef.current.abort();
      setIsGenerating(false);
    }
  }, []);

  return {
    generate,
    cancel,
    progress,
    isGenerating,
    error,
  };
}
