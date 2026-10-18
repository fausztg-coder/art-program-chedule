// Start-up, selection state and event wiring for index.html (SPEC 1.1 §4–§5,
// SPEC 1.2 §14: several children; the selectors edit the active child).

import config from "../config.js";
import {
  activeChild,
  addChild,
  canPrintFamily,
  familyPrintTitle,
  loadFamily,
  removeChild,
  resolveFamily,
  saveFamily,
  setActiveChild,
  setChildName,
  updateActiveChild,
} from "./children.js";
import { loadData, pickMode } from "./load.js";
import { renderPrintPage } from "./print-view.js";
import {
  renderChildRow,
  renderClassChips,
  renderDataStates,
  renderDisciplineChips,
  renderFamily,
  renderResults,
} from "./render.js";
import { chooseClass, clearDisciplines, toggleDiscipline } from "./state.js";

const $ = (id) => document.getElementById(id);

let model = null;
let family = null;
const openNotes = new Set(); // note keys (sheet row, with a child prefix for several children) whose note is shown
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

const childChip = (index) => `[data-action="child"][data-value="${index}"]`;

// focusTo: a selector to focus after rendering instead of the current control
// (adding or removing a child moves focus to the active child's chip).
function render(focusTo = null) {
  const focus = focusTo || focusedControl();
  const sel = activeChild(family);
  const several = family.children.length > 1;
  renderChildRow(
    { chips: $("childChips"), add: $("childAdd"), addNote: $("childAddNote"), remove: $("childRemove"), nameField: $("childNameField") },
    family,
  );
  // While the parent types, the field keeps its own text (and caret).
  const name = $("childName");
  if (document.activeElement !== name) name.value = sel.name;
  renderClassChips($("classChips"), model, sel);
  renderDisciplineChips($("disciplineChips"), model, sel);
  $("results").hidden = several;
  $("family").hidden = !several;
  if (several) {
    renderFamily(
      {
        title: $("familyTitle"),
        pdfButton: $("familyPdfButton"),
        pdfNote: $("familyPdfNote"),
        cards: $("familyCards"),
        live: $("familyLive"),
        listHeadTemplate: $("listHead"),
        emptyText: $("empty").textContent,
      },
      model,
      family,
      openNotes,
    );
  } else {
    renderResults(resultElements(), model, sel, openNotes);
  }
  renderPrintPage($("printPage"), model, family);
  saveFamily(family);
  if (focus) document.querySelector(focus)?.focus();
}

function update(next, focusTo = null) {
  if (JSON.stringify(next) === JSON.stringify(family)) return;
  family = next;
  render(focusTo);
}

// Adding or removing a child shifts the note keys of the cards.
function updateChildren(next) {
  openNotes.clear();
  focusOpened.clear();
  update(next, childChip(next.active));
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
  if (action === "child") update(setActiveChild(family, Number(value)));
  else if (action === "child-add") updateChildren(addChild(family));
  else if (action === "child-remove") updateChildren(removeChild(family));
  else if (action === "class") update(updateActiveChild(family, (sel) => chooseClass(model, sel, value || null)));
  else if (action === "discipline") update(updateActiveChild(family, (sel) => toggleDiscipline(model, sel, value)));
  else if (action === "disciplines-all") update(updateActiveChild(family, clearDisciplines));
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
  renderPrintPage($("printPage"), model, family);
  if (screenTitle === null) screenTitle = document.title;
  document.title = canPrintFamily(family) ? familyPrintTitle(model, family) : screenTitle;
}

// The first name of the active child (§14.2), stored as it is typed.
$("childName").addEventListener("input", (event) => {
  if (model) update(setChildName(family, event.target.value));
});

function afterPrint() {
  if (screenTitle === null) return;
  document.title = screenTitle;
  screenTitle = null;
}

// The print page is measured to fit (print-view.js); once the web fonts are
// in, measure again with them.
document.fonts?.ready.then(() => model && renderPrintPage($("printPage"), model, family));

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
    family = resolveFamily(model, { search: location.search, ...loadFamily() });
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
