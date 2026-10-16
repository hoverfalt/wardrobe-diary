// /model page script: draws the conceptual model diagram (Mermaid source generated from ontology.yaml).
const MERMAID = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

async function main() {
  const { default: mermaid } = await import(/* @vite-ignore */ MERMAID);
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", securityLevel: "strict" });
  await mermaid.run({ querySelector: ".mermaid" });
}
main().catch(() => {
  // The diagram is an enhancement: the class and property tables below say the same in text.
});
