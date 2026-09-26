// Screen DOM (SPEC 1.1 §4). Text from the Sheet only ever goes in through
// textContent and setAttribute (CLAUDE.md): there is no innerHTML here.

import { el, setColor } from "./dom.js";
import { TAB_NAMES } from "./model.js";
import {
  choiceItems,
  classRows,
  countLabel,
  groupByDay,
  periodLabel,
  selectionTitle,
  targetParts,
  timeRange,
  visibleItems,
} from "./state.js";

// UI copy (SPEC 1.1 §4–§5; "Bizonytalan adat" and "Hibát jelezz:" from 1.0).
export const COPY = {
  all: "Összes",
  choice: "Választható",
  uncertain: "Bizonytalan adat",
  bannerSnapshot: (date) => `Az órarend nem frissült, a ${date} állapotot látod.`,
  issuesSummary: (n) => `Adathibák (${n})`,
  issue: (tab, row, message) => `${tab}, ${row}. sor: ${message}`,
  report: "Hibát jelezz: ",
  // Screen-reader labels for the row fields (the column headings are aria-hidden).
  teacher: "Tanár: ",
  room: "Terem: ",
  classes: "Osztály: ",
};

const EMAIL_RE = /^[^\s@<>":?&/]+@[^\s@<>":?&/]+\.[^\s@<>":?&/]+$/;
const SVG_NS = "http://www.w3.org/2000/svg";

// Line icons from the design files, 24 × 24.
const ICONS = {
  check: { width: 2.6, shapes: [["path", { d: "M5 12l5 5L20 7" }]] },
  person: { width: 1.8, shapes: [["circle", { cx: "12", cy: "8", r: "4" }], ["path", { d: "M4 21c0-4 4-6 8-6s8 2 8 6" }]] },
  pin: {
    width: 1.8,
    shapes: [["path", { d: "M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" }], ["circle", { cx: "12", cy: "9", r: "2.5" }]],
  },
};

function icon(name, className) {
  const { width, shapes } = ICONS[name];
  const svg = document.createElementNS(SVG_NS, "svg");
  const attrs = {
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": String(width),
    "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false",
  };
  if (className) attrs.class = className;
  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value);
  for (const [tag, shapeAttrs] of shapes) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(shapeAttrs)) shape.setAttribute(key, value);
    svg.append(shape);
  }
  return svg;
}

// ---------------------------------------------------------------------------
// Selectors (§4.5.2–3)

function chip({ action, value = "", label, pressed, dot, check, discipline }) {
  const button = el("button", {
    type: "button",
    class: discipline ? "chip chip-discipline" : "chip",
    "data-action": action,
    "data-value": value,
    "aria-pressed": String(pressed),
  });
  if (check && pressed) button.append(icon("check", "check"));
  if (dot) {
    const mark = el("span", { class: "dot", "aria-hidden": "true" });
    setColor(mark, "--dot", dot);
    button.append(mark);
  }
  button.append(el("span", { class: "chip-label", text: label }));
  return button;
}

// "Összes", then the classes. The grade rows only show below 768 px; on wider
// screens they dissolve into one wrapping row (display: contents).
export function renderClassChips(container, model, sel) {
  const rows = classRows(model).map(({ grade, classes }) =>
    el(
      "div",
      { class: "grade-row" },
      el("span", { class: "grade-label", "aria-hidden": "true", text: `${grade}.` }),
      classes.map((cls) => chip({ action: "class", value: cls, label: cls, pressed: sel.cls === cls })),
    ),
  );
  container.replaceChildren(chip({ action: "class", label: COPY.all, pressed: sel.cls === null }), ...rows);
}

// "Összes", then every activity of the Foglalkozástípusok tab, in its order.
export function renderDisciplineChips(container, model, sel) {
  const none = sel.disciplines.length === 0;
  container.replaceChildren(
    chip({ action: "disciplines-all", label: COPY.all, pressed: none, check: true, discipline: true }),
    ...model.activities.map((activity) =>
      chip({
        action: "discipline",
        value: activity.id,
        label: activity.name,
        pressed: sel.disciplines.includes(activity.id),
        dot: activity.color,
        check: true,
        discipline: true,
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Result header and list (§4.5.4–7, §4.6)

// Class column: each part kept whole, so the narrow column wraps between them.
function classCell(targets) {
  const parts = targetParts(targets);
  const children = [el("span", { class: "sr-only", text: COPY.classes })];
  parts.forEach((part, i) => {
    if (i) children.push(" ");
    children.push(el("span", { class: "target", text: i < parts.length - 1 ? `${part},` : part }));
  });
  return el("div", { class: "item-class" }, children);
}

function itemRow(model, item, activity, isChoice, openNotes) {
  const key = String(item.sheetRow);
  const noteId = `note-${key}`;
  const hasNote = item.uncertain && item.note !== "";
  const open = hasNote && openNotes.has(key);

  const pill = el(
    "span",
    { class: "pill" },
    el("span", { class: "dot", "aria-hidden": "true" }),
    el("span", { class: "pill-name", text: item.activity }),
  );
  setColor(pill, "--tint", activity.tint);
  setColor(pill, "--dot", activity.color);
  if (item.uncertain) {
    pill.append(
      hasNote
        ? el("button", {
            type: "button",
            class: "uncertain-btn",
            "data-action": "note",
            "data-value": key,
            "aria-label": COPY.uncertain,
            "aria-expanded": String(open),
            "aria-controls": noteId,
            "aria-describedby": noteId,
            text: "?",
          })
        : el("span", { class: "uncertain-mark", role: "img", "aria-label": COPY.uncertain, text: "?" }),
    );
  }

  const meta =
    item.teacher || item.room
      ? el(
          "div",
          { class: "item-meta" },
          item.teacher
            ? el("span", { class: "meta meta-teacher" }, icon("person"), el("span", { class: "sr-only", text: COPY.teacher }), el("span", { text: item.teacher }))
            : null,
          item.room
            ? el("span", { class: "meta meta-room" }, icon("pin"), el("span", { class: "sr-only", text: COPY.room }), el("span", { text: item.room }))
            : null,
        )
      : null;

  return el(
    "li",
    { class: item.uncertain ? "item uncertain" : "item", "aria-describedby": hasNote ? noteId : null },
    el(
      "div",
      { class: "item-time" },
      el("span", { class: "time", text: timeRange(model, item) }),
      el("span", { class: "lessons", text: periodLabel(item) }),
    ),
    el("div", { class: "item-discipline" }, pill, isChoice ? el("span", { class: "choice-pill", text: COPY.choice }) : null),
    meta,
    classCell(item.targets),
    hasNote ? el("p", { class: "item-note", id: noteId, hidden: !open, text: item.note }) : null,
  );
}

// els: { title, count, pdfButton, pdfNote, listHead, days, empty }
export function renderResults(els, model, sel, openNotes) {
  const items = visibleItems(model, sel);
  els.title.textContent = selectionTitle(model, sel);
  els.count.textContent = countLabel(items.length);

  // §6.1: usable only with one class; the note explains the disabled state.
  const canPrint = sel.cls !== null;
  els.pdfButton.disabled = !canPrint;
  els.pdfNote.hidden = canPrint;
  if (canPrint) els.pdfButton.removeAttribute("aria-describedby");
  else els.pdfButton.setAttribute("aria-describedby", els.pdfNote.id);

  els.listHead.hidden = items.length === 0;
  els.empty.hidden = items.length > 0;
  const marked = choiceItems(model, sel, items);
  const activities = new Map(model.activities.map((a) => [a.id, a]));
  els.days.replaceChildren(
    ...groupByDay(model, items).map(({ day, items: dayItems }) =>
      el(
        "section",
        { class: "day" },
        el("h3", { class: "day-title", text: day.name }),
        el(
          "ul",
          { class: "day-items" },
          dayItems.map((item) => itemRow(model, item, activities.get(item.activityId), marked.has(item), openNotes)),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Data states (§4.7)

const pad = (n) => String(n).padStart(2, "0");

// "YYYY. MM. DD." in the viewer's time zone.
export function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}.`;
}

// els: { banners, bannerSnapshot, bannerNotice, issues, issuesSummary, issuesList, issuesReport }
export function renderDataStates(els, model, { fallbackReason }) {
  const date = formatDate(model.generatedAt);
  els.bannerSnapshot.hidden = !(fallbackReason && date);
  els.bannerSnapshot.textContent = els.bannerSnapshot.hidden ? "" : COPY.bannerSnapshot(date);
  const notice = model.settings.kozlemeny || "";
  els.bannerNotice.textContent = notice;
  els.bannerNotice.hidden = !notice;
  els.banners.hidden = els.bannerSnapshot.hidden && els.bannerNotice.hidden;

  const issues = model.issues;
  els.issues.hidden = issues.length === 0;
  els.issuesSummary.textContent = COPY.issuesSummary(issues.length);
  els.issuesList.replaceChildren(
    ...issues.map((i) => el("li", { text: COPY.issue(TAB_NAMES[i.tab] || i.tab, i.row, i.message) })),
  );
  const contact = (model.settings.hibabejelentes || "").trim();
  const address = contact.replace(/^mailto:/i, "");
  els.issuesReport.hidden = !contact;
  els.issuesReport.replaceChildren(
    ...(contact
      ? [COPY.report, EMAIL_RE.test(address) ? el("a", { href: `mailto:${address}`, text: contact }) : contact]
      : []),
  );
}
