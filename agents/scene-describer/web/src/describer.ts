import { pipeline, env, type ObjectDetectionPipeline } from '@huggingface/transformers';

export interface DetectedObject {
  label: string;
  count: number;
  position: string;
}

export interface SceneDescription {
  description: string;
  objects: DetectedObject[];
  sceneType: string;
  alt: string;
  confidence: number;
}

interface RawDetection {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

let pipe: ObjectDetectionPipeline | null = null;

type ProgressCallback = (pct: number) => void;

export async function initModel(onProgress?: ProgressCallback): Promise<void> {
  env.allowLocalModels = false;

  let fileCount = 0;
  pipe = await pipeline('object-detection', 'Xenova/detr-resnet-50', {
    device: navigator.gpu ? 'webgpu' : 'wasm',
    progress_callback: (info: { status: string; progress?: number }) => {
      if (info.status === 'progress' && info.progress != null) {
        onProgress?.(Math.round(info.progress));
      } else if (info.status === 'done') {
        fileCount++;
        onProgress?.(Math.min(90 + fileCount * 2, 99));
      }
    },
  }) as ObjectDetectionPipeline;

  onProgress?.(100);
}

/**
 * Determine horizontal position from bounding box center relative to image width.
 */
function getHorizontalPosition(box: RawDetection['box'], imgWidth: number): string {
  const cx = (box.xmin + box.xmax) / 2;
  const ratio = cx / imgWidth;
  if (ratio < 0.33) return 'on the left';
  if (ratio > 0.66) return 'on the right';
  return 'in the center';
}

/**
 * Determine vertical position from bounding box center relative to image height.
 */
function getVerticalPosition(box: RawDetection['box'], imgHeight: number): string {
  const cy = (box.ymin + box.ymax) / 2;
  const ratio = cy / imgHeight;
  if (ratio < 0.33) return 'at the top';
  if (ratio > 0.66) return 'at the bottom';
  return '';
}

/**
 * Combine horizontal and vertical into a single position string.
 */
function getPosition(box: RawDetection['box'], imgWidth: number, imgHeight: number): string {
  const h = getHorizontalPosition(box, imgWidth);
  const v = getVerticalPosition(box, imgHeight);
  if (v && h !== 'in the center') return `${v} ${h}`;
  if (v) return v;
  return h;
}

// Labels that suggest outdoor scenes
const OUTDOOR_LABELS = new Set([
  'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'airplane', 'train',
  'traffic light', 'stop sign', 'fire hydrant', 'parking meter',
  'bird', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe',
  'dog', 'cat', 'kite', 'skateboard', 'surfboard', 'boat',
]);

// Labels that suggest indoor scenes
const INDOOR_LABELS = new Set([
  'chair', 'couch', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
  'mouse', 'remote', 'keyboard', 'microwave', 'oven', 'toaster',
  'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors',
  'teddy bear', 'hair drier', 'toothbrush',
]);

/**
 * Infer scene type from detected object labels.
 */
function inferSceneType(labels: string[]): string {
  let outdoorScore = 0;
  let indoorScore = 0;

  for (const label of labels) {
    if (OUTDOOR_LABELS.has(label)) outdoorScore++;
    if (INDOOR_LABELS.has(label)) indoorScore++;
  }

  if (outdoorScore > indoorScore) return 'outdoor';
  if (indoorScore > outdoorScore) return 'indoor';
  if (labels.length === 0) return 'unknown';
  return 'general';
}

/**
 * Pluralize a label based on count.
 */
function pluralize(label: string, count: number): string {
  if (count === 1) return label;
  // Simple pluralization
  if (label.endsWith('s') || label.endsWith('sh') || label.endsWith('ch') || label.endsWith('x')) {
    return label + 'es';
  }
  if (label.endsWith('y') && !/[aeiou]y$/.test(label)) {
    return label.slice(0, -1) + 'ies';
  }
  if (label === 'person') return 'people';
  if (label === 'mouse') return 'mice';
  if (label === 'knife') return 'knives';
  return label + 's';
}

/**
 * Create a natural language list from items: "a, b, and c".
 */
function naturalList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}

/**
 * Compose a natural language description from detected objects and scene type.
 */
function composeDescription(objects: DetectedObject[], sceneType: string): string {
  if (objects.length === 0) {
    return 'No objects were detected in this image.';
  }

  // Build object mention list
  const mentions = objects.map((obj) => {
    if (obj.count === 1) return `a ${obj.label}`;
    return `${obj.count} ${pluralize(obj.label, obj.count)}`;
  });

  const article = sceneType === 'indoor' || sceneType === 'unknown' ? 'An' : 'An';
  const sceneWord = sceneType === 'unknown' ? '' : ` ${sceneType}`;

  let desc = `${article}${sceneWord} scene featuring ${naturalList(mentions)}.`;

  // Add spatial relationships for objects with distinct positions
  const spatialParts: string[] = [];
  for (const obj of objects) {
    const name = obj.count === 1 ? `the ${obj.label}` : `the ${pluralize(obj.label, obj.count)}`;
    if (obj.position !== 'in the center') {
      spatialParts.push(`${name} ${obj.count === 1 ? 'is' : 'are'} ${obj.position}`);
    }
  }

  if (spatialParts.length > 0 && spatialParts.length <= 4) {
    desc += ' ' + spatialParts.map((p, i) => i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p).join(', ') + '.';
  }

  return desc;
}

/**
 * Generate concise alt text for accessibility.
 */
function composeAlt(objects: DetectedObject[], sceneType: string): string {
  if (objects.length === 0) return 'Image with no detected objects';

  const mentions = objects
    .slice(0, 4)
    .map((obj) => obj.count === 1 ? obj.label : `${obj.count} ${pluralize(obj.label, obj.count)}`);

  const scenePrefix = sceneType === 'outdoor' ? 'Outdoor scene with'
    : sceneType === 'indoor' ? 'Indoor scene with'
    : 'Scene with';

  return `${scenePrefix} ${naturalList(mentions)}`;
}

export async function describeScene(image: HTMLImageElement | HTMLCanvasElement): Promise<SceneDescription> {
  if (!pipe) throw new Error('Model not initialized. Call initModel() first.');

  const imgWidth = image instanceof HTMLCanvasElement ? image.width : image.naturalWidth;
  const imgHeight = image instanceof HTMLCanvasElement ? image.height : image.naturalHeight;

  // Run object detection
  const rawResults = await pipe(image, { threshold: 0.7 });

  const detections = (rawResults as RawDetection[]).filter((d) => d.score > 0.7);

  // Group by label, aggregate counts and average positions
  const grouped: Record<string, { count: number; boxes: RawDetection['box'][]; totalScore: number }> = {};

  for (const det of detections) {
    if (!grouped[det.label]) {
      grouped[det.label] = { count: 0, boxes: [], totalScore: 0 };
    }
    grouped[det.label].count++;
    grouped[det.label].boxes.push(det.box);
    grouped[det.label].totalScore += det.score;
  }

  // Build objects list with positions
  const objects: DetectedObject[] = Object.entries(grouped)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([label, data]) => {
      // Average bounding box center for position
      const avgBox = {
        xmin: data.boxes.reduce((s, b) => s + b.xmin, 0) / data.boxes.length,
        ymin: data.boxes.reduce((s, b) => s + b.ymin, 0) / data.boxes.length,
        xmax: data.boxes.reduce((s, b) => s + b.xmax, 0) / data.boxes.length,
        ymax: data.boxes.reduce((s, b) => s + b.ymax, 0) / data.boxes.length,
      };
      return {
        label,
        count: data.count,
        position: getPosition(avgBox, imgWidth, imgHeight),
      };
    });

  const allLabels = detections.map((d) => d.label);
  const sceneType = inferSceneType(allLabels);

  // Average confidence
  const avgConfidence = detections.length > 0
    ? detections.reduce((s, d) => s + d.score, 0) / detections.length
    : 0;

  const description = composeDescription(objects, sceneType);
  const alt = composeAlt(objects, sceneType);

  return {
    description,
    objects,
    sceneType,
    alt,
    confidence: Math.round(avgConfidence * 100) / 100,
  };
}

/**
 * Return raw detections for bounding box rendering.
 */
export async function detectObjects(image: HTMLImageElement | HTMLCanvasElement): Promise<RawDetection[]> {
  if (!pipe) throw new Error('Model not initialized. Call initModel() first.');
  const rawResults = await pipe(image, { threshold: 0.7 });
  return (rawResults as RawDetection[]).filter((d) => d.score > 0.7);
}
