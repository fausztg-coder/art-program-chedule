// Shared test helpers (not a test file: node --test does not pick it up).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCSV } from "../src/csv.js";
import { buildModel, TABS } from "../src/model.js";

const readSample = (tab) => readFileSync(new URL(`../data/sample/${tab}.csv`, import.meta.url), "utf8");

export const sampleTables = () => Object.fromEntries(TABS.map((tab) => [tab, parseCSV(readSample(tab))]));

export const build = (tables) => buildModel(tables, { source: "sample", now: new Date("2026-09-25T02:17:00.123Z") });

export function buildOk(tables) {
  const result = build(tables);
  assert.equal(result.ok, true, `expected ok, got fatal: ${result.fatal}`);
  return result.model;
}

export const HEADER = ["Nap", "Első óra", "Utolsó óra", "Foglalkozás", "Tanár", "Terem", "Célcsoport", "Bizonytalan", "Megjegyzés", "Megjelenik"];
const BASE_ROW = {
  Nap: "Hétfő", "Első óra": "7", "Utolsó óra": "7", Foglalkozás: "Balett", Tanár: "Juli", Terem: "balett",
  Célcsoport: "1", Bizonytalan: "nem", Megjegyzés: "", Megjelenik: "igen",
};

// One Foglalkozások record: a valid default row with some cells overridden.
export const row = (over = {}) => HEADER.map((h) => ({ ...BASE_ROW, ...over })[h]);

// Sample tables with one tab replaced.
export function withTab(tab, rows) {
  const tables = sampleTables();
  tables[tab] = rows;
  return tables;
}

export const withActivities = (...rows) => withTab("foglalkozasok", [HEADER, ...rows]);
