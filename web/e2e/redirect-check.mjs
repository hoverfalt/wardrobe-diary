// Checks that every old wardrobediary.io address (R-16) still leads somewhere useful: each redirect in
// firebase.json must answer 301 with the configured target, and the target must load (200). Also checks that
// query strings survive (LinkedIn links carry ?trk=...) and that the landing page and app pages answer 200.
// Read-only. Run: node e2e/redirect-check.mjs [base]   (default https://wardrobediary.web.app)
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "https://wardrobediary.web.app").replace(/\/$/, "");
const { redirects } = JSON.parse(readFileSync(new URL("../../firebase.json", import.meta.url), "utf8")).hosting;
let failures = 0;
const report = (ok, text) => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${text}`);
};

async function head(path) {
  const r = await fetch(BASE + path, { redirect: "manual" });
  return { status: r.status, location: r.headers.get("location") };
}

for (const { source, destination } of redirects) {
  const r = await head(source);
  const target = r.location ? new URL(r.location, BASE) : null;
  const want = new URL(destination, BASE);
  const sameTarget = target && target.pathname === want.pathname && target.hash === want.hash;
  const final = target ? await fetch(new URL(target.pathname, BASE)) : null;
  report(r.status === 301 && sameTarget && final?.status === 200, `${source} → ${r.status} ${r.location ?? "-"} (target ${final?.status ?? "-"})`);
}

const q = await head("/index.html?trk=public_post_comment-text");
report(q.status === 301 && (q.location ?? "").includes("trk=public_post_comment-text"), `query string kept: /index.html?trk=… → ${q.location}`);

for (const path of ["/", "/dashboard", "/category/shirts", "/materials", "/garment/Shirts-031", "/robots.txt", "/sitemap.xml"]) {
  const r = await fetch(BASE + path);
  report(r.status === 200, `${path} → ${r.status}`);
}
const landing = await (await fetch(BASE + "/")).text();
report(landing.includes("og:image") && landing.includes("Media coverage"), "landing page is static HTML with preview tags and content");

console.log(failures ? `\n${failures} failed` : "\nAll redirects and pages OK");
process.exitCode = failures ? 1 : 0;
