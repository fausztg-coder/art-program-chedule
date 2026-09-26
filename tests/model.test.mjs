import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCSV } from "../src/csv.js";
import { contrast, INK, itemsForClass, lessonsOf, reachesClass, slotsOf, slugify, tintOf, FALLBACK_PALETTE } from "../src/model.js";
import { sampleTables, build, buildOk, HEADER, row, withTab, withActivities } from "./helpers.mjs";

const issue = (level, tab, row, message) => ({ level, tab, row, message });

// ---------------------------------------------------------------------------
// Golden test (SPEC §3.5)

const GOLDEN_FIELDS = ["day", "period", "activity", "teacher", "room", "targets", "uncertain", "note", "sheetRow"];
const projectSorted = (slots) =>
  slots.map((s) => JSON.stringify(Object.fromEntries(GOLDEN_FIELDS.map((f) => [f, s[f]])))).sort();

// Regression against 1.0: the rows, split into lessons, still give the 43 slots.
test("golden: sample CSVs produce exactly the expected slots", () => {
  const model = buildOk(sampleTables());
  const expected = JSON.parse(readFileSync(new URL("./fixtures/expected-slots.json", import.meta.url), "utf8"));
  assert.equal(expected.length, 43);
  assert.deepEqual(projectSorted(slotsOf(model)), projectSorted(expected));
  assert.equal(model.items.length, 28);
  assert.equal(model.items.some((s) => s.activity === "Robotika"), false);
  assert.deepEqual(model.issues, []);
});

test("model shape for the sample", () => {
  const model = buildOk(sampleTables());
  assert.equal(model.version, 2);
  assert.equal(model.source, "sample");
  assert.equal(model.generatedAt, "2026-09-25T02:17:00Z");
  assert.deepEqual(model.settings, {
    tanev: "2026/2027",
    iskola: "Hunyadi Mátyás Általános Iskola, XIII. kerület",
    hibabejelentes: "",
    kozlemeny: "",
  });
  assert.deepEqual(model.days.map((d) => d.key), ["H", "K", "Sz", "Cs", "P"]);
  assert.deepEqual(model.periods[2], { n: 9, from: "15:30", to: "16:00" });
  assert.equal(model.classes.length, 16);
  assert.deepEqual(model.activities[5], { id: "kepzomuveszet", name: "Képzőművészet", color: "#5b4bb5", tint: tintOf("#5b4bb5") });
  assert.equal(model.activities.length, 12);
  const item = model.items.find((s) => s.sheetRow === 9);
  assert.deepEqual(item, {
    day: "K", first: 7, last: 8, activityId: "kepzomuveszet", activity: "Képzőművészet", teacher: "Lotti",
    room: "rajzstúdió", targets: ["3.b"], uncertain: false, note: "", sheetRow: 9,
  });
  assert.equal(model.version, 2);
});

// ---------------------------------------------------------------------------
// Headers

test("headers match by name: reordered, unaccented, odd spacing, extra column", () => {
  const reference = buildOk(sampleTables());
  const tables = sampleTables();
  const renamed = {
    Nap: "NAP", "Első óra": "elso ora", "Utolsó óra": " UTOLSÓ  ÓRA ", Foglalkozás: "foglalkozas", Tanár: "Tanar",
    Terem: "terem", Célcsoport: "CELCSOPORT", Bizonytalan: "Bizonytalan ", Megjegyzés: "megjegyzes", Megjelenik: "Megjelenik",
  };
  const [header, ...rows] = tables.foglalkozasok;
  const order = [...header.keys()].reverse();
  tables.foglalkozasok = [
    ["Ellenőrzés", ...order.map((i) => renamed[header[i]])],
    ...rows.map((r) => ["OK", ...order.map((i) => r[i])]),
  ];
  tables.orak = tables.orak.map((r) => [r[2], r[0], r[1]]);
  tables.orak[0] = ["vege", "ORA", "Kezdes"];
  const model = buildOk(tables);
  assert.deepEqual(model.items, reference.items);
  assert.deepEqual(model.periods, reference.periods);
});

test("a missing required header is fatal", () => {
  const tables = sampleTables();
  tables.foglalkozasok[0] = tables.foglalkozasok[0].map((h) => (h === "Célcsoport" ? "Csoport" : h));
  assert.deepEqual(build(tables), { ok: false, fatal: ["Foglalkozások fül: hiányzó oszlop: Célcsoport"] });
});

test("missing optional columns default to empty", () => {
  const model = buildOk(
    withTab("foglalkozasok", [
      ["Nap", "Első óra", "Utolsó óra", "Foglalkozás", "Célcsoport"],
      ["Kedd", "7", "8", "Balett", "2"],
    ]),
  );
  assert.equal(model.items.length, 1);
  assert.deepEqual(
    { teacher: model.items[0].teacher, room: model.items[0].room, uncertain: model.items[0].uncertain, note: model.items[0].note },
    { teacher: "", room: "", uncertain: false, note: "" },
  );
});

test("a missing tab is fatal", () => {
  const tables = sampleTables();
  delete tables.orak;
  assert.deepEqual(build(tables), { ok: false, fatal: ["Hiányzó fül: Órák"] });
});

test("an empty tab is fatal", () => {
  const result = build(withTab("osztalyok", []));
  assert.deepEqual(result, { ok: false, fatal: ["Osztályok fül: hiányzó oszlop: Osztály"] });
});

test("no valid lesson rows is fatal", () => {
  const result = build(withTab("orak", [["Óra", "Kezdés", "Vége"], ["x", "14:00", "14:45"]]));
  assert.deepEqual(result, { ok: false, fatal: ["Órák fül: nincs érvényes sor"] });
});

test("no valid class rows is fatal", () => {
  const result = build(withTab("osztalyok", [["Osztály"], ["9.a"]]));
  assert.deepEqual(result, { ok: false, fatal: ["Osztályok fül: nincs érvényes osztály"] });
});

// ---------------------------------------------------------------------------
// Row errors on Foglalkozások (each asserts tab, row and message)

function assertRowIssue(tables, expected) {
  const model = buildOk(tables);
  assert.deepEqual(model.issues, [expected]);
  return model;
}

test("err.day", () => {
  const model = assertRowIssue(withActivities(row(), row({ Nap: "Vasárnap" })), issue("error", "foglalkozasok", 3, "ismeretlen nap: ‚Vasárnap’"));
  assert.deepEqual(model.items.map((s) => s.sheetRow), [2]);
});

test("err.period: not an integer", () => {
  assertRowIssue(withActivities(row({ "Első óra": "hetedik" })), issue("error", "foglalkozasok", 2, "ismeretlen óra: ‚hetedik’"));
});

test("err.period: not in Órák", () => {
  assertRowIssue(withActivities(row(), row({ Nap: "Kedd" }), row({ "Utolsó óra": "11" })), issue("error", "foglalkozasok", 4, "ismeretlen óra: ‚11’"));
});

test("err.range", () => {
  assertRowIssue(withActivities(row({ "Első óra": "9", "Utolsó óra": "8" })), issue("error", "foglalkozasok", 2, "az utolsó óra korábbi az elsőnél"));
});

test("err.activity", () => {
  assertRowIssue(withActivities(row({ Foglalkozás: "Képzö" })), issue("error", "foglalkozasok", 2, "ismeretlen foglalkozás: ‚Képzö’"));
});

test("err.targetEmpty", () => {
  assertRowIssue(withActivities(row({ Célcsoport: " , " })), issue("error", "foglalkozasok", 2, "hiányzó célcsoport"));
});

test("err.target: unknown grade, unknown class, malformed item", () => {
  const model = buildOk(withActivities(row({ Célcsoport: "9, 3.c, 2, harmadik" })));
  assert.deepEqual(model.issues, [
    issue("error", "foglalkozasok", 2, "ismeretlen évfolyam vagy osztály: ‚9’"),
    issue("error", "foglalkozasok", 2, "ismeretlen évfolyam vagy osztály: ‚3.c’"),
    issue("error", "foglalkozasok", 2, "ismeretlen évfolyam vagy osztály: ‚harmadik’"),
  ]);
  assert.equal(model.items.length, 0);
});

test("err.target: a grade without classes", () => {
  const tables = withActivities(row({ Célcsoport: "8" }));
  tables.osztalyok = tables.osztalyok.filter((r) => !r[0].startsWith("8."));
  assertRowIssue(tables, issue("error", "foglalkozasok", 2, "ismeretlen évfolyam vagy osztály: ‚8’"));
});

test("err.missing for each required cell", () => {
  const model = buildOk(
    withActivities(row({ Nap: "" }), row({ "Első óra": "" }), row({ "Utolsó óra": "" }), row({ Foglalkozás: "" })),
  );
  assert.deepEqual(model.issues, [
    issue("error", "foglalkozasok", 2, "hiányzó kötelező mező: Nap"),
    issue("error", "foglalkozasok", 3, "hiányzó kötelező mező: Első óra"),
    issue("error", "foglalkozasok", 4, "hiányzó kötelező mező: Utolsó óra"),
    issue("error", "foglalkozasok", 5, "hiányzó kötelező mező: Foglalkozás"),
  ]);
});

test("all errors of a row are reported", () => {
  const model = buildOk(withActivities(row({ Nap: "Szombat", Foglalkozás: "Zene" })));
  assert.deepEqual(model.issues, [
    issue("error", "foglalkozasok", 2, "ismeretlen nap: ‚Szombat’"),
    issue("error", "foglalkozasok", 2, "ismeretlen foglalkozás: ‚Zene’"),
  ]);
});

test("row numbers count CSV records, not text lines", () => {
  const csv = [
    HEADER.join(","),
    'Hétfő,7,7,Balett,Juli,balett,1,igen,"Első sor\nmásodik sor",igen',
    "Kedd,7,7,Balett,Juli,balett,1,nem,,igen",
    "Szerda,7,7,Nincs ilyen,,,1,nem,,igen",
  ].join("\r\n");
  const model = buildOk(withTab("foglalkozasok", parseCSV(csv)));
  assert.deepEqual(model.issues, [issue("error", "foglalkozasok", 4, "ismeretlen foglalkozás: ‚Nincs ilyen’")]);
  assert.equal(model.items[0].note, "Első sor\nmásodik sor");
});

test("empty rows are skipped silently but still counted", () => {
  const model = buildOk(withActivities(["", "", "", "", "", "", "", "", "", ""], row({ Nap: "X" })));
  assert.deepEqual(model.issues, [issue("error", "foglalkozasok", 3, "ismeretlen nap: ‚X’")]);
});

// ---------------------------------------------------------------------------
// Warnings

test("warn.duplicate: an identical row keeps the first", () => {
  const model = assertRowIssue(
    withActivities(row({ "Utolsó óra": "8", Célcsoport: "1, 2" }), row({ "Utolsó óra": "8", Célcsoport: "2, 1" })),
    issue("warning", "foglalkozasok", 3, "ismétlődő sor, kihagyva"),
  );
  assert.deepEqual(model.items.map((s) => s.sheetRow), [2]);
});

test("overlapping rows are both kept (they are a choice, not a duplicate)", () => {
  const model = buildOk(withActivities(row({ "Utolsó óra": "8" }), row({ "Első óra": "8", "Utolsó óra": "9" })));
  assert.deepEqual(model.items.map((s) => [s.first, s.last]), [[7, 8], [8, 9]]);
  assert.deepEqual(model.issues, []);
});

test("slots that differ in teacher, room or targets are not duplicates", () => {
  const model = buildOk(withActivities(row(), row({ Tanár: "Réka" }), row({ Terem: "kistorna" }), row({ Célcsoport: "1.a" })));
  assert.equal(model.items.length, 4);
  assert.deepEqual(model.issues, []);
});

test("warn.duplicate on Foglalkozástípusok: first wins", () => {
  const tables = sampleTables();
  tables.foglalkozastipusok.push(["képzőművészet", "#000000"]);
  const model = assertRowIssue(tables, issue("warning", "foglalkozastipusok", 14, "ismétlődő sor, kihagyva"));
  assert.equal(model.activities.length, 12);
  assert.equal(model.activities.find((a) => a.id === "kepzomuveszet").color, "#5b4bb5");
});

test("warn.duplicate on Osztályok", () => {
  const tables = sampleTables();
  tables.osztalyok.push(["4.A"]);
  const model = assertRowIssue(tables, issue("warning", "osztalyok", 18, "ismétlődő sor, kihagyva"));
  assert.equal(model.classes.length, 16);
});

test("warn.color: invalid colour gets a fallback", () => {
  const tables = sampleTables();
  tables.foglalkozastipusok[4][1] = "lila";
  const model = assertRowIssue(tables, issue("warning", "foglalkozastipusok", 5, "érvénytelen szín: ‚lila’, automatikus szín"));
  assert.deepEqual([model.activities[3].color, model.activities[3].tint], [FALLBACK_PALETTE[0].color, FALLBACK_PALETTE[0].tint]);
});

test("warn.class", () => {
  const tables = sampleTables();
  tables.osztalyok.splice(3, 0, ["9.a"], ["4"]);
  const model = buildOk(tables);
  assert.deepEqual(model.issues, [
    issue("warning", "osztalyok", 4, "érvénytelen osztály: ‚9.a’"),
    issue("warning", "osztalyok", 5, "érvénytelen osztály: ‚4’"),
  ]);
  assert.equal(model.classes.length, 16);
});

test("an invalid igen/nem value warns and uses the default", () => {
  const model = buildOk(withActivities(row({ Bizonytalan: "talán" }), row({ Nap: "Kedd", Megjelenik: "?" })));
  assert.deepEqual(model.issues, [
    issue("warning", "foglalkozasok", 2, "érvénytelen igen/nem érték: ‚talán’, helyette ‚nem’"),
    issue("warning", "foglalkozasok", 3, "érvénytelen igen/nem érték: ‚?’, helyette ‚igen’"),
  ]);
  assert.deepEqual(model.items.map((s) => [s.day, s.uncertain]), [["H", false], ["K", false]]);
});

test("issues are ordered by tab, then row", () => {
  const tables = withActivities(row({ Nap: "X" }));
  tables.osztalyok.push(["zz"]);
  tables.foglalkozastipusok.push(["Zene", "piros"]);
  tables.orak.push(["11", "17:00", "25"]);
  assert.deepEqual(buildOk(tables).issues.map((i) => [i.tab, i.row]), [
    ["foglalkozasok", 2],
    ["foglalkozastipusok", 14],
    ["osztalyok", 18],
    ["orak", 6],
  ]);
});

// ---------------------------------------------------------------------------
// Órák

test("Órák: errors skip the row", () => {
  const model = buildOk(
    withTab("orak", [
      ["Óra", "Kezdés", "Vége"],
      ["7", "14:00", "14:45"],
      ["8.5", "14:45", "15:30"],
      ["8", "14.45", "15:30"],
      ["9", "", "16:00"],
      ["7", "15:00", "15:45"],
    ]),
  );
  assert.deepEqual(model.issues.filter((i) => i.tab === "orak"), [
    issue("error", "orak", 3, "érvénytelen óra: ‚8.5’"),
    issue("error", "orak", 4, "érvénytelen időpont: ‚14.45’"),
    issue("error", "orak", 5, "hiányzó kötelező mező: Kezdés"),
    issue("error", "orak", 6, "ismétlődő sor, kihagyva"),
  ]);
  assert.deepEqual(model.periods, [{ n: 7, from: "14:00", to: "14:45" }]);
  // Sample rows that use the dropped lessons now fail on Foglalkozások.
  assert.ok(model.issues.some((i) => i.tab === "foglalkozasok" && i.message === "ismeretlen óra: ‚8’"));
});

test("Órák: hours are zero-padded and periods sorted", () => {
  const model = buildOk(
    withTab("orak", [["Óra", "Kezdés", "Vége"], ["10", "10:00", "10:45"], ["7", "8:00", "8:45"], ["8", "9:00", "9:45"], ["9", "9:45", "10:00"]]),
  );
  assert.deepEqual(model.periods.map((p) => [p.n, p.from, p.to]), [[7, "08:00", "08:45"], [8, "09:00", "09:45"], [9, "09:45", "10:00"], [10, "10:00", "10:45"]]);
});

// ---------------------------------------------------------------------------
// Cell parsing

test("Bizonytalan and Megjelenik defaults", () => {
  const model = buildOk(withActivities(row({ Bizonytalan: "", Megjelenik: "" })));
  assert.equal(model.items.length, 1);
  assert.equal(model.items[0].uncertain, false);
  assert.deepEqual(model.issues, []);
});

test("igen/nem synonyms", () => {
  const truthy = ["igen", "IGEN", "i", "yes", "x", "X", "true"];
  const falsy = ["nem", "NEM", "n", "no", "false"];
  const values = [...truthy, ...falsy];
  const model = buildOk(withActivities(...values.map((v, i) => row({ Bizonytalan: v, Tanár: `T${i}` }))));
  assert.deepEqual(model.items.map((s) => s.uncertain), values.map((v) => truthy.includes(v)));
  assert.deepEqual(model.issues, []);
  const hidden = buildOk(withActivities(...falsy.map((v, i) => row({ Megjelenik: v, Tanár: `T${i}` }))));
  assert.equal(hidden.items.length, 0);
});

test("Megjelenik = nem is skipped with no issue, even if the row is invalid", () => {
  const model = buildOk(withActivities(row({ Megjelenik: "nem", Nap: "", Célcsoport: "" }), row({ Megjelenik: "N" })));
  assert.deepEqual(model.items, []);
  assert.deepEqual(model.issues, []);
});

test("day names and abbreviations", () => {
  const days = ["Hétfő", "hetfo", "H", "Kedd", "K", "Szerda", "Sze", "Sz", "CSÜTÖRTÖK", "Cs", "Péntek", "p"];
  const model = buildOk(withActivities(...days.map((Nap, i) => row({ Nap, Tanár: String(i) }))));
  assert.deepEqual(model.items.map((s) => s.day), ["H", "H", "H", "K", "K", "Sz", "Sz", "Sz", "Cs", "Cs", "P", "P"]);
});

test("Célcsoport tolerates trailing dots, inner spaces, case, semicolons and repeats", () => {
  const model = buildOk(withActivities(row({ Célcsoport: "5.; 3. A ;3.a, 4.b." })));
  assert.deepEqual(model.items[0].targets, ["5", "3.a", "4.b"]);
  assert.deepEqual(model.issues, []);
});

test("activity names match case- and diacritic-insensitively; the slot keeps the canonical name", () => {
  const model = buildOk(withActivities(row({ Foglalkozás: "  kepzomuveszet " })));
  assert.equal(model.items[0].activity, "Képzőművészet");
  assert.equal(model.items[0].activityId, "kepzomuveszet");
});

test("one row is one item, however many lessons it covers", () => {
  const model = buildOk(withActivities(row({ "Első óra": "7", "Utolsó óra": "10", Célcsoport: "1, 2, 3" })));
  assert.equal(model.items.length, 1);
  assert.deepEqual([model.items[0].first, model.items[0].last], [7, 10]);
  assert.deepEqual(lessonsOf(model, model.items[0]), [7, 8, 9, 10]);
});

test("classes keep the order of the Osztályok tab", () => {
  const model = buildOk(withTab("osztalyok", [["Osztály"], ["2.b"], ["10.a"], ["1.b"], [" 2. A "], ["1.a"], ["3.a"], ["4.a"], ["5.a"], ["6.a"], ["7.a"], ["8.a"]]));
  assert.deepEqual(model.classes.slice(0, 4), ["2.b", "1.b", "2.a", "1.a"]);
  assert.deepEqual(model.issues.filter((i) => i.tab === "osztalyok"), [issue("warning", "osztalyok", 3, "érvénytelen osztály: ‚10.a’")]);
});

test("settings: keys are normalized, unknown keys ignored, missing keys empty", () => {
  const model = buildOk(
    withTab("beallitasok", [["kulcs", "ertek"], ["TANEV", "2027/2028"], ["Közlemény", "Szünet"], ["Valami", "x"], ["", "y"]]),
  );
  assert.deepEqual(model.settings, { tanev: "2027/2028", iskola: "", hibabejelentes: "", kozlemeny: "Szünet" });
  assert.deepEqual(model.issues, []);
});

// ---------------------------------------------------------------------------
// Colours, ids, class matching

test("fallback colours are assigned in row order", () => {
  const model = buildOk(
    withTab("foglalkozastipusok", [
      ["Foglalkozás", "Szín"],
      ["Balett", ""],
      ["Kerámia", "#ABCDEF"],
      ["Képzőművészet", ""],
      ["Modern tánc", "#12345"],
    ]),
  );
  assert.deepEqual(model.activities.map((a) => [a.color, a.tint]), [
    [FALLBACK_PALETTE[0].color, FALLBACK_PALETTE[0].tint],
    ["#abcdef", tintOf("#abcdef")],
    [FALLBACK_PALETTE[1].color, FALLBACK_PALETTE[1].tint],
    [FALLBACK_PALETTE[2].color, FALLBACK_PALETTE[2].tint],
  ]);
  assert.deepEqual(model.issues.filter((i) => i.tab === "foglalkozastipusok"), [
    issue("warning", "foglalkozastipusok", 5, "érvénytelen szín: ‚#12345’, automatikus szín"),
  ]);
});

test("slugify", () => {
  assert.equal(slugify("Képzőművészet"), "kepzomuveszet");
  assert.equal(slugify("Modern tánc"), "modern-tanc");
  assert.equal(slugify("ÉK"), "ek");
  assert.equal(slugify(" Színpadi  tánc (?) "), "szinpadi-tanc");
  assert.equal(slugify("Nyitott világ"), "nyitott-vilag");
});

test("the id 'all' is reserved for the UI's Mind filter", () => {
  const model = buildOk(withTab("foglalkozastipusok", [["Foglalkozás", "Szín"], ["All", ""], ["Balett", ""]]));
  assert.deepEqual(model.activities.map((a) => a.id), ["all-2", "balett"]);
});

test("activity ids stay unique when names share a slug", () => {
  const model = buildOk(withTab("foglalkozastipusok", [["Foglalkozás", "Szín"], ["Kép-zés", ""], ["Kép zés", ""]]));
  assert.deepEqual(model.activities.map((a) => a.id), ["kep-zes", "kep-zes-2"]);
});

test("class matching: a grade matches all its classes, a class only itself", () => {
  const model = buildOk(withActivities(row({ Célcsoport: "3" }), row({ Célcsoport: "3.a", Nap: "Kedd" })));
  assert.deepEqual(itemsForClass(model, "3.a").map((s) => s.day), ["H", "K"]);
  assert.deepEqual(itemsForClass(model, "3.b").map((s) => s.day), ["H"]);
  assert.deepEqual(itemsForClass(model, "4.a"), []);
});

// SPEC 1.1 §3.3 and acceptance criteria 3-4, with the 18 classes of §3.2.
const CLASSES_1_1 = ["1.a", "1.b", "2.a", "3.a", "3.b", "4.a", "4.b", "5.a", "5.b", "6.a", "6.b", "6.m", "7.a", "7.b", "7.m", "8.a", "8.b", "8.m"];
const withClasses11 = (...rows) => {
  const tables = withActivities(...rows);
  tables.osztalyok = [["Osztály"], ...CLASSES_1_1.map((c) => [c])];
  return tables;
};

test("targeting: a grade reaches its m class too; an m class only itself", () => {
  const model = buildOk(withClasses11(row({ Célcsoport: "6" }), row({ Nap: "Kedd", Célcsoport: "7.m." }), row({ Nap: "Szerda", Célcsoport: "3.b" })));
  const [grade6, class7m, class3b] = model.items;
  assert.deepEqual(["6.a", "6.b", "6.m", "7.a"].map((c) => reachesClass(grade6, c)), [true, true, true, false]);
  assert.deepEqual(["7.m", "7.a", "7.b"].map((c) => reachesClass(class7m, c)), [true, false, false]);
  assert.deepEqual(class7m.targets, ["7.m"]);
  assert.deepEqual(["3.b", "3.a"].map((c) => reachesClass(class3b, c)), [true, false]);
  assert.deepEqual(model.classes, CLASSES_1_1);
  assert.deepEqual(model.issues, []);
});

test("targeting: old notations and a missing class make the row invalid", () => {
  const model = buildOk(withClasses11(row({ Célcsoport: "5.-6." }), row({ Célcsoport: "4.evf" }), row({ Célcsoport: "2.b" })));
  assert.deepEqual(model.items, []);
  assert.deepEqual(model.issues.map((i) => [i.row, i.message]), [
    [2, "ismeretlen évfolyam vagy osztály: ‚5.-6.’"],
    [3, "ismeretlen évfolyam vagy osztály: ‚4.evf’"],
    [4, "ismeretlen évfolyam vagy osztály: ‚2.b’"],
  ]);
});

test("tints: 18 % towards white, lighter when ink would fall below 4.5:1", () => {
  assert.equal(tintOf("#ffffff"), "#ffffff");
  // 18 % of red mixed into white.
  assert.equal(tintOf("#ff0000"), "#ffd1d1");
  for (const color of ["#000000", "#761117", "#3a1f06", "#2e6d74", "#e6a328"]) {
    assert.ok(contrast(INK, tintOf(color)) >= 4.5, color);
  }
  // Even black at 18 % stays far above 4.5:1, so lightening is only a safeguard.
  assert.equal(tintOf("#000000"), "#d1d1d1");
  for (const { tint } of FALLBACK_PALETTE) assert.ok(contrast(INK, tint) >= 4.5, tint);
});

test("fallback colour pairs go round the palette", () => {
  const rows = Array.from({ length: 9 }, (_, i) => [`F${i}`, ""]);
  const model = buildOk(withTab("foglalkozastipusok", [["Foglalkozás", "Szín"], ...rows]));
  assert.deepEqual(model.activities.map((a) => a.color), [0, 1, 2, 3, 4, 5, 6, 0, 1].map((i) => FALLBACK_PALETTE[i].color));
});

test("class matching on the sample", () => {
  const model = buildOk(sampleTables());
  const rows = (cls) => itemsForClass(model, cls).map((s) => s.sheetRow).sort((a, b) => a - b);
  assert.deepEqual(rows("3.a"), [2, 5, 6, 10, 21, 23, 24]);
  assert.deepEqual(rows("3.b"), [2, 5, 6, 9, 21, 23, 24]);
  assert.deepEqual(rows("4.a"), [6, 13, 16, 17, 21, 24, 28]);
});
