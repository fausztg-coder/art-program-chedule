# Hunyadi művészeti órarend

This is a static site that shows a primary school's afternoon arts timetable per class. The data comes from a published Google Sheet (CSV), with a committed snapshot as the fallback. **Read `SPEC.md` fully before writing code.** It is the source of truth.

## Rules

- There is no build step, no npm dependencies and no frameworks. Use plain HTML, CSS and ES modules, and only relative URLs, because the site is served under a GitHub Pages sub-path.
- `src/csv.js`, `src/model.js` and `src/summary.js` are pure and shared by the browser and Node. Keep them free of DOM and Node APIs.
- UI copy is Hungarian and must match SPEC §7 exactly. Code, comments and commits are in English.
- Do not edit `data/sample/`, `data/template/` or `reference/`. The golden fixture `tests/fixtures/expected-slots.json` is authoritative. If your output differs from it, the code is wrong.
- Never hard-code activities, classes, periods or data fixes. The school fixes data in the Sheet.
- `reference/prototype.html` is the approved design. Match it, apart from the deltas in SPEC §6.6.

## Commands

```bash
node --test                                        # all tests, offline
node scripts/snapshot.mjs --from-dir data/sample   # rebuild data/snapshot.json from sample CSVs
node scripts/snapshot.mjs --check                  # validate the live Sheet, write nothing
python3 -m http.server 8000                        # then open http://localhost:8000/?forras=minta
```

## Workflow

Work through the milestones in SPEC §13 in order. Finish each with `node --test` green and a short commit. Milestone 5 needs the Sheet's `PUB_ID` and GIDs from the owner. Ask for them rather than guessing, and run the CORS check (SPEC §5.3) before relying on live fetches.

## Definition of done

All acceptance criteria in SPEC §14 pass, the README.md (Hungarian) is written, and the Pages workflow deploys from `main`.
