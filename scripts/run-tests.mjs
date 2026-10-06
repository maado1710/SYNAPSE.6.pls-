#!/usr/bin/env node
/** Cross-platform test runner (works on Windows, macOS and Linux). */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const run = (args) => {
  const r = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Platform-tooling tests (grok-pwa-plugin) depend on the generator's own site config, so skip them.
const scriptTests = readdirSync("scripts")
  .filter((f) => f.endsWith(".test.mjs") && !f.includes("grok-pwa-plugin"))
  .map((f) => `scripts/${f}`);
run(["--test", ...scriptTests]);

run([
  "--experimental-strip-types",
  "--test",
  "src/lib/app-data/app-data.test.ts",
  "src/lib/app-data/readiness-schedule.test.ts",
  "src/lib/auth/gate-identity.test.ts",
  "src/lib/auth/sign-in-gate.test.ts",
  "src/lib/review.test.ts",
  "src/lib/dates.test.ts",
  "src/lib/code-grade.test.ts",
  "src/lib/curriculum/curriculum.test.ts",
  "src/lib/lesson-flow.test.ts",
]);
