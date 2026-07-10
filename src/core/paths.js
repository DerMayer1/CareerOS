"use strict";

const path = require("path");

function createProjectPaths(root = process.cwd()) {
  const dataDir = path.join(root, "data");
  const outputsDir = path.join(root, "outputs");

  return {
    ROOT: root,
    DATA_DIR: dataDir,
    OUTPUTS_DIR: outputsDir,
    PATHS: {
      searchProfile: path.join(root, "config", "search_profile.json"),
      scoringWeights: path.join(root, "config", "scoring_weights.json"),
      sourcesConfig: path.join(root, "config", "sources.json"),
      aiConfig: path.join(root, "config", "ai.json"),
      candidateProfile: path.join(root, "profile", "candidate-profile.md"),
      candidateProfileJson: path.join(root, "profile", "candidate-profile.json"),
      skillTaxonomy: path.join(root, "profile", "skill-taxonomy.json"),
      rolePreferences: path.join(root, "profile", "role-preferences.md"),
      rawJobs: path.join(dataDir, "jobs_raw.jsonl"),
      normalizedJobs: path.join(dataDir, "jobs_normalized.json"),
      seenJobs: path.join(dataDir, "seen_jobs.json"),
      sourceCache: path.join(dataDir, "source_cache.json"),
      applications: path.join(dataDir, "applications.csv"),
      reports: path.join(outputsDir, "reports"),
      tables: path.join(outputsDir, "tables"),
      aiOutputs: path.join(outputsDir, "ai"),
      importErrors: path.join(outputsDir, "import-errors")
    }
  };
}

module.exports = {
  createProjectPaths
};
