// Rendering and event wiring for index.html.

import config from "../config.js";
import { slotsForClass } from "./model.js";
import { summaryText } from "./summary.js";
import {
  ALL,
  activityCounts,
  classesOfGrade,
  gradesOf,
  loadStored,
  persist,
  readQuery,
  resolveSelection,
  selectActivity,
  selectClass,
  selectGrade,
} from "./state.js";

// UI copy (SPEC §7).
const COPY = {
  all: "Mind",
  count: (n) => `${n} óra`,
  choice: "Választható",
  uncertain: "Bizonytalan adat",
  why: "Miért bizonytalan?",
  note: "Megjegyzés",
  dayEmpty: "Nincs foglalkozás.",
  copy: "Szöveg másolása",
  copied: "Kimásolva",
  copyFallback: "Kijelölve, másold ki",
  footerSnapshot: (when) => `Pillanatkép, ${when}.`,
};

const COPIED_MS = 1800;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const $ = (id) => document.getElementById(id);
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
const pad = (n) => String(n).padStart(2, "0");

let model = null;
let sel = null;
let activityIndex = new Map(); // activity id → display order
let activityById = new Map();
let slotIndex = new Map(); // slot object → index in model.slots (stable note ids)
const openNotes = new Set(); // slot indexes whose note is expanded
let copyTimer = 0;

// ---------------------------------------------------------------------------
// Data

async function loadSnapshot() {
  const res = await fetch(config.SNAPSHOT_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`snapshot: HTTP ${res.status}`);
  const data = await res.json();
  const valid =
    data && data.version === 1 && Array.isArray(data.classes) && data.classes.length > 0 &&
    Array.isArray(data.slots) && Array.isArray(data.activities) && Array.isArray(data.periods) && Array.isArray(data.days);
  if (!valid) throw new Error("snapshot: unexpected format");
  return data;
}

function setModel(data) {
  model = data;
  activityIndex = new Map(model.activities.map((a, i) => [a.id, i]));
  activityById = new Map(model.activities.map((a) => [a.id, a]));
  slotIndex = new Map(model.slots.map((s, i) => [s, i]));
}

// ---------------------------------------------------------------------------
// Rendering

const colorOf = (id) => {
  const color = activityById.get(id)?.color;
  return COLOR_RE.test(color) ? color : "var(--muted)";
};

// YYYY. MM. DD. HH:MM in the viewer's time zone.
function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderStatic() {
  const { iskola, tanev } = model.settings || {};
  $("eyebrow").textContent = [iskola, tanev].filter(Boolean).join(" · ");
  const when = formatDateTime(model.generatedAt);
  $("foot").textContent = when ? COPY.footerSnapshot(when) : "";
}

function renderControls() {
  const grade = sel.cls.split(".")[0];
  $("grades").innerHTML = gradesOf(model)
    .map((g) => `<button type="button" class="seg" aria-pressed="${g === grade}" data-grade="${esc(g)}">${esc(g)}.</button>`)
    .join("");
  $("classes").innerHTML = classesOfGrade(model, grade)
    .map((c) => `<button type="button" class="seg" aria-pressed="${c === sel.cls}" data-cls="${esc(c)}">${esc(c)}</button>`)
    .join("");
  const total = slotsForClass(model, sel.cls).length;
  $("activities").innerHTML =
    chip(ALL, COPY.all, "var(--ink)", total) +
    activityCounts(model, sel.cls)
      .map(({ activity, count }) => chip(activity.id, activity.name, colorOf(activity.id), count))
      .join("");
}

function chip(id, name, color, count) {
  return (
    `<button type="button" class="chip" aria-pressed="${sel.act === id}" data-activity="${esc(id)}">` +
    `<span class="dot" style="--c:${color}" aria-hidden="true"></span>${esc(name)} <span class="n">${COPY.count(count)}</span></button>`
  );
}

// Slots of the selected class per "day|period", ordered by activity, then teacher.
function cellsForClass() {
  const cells = new Map();
  const mine = slotsForClass(model, sel.cls).sort(
    (a, b) =>
      activityIndex.get(a.activityId) - activityIndex.get(b.activityId) ||
      a.teacher.localeCompare(b.teacher, "hu") ||
      a.room.localeCompare(b.room, "hu") ||
      a.sheetRow - b.sheetRow,
  );
  for (const s of mine) {
    const key = `${s.day}|${s.period}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(s);
  }
  return cells;
}

// view: "g" (grid) or "d" (day list); keeps note ids unique across both.
function card(s, view) {
  const i = slotIndex.get(s);
  const dim = sel.act !== ALL && sel.act !== s.activityId;
  const meta = [s.teacher, s.room].filter(Boolean).join(" · ");
  const qmark = s.uncertain ? `<span class="qmark" role="img" aria-label="${COPY.uncertain}" title="${COPY.uncertain}">?</span>` : "";
  let note = "";
  if (s.note) {
    const open = openNotes.has(i);
    const id = `${view}-note-${i}`;
    note =
      `<button type="button" class="c-note-btn" aria-expanded="${open}" aria-controls="${id}" data-note="${i}">${s.uncertain ? COPY.why : COPY.note}</button>` +
      `<p class="c-note" id="${id}"${open ? "" : " hidden"}>${esc(s.note)}</p>`;
  }
  return (
    `<div class="card${s.uncertain ? " unc" : ""}${dim ? " dim" : ""}" style="--c:${colorOf(s.activityId)}">` +
    `<div class="c-name"><span>${esc(s.activity)}</span>${qmark}</div>` +
    (meta ? `<div class="c-meta">${esc(meta)}</div>` : "") +
    `${note}</div>`
  );
}

function cellHTML(list, view) {
  if (!list || !list.length) return "";
  const badge = list.length > 1 ? `<span class="badge">${COPY.choice}</span>` : "";
  return `<div class="cell">${badge}${list.map((s) => card(s, view)).join("")}</div>`;
}

const periodLabel = (p) => `${esc(p.n)}. óra<span class="ptime">${esc(p.from)}–${esc(p.to)}</span>`;

function renderSchedule() {
  const cells = cellsForClass();
  const at = (day, p) => cells.get(`${day.key}|${p.n}`);

  let html = `<thead><tr><th scope="col"><span class="ptime">óra</span></th>`;
  html += model.days.map((d) => `<th scope="col">${esc(d.name)}</th>`).join("");
  html += `</tr></thead><tbody>`;
  for (const p of model.periods) {
    html += `<tr><th scope="row">${periodLabel(p)}</th>`;
    html += model.days.map((d) => `<td>${cellHTML(at(d, p), "g")}</td>`).join("");
    html += `</tr>`;
  }
  $("week").innerHTML = `${html}</tbody>`;

  $("daylist").innerHTML = model.days
    .map((d) => {
      const rows = model.periods.filter((p) => at(d, p));
      const body = rows.length
        ? rows.map((p) => `<div class="slot"><div class="when">${periodLabel(p)}</div>${cellHTML(at(d, p), "d")}</div>`).join("")
        : `<div class="empty">${COPY.dayEmpty}</div>`;
      return `<div class="day"><h2>${esc(d.name)}</h2>${body}</div>`;
    })
    .join("");
}

function renderSummary() {
  $("sumText").textContent = summaryText(model, sel.cls, sel.act);
  resetCopyButton();
}

// Re-rendering replaces the control buttons, so keep keyboard focus on the
// equivalent new button.
function focusedControl() {
  const el = document.activeElement;
  if (!el || !el.dataset) return null;
  for (const key of ["grade", "cls", "activity"]) {
    if (el.dataset[key] !== undefined) return `[data-${key}="${CSS.escape(el.dataset[key])}"]`;
  }
  return null;
}

function render() {
  const focus = focusedControl();
  renderControls();
  renderSchedule();
  renderSummary();
  persist(sel);
  if (focus) document.querySelector(focus)?.focus();
}

// ---------------------------------------------------------------------------
// Interaction

function update(next) {
  if (next.cls === sel.cls && next.act === sel.act) return;
  sel = next;
  render();
}

function toggleNote(i) {
  const open = !openNotes.has(i);
  if (open) openNotes.add(i);
  else openNotes.delete(i);
  for (const btn of document.querySelectorAll(`[data-note="${i}"]`)) btn.setAttribute("aria-expanded", String(open));
  for (const view of ["g", "d"]) {
    const note = $(`${view}-note-${i}`);
    if (note) note.hidden = !open;
  }
}

function setCopyLabel(text, ok) {
  const btn = $("copy");
  btn.textContent = text;
  btn.classList.toggle("ok", ok);
}

function resetCopyButton() {
  clearTimeout(copyTimer);
  setCopyLabel(COPY.copy, false);
  $("copyStatus").textContent = "";
}

function copySummary() {
  const pre = $("sumText");
  const done = () => {
    clearTimeout(copyTimer);
    setCopyLabel(COPY.copied, true);
    $("copyStatus").textContent = COPY.copied;
    copyTimer = setTimeout(resetCopyButton, COPIED_MS);
  };
  const fallback = () => {
    clearTimeout(copyTimer);
    const range = document.createRange();
    range.selectNodeContents(pre);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    setCopyLabel(COPY.copyFallback, false);
    $("copyStatus").textContent = COPY.copyFallback;
  };
  try {
    navigator.clipboard.writeText(pre.textContent).then(done, fallback);
  } catch {
    fallback();
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || !model) return;
  const d = btn.dataset;
  if (d.grade !== undefined) update(selectGrade(model, sel, d.grade));
  else if (d.cls !== undefined) update(selectClass(model, sel, d.cls));
  else if (d.activity !== undefined) update(selectActivity(model, sel, d.activity));
  else if (d.note !== undefined) toggleNote(Number(d.note));
  else if (btn.id === "copy") copySummary();
});

// ---------------------------------------------------------------------------
// Start

async function start() {
  try {
    setModel(await loadSnapshot());
  } catch (err) {
    console.error(err);
    $("loading").hidden = true;
    $("fatal").hidden = false;
    return;
  }
  sel = resolveSelection(model, { query: readQuery(location.search), stored: loadStored() });
  renderStatic();
  render();
  $("loading").hidden = true;
  $("content").hidden = false;
}

start();
