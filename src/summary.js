// Plain-text weekly summary for one class (SPEC §6.4). Pure: shared by the
// browser and Node.

import { slotsForClass } from "./model.js";

const FOOTNOTE = "(?) = bizonytalan adat, az iskolával ellenőrizendő.";

export function summaryText(model, cls, activityId = "all") {
  const tanev = model.settings.tanev;
  const lines = [`${cls} – délutáni művészeti foglalkozások${tanev ? `, ${tanev}` : ""}`];
  const mine = slotsForClass(model, cls);
  const periodByN = new Map(model.periods.map((p) => [p.n, p]));
  const dayIndex = new Map(model.days.map((d, i) => [d.key, i]));
  const dayName = new Map(model.days.map((d) => [d.key, d.name.toLowerCase()]));
  let anyUncertain = false;

  for (const activity of model.activities) {
    if (activityId !== "all" && activity.id !== activityId) continue;
    const list = mine.filter((s) => s.activityId === activity.id);
    if (!list.length) continue;

    const groups = new Map();
    for (const s of list) {
      const key = JSON.stringify([s.day, s.teacher, s.room]);
      if (!groups.has(key)) groups.set(key, { day: s.day, teacher: s.teacher, room: s.room, slots: [] });
      groups.get(key).slots.push(s);
    }
    const ordered = [...groups.values()]
      .map((g) => ({ ...g, periods: [...new Set(g.slots.map((s) => s.period))].sort((a, b) => a - b) }))
      .sort(
        (a, b) =>
          dayIndex.get(a.day) - dayIndex.get(b.day) ||
          a.periods[0] - b.periods[0] ||
          a.teacher.localeCompare(b.teacher, "hu") ||
          a.room.localeCompare(b.room, "hu"),
      );

    const parts = ordered.map((g) => {
      const ranges = mergeRanges(g.periods).map(([a, b]) => formatRange(a, b, periodByN));
      const extra = [g.teacher, g.room].filter(Boolean).join(", ");
      const uncertain = g.slots.some((s) => s.uncertain);
      if (uncertain) anyUncertain = true;
      return `${dayName.get(g.day)} ${ranges.join(", ")}${extra ? `, ${extra}` : ""}${uncertain ? " (?)" : ""}`;
    });
    lines.push(`• ${activity.name}: ${parts.join("; ")}`);
  }

  if (anyUncertain) lines.push(FOOTNOTE);
  return lines.join("\n");
}

// [7, 8, 10] → [[7, 8], [10, 10]]. Input is sorted and unique.
function mergeRanges(periods) {
  const ranges = [];
  for (const n of periods) {
    const last = ranges[ranges.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else ranges.push([n, n]);
  }
  return ranges;
}

function formatRange(a, b, periodByN) {
  const label = a === b ? `${a}.` : `${a}–${b}.`;
  return `${label} óra (${periodByN.get(a).from}–${periodByN.get(b).to})`;
}
