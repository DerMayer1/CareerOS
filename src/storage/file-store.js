"use strict";

const fs = require("fs");
const path = require("path");
const { APPLICATION_HEADERS } = require("../applications/schema");
const { validateApplicationRows, validateJobs } = require("../core/validation");
const { appendFileAtomicSync, writeFileAtomicSync } = require("./atomic-file");

function createFileStore({ paths, root }) {
  if (!paths) throw new Error("createFileStore requires paths");

  function readRawJobs() {
    return readJsonl(paths.rawJobs);
  }

  function appendRawJobs(jobs, meta = {}) {
    if (!jobs.length) return;
    const now = new Date().toISOString();
    const lines = jobs.map((job) => JSON.stringify({ imported_at: now, ...meta, raw: job }));
    appendFileAtomicSync(paths.rawJobs, lines.join("\n") + "\n");
  }

  function readNormalizedJobs() {
    return validateJobs(readJson(paths.normalizedJobs, []));
  }

  function writeNormalizedJobs(jobs) {
    validateJobs(jobs);
    writeJson(paths.normalizedJobs, jobs);
  }

  function readSeenJobs() {
    return readJson(paths.seenJobs, { seen: {} });
  }

  function writeSeenJobs(data) {
    writeJson(paths.seenJobs, data);
  }

  function updateSeenJobs(jobs) {
    const data = readSeenJobs();
    const now = new Date().toISOString().slice(0, 10);
    for (const job of jobs) {
      const current = data.seen[job.id] || { first_seen: now, status: "seen" };
      data.seen[job.id] = { ...current, last_seen: now };
    }
    writeSeenJobs(data);
  }

  function readSourceCache() {
    return readJson(paths.sourceCache, { searches: {} });
  }

  function writeSourceCache(cache) {
    writeJson(paths.sourceCache, cache);
  }

  function readApplications() {
    if (!fs.existsSync(paths.applications)) return [];
    const text = fs.readFileSync(paths.applications, "utf8").trim();
    return validateApplicationRows(text ? parseCsv(text) : []);
  }

  function writeApplications(rows) {
    validateApplicationRows(rows);
    const csv = `${APPLICATION_HEADERS.join(",")}\n${rows.map((item) => APPLICATION_HEADERS.map((header) => csvEscape(item[header])).join(",")).join("\n")}\n`;
    writeFileAtomicSync(paths.applications, csv);
  }

  function resetData() {
    writeFileAtomicSync(paths.rawJobs, "");
    writeFileAtomicSync(paths.normalizedJobs, "[]\n");
    writeSeenJobs({ seen: {} });
    writeApplications([]);
    cleanDir(paths.reports);
    cleanDir(paths.tables);
  }

  function relative(filePath) {
    return path.relative(root, filePath).replace(/\\/g, "/");
  }

  return {
    appendRawJobs,
    readApplications,
    readNormalizedJobs,
    readRawJobs,
    readSeenJobs,
    readSourceCache,
    relative,
    resetData,
    updateSeenJobs,
    writeApplications,
    writeNormalizedJobs,
    writeSeenJobs,
    writeSourceCache
  };
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const text = fs.readFileSync(filePath, "utf8").trim();
  return text ? JSON.parse(text) : fallback;
}

function writeJson(filePath, value) {
  writeFileAtomicSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanDir(target);
      fs.rmdirSync(target);
    } else {
      fs.unlinkSync(target);
    }
  }
}

function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return rows;
  const headers = splitCsvLine(lines[0]);
  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
  }
  return rows;
}

function splitCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      value += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

module.exports = {
  createFileStore
};
