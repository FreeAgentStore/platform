/**
 * Halo Maker — add a golden halo to any portrait photo.
 *
 * Uses the browser's FaceDetector API (Chrome) for head positioning.
 * Falls back to fixed center-top placement on unsupported browsers.
 * Pure Canvas 2D rendering, no dependencies.
 */

export type HaloStyle = 'byzantine' | 'renaissance' | 'subtle' | 'neon';

export interface HaloOptions {
  style?: HaloStyle;
  color?: string;
  opacity?: number;
  radius?: number;
  ringWidth?: number;
}

interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HaloParams {
  cx: number;
  cy: number;
  radius: number;
}

// ── Face detection ──────────────────────────────────────────────────

async function detectFace(img: HTMLImageElement): Promise<FaceBox | null> {
  if (typeof globalThis.FaceDetector === 'undefined') return null;
  try {
    const detector = new FaceDetector({ maxDetectedFaces: 1, fastMode: true });
    const faces = await detector.detect(img);
    if (faces.length === 0) return null;
    const box = faces[0].boundingBox;
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  } catch {
    return null;
  }
}

function fallbackPosition(w: number, h: number): HaloParams {
  return {
    cx: w / 2,
    cy: h * 0.25,
    radius: w * 0.2,
  };
}

function faceToHaloParams(face: FaceBox): HaloParams {
  return {
    cx: face.x + face.width / 2,
    cy: face.y - face.height * 0.1,
    radius: face.width * 1.2,
  };
}

// ── Style renderers ─────────────────────────────────────────────────

function parseColor(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function drawByzantine(
  ctx: CanvasRenderingContext2D,
  p: HaloParams,
  color: string,
  opacity: number,
  ringWidth: number,
): void {
  const [r, g, b] = parseColor(color);

  // Solid gold circle
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fill();

  // Dark outline
  if (ringWidth > 0) {
    ctx.strokeStyle = `rgba(${Math.floor(r * 0.3)}, ${Math.floor(g * 0.3)}, 0, ${opacity})`;
    ctx.lineWidth = ringWidth + 1;
    ctx.stroke();
  }

  // Inner glow line
  if (ringWidth > 0) {
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, p.radius - ringWidth - 1, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 200, ${opacity * 0.4})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawRenaissance(
  ctx: CanvasRenderingContext2D,
  p: HaloParams,
  color: string,
  opacity: number,
  ringWidth: number,
): void {
  const [r, g, b] = parseColor(color);

  // Soft radial glow — multiple layers for painterly feel
  for (let i = 3; i >= 0; i--) {
    const layerRadius = p.radius * (1 + i * 0.3);
    const layerOpacity = opacity * (0.15 / (i + 1));
    const grad = ctx.createRadialGradient(p.cx, p.cy, 0, p.cx, p.cy, layerRadius);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${layerOpacity})`);
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${layerOpacity * 0.6})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(p.cx - layerRadius, p.cy - layerRadius, layerRadius * 2, layerRadius * 2);
  }

  // Core glow
  const coreGrad = ctx.createRadialGradient(p.cx, p.cy, 0, p.cx, p.cy, p.radius);
  coreGrad.addColorStop(0, `rgba(255, 240, 200, ${opacity * 0.5})`);
  coreGrad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${opacity * 0.3})`);
  coreGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
  ctx.fill();

  // Thin golden ring
  if (ringWidth > 0) {
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.4})`;
    ctx.lineWidth = ringWidth;
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, p.radius * 0.85, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSubtle(
  ctx: CanvasRenderingContext2D,
  p: HaloParams,
  color: string,
  opacity: number,
): void {
  const [r, g, b] = parseColor(color);
  const grad = ctx.createRadialGradient(p.cx, p.cy, p.radius * 0.3, p.cx, p.cy, p.radius);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity * 0.25})`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawNeon(
  ctx: CanvasRenderingContext2D,
  p: HaloParams,
  color: string,
  opacity: number,
  ringWidth: number,
): void {
  const [r, g, b] = parseColor(color);

  // Outer glow
  ctx.save();
  ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  ctx.shadowBlur = p.radius * 0.4;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.8})`;
  ctx.lineWidth = (ringWidth || 2) + 2;
  ctx.stroke();
  ctx.restore();

  // Inner bright ring
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.9})`;
  ctx.lineWidth = ringWidth || 2;
  ctx.stroke();

  // Core glow fill
  const grad = ctx.createRadialGradient(p.cx, p.cy, p.radius * 0.7, p.cx, p.cy, p.radius);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity * 0.1})`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
  ctx.fill();
}

// ── Main compositing ────────────────────────────────────────────────

async function loadImage(src: string | File | HTMLImageElement): Promise<HTMLImageElement> {
  if (src instanceof HTMLImageElement) {
    if (src.complete) return src;
    return new Promise((resolve, reject) => {
      src.onload = () => resolve(src);
      src.onerror = reject;
    });
  }

  const url = src instanceof File ? URL.createObjectURL(src) : src;
  const img = new Image();
  img.crossOrigin = 'anonymous';

  return new Promise((resolve, reject) => {
    img.onload = () => {
      if (src instanceof File) URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (src instanceof File) URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export async function addHalo(
  source: string | File | HTMLImageElement,
  options: HaloOptions = {},
): Promise<HTMLCanvasElement> {
  const {
    style = 'renaissance',
    color = '#FFD700',
    opacity = 0.5,
    ringWidth = 2,
  } = options;

  const img = await loadImage(source);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // Detect face for halo placement
  const face = await detectFace(img);
  const params: HaloParams = face
    ? faceToHaloParams(face)
    : fallbackPosition(w, h);

  // Apply radius override
  if (options.radius) params.radius = options.radius;

  // Create output canvas
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Step 1: Draw halo on clean canvas
  switch (style) {
    case 'byzantine':
      drawByzantine(ctx, params, color, opacity, ringWidth);
      break;
    case 'renaissance':
      drawRenaissance(ctx, params, color, opacity, ringWidth);
      break;
    case 'subtle':
      drawSubtle(ctx, params, color, opacity);
      break;
    case 'neon':
      drawNeon(ctx, params, color, opacity, ringWidth);
      break;
  }

  // Step 2: Draw original image on top (halo is behind)
  ctx.drawImage(img, 0, 0);

  return canvas;
}

/** Convert canvas to Blob. */
export async function addHaloBlob(
  source: string | File | HTMLImageElement,
  options: HaloOptions = {},
  mimeType = 'image/png',
  quality = 0.92,
): Promise<Blob> {
  const canvas = await addHalo(source, options);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      mimeType,
      quality,
    );
  });
}

/** Convert canvas to data URL. */
export async function addHaloDataUrl(
  source: string | File | HTMLImageElement,
  options: HaloOptions = {},
  mimeType = 'image/png',
  quality = 0.92,
): Promise<string> {
  const canvas = await addHalo(source, options);
  return canvas.toDataURL(mimeType, quality);
}

// ── Exports for testing ─────────────────────────────────────────────

export { parseColor, fallbackPosition, faceToHaloParams };
export type { FaceBox, HaloParams };
