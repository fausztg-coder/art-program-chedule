# Hunyadi művészeti órarend: developer specification

Version 1.0 · 2026-09-25 · Owner: Gábor Fauszt

This is a static website that shows the afternoon arts programme of Hunyadi Mátyás Általános Iskola (Budapest XIII.) for the 2026/2027 school year. A parent picks a class (e.g. `4.a`) and sees a Monday–Friday × lessons 7–10 grid with every arts activity that applies to that class. Picking an activity highlights it. The data lives in a Google Sheet that the school maintains. The page reads the Sheet's published CSV at runtime and falls back to a snapshot committed in the repo.

This file is self-contained. The Hungarian functional spec (a Claude Docs page) says the same things for non-developers. If the two disagree, this file wins for implementation details.

---

## 1. Goals, non-goals, constraints

**Goals**

- Answer "when and where does my child's class have activity X?" in under 10 seconds on a phone.
- School staff update the timetable by editing a Google Sheet. No deploy is needed.
- A bad edit never breaks the page. Invalid rows are skipped and reported. Structural breakage falls back to the last good snapshot.

**Non-goals (v1):** a teacher view, a room view, sign-up, login, notifications, editing in the page, i18n (the UI is Hungarian only).

**Hard constraints**

- No build step, no npm dependencies, no frameworks. Use plain HTML, CSS and native ES modules. The site must work when served from any static host, including GitHub Pages under a sub-path (`/<repo>/`). Use relative URLs only.
- The Node scripts and tests use Node ≥ 20 built-ins only (`node:test`, `node:assert`, `fetch`, `fs`).
- The model code (CSV parsing, validation, normalization) is shared by the browser and the Node scripts. It must not touch the DOM or Node APIs.
- All user-facing copy is Hungarian and uses the exact strings in §7.
- Never "fix" data in code. Data questions are resolved in the Sheet (see §12).

---

## 2. Repository layout (target)

```
/
├─ index.html              # markup shell, links style.css + src/main.js
├─ style.css               # design tokens (light/dark), layout, components
├─ config.js               # Sheet IDs + runtime options (see §5.1)
├─ src/
│  ├─ csv.js               # RFC 4180 parser
│  ├─ model.js             # buildModel(tables) → { model, issues }  (pure)
│  ├─ load.js              # fetch live CSVs / sample CSVs / snapshot, with timeout + fallback
│  ├─ summary.js           # plain-text summary for a class (+ activity)
│  ├─ state.js             # URL query + localStorage selection state
│  └─ main.js              # rendering + event wiring
├─ data/
│  ├─ snapshot.json        # last known-good model (generated, committed)
│  ├─ sample/*.csv         # the 5 tabs as CSV (identical shape to Google's export) — PROVIDED
│  └─ template/hunyadi-orarend-adatforras.xlsx   # Sheet template for the school — PROVIDED
├─ scripts/
│  └─ snapshot.mjs         # fetch/read CSVs → validate → write data/snapshot.json
├─ tests/
│  ├─ *.test.mjs
│  └─ fixtures/expected-slots.json   # golden output for data/sample — PROVIDED
├─ reference/
│  ├─ prototype.html       # approved visual/UX prototype (embedded data, hash state) — PROVIDED
│  └─ source-timetable.png # the school's original table image — PROVIDED
├─ .github/workflows/pages.yml     # deploy + scheduled snapshot (see §9)
├─ CLAUDE.md
├─ SPEC.md
└─ README.md               # short, Hungarian, for the maintainer (see §10)
```

The files marked PROVIDED already exist. Do not edit `data/sample/*`, `data/template/*` or `reference/*` by hand.

---

## 3. Data source contract (the Google Sheet)

The school uploads `data/template/hunyadi-orarend-adatforras.xlsx` to Google Drive, saves it as a native Google Sheet, and publishes it with *File → Share → Publish to web → Entire document → CSV*. Each tab is then reachable at:

```
https://docs.google.com/spreadsheets/d/e/{PUB_ID}/pub?gid={GID}&single=true&output=csv
```

### 3.1 Tabs and columns

Headers are matched **by name, not by position**. Normalize a header before comparing: NFC, trim, lowercase, strip diacritics, and collapse inner whitespace. So `Első óra`, `elso ora` and ` ELSŐ  ÓRA ` all match. Unknown columns are ignored (for example the template's `Ellenőrzés` formula column). Column order is free.

| Tab (key in config) | One row = | Columns (canonical header) | Required |
|---|---|---|---|
| `foglalkozasok` | one activity on one day over a contiguous lesson range | Nap, Első óra, Utolsó óra, Foglalkozás, Tanár, Terem, Célcsoport, Bizonytalan, Megjegyzés, Megjelenik | Nap, Első óra, Utolsó óra, Foglalkozás, Célcsoport |
| `foglalkozastipusok` | one activity type | Foglalkozás, Szín | Foglalkozás |
| `osztalyok` | one class | Osztály | Osztály |
| `orak` | one lesson slot | Óra, Kezdés, Vége | all |
| `beallitasok` | one setting | Kulcs, Érték | Kulcs |

The required headers must exist on each tab. Otherwise the tab is **structurally invalid**, which is fatal (§5.2).

### 3.2 Cell rules

Trim every cell and apply NFC. A row whose cells are all empty is skipped silently (the template pre-fills formulas down to row 400, and these export as empty strings).

**`foglalkozasok`**

| Column | Rule | Default if empty |
|---|---|---|
| Nap | One of Hétfő, Kedd, Szerda, Csütörtök, Péntek. Case- and diacritic-insensitive. Also accept `H`, `K`, `Sze`, `Sz`, `Cs`, `P`. Internal key: `H`, `K`, `Sz`, `Cs`, `P`. | error |
| Első óra / Utolsó óra | Integer present in `orak.Óra`, with Utolsó ≥ Első. | error |
| Foglalkozás | Must equal (normalized) a `foglalkozastipusok.Foglalkozás`. | error |
| Tanár, Terem | Free text, display only. | `""` |
| Célcsoport | Comma- (or semicolon-) separated list. Each item is either a grade `^[1-8]$` or a class `^[1-8]\.[a-zà-ɏ]+$`. Lowercase the letter part. Tolerate a trailing dot (`5.` → `5`) and inner spaces (`3. a` → `3.a`). A grade must have ≥ 1 class in `osztalyok`, and a class must exist in `osztalyok`. | error |
| Bizonytalan | `igen` / `nem` (also accept `i`, `n`, `yes`, `no`, `x` = igen, `true`, `false`). | `nem` |
| Megjegyzés | Free text. | `""` |
| Megjelenik | Same boolean parsing. | `igen` |

When a row fails, it is skipped and an issue is recorded (§3.4). A row with `Megjelenik = nem` is skipped without an issue.

**`foglalkozastipusok`:** `Szín` must match `^#[0-9a-fA-F]{6}$`. If it is empty or invalid, assign a colour from the fallback palette (§6.5) in row order, and record a warning for an invalid value. Duplicate names: the first one wins, and a warning is recorded. Each activity gets an `id` = slug(name): lowercase, strip diacritics, and replace non-alphanumeric runs with `-` (`Képzőművészet` → `kepzomuveszet`). The display order of activities is the row order.

**`osztalyok`:** each value matches `^[1-8]\.[a-zà-ɏ]+$` after normalization, otherwise a warning is recorded and the row skipped. Keep the row order, then sort by grade, then by letter, for display.

**`orak`:** `Óra` is an integer, and `Kezdés`/`Vége` match `^\d{1,2}:\d{2}$` (zero-pad the hour). Rows must be unique by `Óra`. An invalid row is an error and is skipped. If no valid rows remain, the data is structurally invalid.

**`beallitasok`:** known keys (normalized) are `tanev`, `iskola`, `hibabejelentes` and `kozlemeny`. Unknown keys are ignored.

### 3.3 Expansion and duplicates

Each valid `foglalkozasok` row expands into one **slot** per lesson in `[Első óra … Utolsó óra]`. Two slots are duplicates if they are identical on (day, period, activityId, teacher, room, sorted targets). Keep the first duplicate and record a warning.

### 3.4 Issues

```js
{ level: "error" | "warning", tab: "foglalkozasok", row: 14, message: "Ismeretlen foglalkozás: „Képzö”" }
```

`row` is the **Sheet row number**: the header row is 1, so the first data row is 2. Count by CSV *records*, not text lines, because quoted cells may contain newlines. Messages are Hungarian (§7). Errors mean the row was skipped. Warnings mean the row was kept or adjusted.

### 3.5 Normalized model (also the `data/snapshot.json` format)

```json
{
  "version": 1,
  "generatedAt": "2026-09-25T02:17:00Z",
  "source": "sheet | sample",
  "settings": { "tanev": "2026/2027", "iskola": "…", "hibabejelentes": "", "kozlemeny": "" },
  "days": [{ "key": "H", "name": "Hétfő" }, { "key": "K", "name": "Kedd" }, { "key": "Sz", "name": "Szerda" }, { "key": "Cs", "name": "Csütörtök" }, { "key": "P", "name": "Péntek" }],
  "periods": [{ "n": 7, "from": "14:00", "to": "14:45" }],
  "classes": ["1.a", "1.b"],
  "activities": [{ "id": "kepzomuveszet", "name": "Képzőművészet", "color": "#5b4bb5" }],
  "slots": [{ "day": "K", "period": 7, "activityId": "kepzomuveszet", "activity": "Képzőművészet",
              "teacher": "Lotti", "room": "rajzstúdió", "targets": ["3.b"], "uncertain": false,
              "note": "", "sheetRow": 9 }],
  "issues": []
}
```

**Class matching:** a slot applies to class `g.x` when `targets` contains `"g"` or `"g.x"`.

**Golden test:** `buildModel(data/sample/*.csv)` must produce exactly the slots in `tests/fixtures/expected-slots.json`. That file has 43 slots. Compare the slots order-independently: sort both lists by the JSON string of each slot using plain code-point comparison, not `localeCompare`. Compare the fields `day, period, activity, teacher, room, targets, uncertain, note, sheetRow`. The Robotika row (`Megjelenik = nem`) is correctly absent. This fixture was cross-checked against the approved prototype.

---

## 4. Module APIs

```js
// src/csv.js
parseCSV(text: string): string[][]      // RFC 4180; handles BOM, CRLF/LF, quoted commas/quotes/newlines

// src/model.js  (pure, no I/O)
buildModel(tables: { foglalkozasok: string[][], foglalkozastipusok: string[][], osztalyok: string[][],
                     orak: string[][], beallitasok: string[][] }, { source, now }): 
  { ok: true, model } | { ok: false, fatal: string[] }         // model.issues holds row issues
slotsForClass(model, cls: string): Slot[]
slugify(name: string): string

// src/summary.js
summaryText(model, cls: string, activityId: string | "all"): string

// src/load.js  (browser)
loadData(config, { mode }): Promise<{ model, origin: "live" | "sample" | "snapshot", fallbackReason?: string }>
```

---

## 5. Loading and fallback

### 5.1 `config.js`

```js
export default {
  PUB_ID: "",                   // the "2PACX-…" id from the publish link; empty = not configured yet
  GIDS: { foglalkozasok: "", foglalkozastipusok: "", osztalyok: "", orak: "", beallitasok: "" },
  TIMEOUT_MS: 8000,
  SAMPLE_BASE: "data/sample/",  // used by ?forras=minta
  SNAPSHOT_URL: "data/snapshot.json",
};
```

### 5.2 Algorithm (`loadData`)

1. Pick the mode. The query parameter `?forras=minta` selects the sample CSVs through the full live pipeline (for local development and demos). An empty `PUB_ID` or any empty GID selects snapshot only. Otherwise the mode is live.
2. In live or sample mode, fetch the five CSVs in parallel with `AbortController` and `TIMEOUT_MS` for the whole batch, using `cache: "no-store"`. Then `parseCSV` each one and call `buildModel`.
3. Fall back to the snapshot if any fetch fails, any response is not OK, a body looks like HTML (starts with `<`, which is Google's sign-in or error page), or `buildModel` returns `ok: false`. Keep the reason for the console, and show the snapshot banner (§7).
4. If the snapshot also fails, render the fatal error state (§7). Never show a blank page.

Do not add cache-busting query parameters to the Google URL. Google caches published CSVs for about 5 minutes, which is acceptable.

### 5.3 CORS: verify first

Published Google Sheet CSVs are normally fetchable cross-origin (the request redirects to `*.googleusercontent.com`, which sends `Access-Control-Allow-Origin: *`). **Verify this with a real published sheet before building on it.** When a `PUB_ID` exists, write a tiny `scripts/check-cors.html` that fetches one tab and prints the status, the final URL and the first line. If it fails, implement this alternative behind `config.SOURCE = "gviz"`: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={TAB_NAME}`. This requires "anyone with the link can view" and uses the tab names from §3.1. Record the finding in README.md.

---

## 6. UI

`reference/prototype.html` is the approved look and behaviour. Match its layout, tokens, component styling and interactions. The differences from the prototype are listed in §6.6.

### 6.1 Layout (top to bottom)

1. **Header:** an eyebrow reading `{iskola} · {tanev}` (from settings), then the H1 `Délutáni művészeti foglalkozások`.
2. **Banners** (0–2 of them, stacked): a snapshot/fallback banner (warning style) and a `kozlemeny` banner (neutral style, shown only if non-empty).
3. **Controls card:**
   - Évfolyam: segmented buttons 1–8, only for grades that have ≥ 1 class.
   - Osztály: buttons for the classes of the selected grade.
   - Foglalkozás: chips for "Mind" plus one per activity that has ≥ 1 slot for the selected class, in activity order. Each chip shows a colour dot, the name and `{n} óra`, where n is the slot count.
   - A legend with the "Választható" badge and the uncertainty mark.
4. **Week grid** (≥ 641 px wide): a table with the columns `óra` + Hétfő…Péntek and one row per period, showing `{n}. óra` and `{from}–{to}`. Each cell holds 0–n cards.
5. **Day list** (≤ 640 px wide): one block per day with its non-empty periods. A day with no slots shows `Nincs foglalkozás.` Render both the grid and the list, and toggle them with CSS.
6. **Summary card:** the heading `Összefoglaló`, a `<pre>` with `summaryText`, and a copy button.
7. **Issues panel:** a collapsed `<details>` with the label `Adathibák ({n})`, shown only if `issues.length > 0`. It lists `{tab fül}, {row}. sor: {message}` and, if `hibabejelentes` is set, `Hibát jelezz: {hibabejelentes}` as selectable text with a `mailto:` link.
8. **Footer:** the data origin line (§7).

### 6.2 Cards and cells

- A card shows the activity name, then `teacher · room` (omitting empty parts). It has a 4 px left border in the activity colour and a background of `color-mix(in srgb, <color> 15%, var(--surface))`.
- If `uncertain`, the card has a dashed warning border and a round `?` mark, and a `Miért bizonytalan?` toggle reveals the note. A non-uncertain slot with a note gets a `Megjegyzés` toggle. The toggle uses `aria-expanded`.
- If a cell holds ≥ 2 slots, the badge `Választható` appears above the cards.
- If an activity filter is active, non-matching cards get `opacity: .28`. They are dimmed, never hidden, so that the choices stay visible.
- Cards in a cell are ordered by activity order, then teacher.

### 6.3 Selection state

- URL: `?osztaly=4.a&foglalkozas=kepzomuveszet`. Keep it in sync with `history.replaceState`. `foglalkozas` is optional, and `all` is implied when it is absent.
- On load, the precedence is URL, then `localStorage["hunyadi-orarend"]` (wrap every access in try/catch), then the first class in the list.
- An unknown class falls back to the first class. An activity with no slots for the class falls back to "Mind".
- Changing the grade keeps the letter if the class exists, otherwise it takes the first class of that grade.

### 6.4 Summary text (`summaryText`)

```
4.a – délutáni művészeti foglalkozások, 2026/2027
• Színjátszás: hétfő 9. óra (15:30–16:00), Réka, kistorna
• Modern tánc: kedd 8–9. óra (14:45–16:00), Juli, nagytornaterem
• Képzőművészet: kedd 9–10. óra (15:30–16:45), Lotti, rajzstúdió (?)
(?) = bizonytalan adat, az iskolával ellenőrizendő.
```

- One bullet per activity (only the selected one if a filter is active), in activity order.
- Within an activity, group slots by (day, teacher, room). Merge consecutive periods into ranges. Join several ranges on the same day with `, ` and several groups with `; `. Days are lowercase: hétfő, kedd, szerda, csütörtök, péntek.
- Append ` (?)` to a group if any of its slots is uncertain, and add the footnote line if any `(?)` appears.
- The copy button calls `navigator.clipboard.writeText` inside the click handler. On failure, it selects the `<pre>` text and changes its label to `Kijelölve, másold ki`. On success the label becomes `Kimásolva` for 1.8 s.

### 6.5 Visual system

Take the tokens from the prototype (`:root` light palette, dark palette under `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`). The fonts are Atkinson Hyperlegible (body) and Bricolage Grotesque (headings) from Google Fonts, with system fallbacks. The fallback palette for activities without a colour, in order: `#c0392b #b07a12 #c9a100 #a02f97 #e0507f #5b4bb5 #d7782a #2e9459 #2a73c4 #0f8f8f #7c8794 #8a6d3b`.

**Accessibility:** colour is never the only signal, the page is keyboard operable with a visible focus ring, text contrast is ≥ 4.5:1 in both themes, `prefers-reduced-motion` is respected, the table has `scope` headers, and the controls have group labels.

### 6.6 Differences from the prototype

| Prototype | Production |
|---|---|
| Data embedded in the HTML | Loaded via `loadData` (live → snapshot) |
| Hash state `#4.a~kepzo` | Query `?osztaly=4.a&foglalkozas=kepzomuveszet` |
| Activity keys like `kepzo` | `id = slugify(name)` |
| Hard-coded a/b classes | `osztalyok` tab |
| No banners, no issues panel | §6.1 items 2 and 7 |
| Loading state absent | Skeleton grid + `Betöltés…` until data or fallback |

---

## 7. Copy (exact Hungarian strings)

| Key | Text |
|---|---|
| title (`<title>`) | `Hunyadi művészeti órarend` |
| h1 | `Délutáni művészeti foglalkozások` |
| loading | `Betöltés…` |
| banner.snapshot | `Az órarend most nem frissült. A {YYYY. MM. DD.} állapotot látod.` |
| banner.notConfigured (snapshot-only mode, footer only, no banner) | — |
| fatal | `Az órarend most nem tölthető be. Próbáld újra később.` |
| label.grade / class / activity | `Évfolyam` / `Osztály` / `Foglalkozás` |
| chip.all | `Mind` |
| chip.count | `{n} óra` |
| badge.choice | `Választható` |
| legend.choice | `egy idősávban több foglalkozás van` |
| legend.uncertain | `bizonytalan adat, koppints a kártyán a részletekért` |
| card.why | `Miért bizonytalan?` |
| card.note | `Megjegyzés` |
| day.empty | `Nincs foglalkozás.` |
| summary.heading | `Összefoglaló` |
| summary.copy / done / fallback | `Szöveg másolása` / `Kimásolva` / `Kijelölve, másold ki` |
| issues.summary | `Adathibák ({n})` |
| issues.report | `Hibát jelezz: {hibabejelentes}` |
| footer.live | `Élő adat a Google Táblázatból, betöltve {HH:MM}.` |
| footer.sample | `Mintaadat (fejlesztői mód).` |
| footer.snapshot | `Pillanatkép, {YYYY. MM. DD. HH:MM}.` |
| tab display names (issues) | Foglalkozások, Foglalkozástípusok, Osztályok, Órák, Beállítások |
| err.day | `Ismeretlen nap: „{v}”` |
| err.period | `Ismeretlen óra: „{v}”` |
| err.range | `Az utolsó óra korábbi az elsőnél` |
| err.activity | `Ismeretlen foglalkozás: „{v}”` |
| err.targetEmpty | `Hiányzó célcsoport` |
| err.target | `Ismeretlen évfolyam vagy osztály: „{v}”` |
| err.missing | `Hiányzó kötelező mező: {column}` |
| warn.duplicate | `Ismétlődő sor, kihagyva` |
| warn.color | `Érvénytelen szín: „{v}”, automatikus szín` |
| warn.class | `Érvénytelen osztály: „{v}”` |

---

## 8. `scripts/snapshot.mjs`

```
node scripts/snapshot.mjs                    # live: read config.js, fetch the 5 CSVs, write data/snapshot.json
node scripts/snapshot.mjs --from-dir data/sample   # offline: build from local CSVs (source: "sample")
node scripts/snapshot.mjs --check            # validate only, write nothing, exit code reflects result
```

- Import `config.js`, `src/csv.js` and `src/model.js` as ES modules (the shared code).
- Exit 1 without writing if a fetch fails, `buildModel` returns `ok: false`, or the **sanity guard** trips: the new slot count is below 50 % of the existing snapshot's. The guard catches a half-deleted Sheet. `--force` overrides it.
- Write deterministic JSON (stable key order, 2-space indent, trailing newline). Set `generatedAt` only when the content otherwise changed, so an unchanged Sheet produces no diff.
- Print a one-line summary: `slots=43 activities=12 classes=16 issues=0 changed=yes`.
- The initial `data/snapshot.json` is produced with `--from-dir data/sample` and committed.

---

## 9. GitHub Actions (`.github/workflows/pages.yml`)

Use one workflow with two triggers, because a commit pushed with `GITHUB_TOKEN` does **not** trigger other workflows. A separate snapshot workflow would therefore never cause a redeploy.

```
on: push (branches: [main]) · schedule (cron: "17 2 * * *") · workflow_dispatch
permissions: contents: write, pages: write, id-token: write
jobs:
  snapshot (only on schedule/dispatch, only if config PUB_ID is set):
    checkout → setup-node 20 → node scripts/snapshot.mjs → if git diff: commit "chore(data): snapshot" as github-actions[bot] and push
  test: node --test
  deploy (needs: [snapshot, test]; if: always() && needs.test.result == 'success'):
    checkout (ref: main, fresh, to include the new snapshot) → upload-pages-artifact → deploy-pages
```

When `PUB_ID` is empty, `snapshot.mjs` prints `skipped=not-configured` and exits 0, so the job is a no-op until the Sheet is connected. `if: always()` on deploy is required. Without it, deploy is skipped whenever the snapshot job is skipped (on push) or fails.

If the snapshot step fails (invalid Sheet), the job fails, nothing is committed, and the deploy still runs with the previous snapshot. The repo owner gets GitHub's failure email, which is the alert.

**Known limitation:** GitHub disables scheduled workflows in public repos after 60 days without repo activity. Mention this in README.md with the fix: re-enable the workflow in the Actions tab. Do not add keep-alive hacks.

Exclude from the Pages artifact: `tests/`, `scripts/`, `data/sample/`, `data/template/` (optional, via a staging copy step), `reference/`, `.github/`, `*.md` except README. At minimum, the site must not link to them.

---

## 10. README.md (Hungarian, ≤ 1 screen)

It covers four topics: what the site is, how to connect a Sheet (steps 1–5 of the template's Útmutató tab, plus where to paste `PUB_ID`/GIDs in `config.js`), how to run it locally (`python3 -m http.server`, then `/?forras=minta`), and the CORS finding from §5.3.

---

## 11. Tests (`node --test`)

These must pass without network access.

- `csv.test.mjs`: BOM, CRLF, quoted comma, escaped quote `""`, quoted newline, trailing empty line, empty file.
- `model.test.mjs`:
  - the golden test (§3.5);
  - header normalization (reordered columns, accented or unaccented headers, an extra column);
  - one test per error and warning in §7, each asserting the tab, row and message;
  - a missing required header → `ok: false`;
  - defaults for Bizonytalan and Megjelenik;
  - `Megjelenik = nem` is skipped with no issue;
  - duplicate slot detection;
  - class matching (`"3"` matches `3.a` and `3.b`, `"3.a"` matches only `3.a`);
  - fallback colours;
  - `slugify`.
- `summary.test.mjs`: `4.a` + all equals the text in §6.4 plus the remaining lines (derive the expected text by hand from the fixture); a filtered summary; range merging (`7–8.`, and `7. … 9.` → `7., 9.` when not consecutive).
- `snapshot.test.mjs`: `--from-dir data/sample --check` exits 0. A temp dir with a broken header exits 1. The sanity guard trips.

---

## 12. Data caveats (context only, do not code around them)

The source image had inconsistencies. They were transcribed conservatively and flagged `Bizonytalan = igen`, with a `Megjegyzés`. Examples: the Kerámia target grades, the meaning of `7.m.`/`8.m.` (mapped to whole grades 7 and 8), and lesson 9 lasting 30 minutes (15:30–16:00). The class list (a/b per grade) is an assumption. The school resolves all of these **in the Sheet**. The code must stay data-agnostic: no hard-coded activity names, classes, periods or days beyond the fixed Monday–Friday set.

---

## 13. Milestones (do them in order; each ends green on `node --test`)

1. **Model:** `csv.js`, `model.js`, and `summary.js` with all tests, including the golden test. Then `scripts/snapshot.mjs` and a generated `data/snapshot.json`.
2. **UI on the snapshot:** `index.html`, `style.css` and `main.js` rendering from the snapshot, at visual and behavioural parity with `reference/prototype.html` plus §6.6.
3. **Live pipeline:** `load.js` with sample mode (`?forras=minta`), timeout, the fallback banner, the issues panel, the settings banner and the footer states. Test manually by breaking a copy of the sample CSVs.
4. **CI/CD:** `pages.yml`, README.md.
5. **Go live** (needs the school's `PUB_ID` + GIDs): fill in `config.js`, run the CORS check (§5.3), then trigger `workflow_dispatch` and confirm acceptance criteria 7–10.

---

## 14. Acceptance criteria

1. For any class, the grid shows exactly the (day, lesson) slots whose targets contain the class or its grade.
2. The activity chip highlights its cells and shows the weekly lesson count.
3. A cell with ≥ 2 slots shows `Választható`.
4. Every uncertain slot is visually distinct, and its note is reachable by keyboard and touch.
5. The summary text is copyable and matches the grid.
6. At ≤ 640 px, the day list replaces the grid, and there is no horizontal page scroll at 360 px.
7. A Sheet edit appears after a reload within 10 minutes, with no deploy.
8. An invalid row is skipped and listed in `Adathibák` with its Sheet row number. The rest of the page works.
9. If Google is unreachable, a tab is missing or a header is missing, the page renders from the snapshot and shows its date.
10. The scheduled snapshot never commits invalid data, and a failed snapshot does not block deploys.
11. There are no console errors, Lighthouse accessibility is ≥ 95, and the page works in the latest Chrome, Safari (iOS) and Firefox.
