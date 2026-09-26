// Print page (SPEC 1.1 §6.4): an A4 landscape page that only print media show
// (css/print.css). Rebuilt from the current selection on every change and
// again right before printing. Sheet text via textContent only (src/dom.js).

import { el, setColor } from "./dom.js";
import { countLabel, printLayout, schoolYearLabel, selectionTitle, timeRange } from "./state.js";

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

function card(model, entry, activity, column) {
  const { item } = entry;
  const node = el(
    "div",
    { class: entry.lanes > 1 ? "pp-card pp-split" : "pp-card" },
    entry.choice ? el("span", { class: "pp-choice", text: PRINT_COPY.choice }) : null,
    el("span", { class: "pp-name" }, item.activity, item.uncertain ? el("span", { class: "pp-uncertain", text: " ?" }) : null),
    el("span", { class: "pp-time", text: timeRange(model, item) }),
    item.teacher || item.room
      ? el(
          "span",
          { class: "pp-meta" },
          item.teacher ? el("span", { class: "pp-teacher", text: item.teacher }) : null,
          item.room ? el("span", { class: "pp-room", text: item.room }) : null,
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
  layout.days.forEach(({ empty, cards }, d) => {
    empty.forEach((r) => node.append(place(el("div", { class: "pp-empty" }), d + 2, r + 2)));
    cards.forEach((entry) => node.append(card(model, entry, activities.get(entry.item.activityId), d + 2)));
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
