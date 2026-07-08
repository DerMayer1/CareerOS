"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

function createCodexCliProvider(options) {
  const {
    root,
    readConfig,
    ensureDirs,
    relative,
    slugify,
    log = console.log
  } = options;

  function doctor() {
    const config = readConfig();
    const pathProbe = probeCodexCommand(root, config, "path");
    const versionProbe = probeCodexCommand(root, config, "version");
    const execProbe = probeCodexCommand(root, config, "exec-help");
    return {
      provider: config.provider || "codex-cli",
      enabled: config.enabled !== false,
      command: config.command || "codex",
      sandbox: config.sandbox || "workspace-write",
      approval: config.approval || "never",
      web_search: Boolean(config.web_search),
      available: versionProbe.ok && execProbe.ok,
      path: pathProbe.output.trim(),
      version: versionProbe.output.trim(),
      exec_help_available: execProbe.ok,
      errors: [pathProbe, versionProbe, execProbe].filter((probe) => !probe.ok).map((probe) => ({
        check: probe.check,
        error: probe.error
      }))
    };
  }

  function runPrompt(label, prompt, flags = {}) {
    ensureDirs();
    const config = readConfig();
    const outputDir = path.resolve(root, config.output_dir || "outputs/ai");
    fs.mkdirSync(outputDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeLabel = slugify(label || "codex");
    const promptPath = path.join(outputDir, `${timestamp}-${safeLabel}.prompt.md`);
    const outputPath = path.join(outputDir, `${timestamp}-${safeLabel}.md`);
    fs.writeFileSync(promptPath, prompt);

    if (flags["dry-run"] || config.enabled === false) {
      log(`Wrote prompt: ${relative(promptPath)}`);
      if (config.enabled === false && !flags["dry-run"]) log("AI config is disabled; skipped Codex execution.");
      return { promptPath, outputPath, skipped: true };
    }

    const codexArgs = [
      "exec",
      "--cd", root,
      "--sandbox", config.sandbox || "workspace-write",
      "--ask-for-approval", config.approval || "never",
      "--output-last-message", outputPath
    ];
    if (config.model) codexArgs.push("--model", config.model);
    if (config.web_search) codexArgs.push("--search");
    codexArgs.push("-");

    const command = config.command || "codex";
    try {
      const output = runProcess(root, command, codexArgs, {
        input: prompt,
        timeout: Number(config.timeout_ms || 300000)
      });
      if (output.trim()) log(output.trim());
    } catch (error) {
      throw new Error(`Codex CLI failed. Prompt saved at ${relative(promptPath)}. ${error.message}`);
    }

    log(`Wrote prompt: ${relative(promptPath)}`);
    log(`Wrote output: ${relative(outputPath)}`);
    return { promptPath, outputPath, skipped: false };
  }

  return {
    doctor,
    runPrompt
  };
}

function runProcess(root, command, args, options = {}) {
  const common = {
    cwd: root,
    input: options.input || "",
    encoding: "utf8",
    timeout: options.timeout || 30000,
    maxBuffer: 1024 * 1024 * 20,
    windowsHide: true
  };
  if (process.platform === "win32") {
    const commandLine = [command, ...args].map(quoteCmdArg).join(" ");
    return childProcess.execFileSync("cmd.exe", ["/d", "/s", "/c", commandLine], common);
  }
  return childProcess.execFileSync(command, args, common);
}

function probeCodexCommand(root, config, check) {
  const command = config.command || "codex";
  const argsByCheck = {
    path: process.platform === "win32" ? ["/d", "/s", "/c", `where ${quoteCmdArg(command)}`] : ["-lc", `command -v ${shellQuote(command)}`],
    version: process.platform === "win32" ? ["/d", "/s", "/c", `${quoteCmdArg(command)} --version`] : ["-lc", `${shellQuote(command)} --version`],
    "exec-help": process.platform === "win32" ? ["/d", "/s", "/c", `${quoteCmdArg(command)} exec --help`] : ["-lc", `${shellQuote(command)} exec --help`]
  };
  try {
    const output = process.platform === "win32"
      ? childProcess.execFileSync("cmd.exe", argsByCheck[check], { cwd: root, encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024 * 2, windowsHide: true })
      : childProcess.execFileSync("sh", argsByCheck[check], { cwd: root, encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024 * 2 });
    return { check, ok: true, output, error: "" };
  } catch (error) {
    return { check, ok: false, output: error.stdout || "", error: (error.stderr || error.message || String(error)).trim() };
  }
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[ \t&()^|<>"%]/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

module.exports = {
  createCodexCliProvider
};
