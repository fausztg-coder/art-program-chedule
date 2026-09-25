// RFC 4180 CSV parser. Pure: shared by the browser and Node.
//
// Returns one array of strings per record. Handles a leading BOM, CRLF / LF /
// CR line endings, and quoted fields containing commas, escaped quotes ("")
// and newlines. The final line terminator does not start a new record, but a
// blank line in the middle does (as [""]), so record indexes stay aligned with
// Sheet row numbers. Malformed input is parsed leniently rather than rejected.

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let fieldStart = true; // no character of the current field consumed yet
  let recordStart = true; // no character of the current record consumed yet
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += c;
      }
      i++;
      continue;
    }
    if (c === '"' && fieldStart) {
      inQuotes = true;
      fieldStart = false;
      recordStart = false;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      fieldStart = true;
      recordStart = false;
      i++;
      continue;
    }
    if (c === "\r" || c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      fieldStart = true;
      recordStart = true;
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += c;
    fieldStart = false;
    recordStart = false;
    i++;
  }

  if (!recordStart || inQuotes) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
