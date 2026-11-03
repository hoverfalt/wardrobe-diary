import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { headTags, pageMeta, prerenderBody, prerenderFile, PRERENDERED } from "./pageMeta";

const root = new URL("../../../", import.meta.url);
const sitemap = [...readFileSync(new URL("web/public/sitemap.xml", root), "utf8").matchAll(/<loc>https:\/\/wardrobediary\.io([^<]*)<\/loc>/g)].map((m) => m[1]);
const firebase = JSON.parse(readFileSync(new URL("firebase.json", root), "utf8"));
const rewrites = new Map<string, string>(firebase.hosting.rewrites.map((r: { source: string; destination?: string }) => [r.source, r.destination]));
const STATIC = ["/", "/glossary", "/model", "/data", "/evals"]; // landing page and generated semantic pages

describe("page metadata and prerendered pages", () => {
  const paths = PRERENDERED.map((r) => pageMeta(r).canonical!);

  it("prerenders exactly the sitemap's app pages", () => {
    expect(paths.sort()).toEqual(sitemap.filter((p) => !STATIC.includes(p)).sort());
  });

  it("has a Hosting rewrite to each prerendered file, before the catch-all", () => {
    const sources = [...rewrites.keys()];
    for (const p of paths) {
      expect(rewrites.get(p)).toBe(`/${prerenderFile(p)}`);
      expect(sources.indexOf(p)).toBeLessThan(sources.indexOf("**"));
    }
  });

  it("gives every page its own title and description", () => {
    const metas = PRERENDERED.map((r) => pageMeta(r));
    expect(new Set(metas.map((m) => m.title)).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.description)).size).toBe(metas.length);
    expect(pageMeta({ page: "category", slug: "knits" })).toMatchObject({ title: "Knits – The Wardrobe Diary Project", canonical: "/category/knits" });
  });

  it("leaves unknown, owner-only and missing pages without a canonical address", () => {
    expect(pageMeta({ page: "category", slug: "hats" }).canonical).toBeUndefined();
    expect(pageMeta({ page: "log" }).canonical).toBeUndefined();
    expect(pageMeta({ page: "notFound" }).canonical).toBeUndefined();
    expect(pageMeta({ page: "garment", id: "Knits-001" }, "Uniqlo gray merino").title).toBe("Uniqlo gray merino – The Wardrobe Diary Project");
  });

  it("escapes text in the HTML", () => {
    expect(headTags({ title: 'A & "B" <c>', description: "d" })).toContain("<title>A &amp; &quot;B&quot; &lt;c&gt;</title>");
    expect(prerenderBody({ page: "dashboard" })).toContain('<a href="/category/t-shirts-and-tanks">T-shirts and tanks</a>');
  });
});
