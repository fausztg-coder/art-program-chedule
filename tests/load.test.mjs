import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadData, pickMode } from "../src/load.js";
import { csvUrl, TABS } from "../src/model.js";

const BASE_CONFIG = {
  PUB_ID: "",
  GIDS: { foglalkozasok: "", foglalkozastipusok: "", osztalyok: "", orak: "", beallitasok: "" },
  TIMEOUT_MS: 200,
  SAMPLE_BASE: "data/sample/",
  SNAPSHOT_URL: "data/snapshot.json",
};
const LIVE_CONFIG = {
  ...BASE_CONFIG,
  PUB_ID: "2PACX-test",
  GIDS: { foglalkozasok: "1", foglalkozastipusok: "2", osztalyok: "3", orak: "4", beallitasok: "5" },
};

const readRepo = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SNAPSHOT = JSON.parse(readRepo("data/snapshot.json"));

// Serves repo files by relative URL and maps the live Sheet URLs to the sample
// CSVs. `overrides` maps a URL to a handler (init) => Response | Promise.
function fakeFetch(overrides = {}) {
  const calls = [];
  const liveToSample = Object.fromEntries(TABS.map((tab) => [csvUrl(LIVE_CONFIG, tab), `data/sample/${tab}.csv`]));
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (overrides[url]) return overrides[url](init);
    const path = liveToSample[url] || url;
    try {
      return new Response(readRepo(path), { status: 200 });
    } catch {
      return new Response("not found", { status: 404 });
    }
  };
  return { fetch, calls };
}

// A response that only settles when the request is aborted.
const hang = (init) =>
  new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));

const sampleUrl = (tab) => `data/sample/${tab}.csv`;

test("pickMode", () => {
  assert.equal(pickMode(BASE_CONFIG, ""), "snapshot");
  assert.equal(pickMode(LIVE_CONFIG, ""), "live");
  assert.equal(pickMode({ ...LIVE_CONFIG, GIDS: { ...LIVE_CONFIG.GIDS, orak: "" } }, ""), "snapshot");
  assert.equal(pickMode(BASE_CONFIG, "?forras=minta"), "sample");
  assert.equal(pickMode(LIVE_CONFIG, "?osztaly=4.a&forras=minta"), "sample");
  assert.equal(pickMode(LIVE_CONFIG, "?forras=other"), "live");
});

test("snapshot mode loads only the snapshot, without a fallback reason", async () => {
  const { fetch, calls } = fakeFetch();
  const result = await loadData(BASE_CONFIG, { mode: "snapshot", fetch });
  assert.deepEqual(result, { model: SNAPSHOT, origin: "snapshot" });
  assert.deepEqual(calls.map((c) => c.url), ["data/snapshot.json"]);
});

test("sample mode runs the sample CSVs through the full pipeline", async () => {
  const { fetch, calls } = fakeFetch();
  const now = () => new Date("2026-10-01T08:00:00Z");
  const result = await loadData(BASE_CONFIG, { mode: "sample", fetch, now });
  assert.equal(result.origin, "sample");
  assert.equal(result.fallbackReason, undefined);
  assert.equal(result.model.source, "sample");
  assert.equal(result.model.generatedAt, "2026-10-01T08:00:00Z");
  assert.equal(result.model.items.length, 28);
  assert.deepEqual(calls.map((c) => c.url).sort(), TABS.map(sampleUrl).sort());
  assert.ok(calls.every((c) => c.init.cache === "no-store" && c.init.signal));
  assert.equal(new Set(calls.map((c) => c.init.signal)).size, TABS.length, "each tab has its own timeout (SPEC 1.1 §2.1)");
});

test("live mode fetches the published Sheet URLs", async () => {
  const { fetch, calls } = fakeFetch();
  const result = await loadData(LIVE_CONFIG, { mode: "live", fetch });
  assert.equal(result.origin, "live");
  assert.equal(result.model.source, "sheet");
  assert.equal(result.model.items.length, 28);
  assert.deepEqual(
    calls.map((c) => c.url).sort(),
    TABS.map((tab) => csvUrl(LIVE_CONFIG, tab)).sort(),
  );
  assert.match(calls[0].url, /^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/2PACX-test\/pub\?gid=\d&single=true&output=csv$/);
});

async function assertFallback(overrides, reason) {
  const { fetch } = fakeFetch(overrides);
  const result = await loadData(LIVE_CONFIG, { mode: "live", fetch });
  assert.equal(result.origin, "snapshot");
  assert.deepEqual(result.model, SNAPSHOT);
  assert.match(result.fallbackReason, reason);
}

test("falls back to the snapshot when a response is not OK", async () => {
  await assertFallback({ [csvUrl(LIVE_CONFIG, "orak")]: () => new Response("", { status: 404 }) }, /Órák: HTTP 404/);
});

test("falls back to the snapshot when a body is HTML", async () => {
  const html = () => new Response("\n<!DOCTYPE html><html>Sign in</html>", { status: 200 });
  await assertFallback({ [csvUrl(LIVE_CONFIG, "osztalyok")]: html }, /Osztályok: HTML response instead of CSV/);
});

test("falls back to the snapshot when a fetch fails", async () => {
  await assertFallback(
    { [csvUrl(LIVE_CONFIG, "beallitasok")]: () => Promise.reject(new TypeError("Failed to fetch")) },
    /Failed to fetch/,
  );
});

test("falls back to the snapshot when the data is structurally invalid", async () => {
  const broken = () => new Response(readRepo("data/sample/orak.csv").replace("Kezdés", "Start"), { status: 200 });
  await assertFallback({ [csvUrl(LIVE_CONFIG, "orak")]: broken }, /Órák fül: hiányzó oszlop: Kezdés/);
});

test("falls back to the snapshot after the batch timeout", async () => {
  await assertFallback({ [csvUrl(LIVE_CONFIG, "foglalkozasok")]: hang }, /Foglalkozások: timeout after 200 ms/);
});

test("sample mode falls back too", async () => {
  const { fetch } = fakeFetch({ [sampleUrl("foglalkozasok")]: () => new Response("", { status: 500 }) });
  const result = await loadData(BASE_CONFIG, { mode: "sample", fetch });
  assert.equal(result.origin, "snapshot");
  assert.match(result.fallbackReason, /Foglalkozások: HTTP 500/);
});

test("rejects when the snapshot also fails, keeping both reasons", async () => {
  const { fetch } = fakeFetch({
    [csvUrl(LIVE_CONFIG, "orak")]: () => new Response("", { status: 404 }),
    "data/snapshot.json": () => new Response("", { status: 404 }),
  });
  await assert.rejects(loadData(LIVE_CONFIG, { mode: "live", fetch }), /Órák: HTTP 404; snapshot: HTTP 404/);
});

test("rejects a snapshot of an unexpected format", async () => {
  const variants = [
    { ...SNAPSHOT, version: 1 },
    { ...SNAPSHOT, items: [...SNAPSHOT.items, { ...SNAPSHOT.items[0], first: 9, last: 8 }] },
    { ...SNAPSHOT, activities: [{ ...SNAPSHOT.activities[0], tint: undefined }, ...SNAPSHOT.activities.slice(1)] },
    { ...SNAPSHOT, classes: [] },
    { ...SNAPSHOT, periods: [] },
    { ...SNAPSHOT, settings: null },
    { ...SNAPSHOT, issues: undefined },
    { ...SNAPSHOT, generatedAt: "" },
    { ...SNAPSHOT, generatedAt: "tegnap" },
    { ...SNAPSHOT, settings: { ...SNAPSHOT.settings, tanev: 2027 } },
    { ...SNAPSHOT, items: [...SNAPSHOT.items, { ...SNAPSHOT.items[0], last: 99 }] },
    { ...SNAPSHOT, items: [...SNAPSHOT.items, { ...SNAPSHOT.items[0], day: "V" }] },
    { ...SNAPSHOT, items: [...SNAPSHOT.items, { ...SNAPSHOT.items[0], activityId: "nincs" }] },
    { ...SNAPSHOT, items: [...SNAPSHOT.items, { ...SNAPSHOT.items[0], targets: null }] },
    [],
  ];
  for (const body of variants.map((v) => JSON.stringify(v))) {
    const { fetch } = fakeFetch({ "data/snapshot.json": () => new Response(body, { status: 200 }) });
    await assert.rejects(loadData(BASE_CONFIG, { mode: "snapshot", fetch }), /snapshot: unexpected format/);
  }
});

test("rejects a snapshot that is not JSON", async () => {
  const { fetch } = fakeFetch({ "data/snapshot.json": () => new Response("<html>", { status: 200 }) });
  await assert.rejects(loadData(BASE_CONFIG, { mode: "snapshot", fetch }), /JSON/);
});

test("the snapshot request has a timeout too", async () => {
  const { fetch } = fakeFetch({ "data/snapshot.json": hang });
  await assert.rejects(loadData(BASE_CONFIG, { mode: "snapshot", fetch }), /timeout after 200 ms/);
});

test("the other requests are aborted after the first failure", async () => {
  const aborted = [];
  const { fetch } = fakeFetch({
    [csvUrl(LIVE_CONFIG, "orak")]: () => new Response("", { status: 404 }),
    ...Object.fromEntries(
      TABS.filter((tab) => tab !== "orak").map((tab) => [
        csvUrl(LIVE_CONFIG, tab),
        (init) => {
          init.signal.addEventListener("abort", () => aborted.push(tab));
          return hang(init);
        },
      ]),
    ),
  });
  const result = await loadData(LIVE_CONFIG, { mode: "live", fetch });
  assert.match(result.fallbackReason, /Órák: HTTP 404/);
  assert.equal(aborted.length, TABS.length - 1);
});
