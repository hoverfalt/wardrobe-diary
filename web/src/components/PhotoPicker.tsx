// Photo picker (add and replace): any photo the browser can open, framed in the circle by dragging, pinching or
// scrolling and the sliders, and turned into the standard garment photo (lib/photoFrame.ts). What the canvas shows
// is exactly what is uploaded.
import { useEffect, useRef, useState } from "react";
import { checkPhoto } from "../lib/garmentForm";
import { clampFrame, DEFAULT_FRAME, drawFramed, isStandardUnchanged, MAX_ZOOM, MIN_ZOOM, PHOTO_SIZE, zoomAround, type Dims, type Frame } from "../lib/photoFrame";

export interface PickedPhoto {
  file: File;
  preview: string;
  errors: string[];
}

interface Source {
  file: File;
  image: HTMLImageElement;
  dims: Dims;
}

export function PhotoPicker({ onChange, invalid }: { onChange: (photo: PickedPhoto | null) => void; invalid?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [loadError, setLoadError] = useState("");
  const [frame, setFrame] = useState<Frame>(DEFAULT_FRAME);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    setSource(null);
    setLoadError("");
    setFrame(DEFAULT_FRAME);
    onChange(null);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setSource({ file, image, dims: { width: image.naturalWidth, height: image.naturalHeight } });
    image.onerror = () => setLoadError("This browser can't open the file. Use a JPEG or PNG (iPhone HEIC photos open in Safari).");
    image.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Draw at the screen's resolution; the upload is drawn again at 228 × 228 px.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!source || !canvas) return;
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    canvas.width = canvas.height = PHOTO_SIZE * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFramed(ctx, source.image, source.dims, frame);
  }, [source, frame]);

  // The framed PNG, made shortly after the framing stops changing.
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const out = document.createElement("canvas");
      out.width = out.height = PHOTO_SIZE;
      drawFramed(out.getContext("2d")!, source.image, source.dims, frame);
      out.toBlob((blob) => {
        if (cancelled || !blob) return;
        // A standard photo left as it is goes up unchanged.
        const framed = isStandardUnchanged(source.file.type, source.dims, frame) ? source.file : new File([blob], "photo.png", { type: "image/png" });
        onChange({ file: framed, preview: out.toDataURL("image/png"), errors: checkPhoto(framed) });
      }, "image/png");
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, frame]);

  // Scrolling zooms around the pointer (a non-passive listener, so the page doesn't scroll).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!source || !canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const at = toFrame(canvas, e.clientX, e.clientY);
      setFrame((f) => zoomAround(f, Math.exp(-e.deltaY * 0.002), at, source.dims));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [source]);

  // One finger or the mouse moves the photo; two fingers also zoom.
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ps = pointers.current;
    const last = ps.get(e.pointerId);
    if (!source || !last) return;
    const canvas = e.currentTarget;
    const k = PHOTO_SIZE / canvas.getBoundingClientRect().width;
    const others = [...ps.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
    const now = { x: e.clientX, y: e.clientY };
    ps.set(e.pointerId, now);
    if (others.length === 0) {
      setFrame((f) => clampFrame({ ...f, x: f.x + (now.x - last.x) * k, y: f.y + (now.y - last.y) * k }, source.dims));
      return;
    }
    const other = others[0];
    const factor = Math.hypot(now.x - other.x, now.y - other.y) / Math.max(1, Math.hypot(last.x - other.x, last.y - other.y));
    const mid = toFrame(canvas, (now.x + other.x) / 2, (now.y + other.y) / 2);
    setFrame((f) => {
      const moved = { ...f, x: f.x + ((now.x - last.x) * k) / 2, y: f.y + ((now.y - last.y) * k) / 2 };
      return zoomAround(moved, factor, mid, source.dims);
    });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => pointers.current.delete(e.pointerId);

  const set = (change: Partial<Frame>) => source && setFrame((f) => clampFrame({ ...f, ...change }, source.dims));

  return (
    <>
      <div className={invalid ? "photo-pick invalid" : "photo-pick"}>
        {!source && <span className="photo-preview">Photo</span>}
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {loadError && <small className="error">{loadError}</small>}
      {source && (
        <div className="photo-frame">
          <canvas
            ref={canvasRef}
            className="photo-canvas"
            aria-label="The photo in its circle: drag to move, pinch or scroll to zoom"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          <div className="photo-frame-controls">
            <label>
              Zoom
              <input
                type="range"
                min={Math.log(MIN_ZOOM)}
                max={Math.log(MAX_ZOOM)}
                step={0.01}
                value={Math.log(frame.zoom)}
                onChange={(e) => setFrame((f) => zoomAround(f, Math.exp(Number(e.target.value)) / f.zoom, { x: 0, y: 0 }, source.dims))}
              />
            </label>
            <label>
              Turn
              <input type="range" min={-180} max={180} step={0.5} value={frame.rotation} onChange={(e) => set({ rotation: Number(e.target.value) })} />
              <span className="muted">{Math.round(frame.rotation)}°</span>
            </label>
            <div className="row">
              <button type="button" onClick={() => set({ rotation: frame.rotation + 90 })}>Turn 90°</button>
              <button type="button" onClick={() => setFrame(DEFAULT_FRAME)}>Reset</button>
            </div>
          </div>
        </div>
      )}
      <small className="muted">
        {source
          ? "Drag to move, pinch or scroll to zoom. Transparent parts of the photo show the standard grey. Uploaded as shown."
          : `Any photo (JPEG or PNG; HEIC in Safari). You place it in the circle; it is saved as the standard ${PHOTO_SIZE} × ${PHOTO_SIZE} px PNG on grey.`}
      </small>
    </>
  );
}

/** A point on the screen → output px from the circle's centre. */
function toFrame(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const r = canvas.getBoundingClientRect();
  const k = PHOTO_SIZE / r.width;
  return { x: (clientX - r.left - r.width / 2) * k, y: (clientY - r.top - r.height / 2) * k };
}
