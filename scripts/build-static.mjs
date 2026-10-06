#!/usr/bin/env node
/**
 * Builds SYNAPSE as a fully static site (output: dist/client) for GitHub Pages or any file host.
 *
 *   npm run build:static                       # served from "/"
 *   STATIC_BASE=/my-repo/ npm run build:static # served from a sub-path
 *
 * On GitHub Actions the base is taken from the repository name automatically.
 */
import { spawnSync } from "node:child_process";
import { finishStatic } from "./finish-static.mjs";

function resolveBase() {
  let base = process.env.STATIC_BASE;
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (!base && repo) base = repo.toLowerCase().endsWith(".github.io") ? "/" : `/${repo}/`;
  base = base || "/";
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;
  return base;
}

const base = resolveBase();
console.log(`[static] building with base ${base}`);
const result = spawnSync(process.execPath, ["scripts/with-app-env.mjs", "vite", "build"], {
  stdio: "inherit",
  env: { ...process.env, STATIC_BUILD: "1", STATIC_BASE: base },
});
if (result.status !== 0) process.exit(result.status ?? 1);
finishStatic({ base });
