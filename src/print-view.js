// Print pages: only print media show them (css/print.css). One child: one A4
// landscape sheet with the timetable grid (SPEC 1.1 §6.4). 2–4 children: two
// children per sheet in a compact list (SPEC 1.2 §14.4). Rebuilt from the
// current choice on every change and again right before printing. Sheet text
// via textContent only (src/dom.js).

import { canPrintFamily, childTitle, paginate } from "./children.js";
import { el, setColor } from "./dom.js";
import {
  countLabel,
  periodLabel,
  printLayout,
  printList,
  schoolYearLabel,
  selectionTitle,
  SOFT_HYPHEN,
  softHyphenate,
  timeRange,
} from "./state.js";

export const PRINT_COPY = {
  school: "Hunyadi Mátyás Általános Iskola",
  program: "· Művészeti képzés",
  eyebrow: "MŰVÉSZETI ÓRAREND",
  hour: (n) => `${n}. ÓRA`,
  choice: "VÁLASZTHATÓ",
  uncertainLegend: "? = az adat pontosítás alatt",
  footer: "Hunyadi Mátyás Általános Iskola · Művészeti képzés",
  pickClass: "Válassz egy osztályt a nyomtatáshoz.",
  pickClasses: "Válassz minden gyereknél egy osztályt a nyomtatáshoz.",
  noLesson: "–",
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
// line breaks between words where it can. A word wider than the lane gets its
// Hungarian syllable breaks when the page is measured (fitPrintPage), so it
// breaks as "Képző-művészet"; the others keep no soft hyphen, which would
// split them in the PDF's text layer. tail (the "?" of an uncertain row) goes
// inside the last word's block: a block that wraps takes the lane's full
// width, so nothing could follow it.
function laneText(value, tail = null) {
  const parts = value.trim().split(/(\s+)/); // words at even indexes, the last one too
  return parts.map((part, i) => (i % 2 ? part : el("span", { class: "pp-word" }, part, i === parts.length - 1 ? tail : null)));
}

// A split card (a lane of a shared day column) is about half as wide: it
// leaves out the time, which the hour column already gives, and its words
// break at syllables only (laneText).
function card(model, entry, activity, column, belowLabel) {
  const { item } = entry;
  const split = entry.lanes > 1;
  const text = (value, tail = null) => (split ? laneText(value, tail) : [value, tail]);
  // A no-break space keeps the "?" with the name.
  const uncertain = item.uncertain ? el("span", { class: "pp-uncertain", text: "\u00A0?" }) : null;
  const classes = ["pp-card", split ? "pp-split" : "", entry.lanes > 2 ? "pp-narrow" : "", belowLabel ? "pp-below-choice" : ""].filter(Boolean);
  const node = el(
    "div",
    { class: classes.join(" ") },
    el("span", { class: "pp-name" }, text(item.activity, uncertain)),
    split ? null : el("span", { class: "pp-time", text: timeRange(model, item) }),
    item.teacher || item.room
      ? el(
          "span",
          { class: "pp-meta" },
          item.teacher ? el("span", { class: "pp-teacher" }, text(item.teacher)) : null,
          item.room ? el("span", { class: "pp-room" }, text(item.room)) : null,
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
  // Day by day, so the PDF text reads each day's name, then its lessons (§6.3).
  layout.days.forEach(({ day, empty, cards, groups }, d) => {
    node.append(place(el("div", { class: "pp-day", text: day.name }), d + 2, 1));
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

function letterhead(model) {
  const year = schoolYearLabel(model.settings.tanev);
  return el(
    "div",
    { class: "pp-letterhead" },
    el("span", { class: "pp-school", text: PRINT_COPY.school }),
    el("span", { class: "pp-program", text: PRINT_COPY.program }),
    year ? el("span", { class: "pp-year", text: year }) : null,
  );
}

const footer = (uncertain) => [
  uncertain ? el("p", { class: "pp-legend", text: PRINT_COPY.uncertainLegend }) : null,
  el("p", { class: "pp-footer", text: PRINT_COPY.footer }),
];

// container: #printPage; family: { children, active } (src/children.js).
export function renderPrintPage(container, model, family) {
  if (family.children.length === 1) {
    renderGridSheet(container, model, family.children[0]);
    return;
  }
  if (!canPrintFamily(family)) {
    container.replaceChildren(el("p", { class: "pp-message", text: PRINT_COPY.pickClasses }));
    return;
  }
  renderCompactSheets(container, model, family);
}

// ---------------------------------------------------------------------------
// One child: the timetable grid (SPEC 1.1 §6.4)

function renderGridSheet(container, model, sel) {
  if (!sel.cls) {
    container.replaceChildren(el("p", { class: "pp-message", text: PRINT_COPY.pickClass }));
    return;
  }
  const layout = printLayout(model, sel);
  const count = layout.days.reduce((n, d) => n + d.cards.length, 0);
  const parts = [
    letterhead(model),
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
    ...footer(layout.uncertain),
  ];
  // el() drops the nulls; replaceChildren would turn one into the text "null".
  container.replaceChildren(el("div", { class: "pp-sheet" }, parts));
  fitPrintPage(container);
}

// ---------------------------------------------------------------------------
// 2–4 children: a compact list, two children per sheet (SPEC 1.2 §14.4)

function entry(model, item, activity) {
  const node = el(
    "div",
    { class: "pp-entry" },
    el(
      "span",
      { class: "pp-entry-time" },
      timeRange(model, item),
      " ",
      el("span", { class: "pp-entry-lessons", text: periodLabel(item) }),
    ),
    // A no-break space keeps the "?" with the name.
    el("span", { class: "pp-entry-name", text: item.uncertain ? `${item.activity} ?` : item.activity }),
    item.teacher || item.room
      ? el("span", { class: "pp-entry-meta", text: [item.teacher, item.room].filter(Boolean).join(" · ") })
      : null,
  );
  if (activity) {
    setColor(node, "--tint", activity.tint);
    setColor(node, "--dot", activity.color);
  }
  return node;
}

function block(model, family, index) {
  const list = printList(model, family.children[index]);
  const activities = new Map(model.activities.map((a) => [a.id, a]));
  const entryOf = (item) => entry(model, item, activities.get(item.activityId));
  const days = list.days.map(({ day, parts }) =>
    el(
      "section",
      { class: "pp-col" },
      el("h3", { class: "pp-col-day", text: day.name }),
      parts.length
        ? parts.flatMap((part) =>
            part.choice && part.items.length > 1
              ? el("div", { class: "pp-group" }, el("span", { class: "pp-group-label", text: PRINT_COPY.choice }), part.items.map(entryOf))
              : part.items.map(entryOf),
          )
        : el("span", { class: "pp-none", text: PRINT_COPY.noLesson }),
    ),
  );
  const node = el(
    "section",
    { class: "pp-block" },
    el(
      "div",
      { class: "pp-block-head" },
      el("h2", { class: "pp-block-title", text: childTitle(model, family, index) }),
      el("span", { class: "pp-block-count", text: countLabel(list.count) }),
    ),
    el("div", { class: "pp-cols" }, days),
  );
  return { node, uncertain: list.uncertain };
}

function compactSheets(model, family, pages, full) {
  return pages.map((indexes) => {
    const blocks = indexes.map((i) => block(model, family, i));
    blocks.forEach((b, k) => full[indexes[k]] && b.node.classList.add("pp-block-full"));
    // A lone half-page child leaves the lower half empty (dashed line).
    const spare = indexes.length === 1 && !full[indexes[0]] ? el("section", { class: "pp-block pp-spare", "aria-hidden": "true" }) : null;
    return el(
      "div",
      { class: "pp-sheet pp-compact" },
      letterhead(model),
      blocks.map((b) => b.node),
      spare,
      footer(blocks.some((b) => b.uncertain)),
    );
  });
}

// Laid out off screen at the A4 page area's size (as fitPrintPage does): a
// block whose days do not fit half a page gets the tighter setting, and if
// that is not enough either, a page of its own. Text is never cut off.
function renderCompactSheets(container, model, family) {
  const n = family.children.length;
  const full = Array(n).fill(false);
  container.replaceChildren(...compactSheets(model, family, paginate(full), full));
  container.classList.add("pp-measuring");
  try {
    const blocks = [...container.querySelectorAll(".pp-block:not(.pp-spare)")];
    blocks.forEach((b, i) => {
      if (overflows(b)) b.classList.add("pp-block-tight");
      if (overflows(b)) full[i] = true;
    });
    if (full.some(Boolean)) {
      container.replaceChildren(...compactSheets(model, family, paginate(full), full));
      for (const b of container.querySelectorAll(".pp-block:not(.pp-spare)")) if (overflows(b)) b.classList.add("pp-block-tight");
    }
  } finally {
    container.classList.remove("pp-measuring");
  }
}

// Whether a block's tallest day column is taller than the space it has (the
// columns themselves are stretched to the block, so their content is measured).
function overflows(blockNode) {
  const cols = blockNode.querySelector(".pp-cols");
  const top = cols.getBoundingClientRect().top;
  const need = Math.max(...[...cols.children].map((col) => col.lastElementChild.getBoundingClientRect().bottom - top));
  return need > cols.clientHeight + 0.5;
}

// The page is laid out off screen with the print styles and what does not fit
// is adjusted, so no text is cut off (SPEC §6.4, owner decision 2026-09-26):
// a word wider than its lane gets soft hyphens at its syllables, and a card
// whose text is still too tall gets a tighter setting, in two steps
// (css/print.css). Measured with the fonts the page has at that moment; main.js
// measures again right before printing and once the web fonts have loaded.
export function fitPrintPage(container) {
  if (!container.querySelector(".pp-card")) return;
  container.classList.add("pp-measuring");
  const wraps = (word) => {
    const style = getComputedStyle(word);
    const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3;
    return word.offsetHeight > line * 1.5;
  };
  const textOf = (word) => (word.firstChild && word.firstChild.nodeType === Node.TEXT_NODE ? word.firstChild : null);
  try {
    for (const word of container.querySelectorAll(".pp-word")) {
      const text = textOf(word);
      if (text && wraps(word)) text.data = softHyphenate(text.data);
    }
    for (const card of container.querySelectorAll(".pp-card")) {
      for (const step of ["pp-tight", "pp-tighter"]) {
        if (card.scrollHeight <= card.clientHeight) break;
        card.classList.add(step);
      }
      // A tighter card may fit a hyphenated word on one line after all: its
      // unused soft hyphens would still split it in the PDF's text layer.
      if (!card.matches(".pp-tight")) continue;
      for (const word of card.querySelectorAll(".pp-word")) {
        const text = textOf(word);
        if (!text || !text.data.includes(SOFT_HYPHEN)) continue;
        const hyphenated = text.data;
        text.data = hyphenated.replaceAll(SOFT_HYPHEN, "");
        if (wraps(word)) text.data = hyphenated;
      }
    }
  } finally {
    container.classList.remove("pp-measuring");
  }
}
