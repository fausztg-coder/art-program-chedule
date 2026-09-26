// Grade helpers, the mobile class rows and the stored choice (SPEC 1.1 §4.5.2, §5.4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHOICE_STORAGE_KEY, classRows, classesOfGrade, gradesOf, loadChoice, saveChoice } from "../src/state.js";
import { sampleTables, buildOk, withTab } from "./helpers.mjs";

const sample = buildOk(sampleTables());
const CLASSES = ["1.a", "1.b", "2.a", "3.a", "3.b", "4.a", "4.b", "5.a", "5.b", "6.a", "6.b", "6.m", "7.a", "7.b", "7.m", "8.a", "8.b", "8.m"];
const model18 = buildOk(withTab("osztalyok", [["Osztály"], ...CLASSES.map((c) => [c])]));

test("grades and classes come from the model", () => {
  assert.deepEqual(gradesOf(sample), ["1", "2", "3", "4", "5", "6", "7", "8"]);
  assert.deepEqual(classesOfGrade(sample, "4"), ["4.a", "4.b"]);
  assert.deepEqual(classesOfGrade(sample, 4), ["4.a", "4.b"]);
});

test("mobile class rows: one row per grade, in the order of the Osztályok tab", () => {
  assert.deepEqual(classRows(model18), [
    { grade: "1", classes: ["1.a", "1.b"] },
    { grade: "2", classes: ["2.a"] },
    { grade: "3", classes: ["3.a", "3.b"] },
    { grade: "4", classes: ["4.a", "4.b"] },
    { grade: "5", classes: ["5.a", "5.b"] },
    { grade: "6", classes: ["6.a", "6.b", "6.m"] },
    { grade: "7", classes: ["7.a", "7.b", "7.m"] },
    { grade: "8", classes: ["8.a", "8.b", "8.m"] },
  ]);
});

test("mobile class rows keep the tab order when it is not sorted", () => {
  const model = buildOk(withTab("osztalyok", [["Osztály"], ["2.b"], ["1.a"], ["2.a"], ["3.a"], ["4.a"], ["5.a"], ["6.a"], ["7.a"], ["8.a"]]));
  assert.deepEqual(classRows(model).slice(0, 2), [
    { grade: "2", classes: ["2.b", "2.a"] },
    { grade: "1", classes: ["1.a"] },
  ]);
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
  const data = new Map(initial === undefined ? [] : [[CHOICE_STORAGE_KEY, initial]]);
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
};

test("loadChoice returns an object or null, never throws", () => {
  const cases = [
    [JSON.stringify({ o: "4.a", f: ["balett"] }), { o: "4.a", f: ["balett"] }],
    [undefined, null],
    ["{not json", null],
    ["42", null],
    ["null", null],
  ];
  for (const [raw, expected] of cases) {
    assert.deepEqual(withGlobals({ localStorage: { value: memoryStorage(raw) } }, loadChoice), expected);
  }
  const throwing = { get() { throw new Error("SecurityError"); } };
  assert.equal(withGlobals({ localStorage: throwing }, loadChoice), null);
});

test("saveChoice writes storage and the URL, keeping other parameters and the hash", () => {
  const storage = memoryStorage();
  const calls = [];
  const history = { state: null, replaceState: (...args) => calls.push(args) };
  const location = { pathname: "/art-program-chedule/", search: "?forras=minta&o=1.a", hash: "#x" };
  withGlobals({ localStorage: { value: storage }, history: { value: history }, location: { value: location } }, () =>
    saveChoice({ cls: "3.b", disciplines: ["balett", "keramia"] }),
  );
  assert.equal(storage.data.get(CHOICE_STORAGE_KEY), JSON.stringify({ o: "3.b", f: ["balett", "keramia"] }));
  assert.deepEqual(calls, [[null, "", "/art-program-chedule/?forras=minta&o=3.b&f=balett,keramia#x"]]);
});

test("saveChoice with Összes/Összes leaves a clean URL", () => {
  const calls = [];
  const history = { state: null, replaceState: (...args) => calls.push(args) };
  const location = { pathname: "/art-program-chedule/", search: "?o=3.b&f=balett", hash: "" };
  withGlobals({ localStorage: { value: memoryStorage() }, history: { value: history }, location: { value: location } }, () =>
    saveChoice({ cls: null, disciplines: [] }),
  );
  assert.deepEqual(calls, [[null, "", "/art-program-chedule/"]]);
});

test("saveChoice survives unavailable storage and history", () => {
  const broken = { setItem() { throw new Error("QuotaExceededError"); } };
  const throwingHistory = { state: null, replaceState() { throw new Error("SecurityError"); } };
  const location = { pathname: "/", search: "", hash: "" };
  assert.doesNotThrow(() =>
    withGlobals({ localStorage: { value: broken }, history: { value: throwingHistory }, location: { value: location } }, () =>
      saveChoice({ cls: "4.a", disciplines: [] }),
    ),
  );
});
