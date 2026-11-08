// Tap-to-select (R-50 step 2): the owner taps the garment in the photo, adds or removes parts with more taps, and
// gets it cut out (transparent around it) for framing in PhotoPicker. The model runs in the browser
// (garmentSegmenter.ts); everything outside the selection is dimmed while selecting.
import { useEffect, useRef, useState } from "react";
import { maskBounds, type Bounds } from "../lib/photoFrame";
import { SEGMENT_SIZE, segmenterFor, type Point, type Segmenter, type Stage } from "./garmentSegmenter";

export interface Cutout {
  canvas: HTMLCanvasElement;
  bounds: Bounds;
}

export function GarmentSelect({ image, onDone, onCancel }: { image: CanvasImageSource & { width: number; height: number }; onDone: (c: Cutout) => void; onCancel: () => void }) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const [photo] = useState(() => scaled(image));
  const [segmenter, setSegmenter] = useState<Segmenter | null>(null);
  /** Shown over the photo with a spinner until the selection is ready. */
  const [waiting, setWaiting] = useState<string | null>(stageText({ stage: "start" }));
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");
  const [points, setPoints] = useState<Point[]>([]);
  const [mask, setMask] = useState<Uint8Array | null>(null);
  const [adding, setAdding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    segmenterFor(photo, (stage) => !cancelled && setWaiting(stageText(stage)))
      .then((s) => !cancelled && (setSegmenter(s), setWaiting(null)))
      .catch((e) => !cancelled && (setWaiting(null), setError(`The selection model didn't load: ${e instanceof Error ? e.message : String(e)}`)));
    return () => {
      cancelled = true;
    };
  }, [photo]);

  // A new mask for every change of the points (the latest wins).
  useEffect(() => {
    if (!segmenter) return;
    if (points.length === 0) return setMask(null);
    let current = true;
    setSelecting(true);
    setError("");
    segmenter
      .mask(points)
      .then((m) => current && (setMask(m), setSelecting(false)))
      .catch((e) => current && (setSelecting(false), setError(`Selecting failed: ${e instanceof Error ? e.message : String(e)}`)));
    return () => {
      current = false;
    };
  }, [segmenter, points]);

  // The photo, dimmed outside the selection, with the taps as dots.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const { width: w, height: h } = photo;
    view.width = w;
    view.height = h;
    const ctx = view.getContext("2d")!;
    ctx.drawImage(photo, 0, 0);
    if (mask) {
      const pixels = ctx.getImageData(0, 0, w, h);
      const d = pixels.data;
      for (let i = 0; i < w * h; i++)
        if (!mask[i]) {
          d[i * 4] *= 0.3;
          d[i * 4 + 1] *= 0.3;
          d[i * 4 + 2] *= 0.3;
        }
      ctx.putImageData(pixels, 0, 0);
    }
    const r = Math.max(6, Math.max(w, h) / 70);
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = p.on ? "#2e9e5b" : "#d64545";
      ctx.fill();
      ctx.lineWidth = r / 3;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
  }, [photo, mask, points]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!segmenter) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const k = photo.width / rect.width;
    setPoints((ps) => [...ps, { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k, on: adding }]);
  };

  const use = () => {
    if (!mask) return;
    const bounds = maskBounds(mask, photo.width, photo.height);
    if (!bounds) return;
    const canvas = document.createElement("canvas");
    canvas.width = photo.width;
    canvas.height = photo.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(photo, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < mask.length; i++) if (!mask[i]) pixels.data[i * 4 + 3] = 0;
    ctx.putImageData(pixels, 0, 0);
    onDone({ canvas, bounds });
  };

  const empty = !!mask && !maskBounds(mask, photo.width, photo.height);
  return (
    <div className="garment-select">
      <div className="garment-select-view">
        <canvas ref={viewRef} className={segmenter ? "garment-select-photo ready" : "garment-select-photo"} onPointerUp={tap} aria-label="The photo: tap the garment to select it" />
        {waiting && (
          <div className="garment-select-wait" role="status">
            <span className="spinner" aria-hidden="true" />
            <span>{waiting}</span>
          </div>
        )}
      </div>
      <p className="muted" role={error ? "alert" : undefined}>
        {error ? (
          <span className="error">{error}</span>
        ) : waiting ? (
          "The first time, the selection model is downloaded (about 55 MB); after that the browser keeps it."
        ) : selecting ? (
          <>
            <span className="spinner small" aria-hidden="true" /> Selecting…
          </>
        ) : points.length === 0 ? (
          "Tap the garment."
        ) : adding ? (
          "Tap more spots to add parts, or switch to Remove and tap what doesn't belong."
        ) : (
          "Tap what doesn't belong to the garment."
        )}
      </p>
      <div className="row">
        <span className="segmented" role="group" aria-label="What a tap does">
          <button type="button" className={adding ? "add on" : "add"} aria-pressed={adding} onClick={() => setAdding(true)}>Add</button>
          <button type="button" className={adding ? "remove" : "remove on"} aria-pressed={!adding} onClick={() => setAdding(false)}>Remove</button>
        </span>
        <button type="button" disabled={points.length === 0} onClick={() => setPoints((ps) => ps.slice(0, -1))}>Undo</button>
        <button type="button" className="primary" disabled={!mask || empty || selecting} onClick={use}>Use selection</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function stageText(s: Stage): string {
  switch (s.stage) {
    case "download":
      return `Downloading the selection model… ${s.percent} %`;
    case "start":
      return "Starting the selection model…";
    case "prepare":
      return "Looking at the photo…";
  }
}

/** The photo on a canvas at most SEGMENT_SIZE px on its long side (all the model uses; plenty for a 228 px photo). */
function scaled(image: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const k = Math.min(1, SEGMENT_SIZE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * k);
  canvas.height = Math.round(image.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
