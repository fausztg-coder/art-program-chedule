import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL,
  STORAGE_KEY,
  activityCounts,
  classesOfGrade,
  gradesOf,
  loadStored,
  normalizeSelection,
  persist,
  readQuery,
  resolveSelection,
  searchFor,
  selectActivity,
  selectClass,
  selectGrade,
} from "../src/state.js";
import { sampleTables, buildOk, withTab } from "./helpers.mjs";

const sample = buildOk(sampleTables());

test("grades and classes come from the model", () => {
  assert.deepEqual(gradesOf(sample), ["1", "2", "3", "4", "5", "6", "7", "8"]);
  assert.deepEqual(classesOfGrade(sample, "4"), ["4.a", "4.b"]);
  assert.deepEqual(classesOfGrade(sample, 4), ["4.a", "4.b"]);
});

test("only grades with at least one class are offered", () => {
  const model = buildOk(withTab("osztalyok", [["Osztály"], ["1.a"], ["3.a"], ["3.c"]]));
  assert.deepEqual(gradesOf(model), ["1", "3"]);
  assert.deepEqual(classesOfGrade(model, "3"), ["3.a", "3.c"]);
});

test("activity counts: only activities with slots, in activity order", () => {
  assert.deepEqual(
    activityCounts(sample, "4.a").map(({ activity, count }) => [activity.id, count]),
    [["szinjatszas", 1], ["modern-tanc", 2], ["kepzomuveszet", 2], ["neptanc", 1], ["keramia", 2], ["szinpadi-tanc", 2]],
  );
});

test("resolve: URL wins over storage", () => {
  const sel = resolveSelection(sample, {
    query: { osztaly: "4.a", foglalkozas: "kepzomuveszet" },
    stored: { osztaly: "2.b", foglalkozas: "balett" },
  });
  assert.deepEqual(sel, { cls: "4.a", act: "kepzomuveszet" });
});

test("resolve: URL without foglalkozas means all", () => {
  const sel = resolveSelection(sample, { query: { osztaly: "4.a", foglalkozas: "" }, stored: { osztaly: "4.a", foglalkozas: "keramia" } });
  assert.deepEqual(sel, { cls: "4.a", act: ALL });
});

test("resolve: storage is used when the URL has no valid class", () => {
  assert.deepEqual(resolveSelection(sample, { query: {}, stored: { osztaly: "2.b", foglalkozas: "balett" } }), { cls: "2.b", act: "balett" });
  assert.deepEqual(resolveSelection(sample, { query: { osztaly: "9.z" }, stored: { osztaly: "2.b" } }), { cls: "2.b", act: ALL });
});

test("resolve: a URL activity is kept when the URL has no valid class", () => {
  assert.deepEqual(resolveSelection(sample, { query: { osztaly: "9.z", foglalkozas: "kepzomuveszet" }, stored: { osztaly: "4.a", foglalkozas: "keramia" } }), {
    cls: "4.a",
    act: "kepzomuveszet",
  });
  assert.deepEqual(resolveSelection(sample, { query: { osztaly: "", foglalkozas: "balett" } }), { cls: "1.a", act: "balett" });
  // The stored activity only comes with the stored class.
  assert.deepEqual(resolveSelection(sample, { query: {}, stored: { osztaly: "nope", foglalkozas: "balett" } }), { cls: "1.a", act: ALL });
});

test("resolve: an explicit foglalkozas=all means all", () => {
  assert.deepEqual(resolveSelection(sample, { query: { osztaly: "4.a", foglalkozas: "all" }, stored: { osztaly: "4.a", foglalkozas: "keramia" } }), {
    cls: "4.a",
    act: ALL,
  });
});

test("resolve: falls back to the first class", () => {
  assert.deepEqual(resolveSelection(sample, {}), { cls: "1.a", act: ALL });
  assert.deepEqual(resolveSelection(sample, { query: { osztaly: "9.z" }, stored: { osztaly: "nope" } }), { cls: "1.a", act: ALL });
  assert.deepEqual(resolveSelection(sample, { stored: "garbage" }), { cls: "1.a", act: ALL });
});

test("an activity without slots for the class falls back to all", () => {
  assert.deepEqual(resolveSelection(sample, { query: { osztaly: "4.a", foglalkozas: "balett" } }), { cls: "4.a", act: ALL });
  assert.deepEqual(resolveSelection(sample, { query: { osztaly: "4.a", foglalkozas: "robotika" } }), { cls: "4.a", act: ALL });
  assert.deepEqual(normalizeSelection(sample, { cls: "4.a", act: "nincs-ilyen" }), { cls: "4.a", act: ALL });
});

test("changing the grade keeps the letter when that class exists", () => {
  assert.deepEqual(selectGrade(sample, { cls: "4.b", act: ALL }, "2"), { cls: "2.b", act: ALL });
});

test("changing the grade takes the first class of the grade otherwise", () => {
  const model = buildOk(withTab("osztalyok", [["Osztály"], ["1.a"], ["1.b"], ["2.a"], ["3.a"], ["4.a"], ["5.a"], ["6.a"], ["7.a"], ["8.a"], ["3.b"]]));
  assert.deepEqual(selectGrade(model, { cls: "1.b", act: ALL }, "2"), { cls: "2.a", act: ALL });
});

test("changing the grade keeps the activity only if the new class has it", () => {
  assert.deepEqual(selectGrade(sample, { cls: "4.a", act: "modern-tanc" }, "5"), { cls: "5.a", act: "modern-tanc" });
  assert.deepEqual(selectGrade(sample, { cls: "4.a", act: "neptanc" }, "5"), { cls: "5.a", act: ALL });
});

test("selecting a class or an activity", () => {
  assert.deepEqual(selectClass(sample, { cls: "3.a", act: "kepzomuveszet" }, "3.b"), { cls: "3.b", act: "kepzomuveszet" });
  assert.deepEqual(selectActivity(sample, { cls: "4.a", act: ALL }, "keramia"), { cls: "4.a", act: "keramia" });
  assert.deepEqual(selectActivity(sample, { cls: "4.a", act: "keramia" }, ALL), { cls: "4.a", act: ALL });
});

test("readQuery removes whitespace, lowercases and applies NFC", () => {
  assert.deepEqual(readQuery("?osztaly=4.A&foglalkozas=Kepzomuveszet"), { osztaly: "4.a", foglalkozas: "kepzomuveszet" });
  assert.deepEqual(readQuery("?osztaly=%204.%20A%20"), { osztaly: "4.a", foglalkozas: "" });
  assert.deepEqual(readQuery(`?osztaly=${encodeURIComponent("3.á")}`), { osztaly: "3.á", foglalkozas: "" });
  assert.deepEqual(readQuery(""), { osztaly: "", foglalkozas: "" });
});

test("classes with accented or multi-letter letters", () => {
  const model = buildOk(withTab("osztalyok", [["Osztály"], ["1.a"], ["2.a"], ["3.a"], ["3.á"], ["4.a"], ["5.ny"], ["6.a"], ["7.a"], ["8.a"]]));
  assert.deepEqual(classesOfGrade(model, "3"), ["3.a", "3.á"]);
  assert.deepEqual(selectGrade(model, { cls: "3.á", act: ALL }, "5"), { cls: "5.ny", act: ALL });
  assert.equal(searchFor("", { cls: "3.á", act: ALL }), `?osztaly=${encodeURIComponent("3.á")}`);
  assert.deepEqual(resolveSelection(model, { query: readQuery(searchFor("", { cls: "3.á", act: ALL })) }), { cls: "3.á", act: ALL });
});

// Runs fn with stubbed browser globals, restoring them afterwards.
function withGlobals(globals, fn) {
  const saved = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, ...value });
  try {
    return fn();
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

const memoryStorage = (initial) => {
  const data = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
};

test("loadStored returns an object or null, never throws", () => {
  const cases = [
    [JSON.stringify({ osztaly: "4.a", foglalkozas: "balett" }), { osztaly: "4.a", foglalkozas: "balett" }],
    [undefined, null],
    ["{not json", null],
    ["42", null],
    ["null", null],
  ];
  for (const [raw, expected] of cases) {
    assert.deepEqual(withGlobals({ localStorage: { value: memoryStorage(raw) } }, loadStored), expected);
  }
  const throwing = { get() { throw new Error("SecurityError"); } };
  assert.equal(withGlobals({ localStorage: throwing }, loadStored), null);
});

test("persist writes storage and the URL, and survives failures", () => {
  const storage = memoryStorage();
  const calls = [];
  const history = { state: null, replaceState: (...args) => calls.push(args) };
  const location = { search: "?forras=minta", hash: "#x" };
  withGlobals({ localStorage: { value: storage }, history: { value: history }, location: { value: location } }, () =>
    persist({ cls: "4.a", act: "keramia" }),
  );
  assert.equal(storage.data.get(STORAGE_KEY), JSON.stringify({ osztaly: "4.a", foglalkozas: "keramia" }));
  assert.deepEqual(calls, [[null, "", "?forras=minta&osztaly=4.a&foglalkozas=keramia#x"]]);

  const broken = { setItem() { throw new Error("QuotaExceededError"); } };
  const throwingHistory = { state: null, replaceState() { throw new Error("SecurityError"); } };
  assert.doesNotThrow(() =>
    withGlobals({ localStorage: { value: broken }, history: { value: throwingHistory }, location: { value: location } }, () =>
      persist({ cls: "4.a", act: ALL }),
    ),
  );
});

test("searchFor writes osztaly and foglalkozas and keeps other parameters", () => {
  assert.equal(searchFor("", { cls: "4.a", act: "kepzomuveszet" }), "?osztaly=4.a&foglalkozas=kepzomuveszet");
  assert.equal(searchFor("?osztaly=1.a&foglalkozas=balett", { cls: "4.a", act: ALL }), "?osztaly=4.a");
  assert.equal(searchFor("?forras=minta", { cls: "2.b", act: ALL }), "?forras=minta&osztaly=2.b");
});
