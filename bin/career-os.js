#!/usr/bin/env node

Promise.resolve(require("../src/cli").main(process.argv.slice(2))).catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
