// Start-up, selection state and event wiring for index.html (SPEC 1.1 §4–§5).

import config from "../config.js";
import { loadData, pickMode } from "./load.js";
import { renderPrintPage } from "./print-view.js";
import { renderClassChips, renderDataStates, renderDisciplineChips, renderResults } from "./render.js";
import { chooseClass, clearDisciplines, loadChoice, printTitle, resolveChoice, saveChoice, toggleDiscipline } from "./state.js";

const $ = (id) => document.getElementById(id);

let model = null;
let sel = null;
const openNotes = new Set(); // sheet rows whose note is shown
const focusOpened = new Set(); // notes opened by keyboard focus, closed again on blur

function resultElements() {
  return {
    title: $("resultTitle"),
    count: $("resultCount"),
    pdfButton: $("pdfButton"),
    pdfNote: $("pdfNote"),
    listHead: $("listHead"),
    days: $("days"),
    empty: $("empty"),
  };
}

// Chips are rebuilt on every change, so keyboard focus moves to the new chip
// with the same action and value.
function focusedControl() {
  const node = document.activeElement;
  if (!node || !node.dataset || !node.dataset.action || node.dataset.action === "note") return null;
  return `[data-action="${node.dataset.action}"][data-value="${CSS.escape(node.dataset.value || "")}"]`;
}

function render() {
  const focus = focusedControl();
  renderClassChips($("classChips"), model, sel);
  renderDisciplineChips($("disciplineChips"), model, sel);
  renderResults(resultElements(), model, sel, openNotes);
  renderPrintPage($("printPage"), model, sel);
  saveChoice(sel);
  if (focus) document.querySelector(focus)?.focus();
}

function update(next) {
  const same = next.cls === sel.cls && next.disciplines.join() === sel.disciplines.join();
  if (same) return;
  sel = next;
  render();
}

// "?" of an uncertain row (§4.6): the note is shown or hidden in place.
function setNote(key, open) {
  if (open) openNotes.add(key);
  else openNotes.delete(key);
  const button = document.querySelector(`button[data-action="note"][data-value="${CSS.escape(key)}"]`);
  const note = document.getElementById(`note-${key}`);
  if (button) button.setAttribute("aria-expanded", String(open));
  if (note) note.hidden = !open;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !model) return;
  const { action, value } = button.dataset;
  if (action === "class") update(chooseClass(model, sel, value || null));
  else if (action === "discipline") update(toggleDiscipline(model, sel, value));
  else if (action === "disciplines-all") update(clearDisciplines(sel));
  else if (action === "note") {
    // A note opened by focus stays open (pinned); otherwise the click toggles it.
    if (focusOpened.delete(value)) return;
    setNote(value, !openNotes.has(value));
  }
  else if (action === "print") {
    beforePrint();
    window.print();
  }
});

// Printing (SPEC §6.2): the print page is rebuilt from the current selection,
// and the document title (the PDF's title and file name) becomes the result
// title until printing ends. Ctrl+P and the browser menu go through
// beforeprint too; matchMedia covers browsers that do not fire it.
let screenTitle = null;

function beforePrint() {
  if (!model) return;
  renderPrintPage($("printPage"), model, sel);
  if (screenTitle === null) screenTitle = document.title;
  document.title = sel.cls ? printTitle(model, sel) : screenTitle;
}

function afterPrint() {
  if (screenTitle === null) return;
  document.title = screenTitle;
  screenTitle = null;
}

// The print page is measured to fit (print-view.js); once the web fonts are
// in, measure again with them.
document.fonts?.ready.then(() => model && renderPrintPage($("printPage"), model, sel));

window.addEventListener("beforeprint", beforePrint);
window.addEventListener("afterprint", afterPrint);
window.matchMedia?.("print").addEventListener?.("change", (event) => (event.matches ? beforePrint() : afterPrint()));

// Keyboard focus shows the note too (§4.6); a tap does not count as keyboard
// focus (:focus-visible), so the tap's click alone toggles it.
document.addEventListener("focusin", (event) => {
  const button = event.target.closest?.('button[data-action="note"]');
  if (!button || !button.matches(":focus-visible")) return;
  const key = button.dataset.value;
  if (openNotes.has(key)) return;
  focusOpened.add(key);
  setNote(key, true);
});

document.addEventListener("focusout", (event) => {
  const button = event.target.closest?.('button[data-action="note"]');
  if (!button) return;
  const key = button.dataset.value;
  if (focusOpened.delete(key)) setNote(key, false);
});

async function start() {
  const main = document.querySelector("main");
  try {
    const result = await loadData(config, { mode: pickMode(config, location.search) });
    if (result.fallbackReason) console.warn(`Showing the snapshot: ${result.fallbackReason}`);
    model = result.model;
    sel = resolveChoice(model, { search: location.search, stored: loadChoice() });
    renderDataStates(
      {
        banners: $("banners"),
        bannerSnapshot: $("bannerSnapshot"),
        bannerNotice: $("bannerNotice"),
        issues: $("issues"),
        issuesSummary: $("issuesSummary"),
        issuesList: $("issuesList"),
        issuesReport: $("issuesReport"),
      },
      model,
      result,
    );
    render();
    $("content").hidden = false;
  } catch (err) {
    // Also covers a snapshot that loads but cannot be rendered.
    console.error(`Timetable could not be loaded: ${err.message}`);
    model = null;
    $("content").hidden = true;
    $("fatal").hidden = false;
  } finally {
    $("loading").hidden = true;
    main.removeAttribute("aria-busy");
  }
}

start();
