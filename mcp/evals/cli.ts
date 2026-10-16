// AI evaluation of the Wardrobe Diary data (ROADMAP R-40 phase 4): does a governed semantic layer make an AI
// assistant's answers more reliable? Every question is asked under three conditions:
//   raw       the public data (a frozen snapshot) pasted into the prompt, no tools
//   tools     the real MCP server on the snapshot, semantic layer off (WARDROBE_SEMANTICS=off)
//   semantic  the same server with the semantic layer: definitions in the prompt, explain tool, provenance
// Answers are graded in code against values computed with the app's own metrics (questions.ts).
//
//   npm run evals -- snapshot                       freeze the current public data (evals/data/public-data.json)
//   npm run evals -- expected                       compute the correct answers (evals/expected.json)
//   npm run evals -- run [--condition raw|tools|semantic] [--model M] [--only id,id] [--repeat N]
//   npm run evals -- report                         summarise evals/results/*.json (evals/results/summary.json)
// `run` needs ANTHROPIC_API_KEY.
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchPublicData } from "../../web/src/lib/firestoreRest";
import { decodePublicData, type PublicData } from "../../web/src/lib/publicData";
import { QUESTIONS, type Expected } from "./questions";

const HERE = dirname(fileURLToPath(import.meta.url)); // mcp/dist when bundled
const EVALS = resolve(HERE, "../evals");
const SNAPSHOT = resolve(EVALS, "data/public-data.json");
const SERVER = resolve(HERE, "server.mjs");
const CONDITIONS = ["raw", "tools", "semantic"] as const;
type Condition = (typeof CONDITIONS)[number];
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const json = (v: unknown) => JSON.stringify(v, null, 1) + "\n";
const loadSnapshot = (): { meta: { takenAt: string; lastLoggedDay: string }; data: PublicData } => JSON.parse(readFileSync(SNAPSHOT, "utf8"));

// ---------- grading ----------
export function parseNumber(text: string): number | null {
  const m = text.replace(/\s/g, "").match(/-?\d[\d.,]*/);
  if (!m) return null;
  let s = m[0].replace(/[.,]$/, "");
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ""); // 1,234.5
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", "."); // 0,85 (decimal comma)
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function grade(answer: string | null, expected: Expected): { correct: boolean; parsed: unknown } {
  if (answer == null) return { correct: false, parsed: null };
  if (expected.type === "number") {
    const n = parseNumber(answer);
    const tol = Math.max(expected.tolerance, 1e-9);
    return { correct: n != null && Math.abs(n - expected.value) <= tol + 1e-9, parsed: n };
  }
  if (expected.type === "name") {
    const a = norm(answer);
    return { correct: expected.oneOf.some((n) => a === norm(n) || a.includes(norm(n))), parsed: answer };
  }
  const got = answer.split(/;|\n/).map(norm).filter(Boolean).sort();
  const want = expected.value.map(norm).sort();
  return { correct: JSON.stringify(got) === JSON.stringify(want), parsed: got };
}

const finalAnswer = (text: string) => {
  const lines = [...text.matchAll(/^\s*\**ANSWER:?\**\s*(.+)$/gim)];
  return lines.length ? lines[lines.length - 1][1].trim() : null;
};

// ---------- the model ----------
const SYSTEM = `You answer questions about the Wardrobe Diary: one person's daily log, since 1 January 2018, of every garment worn, with what each garment cost.
Work out the answer carefully. End your reply with one final line of the form
ANSWER: <value>
where <value> is just a number (no units or thousands separators, a dot as the decimal point, percentages as numbers such as 42.5) or, when names are asked for, the name(s) separated by semicolons.`;

const RAW_NOTE = `The data below is the public data document. "garments" lists every garment (prices in euros, dates YYYY-MM-DD, "divested" empty while still owned, "timesUsedInit" = wears before tracking began). "days" maps each date to the positions (0-based) in the garments list of the garments worn that day.`;

interface Run {
  question: string;
  condition: Condition;
  model: string;
  answer: string | null;
  correct: boolean;
  parsed: unknown;
  expected: Expected;
  toolCalls: { name: string; input: unknown }[];
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  turns: number;
  text: string;
  error?: string;
}

async function ask(client: Anthropic, model: string, condition: Condition, q: (typeof QUESTIONS)[number], expected: Expected, mcp: Client | null, extraSystem: string): Promise<Run> {
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const toolCalls: Run["toolCalls"] = [];
  const tools = mcp
    ? (await mcp.listTools()).tools.map((t) => ({ name: t.name, description: t.description ?? "", input_schema: t.inputSchema as Anthropic.Tool.InputSchema }))
    : undefined;
  const system: Anthropic.TextBlockParam[] = [{ type: "text", text: SYSTEM }];
  if (extraSystem) system.push({ type: "text", text: extraSystem, cache_control: { type: "ephemeral" } });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: q.question }];
  let text = "";
  let turns = 0;
  try {
    for (; turns < 16; turns++) {
      const res = await client.messages.create({ model, max_tokens: 4096, system, messages, ...(tools ? { tools } : {}) });
      usage.input += res.usage.input_tokens;
      usage.output += res.usage.output_tokens;
      usage.cacheRead += res.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += res.usage.cache_creation_input_tokens ?? 0;
      text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
      const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || !mcp || uses.length === 0) break;
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const u of uses) {
        toolCalls.push({ name: u.name, input: u.input });
        const r = await mcp.callTool({ name: u.name, arguments: u.input as Record<string, unknown> });
        const out = (r.content as { type: string; text?: string }[]).map((c) => c.text ?? "").join("\n");
        results.push({ type: "tool_result", tool_use_id: u.id, content: out.slice(0, 60_000), is_error: Boolean(r.isError) });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    return { question: q.id, condition, model, answer: null, correct: false, parsed: null, expected, toolCalls, usage, turns, text, error: e instanceof Error ? e.message : String(e) };
  }
  const answer = finalAnswer(text);
  return { question: q.id, condition, model, answer, ...grade(answer, expected), expected, toolCalls, usage, turns: turns + 1, text: text.slice(-1500) };
}

async function startServer(semantics: boolean): Promise<Client> {
  const client = new Client({ name: "wardrobe-evals", version: "0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [SERVER],
      env: { ...process.env, WARDROBE_SNAPSHOT: SNAPSHOT, WARDROBE_SEMANTICS: semantics ? "on" : "off" } as Record<string, string>,
    }),
  );
  return client;
}

// ---------- commands ----------
async function main() {
  const cmd = process.argv[2];
  if (cmd === "snapshot") {
    const data = await fetchPublicData();
    const lastLoggedDay = Object.keys(data.days).sort().pop()!;
    mkdirSync(dirname(SNAPSHOT), { recursive: true });
    writeFileSync(SNAPSHOT, JSON.stringify({ meta: { takenAt: new Date().toISOString().slice(0, 10), lastLoggedDay }, data }) + "\n");
    console.log(`Snapshot: ${data.garments.length} garments, ${Object.keys(data.days).length} days (last ${lastLoggedDay}) → ${SNAPSHOT}`);
    return;
  }
  const { meta, data } = loadSnapshot();
  const w = decodePublicData(data);
  const expected = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.expected(w)]));
  if (cmd === "expected") {
    writeFileSync(resolve(EVALS, "expected.json"), json({ snapshot: meta, questions: QUESTIONS.map((q) => ({ id: q.id, kind: q.kind, question: q.question, metrics: q.metrics, expected: expected[q.id] })) }));
    for (const q of QUESTIONS) console.log(`${q.id.padEnd(26)} ${JSON.stringify(expected[q.id]).slice(0, 110)}`);
    return;
  }
  if (cmd === "run") {
    const key = process.env.ANTHROPIC_API_KEY ?? "";
    if (!key) throw new Error("Set ANTHROPIC_API_KEY to run the evaluation.");
    // A key pasted with a stray character (e.g. "…" or a smart quote) fails every request; catch it up front.
    const bad = [...key].findIndex((c) => c.charCodeAt(0) > 126 || c.charCodeAt(0) < 33);
    if (bad >= 0) throw new Error(`ANTHROPIC_API_KEY has an invalid character at position ${bad} (code ${key.charCodeAt(bad)}): paste the key exactly, without "…", quotes or spaces.`);
    const model = arg("--model") ?? "claude-sonnet-5-5";
    const conditions = (arg("--condition")?.split(",") ?? CONDITIONS) as Condition[];
    const only = arg("--only")?.split(",");
    const repeat = Number(arg("--repeat") ?? 1);
    const questions = QUESTIONS.filter((q) => !only || only.includes(q.id));
    const client = new Anthropic();
    // Check the key and model with one tiny request before running anything.
    await client.messages.create({ model, max_tokens: 1, messages: [{ role: "user", content: "ok" }] });
    const runs: Run[] = [];
    for (const condition of conditions) {
      const mcp = condition === "raw" ? null : await startServer(condition === "semantic");
      let extra = "";
      if (condition === "raw") extra = `${RAW_NOTE}\n\n${JSON.stringify(data)}`;
      if (condition === "semantic") {
        const defs = await mcp!.readResource({ uri: "wardrobe://definitions" });
        extra = `Definitions of every term and metric (the semantic layer). Use them, and the explain tool, to interpret the data:\n\n${(defs.contents[0] as { text: string }).text}`;
      }
      for (let i = 0; i < repeat; i++) {
        for (const q of questions) {
          const r = await ask(client, model, condition, q, expected[q.id], mcp, extra);
          runs.push(r);
          console.log(`${condition.padEnd(9)} ${q.id.padEnd(26)} ${r.correct ? "✓" : "✕"} answer ${r.answer ?? "–"}${r.error ? ` (${r.error.slice(0, 80)})` : ""}`);
          // Stop on repeated API errors (authentication, quota…) rather than recording a run of failures.
          if (runs.slice(-3).length === 3 && runs.slice(-3).every((x) => x.error)) throw new Error(`Stopped: the last three requests failed (${r.error}). Nothing was saved.`);
        }
      }
      await mcp?.close();
    }
    if (runs.every((r) => r.error)) throw new Error("Every request failed; nothing was saved.");
    const dir = resolve(EVALS, "results");
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-${model}.json`);
    writeFileSync(file, json({ model, ranAt: new Date().toISOString(), snapshot: meta, semanticLayer: JSON.parse(readFileSync(resolve(HERE, "../../web/src/generated/semantics.json"), "utf8")).version, runs }));
    console.log(`\nResults → ${file}`);
    report();
    return;
  }
  if (cmd === "report") return report();
  console.log("Commands: snapshot | expected | run [--condition raw,tools,semantic] [--model M] [--only ids] [--repeat N] | report");
}

/** Accuracy per condition and question kind over all result files, written to evals/results/summary.json. */
function report() {
  const dir = resolve(EVALS, "results");
  if (!existsSync(dir)) return console.log("No results yet.");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "summary.json");
  const runs: Run[] = files.flatMap((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")).runs);
  const kinds = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.kind]));
  const groups: Record<string, { correct: number; total: number; tokens: number; toolCalls: number }> = {};
  for (const r of runs) {
    for (const key of [`${r.model}|${r.condition}|all`, `${r.model}|${r.condition}|${kinds[r.question]}`]) {
      const g = (groups[key] ??= { correct: 0, total: 0, tokens: 0, toolCalls: 0 });
      g.total++;
      g.correct += r.correct ? 1 : 0;
      g.tokens += r.usage.input + r.usage.output + r.usage.cacheRead + r.usage.cacheWrite;
      g.toolCalls += r.toolCalls.length;
    }
  }
  const summary = Object.entries(groups).map(([k, g]) => {
    const [model, condition, kind] = k.split("|");
    return { model, condition, kind, correct: g.correct, total: g.total, accuracy: g.correct / g.total, avgTokens: Math.round(g.tokens / g.total), avgToolCalls: g.toolCalls / g.total };
  });
  writeFileSync(resolve(dir, "summary.json"), json({ updated: new Date().toISOString(), files, summary }));
  for (const s of summary.filter((x) => x.kind === "all")) console.log(`${s.model} ${s.condition.padEnd(9)} ${s.correct}/${s.total} = ${(s.accuracy * 100).toFixed(0)} %  avg tokens ${s.avgTokens}`);
}

// Run only as the CLI (dist/evals.mjs), not when tests import the grading functions.
if (process.argv[1]?.endsWith("evals.mjs")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
