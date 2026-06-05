import { pipeline, type ImageClassificationPipeline } from '@huggingface/transformers';

export interface PlantResult {
  name: string;
  scientific: string;
  confidence: number;
  care: { water: string; light: string; difficulty: string };
  toxic: boolean;
  toxicTo: string[];
  isPlant: boolean;
  rawLabel: string;
}

interface PlantEntry {
  common: string;
  scientific: string;
  care: string;
  water: string;
  light: string;
  toxic: boolean;
  toxicTo: string[];
}

// ---------------------------------------------------------------------------
// Botanical database — 90 entries mapped from ImageNet plant/flower labels
// ---------------------------------------------------------------------------
const PLANT_DB: Record<string, PlantEntry> = {
  'daisy': { common: 'Daisy', scientific: 'Bellis perennis', care: 'Low maintenance', water: 'Moderate', light: 'Full sun', toxic: false, toxicTo: [] },
  'sunflower': { common: 'Sunflower', scientific: 'Helianthus annuus', care: 'Easy', water: 'Regular', light: 'Full sun', toxic: false, toxicTo: [] },
  'rose': { common: 'Rose', scientific: 'Rosa spp.', care: 'Moderate', water: 'Regular', light: 'Full sun', toxic: false, toxicTo: [] },
  'tulip': { common: 'Tulip', scientific: 'Tulipa spp.', care: 'Easy', water: 'Moderate', light: 'Full sun to partial shade', toxic: true, toxicTo: ['cats', 'dogs'] },
  'dandelion': { common: 'Dandelion', scientific: 'Taraxacum officinale', care: 'No care needed', water: 'Low', light: 'Full sun', toxic: false, toxicTo: [] },
  'lily': { common: 'Lily', scientific: 'Lilium spp.', care: 'Moderate', water: 'Regular', light: 'Full sun to partial shade', toxic: true, toxicTo: ['cats'] },
  'orchid': { common: 'Orchid', scientific: 'Orchidaceae', care: 'Moderate to difficult', water: 'Weekly', light: 'Indirect bright', toxic: false, toxicTo: [] },
  'iris': { common: 'Iris', scientific: 'Iris spp.', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: true, toxicTo: ['dogs', 'cats'] },
  'daffodil': { common: 'Daffodil', scientific: 'Narcissus spp.', care: 'Easy', water: 'Moderate', light: 'Full sun to partial shade', toxic: true, toxicTo: ['dogs', 'cats', 'humans'] },
  'lotus': { common: 'Lotus', scientific: 'Nelumbo nucifera', care: 'Moderate', water: 'Aquatic', light: 'Full sun', toxic: false, toxicTo: [] },
  'water lily': { common: 'Water Lily', scientific: 'Nymphaea spp.', care: 'Moderate', water: 'Aquatic', light: 'Full sun', toxic: false, toxicTo: [] },
  'hibiscus': { common: 'Hibiscus', scientific: 'Hibiscus rosa-sinensis', care: 'Moderate', water: 'Regular', light: 'Full sun', toxic: false, toxicTo: [] },
  'lavender': { common: 'Lavender', scientific: 'Lavandula spp.', care: 'Easy', water: 'Low', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'jasmine': { common: 'Jasmine', scientific: 'Jasminum spp.', care: 'Moderate', water: 'Regular', light: 'Full sun to partial shade', toxic: false, toxicTo: [] },
  'marigold': { common: 'Marigold', scientific: 'Tagetes spp.', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: false, toxicTo: [] },
  'poppy': { common: 'Poppy', scientific: 'Papaver spp.', care: 'Easy', water: 'Low', light: 'Full sun', toxic: true, toxicTo: ['dogs', 'cats'] },
  'carnation': { common: 'Carnation', scientific: 'Dianthus caryophyllus', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'petunia': { common: 'Petunia', scientific: 'Petunia spp.', care: 'Easy', water: 'Regular', light: 'Full sun', toxic: false, toxicTo: [] },
  'zinnia': { common: 'Zinnia', scientific: 'Zinnia elegans', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: false, toxicTo: [] },
  'geranium': { common: 'Geranium', scientific: 'Pelargonium spp.', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'chrysanthemum': { common: 'Chrysanthemum', scientific: 'Chrysanthemum spp.', care: 'Moderate', water: 'Regular', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'magnolia': { common: 'Magnolia', scientific: 'Magnolia grandiflora', care: 'Low', water: 'Moderate', light: 'Full sun to partial shade', toxic: false, toxicTo: [] },
  'hydrangea': { common: 'Hydrangea', scientific: 'Hydrangea macrophylla', care: 'Moderate', water: 'Regular', light: 'Partial shade', toxic: true, toxicTo: ['cats', 'dogs', 'humans'] },
  'gardenia': { common: 'Gardenia', scientific: 'Gardenia jasminoides', care: 'Difficult', water: 'Regular', light: 'Partial shade to full sun', toxic: false, toxicTo: [] },
  'azalea': { common: 'Azalea', scientific: 'Rhododendron spp.', care: 'Moderate', water: 'Regular', light: 'Partial shade', toxic: true, toxicTo: ['cats', 'dogs', 'humans'] },
  'bougainvillea': { common: 'Bougainvillea', scientific: 'Bougainvillea spp.', care: 'Easy', water: 'Low', light: 'Full sun', toxic: false, toxicTo: [] },
  'frangipani': { common: 'Frangipani', scientific: 'Plumeria spp.', care: 'Easy', water: 'Low to moderate', light: 'Full sun', toxic: true, toxicTo: ['dogs', 'cats'] },
  'cactus': { common: 'Cactus', scientific: 'Cactaceae', care: 'Very easy', water: 'Very low', light: 'Full sun', toxic: false, toxicTo: [] },
  'aloe vera': { common: 'Aloe Vera', scientific: 'Aloe barbadensis', care: 'Easy', water: 'Low', light: 'Bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'succulent': { common: 'Succulent', scientific: 'Various (Crassulaceae)', care: 'Very easy', water: 'Very low', light: 'Bright light', toxic: false, toxicTo: [] },
  'fern': { common: 'Fern', scientific: 'Polypodiopsida', care: 'Moderate', water: 'Regular', light: 'Indirect light', toxic: false, toxicTo: [] },
  'bamboo': { common: 'Bamboo', scientific: 'Bambusoideae', care: 'Easy', water: 'Regular', light: 'Full sun to partial shade', toxic: false, toxicTo: [] },
  'palm': { common: 'Palm', scientific: 'Arecaceae', care: 'Easy to moderate', water: 'Moderate', light: 'Bright indirect', toxic: false, toxicTo: [] },
  'ivy': { common: 'English Ivy', scientific: 'Hedera helix', care: 'Easy', water: 'Moderate', light: 'Partial to full shade', toxic: true, toxicTo: ['cats', 'dogs', 'humans'] },
  'pothos': { common: 'Pothos', scientific: 'Epipremnum aureum', care: 'Very easy', water: 'Low to moderate', light: 'Low to bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'monstera': { common: 'Monstera', scientific: 'Monstera deliciosa', care: 'Easy', water: 'Weekly', light: 'Bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'philodendron': { common: 'Philodendron', scientific: 'Philodendron spp.', care: 'Easy', water: 'Moderate', light: 'Bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'snake plant': { common: 'Snake Plant', scientific: 'Dracaena trifasciata', care: 'Very easy', water: 'Very low', light: 'Low to bright', toxic: true, toxicTo: ['cats', 'dogs'] },
  'peace lily': { common: 'Peace Lily', scientific: 'Spathiphyllum spp.', care: 'Easy', water: 'Moderate', light: 'Low to bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'spider plant': { common: 'Spider Plant', scientific: 'Chlorophytum comosum', care: 'Very easy', water: 'Moderate', light: 'Bright indirect', toxic: false, toxicTo: [] },
  'rubber plant': { common: 'Rubber Plant', scientific: 'Ficus elastica', care: 'Easy', water: 'Moderate', light: 'Bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'fiddle leaf fig': { common: 'Fiddle Leaf Fig', scientific: 'Ficus lyrata', care: 'Moderate to difficult', water: 'Weekly', light: 'Bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'boston fern': { common: 'Boston Fern', scientific: 'Nephrolepis exaltata', care: 'Moderate', water: 'Regular, mist often', light: 'Indirect light', toxic: false, toxicTo: [] },
  'bird of paradise': { common: 'Bird of Paradise', scientific: 'Strelitzia reginae', care: 'Moderate', water: 'Regular', light: 'Full sun to bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'jade plant': { common: 'Jade Plant', scientific: 'Crassula ovata', care: 'Easy', water: 'Low', light: 'Bright light', toxic: true, toxicTo: ['cats', 'dogs'] },
  'poinsettia': { common: 'Poinsettia', scientific: 'Euphorbia pulcherrima', care: 'Moderate', water: 'Moderate', light: 'Bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'amaryllis': { common: 'Amaryllis', scientific: 'Hippeastrum spp.', care: 'Moderate', water: 'Moderate', light: 'Bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'begonia': { common: 'Begonia', scientific: 'Begonia spp.', care: 'Moderate', water: 'Moderate', light: 'Bright indirect', toxic: true, toxicTo: ['cats', 'dogs'] },
  'camellia': { common: 'Camellia', scientific: 'Camellia japonica', care: 'Moderate', water: 'Regular', light: 'Partial shade', toxic: false, toxicTo: [] },
  'clover': { common: 'Clover', scientific: 'Trifolium spp.', care: 'No care needed', water: 'Low', light: 'Full sun', toxic: false, toxicTo: [] },
  'violet': { common: 'Violet', scientific: 'Viola spp.', care: 'Easy', water: 'Moderate', light: 'Partial shade', toxic: false, toxicTo: [] },
  'pansy': { common: 'Pansy', scientific: 'Viola tricolor var. hortensis', care: 'Easy', water: 'Regular', light: 'Full sun to partial shade', toxic: false, toxicTo: [] },
  'snapdragon': { common: 'Snapdragon', scientific: 'Antirrhinum majus', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: false, toxicTo: [] },
  'anemone': { common: 'Anemone', scientific: 'Anemone spp.', care: 'Moderate', water: 'Moderate', light: 'Partial shade', toxic: true, toxicTo: ['cats', 'dogs'] },
  'aster': { common: 'Aster', scientific: 'Aster spp.', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: false, toxicTo: [] },
  'bluebell': { common: 'Bluebell', scientific: 'Hyacinthoides non-scripta', care: 'Easy', water: 'Moderate', light: 'Partial shade', toxic: true, toxicTo: ['humans', 'cats', 'dogs'] },
  'buttercup': { common: 'Buttercup', scientific: 'Ranunculus spp.', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs', 'horses'] },
  'clematis': { common: 'Clematis', scientific: 'Clematis spp.', care: 'Moderate', water: 'Regular', light: 'Full sun (roots shaded)', toxic: true, toxicTo: ['cats', 'dogs'] },
  'columbine': { common: 'Columbine', scientific: 'Aquilegia spp.', care: 'Easy', water: 'Moderate', light: 'Partial shade', toxic: true, toxicTo: ['humans'] },
  'crocus': { common: 'Crocus', scientific: 'Crocus spp.', care: 'Easy', water: 'Low', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'foxglove': { common: 'Foxglove', scientific: 'Digitalis purpurea', care: 'Easy', water: 'Moderate', light: 'Partial shade', toxic: true, toxicTo: ['humans', 'cats', 'dogs'] },
  'heather': { common: 'Heather', scientific: 'Calluna vulgaris', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: false, toxicTo: [] },
  'holly': { common: 'Holly', scientific: 'Ilex aquifolium', care: 'Easy', water: 'Moderate', light: 'Full sun to partial shade', toxic: true, toxicTo: ['humans', 'cats', 'dogs'] },
  'honeysuckle': { common: 'Honeysuckle', scientific: 'Lonicera spp.', care: 'Easy', water: 'Moderate', light: 'Full sun to partial shade', toxic: true, toxicTo: ['cats', 'dogs'] },
  'hyacinth': { common: 'Hyacinth', scientific: 'Hyacinthus orientalis', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'lilac': { common: 'Lilac', scientific: 'Syringa vulgaris', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: false, toxicTo: [] },
  'morning glory': { common: 'Morning Glory', scientific: 'Ipomoea spp.', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'oleander': { common: 'Oleander', scientific: 'Nerium oleander', care: 'Easy', water: 'Low', light: 'Full sun', toxic: true, toxicTo: ['humans', 'cats', 'dogs', 'horses'] },
  'peony': { common: 'Peony', scientific: 'Paeonia spp.', care: 'Moderate', water: 'Regular', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'primrose': { common: 'Primrose', scientific: 'Primula vulgaris', care: 'Easy', water: 'Moderate', light: 'Partial shade', toxic: true, toxicTo: ['cats', 'dogs'] },
  'ranunculus': { common: 'Ranunculus', scientific: 'Ranunculus asiaticus', care: 'Moderate', water: 'Moderate', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'rhododendron': { common: 'Rhododendron', scientific: 'Rhododendron spp.', care: 'Moderate', water: 'Regular', light: 'Partial shade', toxic: true, toxicTo: ['humans', 'cats', 'dogs'] },
  'wisteria': { common: 'Wisteria', scientific: 'Wisteria spp.', care: 'Moderate', water: 'Regular', light: 'Full sun', toxic: true, toxicTo: ['humans', 'cats', 'dogs'] },
  'yucca': { common: 'Yucca', scientific: 'Yucca spp.', care: 'Easy', water: 'Low', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'oak': { common: 'Oak', scientific: 'Quercus spp.', care: 'Low maintenance (tree)', water: 'Low once established', light: 'Full sun', toxic: true, toxicTo: ['dogs', 'cats', 'horses'] },
  'maple': { common: 'Maple', scientific: 'Acer spp.', care: 'Low maintenance (tree)', water: 'Moderate', light: 'Full sun to partial shade', toxic: true, toxicTo: ['horses'] },
  'pine': { common: 'Pine', scientific: 'Pinus spp.', care: 'Low maintenance (tree)', water: 'Low once established', light: 'Full sun', toxic: true, toxicTo: ['cats'] },
  'willow': { common: 'Weeping Willow', scientific: 'Salix babylonica', care: 'Easy (tree)', water: 'High — loves moisture', light: 'Full sun', toxic: false, toxicTo: [] },
  'birch': { common: 'Birch', scientific: 'Betula spp.', care: 'Low maintenance (tree)', water: 'Moderate', light: 'Full sun', toxic: false, toxicTo: [] },
  'eucalyptus': { common: 'Eucalyptus', scientific: 'Eucalyptus spp.', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
  'mint': { common: 'Mint', scientific: 'Mentha spp.', care: 'Very easy', water: 'Regular', light: 'Partial shade', toxic: true, toxicTo: ['cats', 'dogs'] },
  'basil': { common: 'Basil', scientific: 'Ocimum basilicum', care: 'Easy', water: 'Regular', light: 'Full sun', toxic: false, toxicTo: [] },
  'rosemary': { common: 'Rosemary', scientific: 'Salvia rosmarinus', care: 'Easy', water: 'Low', light: 'Full sun', toxic: false, toxicTo: [] },
  'thyme': { common: 'Thyme', scientific: 'Thymus vulgaris', care: 'Easy', water: 'Low', light: 'Full sun', toxic: false, toxicTo: [] },
  'sage': { common: 'Sage', scientific: 'Salvia officinalis', care: 'Easy', water: 'Low', light: 'Full sun', toxic: false, toxicTo: [] },
  'parsley': { common: 'Parsley', scientific: 'Petroselinum crispum', care: 'Easy', water: 'Regular', light: 'Full sun to partial shade', toxic: false, toxicTo: [] },
  'cilantro': { common: 'Cilantro / Coriander', scientific: 'Coriandrum sativum', care: 'Easy', water: 'Regular', light: 'Full sun to partial shade', toxic: false, toxicTo: [] },
  'dill': { common: 'Dill', scientific: 'Anethum graveolens', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: false, toxicTo: [] },
  'chive': { common: 'Chives', scientific: 'Allium schoenoprasum', care: 'Easy', water: 'Moderate', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] },
};

// ImageNet labels that map to plant database keys
const LABEL_TO_PLANT: Record<string, string> = {
  'daisy': 'daisy',
  "ox-eye daisy, oxeye daisy, Leucanthemum vulgare": 'daisy',
  'sunflower': 'sunflower',
  'rose hip': 'rose',
  'hip, rose hip, rosehip': 'rose',
  'pot, flowerpot': 'succulent',
  'vase': 'rose',
  'tulip': 'tulip',
  'corn poppy, Papaver rhoeas': 'poppy',
  'acorn': 'oak',
  'rapeseed': 'marigold',
  'yellow lady\'s slipper': 'orchid',
  'bee orchid': 'orchid',
  'lady slipper, lady\'s slipper, slipper orchid': 'orchid',
  'coral fungus': 'fern',
  'agaric': 'fern',
  'mushroom': 'fern',
  'tray': 'succulent',
  'water tower': 'palm',
  'coconut, cocoanut, coconut palm': 'palm',
  'date, date palm, Phoenix dactylifera': 'palm',
  'fig': 'fiddle leaf fig',
  'banana': 'bird of paradise',
  'pineapple, ananas': 'yucca',
  'hay': 'clover',
  'bell pepper': 'pepper',
  'cucumber, cuke': 'ivy',
  'head cabbage': 'hydrangea',
  'broccoli': 'hydrangea',
  'cauliflower': 'hydrangea',
  'artichoke, globe artichoke': 'chrysanthemum',
  'cardoon': 'chrysanthemum',
  'lemon': 'citrus',
  'orange': 'citrus',
  'potpie': 'peony',
};

const PLANT_LABELS = new Set([
  ...Object.keys(LABEL_TO_PLANT),
  ...Object.keys(PLANT_DB),
]);

// Add citrus to DB since it's referenced in LABEL_TO_PLANT
PLANT_DB['citrus'] = { common: 'Citrus', scientific: 'Citrus spp.', care: 'Moderate', water: 'Regular', light: 'Full sun', toxic: true, toxicTo: ['cats', 'dogs'] };
PLANT_DB['pepper'] = { common: 'Pepper Plant', scientific: 'Capsicum spp.', care: 'Easy', water: 'Regular', light: 'Full sun', toxic: false, toxicTo: [] };

let classifier: ImageClassificationPipeline | null = null;
let _modelStatus: 'loading' | 'ready' | 'error' = 'loading';
let _progress = 0;

type ProgressCallback = (progress: number) => void;

export function getModelStatus(): 'loading' | 'ready' | 'error' {
  return _modelStatus;
}

export function getProgress(): number {
  return _progress;
}

export async function initModel(onProgress?: ProgressCallback): Promise<void> {
  if (classifier) return;
  _modelStatus = 'loading';
  _progress = 0;
  try {
    classifier = await pipeline('image-classification', 'Xenova/mobilevit-small', {
      progress_callback: (data: { progress?: number; status?: string }) => {
        if (data.progress !== undefined) {
          _progress = data.progress;
          onProgress?.(data.progress);
        }
      },
    }) as ImageClassificationPipeline;
    _modelStatus = 'ready';
    _progress = 100;
    onProgress?.(100);
  } catch (e) {
    _modelStatus = 'error';
    console.error('Failed to load model:', e);
    throw e;
  }
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[_-]/g, ' ').trim();
}

function lookupPlant(rawLabel: string): { key: string; entry: PlantEntry } | null {
  // Direct mapping
  if (LABEL_TO_PLANT[rawLabel]) {
    const key = LABEL_TO_PLANT[rawLabel];
    if (PLANT_DB[key]) return { key, entry: PLANT_DB[key] };
  }

  // Normalized match
  const normalized = normalizeLabel(rawLabel);
  if (PLANT_DB[normalized]) return { key: normalized, entry: PLANT_DB[normalized] };

  // Partial match
  for (const [dbKey, entry] of Object.entries(PLANT_DB)) {
    if (normalized.includes(dbKey) || dbKey.includes(normalized)) {
      return { key: dbKey, entry };
    }
  }

  // Word-level match
  const words = normalized.split(/[\s,]+/).filter(w => w.length > 3);
  for (const word of words) {
    if (PLANT_DB[word]) return { key: word, entry: PLANT_DB[word] };
  }

  return null;
}

function isLikelyPlant(label: string): boolean {
  const normalized = normalizeLabel(label);
  if (PLANT_LABELS.has(label)) return true;
  const plantKeywords = ['flower', 'plant', 'tree', 'leaf', 'petal', 'bloom', 'blossom', 'garden', 'bush', 'shrub', 'vine', 'herb', 'fern', 'moss', 'seed', 'bulb', 'stem', 'root', 'botanical'];
  return plantKeywords.some(k => normalized.includes(k));
}

export async function identifyPlant(image: ImageData | HTMLImageElement | HTMLCanvasElement | string): Promise<PlantResult> {
  if (!classifier) {
    return {
      name: '',
      scientific: '',
      confidence: 0,
      care: { water: '', light: '', difficulty: '' },
      toxic: false,
      toxicTo: [],
      isPlant: false,
      rawLabel: '',
    };
  }

  const results = await classifier(image, { topk: 5 });
  const top = results[0];
  const rawLabel = top.label;

  // Try to find a plant match from top 5 results
  for (const result of results) {
    const plant = lookupPlant(result.label);
    if (plant) {
      return {
        name: plant.entry.common,
        scientific: plant.entry.scientific,
        confidence: result.score,
        care: { water: plant.entry.water, light: plant.entry.light, difficulty: plant.entry.care },
        toxic: plant.entry.toxic,
        toxicTo: plant.entry.toxicTo,
        isPlant: true,
        rawLabel: result.label,
      };
    }
  }

  // If it seems plant-related but not in DB
  if (isLikelyPlant(rawLabel)) {
    const name = normalizeLabel(rawLabel).replace(/\b\w/g, c => c.toUpperCase());
    return {
      name,
      scientific: 'Unknown',
      confidence: top.score,
      care: { water: 'Unknown', light: 'Unknown', difficulty: 'Unknown' },
      toxic: false,
      toxicTo: [],
      isPlant: true,
      rawLabel,
    };
  }

  // Not a plant
  const detectedName = normalizeLabel(rawLabel).replace(/\b\w/g, c => c.toUpperCase());
  return {
    name: detectedName,
    scientific: '',
    confidence: top.score,
    care: { water: '', light: '', difficulty: '' },
    toxic: false,
    toxicTo: [],
    isPlant: false,
    rawLabel,
  };
}
