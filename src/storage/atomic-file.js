"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function writeFileAtomicSync(filePath, content, options = {}) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`
  );

  let descriptor;
  try {
    descriptor = fs.openSync(tempPath, "wx", options.mode || 0o600);
    fs.writeFileSync(descriptor, content, options.encoding || "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    try { fs.unlinkSync(tempPath); } catch {}
    throw error;
  }
}

function appendFileAtomicSync(filePath, content, options = {}) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, options.encoding || "utf8") : "";
  writeFileAtomicSync(filePath, existing + content, options);
}

module.exports = {
  appendFileAtomicSync,
  writeFileAtomicSync
};
