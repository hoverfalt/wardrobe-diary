// Tap-to-select (R-50 step 2): EdgeTAM (onnx-community/EdgeTAM-ONNX, Apache 2.0, ~41 MB), a SAM 2 variant made for
// phones, run in the browser with transformers.js in a Web Worker (garmentSegmenter.worker.ts), so the page stays
// responsive. Nothing loads until the owner first selects a garment; the browser then caches the model (from
// Hugging Face) and the ONNX runtime (from jsDelivr). Each photo is encoded once; a tap runs only the small mask
// decoder.
// Memory decides what works on an iPhone (Safari closes a tab that uses too much): SlimSAM peaked at ~1.8 GB
// (attention over the whole image) and crashed Safari; EdgeTAM with the plain WASM runtime peaks at ~0.5 GB in
// Chrome. The default "asyncify" runtime adds ~0.45 GB, and quantized EdgeTAM gives empty masks: keep fp32.
import type { Reply, Request } from "./garmentSegmenter.worker";

/** SAM works at 1024 px on the long side; larger photos are scaled down to this first. */
export const SEGMENT_SIZE = 1024;

export interface Point {
  x: number;
  y: number;
  /** true = part of the garment, false = not. */
  on: boolean;
}

/** What is happening while the selection gets ready, for the waiting indicator. */
export type Stage = { stage: "download"; percent: number } | { stage: "start" } | { stage: "prepare" };

export interface Segmenter {
  /** The mask for the points (one byte per pixel of the photo given, 1 = selected). */
  mask(points: Point[]): Promise<Uint8Array>;
}

interface Waiting {
  resolve: (r: Reply) => void;
  reject: (e: Error) => void;
  onStage?: (s: Stage) => void;
}

/** One worker per visit, so the model loads once. */
let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, Waiting>();

function ask(request: Request, transfer: Transferable[] = [], onStage?: (s: Stage) => void): Promise<Reply> {
  if (!worker) {
    worker = new Worker(new URL("./garmentSegmenter.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<Reply>) => {
      const r = e.data;
      const w = waiting.get(r.id);
      if (!w) return;
      if (r.type === "stage") return w.onStage?.(r.stage);
      waiting.delete(r.id);
      if (r.type === "error") w.reject(new Error(r.message));
      else w.resolve(r);
    };
    worker.onerror = (e) => {
      // The worker itself failed (e.g. its script didn't load): fail everything waiting, start afresh next time.
      for (const w of waiting.values()) w.reject(new Error(e.message || "the selection worker stopped"));
      waiting.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return new Promise((resolve, reject) => {
    waiting.set(request.id, { resolve, reject, onStage });
    worker!.postMessage(request, transfer);
  });
}

/** Loads the model (once per visit) and encodes the photo on `canvas`, telling `onStage` how it goes. */
export async function segmenterFor(canvas: HTMLCanvasElement, onStage: (s: Stage) => void): Promise<Segmenter> {
  const { width, height } = canvas;
  const rgba = canvas.getContext("2d")!.getImageData(0, 0, width, height).data.buffer;
  const photo = nextId++;
  await ask({ type: "encode", id: photo, width, height, rgba }, [rgba], onStage);
  return {
    async mask(points) {
      const r = await ask({ type: "mask", id: nextId++, photo, points });
      return new Uint8Array((r as Extract<Reply, { type: "mask" }>).mask);
    },
  };
}
