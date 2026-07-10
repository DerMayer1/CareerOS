"use strict";

const crypto = require("crypto");
const http = require("http");
const https = require("https");

const providers = {
  remotive: {
    name: "remotive",
    type: "public_api",
    search: searchRemotive
  },
  jobicy: {
    name: "jobicy",
    type: "public_api",
    search: searchJobicy
  },
  remoteok: {
    name: "remoteok",
    type: "public_api",
    search: searchRemoteOk
  },
  wwr: {
    name: "wwr",
    type: "rss",
    search: searchWwr
  }
};

async function searchProvider(name, source, options = {}) {
  const provider = providers[name];
  if (!provider) throw new Error(`No connector implemented for source: ${name}`);
  const query = String(options.query || "");
  const limit = Math.max(1, Number(options.limit || source.max_limit || 25));
  return provider.search(source, query, limit);
}

function buildManualSearchUrl(source, query) {
  const template = source.search_url_template || source.base_url || "";
  return template.replace("{query}", encodeURIComponent(query || ""));
}

function listProviders() {
  return Object.keys(providers);
}

async function searchRemotive(source, query, limit) {
  const url = new URL(source.base_url);
  if (query) url.searchParams.set("search", query);
  const data = await fetchJson(url.toString());
  return (data.jobs || []).slice(0, limit).map((job) => ({
    source_site: "Remotive",
    id: job.id,
    title: job.title,
    company: job.company_name,
    company_logo: job.company_logo,
    location: job.candidate_required_location || "Remote",
    job_type: job.job_type,
    publication_date: job.publication_date,
    source_url: job.url,
    apply_url: job.url,
    salary: job.salary || salaryRangeText(job.annualSalaryMin, job.annualSalaryMax, "USD", "year"),
    category: job.category,
    tags: job.tags,
    description: stripHtml(job.description || ""),
    raw_source: job
  }));
}

async function searchJobicy(source, query, limit) {
  const url = new URL(source.base_url);
  url.searchParams.set("count", String(limit));
  if (query) url.searchParams.set("tag", query);
  const data = await fetchJson(url.toString());
  const jobs = data.jobs || data.data || [];
  return jobs.slice(0, limit).map((job) => ({
    source_site: "Jobicy",
    id: job.id || job.jobId,
    title: job.jobTitle || job.title,
    company: job.companyName || job.company,
    location: job.jobGeo || job.location || "Remote",
    job_type: job.jobType,
    publication_date: job.pubDate || job.date,
    source_url: job.url || job.jobUrl,
    apply_url: job.url || job.jobUrl,
    salary: job.salary,
    annualSalaryMin: job.annualSalaryMin,
    annualSalaryMax: job.annualSalaryMax,
    category: job.jobIndustry,
    tags: job.jobTags,
    description: stripHtml(job.jobDescription || job.description || ""),
    raw_source: job
  }));
}

async function searchRemoteOk(source, query, limit) {
  const url = new URL(source.base_url);
  if (query) url.searchParams.set("tag", query.toLowerCase().replace(/\s+/g, "-"));
  const data = await fetchJson(url.toString());
  const jobs = Array.isArray(data) ? data.filter((item) => item && item.position) : [];
  const filtered = query ? jobs.filter((job) => matchesQuery(`${job.position} ${job.company} ${(job.tags || []).join(" ")} ${job.description || ""}`, query)) : jobs;
  return filtered.slice(0, limit).map((job) => ({
    source_site: "RemoteOK",
    id: job.id || job.slug,
    title: job.position,
    company: job.company,
    company_logo: job.company_logo,
    location: job.location || "Remote",
    job_type: "remote",
    publication_date: job.date,
    source_url: job.url ? absoluteRemoteOkUrl(job.url) : `https://remoteok.com/remote-jobs/${job.id}`,
    apply_url: job.apply_url || (job.url ? absoluteRemoteOkUrl(job.url) : ""),
    salary: salaryRangeText(job.salary_min, job.salary_max, "USD", "year"),
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: "USD",
    tags: job.tags,
    description: stripHtml(job.description || ""),
    raw_source: job
  }));
}

async function searchWwr(source, query, limit) {
  const xml = await fetchText(source.feed_url);
  const items = parseRssItems(xml);
  const filtered = query ? items.filter((item) => matchesQuery(`${item.title} ${item.description}`, query)) : items;
  return filtered.slice(0, limit).map((item) => {
    const parsed = parseWwrTitle(item.title);
    return {
      source_site: "WeWorkRemotely",
      id: stableId([item.link, item.guid, item.title]),
      title: parsed.title,
      company: parsed.company,
      location: "Remote",
      publication_date: item.pubDate,
      source_url: item.link,
      apply_url: item.link,
      description: stripHtml(item.description || ""),
      raw_source: item
    };
  });
}

async function fetchJson(url) {
  const text = await fetchText(url);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error.message}`);
  }
}

async function fetchText(url, options = {}) {
  const settings = {
    timeoutMs: options.timeoutMs || 20000,
    maxRedirects: options.maxRedirects ?? 5,
    maxBytes: options.maxBytes || 5 * 1024 * 1024,
    retries: options.retries ?? 2
  };
  let lastError;
  for (let attempt = 0; attempt <= settings.retries; attempt += 1) {
    try {
      return await requestText(url, settings, 0);
    } catch (error) {
      lastError = error;
      if (attempt >= settings.retries || !isRetryable(error)) throw error;
      await wait(Math.min(1000, 200 * (2 ** attempt)));
    }
  }
  throw lastError;
}

function requestText(url, settings, redirects) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`Invalid source URL: ${url}`));
      return;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      reject(new Error(`Unsupported source URL protocol: ${parsed.protocol}`));
      return;
    }
    const client = parsed.protocol === "https:" ? https : http;
    const request = client.get(parsed, {
      headers: {
        "User-Agent": "CareerOS/0.2 (+https://github.com/DerMayer1/CareerOS)",
        "Accept": "application/json, application/rss+xml, application/xml, text/xml, text/plain, */*"
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirects >= settings.maxRedirects) {
          reject(new Error(`Too many redirects fetching ${url}`));
          return;
        }
        resolve(requestText(new URL(response.headers.location, parsed).toString(), settings, redirects + 1));
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        const error = new Error(`HTTP ${response.statusCode} for ${url}`);
        error.retryable = response.statusCode === 429 || response.statusCode >= 500;
        response.resume();
        reject(error);
        return;
      }
      const declaredSize = Number(response.headers["content-length"] || 0);
      if (declaredSize > settings.maxBytes) {
        response.resume();
        reject(new Error(`Response from ${url} exceeds ${settings.maxBytes} bytes`));
        return;
      }
      const chunks = [];
      let received = 0;
      response.on("data", (chunk) => {
        received += chunk.length;
        if (received > settings.maxBytes) {
          response.destroy(new Error(`Response from ${url} exceeds ${settings.maxBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      response.on("error", reject);
    });
    request.setTimeout(settings.timeoutMs, () => {
      const error = new Error(`Timeout fetching ${url}`);
      error.retryable = true;
      request.destroy(error);
    });
    request.on("error", reject);
  });
}

function isRetryable(error) {
  return error.retryable === true || new Set(["ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ETIMEDOUT"]).has(error.code);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function matchesQuery(text, query) {
  return String(query).toLowerCase().split(/\s+/).filter(Boolean).every((term) => String(text || "").toLowerCase().includes(term));
}

function absoluteRemoteOkUrl(url) {
  return String(url).startsWith("http") ? url : `https://remoteok.com${String(url).startsWith("/") ? "" : "/"}${url}`;
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml))) {
    const item = match[0];
    items.push({
      title: decodeXml(readXmlTag(item, "title")),
      link: decodeXml(readXmlTag(item, "link")),
      guid: decodeXml(readXmlTag(item, "guid")),
      pubDate: decodeXml(readXmlTag(item, "pubDate")),
      description: decodeXml(readXmlTag(item, "description"))
    });
  }
  return items;
}

function readXmlTag(xml, tag) {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return match ? match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "") : "";
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function parseWwrTitle(title) {
  const parts = String(title || "").split(":");
  if (parts.length >= 2) {
    return { company: parts.shift().trim(), title: parts.join(":").trim() };
  }
  return { company: "Unknown company", title: title || "Unknown role" };
}

function salaryRangeText(min, max, currency, period) {
  if (!min && !max) return "";
  return `${currency} ${min || max}-${max || min} / ${period}`;
}

function stripHtml(value) {
  return decodeXml(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function stableId(parts) {
  return crypto.createHash("sha1").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 16);
}

module.exports = {
  buildManualSearchUrl,
  fetchText,
  listProviders,
  parseRssItems,
  searchProvider
};
