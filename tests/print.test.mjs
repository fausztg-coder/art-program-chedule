// SPEC 1.1 §6: the print page's grid and title (pure logic; the page itself is
// checked by hand, docs/manual-checks.md J).
import { test } from "node:test";
import assert from "node:assert/strict";
import { printLayout, printTitle, SOFT_HYPHEN, softHyphenate } from "../src/state.js";
import { buildOk, row, withActivities } from "./helpers.mjs";

const sel = (cls, ...disciplines) => ({ cls, disciplines });
const model = (...rows) => buildOk(withActivities(...rows));
const day = (layout, key) => layout.days.find((d) => d.day.key === key);
// A card as [activity, row, span, lane, lanes, choice] for compact comparison.
const brief = (d) => d.cards.map((c) => [c.item.activity, c.row, c.span, c.lane, c.lanes, c.choice]);
// A group of side-by-side cards as [row, span, lanes, choice, activities].
const groups = (d) => d.groups.map((g) => [g.row, g.span, g.lanes, g.choice, g.cards.map((c) => c.item.activity)]);

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
  // One group, one "VÁLASZTHATÓ" label: from the Modern tánc's first row, two rows, two lanes.
  assert.deepEqual(groups(k), [[1, 2, 2, true, ["Modern tánc", "Képzőművészet"]]]);
});

test("a chain of overlaps shares one lane group; the longer card takes the left lane (5.a, Tuesday)", () => {
  const m = model(
    row({ Nap: "Kedd", "Első óra": "7", "Utolsó óra": "7", Foglalkozás: "Néptánc", Célcsoport: "5" }),
    row({ Nap: "Kedd", "Első óra": "7", "Utolsó óra": "8", Foglalkozás: "Kerámia", Célcsoport: "5" }),
    row({ Nap: "Kedd", "Első óra": "8", "Utolsó óra": "9", Foglalkozás: "Modern tánc", Célcsoport: "5" }),
  );
  const k = day(printLayout(m, sel("5.a")), "K");
  assert.deepEqual(brief(k), [
    ["Kerámia", 0, 2, 0, 2, true],
    ["Néptánc", 0, 1, 1, 2, true],
    ["Modern tánc", 1, 2, 1, 2, true],
  ]);
  assert.deepEqual(groups(k), [[0, 3, 2, true, ["Kerámia", "Néptánc", "Modern tánc"]]]);
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
  // A lone card is no group, so it gets no label.
  assert.deepEqual(groups(sz), [[0, 1, 3, true, ["Balett", "Kerámia", "Robotika"]]]);
});

test("only the selected disciplines are printed; overlaps are counted after the filter (§6.4, §4.6)", () => {
  const m = model(
    row({ Nap: "Kedd", "Első óra": "8", "Utolsó óra": "9", Foglalkozás: "Modern tánc", Célcsoport: "4" }),
    row({ Nap: "Kedd", "Első óra": "9", "Utolsó óra": "9", Foglalkozás: "Képzőművészet", Célcsoport: "4" }),
  );
  const k = day(printLayout(m, sel("4.a", "modern-tanc")), "K");
  assert.deepEqual(brief(k), [["Modern tánc", 1, 2, 0, 1, false]]);
  assert.deepEqual(k.groups, []);
});

test("rows of other classes are not printed; a grade row is printed for each class of the grade", () => {
  const m = model(
    row({ Nap: "Hétfő", Foglalkozás: "Balett", Célcsoport: "3.b" }),
    row({ Nap: "Hétfő", Foglalkozás: "Kerámia", Célcsoport: "3" }),
  );
  assert.deepEqual(brief(day(printLayout(m, sel("3.a")), "H")), [["Kerámia", 0, 1, 0, 1, false]]);
  assert.deepEqual(brief(day(printLayout(m, sel("3.b")), "H")).map((c) => c.slice(3)), [[0, 2, true], [1, 2, true]]);
});

test("two groups on one day each get their own label; back-to-back cards are no group", () => {
  const m = model(
    row({ Nap: "Csütörtök", "Első óra": "7", "Utolsó óra": "7", Foglalkozás: "Balett", Célcsoport: "2" }),
    row({ Nap: "Csütörtök", "Első óra": "7", "Utolsó óra": "7", Foglalkozás: "Kerámia", Célcsoport: "2" }),
    row({ Nap: "Csütörtök", "Első óra": "8", "Utolsó óra": "8", Foglalkozás: "Néptánc", Célcsoport: "2" }),
    row({ Nap: "Csütörtök", "Első óra": "9", "Utolsó óra": "10", Foglalkozás: "Robotika", Célcsoport: "2" }),
    row({ Nap: "Csütörtök", "Első óra": "10", "Utolsó óra": "10", Foglalkozás: "Balett", Célcsoport: "2" }),
  );
  const cs = day(printLayout(m, sel("2.a")), "Cs");
  assert.deepEqual(groups(cs), [
    [0, 1, 2, true, ["Balett", "Kerámia"]],
    [2, 2, 2, true, ["Robotika", "Balett"]],
  ]);
  assert.deepEqual(
    cs.cards.map((c) => [c.item.activity, c.lanes]),
    [["Balett", 2], ["Kerámia", 2], ["Néptánc", 1], ["Robotika", 2], ["Balett", 2]],
  );
});

test("'Összes' class prints no cards (§6.2: the page asks for a class)", () => {
  const layout = printLayout(model(row()), sel(null));
  assert.ok(layout.days.every((d) => d.cards.length === 0 && d.groups.length === 0));
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

test("softHyphenate offers Hungarian syllable breaks only (narrow side-by-side cards)", () => {
  const shown = (text) => softHyphenate(text).split(SOFT_HYPHEN).join("-");
  // A digraph is one consonant; of a cluster only the last consonant starts the next syllable.
  assert.equal(shown("Képzőművészet"), "Kép-ző-mű-vé-szet");
  assert.equal(shown("Színjátszás"), "Szín-ját-szás");
  assert.equal(shown("Színpadi tánc"), "Szín-pa-di tánc");
  assert.equal(shown("Gyerekakadémia"), "Gye-re-ka-ka-dé-mia");
  assert.equal(shown("nagytornaterem"), "nagy-tor-na-te-rem");
  assert.equal(shown("a/1./kerámia"), "a/1./ke-rá-mia");
  assert.equal(shown("mogyoró"), "mo-gyo-ró");
  // At least two letters on either line: no "É-nekkar", no "Kerámi-a".
  assert.equal(shown("Énekkar"), "Ének-kar");
  assert.equal(shown("Kerámia"), "Ke-rá-mia");
  assert.equal(shown("Jóga"), "Jó-ga");
  // A doubled digraph would change its spelling when split (hosz-szú), so no break there.
  assert.equal(shown("hosszú"), "hosszú");
  assert.equal(shown("asszony"), "asszony");
  // Old family-name spellings: no break inside "thy" / "csey".
  assert.equal(shown("Gyarmathy"), "Gyar-mathy");
  assert.equal(shown("Kölcsey"), "Köl-csey");
  // Nothing else changes: a soft hyphen only shows where a line breaks.
  assert.equal(softHyphenate("Képzőművészet").replaceAll(SOFT_HYPHEN, ""), "Képzőművészet");
  assert.equal(shown(""), "");
  assert.equal(shown("7.b"), "7.b");
});

test("softHyphenate: every digraph is one consonant; 'zsz' is z + sz", () => {
  const shown = (text) => softHyphenate(text).split(SOFT_HYPHEN).join("-");
  assert.equal(shown("Mátyás"), "Má-tyás");
  assert.equal(shown("Zsuzsanna"), "Zsu-zsan-na");
  assert.equal(shown("Erzsébet"), "Er-zsé-bet");
  assert.equal(shown("furulyázás"), "fu-ru-lyá-zás");
  assert.equal(shown("bodzás"), "bo-dzás");
  assert.equal(shown("Madzsar"), "Ma-dzsar");
  assert.equal(shown("Rajzszakkör"), "Rajz-szak-kör");
  assert.equal(shown("Házszám"), "Ház-szám");
  assert.equal(shown("Mazsorett"), "Ma-zso-rett");
});

test("softHyphenate leaves words of at most `longerThan` characters alone", () => {
  const shown = (text, n) => softHyphenate(text, n).split(SOFT_HYPHEN).join("-");
  assert.equal(shown("Lajos Juli", 10), "Lajos Juli");
  assert.equal(shown("rajzstúdió", 10), "rajzstúdió");
  assert.equal(shown("nagytornaterem", 10), "nagy-tor-na-te-rem");
  // A word is a run without spaces: its letter runs break even if each is short.
  assert.equal(shown("a/1./kerámia", 10), "a/1./ke-rá-mia");
  assert.equal(shown("a/1./kerámia", 12), "a/1./kerámia");
});
