// Data model: validates and normalizes the five Sheet tabs. Pure: no DOM, no
// Node APIs, no I/O. Shared by the browser and scripts/snapshot.mjs.

export const MODEL_VERSION = 1;

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

export const FALLBACK_PALETTE = [
  "#c0392b", "#b07a12", "#c9a100", "#a02f97", "#e0507f", "#5b4bb5",
  "#d7782a", "#2e9459", "#2a73c4", "#0f8f8f", "#7c8794", "#8a6d3b",
];

const CLASS_RE = /^[1-8]\.[a-zà-ɏ]+$/;
const GRADE_RE = /^[1-8]$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;
const INT_RE = /^\d+$/;

// Row issue and fatal messages. SPEC §7 strings first; the ones marked
// "not in §7" cover cases the spec does not name a message for.
const MSG = {
  day: (v) => `Ismeretlen nap: „${v}”`,
  period: (v) => `Ismeretlen óra: „${v}”`,
  range: () => "Az utolsó óra korábbi az elsőnél",
  activity: (v) => `Ismeretlen foglalkozás: „${v}”`,
  targetEmpty: () => "Hiányzó célcsoport",
  target: (v) => `Ismeretlen évfolyam vagy osztály: „${v}”`,
  missing: (column) => `Hiányzó kötelező mező: ${column}`,
  duplicate: () => "Ismétlődő sor, kihagyva",
  color: (v) => `Érvénytelen szín: „${v}”, automatikus szín`,
  class: (v) => `Érvénytelen osztály: „${v}”`,
  // not in §7
  bool: (v, fallback) => `Érvénytelen igen/nem érték: „${v}”, helyette „${fallback}”`,
  periodNumber: (v) => `Érvénytelen óra: „${v}”`,
  time: (v) => `Érvénytelen időpont: „${v}”`,
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
  const slots = readSlots(read.foglalkozasok, { periods, classes, activities }, issue);

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
      activities: activities.map(({ id, name, color }) => ({ id, name, color })),
      slots,
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
  const grade = (c) => Number(c.split(".")[0]);
  const letter = (c) => c.split(".")[1];
  return classes.sort((a, b) => grade(a) - grade(b) || letter(a).localeCompare(letter(b), "hu"));
}

function readActivities(rows, issue) {
  const activities = [];
  const byKey = new Map();
  const ids = new Set();
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
    let color = row["Szín"];
    if (COLOR_RE.test(color)) {
      color = color.toLowerCase();
    } else {
      if (color !== "") issue("warning", "foglalkozastipusok", row.sheetRow, MSG.color(color));
      color = FALLBACK_PALETTE[paletteIndex++ % FALLBACK_PALETTE.length];
    }
    const id = uniqueId(slugify(name) || "foglalkozas", ids);
    const activity = { id, name, color, key };
    activities.push(activity);
    byKey.set(key, activity);
  }
  return activities;
}

// Distinct names can share a slug ("A-B" and "A B"); keep ids unique.
function uniqueId(base, ids) {
  let id = base;
  for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
  ids.add(id);
  return id;
}

function readSlots(rows, { periods, classes, activities }, issue) {
  const periodNumbers = new Set(periods.map((p) => p.n));
  const grades = new Set(classes.map((c) => c.split(".")[0]));
  const activityByKey = new Map(activities.map((a) => [a.key, a]));
  const slots = [];
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
    const items = row["Célcsoport"].split(/[,;]/).map(clean).filter(Boolean);
    if (!items.length) errors.push(MSG.targetEmpty());
    for (const item of items) {
      const t = normTarget(item);
      const known = GRADE_RE.test(t) ? grades.has(t) : CLASS_RE.test(t) && classes.includes(t);
      if (!known) errors.push(MSG.target(item));
      else if (!targets.includes(t)) targets.push(t);
    }

    if (errors.length) {
      for (const m of errors) issue("error", "foglalkozasok", row.sheetRow, m);
      continue;
    }

    const uncertain = parseBool(row["Bizonytalan"], false);
    if (shown.invalid) issue("warning", "foglalkozasok", row.sheetRow, MSG.bool(row["Megjelenik"], boolWord(true)));
    if (uncertain.invalid) issue("warning", "foglalkozasok", row.sheetRow, MSG.bool(row["Bizonytalan"], boolWord(false)));

    let duplicate = false;
    for (const period of periods) {
      if (period.n < first || period.n > last) continue;
      const slot = {
        day,
        period: period.n,
        activityId: activity.id,
        activity: activity.name,
        teacher: row["Tanár"],
        room: row["Terem"],
        targets: [...targets],
        uncertain: uncertain.value,
        note: row["Megjegyzés"],
        sheetRow: row.sheetRow,
      };
      const key = JSON.stringify([day, period.n, activity.id, slot.teacher, slot.room, [...targets].sort()]);
      if (seen.has(key)) {
        duplicate = true;
        continue;
      }
      seen.add(key);
      slots.push(slot);
    }
    if (duplicate) issue("warning", "foglalkozasok", row.sheetRow, MSG.duplicate());
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Queries

// A slot applies to class "g.x" when its targets contain "g" or "g.x".
export function slotsForClass(model, cls) {
  const grade = String(cls).split(".")[0];
  return model.slots.filter((s) => s.targets.includes(grade) || s.targets.includes(cls));
}

// Published-CSV URL of one tab (SPEC §3).
export function csvUrl(config, tab) {
  return `https://docs.google.com/spreadsheets/d/e/${config.PUB_ID}/pub?gid=${config.GIDS[tab]}&single=true&output=csv`;
}
