// Titles, descriptions and canonical addresses of the app's pages, for search engines and link previews.
// The build writes one HTML file per public page (`PRERENDERED`, vite.config.ts) with these in its head and a short
// text in #root, since the app shell alone looks the same on every page until JavaScript runs; App.tsx sets the
// same tags when moving between pages. Pure (no React or Firebase imports), so vite.config.ts can use it.
import { CATEGORY_ORDER, categoryFromSlug, categorySlug } from "./categories";
import type { Route } from "./route";

export const SITE = "https://wardrobediary.io";
const SUFFIX = " – The Wardrobe Diary Project";

export interface PageMeta {
  title: string;
  description: string;
  /** Path of the canonical address; absent for pages that shouldn't be indexed (owner-only, not found). */
  canonical?: string;
}

export function pageMeta(route: Route, garmentName?: string): PageMeta {
  switch (route.page) {
    case "dashboard":
      return {
        title: `Wardrobe dashboard${SUFFIX}`,
        description:
          "Every garment worn since 1 January 2018, by category: active items, inventory value, cost per wear, days used, yearly cost and turnover, with charts over time.",
        canonical: "/dashboard",
      };
    case "materials":
      return {
        title: `Materials${SUFFIX}`,
        description:
          "The fibres the wardrobe is made of: fibre mass owned and worn, the fibre mix of each category, and the monthly outfit weight and synthetic share.",
        canonical: "/materials",
      };
    case "category": {
      const category = categoryFromSlug(route.slug);
      if (!category) return pageMeta({ page: "notFound" });
      return {
        title: `${category}${SUFFIX}`,
        description: `Every item in ${category.toLowerCase()} since 2018: times worn, wears per month and cost per wear of each, with charts of use and cost.`,
        canonical: `/category/${route.slug}`,
      };
    }
    case "garment":
      return {
        title: `${garmentName ?? "Garment"}${SUFFIX}`,
        description: `${garmentName ?? "A garment"}: price, dates, materials, times worn, cost per wear and wears per month, from a daily wardrobe log since 2018.`,
        canonical: `/garment/${encodeURIComponent(route.id)}`,
      };
    case "log":
      return { title: `Log${SUFFIX}`, description: "Daily logging (owner only)." };
    case "manage":
      return { title: `Manage${SUFFIX}`, description: "Garment management (owner only)." };
    case "notFound":
      return { title: `Page not found${SUFFIX}`, description: "There is no page at this address." };
  }
}

/** The public app pages listed in the sitemap, each built as its own HTML file (see firebase.json rewrites). */
export const PRERENDERED: Route[] = [
  { page: "dashboard" },
  { page: "materials" },
  ...CATEGORY_ORDER.map((c): Route => ({ page: "category", slug: categorySlug(c) })),
];

/** Where the build writes a prerendered page, relative to dist/: "/category/knits" → "pages/category/knits.html". */
export const prerenderFile = (path: string) => `pages${path}.html`;

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The head tags for a page (title, description, canonical and link preview). */
export function headTags(meta: PageMeta): string {
  const url = meta.canonical && `${SITE}${meta.canonical}`;
  return [
    `<title>${escape(meta.title)}</title>`,
    `<meta name="description" content="${escape(meta.description)}" />`,
    url && `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${escape(meta.title)}" />`,
    `<meta property="og:description" content="${escape(meta.description)}" />`,
    url && `<meta property="og:url" content="${url}" />`,
  ]
    .filter(Boolean)
    .join("\n    ");
}

/** The text a prerendered page shows until the app has loaded (and what crawlers see without JavaScript):
 *  its heading and description, and links to the other public pages. */
export function prerenderBody(route: Route): string {
  const meta = pageMeta(route);
  const heading = meta.title.replace(SUFFIX, "");
  const links = [
    ["/", "The Wardrobe Diary Project"],
    ["/dashboard", "Wardrobe dashboard"],
    ["/materials", "Materials"],
    ...CATEGORY_ORDER.map((c) => [`/category/${categorySlug(c)}`, c]),
    ["/glossary", "Glossary"],
    ["/model", "Semantic model"],
    ["/data", "Data catalog"],
  ];
  // Minimal inline style: the app's stylesheet loads with its JavaScript, and this shows only until then.
  const style =
    "<style>.prerender{font-family:system-ui,sans-serif;max-width:46em;margin:24px auto;padding:0 16px;line-height:1.5}" +
    ".prerender ul{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px}</style>";
  return [
    style,
    `<div class="prerender">`,
    `<h1>${escape(heading)}</h1>`,
    `<p>${escape(meta.description)}</p>`,
    `<p>Loading the data…</p>`,
    `<nav><ul>${links.map(([href, text]) => `<li><a href="${href}">${escape(text)}</a></li>`).join("")}</ul></nav>`,
    `</div>`,
  ].join("");
}
