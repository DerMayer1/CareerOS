#!/usr/bin/env node

const rawArgs = process.argv.slice(2);
const verbose = removeGlobalFlag(rawArgs, "--verbose") || process.env.CAREER_OS_VERBOSE === "1";
const jsonErrors = removeGlobalFlag(rawArgs, "--json-errors");

Promise.resolve(require("../src/cli").main(rawArgs)).catch((error) => {
  const message = error && error.message ? error.message : String(error);
  if (jsonErrors) {
    console.error(JSON.stringify({
      error: {
        code: error && error.code ? error.code : "CAREER_OS_ERROR",
        message
      }
    }));
  } else if (verbose && error && error.stack) {
    console.error(error.stack);
  } else {
    console.error(`CareerOS: ${message}`);
    console.error("Run again with --verbose for technical details.");
  }
  process.exitCode = error && error.exitCode ? error.exitCode : 1;
});

function removeGlobalFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return false;
  args.splice(index, 1);
  return true;
}
