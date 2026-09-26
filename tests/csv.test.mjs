import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCSV } from "../src/csv.js";

test("parses a simple table", () => {
  assert.deepEqual(parseCSV("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
});

test("strips a leading BOM", () => {
  assert.deepEqual(parseCSV("﻿Nap,Óra\nHétfő,7"), [["Nap", "Óra"], ["Hétfő", "7"]]);
});

test("handles CRLF and lone CR line endings", () => {
  assert.deepEqual(parseCSV("a,b\r\n1,2\r\n3,4"), [["a", "b"], ["1", "2"], ["3", "4"]]);
  assert.deepEqual(parseCSV("a\r1"), [["a"], ["1"]]);
});

test("keeps a comma inside quotes", () => {
  assert.deepEqual(parseCSV('x,"1, 2, 3",y'), [["x", "1, 2, 3", "y"]]);
});

test("unescapes doubled quotes", () => {
  assert.deepEqual(parseCSV('"a ""b"" c",""\n'), [['a "b" c', ""]]);
});

test("keeps a newline inside quotes within one record", () => {
  assert.deepEqual(parseCSV('a,b\r\n"line 1\r\nline 2",x\r\n2,y'), [
    ["a", "b"],
    ["line 1\r\nline 2", "x"],
    ["2", "y"],
  ]);
});

test("a trailing line terminator does not add a record", () => {
  assert.deepEqual(parseCSV("a,b\n1,2\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCSV("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
});

test("a blank line in the middle is kept as a record", () => {
  // One-column tabs export an empty Sheet row as an empty line.
  assert.deepEqual(parseCSV("Osztály\n1.a\n\n2.a\n"), [["Osztály"], ["1.a"], [""], ["2.a"]]);
});

test("keeps empty fields", () => {
  assert.deepEqual(parseCSV(",,\n"), [["", "", ""]]);
});

test("an empty file has no records", () => {
  assert.deepEqual(parseCSV(""), []);
  assert.deepEqual(parseCSV("﻿"), []);
});

test("an unterminated quote keeps the rest of the input", () => {
  assert.deepEqual(parseCSV('a,"b\nc'), [["a", "b\nc"]]);
});
