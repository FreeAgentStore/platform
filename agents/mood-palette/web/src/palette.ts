/**
 * Mood Palette — color extraction + generation logic.
 * Image mode: canvas pixel sampling + frequency binning.
 * Text mode: Chrome Built-in AI with heuristic fallback.
 */

export type Color = { hex: string; name: string };

// ── Color name lookup (~50 common names) ──────────────────────────────

const COLOR_NAMES: [number, number, number, string][] = [
  [0, 0, 0, 'Black'], [255, 255, 255, 'White'], [128, 128, 128, 'Gray'],
  [192, 192, 192, 'Silver'], [64, 64, 64, 'Charcoal'],
  [255, 0, 0, 'Red'], [200, 0, 0, 'Crimson'], [139, 0, 0, 'Dark Red'],
  [255, 99, 71, 'Tomato'], [255, 69, 0, 'Red-Orange'],
  [255, 165, 0, 'Orange'], [255, 140, 0, 'Dark Orange'], [255, 200, 50, 'Amber'],
  [255, 255, 0, 'Yellow'], [255, 215, 0, 'Gold'], [240, 230, 140, 'Khaki'],
  [0, 128, 0, 'Green'], [0, 200, 0, 'Lime'], [34, 139, 34, 'Forest Green'],
  [144, 238, 144, 'Light Green'], [0, 100, 0, 'Dark Green'], [50, 205, 50, 'Lime Green'],
  [0, 128, 128, 'Teal'], [0, 206, 209, 'Turquoise'], [64, 224, 208, 'Aquamarine'],
  [0, 0, 255, 'Blue'], [0, 0, 200, 'Medium Blue'], [0, 0, 139, 'Dark Blue'],
  [30, 144, 255, 'Dodger Blue'], [100, 149, 237, 'Cornflower'], [135, 206, 235, 'Sky Blue'],
  [173, 216, 230, 'Light Blue'], [0, 191, 255, 'Deep Sky Blue'],
  [70, 130, 180, 'Steel Blue'], [25, 25, 112, 'Midnight Blue'],
  [75, 0, 130, 'Indigo'], [128, 0, 128, 'Purple'], [148, 103, 189, 'Medium Purple'],
  [186, 85, 211, 'Orchid'], [216, 191, 216, 'Thistle'], [238, 130, 238, 'Violet'],
  [255, 0, 255, 'Magenta'], [199, 21, 133, 'Medium Violet Red'],
  [255, 105, 180, 'Hot Pink'], [255, 182, 193, 'Light Pink'], [255, 192, 203, 'Pink'],
  [220, 20, 60, 'Crimson Red'], [178, 34, 34, 'Firebrick'],
  [210, 180, 140, 'Tan'], [222, 184, 135, 'Burlywood'], [139, 90, 43, 'Brown'],
  [160, 82, 45, 'Sienna'], [245, 245, 220, 'Beige'], [255, 228, 196, 'Bisque'],
  [255, 248, 220, 'Cornsilk'], [250, 235, 215, 'Antique White'],
  [255, 127, 80, 'Coral'], [233, 150, 122, 'Dark Salmon'], [250, 128, 114, 'Salmon'],
];

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

export function colorName(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  let best = 'Unknown';
  let bestDist = Infinity;
  for (const [cr, cg, cb, name] of COLOR_NAMES) {
    const d = colorDistance(r, g, b, cr, cg, cb);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

// ── Image color extraction ────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) {
    const v = Math.round(l * 255);
    return rgbToHex(v, v, v);
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgbToHex(
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  );
}

interface Bin {
  r: number;
  g: number;
  b: number;
  count: number;
}

export function extractColorsFromImage(canvas: HTMLCanvasElement, count = 5): Color[] {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  // Quantize to 4-bit per channel for binning
  const bins = new Map<string, Bin>();
  const step = Math.max(1, Math.floor(data.length / 4 / 10000)); // sample ~10k pixels max

  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue; // skip transparent

    // Skip near-white and near-black (less interesting)
    const [, s, l] = rgbToHsl(r, g, b);
    if (l > 0.95 || l < 0.05) continue;

    const qr = (r >> 4) << 4;
    const qg = (g >> 4) << 4;
    const qb = (b >> 4) << 4;
    const key = `${qr},${qg},${qb}`;

    const existing = bins.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count++;
    } else {
      bins.set(key, { r, g, b, count: 1 });
    }
  }

  // Sort bins by count, pick top, then ensure diversity
  const sorted = [...bins.values()].sort((a, b) => b.count - a.count);
  const result: Color[] = [];
  const minDistance = 2500; // minimum squared RGB distance between selected colors

  for (const bin of sorted) {
    if (result.length >= count) break;
    const avgR = Math.round(bin.r / bin.count);
    const avgG = Math.round(bin.g / bin.count);
    const avgB = Math.round(bin.b / bin.count);

    // Ensure this color is sufficiently different from already-selected ones
    const tooClose = result.some(c => {
      const cr = parseInt(c.hex.slice(1, 3), 16);
      const cg = parseInt(c.hex.slice(3, 5), 16);
      const cb = parseInt(c.hex.slice(5, 7), 16);
      return colorDistance(avgR, avgG, avgB, cr, cg, cb) < minDistance;
    });
    if (tooClose) continue;

    const hex = rgbToHex(avgR, avgG, avgB);
    result.push({ hex, name: colorName(hex) });
  }

  // If we didn't get enough (e.g. very uniform image), fill from remaining bins
  for (const bin of sorted) {
    if (result.length >= count) break;
    const avgR = Math.round(bin.r / bin.count);
    const avgG = Math.round(bin.g / bin.count);
    const avgB = Math.round(bin.b / bin.count);
    const hex = rgbToHex(avgR, avgG, avgB);
    if (result.some(c => c.hex === hex)) continue;
    result.push({ hex, name: colorName(hex) });
  }

  return result.slice(0, count);
}

// ── Text-to-palette: Chrome Built-in AI ───────────────────────────────

async function tryBuiltInAI(text: string): Promise<Color[] | null> {
  try {
    // Chrome Built-in AI (Prompt API)
    const factory = (globalThis as any).LanguageModel ?? (globalThis as any).ai?.languageModel;
    if (!factory?.create) return null;

    const model = await factory.create();
    const prompt = `Generate exactly 5 colors that match this mood/vibe: "${text}".
Return ONLY a JSON array of objects with "hex" (6-digit hex like #ff5533) and "name" (creative color name, 1-3 words). No markdown, no explanation. Example:
[{"hex":"#2a4858","name":"Deep Ocean"},{"hex":"#f4a261","name":"Sandy Gold"},{"hex":"#e76f51","name":"Burnt Sienna"},{"hex":"#264653","name":"Dark Teal"},{"hex":"#e9c46a","name":"Warm Honey"}]`;

    const response = await model.prompt(prompt);
    const match = response.match(/\[[\s\S]*?\]/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length < 3) return null;

    return parsed.slice(0, 5).map((c: any) => ({
      hex: String(c.hex).startsWith('#') ? String(c.hex).slice(0, 7) : `#${String(c.hex).slice(0, 6)}`,
      name: String(c.name || colorName(String(c.hex))),
    }));
  } catch {
    return null;
  }
}

// ── Heuristic keyword→palette fallback ────────────────────────────────

const MOOD_PALETTES: Record<string, string[][]> = {
  ocean:    [['#0a3d62', 'Deep Ocean'], ['#1289a7', 'Cerulean'], ['#38ada9', 'Teal Wave'], ['#82ccdd', 'Seafoam'], ['#dff9fb', 'Ocean Mist']],
  sea:      [['#006266', 'Dark Sea'], ['#009432', 'Sea Green'], ['#0652dd', 'Ocean Blue'], ['#c4e0e5', 'Sea Spray'], ['#b8e994', 'Seaweed']],
  sunset:   [['#eb4d4b', 'Sunset Red'], ['#f0932b', 'Amber Glow'], ['#f9ca24', 'Golden Hour'], ['#6ab04c', 'Twilight Green'], ['#30336b', 'Dusk Indigo']],
  sunrise:  [['#ffc312', 'Morning Gold'], ['#ee5a24', 'Dawn Ember'], ['#f79f1f', 'Sunrise Amber'], ['#a3cb38', 'New Leaf'], ['#c4e0f9', 'Early Sky']],
  forest:   [['#1b4332', 'Deep Forest'], ['#2d6a4f', 'Fern'], ['#40916c', 'Moss'], ['#74c69d', 'Sage'], ['#d8f3dc', 'Morning Dew']],
  nature:   [['#2d6a4f', 'Forest Green'], ['#8d5524', 'Earth Brown'], ['#87ceeb', 'Sky'], ['#f4a460', 'Sandy Gold'], ['#90ee90', 'Spring Green']],
  neon:     [['#ff00ff', 'Neon Magenta'], ['#00ff00', 'Neon Green'], ['#ff3838', 'Neon Red'], ['#17c0eb', 'Electric Cyan'], ['#fff200', 'Neon Yellow']],
  cyberpunk:[['#ff006e', 'Cyber Pink'], ['#3a86ff', 'Digital Blue'], ['#8338ec', 'Neon Purple'], ['#06d6a0', 'Matrix Green'], ['#1a1a2e', 'Void']],
  cozy:     [['#8d6e63', 'Warm Cocoa'], ['#d7ccc8', 'Linen'], ['#a1887f', 'Taupe'], ['#ffab91', 'Peach Glow'], ['#4e342e', 'Dark Chocolate']],
  autumn:   [['#bf360c', 'Burnt Orange'], ['#e65100', 'Pumpkin'], ['#f9a825', 'Harvest Gold'], ['#795548', 'Bark'], ['#4e342e', 'Walnut']],
  fall:     [['#cc5500', 'Autumn Leaf'], ['#8b4513', 'Saddle Brown'], ['#daa520', 'Goldenrod'], ['#556b2f', 'Olive Drab'], ['#a0522d', 'Sienna']],
  pastel:   [['#ffd1dc', 'Pastel Pink'], ['#b5ead7', 'Mint Cream'], ['#c7ceea', 'Lavender Mist'], ['#ffdac1', 'Peach Puff'], ['#e2f0cb', 'Lime Cream']],
  moody:    [['#2c3e50', 'Storm'], ['#34495e', 'Slate'], ['#7f8c8d', 'Overcast'], ['#95a5a6', 'Silver Cloud'], ['#1a1a2e', 'Midnight']],
  dark:     [['#0d0d0d', 'Obsidian'], ['#1a1a2e', 'Deep Night'], ['#16213e', 'Navy Ink'], ['#0f3460', 'Dark Sapphire'], ['#533483', 'Shadow Purple']],
  arctic:   [['#d6eaf8', 'Ice Blue'], ['#aed6f1', 'Glacier'], ['#85c1e9', 'Arctic Sky'], ['#5dade2', 'Polar Blue'], ['#2e86c1', 'Deep Frost']],
  winter:   [['#cce5ff', 'Frost'], ['#99ccff', 'Ice'], ['#6699cc', 'Winter Sky'], ['#336699', 'Cold Blue'], ['#f0f0f0', 'Snow']],
  tropical: [['#ff6b6b', 'Hibiscus'], ['#feca57', 'Pineapple'], ['#48dbfb', 'Lagoon'], ['#ff9ff3', 'Flamingo'], ['#00d2d3', 'Tropical Sea']],
  beach:    [['#f5deb3', 'Sand'], ['#00bfff', 'Ocean Azure'], ['#ff7f50', 'Coral'], ['#228b22', 'Palm Green'], ['#fff8dc', 'Seashell']],
  romantic: [['#ff6b81', 'Rose'], ['#c44569', 'Deep Rose'], ['#e66767', 'Blush'], ['#f5cdc7', 'Petal Pink'], ['#574b90', 'Amethyst']],
  love:     [['#e74c3c', 'Passion Red'], ['#ff6b81', 'Rose Pink'], ['#c0392b', 'Deep Love'], ['#fdcb6e', 'Warm Gold'], ['#fab1a0', 'Soft Blush']],
  elegant:  [['#1a1a1a', 'Onyx'], ['#c9b037', 'Antique Gold'], ['#f5f5f5', 'Pearl'], ['#2c3e50', 'Charcoal'], ['#8e6f3e', 'Bronze']],
  luxury:   [['#000000', 'Jet Black'], ['#d4af37', 'Gold'], ['#800020', 'Burgundy'], ['#36454f', 'Charcoal'], ['#fffff0', 'Ivory']],
  fire:     [['#ff0000', 'Flame Red'], ['#ff4500', 'Fire Orange'], ['#ff6600', 'Blaze'], ['#ffcc00', 'Ember'], ['#990000', 'Deep Ember']],
  earth:    [['#8d6e63', 'Clay'], ['#5d4037', 'Rich Soil'], ['#a1887f', 'Sandstone'], ['#6d4c41', 'Umber'], ['#d7ccc8', 'Desert Sand']],
  space:    [['#0b0c10', 'Void'], ['#1f2833', 'Nebula Dark'], ['#c5c6c7', 'Starlight'], ['#45a29e', 'Cosmic Teal'], ['#66fcf1', 'Plasma']],
  galaxy:   [['#0d0221', 'Deep Space'], ['#3d1c56', 'Nebula Purple'], ['#6b3fa0', 'Cosmic Violet'], ['#e7a61a', 'Star Gold'], ['#ffffff', 'Starlight']],
  retro:    [['#ff6f61', 'Retro Coral'], ['#6b5b95', 'Retro Purple'], ['#feb236', 'Retro Yellow'], ['#d64161', 'Retro Pink'], ['#ff7b25', 'Retro Orange']],
  vintage:  [['#d4a574', 'Parchment'], ['#8b7355', 'Sepia'], ['#c8ad7f', 'Old Gold'], ['#a0785a', 'Aged Leather'], ['#f5f0e1', 'Antique White']],
  candy:    [['#ff69b4', 'Bubblegum'], ['#dda0dd', 'Plum Candy'], ['#ff6347', 'Cherry Drop'], ['#7fff00', 'Sour Apple'], ['#ffd700', 'Lemon Drop']],
  rainbow:  [['#ff0000', 'Red'], ['#ff8c00', 'Orange'], ['#ffd700', 'Yellow'], ['#00c853', 'Green'], ['#2979ff', 'Blue']],
  calm:     [['#b2dfdb', 'Soft Teal'], ['#e0f2f1', 'Whisper Mint'], ['#80cbc4', 'Serene Sea'], ['#b3e5fc', 'Light Breeze'], ['#e8eaf6', 'Lavender Haze']],
  zen:      [['#dcedc8', 'Zen Green'], ['#f1f8e9', 'Bamboo White'], ['#aed581', 'Leaf'], ['#c8e6c9', 'Jade Mist'], ['#8d6e63', 'Wood']],
  happy:    [['#ffd700', 'Sunshine'], ['#ff6347', 'Joy Red'], ['#32cd32', 'Lively Green'], ['#ff69b4', 'Happy Pink'], ['#00bfff', 'Cheerful Blue']],
  sad:      [['#4a6fa5', 'Melancholy Blue'], ['#6c7a89', 'Dull Gray'], ['#3d3d3d', 'Shadow'], ['#7f8fa6', 'Misty'], ['#2c3a47', 'Twilight']],
  minimal:  [['#ffffff', 'White'], ['#f5f5f5', 'Off White'], ['#e0e0e0', 'Light Gray'], ['#9e9e9e', 'Gray'], ['#212121', 'Near Black']],
  warm:     [['#e74c3c', 'Warm Red'], ['#f39c12', 'Warm Amber'], ['#d35400', 'Terracotta'], ['#c0392b', 'Brick'], ['#f1c40f', 'Warm Gold']],
  cool:     [['#2980b9', 'Cool Blue'], ['#3498db', 'Sky Blue'], ['#1abc9c', 'Cool Teal'], ['#2ecc71', 'Cool Mint'], ['#8e44ad', 'Cool Purple']],
};

function randomHarmoniousPalette(): Color[] {
  const baseHue = Math.random();
  const schemes = [
    // Analogous
    [0, 0.08, 0.16, -0.08, -0.16],
    // Complementary + neighbors
    [0, 0.5, 0.08, 0.5 + 0.08, -0.08],
    // Triadic
    [0, 1 / 3, 2 / 3, 0.05, 1 / 3 + 0.05],
    // Split complementary
    [0, 0.42, 0.58, 0.08, -0.08],
  ];
  const offsets = schemes[Math.floor(Math.random() * schemes.length)];
  return offsets.map((offset, i) => {
    const h = (baseHue + offset + 1) % 1;
    const s = 0.5 + Math.random() * 0.3;
    const l = 0.25 + (i / (offsets.length - 1)) * 0.45;
    const hex = hslToHex(h, s, l);
    return { hex, name: colorName(hex) };
  });
}

export function heuristicPalette(text: string): Color[] {
  const lower = text.toLowerCase();

  // Check each mood keyword
  for (const [keyword, palette] of Object.entries(MOOD_PALETTES)) {
    if (lower.includes(keyword)) {
      return palette.map(([hex, name]) => ({ hex, name }));
    }
  }

  // No match — generate a random harmonious palette
  return randomHarmoniousPalette();
}

// ── Public API: generate palette from text ────────────────────────────

export async function generateFromText(text: string): Promise<{ colors: Color[]; source: 'Chrome AI' | 'Heuristic' }> {
  const aiResult = await tryBuiltInAI(text);
  if (aiResult) {
    return { colors: aiResult, source: 'Chrome AI' };
  }
  return { colors: heuristicPalette(text), source: 'Heuristic' };
}
