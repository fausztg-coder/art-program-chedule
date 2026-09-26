// SPEC 1.1 §6: the print page's grid and title (pure logic; the page itself is
// checked by hand, docs/manual-checks.md J).
import { test } from "node:test";
import assert from "node:assert/strict";
import { printLayout, printTitle } from "../src/state.js";
import { buildOk, row, withActivities } from "./helpers.mjs";

const sel = (cls, ...disciplines) => ({ cls, disciplines });
const model = (...rows) => buildOk(withActivities(...rows));
const day = (layout, key) => layout.days.find((d) => d.day.key === key);
// A card as [activity, row, span, lane, lanes, choice] for compact comparison.
const brief = (d) => d.cards.map((c) => [c.item.activity, c.row, c.span, c.lane, c.lanes, c.choice]);

test("printTitle is 'Művészeti órarend – ' + the result title", () => {
  const m = model(row());
  assert.equal(printTitle(m, sel("3.b", "balett", "keramia")), "Művészeti órarend – 3.b osztály · Balett, Kerámia");
  assert.equal(printTitle(m, sel(null)), "Művészeti órarend – Minden osztály · minden tanszak");
});

test("one row per period of the Órák tab; a card spans its lessons", () => {
  const m = model(row({ Nap: "Kedd", "Első óra": "8", "Utolsó óra": "9", Célcsoport: "4" }), row({ Nap: "Hétfő", "Első óra": "10", "Utolsó óra": "10", Célcsoport: "4.a" }));
  const layout = printLayout(m, sel("4.a"));
  assert.deepEqual(layout.periods.map((p) => p.n), [7, 8, 9, 10]);
  assert.deepEqual(layout.days.map((d) => d.day.key), ["H", "K", "Sz", "Cs", "P"]);
  assert.deepEqual(brief(day(layout, "K")), [["Balett", 1, 2, 0, 1, false]]);
  assert.deepEqual(brief(day(layout, "H")), [["Balett", 3, 1, 0, 1, false]]);
});

test("empty rows are the rows no card covers", () => {
  const m = model(row({ Nap: "Kedd", "Első óra": "8", "Utolsó óra": "9", Célcsoport: "4" }));
  const layout = printLayout(m, sel("4.a"));
  assert.deepEqual(day(layout, "K").empty, [0, 3]);
  assert.deepEqual(day(layout, "H").empty, [0, 1, 2, 3]);
});

test("overlapping cards stand side by side and are marked Választható (4.a, Tuesday)", () => {
  const m = model(
    row({ Nap: "Kedd", "Első óra": "8", "Utolsó óra": "9", Foglalkozás: "Modern tánc", Célcsoport: "4,5" }),
    row({ Nap: "Kedd", "Első óra": "9", "Utolsó óra": "9", Foglalkozás: "Képzőművészet", Célcsoport: "4" }),
    row({ Nap: "Kedd", "Első óra": "10", "Utolsó óra": "10", Foglalkozás: "Képzőművészet", Célcsoport: "4" }),
  );
  const k = day(printLayout(m, sel("4.a")), "K");
  assert.deepEqual(brief(k), [
    ["Modern tánc", 1, 2, 0, 2, true],
    ["Képzőművészet", 2, 1, 1, 2, true],
    ["Képzőművészet", 3, 1, 0, 1, false],
  ]);
  assert.deepEqual(k.empty, [0]);
});

test("a chain of overlaps shares one lane group; the longer card takes the left lane (5.a, Tuesday)", () => {
  const m = model(
    row({ Nap: "Kedd", "Első óra": "7", "Utolsó óra": "7", Foglalkozás: "Néptánc", Célcsoport: "5" }),
    row({ Nap: "Kedd", "Első óra": "7", "Utolsó óra": "8", Foglalkozás: "Kerámia", Célcsoport: "5" }),
    row({ Nap: "Kedd", "Első óra": "8", "Utolsó óra": "9", Foglalkozás: "Modern tánc", Célcsoport: "5" }),
  );
  assert.deepEqual(brief(day(printLayout(m, sel("5.a")), "K")), [
    ["Kerámia", 0, 2, 0, 2, true],
    ["Néptánc", 0, 1, 1, 2, true],
    ["Modern tánc", 1, 2, 1, 2, true],
  ]);
});

test("three cards in one slot get three lanes; separate groups start again at one lane", () => {
  const m = model(
    row({ Nap: "Szerda", Foglalkozás: "Balett", Célcsoport: "2" }),
    row({ Nap: "Szerda", Foglalkozás: "Kerámia", Célcsoport: "2" }),
    row({ Nap: "Szerda", Foglalkozás: "Robotika", Célcsoport: "2" }),
    row({ Nap: "Szerda", "Első óra": "9", "Utolsó óra": "9", Foglalkozás: "Néptánc", Célcsoport: "2" }),
  );
  const sz = day(printLayout(m, sel("2.a")), "Sz");
  assert.deepEqual(
    sz.cards.map((c) => [c.item.activity, c.lane, c.lanes]),
    [["Balett", 0, 3], ["Kerámia", 1, 3], ["Robotika", 2, 3], ["Néptánc", 0, 1]],
  );
});

test("only the selected disciplines are printed; overlaps are counted after the filter (§6.4, §4.6)", () => {
  const m = model(
    row({ Nap: "Kedd", "Első óra": "8", "Utolsó óra": "9", Foglalkozás: "Modern tánc", Célcsoport: "4" }),
    row({ Nap: "Kedd", "Első óra": "9", "Utolsó óra": "9", Foglalkozás: "Képzőművészet", Célcsoport: "4" }),
  );
  assert.deepEqual(brief(day(printLayout(m, sel("4.a", "modern-tanc")), "K")), [["Modern tánc", 1, 2, 0, 1, false]]);
});

test("rows of other classes are not printed; a grade row is printed for each class of the grade", () => {
  const m = model(
    row({ Nap: "Hétfő", Foglalkozás: "Balett", Célcsoport: "3.b" }),
    row({ Nap: "Hétfő", Foglalkozás: "Kerámia", Célcsoport: "3" }),
  );
  assert.deepEqual(brief(day(printLayout(m, sel("3.a")), "H")), [["Kerámia", 0, 1, 0, 1, false]]);
  assert.deepEqual(brief(day(printLayout(m, sel("3.b")), "H")).map((c) => c.slice(3)), [[0, 2, true], [1, 2, true]]);
});

test("'Összes' class prints no cards (§6.2: the page asks for a class)", () => {
  const layout = printLayout(model(row()), sel(null));
  assert.ok(layout.days.every((d) => d.cards.length === 0));
  assert.equal(layout.uncertain, false);
});

test("uncertain is set when a printed card is uncertain (footer line, §6.4)", () => {
  const m = model(
    row({ Nap: "Hétfő", Célcsoport: "3.a", Bizonytalan: "igen", Megjegyzés: "ütközés" }),
    row({ Nap: "Kedd", Célcsoport: "3.b" }),
  );
  assert.equal(printLayout(m, sel("3.a")).uncertain, true);
  assert.equal(printLayout(m, sel("3.b")).uncertain, false);
  assert.equal(printLayout(m, sel("3.a", "keramia")).uncertain, false);
});
