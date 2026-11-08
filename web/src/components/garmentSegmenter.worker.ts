// The selection model in a Web Worker (R-50), so the page stays responsive (spinner, progress, taps) while the model
// loads and works. garmentSegmenter.ts is the page's side; see it for the model choice. One photo at a time: an
// "encode" replaces the previous photo, and each "mask" runs only the small mask decoder on it.
import type { EdgeTamModel, SamProcessor, Tensor } from "@huggingface/transformers";
import { pickProposal } from "../lib/photoFrame";
import type { Point, Stage } from "./garmentSegmenter";

export type Request =
  | { type: "encode"; id: number; width: number; height: number; rgba: ArrayBuffer }
  | { type: "mask"; id: number; photo: number; points: Point[] };

export type Reply =
  | { type: "stage"; id: number; stage: Stage }
  | { type: "encoded"; id: number }
  | { type: "mask"; id: number; mask: ArrayBuffer }
  | { type: "error"; id: number; message: string };

const MODEL = "onnx-community/EdgeTAM-ONNX";
/** The model's files (vision encoder + mask decoder, fp32): the download's 100 %. */
const MODEL_BYTES = 41_000_000;

const post = (r: Reply, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(r, transfer);

let loading: ReturnType<typeof load> | null = null;
/** The request waiting for the model now (loading happens once per worker). */
let loadingFor = 0;

async function load() {
  const t = await import("@huggingface/transformers");
  // The plain WASM runtime (no asyncify, which transformers.js picks by default on most browsers).
  const onnx = t.env.backends.onnx;
  const dist = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${onnx.versions?.web}/dist/`;
  onnx.wasm!.wasmPaths = { mjs: `${dist}ort-wasm-simd-threaded.mjs`, wasm: `${dist}ort-wasm-simd-threaded.wasm` };
  // Bytes downloaded per file; nothing is reported for files the browser has cached.
  const loaded = new Map<string, number>();
  const progress_callback = (p: { status: string; file?: string; loaded?: number }) => {
    if (p.status !== "progress" || !p.file) return;
    loaded.set(p.file, p.loaded ?? 0);
    const bytes = [...loaded.values()].reduce((a, b) => a + b, 0);
    const percent = Math.min(100, Math.round((100 * bytes) / MODEL_BYTES));
    post({ type: "stage", id: loadingFor, stage: percent >= 100 ? { stage: "start" } : { stage: "download", percent } });
  };
  const [model, processor] = (await Promise.all([
    t.EdgeTamModel.from_pretrained(MODEL, { dtype: "fp32", device: "wasm", progress_callback }),
    t.AutoProcessor.from_pretrained(MODEL, { progress_callback }),
  ])) as [EdgeTamModel, SamProcessor];
  return { t, model, processor };
}

/** The photo being selected from: its id, size and encoding. */
let photo: {
  id: number;
  width: number;
  height: number;
  inputs: { original_sizes: number[][]; reshaped_input_sizes: number[][] };
  embeddings: Record<string, Tensor>;
} | null = null;

async function encode({ id, width, height, rgba }: Extract<Request, { type: "encode" }>) {
  photo = null;
  loadingFor = id;
  post({ type: "stage", id, stage: { stage: "start" } });
  loading ??= load();
  let loaded;
  try {
    loaded = await loading;
  } catch (e) {
    loading = null; // e.g. offline: try again next time
    throw e;
  }
  post({ type: "stage", id, stage: { stage: "prepare" } });
  const { t, model, processor } = loaded;
  const image = new t.RawImage(new Uint8ClampedArray(rgba), width, height, 4).rgb();
  const inputs = await processor(image);
  const embeddings = await model.get_image_embeddings(inputs);
  photo = { id, width, height, inputs, embeddings };
  post({ type: "encoded", id });
}

async function mask({ id, photo: photoId, points }: Extract<Request, { type: "mask" }>) {
  const { t, model, processor } = await loading!;
  if (!photo || photo.id !== photoId) throw new Error("the photo has changed");
  const { width, height, inputs, embeddings } = photo;
  const [oh, ow] = inputs.original_sizes[0];
  const [rh, rw] = inputs.reshaped_input_sizes[0];
  // Points in the model's input size, as the processor would scale them.
  const input_points = new t.Tensor("float32", Float32Array.from(points.flatMap((p) => [(p.x * rw) / ow, (p.y * rh) / oh])), [1, 1, points.length, 2]);
  const input_labels = new t.Tensor("int64", BigInt64Array.from(points.map((p) => BigInt(p.on ? 1 : 0))), [1, 1, points.length]);
  const out = await model({ ...embeddings, input_points, input_labels });
  const masks: Tensor[] = await processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
  // The model proposes three masks (part, larger part, whole object); see pickProposal.
  const n = width * height;
  const data = masks[0].data as Uint8Array;
  const proposals = [0, 1, 2].map((k) => data.subarray(k * n, (k + 1) * n));
  const areas = proposals.map((m) => m.reduce((sum, v) => sum + (v ? 1 : 0), 0));
  const picked = Uint8Array.from(proposals[pickProposal(out.iou_scores.data as Float32Array, areas)]);
  post({ type: "mask", id, mask: picked.buffer }, [picked.buffer]);
}

self.onmessage = (e: MessageEvent<Request>) => {
  const r = e.data;
  (r.type === "encode" ? encode(r) : mask(r)).catch((err) => post({ type: "error", id: r.id, message: err instanceof Error ? err.message : String(err) }));
};
