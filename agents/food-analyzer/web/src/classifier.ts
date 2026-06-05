import { pipeline, type ImageClassificationPipeline } from '@huggingface/transformers';

export interface FoodResult {
  dish: string;
  confidence: number;
  calories: number | null;
  serving: string | null;
  ingredients: string[];
  isFood: boolean;
  rawLabel: string;
  modelStatus: 'loading' | 'ready' | 'error';
}

interface FoodEntry {
  calories: number;
  serving: string;
  ingredients: string[];
}

// ---------------------------------------------------------------------------
// Food database — 120 entries mapped from ImageNet food labels
// ---------------------------------------------------------------------------
const FOOD_DB: Record<string, FoodEntry> = {
  'cheeseburger': { calories: 350, serving: '1 burger', ingredients: ['beef patty', 'cheese', 'bun', 'lettuce', 'tomato'] },
  'hamburger': { calories: 295, serving: '1 burger', ingredients: ['beef patty', 'bun', 'lettuce', 'tomato', 'onion'] },
  'pizza': { calories: 285, serving: '1 slice', ingredients: ['dough', 'tomato sauce', 'mozzarella'] },
  'hotdog': { calories: 290, serving: '1 hotdog', ingredients: ['sausage', 'bun', 'mustard', 'ketchup'] },
  'hot dog': { calories: 290, serving: '1 hotdog', ingredients: ['sausage', 'bun', 'mustard', 'ketchup'] },
  'french fries': { calories: 365, serving: '1 medium serving', ingredients: ['potatoes', 'oil', 'salt'] },
  'bagel': { calories: 270, serving: '1 bagel', ingredients: ['flour', 'water', 'yeast', 'salt', 'sugar'] },
  'pretzel': { calories: 380, serving: '1 pretzel', ingredients: ['flour', 'water', 'yeast', 'salt', 'butter'] },
  'burrito': { calories: 430, serving: '1 burrito', ingredients: ['tortilla', 'rice', 'beans', 'meat', 'cheese', 'salsa'] },
  'taco': { calories: 210, serving: '1 taco', ingredients: ['tortilla', 'meat', 'lettuce', 'cheese', 'salsa'] },
  'guacamole': { calories: 150, serving: '1/2 cup', ingredients: ['avocado', 'lime', 'onion', 'cilantro', 'salt'] },
  'carbonara': { calories: 420, serving: '1 plate', ingredients: ['pasta', 'egg', 'pancetta', 'parmesan', 'pepper'] },
  'spaghetti bolognese': { calories: 410, serving: '1 plate', ingredients: ['spaghetti', 'beef', 'tomato sauce', 'onion', 'garlic'] },
  'meat loaf': { calories: 260, serving: '1 slice', ingredients: ['ground beef', 'breadcrumbs', 'egg', 'onion', 'ketchup'] },
  'meatloaf': { calories: 260, serving: '1 slice', ingredients: ['ground beef', 'breadcrumbs', 'egg', 'onion', 'ketchup'] },
  'steak': { calories: 270, serving: '6 oz', ingredients: ['beef', 'salt', 'pepper'] },
  'prime rib': { calories: 340, serving: '6 oz', ingredients: ['beef rib', 'salt', 'pepper', 'garlic'] },
  'potpie': { calories: 380, serving: '1 slice', ingredients: ['pastry', 'chicken', 'vegetables', 'cream'] },
  'pot pie': { calories: 380, serving: '1 slice', ingredients: ['pastry', 'chicken', 'vegetables', 'cream'] },
  'soup': { calories: 150, serving: '1 bowl', ingredients: ['broth', 'vegetables', 'seasoning'] },
  'consomme': { calories: 30, serving: '1 cup', ingredients: ['clarified broth', 'herbs'] },
  'mushroom': { calories: 22, serving: '1 cup', ingredients: ['mushroom'] },
  'banana': { calories: 105, serving: '1 banana', ingredients: ['banana'] },
  'strawberry': { calories: 50, serving: '1 cup', ingredients: ['strawberry'] },
  'orange': { calories: 62, serving: '1 orange', ingredients: ['orange'] },
  'lemon': { calories: 17, serving: '1 lemon', ingredients: ['lemon'] },
  'fig': { calories: 37, serving: '1 fig', ingredients: ['fig'] },
  'pineapple': { calories: 82, serving: '1 cup', ingredients: ['pineapple'] },
  'jackfruit': { calories: 155, serving: '1 cup', ingredients: ['jackfruit'] },
  'custard apple': { calories: 235, serving: '1 fruit', ingredients: ['custard apple'] },
  'pomegranate': { calories: 234, serving: '1 pomegranate', ingredients: ['pomegranate'] },
  'apple': { calories: 95, serving: '1 apple', ingredients: ['apple'] },
  'granny smith': { calories: 95, serving: '1 apple', ingredients: ['green apple'] },
  'peach': { calories: 59, serving: '1 peach', ingredients: ['peach'] },
  'mango': { calories: 135, serving: '1 mango', ingredients: ['mango'] },
  'grape': { calories: 104, serving: '1 cup', ingredients: ['grape'] },
  'watermelon': { calories: 86, serving: '2 cups', ingredients: ['watermelon'] },
  'corn': { calories: 90, serving: '1 ear', ingredients: ['corn'] },
  'ear': { calories: 90, serving: '1 ear', ingredients: ['corn'] },
  'broccoli': { calories: 55, serving: '1 cup', ingredients: ['broccoli'] },
  'cauliflower': { calories: 25, serving: '1 cup', ingredients: ['cauliflower'] },
  'zucchini': { calories: 33, serving: '1 medium', ingredients: ['zucchini'] },
  'cucumber': { calories: 16, serving: '1 cup', ingredients: ['cucumber'] },
  'bell pepper': { calories: 30, serving: '1 pepper', ingredients: ['bell pepper'] },
  'artichoke': { calories: 60, serving: '1 artichoke', ingredients: ['artichoke'] },
  'cardoon': { calories: 17, serving: '1 cup', ingredients: ['cardoon'] },
  'spaghetti squash': { calories: 42, serving: '1 cup', ingredients: ['spaghetti squash'] },
  'acorn squash': { calories: 56, serving: '1 cup', ingredients: ['acorn squash'] },
  'butternut squash': { calories: 82, serving: '1 cup', ingredients: ['butternut squash'] },
  'head cabbage': { calories: 22, serving: '1 cup', ingredients: ['cabbage'] },
  'cabbage': { calories: 22, serving: '1 cup', ingredients: ['cabbage'] },
  'ice cream': { calories: 270, serving: '1 cup', ingredients: ['cream', 'sugar', 'milk', 'vanilla'] },
  'ice lolly': { calories: 70, serving: '1 bar', ingredients: ['water', 'sugar', 'fruit juice'] },
  'chocolate cake': { calories: 350, serving: '1 slice', ingredients: ['flour', 'cocoa', 'sugar', 'butter', 'eggs'] },
  'chocolate sauce': { calories: 130, serving: '2 tbsp', ingredients: ['chocolate', 'cream', 'sugar'] },
  'cake': { calories: 290, serving: '1 slice', ingredients: ['flour', 'sugar', 'butter', 'eggs', 'vanilla'] },
  'dough': { calories: 230, serving: '1 piece', ingredients: ['flour', 'water', 'yeast', 'salt'] },
  'bread': { calories: 75, serving: '1 slice', ingredients: ['flour', 'water', 'yeast', 'salt'] },
  'french loaf': { calories: 185, serving: '1/4 loaf', ingredients: ['flour', 'water', 'yeast', 'salt'] },
  'croissant': { calories: 230, serving: '1 croissant', ingredients: ['flour', 'butter', 'yeast', 'sugar', 'salt'] },
  'muffin': { calories: 340, serving: '1 muffin', ingredients: ['flour', 'sugar', 'butter', 'eggs', 'baking powder'] },
  'waffle': { calories: 290, serving: '1 waffle', ingredients: ['flour', 'eggs', 'butter', 'milk', 'baking powder'] },
  'pancake': { calories: 175, serving: '2 pancakes', ingredients: ['flour', 'eggs', 'milk', 'butter', 'syrup'] },
  'donut': { calories: 250, serving: '1 donut', ingredients: ['flour', 'sugar', 'oil', 'yeast', 'glaze'] },
  'doughnut': { calories: 250, serving: '1 donut', ingredients: ['flour', 'sugar', 'oil', 'yeast', 'glaze'] },
  'cookie': { calories: 160, serving: '2 cookies', ingredients: ['flour', 'butter', 'sugar', 'eggs', 'chocolate chips'] },
  'brownie': { calories: 260, serving: '1 brownie', ingredients: ['chocolate', 'butter', 'sugar', 'eggs', 'flour'] },
  'pie': { calories: 295, serving: '1 slice', ingredients: ['pastry', 'fruit filling', 'sugar', 'butter'] },
  'custard': { calories: 130, serving: '1/2 cup', ingredients: ['eggs', 'milk', 'sugar', 'vanilla'] },
  'trifle': { calories: 280, serving: '1 serving', ingredients: ['sponge cake', 'custard', 'fruit', 'cream'] },
  'tiramisu': { calories: 330, serving: '1 slice', ingredients: ['mascarpone', 'espresso', 'ladyfingers', 'cocoa'] },
  'cheesecake': { calories: 320, serving: '1 slice', ingredients: ['cream cheese', 'sugar', 'eggs', 'graham crust'] },
  'macaroni': { calories: 350, serving: '1 plate', ingredients: ['macaroni', 'cheese', 'milk', 'butter'] },
  'ravioli': { calories: 280, serving: '1 plate', ingredients: ['pasta', 'ricotta', 'spinach', 'tomato sauce'] },
  'lasagna': { calories: 380, serving: '1 piece', ingredients: ['pasta sheets', 'beef', 'ricotta', 'tomato sauce', 'mozzarella'] },
  'sushi': { calories: 200, serving: '6 pieces', ingredients: ['rice', 'fish', 'nori', 'wasabi', 'soy sauce'] },
  'ramen': { calories: 380, serving: '1 bowl', ingredients: ['noodles', 'broth', 'pork', 'egg', 'nori', 'scallion'] },
  'noodle': { calories: 220, serving: '1 cup', ingredients: ['wheat noodles', 'broth'] },
  'fried rice': { calories: 340, serving: '1 plate', ingredients: ['rice', 'egg', 'soy sauce', 'vegetables', 'oil'] },
  'rice': { calories: 205, serving: '1 cup', ingredients: ['rice'] },
  'dumpling': { calories: 250, serving: '6 dumplings', ingredients: ['dough', 'pork', 'cabbage', 'ginger'] },
  'spring roll': { calories: 130, serving: '2 rolls', ingredients: ['wrapper', 'vegetables', 'shrimp'] },
  'egg roll': { calories: 220, serving: '1 roll', ingredients: ['wrapper', 'cabbage', 'pork', 'carrot'] },
  'wonton': { calories: 180, serving: '6 wontons', ingredients: ['wrapper', 'pork', 'shrimp', 'ginger'] },
  'dim sum': { calories: 200, serving: '4 pieces', ingredients: ['dough', 'shrimp', 'pork', 'vegetables'] },
  'fried chicken': { calories: 320, serving: '1 piece', ingredients: ['chicken', 'flour', 'oil', 'spices'] },
  'grilled chicken': { calories: 230, serving: '1 breast', ingredients: ['chicken', 'oil', 'herbs', 'salt'] },
  'rotisserie chicken': { calories: 260, serving: '1 serving', ingredients: ['chicken', 'herbs', 'salt', 'pepper'] },
  'chicken wing': { calories: 320, serving: '6 wings', ingredients: ['chicken wings', 'sauce', 'butter'] },
  'salmon': { calories: 280, serving: '6 oz', ingredients: ['salmon fillet', 'lemon', 'herbs'] },
  'lobster': { calories: 130, serving: '1 tail', ingredients: ['lobster', 'butter', 'lemon'] },
  'crab': { calories: 97, serving: '3 oz', ingredients: ['crab meat', 'lemon'] },
  'shrimp': { calories: 85, serving: '3 oz', ingredients: ['shrimp', 'garlic', 'butter'] },
  'clam': { calories: 73, serving: '3 oz', ingredients: ['clam'] },
  'oyster': { calories: 70, serving: '6 oysters', ingredients: ['oyster', 'lemon'] },
  'scallop': { calories: 95, serving: '3 oz', ingredients: ['scallop', 'butter'] },
  'salad': { calories: 120, serving: '1 bowl', ingredients: ['lettuce', 'tomato', 'cucumber', 'dressing'] },
  'caesar salad': { calories: 180, serving: '1 bowl', ingredients: ['romaine', 'parmesan', 'croutons', 'caesar dressing'] },
  'coleslaw': { calories: 150, serving: '1 cup', ingredients: ['cabbage', 'carrot', 'mayonnaise', 'vinegar'] },
  'taco salad': { calories: 350, serving: '1 bowl', ingredients: ['lettuce', 'beef', 'cheese', 'tortilla chips', 'salsa'] },
  'eggs benedict': { calories: 400, serving: '1 serving', ingredients: ['english muffin', 'poached egg', 'ham', 'hollandaise'] },
  'omelet': { calories: 250, serving: '1 omelet', ingredients: ['eggs', 'cheese', 'vegetables', 'butter'] },
  'scrambled eggs': { calories: 200, serving: '2 eggs', ingredients: ['eggs', 'butter', 'milk', 'salt'] },
  'fried egg': { calories: 90, serving: '1 egg', ingredients: ['egg', 'oil', 'salt'] },
  'popcorn': { calories: 380, serving: '3 cups', ingredients: ['corn kernels', 'butter', 'salt'] },
  'nachos': { calories: 350, serving: '1 plate', ingredients: ['tortilla chips', 'cheese', 'jalapeño', 'salsa', 'sour cream'] },
  'hummus': { calories: 170, serving: '1/3 cup', ingredients: ['chickpeas', 'tahini', 'lemon', 'garlic', 'olive oil'] },
  'falafel': { calories: 330, serving: '6 pieces', ingredients: ['chickpeas', 'herbs', 'onion', 'garlic', 'spices'] },
  'kebab': { calories: 280, serving: '1 skewer', ingredients: ['meat', 'vegetables', 'spices'] },
  'curry': { calories: 300, serving: '1 cup', ingredients: ['meat', 'onion', 'tomato', 'spices', 'coconut milk'] },
  'paella': { calories: 350, serving: '1 plate', ingredients: ['rice', 'saffron', 'seafood', 'chicken', 'vegetables'] },
  'risotto': { calories: 320, serving: '1 plate', ingredients: ['arborio rice', 'broth', 'parmesan', 'butter', 'onion'] },
  'gnocchi': { calories: 250, serving: '1 plate', ingredients: ['potato', 'flour', 'egg', 'sauce'] },
  'ceviche': { calories: 150, serving: '1 cup', ingredients: ['fish', 'lime juice', 'onion', 'cilantro', 'chili'] },
  'granola': { calories: 300, serving: '1/2 cup', ingredients: ['oats', 'honey', 'nuts', 'dried fruit'] },
  'yogurt': { calories: 150, serving: '1 cup', ingredients: ['milk', 'live cultures'] },
  'cheese': { calories: 110, serving: '1 oz', ingredients: ['milk', 'rennet', 'salt'] },
  'cheddar': { calories: 113, serving: '1 oz', ingredients: ['milk', 'rennet', 'salt', 'annatto'] },
  'brie': { calories: 95, serving: '1 oz', ingredients: ['milk', 'cream', 'rennet'] },
  'fondue': { calories: 250, serving: '1/2 cup', ingredients: ['cheese', 'wine', 'garlic', 'bread'] },
  'espresso': { calories: 5, serving: '1 shot', ingredients: ['espresso'] },
  'cappuccino': { calories: 120, serving: '1 cup', ingredients: ['espresso', 'steamed milk', 'foam'] },
  'latte': { calories: 150, serving: '1 cup', ingredients: ['espresso', 'steamed milk'] },
  'smoothie': { calories: 250, serving: '1 cup', ingredients: ['fruit', 'yogurt', 'milk', 'ice'] },
  'milkshake': { calories: 400, serving: '1 glass', ingredients: ['ice cream', 'milk', 'syrup'] },
  'wine': { calories: 125, serving: '5 oz', ingredients: ['grape', 'yeast'] },
  'beer': { calories: 150, serving: '12 oz', ingredients: ['barley', 'hops', 'yeast', 'water'] },
  'cocktail': { calories: 180, serving: '1 glass', ingredients: ['spirits', 'mixer', 'garnish'] },
  'juice': { calories: 110, serving: '1 cup', ingredients: ['fruit juice'] },
};

// ImageNet labels that map to food database keys
const LABEL_TO_FOOD: Record<string, string> = {
  'cheeseburger': 'cheeseburger',
  'hamburger': 'hamburger',
  'pizza, pizza pie': 'pizza',
  'hotdog, hot dog, red hot': 'hotdog',
  'French loaf': 'french loaf',
  'pretzel': 'pretzel',
  'bagel, beigel': 'bagel',
  'mashed potato': 'rice',
  'mushroom': 'mushroom',
  'banana': 'banana',
  'strawberry': 'strawberry',
  'orange': 'orange',
  'lemon': 'lemon',
  'fig': 'fig',
  'pineapple, ananas': 'pineapple',
  'jackfruit, jak, jack': 'jackfruit',
  'custard apple': 'custard apple',
  'pomegranate': 'pomegranate',
  'Granny Smith': 'granny smith',
  'head cabbage': 'cabbage',
  'broccoli': 'broccoli',
  'cauliflower': 'cauliflower',
  'zucchini, courgette': 'zucchini',
  'cucumber, cuke': 'cucumber',
  'bell pepper': 'bell pepper',
  'artichoke, globe artichoke': 'artichoke',
  'cardoon': 'cardoon',
  'spaghetti squash': 'spaghetti squash',
  'acorn squash': 'acorn squash',
  'butternut squash': 'butternut squash',
  'carbonara': 'carbonara',
  'ice cream, icecream': 'ice cream',
  'ice lolly, lolly, lollipop, popsicle': 'ice lolly',
  'chocolate sauce, chocolate syrup': 'chocolate sauce',
  'dough': 'dough',
  'meat loaf, meatloaf': 'meatloaf',
  'consomme': 'consomme',
  'potpie': 'potpie',
  'burrito': 'burrito',
  'trifle': 'trifle',
  'espresso': 'espresso',
  'guacamole': 'guacamole',
  'French fries': 'french fries',
  'corn': 'corn',
  'ear, spike, capitulum': 'corn',
  'hen-of-the-woods': 'mushroom',
  'bolete': 'mushroom',
  'agaric': 'mushroom',
  'wine bottle': 'wine',
  'beer bottle': 'beer',
  'beer glass': 'beer',
  'cocktail shaker': 'cocktail',
  'pop bottle, soda bottle': 'juice',
  'water bottle': 'juice',
  'cup': 'espresso',
  'coffee mug': 'espresso',
  'eggnog': 'milkshake',
  'goblet': 'wine',
  'red wine': 'wine',
  'bakery': 'bread',
  'grocery store': 'salad',
  'rotisserie': 'rotisserie chicken',
  'wok': 'fried rice',
  'frying pan': 'fried egg',
  'spatula': 'pancake',
  'plate': 'salad',
};

// ImageNet food-related class IDs (partial list for detection)
const FOOD_LABELS = new Set([
  ...Object.keys(LABEL_TO_FOOD),
  ...Object.keys(FOOD_DB),
]);

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

function lookupFood(rawLabel: string): { key: string; entry: FoodEntry } | null {
  // Try direct mapping first
  if (LABEL_TO_FOOD[rawLabel]) {
    const key = LABEL_TO_FOOD[rawLabel];
    if (FOOD_DB[key]) return { key, entry: FOOD_DB[key] };
  }

  // Try normalized label
  const normalized = normalizeLabel(rawLabel);
  if (FOOD_DB[normalized]) return { key: normalized, entry: FOOD_DB[normalized] };

  // Try partial match
  for (const [dbKey, entry] of Object.entries(FOOD_DB)) {
    if (normalized.includes(dbKey) || dbKey.includes(normalized)) {
      return { key: dbKey, entry };
    }
  }

  // Try matching individual words
  const words = normalized.split(/[\s,]+/).filter(w => w.length > 3);
  for (const word of words) {
    if (FOOD_DB[word]) return { key: word, entry: FOOD_DB[word] };
  }

  return null;
}

function isLikelyFood(label: string): boolean {
  const normalized = normalizeLabel(label);
  if (FOOD_LABELS.has(label)) return true;
  for (const key of FOOD_LABELS) {
    if (normalized.includes(normalizeLabel(key))) return true;
  }
  // Check for food-related keywords
  const foodKeywords = ['food', 'dish', 'meal', 'fruit', 'vegetable', 'meat', 'bread', 'cake', 'sauce', 'soup', 'salad', 'cheese', 'egg', 'fish', 'rice', 'pasta', 'cream', 'pie', 'loaf'];
  return foodKeywords.some(k => normalized.includes(k));
}

export async function analyzeFood(image: ImageData | HTMLImageElement | HTMLCanvasElement | string): Promise<FoodResult> {
  if (!classifier) {
    return {
      dish: '',
      confidence: 0,
      calories: null,
      serving: null,
      ingredients: [],
      isFood: false,
      rawLabel: '',
      modelStatus: _modelStatus,
    };
  }

  const results = await classifier(image, { topk: 5 });
  const top = results[0];
  const rawLabel = top.label;
  const confidence = top.score;

  // Try to find a food match from top 5 results
  for (const result of results) {
    const food = lookupFood(result.label);
    if (food) {
      return {
        dish: food.key.replace(/\b\w/g, c => c.toUpperCase()),
        confidence: result.score,
        calories: food.entry.calories,
        serving: food.entry.serving,
        ingredients: food.entry.ingredients,
        isFood: true,
        rawLabel: result.label,
        modelStatus: 'ready',
      };
    }
  }

  // Check if top label seems food-related but not in DB
  if (isLikelyFood(rawLabel)) {
    const name = normalizeLabel(rawLabel).replace(/\b\w/g, c => c.toUpperCase());
    return {
      dish: name,
      confidence,
      calories: null,
      serving: null,
      ingredients: [],
      isFood: true,
      rawLabel,
      modelStatus: 'ready',
    };
  }

  // Not food
  const detectedName = normalizeLabel(rawLabel).replace(/\b\w/g, c => c.toUpperCase());
  return {
    dish: detectedName,
    confidence,
    calories: null,
    serving: null,
    ingredients: [],
    isFood: false,
    rawLabel,
    modelStatus: 'ready',
  };
}
