// Selection state: which class and activity are shown (SPEC §6.3).
// The resolve/transition functions are pure. The URL and localStorage helpers
// touch browser globals only when called, so Node tests can import this file.

import { slotsForClass } from "./model.js";

export const STORAGE_KEY = "hunyadi-orarend";
export const ALL = "all";

const gradeOf = (cls) => cls.split(".")[0];

// Grades that have at least one class, in class order.
export function gradesOf(model) {
  return [...new Set(model.classes.map(gradeOf))];
}

export function classesOfGrade(model, grade) {
  return model.classes.filter((c) => gradeOf(c) === String(grade));
}

// Activities with at least one slot for the class, in activity order.
export function activityCounts(model, cls) {
  const counts = new Map();
  for (const s of slotsForClass(model, cls)) counts.set(s.activityId, (counts.get(s.activityId) || 0) + 1);
  return model.activities.filter((a) => counts.has(a.id)).map((activity) => ({ activity, count: counts.get(activity.id) }));
}

// Unknown class → first class; activity without slots for the class → all.
export function normalizeSelection(model, { cls, act }) {
  const validCls = model.classes.includes(cls) ? cls : model.classes[0];
  const validAct = act !== ALL && activityCounts(model, validCls).some((c) => c.activity.id === act) ? act : ALL;
  return { cls: validCls, act: validAct };
}

// Precedence per field: URL, then stored selection, then the first class / all.
// A valid URL class without foglalkozas means all; the stored activity is only
// used together with the stored class.
export function resolveSelection(model, { query = {}, stored = null } = {}) {
  if (model.classes.includes(query.osztaly)) {
    return normalizeSelection(model, { cls: query.osztaly, act: query.foglalkozas || ALL });
  }
  const fromStore = Boolean(stored && model.classes.includes(stored.osztaly));
  const cls = fromStore ? stored.osztaly : model.classes[0];
  const act = query.foglalkozas || (fromStore && stored.foglalkozas) || ALL;
  return normalizeSelection(model, { cls, act });
}

// A new grade keeps the letter if that class exists, else takes the grade's first class.
export function selectGrade(model, sel, grade) {
  const candidate = `${grade}.${sel.cls.split(".")[1]}`;
  const cls = model.classes.includes(candidate) ? candidate : classesOfGrade(model, grade)[0];
  return normalizeSelection(model, { cls, act: sel.act });
}

export function selectClass(model, sel, cls) {
  return normalizeSelection(model, { cls, act: sel.act });
}

export function selectActivity(model, sel, act) {
  return normalizeSelection(model, { cls: sel.cls, act });
}

// Tolerates hand-typed values: "4. A" → "4.a".
export function readQuery(search) {
  const params = new URLSearchParams(search);
  const get = (key) => (params.get(key) || "").normalize("NFC").replace(/\s+/g, "").toLowerCase();
  return { osztaly: get("osztaly"), foglalkozas: get("foglalkozas") };
}

// Query string for the selection, keeping unrelated parameters (e.g. forras).
export function searchFor(search, sel) {
  const params = new URLSearchParams(search);
  params.set("osztaly", sel.cls);
  if (sel.act === ALL) params.delete("foglalkozas");
  else params.set("foglalkozas", sel.act);
  return `?${params}`;
}

export function loadStored() {
  try {
    const value = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY));
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export function persist(sel) {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({ osztaly: sel.cls, foglalkozas: sel.act }));
  } catch {
    // Storage may be unavailable (private mode, blocked site data).
  }
  try {
    const { location, history } = globalThis;
    history.replaceState(history.state, "", searchFor(location.search, sel) + location.hash);
  } catch {
    // Ignore: the page still works without URL sync.
  }
}
