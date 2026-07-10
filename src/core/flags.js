"use strict";

function parseFlags(args, schema = {}, context = "command") {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) throw usageError(`Unexpected argument for ${context}: ${arg}`);

    const separator = arg.indexOf("=");
    const key = arg.slice(2, separator >= 0 ? separator : undefined);
    const definition = schema[key];
    if (!definition) throw usageError(`Unknown flag for ${context}: --${key}`);
    if (Object.prototype.hasOwnProperty.call(flags, key)) throw usageError(`Duplicate flag for ${context}: --${key}`);

    const type = typeof definition === "string" ? definition : definition.type;
    let value = separator >= 0 ? arg.slice(separator + 1) : undefined;
    if (type === "boolean") {
      if (value === undefined) value = true;
      else if (value === "true" || value === "false") value = value === "true";
      else throw usageError(`Flag --${key} expects true or false`);
    } else {
      if (value === undefined) {
        value = args[index + 1];
        if (value === undefined || value.startsWith("--")) throw usageError(`Flag --${key} requires a value`);
        index += 1;
      }
      if (type === "number") {
        const number = Number(value);
        if (!Number.isFinite(number)) throw usageError(`Flag --${key} expects a number`);
        if (definition.min !== undefined && number < definition.min) throw usageError(`Flag --${key} must be at least ${definition.min}`);
        if (definition.max !== undefined && number > definition.max) throw usageError(`Flag --${key} must be at most ${definition.max}`);
        value = number;
      } else {
        value = String(value);
      }
    }
    flags[key] = value;
  }
  return flags;
}

function usageError(message) {
  const error = new Error(message);
  error.code = "CAREER_OS_USAGE_ERROR";
  error.exitCode = 2;
  return error;
}

module.exports = {
  parseFlags,
  usageError
};
