"use strict";

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "ref", "referrer", "source",
  "utm_campaign", "utm_content", "utm_medium", "utm_source", "utm_term"
]);

function dedupeJobs(jobs) {
  const records = [];
  const keyToIndex = new Map();
  for (const job of jobs) {
    const keys = identityKeys(job);
    const existingIndex = keys.map((key) => keyToIndex.get(key)).find((index) => index !== undefined);
    if (existingIndex === undefined) {
      const index = records.length;
      records.push(job);
      keys.forEach((key) => keyToIndex.set(key, index));
    } else {
      records[existingIndex] = mergeJobs(records[existingIndex], job);
      identityKeys(records[existingIndex]).forEach((key) => keyToIndex.set(key, existingIndex));
    }
  }
  return records;
}

function identityKeys(job) {
  const keys = [];
  if (job.id) keys.push(`id:${normalize(job.id)}`);
  for (const value of [job.apply_url, job.source_url]) {
    const canonical = canonicalUrl(value);
    if (canonical) keys.push(`url:${canonical}`);
  }
  const source = normalize(job.source_site);
  const company = normalize(job.company);
  const title = normalize(job.title);
  const location = normalize(job.remote_region || job.location_raw || job.location);
  if (source && company && title) keys.push(`role:${source}|${company}|${title}|${location}`);
  return [...new Set(keys)];
}

function canonicalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    if (!new Set(["http:", "https:"]).has(url.protocol)) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return "";
  }
}

function mergeJobs(first, second) {
  const merged = { ...first };
  for (const [key, value] of Object.entries(second)) {
    const current = merged[key];
    if (Array.isArray(current) || Array.isArray(value)) {
      merged[key] = [...new Set([...(Array.isArray(current) ? current : []), ...(Array.isArray(value) ? value : [])])];
    } else if (isMissing(current) || richerString(value, current)) {
      merged[key] = value;
    }
  }
  for (const key of ["id", "state", "approved_at", "application_id", "score_fit", "score_explanation", "recommendation"]) {
    if (!isMissing(first[key])) merged[key] = first[key];
  }
  return merged;
}

function richerString(candidate, current) {
  return typeof candidate === "string" && typeof current === "string" && candidate.length > current.length * 1.25;
}

function isMissing(value) {
  return value === undefined || value === null || value === "" || value === "unknown";
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

module.exports = {
  canonicalUrl,
  dedupeJobs,
  identityKeys,
  mergeJobs
};
