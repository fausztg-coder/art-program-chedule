// Several children (SPEC 1.2 §14): 1–4 children, each with its own selection
// ({ cls, disciplines } as in state.js) and an optional first name that lives
// only in this browser. family = { children: [{ cls, disciplines, name }], active }.
// Everything here is pure except loadFamily/saveFamily, which touch browser
// globals only when called, so Node tests can import this file.

import { NO_SELECTION, normalizeChoice, printTitle, selectionTitle } from "./state.js";

export const MAX_CHILDREN = 4;
export const NAME_MAX_LENGTH = 20;

// Trimmed, at most 20 characters (code points, so ő/ű count as one).
export function cleanName(name) {
  return typeof name === "string" ? [...name.trim()].slice(0, NAME_MAX_LENGTH).join("") : "";
}

const child = (sel = NO_SELECTION, name = "") => ({ cls: sel.cls, disciplines: [...sel.disciplines], name: cleanName(name) });

export function newFamily(sel = NO_SELECTION) {
  return { children: [child(sel)], active: 0 };
}

export const activeChild = (family) => family.children[family.active];

// A new child starts at Összes/Összes and becomes the active one (§14.2).
export function addChild(family) {
  if (family.children.length >= MAX_CHILDREN) return family;
  const children = [...family.children, child()];
  return { children, active: children.length - 1 };
}

// Removes the active child; the one before it (or the first) becomes active.
export function removeChild(family) {
  if (family.children.length <= 1) return family;
  const children = family.children.filter((_, i) => i !== family.active);
  return { children, active: Math.max(0, family.active - 1) };
}

export function setActiveChild(family, index) {
  return Number.isInteger(index) && index >= 0 && index < family.children.length ? { ...family, active: index } : family;
}

// Applies a state.js selection change (chooseClass, toggleDiscipline, …) to the
// active child, keeping its name.
export function updateActiveChild(family, change) {
  const current = activeChild(family);
  const next = change(current);
  const children = family.children.map((c, i) => (i === family.active ? child(next, current.name) : c));
  return { ...family, children };
}

export function setChildName(family, name) {
  const children = family.children.map((c, i) => (i === family.active ? { ...c, name: cleanName(name) } : c));
  return { ...family, children };
}

// ---------------------------------------------------------------------------
// Labels (§14.1, §14.3, §14.4)

// The first name if given, else "{n}. gyerek" by the current position.
export const childLabel = (family, index) => family.children[index].name || `${index + 1}. gyerek`;

export const childTitle = (model, family, index) =>
  `${childLabel(family, index)} – ${selectionTitle(model, family.children[index])}`;

export const familyHeading = (family) => `${family.children.length} gyerek órarendje`;

// PDF only when every child has a class (§14.4).
export const canPrintFamily = (family) => family.children.every((c) => c.cls);

// One child: the 1.1 title; more: "Művészeti órarend – Anna, 2. gyerek".
export function familyPrintTitle(model, family) {
  if (family.children.length === 1) return printTitle(model, family.children[0]);
  return `Művészeti órarend – ${family.children.map((_, i) => childLabel(family, i)).join(", ")}`;
}

// ---------------------------------------------------------------------------
// URL (§14.5): child 1 is o/f (as in 1.1), children 2–4 are o2/f2 … o4/f4, and
// gy is the number of children when more than one. Names and the active child
// are never in the URL.

const keysOf = (n) => (n === 1 ? ["o", "f"] : [`o${n}`, `f${n}`]);
const ALL_KEYS = ["gy", ...Array.from({ length: MAX_CHILDREN }, (_, i) => keysOf(i + 1)).flat()];

// present: whether any child parameter is given.
export function readFamilyQuery(model, search) {
  const params = new URLSearchParams(search);
  const clean = (v) => (v || "").normalize("NFC").replace(/\s+/g, "").toLowerCase();
  const present = ALL_KEYS.some((k) => params.has(k));
  let highest = 1;
  for (let n = 1; n <= MAX_CHILDREN; n++) if (keysOf(n).some((k) => params.has(k))) highest = n;
  // A gy that is not a whole number counts as missing; otherwise it is clamped to 1–4.
  const gy = (params.get("gy") || "").trim();
  const count = /^[+-]?\d+$/.test(gy) ? Math.min(MAX_CHILDREN, Math.max(1, Number(gy))) : highest;
  const children = [];
  for (let n = 1; n <= count; n++) {
    const [o, f] = keysOf(n);
    const disciplines = clean(params.get(f)).split(",").filter(Boolean);
    children.push(child(normalizeChoice(model, { cls: clean(params.get(o)) || null, disciplines })));
  }
  return { present, family: { children, active: 0 } };
}

// Query string for a family, keeping unrelated parameters (e.g. forras).
export function familyQuery(search, family) {
  const params = new URLSearchParams(search);
  ALL_KEYS.forEach((k) => params.delete(k));
  const parts = [params.toString()].filter(Boolean);
  family.children.forEach((c, i) => {
    const [o, f] = keysOf(i + 1);
    if (c.cls) parts.push(`${o}=${encodeURIComponent(c.cls)}`);
    if (c.disciplines.length) parts.push(`${f}=${c.disciplines.map(encodeURIComponent).join(",")}`);
    if (i === 0 && family.children.length > 1) parts.push(`gy=${family.children.length}`);
  });
  return parts.length ? `?${parts.join("&")}` : "";
}

// ---------------------------------------------------------------------------
// Stored choice (§14.5): { children: [{ o, f, nev }], aktiv } under the 1.2 key;
// without it, the 1.1 stored choice ({ o, f }) becomes child 1.

export const FAMILY_STORAGE_KEY = "hunyadi-orarend-1.2";
export const LEGACY_STORAGE_KEY = "hunyadi-orarend-1.1";

const storedSel = (model, value) =>
  normalizeChoice(model, {
    cls: typeof value?.o === "string" ? value.o : null,
    disciplines: Array.isArray(value?.f) ? value.f : [],
  });

function storedFamily(model, stored, legacy) {
  if (stored && typeof stored === "object" && Array.isArray(stored.children) && stored.children.length) {
    const children = stored.children.slice(0, MAX_CHILDREN).map((c) => child(storedSel(model, c), c?.nev));
    return setActiveChild({ children, active: 0 }, stored.aktiv);
  }
  if (legacy && typeof legacy === "object") return newFamily(storedSel(model, legacy));
  return newFamily();
}

// Start state: the URL if it has any child parameter (names kept from storage
// by position), else the stored family, else one child at Összes/Összes.
export function resolveFamily(model, { search = "", stored = null, legacy = null } = {}) {
  const fromStorage = storedFamily(model, stored, legacy);
  const fromUrl = readFamilyQuery(model, search);
  if (!fromUrl.present) return fromStorage;
  const children = fromUrl.family.children.map((c, i) => ({ ...c, name: fromStorage.children[i]?.name ?? "" }));
  return { children, active: 0 };
}

const readStorage = (key) => {
  try {
    const value = JSON.parse(globalThis.localStorage.getItem(key));
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
};

export const loadFamily = () => ({ stored: readStorage(FAMILY_STORAGE_KEY), legacy: readStorage(LEGACY_STORAGE_KEY) });

export function saveFamily(family) {
  const value = {
    children: family.children.map((c) => ({ o: c.cls, f: c.disciplines, nev: c.name })),
    aktiv: family.active,
  };
  try {
    globalThis.localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode, blocked site data).
  }
  try {
    const { location, history } = globalThis;
    history.replaceState(history.state, "", location.pathname + familyQuery(location.search, family) + location.hash);
  } catch {
    // Ignore: the page still works without URL sync.
  }
}
