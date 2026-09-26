// Print page (SPEC 1.1 §6.4): an A4 landscape page that only print media show
// (css/print.css). Rebuilt from the current selection on every change and
// again right before printing. Sheet text via textContent only (src/dom.js).

import { el, setColor } from "./dom.js";
import { countLabel, printLayout, schoolYearLabel, selectionTitle, softHyphenate, timeRange } from "./state.js";

export const PRINT_COPY = {
  school: "Hunyadi Mátyás Általános Iskola",
  program: "· Művészeti képzés",
  eyebrow: "MŰVÉSZETI ÓRAREND",
  hour: (n) => `${n}. ÓRA`,
  choice: "VÁLASZTHATÓ",
  uncertainLegend: "? = az adat pontosítás alatt",
  footer: "Hunyadi Mátyás Általános Iskola · Művészeti képzés",
  pickClass: "Válassz egy osztályt a nyomtatáshoz.",
};

// Grid lines: column 1 is the hour column, row 1 the day headers.
function place(node, column, row, span = 1) {
  node.style.gridColumn = String(column);
  node.style.gridRow = span > 1 ? `${row} / span ${span}` : String(row);
  return node;
}

// One "VÁLASZTHATÓ" label per group of side-by-side cards (§6.4 "a kártyák
// tetején"): a slim strip across the whole day column at the top of the
// group's first row, above the lanes; the cards starting there move below it.
function choiceLabel(group, column) {
  return place(el("div", { class: "pp-choice" }, el("span", { text: PRINT_COPY.choice })), column, group.row + 2);
}

// Text in a split card: every word is an inline block (css/print.css), so a
// line breaks between words where it can, and inside a word, at its Hungarian
// syllables (softHyphenate), only when the word alone is wider than the lane.
// tail (the "?" of an uncertain row) goes inside the last word's block: a
// block that wraps takes the lane's full width, so nothing could follow it.
// Only words longer than `letters` get syllable breaks: in a two-lane card
// (about 77 px of text) every name of at most 8 letters fits at 15 px and
// every word of at most 11 letters at 12 px (measured with the print fonts);
// in three or more lanes every word gets them.
const LANE_LETTERS = { name: 8, meta: 11 };

function laneText(value, letters, tail = null) {
  const parts = value.trim().split(/(\s+)/); // words at even indexes, the last one too
  return parts.map((part, i) =>
    i % 2 ? part : el("span", { class: "pp-word" }, softHyphenate(part, letters), i === parts.length - 1 ? tail : null),
  );
}

// A split card (a lane of a shared day column) is about half as wide: it
// leaves out the time, which the hour column already gives, and its words
// break at syllables only (laneText).
function card(model, entry, activity, column, belowLabel) {
  const { item } = entry;
  const split = entry.lanes > 1;
  const budget = (kind) => (entry.lanes > 2 ? 0 : LANE_LETTERS[kind]);
  const text = (value, kind, tail = null) => (split ? laneText(value, budget(kind), tail) : [value, tail]);
  const uncertain = item.uncertain ? el("span", { class: "pp-uncertain", text: " ?" }) : null;
  const classes = ["pp-card", split ? "pp-split" : "", entry.lanes > 2 ? "pp-narrow" : "", belowLabel ? "pp-below-choice" : ""].filter(Boolean);
  const node = el(
    "div",
    { class: classes.join(" ") },
    el("span", { class: "pp-name" }, text(item.activity, "name", uncertain)),
    split ? null : el("span", { class: "pp-time", text: timeRange(model, item) }),
    item.teacher || item.room
      ? el(
          "span",
          { class: "pp-meta" },
          item.teacher ? el("span", { class: "pp-teacher" }, text(item.teacher, "meta")) : null,
          item.room ? el("span", { class: "pp-room" }, text(item.room, "meta")) : null,
        )
      : null,
  );
  place(node, column, entry.row + 2, entry.span);
  // Side-by-side lanes (css/print.css); both are numbers computed here.
  node.style.setProperty("--lane", String(entry.lane));
  node.style.setProperty("--lanes", String(entry.lanes));
  if (activity) {
    setColor(node, "--tint", activity.tint);
    setColor(node, "--dot", activity.color);
  }
  return node;
}

function grid(model, layout) {
  const activities = new Map(model.activities.map((a) => [a.id, a]));
  const node = el("div", { class: "pp-grid" }, el("div", { class: "pp-corner" }));
  node.style.setProperty("--rows", String(layout.periods.length));
  layout.days.forEach(({ day }, d) => node.append(place(el("div", { class: "pp-day", text: day.name }), d + 2, 1)));
  layout.periods.forEach((p, r) =>
    node.append(
      place(
        el(
          "div",
          { class: "pp-hour" },
          el("span", { class: "pp-hour-n", text: PRINT_COPY.hour(p.n) }),
          el("span", { class: "pp-hour-from", text: p.from }),
          el("span", { class: "pp-hour-to", text: p.to }),
        ),
        1,
        r + 2,
      ),
    ),
  );
  layout.days.forEach(({ empty, cards, groups }, d) => {
    empty.forEach((r) => node.append(place(el("div", { class: "pp-empty" }), d + 2, r + 2)));
    const labelled = groups.filter((group) => group.choice);
    // The label comes right before its group's cards (reading order).
    const labelBefore = new Map(labelled.map((group) => [group.cards[0], group]));
    const belowLabel = new Set(labelled.flatMap((group) => group.cards.filter((entry) => entry.row === group.row)));
    cards.forEach((entry) => {
      if (labelBefore.has(entry)) node.append(choiceLabel(labelBefore.get(entry), d + 2));
      node.append(card(model, entry, activities.get(entry.item.activityId), d + 2, belowLabel.has(entry)));
    });
  });
  return node;
}

export function renderPrintPage(container, model, sel) {
  if (!sel.cls) {
    container.replaceChildren(el("p", { class: "pp-message", text: PRINT_COPY.pickClass }));
    return;
  }
  const layout = printLayout(model, sel);
  const count = layout.days.reduce((n, d) => n + d.cards.length, 0);
  const year = schoolYearLabel(model.settings.tanev);
  const parts = [
    el(
      "div",
      { class: "pp-letterhead" },
      el("span", { class: "pp-school", text: PRINT_COPY.school }),
      el("span", { class: "pp-program", text: PRINT_COPY.program }),
      year ? el("span", { class: "pp-year", text: year }) : null,
    ),
    el(
      "div",
      { class: "pp-title" },
      el(
        "div",
        { class: "pp-title-text" },
        el("span", { class: "pp-eyebrow", text: PRINT_COPY.eyebrow }),
        el("h1", { class: "pp-h1", text: selectionTitle(model, sel) }),
      ),
      el("span", { class: "pp-count", text: countLabel(count) }),
    ),
    grid(model, layout),
    layout.uncertain ? el("p", { class: "pp-legend", text: PRINT_COPY.uncertainLegend }) : null,
    el("p", { class: "pp-footer", text: PRINT_COPY.footer }),
  ];
  // replaceChildren would turn a null into the text "null".
  container.replaceChildren(...parts.filter(Boolean));
}
