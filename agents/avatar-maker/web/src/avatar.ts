/**
 * Avatar generation heuristics — pure Canvas 2D, no AI model needed.
 * 10 styles with configurable parameters.
 */

export type Style =
  | 'pixel'
  | 'mosaic'
  | 'silhouette'
  | 'geometric'
  | 'halftone'
  | 'ascii'
  | 'stained-glass'
  | 'posterize'
  | 'pointillism'
  | 'low-poly';

export interface AvatarParams {
  style: Style;
  size: number;
  gridSize?: number;
  tileShape?: 'square' | 'circle' | 'hexagon';
  threshold?: number;
  dotSpacing?: number;
  fontSize?: number;
  colorLevels?: number;
  pointCount?: number;
  colorMode?: string;
  background?: string;
  outline?: boolean;
  invert?: boolean;
  gradientDirection?: 'diagonal' | 'radial' | 'horizontal';
  shapeCount?: number;
}

/** Extract dominant colors from a canvas using frequency binning. */
export function extractColors(source: HTMLCanvasElement, count = 5): string[] {
  const ctx = source.getContext('2d')!;
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;

  // Bin colors into a reduced palette (5-bit per channel = 32768 buckets)
  const bins = new Map<number, { r: number; g: number; b: number; count: number }>();
  const step = Math.max(1, Math.floor(data.length / 4 / 10000)); // sample up to ~10k pixels

  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue; // skip transparent

    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bin = bins.get(key);
    if (bin) {
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.count++;
    } else {
      bins.set(key, { r, g, b, count: 1 });
    }
  }

  // Sort by frequency, take top N
  const sorted = [...bins.values()].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, count);

  return top.map((bin) => {
    const r = Math.round(bin.r / bin.count);
    const g = Math.round(bin.g / bin.count);
    const b = Math.round(bin.b / bin.count);
    return `rgb(${r},${g},${b})`;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get scaled source image data at a given size (square). */
function getScaledImageData(source: HTMLCanvasElement, size: number): ImageData {
  const tmp = document.createElement('canvas');
  tmp.width = size;
  tmp.height = size;
  const ctx = tmp.getContext('2d')!;
  ctx.drawImage(source, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

/** Luminance of an RGB pixel. */
function luminance(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

/** Simple seeded PRNG from image data. */
function makeRng(source: HTMLCanvasElement): () => number {
  const srcCtx = source.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, source.width, source.height).data;
  let seed = 0;
  for (let i = 0; i < Math.min(srcData.length, 400); i += 4) {
    seed = (seed + srcData[i] + srcData[i + 1] * 3 + srcData[i + 2] * 7) | 0;
  }
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 10000) / 10000;
  };
}

/** Average color in a rectangular region of ImageData. */
function regionAvgColor(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number, number] {
  let rS = 0,
    gS = 0,
    bS = 0,
    n = 0;
  for (let y = Math.max(0, y0); y < Math.min(y1, width); y++) {
    for (let x = Math.max(0, x0); x < Math.min(x1, width); x++) {
      const i = (y * width + x) * 4;
      rS += data[i];
      gS += data[i + 1];
      bS += data[i + 2];
      n++;
    }
  }
  if (n === 0) return [128, 128, 128];
  return [Math.round(rS / n), Math.round(gS / n), Math.round(bS / n)];
}

// ---------------------------------------------------------------------------
// 1. Pixel Art
// ---------------------------------------------------------------------------

function generatePixelArt(source: HTMLCanvasElement, params: AvatarParams): HTMLCanvasElement {
  const gridSize = params.gridSize ?? 16;
  const size = params.size;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Downscale to grid
  const tmp = document.createElement('canvas');
  tmp.width = gridSize;
  tmp.height = gridSize;
  const tmpCtx = tmp.getContext('2d')!;
  tmpCtx.imageSmoothingEnabled = true;
  tmpCtx.drawImage(source, 0, 0, gridSize, gridSize);

  const pixelData = tmpCtx.getImageData(0, 0, gridSize, gridSize).data;
  const cellSize = size / gridSize;

  // Background
  ctx.fillStyle = params.background ?? '#000';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const i = (y * gridSize + x) * 4;
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      ctx.fillStyle = `rgb(${r},${g},${b})`;

      const px = Math.floor(x * cellSize);
      const py = Math.floor(y * cellSize);
      const pw = Math.ceil(cellSize);
      const ph = Math.ceil(cellSize);

      if (params.outline) {
        // Leave 1px gap for outline effect
        const gap = Math.max(1, Math.floor(cellSize * 0.08));
        ctx.fillRect(px + gap, py + gap, pw - gap * 2, ph - gap * 2);
      } else {
        ctx.fillRect(px, py, pw, ph);
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// 2. Mosaic
// ---------------------------------------------------------------------------

function generateMosaic(source: HTMLCanvasElement, params: AvatarParams): HTMLCanvasElement {
  const tileCount = 12;
  const size = params.size;
  const shape = params.tileShape ?? 'square';
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  ctx.fillStyle = params.background ?? '#111';
  ctx.fillRect(0, 0, size, size);

  const imgData = getScaledImageData(source, size);
  const data = imgData.data;
  const tileSize = size / tileCount;

  for (let ty = 0; ty < tileCount; ty++) {
    for (let tx = 0; tx < tileCount; tx++) {
      const x0 = Math.floor(tx * tileSize);
      const y0 = Math.floor(ty * tileSize);
      const x1 = Math.floor((tx + 1) * tileSize);
      const y1 = Math.floor((ty + 1) * tileSize);

      const [r, g, b] = regionAvgColor(data, size, x0, y0, x1, y1);
      ctx.fillStyle = `rgb(${r},${g},${b})`;

      const gap = Math.max(1, Math.floor(tileSize * 0.06));
      const cx = x0 + tileSize / 2;
      const cy = y0 + tileSize / 2;
      const half = tileSize / 2 - gap;

      if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape === 'hexagon') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const hx = cx + half * Math.cos(angle);
          const hy = cy + half * Math.sin(angle);
          i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // square with rounded corners
        ctx.beginPath();
        ctx.roundRect(x0 + gap, y0 + gap, tileSize - gap * 2, tileSize - gap * 2, gap);
        ctx.fill();
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// 3. Silhouette
// ---------------------------------------------------------------------------

function generateSilhouette(source: HTMLCanvasElement, colors: string[], params: AvatarParams): HTMLCanvasElement {
  const size = params.size;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  const imgData = getScaledImageData(source, size);
  const data = imgData.data;
  const pixelCount = size * size;

  // Compute luminance threshold
  let totalLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalLum += luminance(data[i], data[i + 1], data[i + 2]);
  }
  const autoThreshold = totalLum / pixelCount;
  const threshold = params.threshold ?? autoThreshold;

  // Create mask
  const mask = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const lum = luminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    const isFg = params.invert ? lum >= threshold : lum < threshold;
    mask[i] = isFg ? 1 : 0;
  }

  // Background
  const bgColor = params.invert ? '#f5f5f5' : '#111';
  ctx.fillStyle = params.background ?? bgColor;
  ctx.fillRect(0, 0, size, size);

  // Gradient fill for foreground
  const dir = params.gradientDirection ?? 'diagonal';
  let grad: CanvasGradient;
  if (dir === 'radial') {
    grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  } else if (dir === 'horizontal') {
    grad = ctx.createLinearGradient(0, 0, size, 0);
  } else {
    grad = ctx.createLinearGradient(0, 0, size, size);
  }

  const c1 = colors[0] ?? '#7c3aed';
  const c2 = colors[1] ?? colors[0] ?? '#a78bfa';
  const c3 = colors[2] ?? c2;
  grad.addColorStop(0, c1);
  grad.addColorStop(0.5, c2);
  grad.addColorStop(1, c3);

  // Paint gradient to read pixel colors
  const gradCanvas = document.createElement('canvas');
  gradCanvas.width = size;
  gradCanvas.height = size;
  const gradCtx = gradCanvas.getContext('2d')!;
  gradCtx.fillStyle = grad;
  gradCtx.fillRect(0, 0, size, size);
  const gradData = gradCtx.getImageData(0, 0, size, size).data;

  const outData = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < pixelCount; i++) {
    if (mask[i]) {
      outData.data[i * 4] = gradData[i * 4];
      outData.data[i * 4 + 1] = gradData[i * 4 + 1];
      outData.data[i * 4 + 2] = gradData[i * 4 + 2];
      outData.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(outData, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// 4. Geometric — image-aware abstract shapes
// ---------------------------------------------------------------------------

function generateGeometric(source: HTMLCanvasElement, colors: string[], params: AvatarParams): HTMLCanvasElement {
  const size = params.size;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  ctx.fillStyle = params.background ?? colors[0] ?? '#333';
  ctx.fillRect(0, 0, size, size);

  const rng = makeRng(source);

  // Sample source image in regions to place shapes where color clusters are
  const sampleSize = 64;
  const imgData = getScaledImageData(source, sampleSize);
  const data = imgData.data;

  const shapeCount = params.shapeCount ?? 20;

  // Build a list of interesting points (high edge/variance regions)
  const points: { x: number; y: number; r: number; g: number; b: number; interest: number }[] = [];
  const blockSize = 4;
  for (let by = 0; by < sampleSize; by += blockSize) {
    for (let bx = 0; bx < sampleSize; bx += blockSize) {
      let rS = 0, gS = 0, bS = 0, n = 0;
      let variance = 0;
      const pixLums: number[] = [];

      for (let dy = 0; dy < blockSize && by + dy < sampleSize; dy++) {
        for (let dx = 0; dx < blockSize && bx + dx < sampleSize; dx++) {
          const i = ((by + dy) * sampleSize + (bx + dx)) * 4;
          rS += data[i]; gS += data[i + 1]; bS += data[i + 2];
          pixLums.push(luminance(data[i], data[i + 1], data[i + 2]));
          n++;
        }
      }
      const avgLum = pixLums.reduce((a, b) => a + b, 0) / n;
      variance = pixLums.reduce((a, l) => a + (l - avgLum) ** 2, 0) / n;

      points.push({
        x: (bx + blockSize / 2) / sampleSize,
        y: (by + blockSize / 2) / sampleSize,
        r: Math.round(rS / n),
        g: Math.round(gS / n),
        b: Math.round(bS / n),
        interest: variance,
      });
    }
  }

  // Sort by interest (variance) — place more shapes in interesting areas
  points.sort((a, b) => b.interest - a.interest);

  const numShapes = Math.min(shapeCount, points.length);
  for (let i = 0; i < numShapes; i++) {
    const pt = points[i];
    const cx = pt.x * size;
    const cy = pt.y * size;

    ctx.fillStyle = `rgb(${pt.r},${pt.g},${pt.b})`;
    ctx.globalAlpha = 0.4 + rng() * 0.5;

    const radius = size * (0.04 + rng() * 0.15 + (pt.interest > 200 ? 0.02 : 0.08));
    const type = Math.floor(rng() * 4);

    ctx.beginPath();
    if (type === 0) {
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    } else if (type === 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rng() * Math.PI);
      ctx.fillRect(-radius, -radius * 0.6, radius * 2, radius * 1.2);
      ctx.restore();
      ctx.fill();
      continue;
    } else if (type === 2) {
      // Triangle
      const angle = rng() * Math.PI * 2;
      for (let j = 0; j < 3; j++) {
        const a = angle + (j * Math.PI * 2) / 3;
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius;
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      // Diamond
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx + radius * 0.6, cy);
      ctx.lineTo(cx, cy + radius);
      ctx.lineTo(cx - radius * 0.6, cy);
      ctx.closePath();
    }
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  return out;
}

// ---------------------------------------------------------------------------
// 5. Halftone
// ---------------------------------------------------------------------------

function generateHalftone(source: HTMLCanvasElement, params: AvatarParams): HTMLCanvasElement {
  const size = params.size;
  const spacing = params.dotSpacing ?? 4;
  const colorMode = params.colorMode ?? 'bw';
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  // Background
  if (colorMode === 'color') {
    ctx.fillStyle = params.background ?? '#111';
  } else {
    ctx.fillStyle = params.background ?? '#fff';
  }
  ctx.fillRect(0, 0, size, size);

  const imgData = getScaledImageData(source, size);
  const data = imgData.data;

  for (let y = spacing; y < size; y += spacing * 2) {
    for (let x = spacing; x < size; x += spacing * 2) {
      const i = (Math.floor(y) * size + Math.floor(x)) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = luminance(r, g, b);

      // Dot radius inversely proportional to brightness
      const maxRadius = spacing * 0.95;
      const radius = ((255 - lum) / 255) * maxRadius;

      if (radius < 0.3) continue;

      if (colorMode === 'color') {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = '#000';
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// 6. ASCII Art
// ---------------------------------------------------------------------------

function generateAscii(source: HTMLCanvasElement, params: AvatarParams): HTMLCanvasElement {
  const size = params.size;
  const fontSize = params.fontSize ?? 8;
  const colorMode = params.colorMode ?? 'terminal';
  const chars = ' .:-=+*#%@';

  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  // Background
  ctx.fillStyle = params.background ?? '#000';
  ctx.fillRect(0, 0, size, size);

  // Compute columns and rows based on font size
  const charW = fontSize * 0.6;
  const charH = fontSize;
  const cols = Math.floor(size / charW);
  const rows = Math.floor(size / charH);

  // Get source image scaled to grid
  const imgData = getScaledImageData(source, Math.max(cols, rows));
  const data = imgData.data;
  const imgW = Math.max(cols, rows);

  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = 'top';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Map col/row to image coordinates
      const ix = Math.floor((col / cols) * imgW);
      const iy = Math.floor((row / rows) * imgW);
      const i = (iy * imgW + ix) * 4;

      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = luminance(r, g, b);

      // Map brightness to character
      const charIdx = Math.floor((lum / 255) * (chars.length - 1));
      const ch = chars[charIdx];

      if (ch === ' ') continue;

      if (colorMode === 'terminal') {
        ctx.fillStyle = `rgb(0,${Math.floor(150 + (lum / 255) * 105)},0)`;
      } else if (colorMode === 'color') {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        // mono
        ctx.fillStyle = `rgb(${Math.floor(lum)},${Math.floor(lum)},${Math.floor(lum)})`;
      }

      ctx.fillText(ch, col * charW, row * charH);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// 7. Stained Glass — Voronoi cells with thick borders
// ---------------------------------------------------------------------------

function generateStainedGlass(source: HTMLCanvasElement, params: AvatarParams): HTMLCanvasElement {
  const size = params.size;
  const cellCount = params.pointCount ?? 150;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  const rng = makeRng(source);
  const imgData = getScaledImageData(source, size);
  const data = imgData.data;

  // Generate seed points
  const seeds: { x: number; y: number }[] = [];
  for (let i = 0; i < cellCount; i++) {
    seeds.push({ x: rng() * size, y: rng() * size });
  }

  // Assign each pixel to nearest seed (Voronoi)
  const cellMap = new Int32Array(size * size);
  // Cell color accumulators
  const cellR = new Float64Array(cellCount);
  const cellG = new Float64Array(cellCount);
  const cellB = new Float64Array(cellCount);
  const cellN = new Float64Array(cellCount);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let minDist = Infinity;
      let nearest = 0;
      for (let s = 0; s < seeds.length; s++) {
        const dx = x - seeds[s].x;
        const dy = y - seeds[s].y;
        const d = dx * dx + dy * dy;
        if (d < minDist) {
          minDist = d;
          nearest = s;
        }
      }
      cellMap[y * size + x] = nearest;
      const i = (y * size + x) * 4;
      cellR[nearest] += data[i];
      cellG[nearest] += data[i + 1];
      cellB[nearest] += data[i + 2];
      cellN[nearest]++;
    }
  }

  // Compute average colors
  const cellColors: [number, number, number][] = [];
  for (let c = 0; c < cellCount; c++) {
    if (cellN[c] > 0) {
      cellColors.push([
        Math.round(cellR[c] / cellN[c]),
        Math.round(cellG[c] / cellN[c]),
        Math.round(cellB[c] / cellN[c]),
      ]);
    } else {
      cellColors.push([128, 128, 128]);
    }
  }

  // Paint cells
  const outImg = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const cell = cellMap[idx];
      const [r, g, b] = cellColors[cell];

      // Check if this pixel is on a border (neighbor has different cell)
      let isBorder = false;
      for (let dy = -1; dy <= 1 && !isBorder; dy++) {
        for (let dx = -1; dx <= 1 && !isBorder; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            if (cellMap[ny * size + nx] !== cell) {
              isBorder = true;
            }
          }
        }
      }

      // Thicken borders: also check 2px radius
      if (!isBorder) {
        for (let dy = -2; dy <= 2 && !isBorder; dy++) {
          for (let dx = -2; dx <= 2 && !isBorder; dx++) {
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              if (cellMap[ny * size + nx] !== cell) {
                isBorder = true;
              }
            }
          }
        }
      }

      const pi = idx * 4;
      if (isBorder) {
        outImg.data[pi] = 20;
        outImg.data[pi + 1] = 20;
        outImg.data[pi + 2] = 20;
      } else {
        outImg.data[pi] = r;
        outImg.data[pi + 1] = g;
        outImg.data[pi + 2] = b;
      }
      outImg.data[pi + 3] = 255;
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// 8. Posterize
// ---------------------------------------------------------------------------

function generatePosterize(source: HTMLCanvasElement, params: AvatarParams): HTMLCanvasElement {
  const size = params.size;
  const levels = params.colorLevels ?? 4;
  const showOutline = params.outline ?? false;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  const imgData = getScaledImageData(source, size);
  const data = imgData.data;
  const outImg = ctx.createImageData(size, size);

  // Quantize each channel
  const step = 255 / (levels - 1);
  const posterized = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    posterized[i] = Math.round(Math.round(data[i] / step) * step);
    posterized[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
    posterized[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
    posterized[i + 3] = 255;
  }

  if (showOutline) {
    // Simple edge detection: compare each pixel to its right and bottom neighbor
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        let isEdge = false;

        // Check right neighbor
        if (x < size - 1) {
          const ni = idx + 4;
          if (
            posterized[idx] !== posterized[ni] ||
            posterized[idx + 1] !== posterized[ni + 1] ||
            posterized[idx + 2] !== posterized[ni + 2]
          ) {
            isEdge = true;
          }
        }
        // Check bottom neighbor
        if (!isEdge && y < size - 1) {
          const ni = idx + size * 4;
          if (
            posterized[idx] !== posterized[ni] ||
            posterized[idx + 1] !== posterized[ni + 1] ||
            posterized[idx + 2] !== posterized[ni + 2]
          ) {
            isEdge = true;
          }
        }

        if (isEdge) {
          outImg.data[idx] = 20;
          outImg.data[idx + 1] = 20;
          outImg.data[idx + 2] = 20;
        } else {
          outImg.data[idx] = posterized[idx];
          outImg.data[idx + 1] = posterized[idx + 1];
          outImg.data[idx + 2] = posterized[idx + 2];
        }
        outImg.data[idx + 3] = 255;
      }
    }
  } else {
    for (let i = 0; i < posterized.length; i++) {
      outImg.data[i] = posterized[i];
    }
  }

  ctx.putImageData(outImg, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// 9. Pointillism
// ---------------------------------------------------------------------------

function generatePointillism(source: HTMLCanvasElement, params: AvatarParams): HTMLCanvasElement {
  const size = params.size;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  ctx.fillStyle = params.background ?? '#1a1a1a';
  ctx.fillRect(0, 0, size, size);

  const rng = makeRng(source);
  const imgData = getScaledImageData(source, size);
  const data = imgData.data;

  // Dot density: pointCount controls how many dots
  const count = params.pointCount ?? 3000;
  const maxRadius = size / 60;
  const minRadius = size / 200;

  for (let i = 0; i < count; i++) {
    const x = rng() * size;
    const y = rng() * size;

    const px = Math.floor(x);
    const py = Math.floor(y);
    const pi = (py * size + px) * 4;

    const r = data[pi], g = data[pi + 1], b = data[pi + 2];
    const lum = luminance(r, g, b);

    // Darker = larger dot, brighter = smaller dot
    const radius = minRadius + ((255 - lum) / 255) * (maxRadius - minRadius);

    // Slight color variation for a natural look
    const rVar = Math.floor(r + (rng() - 0.5) * 30);
    const gVar = Math.floor(g + (rng() - 0.5) * 30);
    const bVar = Math.floor(b + (rng() - 0.5) * 30);

    ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, rVar))},${Math.max(0, Math.min(255, gVar))},${Math.max(0, Math.min(255, bVar))})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  return out;
}

// ---------------------------------------------------------------------------
// 10. Low Poly — Delaunay triangulation with edge-aware point placement
// ---------------------------------------------------------------------------

function generateLowPoly(source: HTMLCanvasElement, params: AvatarParams): HTMLCanvasElement {
  const size = params.size;
  const targetPoints = params.pointCount ?? 300;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  const rng = makeRng(source);

  // Work at a smaller scale for edge detection
  const edgeSize = 128;
  const edgeData = getScaledImageData(source, edgeSize);
  const eData = edgeData.data;

  // Sobel edge detection
  const edgeStrength = new Float64Array(edgeSize * edgeSize);
  for (let y = 1; y < edgeSize - 1; y++) {
    for (let x = 1; x < edgeSize - 1; x++) {
      // Sobel X
      const tl = luminance(eData[((y - 1) * edgeSize + x - 1) * 4], eData[((y - 1) * edgeSize + x - 1) * 4 + 1], eData[((y - 1) * edgeSize + x - 1) * 4 + 2]);
      const ml = luminance(eData[(y * edgeSize + x - 1) * 4], eData[(y * edgeSize + x - 1) * 4 + 1], eData[(y * edgeSize + x - 1) * 4 + 2]);
      const bl = luminance(eData[((y + 1) * edgeSize + x - 1) * 4], eData[((y + 1) * edgeSize + x - 1) * 4 + 1], eData[((y + 1) * edgeSize + x - 1) * 4 + 2]);
      const tr = luminance(eData[((y - 1) * edgeSize + x + 1) * 4], eData[((y - 1) * edgeSize + x + 1) * 4 + 1], eData[((y - 1) * edgeSize + x + 1) * 4 + 2]);
      const mr = luminance(eData[(y * edgeSize + x + 1) * 4], eData[(y * edgeSize + x + 1) * 4 + 1], eData[(y * edgeSize + x + 1) * 4 + 2]);
      const br = luminance(eData[((y + 1) * edgeSize + x + 1) * 4], eData[((y + 1) * edgeSize + x + 1) * 4 + 1], eData[((y + 1) * edgeSize + x + 1) * 4 + 2]);
      const tc = luminance(eData[((y - 1) * edgeSize + x) * 4], eData[((y - 1) * edgeSize + x) * 4 + 1], eData[((y - 1) * edgeSize + x) * 4 + 2]);
      const bc = luminance(eData[((y + 1) * edgeSize + x) * 4], eData[((y + 1) * edgeSize + x) * 4 + 1], eData[((y + 1) * edgeSize + x) * 4 + 2]);

      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      edgeStrength[y * edgeSize + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Collect points: edges get more points, plus random fill
  const points: [number, number][] = [];

  // Always add corners and some edge points
  points.push([0, 0], [size, 0], [0, size], [size, size]);
  // Border points
  const borderSteps = 8;
  for (let i = 1; i < borderSteps; i++) {
    const t = (i / borderSteps) * size;
    points.push([t, 0], [t, size], [0, t], [size, t]);
  }

  // Edge-weighted point selection
  const edgePoints: { x: number; y: number; strength: number }[] = [];
  for (let y = 1; y < edgeSize - 1; y++) {
    for (let x = 1; x < edgeSize - 1; x++) {
      const s = edgeStrength[y * edgeSize + x];
      if (s > 30) {
        edgePoints.push({ x: (x / edgeSize) * size, y: (y / edgeSize) * size, strength: s });
      }
    }
  }

  // Sort by edge strength, take the strongest
  edgePoints.sort((a, b) => b.strength - a.strength);
  const edgeCount = Math.floor(targetPoints * 0.6);
  for (let i = 0; i < Math.min(edgeCount, edgePoints.length); i++) {
    const ep = edgePoints[i];
    // Add slight jitter
    points.push([ep.x + (rng() - 0.5) * 4, ep.y + (rng() - 0.5) * 4]);
  }

  // Fill remaining with random points
  const remaining = targetPoints - points.length;
  for (let i = 0; i < remaining; i++) {
    points.push([rng() * size, rng() * size]);
  }

  // Delaunay triangulation (Bowyer-Watson)
  const triangles = bowyerWatson(points, size);

  // Get full-res image data for color sampling
  const imgData = getScaledImageData(source, size);
  const data = imgData.data;

  // Render triangles
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);

  for (const tri of triangles) {
    const [p0, p1, p2] = tri;
    // Average color from triangle centroid
    const cx = (p0[0] + p1[0] + p2[0]) / 3;
    const cy = (p0[1] + p1[1] + p2[1]) / 3;

    // Sample a few points in the triangle for better color
    const samples: [number, number][] = [
      [cx, cy],
      [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2],
      [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2],
      [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2],
    ];

    let rS = 0, gS = 0, bS = 0, n = 0;
    for (const [sx, sy] of samples) {
      const ix = Math.max(0, Math.min(size - 1, Math.floor(sx)));
      const iy = Math.max(0, Math.min(size - 1, Math.floor(sy)));
      const i = (iy * size + ix) * 4;
      rS += data[i]; gS += data[i + 1]; bS += data[i + 2];
      n++;
    }

    ctx.fillStyle = `rgb(${Math.round(rS / n)},${Math.round(gS / n)},${Math.round(bS / n)})`;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.5;

    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke(); // Stroke same color to fill anti-aliasing gaps
  }

  return out;
}

// ---------------------------------------------------------------------------
// Bowyer-Watson Delaunay triangulation
// ---------------------------------------------------------------------------

type Point = [number, number];
type Triangle = [Point, Point, Point];

interface Circle {
  x: number;
  y: number;
  r2: number;
}

function circumcircle(p0: Point, p1: Point, p2: Point): Circle {
  const ax = p0[0], ay = p0[1];
  const bx = p1[0], by = p1[1];
  const cx = p2[0], cy = p2[1];

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) {
    return { x: ax, y: ay, r2: Infinity };
  }

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  const dx = ax - ux;
  const dy = ay - uy;
  return { x: ux, y: uy, r2: dx * dx + dy * dy };
}

function bowyerWatson(points: Point[], size: number): Triangle[] {
  // Super-triangle that contains all points
  const margin = size * 10;
  const st: Triangle = [
    [-margin, -margin],
    [size + margin * 2, -margin],
    [size / 2, size + margin * 2],
  ];

  let triangles: { tri: Triangle; cc: Circle }[] = [
    { tri: st, cc: circumcircle(st[0], st[1], st[2]) },
  ];

  for (const point of points) {
    // Find triangles whose circumcircle contains the point
    const bad: typeof triangles = [];
    const good: typeof triangles = [];

    for (const t of triangles) {
      const dx = point[0] - t.cc.x;
      const dy = point[1] - t.cc.y;
      if (dx * dx + dy * dy <= t.cc.r2) {
        bad.push(t);
      } else {
        good.push(t);
      }
    }

    // Find boundary polygon (edges that are not shared between bad triangles)
    const edges: [Point, Point][] = [];
    for (const b of bad) {
      const tri = b.tri;
      const triEdges: [Point, Point][] = [
        [tri[0], tri[1]],
        [tri[1], tri[2]],
        [tri[2], tri[0]],
      ];
      for (const edge of triEdges) {
        // Check if this edge is shared with another bad triangle
        let shared = false;
        for (const other of bad) {
          if (other === b) continue;
          const ot = other.tri;
          const otherEdges: [Point, Point][] = [
            [ot[0], ot[1]], [ot[1], ot[2]], [ot[2], ot[0]],
          ];
          for (const oe of otherEdges) {
            if (
              (edge[0] === oe[0] && edge[1] === oe[1]) ||
              (edge[0] === oe[1] && edge[1] === oe[0])
            ) {
              shared = true;
              break;
            }
          }
          if (shared) break;
        }
        if (!shared) {
          edges.push(edge);
        }
      }
    }

    // Create new triangles from boundary edges to the point
    const newTris: typeof triangles = [];
    for (const edge of edges) {
      const tri: Triangle = [edge[0], edge[1], point];
      newTris.push({ tri, cc: circumcircle(tri[0], tri[1], tri[2]) });
    }

    triangles = [...good, ...newTris];
  }

  // Remove triangles that share vertices with the super-triangle
  const superPts = new Set([st[0], st[1], st[2]]);
  return triangles
    .filter((t) => !t.tri.some((p) => superPts.has(p)))
    .map((t) => t.tri);
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export function generateAvatar(source: HTMLCanvasElement, params: AvatarParams): HTMLCanvasElement {
  const colors = extractColors(source);

  switch (params.style) {
    case 'pixel':
      return generatePixelArt(source, params);
    case 'mosaic':
      return generateMosaic(source, params);
    case 'silhouette':
      return generateSilhouette(source, colors, params);
    case 'geometric':
      return generateGeometric(source, colors, params);
    case 'halftone':
      return generateHalftone(source, params);
    case 'ascii':
      return generateAscii(source, params);
    case 'stained-glass':
      return generateStainedGlass(source, params);
    case 'posterize':
      return generatePosterize(source, params);
    case 'pointillism':
      return generatePointillism(source, params);
    case 'low-poly':
      return generateLowPoly(source, params);
  }
}
