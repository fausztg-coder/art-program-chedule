// Selection state (SPEC 1.1 §5): class = null ("Összes") or one class;
// disciplines = activity ids in chip order, empty = "Összes". Everything here
// is pure except loadChoice/saveChoice, which touch browser globals only when
// called, so Node tests can import this file.

import { itemsForClass, lessonsOf, reachesClass } from "./model.js";

const gradeOf = (cls) => cls.split(".")[0];

// Grades that have at least one class, in class order.
export function gradesOf(model) {
  return [...new Set(model.classes.map(gradeOf))];
}

export function classesOfGrade(model, grade) {
  return model.classes.filter((c) => gradeOf(c) === String(grade));
}

// The mobile class selector (SPEC §4.5.2): one row per grade, in the order of
// the Osztályok tab.
export function classRows(model) {
  return gradesOf(model).map((grade) => ({ grade, classes: classesOfGrade(model, grade) }));
}

export const NO_SELECTION = Object.freeze({ cls: null, disciplines: [] });

// Unknown classes and ids are dropped; ids are kept in chip order.
export function normalizeChoice(model, { cls = null, disciplines = [] } = {}) {
  const wanted = new Set(disciplines);
  return {
    cls: model.classes.includes(cls) ? cls : null,
    disciplines: model.activities.filter((a) => wanted.has(a.id)).map((a) => a.id),
  };
}

export function chooseClass(model, sel, cls) {
  return normalizeChoice(model, { cls, disciplines: sel.disciplines });
}

export function toggleDiscipline(model, sel, id) {
  const on = sel.disciplines.includes(id);
  const disciplines = on ? sel.disciplines.filter((d) => d !== id) : [...sel.disciplines, id];
  return normalizeChoice(model, { cls: sel.cls, disciplines });
}

export function clearDisciplines(sel) {
  return { cls: sel.cls, disciplines: [] };
}

// Readable Célcsoport (SPEC §4.5): "5,6" → ["5. évf.", "6. évf."]; sorted by
// grade, a whole grade before its single classes. Kept as parts so the narrow
// class column can wrap between them.
export function targetParts(targets) {
  const grade = (t) => Number(t.split(".")[0]);
  return [...targets]
    .sort((a, b) => grade(a) - grade(b) || a.includes(".") - b.includes(".") || a.localeCompare(b, "hu"))
    .map((t) => (t.includes(".") ? t : `${t}. évf.`));
}

export const targetLabel = (targets) => targetParts(targets).join(", ");

// "7–8. óra", or "9. óra" for a single lesson.
export function periodLabel(item) {
  return item.first === item.last ? `${item.first}. óra` : `${item.first}–${item.last}. óra`;
}

// "14:45–16:00": start of the first lesson – end of the last (SPEC §3.7).
export function timeRange(model, item) {
  const byN = new Map(model.periods.map((p) => [p.n, p]));
  return `${byN.get(item.first).from}–${byN.get(item.last).to}`;
}

// Visible rows (SPEC §5.2), ordered by day, first lesson, then class column.
export function visibleItems(model, sel) {
  const wanted = new Set(sel.disciplines);
  const dayIndex = new Map(model.days.map((d, i) => [d.key, i]));
  return (sel.cls ? itemsForClass(model, sel.cls) : [...model.items])
    .filter((item) => !wanted.size || wanted.has(item.activityId))
    .map((item) => ({ item, label: targetLabel(item.targets) }))
    .sort(
      (a, b) =>
        dayIndex.get(a.item.day) - dayIndex.get(b.item.day) ||
        a.item.first - b.item.first ||
        a.label.localeCompare(b.label, "hu") ||
        a.item.sheetRow - b.item.sheetRow,
    )
    .map(({ item }) => item);
}

// Visible items per day, in the order of the days; days without items are left
// out (SPEC §4.5.5).
export function groupByDay(model, items) {
  return model.days
    .map((day) => ({ day, items: items.filter((item) => item.day === day.key) }))
    .filter((group) => group.items.length);
}

// Items sharing a (day, lesson) with another visible item (SPEC §4.6); only
// for a selected class, and on the list after the discipline filter.
export function choiceItems(model, sel, items) {
  const marked = new Set();
  if (!sel.cls) return marked;
  const bySlot = new Map();
  for (const item of items) {
    if (!reachesClass(item, sel.cls)) continue;
    for (const n of lessonsOf(model, item)) {
      const key = `${item.day}|${n}`;
      if (!bySlot.has(key)) bySlot.set(key, []);
      bySlot.get(key).push(item);
    }
  }
  for (const list of bySlot.values()) if (list.length > 1) list.forEach((item) => marked.add(item));
  return marked;
}

// Result title (SPEC §5.3): "3.b osztály · Balett, Kerámia".
export function selectionTitle(model, sel) {
  const classPart = sel.cls ? `${sel.cls} osztály` : "Minden osztály";
  const names = model.activities.filter((a) => sel.disciplines.includes(a.id)).map((a) => a.name);
  let disciplinePart = "minden tanszak";
  if (names.length >= 4) disciplinePart = `${names.length} tanszak`;
  else if (names.length) disciplinePart = names.join(", ");
  return `${classPart} · ${disciplinePart}`;
}

export const countLabel = (n) => `${n} foglalkozás hetente`;

// Hungarian suffix of a year, by how its end is pronounced: 2027-es, 2023-as,
// 2025-ös, 2026-os; round numbers by their tens: 2020-as (húsz), 2030-as
// (harminc), 2040-es (negyven); 2100-as (száz), 2000-es (ezer).
const ONES = { 1: "es", 2: "es", 3: "as", 4: "es", 5: "ös", 6: "os", 7: "es", 8: "as", 9: "es" };
const TENS = { 1: "es", 2: "as", 3: "as", 4: "es", 5: "es", 6: "as", 7: "es", 8: "as", 9: "es" };

export function yearSuffix(year) {
  const n = Number(year);
  if (n % 10) return ONES[n % 10];
  if (Math.floor(n / 10) % 10) return TENS[Math.floor(n / 10) % 10];
  if (Math.floor(n / 100) % 10) return "as";
  return "es";
}

// "2026/2027" → "2026/2027-es tanév" (SPEC §3.8); "" when not set.
export function schoolYearLabel(tanev) {
  const text = String(tanev || "").trim();
  const match = text.match(/(\d+)\D*$/);
  return match ? `${text}-${yearSuffix(match[1])} tanév` : "";
}

// URL (SPEC §5.4): ?o=3.b&f=balett,keramia. present: whether o or f is given.
export function readChoiceQuery(model, search) {
  const params = new URLSearchParams(search);
  const clean = (v) => (v || "").normalize("NFC").replace(/\s+/g, "").toLowerCase();
  const present = params.has("o") || params.has("f");
  const disciplines = clean(params.get("f")).split(",").filter(Boolean);
  return { present, selection: normalizeChoice(model, { cls: clean(params.get("o")) || null, disciplines }) };
}

// Query string for a selection, keeping unrelated parameters (e.g. forras).
// The comma in f stays literal, as in the SPEC's example link.
export function choiceQuery(search, sel) {
  const params = new URLSearchParams(search);
  params.delete("o");
  params.delete("f");
  const parts = [params.toString()].filter(Boolean);
  if (sel.cls) parts.push(`o=${encodeURIComponent(sel.cls)}`);
  if (sel.disciplines.length) parts.push(`f=${sel.disciplines.map(encodeURIComponent).join(",")}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

// Start state: the URL if it has o or f, else the stored choice, else Összes/Összes.
export function resolveChoice(model, { search = "", stored = null } = {}) {
  const fromUrl = readChoiceQuery(model, search);
  if (fromUrl.present) return fromUrl.selection;
  if (stored && typeof stored === "object") {
    return normalizeChoice(model, { cls: stored.o ?? null, disciplines: Array.isArray(stored.f) ? stored.f : [] });
  }
  return { ...NO_SELECTION };
}

export const CHOICE_STORAGE_KEY = "hunyadi-orarend-1.1";

export function loadChoice() {
  try {
    const value = JSON.parse(globalThis.localStorage.getItem(CHOICE_STORAGE_KEY));
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export function saveChoice(sel) {
  try {
    globalThis.localStorage.setItem(CHOICE_STORAGE_KEY, JSON.stringify({ o: sel.cls, f: sel.disciplines }));
  } catch {
    // Storage may be unavailable (private mode, blocked site data).
  }
  try {
    const { location, history } = globalThis;
    history.replaceState(history.state, "", location.pathname + choiceQuery(location.search, sel) + location.hash);
  } catch {
    // Ignore: the page still works without URL sync.
  }
}
