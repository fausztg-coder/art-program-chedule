// Small DOM helpers shared by the screen and the print page. Text from the
// Sheet only ever goes in through textContent and setAttribute (CLAUDE.md).

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// A new element. props: class, text, hidden, or any attribute; children may be
// nodes, strings (added as text) or null.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

// Colours go into custom properties, where any value would be accepted
// (url(...) included), so they are checked once more here.
export function setColor(node, property, color) {
  if (COLOR_RE.test(color)) node.style.setProperty(property, color);
}
