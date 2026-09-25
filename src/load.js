// Data loading with fallback (SPEC §5.2). Uses only fetch, AbortController
// and timers, so Node tests can run it with an injected fetch.

import { parseCSV } from "./csv.js";
import { buildModel, csvUrl, MODEL_VERSION, TABS, TAB_NAMES } from "./model.js";

// "sample" for ?forras=minta, "snapshot" while the Sheet is not configured,
// otherwise "live".
export function pickMode(config, search) {
  if (new URLSearchParams(search).get("forras") === "minta") return "sample";
  const configured = config.PUB_ID && TABS.every((tab) => config.GIDS && config.GIDS[tab]);
  return configured ? "live" : "snapshot";
}

// Resolves to { model, origin, fallbackReason? }. Rejects only when the
// snapshot cannot be loaded either.
export async function loadData(config, { mode, fetch = globalThis.fetch, now = () => new Date() } = {}) {
  let fallbackReason;
  if (mode === "live" || mode === "sample") {
    try {
      const tables = await fetchTables(config, mode, fetch);
      const result = buildModel(tables, { source: mode === "live" ? "sheet" : "sample", now: now() });
      if (result.ok) return { model: result.model, origin: mode };
      fallbackReason = result.fatal.join("; ");
    } catch (err) {
      fallbackReason = err.message;
    }
  }
  let model;
  try {
    model = await fetchSnapshot(config, fetch);
  } catch (err) {
    throw new Error(fallbackReason === undefined ? err.message : `${fallbackReason}; ${err.message}`);
  }
  return fallbackReason === undefined ? { model, origin: "snapshot" } : { model, origin: "snapshot", fallbackReason };
}

// Runs fn(signal) and aborts it after ms.
async function withTimeout(ms, fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`timeout after ${ms} ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// The five CSVs in parallel; one timeout covers the whole batch.
function fetchTables(config, mode, fetch) {
  const url = (tab) => (mode === "live" ? csvUrl(config, tab) : `${config.SAMPLE_BASE}${tab}.csv`);
  return withTimeout(config.TIMEOUT_MS, async (signal) => {
    const texts = await Promise.all(
      TABS.map(async (tab) => {
        const res = await fetch(url(tab), { signal, cache: "no-store" });
        if (!res.ok) throw new Error(`${TAB_NAMES[tab]}: HTTP ${res.status}`);
        const text = await res.text();
        // Google answers with an HTML sign-in or error page when a tab is not published.
        if (text.trimStart().startsWith("<")) throw new Error(`${TAB_NAMES[tab]}: HTML response instead of CSV`);
        return text;
      }),
    );
    return Object.fromEntries(TABS.map((tab, i) => [tab, parseCSV(texts[i])]));
  });
}

function fetchSnapshot(config, fetch) {
  return withTimeout(config.TIMEOUT_MS, async (signal) => {
    const res = await fetch(config.SNAPSHOT_URL, { signal, cache: "no-cache" });
    if (!res.ok) throw new Error(`snapshot: HTTP ${res.status}`);
    const data = await res.json();
    const valid =
      data && data.version === MODEL_VERSION && data.settings && Array.isArray(data.days) && Array.isArray(data.periods) &&
      Array.isArray(data.classes) && data.classes.length > 0 && Array.isArray(data.activities) &&
      Array.isArray(data.slots) && Array.isArray(data.issues);
    if (!valid) throw new Error("snapshot: unexpected format");
    return data;
  });
}
