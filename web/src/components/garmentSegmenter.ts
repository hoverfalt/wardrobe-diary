// Tap-to-select (R-50 step 2): SlimSAM (Xenova/slimsam-77-uniform, Apache 2.0, ~14 MB quantized) run in the
// browser with transformers.js. Nothing loads until the owner first selects a garment; the browser then caches the
// model (from Hugging Face) and the ONNX runtime (from jsDelivr). Each photo is encoded once; a tap runs only the
// small mask decoder.
import type { SamModel, SamProcessor, Tensor } from "@huggingface/transformers";

const MODEL = "Xenova/slimsam-77-uniform";
/** SAM works at 1024 px on the long side; larger photos are scaled down to this first. */
export const SEGMENT_SIZE = 1024;

export interface Point {
  x: number;
  y: number;
  /** true = part of the garment, false = not. */
  on: boolean;
}

export interface Segmenter {
  /** The mask for the points (one byte per pixel of the photo given, 1 = selected). */
  mask(points: Point[]): Promise<Uint8Array>;
}

let loading: ReturnType<typeof load> | null = null;

async function load() {
  const t = await import("@huggingface/transformers");
  // q8 = the quantized files (model_quantized.onnx).
  const [model, processor] = (await Promise.all([t.SamModel.from_pretrained(MODEL, { dtype: "q8" }), t.AutoProcessor.from_pretrained(MODEL)])) as [
    SamModel,
    SamProcessor,
  ];
  return { t, model, processor };
}

/** Loads the model (once per visit) and encodes the photo on `canvas`. */
export async function segmenterFor(canvas: HTMLCanvasElement): Promise<Segmenter> {
  loading ??= load();
  let loaded;
  try {
    loaded = await loading;
  } catch (e) {
    loading = null; // e.g. offline: try again next time
    throw e;
  }
  const { t, model, processor } = loaded;
  const { width, height } = canvas;
  const rgba = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  const image = new t.RawImage(new Uint8ClampedArray(rgba), width, height, 4).rgb();
  const inputs = await processor(image);
  const embeddings = await model.get_image_embeddings(inputs);
  const [oh, ow] = inputs.original_sizes[0] as number[];
  const [rh, rw] = inputs.reshaped_input_sizes[0] as number[];
  return {
    async mask(points) {
      // Points in the model's input size, as the processor would scale them.
      const input_points = new t.Tensor("float32", Float32Array.from(points.flatMap((p) => [(p.x * rw) / ow, (p.y * rh) / oh])), [1, 1, points.length, 2]);
      const input_labels = new t.Tensor("int64", BigInt64Array.from(points.map((p) => BigInt(p.on ? 1 : 0))), [1, 1, points.length]);
      const out = await model({ ...embeddings, input_points, input_labels });
      const masks: Tensor[] = await processor.post_process_masks(out.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
      // SAM proposes three masks; take the one it scores best.
      const scores = out.iou_scores.data as Float32Array;
      const best = scores.indexOf(Math.max(...scores));
      const n = width * height;
      return Uint8Array.from((masks[0].data as Uint8Array).subarray(best * n, (best + 1) * n));
    },
  };
}
