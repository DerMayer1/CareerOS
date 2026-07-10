"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const roots = ["bin", "src", "scripts", "test"];
const files = [];

for (const relativeRoot of roots) collect(path.join(root, relativeRoot));

for (const file of files.sort()) {
  const result = childProcess.spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);

function collect(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(target);
    else if (entry.name.endsWith(".js")) files.push(target);
  }
}
