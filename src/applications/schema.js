"use strict";

const APPLICATION_HEADERS = [
  "application_id",
  "job_id",
  "company",
  "role_title",
  "status",
  "recommendation",
  "score_fit",
  "created_at",
  "approved_at",
  "drafted_at",
  "applied_at",
  "last_follow_up",
  "next_follow_up",
  "application_dir",
  "job_url",
  "apply_url",
  "source_site",
  "salary_range",
  "notes"
];

const APPLICATION_STATUSES = new Set([
  "ready_to_apply",
  "drafted",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "archived"
]);

module.exports = {
  APPLICATION_HEADERS,
  APPLICATION_STATUSES
};
