// The Cloud Function behind https://wardrobediary.io/mcp (ROADMAP R-29 phase 2), bundled into functions/lib by
// `npm run build:function`. Limits keep cost and abuse bounded: at most 2 instances, 256 MiB, 60 s per request.
import { onRequest } from "firebase-functions/v2/https";
import { handleMcpRequest } from "./http";

export const mcp = onRequest(
  { region: "europe-north1", memory: "256MiB", timeoutSeconds: 60, maxInstances: 2, concurrency: 40, minInstances: 0, invoker: "public" },
  (req, res) => handleMcpRequest(req, res, req.body),
);
