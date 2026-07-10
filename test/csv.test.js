"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { csvEscape, parseCsv } = require("../src/core/csv");

test("CSV parser supports BOM, escaped quotes, commas, and multiline fields", () => {
  const input = '\uFEFFtitle,company,description\r\n"Senior, Engineer",Example,"Line one\nLine ""two"""\r\n';
  assert.deepEqual(parseCsv(input), [{
    title: "Senior, Engineer",
    company: "Example",
    description: 'Line one\nLine "two"'
  }]);
});

test("CSV parser rejects malformed rows and duplicate headers", () => {
  assert.throws(() => parseCsv("title,title\nA,B\n"), /duplicate columns/);
  assert.throws(() => parseCsv('title,company\n"unterminated,Example'), /quoted field/);
  assert.equal(csvEscape('a,"b"'), '"a,""b"""');
});
