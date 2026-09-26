// Data model: validates and normalizes the five Sheet tabs. Pure: no DOM, no
// Node APIs, no I/O. Shared by the browser and scripts/snapshot.mjs.

// 2: one item per Sheet row (SPEC 1.1 §4.5); version 1 had one slot per lesson.
export const MODEL_VERSION = 2;

// Tab keys in display order, with their Hungarian display names (SPEC §7).
export const TABS = ["foglalkozasok", "foglalkozastipusok", "osztalyok", "orak", "beallitasok"];
export const TAB_NAMES = {
  foglalkozasok: "Foglalkozások",
  foglalkozastipusok: "Foglalkozástípusok",
  osztalyok: "Osztályok",
  orak: "Órák",
  beallitasok: "Beállítások",
};

// Canonical headers per tab and which of them are required (SPEC §3.1).
const COLUMNS = {
  foglalkozasok: {
    all: ["Nap", "Első óra", "Utolsó óra", "Foglalkozás", "Tanár", "Terem", "Célcsoport", "Bizonytalan", "Megjegyzés", "Megjelenik"],
    required: ["Nap", "Első óra", "Utolsó óra", "Foglalkozás", "Célcsoport"],
  },
  foglalkozastipusok: { all: ["Foglalkozás", "Szín"], required: ["Foglalkozás"] },
  osztalyok: { all: ["Osztály"], required: ["Osztály"] },
  orak: { all: ["Óra", "Kezdés", "Vége"], required: ["Óra", "Kezdés", "Vége"] },
  beallitasok: { all: ["Kulcs", "Érték"], required: ["Kulcs"] },
};

export const DAYS = [
  { key: "H", name: "Hétfő" },
  { key: "K", name: "Kedd" },
  { key: "Sz", name: "Szerda" },
  { key: "Cs", name: "Csütörtök" },
  { key: "P", name: "Péntek" },
];

// Accepted spellings (after norm()) for each day key.
const DAY_ALIASES = {
  hetfo: "H", h: "H",
  kedd: "K", k: "K",
  szerda: "Sz", sze: "Sz", sz: "Sz",
  csutortok: "Cs", cs: "Cs",
  pentek: "P", p: "P",
};

const TRUE_WORDS = new Set(["igen", "i", "yes", "x", "true"]);
const FALSE_WORDS = new Set(["nem", "n", "no", "false"]);

const SETTING_KEYS = ["tanev", "iskola", "hibabejelentes", "kozlemeny"];

// Colour pairs for activities without a Szín, in row order (SPEC §3.6).
export const FALLBACK_PALETTE = [
  { tint: "#f4dadc", color: "#a8434f" },
  { tint: "#f6e0cc", color: "#b8662a" },
  { tint: "#f5e7b8", color: "#9a7414" },
  { tint: "#dceadf", color: "#3f7556" },
  { tint: "#dee3f0", color: "#3f5a8c" },
  { tint: "#eadcec", color: "#7a4a86" },
  { tint: "#d9eaec", color: "#2e6d74" },
];

// Text colour on activity tints; the tint must keep it at 4.5:1 or better.
export const INK = "#3a1f06";
const TINT_SHARE = 0.18;
const MIN_CONTRAST = 4.5;

const CLASS_RE = /^[1-8]\.[a-zà-ɏ]+$/;
const GRADE_RE = /^[1-8]$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;
const INT_RE = /^\d+$/;

// Row issue messages, in the form of the SPEC 1.1 §4.7 example
// ("ismeretlen foglalkozás: ‚Képzö’"): lowercase, ‚…’ quotes.
const MSG = {
  day: (v) => `ismeretlen nap: ‚${v}’`,
  period: (v) => `ismeretlen óra: ‚${v}’`,
  range: () => "az utolsó óra korábbi az elsőnél",
  activity: (v) => `ismeretlen foglalkozás: ‚${v}’`,
  targetEmpty: () => "hiányzó célcsoport",
  target: (v) => `ismeretlen évfolyam vagy osztály: ‚${v}’`,
  missing: (column) => `hiányzó kötelező mező: ${column}`,
  duplicate: () => "ismétlődő sor, kihagyva",
  color: (v) => `érvénytelen szín: ‚${v}’, automatikus szín`,
  class: (v) => `érvénytelen osztály: ‚${v}’`,
  bool: (v, fallback) => `érvénytelen igen/nem érték: ‚${v}’, helyette ‚${fallback}’`,
  periodNumber: (v) => `érvénytelen óra: ‚${v}’`,
  time: (v) => `érvénytelen időpont: ‚${v}’`,
  // Fatal messages go to the console and the Actions log only.
  fatalTab: (tab) => `Hiányzó fül: ${TAB_NAMES[tab]}`,
  fatalHeader: (tab, column) => `${TAB_NAMES[tab]} fül: hiányzó oszlop: ${column}`,
  fatalNoPeriods: () => `${TAB_NAMES.orak} fül: nincs érvényes sor`,
  fatalNoClasses: () => `${TAB_NAMES.osztalyok} fül: nincs érvényes osztály`,
};

// ---------------------------------------------------------------------------
// Normalization helpers

const clean = (s) => (s == null ? "" : String(s)).normalize("NFC").trim();

// Comparison key: NFC, trim, lowercase, strip diacritics, collapse whitespace.
export function norm(s) {
  return clean(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

export function slugify(name) {
  return norm(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "3. A" → "3.a", "5." → "5". Used for Célcsoport items and Osztály values.
function normTarget(s) {
  return clean(s).replace(/\s+/g, "").toLowerCase().replace(/\.$/, "");
}

function parseBool(v, fallback) {
  const k = norm(v);
  if (k === "") return { value: fallback };
  if (TRUE_WORDS.has(k)) return { value: true };
  if (FALSE_WORDS.has(k)) return { value: false };
  return { value: fallback, invalid: true };
}

const boolWord = (b) => (b ? "igen" : "nem");

// Maps a raw table (header row + records) to objects keyed by canonical header.
// Returns { missing } when required headers are absent.
function readTable(tab, table) {
  const spec = COLUMNS[tab];
  const header = (table[0] || []).map(norm);
  const index = {};
  for (const col of spec.all) {
    const i = header.indexOf(norm(col));
    if (i !== -1) index[col] = i;
  }
  const missing = spec.required.filter((col) => !(col in index));
  if (missing.length) return { missing };

  const rows = [];
  for (let r = 1; r < table.length; r++) {
    const cells = table[r].map(clean);
    if (cells.every((c) => c === "")) continue;
    const row = { sheetRow: r + 1 };
    for (const col of spec.all) row[col] = col in index ? cells[index[col]] ?? "" : "";
    rows.push(row);
  }
  return { rows };
}

// ---------------------------------------------------------------------------
// buildModel

export function buildModel(tables, { source = "sheet", now = new Date() } = {}) {
  const fatal = [];
  const read = {};
  for (const tab of TABS) {
    const table = tables ? tables[tab] : undefined;
    if (!Array.isArray(table)) {
      fatal.push(MSG.fatalTab(tab));
      continue;
    }
    const result = readTable(tab, table);
    if (result.missing) {
      for (const col of result.missing) fatal.push(MSG.fatalHeader(tab, col));
    } else {
      read[tab] = result.rows;
    }
  }
  if (fatal.length) return { ok: false, fatal };

  const issues = [];
  const issue = (level, tab, row, message) => issues.push({ level, tab, row, message });

  const settings = readSettings(read.beallitasok);
  const periods = readPeriods(read.orak, issue);
  if (!periods.length) return { ok: false, fatal: [MSG.fatalNoPeriods()] };
  const classes = readClasses(read.osztalyok, issue);
  if (!classes.length) return { ok: false, fatal: [MSG.fatalNoClasses()] };
  const activities = readActivities(read.foglalkozastipusok, issue);
  const items = readItems(read.foglalkozasok, { periods, classes, activities }, issue);

  const tabOrder = (t) => TABS.indexOf(t);
  issues.sort((a, b) => tabOrder(a.tab) - tabOrder(b.tab) || a.row - b.row);

  return {
    ok: true,
    model: {
      version: MODEL_VERSION,
      generatedAt: formatTimestamp(now),
      source,
      settings,
      days: DAYS.map((d) => ({ key: d.key, name: d.name })),
      periods,
      classes,
      activities: activities.map(({ id, name, color, tint }) => ({ id, name, color, tint })),
      items,
      issues,
    },
  };
}

function formatTimestamp(now) {
  if (typeof now === "string") return now;
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function readSettings(rows) {
  const settings = Object.fromEntries(SETTING_KEYS.map((k) => [k, ""]));
  const seen = new Set();
  for (const row of rows) {
    const key = norm(row["Kulcs"]);
    if (!SETTING_KEYS.includes(key) || seen.has(key)) continue;
    seen.add(key);
    settings[key] = row["Érték"];
  }
  return settings;
}

function readPeriods(rows, issue) {
  const periods = [];
  for (const row of rows) {
    const errors = [];
    for (const col of ["Óra", "Kezdés", "Vége"]) {
      if (row[col] === "") errors.push(MSG.missing(col));
    }
    if (row["Óra"] !== "" && !INT_RE.test(row["Óra"])) errors.push(MSG.periodNumber(row["Óra"]));
    for (const col of ["Kezdés", "Vége"]) {
      if (row[col] !== "" && !TIME_RE.test(row[col])) errors.push(MSG.time(row[col]));
    }
    if (!errors.length && periods.some((p) => p.n === Number(row["Óra"]))) {
      errors.push(MSG.duplicate());
    }
    if (errors.length) {
      for (const m of errors) issue("error", "orak", row.sheetRow, m);
      continue;
    }
    periods.push({ n: Number(row["Óra"]), from: padTime(row["Kezdés"]), to: padTime(row["Vége"]) });
  }
  return periods.sort((a, b) => a.n - b.n);
}

const padTime = (t) => t.padStart(5, "0");

function readClasses(rows, issue) {
  const classes = [];
  for (const row of rows) {
    const cls = normTarget(row["Osztály"]);
    if (!CLASS_RE.test(cls)) {
      issue("warning", "osztalyok", row.sheetRow, MSG.class(row["Osztály"]));
    } else if (classes.includes(cls)) {
      issue("warning", "osztalyok", row.sheetRow, MSG.duplicate());
    } else {
      classes.push(cls);
    }
  }
  return classes; // in the tab's order (SPEC §3.2)
}

function readActivities(rows, issue) {
  const activities = [];
  const byKey = new Map();
  const ids = new Set(["all"]); // reserved since 1.0; kept so existing URL keys stay stable (SPEC §3.5)
  let paletteIndex = 0;
  for (const row of rows) {
    const name = row["Foglalkozás"];
    if (name === "") {
      issue("error", "foglalkozastipusok", row.sheetRow, MSG.missing("Foglalkozás"));
      continue;
    }
    const key = norm(name);
    if (byKey.has(key)) {
      issue("warning", "foglalkozastipusok", row.sheetRow, MSG.duplicate());
      continue;
    }
    let color, tint;
    if (COLOR_RE.test(row["Szín"])) {
      color = row["Szín"].toLowerCase();
      tint = tintOf(color);
    } else {
      if (row["Szín"] !== "") issue("warning", "foglalkozastipusok", row.sheetRow, MSG.color(row["Szín"]));
      ({ color, tint } = FALLBACK_PALETTE[paletteIndex++ % FALLBACK_PALETTE.length]);
    }
    const id = uniqueId(slugify(name) || "foglalkozas", ids);
    const activity = { id, name, color, tint, key };
    activities.push(activity);
    byKey.set(key, activity);
  }
  return activities;
}

// ---------------------------------------------------------------------------
// Colours (SPEC §3.6)

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

// WCAG contrast ratio of two #rrggbb colours.
export function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, b] = hexToRgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// 18 % of the colour mixed into white; lighter if ink text would drop below 4.5:1.
export function tintOf(color) {
  const rgb = hexToRgb(color);
  for (let share = TINT_SHARE; share > 0; share -= 0.01) {
    const tint = rgbToHex(rgb.map((v) => v * share + 255 * (1 - share)));
    if (contrast(INK, tint) >= MIN_CONTRAST) return tint;
  }
  return "#ffffff";
}

// Distinct names can share a slug ("A-B" and "A B"); keep ids unique.
function uniqueId(base, ids) {
  let id = base;
  for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
  ids.add(id);
  return id;
}

function readItems(rows, { periods, classes, activities }, issue) {
  const periodNumbers = new Set(periods.map((p) => p.n));
  const grades = new Set(classes.map((c) => c.split(".")[0]));
  const activityByKey = new Map(activities.map((a) => [a.key, a]));
  const items = [];
  const seen = new Set();

  for (const row of rows) {
    const shown = parseBool(row["Megjelenik"], true);
    if (!shown.value) continue;

    const errors = [];
    const day = DAY_ALIASES[norm(row["Nap"])];
    if (row["Nap"] === "") errors.push(MSG.missing("Nap"));
    else if (!day) errors.push(MSG.day(row["Nap"]));

    const readPeriod = (col) => {
      const v = row[col];
      if (v === "") errors.push(MSG.missing(col));
      else if (!INT_RE.test(v) || !periodNumbers.has(Number(v))) errors.push(MSG.period(v));
      else return Number(v);
      return null;
    };
    const first = readPeriod("Első óra");
    const last = readPeriod("Utolsó óra");
    if (first !== null && last !== null && last < first) errors.push(MSG.range());

    const activity = activityByKey.get(norm(row["Foglalkozás"]));
    if (row["Foglalkozás"] === "") errors.push(MSG.missing("Foglalkozás"));
    else if (!activity) errors.push(MSG.activity(row["Foglalkozás"]));

    const targets = [];
    const parts = row["Célcsoport"].split(/[,;]/).map(clean).filter(Boolean);
    if (!parts.length) errors.push(MSG.targetEmpty());
    for (const part of parts) {
      const t = normTarget(part);
      const known = GRADE_RE.test(t) ? grades.has(t) : CLASS_RE.test(t) && classes.includes(t);
      if (!known) errors.push(MSG.target(part));
      else if (!targets.includes(t)) targets.push(t);
    }

    if (errors.length) {
      for (const m of errors) issue("error", "foglalkozasok", row.sheetRow, m);
      continue;
    }

    const uncertain = parseBool(row["Bizonytalan"], false);
    if (shown.invalid) issue("warning", "foglalkozasok", row.sheetRow, MSG.bool(row["Megjelenik"], boolWord(true)));
    if (uncertain.invalid) issue("warning", "foglalkozasok", row.sheetRow, MSG.bool(row["Bizonytalan"], boolWord(false)));

    const key = JSON.stringify([day, first, last, activity.id, row["Tanár"], row["Terem"], [...targets].sort()]);
    if (seen.has(key)) {
      issue("warning", "foglalkozasok", row.sheetRow, MSG.duplicate());
      continue;
    }
    seen.add(key);
    items.push({
      day,
      first,
      last,
      activityId: activity.id,
      activity: activity.name,
      teacher: row["Tanár"],
      room: row["Terem"],
      targets,
      uncertain: uncertain.value,
      note: row["Megjegyzés"],
      sheetRow: row.sheetRow,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Queries

// A row reaches class "g.x" when its targets contain the grade "g" or "g.x"
// itself (SPEC §3.3): "6" reaches 6.a, 6.b and 6.m; "7.m" only 7.m.
export function reachesClass(item, cls) {
  const grade = String(cls).split(".")[0];
  return item.targets.includes(grade) || item.targets.includes(cls);
}

export function itemsForClass(model, cls) {
  return model.items.filter((item) => reachesClass(item, cls));
}

// The lessons an item covers, in the order of the Órák tab.
export function lessonsOf(model, item) {
  return model.periods.filter((p) => p.n >= item.first && p.n <= item.last).map((p) => p.n);
}

// Published-CSV URL of one tab (SPEC §3).
export function csvUrl(config, tab) {
  return `https://docs.google.com/spreadsheets/d/e/${config.PUB_ID}/pub?gid=${config.GIDS[tab]}&single=true&output=csv`;
}
