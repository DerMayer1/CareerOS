"use strict";

function dispatchCommand(args, handlers) {
  const command = args[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    handlers.printHelp();
    return;
  }

  if (command === "init") return handlers.initProject();
  if (command === "sources" && args[1] === "list") return handlers.listSources();
  if (command === "search") return handlers.searchJobs(args.slice(1));
  if (command === "import") return handlers.importJobs(args[1]);
  if (command === "normalize") return handlers.normalizeJobs();
  if (command === "dedupe") return handlers.dedupeJobs();
  if (command === "extract") return handlers.extractJobs();
  if (command === "score") return handlers.scoreJobs();
  if (command === "report") return handlers.generateReport();
  if (command === "run") return handlers.runPipeline(args.slice(1));
  if (command === "status") return handlers.showStatus();
  if (command === "profile" && args[1] === "check") return handlers.checkProfile();
  if (command === "ai") return handlers.runAiCommand(args.slice(1));
  if (command === "applications" && args[1] === "list") return handlers.listApplications(args[2]);
  if (command === "applications" && args[1] === "status") return handlers.updateApplicationStatus(args[2], args[3]);
  if (command === "applications" && args[1] === "followup") return handlers.updateApplicationFollowup(args[2], args.slice(3));
  if (command === "application" && args[1] === "plan") return handlers.generateApplicationArtifact(args[2], "plan");
  if (command === "application" && args[1] === "cv-notes") return handlers.generateApplicationArtifact(args[2], "cv-notes");
  if (command === "application" && args[1] === "draft") return handlers.generateApplicationArtifact(args[2], "draft");
  if (command === "interview") return handlers.generateInterviewPrep(args[1]);
  if (command === "approve") return handlers.approveJob(args[1]);
  if (command === "apply") return handlers.applyJob(args[1]);
  if (command === "reset") return handlers.resetData(args.slice(1));
  if (command === "show" && args[1] === "top") return handlers.showTop(args[2]);
  if (command === "show" && args[1] === "extracted") return handlers.showExtracted(args[2]);
  if (command === "show" && args[1] === "gaps") return handlers.showTable("skill_gap_heatmap", args[2]);
  if (command === "show" && args[1] === "red-flags") return handlers.showTable("red_flags", args[2]);
  if (command === "explain") return handlers.explainJob(args[1]);
  if (command === "show" && args[1]) return handlers.showTable(args[1], args[2]);

  throw new Error(`Unknown command: ${args.join(" ")}`);
}

function dispatchAiCommand(args, handlers) {
  const subcommand = args[0];
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    handlers.printAiHelp();
    return;
  }

  if (subcommand === "doctor") return handlers.aiDoctor();
  if (subcommand === "profile-sync") return handlers.aiProfileSync(args.slice(1));
  if (subcommand === "extract") return handlers.aiExtract(args.slice(1));
  if (subcommand === "review-fit") return handlers.aiReviewFit(args.slice(1));
  if (subcommand === "summarize-report") return handlers.aiSummarizeReport(args.slice(1));
  if (subcommand === "draft") return handlers.aiDraft(args.slice(1));
  if (subcommand === "review-draft") return handlers.aiReviewDraft(args.slice(1));
  if (subcommand === "interview") return handlers.aiInterview(args.slice(1));

  throw new Error(`Unknown ai command: ${subcommand}`);
}

module.exports = {
  dispatchAiCommand,
  dispatchCommand
};
