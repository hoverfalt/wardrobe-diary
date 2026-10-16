// Types for scripts/semantics.mjs, so tests (TypeScript) can import it.
export function load(): Record<string, unknown> & { model: { version: string } };
export function outputs(s: ReturnType<typeof load>): Record<string, string>;
export function definitionsMarkdown(s: ReturnType<typeof load>): string;
