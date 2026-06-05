/**
 * Avatar generation heuristics — pure Canvas 2D, no AI model needed.
 * Extracts colors from the source image, then renders stylized avatars.
 */

export type Style = 'geometric' | 'pixel' | 'silhouette' | 'mosaic';

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

/** Geometric: abstract shapes using the palette. */
export function generateGeometric(source: HTMLCanvasElement, colors: string[], size: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  // Background: darkest color or first
  ctx.fillStyle = colors[0] ?? '#333';
  ctx.fillRect(0, 0, size, size);

  // Seed a deterministic-ish random from source pixel data
  const srcCtx = source.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, source.width, source.height).data;
  let seed = 0;
  for (let i = 0; i < Math.min(srcData.length, 400); i += 4) {
    seed = (seed + srcData[i] + srcData[i + 1] * 3 + srcData[i + 2] * 7) | 0;
  }
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 1000;
  };

  const shapes = 12 + Math.floor(rng() * 8);
  for (let i = 0; i < shapes; i++) {
    const color = colors[Math.floor(rng() * colors.length)] ?? colors[0];
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3 + rng() * 0.5;

    const cx = rng() * size;
    const cy = rng() * size;
    const r = size * 0.05 + rng() * size * 0.3;
    const type = Math.floor(rng() * 3);

    if (type === 0) {
      // Circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 1) {
      // Rectangle (rotated)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rng() * Math.PI);
      ctx.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
      ctx.restore();
    } else {
      // Triangle
      ctx.beginPath();
      const angle = rng() * Math.PI * 2;
      for (let j = 0; j < 3; j++) {
        const a = angle + (j * Math.PI * 2) / 3;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  return out;
}

/** Pixel Art: downscale to a chunky pixel grid. */
export function generatePixelArt(source: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const gridSize = 16; // 16x16 pixel grid
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  // Draw source scaled down to gridSize x gridSize
  const tmp = document.createElement('canvas');
  tmp.width = gridSize;
  tmp.height = gridSize;
  const tmpCtx = tmp.getContext('2d')!;
  tmpCtx.imageSmoothingEnabled = true;
  tmpCtx.drawImage(source, 0, 0, gridSize, gridSize);

  const pixelData = tmpCtx.getImageData(0, 0, gridSize, gridSize).data;
  const cellSize = size / gridSize;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const i = (y * gridSize + x) * 4;
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(
        Math.floor(x * cellSize),
        Math.floor(y * cellSize),
        Math.ceil(cellSize),
        Math.ceil(cellSize),
      );
    }
  }

  return out;
}

/** Silhouette: high-contrast threshold with gradient fill from palette. */
export function generateSilhouette(source: HTMLCanvasElement, colors: string[], size: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  // Draw source scaled to output size
  const tmp = document.createElement('canvas');
  tmp.width = size;
  tmp.height = size;
  const tmpCtx = tmp.getContext('2d')!;
  tmpCtx.drawImage(source, 0, 0, size, size);

  const imageData = tmpCtx.getImageData(0, 0, size, size);
  const data = imageData.data;

  // Compute luminance threshold (Otsu-like: use mean)
  let totalLum = 0;
  const pixelCount = size * size;
  for (let i = 0; i < data.length; i += 4) {
    totalLum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  const threshold = totalLum / pixelCount;

  // Create mask: dark pixels = foreground
  const mask = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const lum = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
    mask[i] = lum < threshold ? 1 : 0;
  }

  // Background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, size, size);

  // Gradient fill for foreground
  const grad = ctx.createLinearGradient(0, 0, size, size);
  const c1 = colors[0] ?? '#7c3aed';
  const c2 = colors[1] ?? colors[0] ?? '#a78bfa';
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);

  const outData = ctx.getImageData(0, 0, size, size);
  // Paint gradient onto a temp canvas to read its pixels
  const gradCanvas = document.createElement('canvas');
  gradCanvas.width = size;
  gradCanvas.height = size;
  const gradCtx = gradCanvas.getContext('2d')!;
  gradCtx.fillStyle = grad;
  gradCtx.fillRect(0, 0, size, size);
  const gradData = gradCtx.getImageData(0, 0, size, size).data;

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

/** Mosaic: tile-based representation using average color per tile. */
export function generateMosaic(source: HTMLCanvasElement, colors: string[], size: number): HTMLCanvasElement {
  const tileCount = 12; // 12x12 tiles
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d')!;

  // Scale source to a workable size
  const tmp = document.createElement('canvas');
  tmp.width = size;
  tmp.height = size;
  const tmpCtx = tmp.getContext('2d')!;
  tmpCtx.drawImage(source, 0, 0, size, size);

  const imageData = tmpCtx.getImageData(0, 0, size, size).data;
  const tileSize = size / tileCount;

  for (let ty = 0; ty < tileCount; ty++) {
    for (let tx = 0; tx < tileCount; tx++) {
      // Average color in this tile region
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      const x0 = Math.floor(tx * tileSize);
      const y0 = Math.floor(ty * tileSize);
      const x1 = Math.floor((tx + 1) * tileSize);
      const y1 = Math.floor((ty + 1) * tileSize);

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * size + x) * 4;
          rSum += imageData[i];
          gSum += imageData[i + 1];
          bSum += imageData[i + 2];
          count++;
        }
      }

      if (count > 0) {
        const r = Math.round(rSum / count);
        const g = Math.round(gSum / count);
        const b = Math.round(bSum / count);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = colors[0] ?? '#333';
      }

      // Draw tile with a small gap for the mosaic look
      const gap = Math.max(1, Math.floor(tileSize * 0.06));
      ctx.beginPath();
      ctx.roundRect(x0 + gap, y0 + gap, tileSize - gap * 2, tileSize - gap * 2, gap);
      ctx.fill();
    }
  }

  return out;
}
