"use strict";

function parseCsv(text) {
  const input = String(text || "").replace(/^\uFEFF/, "");
  if (!input.trim()) return [];
  const records = parseRecords(input);
  const headers = records.shift() || [];
  if (!headers.length || headers.some((header) => !String(header).trim())) throw csvError("CSV header contains an empty column");
  const normalizedHeaders = headers.map((header) => String(header).trim());
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw csvError("CSV header contains duplicate columns");

  return records
    .filter((record) => record.some((value) => value !== ""))
    .map((record, index) => {
      if (record.length !== normalizedHeaders.length) {
        throw csvError(`CSV row ${index + 2} has ${record.length} columns; expected ${normalizedHeaders.length}`);
      }
      return Object.fromEntries(normalizedHeaders.map((header, column) => [header, record[column]]));
    });
}

function parseRecords(input) {
  const records = [];
  let record = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else if (quoted) {
        quoted = false;
      } else if (value === "") {
        quoted = true;
      } else {
        throw csvError(`Unexpected quote at character ${index + 1}`);
      }
    } else if (char === "," && !quoted) {
      record.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      record.push(value);
      records.push(record);
      record = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) throw csvError("CSV ended inside a quoted field");
  if (value !== "" || record.length) {
    record.push(value);
    records.push(record);
  }
  return records;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvError(message) {
  const error = new Error(message);
  error.code = "CAREER_OS_CSV_ERROR";
  return error;
}

module.exports = {
  csvEscape,
  parseCsv
};
