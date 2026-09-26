import { test } from "node:test";
import assert from "node:assert/strict";
import { summaryText } from "../src/summary.js";
import { sampleTables, buildOk, row, withActivities } from "./helpers.mjs";

const sample = buildOk(sampleTables());

test("4.a, all activities (SPEC §6.4 plus the remaining lines)", () => {
  assert.equal(
    summaryText(sample, "4.a", "all"),
    [
      "4.a – délutáni művészeti foglalkozások, 2026/2027",
      "• Színjátszás: hétfő 9. óra (15:30–16:00), Réka, kistorna",
      "• Modern tánc: kedd 8–9. óra (14:45–16:00), Juli, nagytornaterem",
      "• Képzőművészet: kedd 9–10. óra (15:30–16:45), Lotti, rajzstúdió (?)",
      "• Néptánc: szerda 8. óra (14:45–15:30), Andrea, kistorna",
      "• Kerámia: csütörtök 7–8. óra (14:00–15:30), Amy, a/1./kerámia (?)",
      "• Színpadi tánc: csütörtök 8–9. óra (14:45–16:00), Ábel, nagytornaterem",
      "(?) = bizonytalan adat, az iskolával ellenőrizendő.",
    ].join("\n"),
  );
});

test("activityId defaults to all", () => {
  assert.equal(summaryText(sample, "4.a"), summaryText(sample, "4.a", "all"));
});

test("filtered summary: only that activity, footnote only if it has (?)", () => {
  assert.equal(
    summaryText(sample, "4.a", "modern-tanc"),
    "4.a – délutáni művészeti foglalkozások, 2026/2027\n• Modern tánc: kedd 8–9. óra (14:45–16:00), Juli, nagytornaterem",
  );
  assert.equal(
    summaryText(sample, "4.a", "kepzomuveszet"),
    [
      "4.a – délutáni művészeti foglalkozások, 2026/2027",
      "• Képzőművészet: kedd 9–10. óra (15:30–16:45), Lotti, rajzstúdió (?)",
      "(?) = bizonytalan adat, az iskolával ellenőrizendő.",
    ].join("\n"),
  );
});

test("groups on several days are joined with '; ', empty teacher and room are omitted", () => {
  assert.equal(
    summaryText(sample, "1.a", "nyitott-vilag"),
    "1.a – délutáni művészeti foglalkozások, 2026/2027\n• Nyitott világ: hétfő 7. óra (14:00–14:45); kedd 7. óra (14:00–14:45)",
  );
});

test("an activity with no slots for the class gives only the heading", () => {
  assert.equal(summaryText(sample, "4.a", "balett"), "4.a – délutáni művészeti foglalkozások, 2026/2027");
  assert.equal(summaryText(sample, "4.a", "nincs-ilyen"), "4.a – délutáni művészeti foglalkozások, 2026/2027");
});

test("range merging: consecutive lessons merge, gaps are joined with ', '", () => {
  const model = buildOk(
    withActivities(
      row({ "Első óra": "7", "Utolsó óra": "8" }),
      row({ "Első óra": "10", "Utolsó óra": "10" }),
      row({ Nap: "Kedd", "Első óra": "7", "Utolsó óra": "7" }),
      row({ Nap: "Kedd", "Első óra": "9", "Utolsó óra": "9" }),
    ),
  );
  assert.equal(
    summaryText(model, "1.a", "balett"),
    "1.a – délutáni művészeti foglalkozások, 2026/2027\n" +
      "• Balett: hétfő 7–8. óra (14:00–15:30), 10. óra (16:00–16:45), Juli, balett; kedd 7. óra (14:00–14:45), 9. óra (15:30–16:00), Juli, balett",
  );
});

test("same day, different teacher or room: separate groups ordered by first lesson", () => {
  const model = buildOk(
    withActivities(
      row({ "Első óra": "9", "Utolsó óra": "9", Tanár: "Réka" }),
      row({ "Első óra": "7", "Utolsó óra": "8", Bizonytalan: "igen" }),
      row({ "Első óra": "9", "Utolsó óra": "9", Terem: "kistorna" }),
    ),
  );
  assert.equal(
    summaryText(model, "1.b", "balett"),
    [
      "1.b – délutáni művészeti foglalkozások, 2026/2027",
      "• Balett: hétfő 7–8. óra (14:00–15:30), Juli, balett (?); hétfő 9. óra (15:30–16:00), Juli, kistorna; hétfő 9. óra (15:30–16:00), Réka, balett",
      "(?) = bizonytalan adat, az iskolával ellenőrizendő.",
    ].join("\n"),
  );
});

test("an empty tanév leaves no dangling comma", () => {
  const model = { ...sample, settings: { ...sample.settings, tanev: "" } };
  assert.equal(summaryText(model, "4.a", "balett"), "4.a – délutáni művészeti foglalkozások");
});
