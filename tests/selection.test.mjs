// SPEC 1.1 §3.8, §4.5, §4.6 and §5: selection, filtering, title, choice, URL.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NO_SELECTION,
  chooseClass,
  choiceItems,
  choiceQuery,
  clearDisciplines,
  countLabel,
  groupByDay,
  normalizeChoice,
  periodLabel,
  readChoiceQuery,
  resolveChoice,
  schoolYearLabel,
  selectionTitle,
  targetLabel,
  targetParts,
  timeRange,
  toggleDiscipline,
  visibleItems,
  yearSuffix,
} from "../src/state.js";
import { sampleTables, buildOk, row, withActivities } from "./helpers.mjs";

const sample = buildOk(sampleTables());
const sel = (cls, ...disciplines) => ({ cls, disciplines });
const rowsOf = (items) => items.map((i) => i.sheetRow);

// 18 classes of SPEC §3.2, with rows for the targeting criteria.
const CLASSES = ["1.a", "1.b", "2.a", "3.a", "3.b", "4.a", "4.b", "5.a", "5.b", "6.a", "6.b", "6.m", "7.a", "7.b", "7.m", "8.a", "8.b", "8.m"];
function model18(...rows) {
  const tables = withActivities(...rows);
  tables.osztalyok = [["Osztály"], ...CLASSES.map((c) => [c])];
  return buildOk(tables);
}

// ---------------------------------------------------------------------------
// Filtering (§5.2) and order (§4.5)

test("Összes osztály + Összes tanszak lists every row once", () => {
  const items = visibleItems(sample, NO_SELECTION);
  assert.equal(items.length, 28);
  assert.equal(new Set(items).size, 28);
});

test("a row for several classes appears once for Összes and once for each class", () => {
  const model = model18(row({ Célcsoport: "1, 2, 3" }));
  assert.equal(visibleItems(model, NO_SELECTION).length, 1);
  for (const cls of ["1.a", "2.a", "3.b"]) assert.equal(visibleItems(model, sel(cls)).length, 1);
  assert.equal(visibleItems(model, sel("4.a")).length, 0);
});

test("criteria 3-4: grade rows reach every class of the grade, class rows only that class", () => {
  const model = model18(
    row({ Célcsoport: "6" }),
    row({ Nap: "Kedd", Célcsoport: "7.m" }),
    row({ Nap: "Szerda", Célcsoport: "3.b" }),
  );
  assert.deepEqual(rowsOf(visibleItems(model, sel("6.m"))), [2]);
  assert.deepEqual(rowsOf(visibleItems(model, sel("7.m"))), [3]);
  assert.deepEqual(rowsOf(visibleItems(model, sel("7.a"))), []);
  assert.deepEqual(rowsOf(visibleItems(model, sel("7.b"))), []);
  assert.deepEqual(rowsOf(visibleItems(model, sel("3.b"))), [4]);
  assert.deepEqual(rowsOf(visibleItems(model, sel("3.a"))), []);
});

test("the discipline filter keeps only the chosen activities", () => {
  assert.deepEqual(rowsOf(visibleItems(sample, sel("4.a", "keramia", "neptanc"))), [21, 24]);
  assert.deepEqual(rowsOf(visibleItems(sample, sel(null, "balett"))), [7]);
  assert.deepEqual(visibleItems(sample, sel("4.a", "balett")), []);
});

test("rows are ordered by day, first lesson, then class column", () => {
  const model = model18(
    row({ Nap: "Kedd", "Első óra": "8", "Utolsó óra": "8", Célcsoport: "3.b" }),
    row({ Nap: "Kedd", "Első óra": "7", "Utolsó óra": "7", Célcsoport: "5" }),
    row({ Nap: "Hétfő", "Első óra": "9", "Utolsó óra": "9", Célcsoport: "1" }),
    row({ Nap: "Kedd", "Első óra": "7", "Utolsó óra": "8", Célcsoport: "4" }),
  );
  assert.deepEqual(rowsOf(visibleItems(model, NO_SELECTION)), [4, 5, 3, 2]);
});

test("rows with Megjelenik = nem never appear", () => {
  assert.equal(visibleItems(sample, NO_SELECTION).some((i) => i.activity === "Robotika"), false);
});

// ---------------------------------------------------------------------------
// Labels (§3.7, §4.5)

test("class column: grades as 'n. évf.', classes by name, sorted by grade", () => {
  assert.equal(targetLabel(["5", "6"]), "5. évf., 6. évf.");
  assert.equal(targetLabel(["3.b"]), "3.b");
  assert.equal(targetLabel(["6.m", "4", "6", "3.a"]), "3.a, 4. évf., 6. évf., 6.m");
});

test("class column parts keep each element whole, for wrapping between them", () => {
  assert.deepEqual(targetParts(["1", "2", "3", "4"]), ["1. évf.", "2. évf.", "3. évf.", "4. évf."]);
  assert.deepEqual(targetParts(["7.m"]), ["7.m"]);
  assert.equal(targetLabel(["4", "3"]), targetParts(["4", "3"]).join(", "));
});

test("grouping by day: Monday first, days without rows left out", () => {
  const model = model18(
    row({ Nap: "Péntek", Célcsoport: "1" }),
    row({ Nap: "Hétfő", Célcsoport: "1" }),
    row({ Nap: "Szerda", Célcsoport: "2" }),
  );
  const groups = groupByDay(model, visibleItems(model, NO_SELECTION));
  assert.deepEqual(groups.map((g) => [g.day.name, rowsOf(g.items)]), [["Hétfő", [3]], ["Szerda", [4]], ["Péntek", [2]]]);
  assert.deepEqual(groupByDay(model, visibleItems(model, sel("1.a"))).map((g) => g.day.key), ["H", "P"]);
  assert.deepEqual(groupByDay(model, []), []);
});

test("time range and lesson label", () => {
  const item = sample.items.find((i) => i.sheetRow === 13); // Kedd 8–9 Modern tánc
  assert.equal(timeRange(sample, item), "14:45–16:00");
  assert.equal(periodLabel(item), "8–9. óra");
  const single = sample.items.find((i) => i.sheetRow === 6); // Hétfő 9
  assert.equal(timeRange(sample, single), "15:30–16:00");
  assert.equal(periodLabel(single), "9. óra");
});

// ---------------------------------------------------------------------------
// Title and count (§5.3)

test("title for Összes osztály and for one class", () => {
  assert.equal(selectionTitle(sample, NO_SELECTION), "Minden osztály · minden tanszak");
  assert.equal(selectionTitle(sample, sel("3.b")), "3.b osztály · minden tanszak");
});

test("title with 1, 3 and 4 disciplines, names in chip order", () => {
  assert.equal(selectionTitle(sample, sel("3.b", "keramia")), "3.b osztály · Kerámia");
  assert.equal(selectionTitle(sample, sel("3.b", "keramia", "balett", "musical")), "3.b osztály · Musical, Balett, Kerámia");
  assert.equal(selectionTitle(sample, sel(null, "keramia", "balett", "musical", "ek")), "Minden osztály · 4 tanszak");
});

test("count label", () => {
  assert.equal(countLabel(0), "0 foglalkozás hetente");
  assert.equal(countLabel(10), "10 foglalkozás hetente");
});

// ---------------------------------------------------------------------------
// Választható (§4.6)

test("Választható: rows sharing a (day, lesson) for the selected class", () => {
  const s = sel("4.a");
  const items = visibleItems(sample, s);
  const marked = rowsOf([...choiceItems(sample, s, items)]).sort((a, b) => a - b);
  // Kedd 9: Modern tánc (13) and Képzőművészet (16); Csütörtök 8: Kerámia (24) and Színpadi tánc (28).
  assert.deepEqual(marked, [13, 16, 24, 28]);
});

test("Választható: none for Összes osztály", () => {
  assert.equal(choiceItems(sample, NO_SELECTION, visibleItems(sample, NO_SELECTION)).size, 0);
});

test("Választható applies to the list after the discipline filter", () => {
  const s = sel("4.a", "modern-tanc");
  assert.equal(choiceItems(sample, s, visibleItems(sample, s)).size, 0);
  const both = sel("4.a", "modern-tanc", "kepzomuveszet");
  assert.deepEqual(rowsOf([...choiceItems(sample, both, visibleItems(sample, both))]).sort((a, b) => a - b), [13, 16]);
});

// ---------------------------------------------------------------------------
// Transitions (§5.2)

test("clicks: toggle, last one off means Összes, Összes clears, class change keeps disciplines", () => {
  let s = { ...NO_SELECTION };
  s = toggleDiscipline(sample, s, "keramia");
  s = toggleDiscipline(sample, s, "balett");
  assert.deepEqual(s.disciplines, ["balett", "keramia"]); // chip order
  s = chooseClass(sample, s, "3.b");
  assert.deepEqual(s, sel("3.b", "balett", "keramia"));
  s = toggleDiscipline(sample, s, "balett");
  s = toggleDiscipline(sample, s, "keramia");
  assert.deepEqual(s, sel("3.b"));
  s = clearDisciplines(toggleDiscipline(sample, s, "ek"));
  assert.deepEqual(s, sel("3.b"));
  assert.deepEqual(chooseClass(sample, s, null), sel(null));
});

test("unknown classes and ids are dropped", () => {
  assert.deepEqual(normalizeChoice(sample, { cls: "9.z", disciplines: ["nincs", "balett"] }), sel(null, "balett"));
});

// ---------------------------------------------------------------------------
// URL and stored choice (§5.4)

test("URL: ?o=3.b&f=balett,keramia round trip", () => {
  const s = sel("3.b", "balett", "keramia");
  const query = choiceQuery("", s);
  assert.equal(query, "?o=3.b&f=balett,keramia");
  assert.deepEqual(readChoiceQuery(sample, query), { present: true, selection: s });
});

test("URL: no o for Összes osztály, no f for no discipline, other parameters kept", () => {
  assert.equal(choiceQuery("", NO_SELECTION), "");
  assert.equal(choiceQuery("?forras=minta&o=1.a", sel(null, "balett")), "?forras=minta&f=balett");
  assert.equal(choiceQuery("?f=x", sel("2.a")), "?o=2.a");
});

test("URL: unknown class or key is ignored without error", () => {
  assert.deepEqual(readChoiceQuery(sample, "?o=9.z&f=nincs,balett,,"), { present: true, selection: sel(null, "balett") });
  assert.deepEqual(readChoiceQuery(sample, "?x=1"), { present: false, selection: sel(null) });
  assert.deepEqual(readChoiceQuery(sample, "?o=%203.B%20"), { present: true, selection: sel("3.b") });
});

test("start state: URL over stored choice over Összes/Összes", () => {
  const stored = { o: "4.a", f: ["keramia"] };
  assert.deepEqual(resolveChoice(sample, {}), sel(null));
  assert.deepEqual(resolveChoice(sample, { stored }), sel("4.a", "keramia"));
  assert.deepEqual(resolveChoice(sample, { search: "?f=balett", stored }), sel(null, "balett"));
  assert.deepEqual(resolveChoice(sample, { search: "?o=2.a", stored }), sel("2.a"));
  assert.deepEqual(resolveChoice(sample, { search: "?forras=minta", stored }), sel("4.a", "keramia"));
  assert.deepEqual(resolveChoice(sample, { stored: { o: 5, f: "x" } }), sel(null));
  assert.deepEqual(resolveChoice(sample, { stored: "garbage" }), sel(null));
});

// ---------------------------------------------------------------------------
// School year (§3.8, with the pronunciation rule approved by the owner)

test("school year suffix follows pronunciation", () => {
  assert.equal(schoolYearLabel("2026/2027"), "2026/2027-es tanév");
  const cases = {
    2021: "es", 2022: "es", 2023: "as", 2024: "es", 2025: "ös", 2026: "os", 2027: "es", 2028: "as", 2029: "es",
    2010: "es", 2020: "as", 2030: "as", 2040: "es", 2050: "es", 2060: "as", 2070: "es", 2080: "as", 2090: "es",
    2100: "as", 2000: "es",
  };
  for (const [year, suffix] of Object.entries(cases)) assert.equal(yearSuffix(year), suffix, year);
});

test("an empty school year gives no label", () => {
  assert.equal(schoolYearLabel(""), "");
  assert.equal(schoolYearLabel(undefined), "");
});
