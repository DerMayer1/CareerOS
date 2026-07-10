"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "career-os-package-"));
const installDir = path.join(temp, "install");
fs.mkdirSync(installDir);

try {
  const result = runNpm(["pack", "--json", "--ignore-scripts", "--pack-destination", temp], root);
  ensureSuccess(result, "npm pack failed");

  const payload = JSON.parse(result.stdout);
  const files = new Set(payload[0].files.map((entry) => entry.path.replace(/\\/g, "/")));
  const forbiddenPrefixes = [".tmp-inspect/", ".git/", ".github/", "data/", "outputs/", "profile/", "scripts/", "test/"];

  for (const file of files) {
    assert(!forbiddenPrefixes.some((prefix) => file.startsWith(prefix)), `Forbidden package entry: ${file}`);
  }

  for (const required of ["LICENSE", "bin/career-os.js", "src/cli.js", "schemas/job.schema.json"]) {
    assert(files.has(required), `Missing package entry: ${required}`);
  }

  assert(files.size < 100, `Unexpected package growth: ${files.size} entries`);

  fs.writeFileSync(path.join(installDir, "package.json"), '{"name":"career-os-smoke","private":true}\n');
  const tarball = path.join(temp, payload[0].filename);
  ensureSuccess(
    runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], installDir),
    "tarball install failed"
  );

  const installedCli = path.join(installDir, "node_modules", "career-os", "bin", "career-os.js");
  const smoke = childProcess.spawnSync(process.execPath, [installedCli, "--help"], options(installDir));
  ensureSuccess(smoke, "installed CLI smoke test failed");
  assert.match(smoke.stdout, /CareerOS/);
  console.log(`Package manifest and tarball install are clean (${files.size} entries).`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function runNpm(args, cwd) {
  const npmCli = process.env.npm_execpath;
  if (npmCli) return childProcess.spawnSync(process.execPath, [npmCli, ...args], options(cwd));
  if (process.platform === "win32") {
    const command = ["npm", ...args].map(quoteCmdArg).join(" ");
    return childProcess.spawnSync("cmd.exe", ["/d", "/s", "/c", command], options(cwd));
  }
  return childProcess.spawnSync("npm", args, options(cwd));
}

function ensureSuccess(result, label) {
  if (result.status === 0) return;
  throw new Error(`${label}: ${result.stderr || result.stdout || `exit ${result.status}`}`);
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function options(cwd = root) {
  return { cwd, encoding: "utf8", windowsHide: true, timeout: 60000 };
}
