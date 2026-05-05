import { ProjectReport, ScanSummary } from "../types/report.js";
import { describeAnalysisProfile } from "./analysisProfile.js";

export function buildPrompt(summary: ScanSummary, reviewKnowledge = ""): string {
  const deps = summary.packageJson
    ? Object.keys(summary.packageJson.dependencies).slice(0, 15)
    : [];
  const devDeps = summary.packageJson
    ? Object.keys(summary.packageJson.devDependencies).slice(0, 10)
    : [];

  const topFileTypes = Object.entries(summary.fileTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ext, count]) => `${ext}: ${count}`)
    .join(", ");

  const scripts = summary.packageJson
    ? Object.entries(summary.packageJson.scripts)
        .slice(0, 10)
        .map(([name, cmd]) => `  ${name}: ${cmd}`)
        .join("\n")
    : "none";

  const todoList = summary.todoComments
    .slice(0, 20)
    .map(t => `  ${t.file}:${t.line} [${t.type}] ${t.text}`)
    .join("\n");

  return `Analyze this software project and return a JSON report with a project health assessment.

PROJECT OVERVIEW:
- Name: ${summary.projectName}
- Path: ${summary.projectPath}
- Files: ${summary.fileCount} total (${summary.srcFiles.length} source files)
- Directories: ${summary.dirCount}
- Lines of code: ~${summary.totalLinesOfCode}
- Has tests: ${summary.hasTests ? "Yes" : "No"} (${summary.testFileCount} test files)
- Dependencies: ${summary.dependencyCount}
- Has CI/CD: ${summary.hasCiCd ? "Yes" : "No"}
- Has Docker: ${summary.hasDocker ? "Yes" : "No"}

ANALYSIS PROFILE:
${describeAnalysisProfile(summary.analysisProfile)}

TECH STACK:
- File types: ${topFileTypes}
- Dependencies: ${deps.join(", ") || "none"}
- Dev dependencies: ${devDeps.join(", ") || "none"}

GIT INFO:
- Is git repo: ${summary.gitInfo?.isGitRepo ? "Yes" : "No"}
${summary.gitInfo?.isGitRepo ? `- Branch: ${summary.gitInfo.branch}
- Total commits: ${summary.gitInfo.commitCount}
- Last commit: ${summary.gitInfo.lastCommit}
- Uncommitted changes: ${summary.gitInfo.hasUncommittedChanges ? "Yes" : "No"}
- Modified files: ${summary.gitInfo.modifiedFiles.slice(0, 5).join(", ") || "none"}` : ""}

FILE STRUCTURE (top entries):
${summary.fileTree}

CONFIG FILES:
${summary.configFiles.slice(0, 20).join("\n") || "none"}

TODO/FIXME/HACK ITEMS (${summary.todoComments.length} total):
${todoList || "none found"}

PACKAGE.JSON SCRIPTS:
${scripts}

README EXCERPT:
${summary.readmeContent || "No README found"}

REVIEW KNOWLEDGE BASE:
${reviewKnowledge || "Use general senior engineering, product-readiness, and UI/UX review standards."}

Return ONLY valid JSON (no markdown code fences, no extra text) with this exact structure:

{
  "projectName": "string",
  "purpose": "1-2 sentence description of what this project appears to do",
  "techStack": ["framework1", "language1", "tool1"],
  "stage": "Concept|Prototype|MVP|Beta|Production-ready",
  "summary": "3-4 sentence overall assessment",
  "scores": {
    "overall": 0-100,
    "coreFunctionality": 0-100,
    "uiUxPolish": 0-100,
    "codeQuality": 0-100,
    "stabilityBugs": 0-100,
    "performance": 0-100,
    "documentation": 0-100,
    "deploymentReadiness": 0-100
  },
  "working": [
    {"area": "Feature area name", "details": "What's working"}
  ],
  "needsFixing": [
    {"problem": "Issue name", "evidence": "Why this is an issue", "severity": "Low|Medium|High", "suggestedFix": "How to fix it"}
  ],
  "nextEasyWins": [
    {"task": "Task description", "whyItMatters": "Impact explanation", "difficulty": "Easy|Medium|Hard", "estimatedTime": "15 min|30 min|1 hour|2+ hours", "filesLikelyInvolved": ["file1.js"]}
  ],
  "accessibilityStandards": [
    {"standard": "WCAG 2.2 AA", "status": "Ready|Needs work", "issue": "Current accessibility gap or readiness note", "nextStep": "Concrete next step", "filesLikelyInvolved": ["file1.js"]}
  ],
  "publishingReadiness": [
    {"target": "Web/PWA", "status": "Ready|Needs work", "requirement": "Platform-specific requirement", "nextStep": "Concrete next step", "filesLikelyInvolved": ["file1.js"]}
  ],
  "buildOrder": ["Step 1", "Step 2", "Step 3"],
  "risks": ["Risk 1", "Risk 2"],
  "todayPlan": [
    {"task": "Task to do today", "filesToOpen": ["file1.js"], "successLooksLike": "What completing this looks like"}
  ],
  "trackerTable": [
    {"area": "Area name", "status": "Not Started|In Progress|Complete", "completionPercent": 0-100, "priority": "Low|Medium|High", "nextAction": "What to do next"}
  ],
  "confidence": "Low|Medium|High"
}

Be honest and practical. Scores should reflect real project health. If the project is early-stage, give lower scores. If it lacks tests, penalize stability and code quality. If it has many TODOs, flag that. Keep all text concise and actionable. Respect the selected readiness focus: keep Solo/Indie recommendations lightweight and practical, and only add enterprise governance, IAM/RBAC, audit logging, data governance, deployment controls, or compliance guidance when Enterprise Readiness is selected. Only suggest platform, OS, accessibility, and publishing work relevant to the selected analysis profile; do not invent checklist items for unselected publishing targets.`;
}

export function buildCompactPrompt(summary: ScanSummary, baseline: ProjectReport, reviewKnowledge = ""): string {
  const deps = summary.packageJson
    ? Object.keys(summary.packageJson.dependencies).slice(0, 12)
    : [];
  const devDeps = summary.packageJson
    ? Object.keys(summary.packageJson.devDependencies).slice(0, 8)
    : [];
  const topFileTypes = Object.entries(summary.fileTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ext, count]) => `${ext}: ${count}`)
    .join(", ");
  const todoList = summary.todoComments
    .slice(0, 12)
    .map(t => `${t.file}:${t.line} [${t.type}] ${t.text}`)
    .join("\n");
  const baselineIssues = baseline.needsFixing
    .slice(0, 4)
    .map(item => `- ${item.problem}: ${item.evidence}`)
    .join("\n");
  const baselineWins = baseline.nextEasyWins
    .slice(0, 4)
    .map(item => `- ${item.task}: ${item.whyItMatters}`)
    .join("\n");
  const fileTree = truncateText(summary.fileTree, 2500);
  const readme = truncateText(summary.readmeContent || "", 1800);

  return `Analyze this project using the facts below. Return ONLY valid JSON.

FACTS
name: ${summary.projectName}
path: ${summary.projectPath}
files: ${summary.fileCount}
source files: ${summary.srcFiles.length}
directories: ${summary.dirCount}
lines of code: ${summary.totalLinesOfCode}
tests: ${summary.hasTests ? "yes" : "no"} (${summary.testFileCount})
ci/cd: ${summary.hasCiCd ? "yes" : "no"}
docker: ${summary.hasDocker ? "yes" : "no"}
dependencies: ${summary.dependencyCount}
file types: ${topFileTypes || "unknown"}
runtime deps: ${deps.join(", ") || "none"}
dev deps: ${devDeps.join(", ") || "none"}
analysis profile:
${describeAnalysisProfile(summary.analysisProfile)}
baseline stage: ${baseline.stage}
baseline scores: overall ${baseline.scores.overall}, core ${baseline.scores.coreFunctionality}, ui ${baseline.scores.uiUxPolish}, quality ${baseline.scores.codeQuality}, stability ${baseline.scores.stabilityBugs}, performance ${baseline.scores.performance}, docs ${baseline.scores.documentation}, deploy ${baseline.scores.deploymentReadiness}
tree:
${fileTree}
todo/fixme/hack:
${todoList || "none"}
baseline issues:
${baselineIssues || "none"}
baseline easy wins:
${baselineWins || "none"}
readme:
${readme || "No README found"}

review knowledge:
${truncateText(reviewKnowledge || "Use general senior engineering, product-readiness, and UI/UX review standards.", 1800)}

Return this exact JSON shape. Keep arrays short. Every value must be specific to the facts above. Never return placeholder words like Task, Step, Risk, Issue, or short task.
{
  "purpose": "",
  "summary": "",
  "workingAreas": [],
  "issues": [],
  "easyWins": [],
  "accessibilityStandards": [],
  "publishingReadiness": [],
  "buildOrder": [],
  "risks": [],
  "todayTasks": [],
  "confidence": "Medium"
}
Only include accessibility and publishing items that match the analysis profile. Respect the selected readiness focus: keep Solo/Indie recommendations lightweight, and only add enterprise governance, IAM/RBAC, audit logging, data governance, deployment controls, or compliance guidance when Enterprise Readiness is selected.`;
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n...truncated...` : value;
}
