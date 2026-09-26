#!/usr/bin/env node
// Builds data/snapshot.json from the published Sheet or from local CSVs.
//
//   node scripts/snapshot.mjs                        live: fetch the 5 CSVs from config.js
//   node scripts/snapshot.mjs --from-dir data/sample offline: build from local CSVs
//   node scripts/snapshot.mjs --check                validate only, write nothing
//
// Options: --force skips the sanity guard; --out <file> writes (and compares
// against) another file than data/snapshot.json.
//
// Exit code 1, without writing, when a fetch fails, the data is structurally
// invalid, or the new slot count is below 50 % of the existing snapshot's.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import config from "../config.js";
import { parseCSV } from "../src/csv.js";
import { buildModel, csvUrl, TABS, TAB_NAMES } from "../src/model.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GUARD_RATIO = 0.5;

function parseArgs(argv) {
  const opts = { fromDir: null, check: false, force: false, out: path.join(ROOT, "data/snapshot.json") };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") opts.check = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--from-dir" || arg === "--out") {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} needs a path`);
      if (arg === "--from-dir") opts.fromDir = path.resolve(value);
      else opts.out = path.resolve(value);
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

// A missing file is passed on as a missing tab, so buildModel reports it.
async function readDir(dir) {
  const tables = {};
  for (const tab of TABS) {
    try {
      tables[tab] = parseCSV(await readFile(path.join(dir, `${tab}.csv`), "utf8"));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  return tables;
}

async function fetchSheet() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.TIMEOUT_MS);
  try {
    const texts = await Promise.all(
      TABS.map(async (tab) => {
        const res = await fetch(csvUrl(config, tab), { signal: controller.signal });
        if (!res.ok) throw new Error(`${TAB_NAMES[tab]}: HTTP ${res.status}`);
        const text = await res.text();
        if (text.trimStart().startsWith("<")) throw new Error(`${TAB_NAMES[tab]}: HTML response instead of CSV`);
        return text;
      }),
    );
    return Object.fromEntries(TABS.map((tab, i) => [tab, parseCSV(texts[i])]));
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`timeout after ${config.TIMEOUT_MS} ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// null when there is no snapshot yet. An unreadable one is an error, since it
// would otherwise disable the sanity guard silently.
async function readExisting(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`cannot parse the existing snapshot ${file}; use --force to overwrite it`);
  }
}

const serialize = (model) => JSON.stringify(model, null, 2) + "\n";

function sameContent(a, b) {
  return serialize({ ...a, generatedAt: "" }) === serialize({ ...b, generatedAt: "" });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let tables;
  if (opts.fromDir) {
    tables = await readDir(opts.fromDir);
  } else {
    const configured = config.PUB_ID && TABS.every((tab) => config.GIDS[tab]);
    if (!configured) {
      console.log("skipped=not-configured");
      return 0;
    }
    try {
      tables = await fetchSheet();
    } catch (err) {
      console.error(`error: fetch failed: ${err.message}`);
      return 1;
    }
  }

  const result = buildModel(tables, { source: opts.fromDir ? "sample" : "sheet", now: new Date() });
  if (!result.ok) {
    for (const line of result.fatal) console.error(`error: ${line}`);
    return 1;
  }
  const model = result.model;
  for (const i of model.issues) console.error(`${i.level}: ${TAB_NAMES[i.tab]}, ${i.row}. sor: ${i.message}`);

  let existing;
  try {
    existing = await readExisting(opts.out);
  } catch (err) {
    if (!opts.force) {
      console.error(`error: ${err.message}`);
      return 1;
    }
    existing = null;
  }
  const previousSlots = existing && Array.isArray(existing.slots) ? existing.slots.length : 0;
  if (!opts.force && model.slots.length < previousSlots * GUARD_RATIO) {
    console.error(
      `error: sanity guard: ${model.slots.length} slots is below ${GUARD_RATIO * 100} % of the existing ${previousSlots}; use --force to override`,
    );
    return 1;
  }

  const changed = !existing || !sameContent(existing, model);
  if (!changed) model.generatedAt = existing.generatedAt;

  console.log(
    `slots=${model.slots.length} activities=${model.activities.length} classes=${model.classes.length} issues=${model.issues.length} changed=${changed ? "yes" : "no"}`,
  );
  if (changed && !opts.check) await writeFile(opts.out, serialize(model));
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`error: ${err.message}`);
    process.exitCode = 1;
  },
);
