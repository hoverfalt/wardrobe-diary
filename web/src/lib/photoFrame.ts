// Framing any photo as a standard garment photo: a 228 × 228 PNG with the garment in a circle on the standard grey
// (#CCCCCC) and transparent outside the circle. The owner moves, zooms and turns the photo inside the circle;
// transparent parts of the photo (e.g. a subject cut out on a phone) show the grey. Pure geometry, tested
// (photoFrame.test.ts); PhotoPicker draws it on a canvas.

/** The standard garment photo: a 228 × 228 PNG (as all existing photos are). */
export const PHOTO_SIZE = 228;
/** The grey inside the circle of every standard photo. */
export const PHOTO_BACKGROUND = "#cccccc";

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 8;

export interface Dims {
  width: number;
  height: number;
}

/** How the photo sits in the circle: offset of its centre from the circle's centre (output px), zoom relative to
 *  just covering the square, and rotation in degrees (clockwise). */
export interface Frame {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export const DEFAULT_FRAME: Frame = { x: 0, y: 0, zoom: 1, rotation: 0 };

/** Pixels of output per pixel of photo: zoom 1 makes the photo's shorter side span the square. */
export function frameScale(dims: Dims, zoom: number, size = PHOTO_SIZE): number {
  return (size / Math.min(dims.width, dims.height)) * zoom;
}

/** Keeps the zoom within bounds and the photo's centre within its own half-size of the circle's centre, so some
 *  of the photo always stays in view. */
export function clampFrame(frame: Frame, dims: Dims, size = PHOTO_SIZE): Frame {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, frame.zoom));
  const s = frameScale(dims, zoom, size);
  const limit = (Math.max(dims.width, dims.height) * s) / 2;
  const clamp = (v: number) => Math.min(limit, Math.max(-limit, v));
  const rotation = ((((frame.rotation + 180) % 360) + 360) % 360) - 180;
  return { x: clamp(frame.x), y: clamp(frame.y), zoom, rotation };
}

/** Zooms by `factor` keeping the point `at` (output px from the circle's centre) in place, as pinch and wheel do. */
export function zoomAround(frame: Frame, factor: number, at: { x: number; y: number }, dims: Dims, size = PHOTO_SIZE): Frame {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, frame.zoom * factor));
  const f = zoom / frame.zoom;
  return clampFrame({ ...frame, zoom, x: at.x + (frame.x - at.x) * f, y: at.y + (frame.y - at.y) * f }, dims, size);
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The bounding box of a selection mask (one value per pixel, non-zero = selected); null when nothing is. */
export function maskBounds(mask: ArrayLike<number>, width: number, height: number): Bounds | null {
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (mask[y * width + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** The frame that centres a selected garment and fits it in the circle: its bounding box's diagonal spans 92 % of
 *  the circle, so the corners stay just inside. */
export function fitFrame(bounds: Bounds, dims: Dims, size = PHOTO_SIZE): Frame {
  const diagonal = Math.max(1, Math.hypot(bounds.x1 - bounds.x0 + 1, bounds.y1 - bounds.y0 + 1));
  const zoom = (0.92 * Math.min(dims.width, dims.height)) / diagonal;
  const s = frameScale(dims, zoom, size);
  const cx = (bounds.x0 + bounds.x1 + 1) / 2;
  const cy = (bounds.y0 + bounds.y1 + 1) / 2;
  return clampFrame({ x: (dims.width / 2 - cx) * s, y: (dims.height / 2 - cy) * s, zoom, rotation: 0 }, dims, size);
}

/** True when a file is already a standard photo and the framing is untouched: it is then uploaded as it is. */
export function isStandardUnchanged(type: string, dims: Dims, frame: Frame): boolean {
  return (
    type === "image/png" &&
    dims.width === PHOTO_SIZE &&
    dims.height === PHOTO_SIZE &&
    frame.x === 0 &&
    frame.y === 0 &&
    frame.zoom === 1 &&
    frame.rotation === 0
  );
}

/** Draws the framed photo: the grey disc, the photo over it, and nothing outside the (anti-aliased) circle. */
export function drawFramed(ctx: CanvasRenderingContext2D, image: CanvasImageSource, dims: Dims, frame: Frame, size = PHOTO_SIZE) {
  const s = frameScale(dims, frame.zoom, size);
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = PHOTO_BACKGROUND;
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(size / 2 + frame.x, size / 2 + frame.y);
  ctx.rotate((frame.rotation * Math.PI) / 180);
  ctx.scale(s, s);
  ctx.drawImage(image, -dims.width / 2, -dims.height / 2);
  ctx.restore();
  // Keep only the circle; compositing (rather than clipping) gives a smooth edge.
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}
