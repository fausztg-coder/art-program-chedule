// SPEC 1.2 §14: several children – list, labels, URL and stored choice.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CHILDREN,
  activeChild,
  addChild,
  canPrintFamily,
  childLabel,
  childTitle,
  cleanName,
  familyHeading,
  familyPrintTitle,
  familyQuery,
  newFamily,
  paginate,
  readFamilyQuery,
  removeChild,
  resolveFamily,
  setActiveChild,
  setChildName,
  updateActiveChild,
} from "../src/children.js";
import { chooseClass, clearDisciplines, toggleDiscipline } from "../src/state.js";
import { sampleTables, buildOk } from "./helpers.mjs";

const sample = buildOk(sampleTables());
const kid = (cls, disciplines = [], name = "") => ({ cls, disciplines, name });
const fam = (active, ...children) => ({ children, active });

// ---------------------------------------------------------------------------
// Children list (§14.1, §14.2)

test("start: one child at Összes/Összes, active", () => {
  assert.deepEqual(newFamily(), fam(0, kid(null)));
});

test("add: new child at Összes/Összes becomes active; at most 4", () => {
  let f = updateActiveChild(newFamily(), (s) => chooseClass(sample, s, "3.b"));
  f = addChild(f);
  assert.deepEqual(f, fam(1, kid("3.b"), kid(null)));
  f = addChild(addChild(f));
  assert.equal(f.children.length, MAX_CHILDREN);
  assert.equal(f.active, 3);
  assert.equal(addChild(f), f, "a fifth child is not added");
});

test("remove: deletes the active child, the one before becomes active; never below 1", () => {
  const f = fam(1, kid("1.a"), kid("2.a"), kid("3.a"));
  assert.deepEqual(removeChild(f), fam(0, kid("1.a"), kid("3.a")));
  assert.deepEqual(removeChild(setActiveChild(f, 0)), fam(0, kid("2.a"), kid("3.a")));
  assert.deepEqual(removeChild(setActiveChild(f, 2)), fam(1, kid("1.a"), kid("2.a")));
  const one = newFamily();
  assert.equal(removeChild(one), one);
});

test("active child: only valid indexes are accepted", () => {
  const f = fam(0, kid("1.a"), kid("2.a"));
  assert.equal(setActiveChild(f, 1).active, 1);
  for (const bad of [-1, 2, 1.5, "1", null]) assert.equal(setActiveChild(f, bad), f);
});

test("selectors change only the active child; the others and the name stay", () => {
  let f = fam(1, kid("1.a", ["balett"]), kid("2.a", [], "Bence"));
  f = updateActiveChild(f, (s) => chooseClass(sample, s, "4.a"));
  f = updateActiveChild(f, (s) => toggleDiscipline(sample, s, "keramia"));
  assert.deepEqual(f, fam(1, kid("1.a", ["balett"]), kid("4.a", ["keramia"], "Bence")));
  f = updateActiveChild(f, clearDisciplines);
  assert.deepEqual(activeChild(f), kid("4.a", [], "Bence"));
  f = setActiveChild(f, 0);
  assert.deepEqual(activeChild(f), kid("1.a", ["balett"]), "switching keeps child 1's choice");
});

test("name: optional, trimmed, at most 20 characters (ő/ű count as one)", () => {
  assert.equal(cleanName("  Anna "), "Anna");
  assert.equal(cleanName("Ő".repeat(25)), "Ő".repeat(20));
  assert.equal(cleanName(42), "");
  const f = setChildName(fam(1, kid(null), kid(null)), " Bence ");
  assert.deepEqual(f.children.map((c) => c.name), ["", "Bence"]);
});

// ---------------------------------------------------------------------------
// Labels (§14.1, §14.3, §14.4)

test("label: the name, else '{n}. gyerek' by current position", () => {
  const f = fam(0, kid(null, [], "Anna"), kid(null), kid(null));
  assert.deepEqual([0, 1, 2].map((i) => childLabel(f, i)), ["Anna", "2. gyerek", "3. gyerek"]);
  const after = removeChild(setActiveChild(f, 1));
  assert.equal(childLabel(after, 1), "2. gyerek", "unnamed children are renumbered");
});

test("child title, heading and print title", () => {
  const f = fam(0, kid("3.b", ["balett", "keramia"], "Anna"), kid("5.a"));
  assert.equal(childTitle(sample, f, 0), "Anna – 3.b osztály · Balett, Kerámia");
  assert.equal(childTitle(sample, f, 1), "2. gyerek – 5.a osztály · minden tanszak");
  assert.equal(familyHeading(f), "2 gyerek órarendje");
  assert.equal(familyPrintTitle(sample, f), "Művészeti órarend – Anna, 2. gyerek");
  const one = fam(0, kid("3.b", ["balett"], "Anna"));
  assert.equal(familyPrintTitle(sample, one), "Művészeti órarend – 3.b osztály · Balett", "one child: the 1.1 title");
});

test("PDF only when every child has a class", () => {
  assert.equal(canPrintFamily(fam(0, kid("3.b"))), true);
  assert.equal(canPrintFamily(fam(0, kid("3.b"), kid("5.a"))), true);
  assert.equal(canPrintFamily(fam(0, kid("3.b"), kid(null))), false);
  assert.equal(canPrintFamily(newFamily()), false);
});

// ---------------------------------------------------------------------------
// URL (§14.5)

test("URL: the SPEC example round trip, names not in the URL", () => {
  const f = fam(1, kid("3.b", ["balett"], "Anna"), kid("5.a", ["keramia"], "Bence"));
  const query = familyQuery("", f);
  assert.equal(query, "?o=3.b&f=balett&gy=2&o2=5.a&f2=keramia");
  assert.doesNotMatch(query, /Anna|Bence/);
  assert.deepEqual(readFamilyQuery(sample, query), {
    present: true,
    family: fam(0, kid("3.b", ["balett"]), kid("5.a", ["keramia"])),
  });
});

test("URL: one child is the 1.1 format; a 1.1 link is one child", () => {
  assert.equal(familyQuery("", fam(0, kid("3.b", ["balett", "keramia"]))), "?o=3.b&f=balett,keramia");
  assert.deepEqual(readFamilyQuery(sample, "?o=3.b&f=balett,keramia").family, fam(0, kid("3.b", ["balett", "keramia"])));
  assert.equal(familyQuery("", newFamily()), "");
});

test("URL: a child at Összes/Összes is kept by gy; other parameters kept", () => {
  const f = fam(0, kid("3.b"), kid(null), kid("4.a"));
  const query = familyQuery("?forras=minta&o5=x&gy=9", f);
  assert.equal(query, "?forras=minta&o5=x&o=3.b&gy=3&o3=4.a");
  assert.deepEqual(readFamilyQuery(sample, query).family, fam(0, kid("3.b"), kid(null), kid("4.a")));
  assert.deepEqual(readFamilyQuery(sample, "?gy=2").family, fam(0, kid(null), kid(null)));
});

test("URL: without gy the highest index counts; gy is clamped; bad values do not break", () => {
  const count = (search) => readFamilyQuery(sample, search).family.children.length;
  assert.equal(count("?o3=4.a"), 3);
  assert.equal(count("?gy=9"), 4);
  assert.equal(count("?gy=0&o2=2.a"), 1);
  assert.equal(count("?gy=-3"), 1);
  assert.equal(count("?gy=abc&o2=2.a"), 2, "a gy that is not a number counts as missing");
  assert.equal(count("?gy=&o2=2.a"), 2);
  assert.equal(count("?gy=2&o3=4.a"), 2, "parameters beyond gy are ignored");
  assert.deepEqual(readFamilyQuery(sample, "?o=9.z&f=nincs&o2=2.a").family, fam(0, kid(null), kid("2.a")));
  assert.equal(readFamilyQuery(sample, "?forras=minta").present, false);
});

// ---------------------------------------------------------------------------
// Stored choice and start state (§14.5)

test("start: URL over stored family over the 1.1 stored choice over Összes/Összes", () => {
  const stored = { children: [{ o: "4.a", f: ["keramia"], nev: "Anna" }, { o: "2.a", f: [], nev: "Bence" }], aktiv: 1 };
  const legacy = { o: "3.b", f: ["balett"] };
  assert.deepEqual(resolveFamily(sample, {}), newFamily());
  assert.deepEqual(resolveFamily(sample, { legacy }), fam(0, kid("3.b", ["balett"])));
  assert.deepEqual(resolveFamily(sample, { stored, legacy }), fam(1, kid("4.a", ["keramia"], "Anna"), kid("2.a", [], "Bence")));
  assert.deepEqual(resolveFamily(sample, { search: "?forras=minta", stored }), resolveFamily(sample, { stored }));
});

test("start: the URL gives the children; stored names stay by position; child 1 active", () => {
  const stored = { children: [{ o: "4.a", f: [], nev: "Anna" }, { o: "2.a", f: [], nev: "Bence" }], aktiv: 1 };
  assert.deepEqual(
    resolveFamily(sample, { search: "?o=3.b&gy=3&o3=5.a", stored }),
    fam(0, kid("3.b", [], "Anna"), kid(null, [], "Bence"), kid("5.a")),
  );
  assert.deepEqual(resolveFamily(sample, { search: "?o=1.a", stored }), fam(0, kid("1.a", [], "Anna")));
});

test("stored family: bad or foreign values are dropped without error", () => {
  const stored = {
    children: [{ o: 5, f: "x", nev: 7 }, null, { o: "9.z", f: ["balett", "nincs"], nev: "  Anna  " }, {}, {}],
    aktiv: 7,
  };
  assert.deepEqual(
    resolveFamily(sample, { stored }),
    fam(0, kid(null), kid(null), kid(null, ["balett"], "Anna"), kid(null)),
  );
  assert.deepEqual(resolveFamily(sample, { stored: { children: [] }, legacy: "garbage" }), newFamily());
  assert.deepEqual(resolveFamily(sample, { stored: "garbage" }), newFamily());
});

// ---------------------------------------------------------------------------
// PDF pages (§14.4)

test("pages: two children per page; a child that needs a whole page stands alone", () => {
  assert.deepEqual(paginate([false]), [[0]]);
  assert.deepEqual(paginate([false, false]), [[0, 1]]);
  assert.deepEqual(paginate([false, false, false]), [[0, 1], [2]]);
  assert.deepEqual(paginate([false, false, false, false]), [[0, 1], [2, 3]]);
  assert.deepEqual(paginate([false, true, false, false]), [[0], [1], [2, 3]]);
  assert.deepEqual(paginate([true, false, false]), [[0], [1, 2]]);
  assert.deepEqual(paginate([false, false, true, false]), [[0, 1], [2], [3]]);
  assert.deepEqual(paginate([true, true]), [[0], [1]]);
});
