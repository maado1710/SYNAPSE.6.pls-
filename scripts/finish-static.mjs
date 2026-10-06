/**
 * Post-processes the static build (dist/client) for plain file hosts such as GitHub Pages:
 * base-aware head links, a web manifest, a 404.html fallback so deep links work,
 * and the service worker's cache list.
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export function finishStatic({ base, outDir = "dist/client" }) {
  const dir = join(process.cwd(), outDir);
  const indexPath = join(dir, "index.html");
  if (!existsSync(indexPath))
    throw new Error(`[static] ${indexPath} not found — did the build run?`);

  // 1. Head links the platform plugin wrote as root-relative paths.
  let html = readFileSync(indexPath, "utf8");
  html = html
    .replaceAll('href="/favicon.svg"', `href="${base}favicon.svg"`)
    .replaceAll('href="/__grok/manifest.webmanifest"', `href="${base}manifest.webmanifest"`)
    .replaceAll('href="/__grok/icon-180.png"', `href="${base}__grok/icon-180.png"`);
  writeFileSync(indexPath, html);

  // 2. Web manifest (installable app), scoped to the sub-path.
  const manifest = {
    name: "SYNAPSE",
    short_name: "SYNAPSE",
    description: "Learn to code. Make it stick.",
    id: base,
    start_url: base,
    scope: base,
    display: "standalone",
    background_color: "#0b0c0b",
    theme_color: "#0b0c0b",
    icons: [
      { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      { src: `${base}__grok/icon-180.png`, sizes: "180x180", type: "image/png" },
    ],
  };
  writeFileSync(join(dir, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));

  // 3. GitHub Pages: unknown paths (deep links, refreshes) get 404.html — make it the app shell.
  copyFileSync(indexPath, join(dir, "404.html"));
  writeFileSync(join(dir, ".nojekyll"), "");
  rmSync(join(dir, "__grok", "install"), { recursive: true, force: true });

  // 4. Service worker: version + files to cache for offline use.
  const swPath = join(dir, "sw.js");
  const assets = readdirSync(join(dir, "assets"))
    .filter((f) => !f.endsWith(".map"))
    .sort()
    .map((f) => `assets/${f}`);
  const precache = [...assets, "favicon.svg"];
  const version = createHash("sha1").update(precache.join("\n")).digest("hex").slice(0, 10);
  const sw = readFileSync(swPath, "utf8")
    .replace("__SW_VERSION__", version)
    .replace("/*__PRECACHE__*/ []", JSON.stringify(precache))
    .replace("/*__SPA__*/ false", "true");
  writeFileSync(swPath, sw);

  console.log(
    `[static] base ${base} · ${precache.length} files cached offline · service worker ${version}`,
  );
}
