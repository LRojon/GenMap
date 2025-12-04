/**
 * Exemples d'utilisation des hooks et composants
 * Ces exemples montrent comment utiliser les utilities
 */

// =============================================================================
// Exemple 1: Utiliser useMapGenerator dans un composant
// =============================================================================

/*
import { useMapGenerator } from '../hooks';

function MyMapComponent() {
  const { generate, progress, isGenerating } = useMapGenerator();

  const handleGenerateClick = async () => {
    const mapData = await generate({
      width: 1024,
      height: 768,
      seed: 12345,
    });

    console.log('Carte générée:', mapData);
  };

  return (
    <div>
      <button onClick={handleGenerateClick} disabled={isGenerating}>
        {isGenerating ? `Génération... ${progress}%` : 'Générer'}
      </button>
    </div>
  );
}
*/

// =============================================================================
// Exemple 2: Utiliser useCanvasRenderer
// =============================================================================

/*
import { useCanvasRenderer } from '../hooks';
import { BIOME_COLORS } from '../utils/colors';

function MyCanvasComponent() {
  const canvasRef = useRef(null);
  const { renderBiomes, drawCities, drawRivers } = useCanvasRenderer();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Générer les données
    const mapData = generateMap();

    // Rendu des biomes
    renderBiomes(ctx, mapData.biomes, mapData.width, mapData.height, BIOME_COLORS);

    // Ajouter les villes
    drawCities(ctx, mapData.cities, mapData.width, mapData.height);

    // Ajouter les rivières
    drawRivers(ctx, mapData.rivers, mapData.width, mapData.height);
  }, []);

  return <canvas ref={canvasRef} width={1024} height={768} />;
}
*/

// =============================================================================
// Exemple 3: Contrôler la génération avec des paramètres
// =============================================================================

/*
const CONFIG = {
  width: 2048,
  height: 1536,
  seed: Math.floor(Math.random() * 1000000),
  scale: 1.5,
};

async function generateMapWithConfig(config) {
  const { generate } = useMapGenerator();
  
  const mapData = await generate({
    width: config.width,
    height: config.height,
    seed: config.seed,
  });

  return mapData;
}
*/

// =============================================================================
// Exemple 4: Ajouter un nouveau biome
// =============================================================================

/*
// Dans MapCanvas.js, modifier generateBiomes:

const generateBiomes = (heightMap, width, height) => {
  const biomes = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const height_val = heightMap[i];

    // Nouveaux seuils avec volcan
    if (height_val < 85) {
      biomes[i] = 0; // Eau
    } else if (height_val < 100) {
      biomes[i] = 1; // Plage
    } else if (height_val < 140) {
      biomes[i] = 2; // Plaine
    } else if (height_val < 200) {
      biomes[i] = 6; // Collines
    } else if (height_val < 240) {
      biomes[i] = 7; // Montagne
    } else {
      biomes[i] = 11; // Volcan (nouveau!)
    }
  }

  return biomes;
};

// Ajouter la couleur du volcan dans BIOME_COLORS:
const BIOME_COLORS = {
  // ... autres biomes
  11: [100, 0, 0], // Volcan (rouge foncé)
};
*/

// =============================================================================
// Exemple 5: Implémenter une fonction de lissage
// =============================================================================

/*
function smoothHeightMap(heightMap, width, height, passes = 3) {
  let current = heightMap;

  for (let pass = 0; pass < passes; pass++) {
    const smoothed = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;

        // Moyenne des voisins (3x3 kernel)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += current[ny * width + nx];
              count++;
            }
          }
        }

        smoothed[y * width + x] = Math.floor(sum / count);
      }
    }

    current = smoothed;
  }

  return current;
}
*/

// =============================================================================
// Exemple 6: Ajouter l'exportation de carte
// =============================================================================

/*
function exportMapAsImage(canvas, filename = 'map.png') {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

function exportMapAsJSON(mapData, filename = 'map.json') {
  const json = JSON.stringify({
    width: mapData.width,
    height: mapData.height,
    seed: mapData.seed,
    biomes: Array.from(mapData.biomes),
    heightMap: Array.from(mapData.heightMap),
  });

  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
*/

// =============================================================================
// Exemple 7: Implémenter Web Workers pour génération asynchrone
// =============================================================================

/*
// Créer: src/workers/mapGenerator.worker.js
self.onmessage = function(event) {
  const { width, height, seed } = event.data;
  
  const heightMap = generatePerlinNoise(width, height, seed, 8);
  const biomes = generateBiomes(heightMap, width, height);
  
  self.postMessage({
    heightMap: Array.from(heightMap),
    biomes: Array.from(biomes),
  });
};

// Utiliser dans le composant:
function useWorkerMapGenerator() {
  const [mapData, setMapData] = useState(null);
  const workerRef = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/mapGenerator.worker.js', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (event) => {
      setMapData(event.data);
    };

    return () => workerRef.current.terminate();
  }, []);

  const generate = useCallback((config) => {
    workerRef.current.postMessage(config);
  }, []);

  return { generate, mapData };
}
*/

export const EXAMPLES = {
  mapGenerator: 'useMapGenerator hook',
  canvasRenderer: 'useCanvasRenderer hook',
  biomeGeneration: 'Génération de biomes',
};
