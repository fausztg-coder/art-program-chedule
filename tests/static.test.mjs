// Static checks of the page files: safe DOM building, deploy coverage,
// allowed network hosts, colour tokens and the exact UI copy (CLAUDE.md, SPEC 1.1 §4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ROOT, file), "utf8");
const filesIn = (dir, ext) =>
  readdirSync(path.join(ROOT, dir))
    .filter((name) => name.endsWith(ext))
    .map((name) => `${dir}/${name}`);

const INDEX = read("index.html");
const SPEC = read("SPEC.md");
const PAGE_SCRIPTS = [...filesIn("src", ".js"), "config.js"];
const STYLESHEETS = filesIn("css", ".css");

test("page scripts never parse HTML strings", () => {
  for (const file of PAGE_SCRIPTS) {
    // Comments may name the APIs (render.js says it avoids innerHTML).
    const code = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    for (const api of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "createContextualFragment", "DOMParser"]) {
      assert.ok(!code.includes(api), `${file} uses ${api}`);
    }
  }
});

test("every local file index.html refers to is deployed by pages.yml", () => {
  const copy = read(".github/workflows/pages.yml").match(/^\s*cp -r (.+) _site\/$/m);
  assert.ok(copy, "pages.yml has no 'cp -r … _site/' line");
  const deployed = copy[1].split(/\s+/);
  const refs = [...INDEX.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((ref) => !/^(?:https?:|data:)/.test(ref));
  assert.ok(local.length > 0);
  for (const ref of local) {
    assert.ok(statSync(path.join(ROOT, ref)).isFile(), `${ref} does not exist`);
    const top = ref.split("/")[0];
    assert.ok(deployed.includes(top), `${ref} is not copied to _site (cp -r ${copy[1]})`);
  }
  // Modules imported by the page must be deployed too.
  for (const file of PAGE_SCRIPTS) {
    for (const [, spec] of read(file).matchAll(/^import .* from "(\.{1,2}\/[^"]+)";$/gm)) {
      const target = path.relative(ROOT, path.resolve(path.dirname(path.join(ROOT, file)), spec));
      assert.ok(deployed.includes(target.split(path.sep)[0]), `${file} imports ${target}, which is not deployed`);
    }
  }
});

test("the page only talks to Google Fonts and the published Sheet", () => {
  const external = [...INDEX.matchAll(/\b(?:href|src)="(https?:[^"]+)"/g)].map((m) => new URL(m[1]).host);
  assert.deepEqual([...new Set(external)].sort(), ["fonts.googleapis.com", "fonts.gstatic.com"]);
  for (const file of [...PAGE_SCRIPTS, ...STYLESHEETS]) {
    for (const [url] of read(file).matchAll(/https?:\/\/[^\s"'`)]+/g)) {
      const allowed = url.startsWith("https://docs.google.com/spreadsheets/") || url === "http://www.w3.org/2000/svg";
      assert.ok(allowed, `${file} refers to ${url}`);
    }
  }
});

test("css/tokens.css defines the SPEC §4.2 colour tokens with their values", () => {
  const section = SPEC.slice(SPEC.indexOf("### 4.2"), SPEC.indexOf("### 4.3"));
  const rows = [...section.matchAll(/^\| `([a-z-]+)` \| ([^|]+?) \|/gm)].map((m) => [m[1], m[2].trim()]);
  assert.ok(rows.length >= 18, `found only ${rows.length} tokens in SPEC §4.2`);
  const tokens = read("css/tokens.css");
  const normal = (value) => value.toLowerCase().replace(/\s+/g, "");
  for (const [name, value] of rows) {
    const m = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`));
    assert.ok(m, `--${name} is missing from css/tokens.css`);
    assert.equal(normal(m[1]), normal(value), `--${name}`);
  }
});

test("every custom property the stylesheets use is defined", () => {
  const css = STYLESHEETS.map(read).join("\n");
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  // Set per element from the Sheet colours in src/render.js.
  for (const name of ["--dot", "--tint"]) defined.add(name);
  for (const [, name] of css.matchAll(/var\((--[a-z0-9-]+)/g)) {
    assert.ok(defined.has(name), `${name} is used but never defined`);
  }
});

test("index.html carries the exact SPEC copy", () => {
  const specCopy = [
    "Művészeti órarend",
    "MŰVÉSZETI KÉPZÉS",
    "Betöltés…",
    "több is választható",
    "PDF/nyomtatás",
    "PDF/nyomtatás csak egy osztály kiválasztásakor érhető el.",
    "Erre a választásra nincs foglalkozás.",
  ];
  for (const text of specCopy) {
    assert.ok(SPEC.includes(text), `not in SPEC.md: ${text}`);
    assert.ok(INDEX.includes(text), `not in index.html: ${text}`);
  }
  const heads = [...INDEX.matchAll(/<span>([A-ZÁÉÍÓÖŐÚÜŰ]+)<\/span>/g)].map((m) => m[1]).join(" · ");
  assert.ok(SPEC.includes(`„${heads}”`), `column headings: ${heads}`);
  // Kept from 1.0 (docs/archive/SPEC-1.0.md).
  assert.ok(INDEX.includes("Az órarend most nem tölthető be. Próbáld újra később."));
  assert.ok(INDEX.includes('<html lang="hu">'));
});
