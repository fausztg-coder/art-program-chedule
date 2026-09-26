import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts/snapshot.mjs");
const SAMPLE = path.join(ROOT, "data/sample");
const SNAPSHOT = path.join(ROOT, "data/snapshot.json");

const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: "utf8" });
const tempDirs = [];
function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "hunyadi-snapshot-"));
  tempDirs.push(dir);
  return dir;
}
after(() => tempDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// A copy of the sample CSVs, with one file transformed.
function sampleCopy(file, transform) {
  const dir = tempDir();
  cpSync(SAMPLE, dir, { recursive: true });
  if (file) writeFileSync(path.join(dir, file), transform(readFileSync(path.join(dir, file), "utf8")));
  return dir;
}

test("--from-dir data/sample --check exits 0 and writes nothing", () => {
  const before = readFileSync(SNAPSHOT, "utf8");
  // Compare against no snapshot: once the committed snapshot comes from the
  // live Sheet, its slot count must not make the sanity guard trip here.
  const result = run("--from-dir", "data/sample", "--check", "--out", path.join(tempDir(), "none.json"));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^rows=28 activities=12 classes=16 issues=0 changed=yes\n$/);
  assert.equal(readFileSync(SNAPSHOT, "utf8"), before);
});

test("the committed snapshot is valid for the page", () => {
  const model = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  assert.equal(model.version, 2);
  assert.ok(model.classes.length > 0 && model.periods.length > 0 && Array.isArray(model.items) && Array.isArray(model.issues));
});

test("a broken header exits 1 without writing", () => {
  const dir = sampleCopy("foglalkozasok.csv", (csv) => csv.replace(/^Nap,/, "Napok,"));
  const out = path.join(tempDir(), "snapshot.json");
  const result = run("--from-dir", dir, "--out", out);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Foglalkozások fül: hiányzó oszlop: Nap/);
  assert.equal(existsSync(out), false);
});

test("a missing CSV file exits 1", () => {
  const dir = sampleCopy();
  rmSync(path.join(dir, "orak.csv"));
  const result = run("--from-dir", dir, "--check");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Hiányzó fül: Órák/);
});

test("writes deterministic JSON and keeps generatedAt when nothing changed", () => {
  const out = path.join(tempDir(), "snapshot.json");
  const first = run("--from-dir", SAMPLE, "--out", out);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /changed=yes/);
  const written = readFileSync(out, "utf8");
  assert.ok(written.endsWith("}\n"));
  const model = JSON.parse(written);
  assert.deepEqual(Object.keys(model), ["version", "generatedAt", "source", "settings", "days", "periods", "classes", "activities", "items", "issues"]);
  assert.equal(model.source, "sample");
  assert.equal(model.items.length, 28);

  const second = run("--from-dir", SAMPLE, "--out", out);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /changed=no/);
  assert.equal(readFileSync(out, "utf8"), written);
});

test("row issues are reported on stderr and counted", () => {
  const dir = sampleCopy("foglalkozasok.csv", (csv) => csv.replace("Hétfő,7,7,Bábjáték", "Vasárnap,7,7,Bábjáték"));
  const result = run("--from-dir", dir, "--check");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^rows=27 .* issues=1 /);
  assert.match(result.stderr, /error: Foglalkozások, 2\. sor: ismeretlen nap: ‚Vasárnap’/);
});

test("the sanity guard trips below 50 % of the existing rows; --force overrides it", () => {
  const out = path.join(tempDir(), "snapshot.json");
  assert.equal(run("--from-dir", SAMPLE, "--out", out).status, 0);
  const before = readFileSync(out, "utf8");
  const dir = sampleCopy("foglalkozasok.csv", (csv) => csv.split("\r\n").slice(0, 3).join("\r\n"));

  const guarded = run("--from-dir", dir, "--out", out);
  assert.equal(guarded.status, 1);
  assert.match(guarded.stderr, /sanity guard: 2 rows is below 50 % of the existing 28/);
  assert.equal(readFileSync(out, "utf8"), before);

  assert.equal(run("--from-dir", dir, "--out", out, "--check").status, 1);

  const forced = run("--from-dir", dir, "--out", out, "--force");
  assert.equal(forced.status, 0, forced.stderr);
  assert.equal(JSON.parse(readFileSync(out, "utf8")).items.length, 2);
});

test("live mode is skipped while the Sheet is not configured", { skip: config.PUB_ID ? "PUB_ID is set" : false }, () => {
  const result = run("--check");
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "skipped=not-configured\n");
});

test("an unknown argument exits 1", () => {
  const result = run("--bogus");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown argument: --bogus/);
});

test("an unreadable existing snapshot is an error unless --force", () => {
  const out = path.join(tempDir(), "snapshot.json");
  writeFileSync(out, '{"slots": [');
  const result = run("--from-dir", SAMPLE, "--out", out);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot parse the existing snapshot/);
  assert.equal(readFileSync(out, "utf8"), '{"slots": [');
  assert.equal(run("--from-dir", SAMPLE, "--out", out, "--force").status, 0);
  assert.equal(JSON.parse(readFileSync(out, "utf8")).items.length, 28);
});
