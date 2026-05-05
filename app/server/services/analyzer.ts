import axios from "axios";
import { ScanSummary, ProjectReport, ProjectStage, Confidence } from "../types/report.js";
import { buildCompactPrompt, buildPrompt } from "./promptBuilder.js";
import { completeWithLocalLlm, getLocalLlmConfig, isLocalLlmConfigured, shutdownLocalLlm } from "./localLlm.js";
import { getReviewKnowledgeContext } from "./reviewKnowledge.js";

type AnalyzerProvider = "auto" | "local" | "openai" | "heuristics";

interface NormalizeOptions {
  baseReport?: ProjectReport;
  preserveMetrics?: boolean;
}

export async function analyzeProject(scanSummary: ScanSummary): Promise<ProjectReport> {
  const provider = getAnalyzerProvider();
  const apiKey = process.env.OPENAI_API_KEY;

  if ((provider === "local" || provider === "auto") && isLocalLlmConfigured()) {
    try {
      return await analyzeWithLocalLlm(scanSummary);
    } catch (err) {
      console.warn("Local LLM analysis failed, falling back:", (err as Error).message);
    }
  }

  if (provider === "heuristics" || provider === "local") {
    return analyzeWithHeuristics(scanSummary);
  }

  if ((provider === "openai" || provider === "auto") && hasOpenAIKey(apiKey)) {
    try {
      return await analyzeWithOpenAI(scanSummary, apiKey);
    } catch (err) {
      console.warn("OpenAI analysis failed, falling back to heuristics:", (err as Error).message);
    }
  }

  return analyzeWithHeuristics(scanSummary);
}

export function getAnalyzerRuntimeLabel(): string {
  const provider = getAnalyzerProvider();
  const localConfig = getLocalLlmConfig();
  const localState = isLocalLlmConfigured(localConfig)
    ? `llama.cpp ${localConfig.host}:${localConfig.port}`
    : "llama.cpp not configured";

  if (provider === "auto") {
    return `auto (${localState}, OpenAI ${hasOpenAIKey(process.env.OPENAI_API_KEY) ? "configured" : "not configured"}, heuristics fallback)`;
  }

  if (provider === "local") {
    return `local (${localState}, heuristics fallback)`;
  }

  if (provider === "openai") {
    return `OpenAI ${hasOpenAIKey(process.env.OPENAI_API_KEY) ? "configured" : "not configured"} with heuristics fallback`;
  }

  return "heuristics";
}

export function shutdownAnalyzer(): void {
  shutdownLocalLlm();
}

async function analyzeWithLocalLlm(summary: ScanSummary): Promise<ProjectReport> {
  const baseline = analyzeWithHeuristics(summary);
  const reviewKnowledge = await getReviewKnowledgeContext();
  const prompt = buildCompactPrompt(summary, baseline, reviewKnowledge);
  const content = await completeWithLocalLlm(prompt);
  const parsed = parseModelJson(content);
  const normalized = normalizeReport(parsed, summary, { baseReport: baseline, preserveMetrics: true });

  if (isLowQualityLocalReport(normalized)) {
    throw new Error("Local LLM returned placeholder or low-quality analysis.");
  }

  return normalized;
}

async function analyzeWithOpenAI(summary: ScanSummary, apiKey: string): Promise<ProjectReport> {
  const reviewKnowledge = await getReviewKnowledgeContext();
  const prompt = buildPrompt(summary, reviewKnowledge);

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: "You are a project analysis assistant. Return ONLY valid JSON. No markdown, no code fences, no explanations outside the JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );

  const content = response.data.choices?.[0]?.message?.content || "";
  const parsed = parseModelJson(content);
  return normalizeReport(parsed, summary);
}

function analyzeWithHeuristics(summary: ScanSummary): ProjectReport {
  const scores = calculateScores(summary);
  const stage = detectStage(summary);
  const techStack = detectTechStack(summary);
  const purpose = inferPurpose(summary);

  const working = inferWorkingAreas(summary);
  const needsFixing = inferIssues(summary);
  const nextEasyWins = inferNextWins(summary);
  const accessibilityStandards = inferAccessibilityStandards(summary);
  const publishingReadiness = inferPublishingReadiness(summary);
  const buildOrder = inferBuildOrder(summary, stage);
  const risks = inferRisks(summary);
  const todayPlan = inferTodayPlan(summary, needsFixing, nextEasyWins);
  const trackerTable = buildTrackerTable(summary, scores);

  return {
    projectName: summary.projectName,
    purpose,
    techStack,
    stage,
    summary: buildSummary(summary, stage, scores),
    scores,
    working,
    needsFixing,
    nextEasyWins,
    accessibilityStandards,
    publishingReadiness,
    buildOrder,
    risks,
    todayPlan,
    trackerTable,
    confidence: "Medium" as Confidence,
    analysisProfile: summary.analysisProfile,
  };
}

function getDependencyNames(summary: ScanSummary): string[] {
  return [
    ...Object.keys(summary.packageJson?.dependencies || {}),
    ...Object.keys(summary.packageJson?.devDependencies || {}),
  ];
}

function hasDependency(summary: ScanSummary, matchers: string[]): boolean {
  const deps = getDependencyNames(summary).map(dep => dep.toLowerCase());
  return deps.some(dep => matchers.some(matcher => dep === matcher || dep.includes(matcher)));
}

function hasConfig(summary: ScanSummary, matchers: string[]): boolean {
  return summary.configFiles
    .map(file => file.toLowerCase())
    .some(file => matchers.some(matcher => file.includes(matcher)));
}

function hasTopLevelFile(summary: ScanSummary, names: string[]): boolean {
  const files = summary.topLevelFiles.map(file => file.toLowerCase());
  return names.some(name => files.includes(name.toLowerCase()));
}

function hasScript(summary: ScanSummary, matchers: string[]): boolean {
  const scripts = Object.entries(summary.packageJson?.scripts || {});
  return scripts.some(([name, command]) => {
    const value = `${name} ${command}`.toLowerCase();
    return matchers.some(matcher => value.includes(matcher));
  });
}

function hasBuildScript(summary: ScanSummary): boolean {
  return hasScript(summary, ["build", "compile"]);
}

function hasStartScript(summary: ScanSummary): boolean {
  return hasScript(summary, ["start", "serve", "preview"]);
}

function hasTestScript(summary: ScanSummary): boolean {
  return hasScript(summary, ["test", "vitest", "jest", "playwright", "cypress"]);
}

function hasLinting(summary: ScanSummary): boolean {
  return hasScript(summary, ["lint", "eslint"]) || hasConfig(summary, ["eslint"]) || hasDependency(summary, ["eslint", "biome"]);
}

function hasFormatting(summary: ScanSummary): boolean {
  return hasScript(summary, ["format", "prettier", "biome"]) || hasConfig(summary, ["prettier", "biome"]) || hasDependency(summary, ["prettier", "biome"]);
}

function hasTypeChecking(summary: ScanSummary): boolean {
  return hasScript(summary, ["typecheck", "type-check", "tsc"]) || hasConfig(summary, ["tsconfig"]) || hasDependency(summary, ["typescript"]);
}

function hasLockfile(summary: ScanSummary): boolean {
  return hasTopLevelFile(summary, [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "bun.lock",
    "poetry.lock",
    "uv.lock",
    "pdm.lock",
    "cargo.lock",
    "go.sum",
    "gemfile.lock",
    "composer.lock",
  ]);
}

function hasTypeScript(summary: ScanSummary): boolean {
  return Boolean(summary.fileTypeCounts[".ts"] || summary.fileTypeCounts[".tsx"]);
}

function isJavaScriptProject(summary: ScanSummary): boolean {
  return Boolean(summary.packageJson || summary.fileTypeCounts[".js"] || summary.fileTypeCounts[".jsx"] || hasTypeScript(summary));
}

function hasSourcePath(summary: ScanSummary, matchers: string[]): boolean {
  const files = summary.srcFiles.map(file => file.replace(/\\/g, "/").toLowerCase());
  return files.some(file => matchers.some(matcher => file.includes(matcher.toLowerCase())));
}

function readmeIncludes(summary: ScanSummary, matchers: string[]): boolean {
  const readme = summary.readmeContent?.toLowerCase() || "";
  return matchers.some(matcher => readme.includes(matcher.toLowerCase()));
}

function readmeSectionCount(summary: ScanSummary, matchers: string[]): number {
  const readme = summary.readmeContent?.toLowerCase() || "";
  return matchers.filter(matcher => readme.includes(matcher.toLowerCase())).length;
}

function hasEnterpriseReadinessFocus(summary: ScanSummary): boolean {
  return Boolean(summary.analysisProfile?.readinessFocuses?.includes("Enterprise Readiness"));
}

function getEnterpriseReadinessSignals(summary: ScanSummary) {
  const hasEnterprisePlan = hasTopLevelFile(summary, ["ENTERPRISE.md"]) || readmeIncludes(summary, ["enterprise readiness"]);
  const hasSecurityDocs = hasTopLevelFile(summary, ["SECURITY.md"]) || readmeIncludes(summary, ["security model", "threat model", "data governance"]);
  const hasPolicySignal = hasSourcePath(summary, ["policy", "rbac", "permissions", "auth"]) || readmeIncludes(summary, ["admin policy", "role-based", "rbac", "oidc", "sso"]);
  const hasAuditSignal = hasSourcePath(summary, ["audit", "logging"]) || readmeIncludes(summary, ["audit log", "audit logging"]);
  const hasManagedReleaseSignal = hasTopLevelFile(summary, ["CHANGELOG.md"]) && hasBuildScript(summary) && (summary.hasCiCd || summary.hasDocker);
  const score = [
    hasEnterprisePlan,
    hasSecurityDocs,
    hasPolicySignal,
    hasAuditSignal,
    hasManagedReleaseSignal,
  ].filter(Boolean).length * 20;

  return {
    hasEnterprisePlan,
    hasSecurityDocs,
    hasPolicySignal,
    hasAuditSignal,
    hasManagedReleaseSignal,
    score,
  };
}

function hasNativeNodeTestRunner(summary: ScanSummary): boolean {
  return hasScript(summary, ["node --test", "node:test"]);
}

function calculateScores(summary: ScanSummary) {
  const fixmeCount = summary.todoComments.filter(t => t.type === "FIXME").length;
  const hackCount = summary.todoComments.filter(t => t.type === "HACK").length;
  const todoCount = summary.todoComments.filter(t => t.type === "TODO").length;
  const deps = getDependencyNames(summary).map(dep => dep.toLowerCase());
  const srcCount = summary.srcFiles.length;
  const testDensity = srcCount > 0 ? summary.testFileCount / srcCount : 0;
  const jsProject = isJavaScriptProject(summary);

  const s = {
    coreFunctionality: 30,
    uiUxPolish: 20,
    codeQuality: 30,
    stabilityBugs: 40,
    performance: 30,
    documentation: 20,
    deploymentReadiness: 10,
    overall: 0,
  };

  // Code quality
  if (hasLinting(summary)) s.codeQuality += 14;
  if (hasTypeChecking(summary)) s.codeQuality += 14;
  if (hasFormatting(summary)) s.codeQuality += 8;
  if (hasLockfile(summary)) s.codeQuality += 6;
  if (hasBuildScript(summary)) s.codeQuality += 5;
  if (summary.hasCiCd) s.codeQuality += 5;
  if (summary.hasTests) s.codeQuality += 5;
  if (todoCount + fixmeCount + hackCount === 0) s.codeQuality += 6;
  if (hasSourcePath(summary, ["server/services", "src/components"])) s.codeQuality += 5;
  if (hasTypeScript(summary) && hasConfig(summary, ["tsconfig"])) s.codeQuality += 5;
  if (jsProject && !hasLockfile(summary)) s.codeQuality -= 8;
  if (hasTypeScript(summary) && !hasTypeChecking(summary)) s.codeQuality -= 12;
  if (srcCount > 5 && !hasLinting(summary)) s.codeQuality -= 10;
  s.codeQuality -= Math.min(todoCount * 2 + fixmeCount * 4 + hackCount * 3, 28);

  // Documentation
  if (summary.readmeContent && summary.readmeContent.length > 1800) s.documentation += 55;
  else if (summary.readmeContent && summary.readmeContent.length > 1200) s.documentation += 45;
  else if (summary.readmeContent && summary.readmeContent.length > 500) s.documentation += 35;
  else if (summary.readmeContent && summary.readmeContent.length > 100) s.documentation += 20;
  s.documentation += Math.min(readmeSectionCount(summary, ["quick start", "api", "configuration", "project structure", "what gets scanned"]) * 5, 25);
  if (readmeIncludes(summary, ["installation", "development", "production build"])) s.documentation += 5;
  if (hasTopLevelFile(summary, [".env.example"])) s.documentation += 5;
  if (hasTopLevelFile(summary, ["LICENSE", "LICENCE", "CHANGELOG.md", "CONTRIBUTING.md"])) s.documentation += 5;

  // Stability
  if (summary.hasTests) s.stabilityBugs += 18;
  if (hasTestScript(summary)) s.stabilityBugs += 10;
  if (hasNativeNodeTestRunner(summary)) s.stabilityBugs += 8;
  if (hasDependency(summary, ["playwright", "cypress", "testing-library", "vitest", "jest"])) s.stabilityBugs += 8;
  s.stabilityBugs += Math.min(summary.testFileCount * 2, 18);
  s.stabilityBugs += Math.min(Math.round(testDensity * 20), 10);
  if (summary.hasCiCd) s.stabilityBugs += 8;
  if (hasBuildScript(summary)) s.stabilityBugs += 5;
  if (hasLinting(summary)) s.stabilityBugs += 5;
  if (hasTypeChecking(summary)) s.stabilityBugs += 4;
  if (fixmeCount + hackCount === 0) s.stabilityBugs += 5;
  if (jsProject && !hasTestScript(summary)) s.stabilityBugs -= 8;
  s.stabilityBugs -= Math.min(fixmeCount * 6 + hackCount * 3, 22);

  // Deployment
  if (summary.hasCiCd) s.deploymentReadiness += 25;
  if (summary.hasDocker) s.deploymentReadiness += 18;
  if (hasBuildScript(summary)) s.deploymentReadiness += 15;
  if (hasStartScript(summary)) s.deploymentReadiness += 10;
  if (hasTestScript(summary)) s.deploymentReadiness += 6;
  if (hasLinting(summary)) s.deploymentReadiness += 5;
  if (hasLockfile(summary)) s.deploymentReadiness += 6;
  if (hasTopLevelFile(summary, [".env.example"])) s.deploymentReadiness += 5;
  if (jsProject && !hasBuildScript(summary)) s.deploymentReadiness -= 10;

  // Core functionality
  s.coreFunctionality += Math.min(srcCount / 2, 30);
  if (srcCount > 0) s.coreFunctionality += 10;
  if (hasBuildScript(summary)) s.coreFunctionality += 8;
  if (hasStartScript(summary)) s.coreFunctionality += 5;
  if (summary.gitInfo?.commitCount && summary.gitInfo.commitCount > 5) s.coreFunctionality += 5;
  if (summary.packageJson && summary.dependencyCount > 0) s.coreFunctionality += 5;
  if (summary.hasTests) s.coreFunctionality += 5;
  if (hasSourcePath(summary, ["server/routes", "server/services"])) s.coreFunctionality += 5;
  if (hasSourcePath(summary, ["src/app", "src/main", "src/components"])) s.coreFunctionality += 5;
  if (summary.hasCiCd) s.coreFunctionality += 2;
  if (srcCount === 0) s.coreFunctionality -= 10;

  // UI/UX
  const uiFrameworks = ["react", "vue", "angular", "svelte", "solid-js", "preact"];
  const uiLibs = ["tailwindcss", "styled-components", "@emotion", "bootstrap", "mui", "antd", "radix", "lucide", "framer-motion"];
  if (deps.some(d => uiFrameworks.includes(d) || d.startsWith("@angular/"))) s.uiUxPolish += 20;
  if (deps.some(d => uiLibs.some(lib => d.includes(lib)))) s.uiUxPolish += 15;
  if (hasSourcePath(summary, ["src/components"])) s.uiUxPolish += 10;
  if (hasConfig(summary, ["tailwind"])) s.uiUxPolish += 8;
  if (hasDependency(summary, ["recharts", "chart", "d3"])) s.uiUxPolish += 6;
  if (hasDependency(summary, ["@radix-ui", "cmdk", "vaul"])) s.uiUxPolish += 7;
  if (hasConfig(summary, ["postcss"])) s.uiUxPolish += 4;
  if (summary.fileTypeCounts[".css"] || summary.fileTypeCounts[".scss"] || summary.fileTypeCounts[".less"]) {
    s.uiUxPolish += 10;
  }

  // Performance
  if (hasConfig(summary, ["vite"])) s.performance += 18;
  if (hasConfig(summary, ["webpack"])) s.performance += 12;
  if (deps.some(d => ["webpack", "rollup", "esbuild", "vite", "turbo", "next"].some(tool => d.includes(tool)))) s.performance += 10;
  if (hasBuildScript(summary)) s.performance += 5;
  if (hasLockfile(summary)) s.performance += 8;
  if (summary.fileCount < 500) s.performance += 8;
  if (summary.hasCiCd) s.performance += 5;
  if (hasTypeChecking(summary)) s.performance += 5;
  if (summary.hasDocker) s.performance += 6;
  if (hasConfig(summary, ["tailwind", "postcss"])) s.performance += 4;
  if (srcCount > 0) s.performance += 3;
  if (summary.fileCount > 500 && !hasBuildScript(summary)) s.performance -= 5;

  // Clamp all to 0-100
  for (const key of Object.keys(s) as Array<keyof typeof s>) {
    if (key !== "overall") {
      s[key] = Math.round(Math.max(0, Math.min(100, s[key])));
    }
  }

  // Overall weighted average
  s.overall = Math.round(
    s.coreFunctionality * 0.25 +
    s.uiUxPolish * 0.10 +
    s.codeQuality * 0.15 +
    s.stabilityBugs * 0.15 +
    s.performance * 0.10 +
    s.documentation * 0.10 +
    s.deploymentReadiness * 0.15
  );

  return {
    overall: s.overall,
    coreFunctionality: s.coreFunctionality,
    uiUxPolish: s.uiUxPolish,
    codeQuality: s.codeQuality,
    stabilityBugs: s.stabilityBugs,
    performance: s.performance,
    documentation: s.documentation,
    deploymentReadiness: s.deploymentReadiness,
  };
}

function detectStage(summary: ScanSummary): ProjectStage {
  if (summary.fileCount < 10 || summary.srcFiles.length === 0) return "Concept";
  if (!summary.hasTests && summary.fileCount < 30) return "Prototype";
  if (!hasBuildScript(summary) && summary.fileCount < 50) return "Prototype";
  if (!summary.hasTests || !hasTestScript(summary)) return "MVP";
  if (!summary.hasCiCd || !hasLinting(summary) || (hasTypeScript(summary) && !hasTypeChecking(summary))) return "Beta";
  if (summary.todoComments.length > 20) return "Beta";
  return "Production-ready";
}

function detectTechStack(summary: ScanSummary): string[] {
  const stack: string[] = [];
  const deps = Object.keys(summary.packageJson?.dependencies || {});
  const devDeps = Object.keys(summary.packageJson?.devDependencies || {});
  const allDeps = [...deps, ...devDeps];

  // Detect languages
  const langMap: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".py": "Python",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".cpp": "C++",
    ".c": "C",
  };

  for (const [ext, lang] of Object.entries(langMap)) {
    if (summary.fileTypeCounts[ext] && summary.fileTypeCounts[ext] > 0) {
      if (!stack.includes(lang)) stack.push(lang);
    }
  }

  // Detect frameworks
  const frameworkMap: Record<string, string> = {
    react: "React",
    vue: "Vue",
    angular: "Angular",
    svelte: "Svelte",
    express: "Express",
    next: "Next.js",
    nestjs: "NestJS",
    fastify: "Fastify",
    django: "Django",
    flask: "Flask",
    fastapi: "FastAPI",
    spring: "Spring Boot",
    laravel: "Laravel",
    rails: "Ruby on Rails",
  };

  for (const [pkg, name] of Object.entries(frameworkMap)) {
    if (deps.some(d => d === pkg || d.startsWith(`${pkg}/`))) {
      stack.push(name);
    }
  }

  // Detect tools
  if (allDeps.some(d => d === "tailwindcss" || d.startsWith("tailwind"))) stack.push("Tailwind CSS");
  if (allDeps.some(d => d.includes("webpack"))) stack.push("Webpack");
  if (allDeps.some(d => d.includes("vite"))) stack.push("Vite");
  if (allDeps.some(d => d.includes("eslint"))) stack.push("ESLint");
  if (allDeps.some(d => d.includes("prettier"))) stack.push("Prettier");
  if (allDeps.some(d => d.includes("jest") || d.includes("vitest"))) stack.push("Testing");
  if (summary.hasDocker) stack.push("Docker");
  if (summary.hasCiCd) stack.push("CI/CD");

  return stack.length > 0 ? stack.slice(0, 10) : ["Unknown"];
}

function inferPurpose(summary: ScanSummary): string {
  if (summary.readmeContent) {
    // Take first sentence or first 150 chars
    const firstLine = summary.readmeContent.split("\n").find(l => l.trim().length > 10);
    if (firstLine) {
      const sentence = firstLine.trim().slice(0, 150);
      return sentence.endsWith(".") ? sentence : sentence + "...";
    }
  }

  const deps = Object.keys(summary.packageJson?.dependencies || {});
  if (deps.some(d => ["react", "vue", "angular"].includes(d))) {
    return "A web application built with modern frontend frameworks.";
  }
  if (deps.some(d => ["express", "fastify", "koa"].includes(d))) {
    return "A Node.js backend API or server application.";
  }
  if (deps.includes("electron")) {
    return "A desktop application built with Electron.";
  }
  if (summary.fileTypeCounts[".py"] && summary.fileTypeCounts[".py"] > 0) {
    return "A Python-based application or tool.";
  }

  return "A software project — purpose could not be automatically determined from available files.";
}

function buildSummary(summary: ScanSummary, stage: ProjectStage, scores: { overall: number }): string {
  const parts: string[] = [];
  parts.push(`This ${stage.toLowerCase()}-stage project has ${summary.fileCount} files and approximately ${summary.totalLinesOfCode} lines of code.`);

  if (summary.hasTests) {
    parts.push(`Testing is in place with ${summary.testFileCount} test files.`);
  } else {
    parts.push(`No test files were detected, which is a gap worth addressing.`);
  }

  if (summary.gitInfo?.isGitRepo) {
    parts.push(`Git repo on branch '${summary.gitInfo.branch}' with ${summary.gitInfo.commitCount} commits.`);
  }

  if (scores.overall < 50) {
    parts.push(`Overall completion is at ${scores.overall}% — there's significant work ahead.`);
  } else if (scores.overall < 75) {
    parts.push(`Overall completion is at ${scores.overall}% — solid progress with room for polish.`);
  } else {
    parts.push(`Overall completion is at ${scores.overall}% — the project is in good shape.`);
  }

  return parts.join(" ");
}

function inferWorkingAreas(summary: ScanSummary) {
  const areas: Array<{ area: string; details: string }> = [];

  if (summary.srcFiles.length > 0) {
    areas.push({ area: "Source code structure", details: `${summary.srcFiles.length} source files organized in the project` });
  }
  if (summary.gitInfo?.isGitRepo) {
    areas.push({ area: "Version control", details: `Git initialized with ${summary.gitInfo.commitCount} commits` });
  }
  if (summary.packageJson) {
    areas.push({ area: "Dependency management", details: `${summary.dependencyCount} dependencies configured` });
  }
  if (summary.readmeContent) {
    areas.push({ area: "Documentation", details: "README file present with project information" });
  }
  if (summary.configFiles.length > 0) {
    areas.push({ area: "Configuration", details: `${summary.configFiles.length} config files for tooling` });
  }

  return areas;
}

function inferIssues(summary: ScanSummary) {
  const issues: Array<{ problem: string; evidence: string; severity: "Low" | "Medium" | "High"; suggestedFix: string }> = [];

  if (!summary.hasTests) {
    issues.push({
      problem: "No test coverage detected",
      evidence: "No test files (.test.*, .spec.*) found in the project",
      severity: "High",
      suggestedFix: "Add unit tests for critical functions. Start with a testing framework like Jest or Vitest.",
    });
  }

  if (summary.hasTests && !hasTestScript(summary)) {
    issues.push({
      problem: "Tests exist but no test script was detected",
      evidence: "Test files are present, but package scripts do not expose a clear test command",
      severity: "Medium",
      suggestedFix: "Add a test script so tests can be run consistently by developers and CI.",
    });
  }

  if (isJavaScriptProject(summary) && !hasBuildScript(summary)) {
    issues.push({
      problem: "Missing build script",
      evidence: "No package script for build or compile was detected",
      severity: "Medium",
      suggestedFix: "Add a build script that verifies the project can compile for release.",
    });
  }

  if (summary.srcFiles.length > 5 && !hasLinting(summary)) {
    issues.push({
      problem: "No linting configured",
      evidence: "No lint script, ESLint config, or equivalent linting dependency was detected",
      severity: "Medium",
      suggestedFix: "Add linting to catch style, correctness, and maintainability issues early.",
    });
  }

  if (hasTypeScript(summary) && !hasTypeChecking(summary)) {
    issues.push({
      problem: "TypeScript files without type-checking gate",
      evidence: "TypeScript source files exist, but no tsconfig/typecheck signal was detected",
      severity: "High",
      suggestedFix: "Add tsconfig and a typecheck script so type errors are caught before runtime.",
    });
  }

  if (summary.packageJson && !hasLockfile(summary)) {
    issues.push({
      problem: "Missing dependency lockfile",
      evidence: "package.json exists, but no npm/pnpm/yarn/bun lockfile was found at the project root",
      severity: "Medium",
      suggestedFix: "Commit a package manager lockfile to make installs reproducible.",
    });
  }

  const fixmeCount = summary.todoComments.filter(t => t.type === "FIXME").length;
  if (fixmeCount > 0) {
    issues.push({
      problem: `${fixmeCount} FIXME comments in code`,
      evidence: `Found ${fixmeCount} FIXME markers indicating known broken or incomplete code`,
      severity: fixmeCount > 5 ? "High" : "Medium",
      suggestedFix: "Address FIXME items one by one. Start with the most critical paths.",
    });
  }

  const todoCount = summary.todoComments.filter(t => t.type === "TODO").length;
  if (todoCount > 10) {
    issues.push({
      problem: "High number of pending TODOs",
      evidence: `${todoCount} TODO comments found across the codebase`,
      severity: "Medium",
      suggestedFix: "Prioritize TODOs and convert the most important ones into tracked issues or tasks.",
    });
  }

  if (!summary.readmeContent) {
    issues.push({
      problem: "Missing README documentation",
      evidence: "No README file found in project root",
      severity: "Medium",
      suggestedFix: "Create a README.md with project description, setup instructions, and contribution guide.",
    });
  }

  if (summary.gitInfo?.hasUncommittedChanges) {
    issues.push({
      problem: "Uncommitted changes in git",
      evidence: `${summary.gitInfo.modifiedFiles.length} files have uncommitted changes`,
      severity: "Low",
      suggestedFix: "Commit or stash current changes to keep the working directory clean.",
    });
  }

  if (!summary.hasCiCd) {
    issues.push({
      problem: "No CI/CD pipeline configured",
      evidence: "No GitHub Actions, GitLab CI, or other CI configuration found",
      severity: "Medium",
      suggestedFix: "Set up a basic CI workflow (e.g., GitHub Actions) to run tests and lint on every push.",
    });
  }

  if (hasEnterpriseReadinessFocus(summary)) {
    const enterprise = getEnterpriseReadinessSignals(summary);
    if (!enterprise.hasEnterprisePlan) {
      issues.push({
        problem: "Enterprise readiness plan missing",
        evidence: "Enterprise Readiness is selected, but no ENTERPRISE.md or enterprise readiness documentation was detected",
        severity: "Medium",
        suggestedFix: "Add an enterprise readiness plan covering security, governance, deployment, compliance, and supportability.",
      });
    }
    if (!enterprise.hasPolicySignal) {
      issues.push({
        problem: "No enterprise policy or access-control model detected",
        evidence: "No auth, RBAC, permissions, admin policy, SSO, or OIDC signals were found",
        severity: "Medium",
        suggestedFix: "Define the policy and access-control model before implementing enterprise-only behavior.",
      });
    }
    if (!enterprise.hasAuditSignal) {
      issues.push({
        problem: "No audit logging model detected",
        evidence: "Enterprise deployments need traceable analysis, policy, export, and configuration events",
        severity: "Medium",
        suggestedFix: "Add an audit event model and decide where audit logs are stored or exported.",
      });
    }
  }

  return issues;
}

function inferNextWins(summary: ScanSummary) {
  const wins: Array<{ task: string; whyItMatters: string; difficulty: "Easy" | "Medium" | "Hard"; estimatedTime: "15 min" | "30 min" | "1 hour" | "2+ hours"; filesLikelyInvolved: string[] }> = [];
  const accessibilityItems = inferAccessibilityStandards(summary);
  const publishingItems = inferPublishingReadiness(summary);

  if (!summary.readmeContent) {
    wins.push({
      task: "Add a README.md file",
      whyItMatters: "Every project needs documentation. A README helps collaborators understand and set up the project.",
      difficulty: "Easy",
      estimatedTime: "30 min",
      filesLikelyInvolved: ["README.md"],
    });
  }

  const fixmes = summary.todoComments.filter(t => t.type === "FIXME");
  if (fixmes.length > 0) {
    wins.push({
      task: `Fix the top FIXME: ${fixmes[0].text.slice(0, 60)}`,
      whyItMatters: "FIXMEs indicate known broken code. Fixing them prevents bugs from reaching production.",
      difficulty: fixmes.length > 5 ? "Medium" : "Easy",
      estimatedTime: "30 min",
      filesLikelyInvolved: [fixmes[0].file],
    });
  }

  if (!summary.hasTests) {
    wins.push({
      task: "Add a basic test for the main functionality",
      whyItMatters: "Tests catch regressions and give confidence when refactoring. Start with one critical path.",
      difficulty: "Medium",
      estimatedTime: "1 hour",
      filesLikelyInvolved: ["package.json", ...(summary.srcFiles.slice(0, 1))],
    });
  }

  if (summary.hasTests && !hasTestScript(summary)) {
    wins.push({
      task: "Add a package test script",
      whyItMatters: "A standard test command makes local verification and CI setup reliable.",
      difficulty: "Easy",
      estimatedTime: "15 min",
      filesLikelyInvolved: ["package.json"],
    });
  }

  if (isJavaScriptProject(summary) && !hasBuildScript(summary)) {
    wins.push({
      task: "Add a build script",
      whyItMatters: "A build command gives you a fast release-readiness check before deployment.",
      difficulty: "Easy",
      estimatedTime: "15 min",
      filesLikelyInvolved: ["package.json"],
    });
  }

  if (summary.srcFiles.length > 5 && !hasLinting(summary)) {
    wins.push({
      task: "Add linting for source files",
      whyItMatters: "Linting catches common mistakes and keeps future changes easier to review.",
      difficulty: "Medium",
      estimatedTime: "1 hour",
      filesLikelyInvolved: ["package.json"],
    });
  }

  if (hasTypeScript(summary) && !hasTypeChecking(summary)) {
    wins.push({
      task: "Add a TypeScript typecheck command",
      whyItMatters: "Type checking catches integration mistakes before they become runtime bugs.",
      difficulty: "Easy",
      estimatedTime: "30 min",
      filesLikelyInvolved: ["package.json", "tsconfig.json"],
    });
  }

  if (summary.packageJson && !hasLockfile(summary)) {
    wins.push({
      task: "Commit a package manager lockfile",
      whyItMatters: "A lockfile makes dependency installs reproducible across machines and CI.",
      difficulty: "Easy",
      estimatedTime: "15 min",
      filesLikelyInvolved: ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
    });
  }

  if (summary.gitInfo?.hasUncommittedChanges) {
    wins.push({
      task: "Commit uncommitted changes",
      whyItMatters: "Keeping a clean working directory prevents accidental loss of work and makes context switching easier.",
      difficulty: "Easy",
      estimatedTime: "15 min",
      filesLikelyInvolved: summary.gitInfo.modifiedFiles.slice(0, 5),
    });
  }

  if (hasEnterpriseReadinessFocus(summary)) {
    const enterpriseWin = inferEnterpriseReadinessWin(summary);
    if (enterpriseWin && wins.length < 6) wins.push(enterpriseWin);
  }

  if (!summary.hasCiCd && summary.hasTests) {
    wins.push({
      task: "Set up a GitHub Actions CI workflow",
      whyItMatters: "Automated CI ensures code quality on every push and catches issues early.",
      difficulty: "Medium",
      estimatedTime: "1 hour",
      filesLikelyInvolved: [".github/workflows/ci.yml"],
    });
  }

  const accessibilityWin = accessibilityItems.find(item => item.status === "Needs work");
  if (accessibilityWin && wins.length < 6) {
    wins.push({
      task: accessibilityWin.nextStep,
      whyItMatters: `${accessibilityWin.standard} is part of the selected analysis profile.`,
      difficulty: "Easy",
      estimatedTime: "30 min",
      filesLikelyInvolved: accessibilityWin.filesLikelyInvolved,
    });
  }

  const publishingWin = publishingItems.find(item => item.status === "Needs work");
  if (publishingWin && wins.length < 6) {
    wins.push({
      task: publishingWin.nextStep,
      whyItMatters: `${publishingWin.target} publishing readiness is part of the selected analysis profile.`,
      difficulty: "Easy",
      estimatedTime: "30 min",
      filesLikelyInvolved: publishingWin.filesLikelyInvolved,
    });
  }

  const todos = summary.todoComments.filter(t => t.type === "TODO");
  if (todos.length > 0 && wins.length < 3) {
    wins.push({
      task: `Address TODO: ${todos[0].text.slice(0, 60)}`,
      whyItMatters: "Clearing TODOs reduces technical debt and keeps the codebase maintainable.",
      difficulty: "Easy",
      estimatedTime: "30 min",
      filesLikelyInvolved: [todos[0].file],
    });
  }

  return wins.slice(0, 6);
}

function inferEnterpriseReadinessWin(summary: ScanSummary) {
  const enterprise = getEnterpriseReadinessSignals(summary);

  if (!enterprise.hasEnterprisePlan) {
    return {
      task: "Create an enterprise readiness plan",
      whyItMatters: "Enterprise Readiness is selected, so the report should assess governance, security, deployment, and compliance requirements explicitly.",
      difficulty: "Easy" as const,
      estimatedTime: "30 min" as const,
      filesLikelyInvolved: ["ENTERPRISE.md"],
    };
  }

  if (!enterprise.hasPolicySignal) {
    return {
      task: "Define the enterprise policy and access-control model",
      whyItMatters: "Enterprise teams need a clear policy boundary before SSO, RBAC, audit logging, or managed deployment work begins.",
      difficulty: "Medium" as const,
      estimatedTime: "1 hour" as const,
      filesLikelyInvolved: ["ENTERPRISE.md", "server"],
    };
  }

  if (!enterprise.hasAuditSignal) {
    return {
      task: "Add an audit logging design",
      whyItMatters: "Auditability is a core enterprise requirement for analysis actions, policy decisions, exports, and configuration changes.",
      difficulty: "Medium" as const,
      estimatedTime: "1 hour" as const,
      filesLikelyInvolved: ["ENTERPRISE.md", "server"],
    };
  }

  return null;
}

function inferAccessibilityStandards(summary: ScanSummary): ProjectReport["accessibilityStandards"] {
  const profile = summary.analysisProfile;
  const standards = profile?.accessibilityStandards?.length
    ? profile.accessibilityStandards
    : ["WCAG 2.2 AA" as const];
  const hasUiTarget = !profile || profile.platforms.some(platform => ["Web", "Mobile", "Desktop", "Game"].includes(platform));
  const files = likelyUiFiles(summary);
  const hasAccessibilitySignals = hasDependency(summary, ["@axe-core", "axe-core", "jest-axe", "storybook"]) ||
    hasSourcePath(summary, ["accessibility", "a11y", "aria"]);

  if (!hasUiTarget) {
    return standards.map(standard => ({
      standard,
      status: "Ready",
      issue: "No user-facing UI target is selected for this analysis.",
      nextStep: "Keep API and CLI output readable, predictable, and well documented.",
      filesLikelyInvolved: ["README.md"],
    }));
  }

  return standards.map(standard => ({
    standard,
    status: hasAccessibilitySignals ? "Ready" : "Needs work",
    issue: hasAccessibilitySignals
      ? "Accessibility tooling or implementation signals were detected."
      : `No explicit checks for ${standard} were detected in the scan.`,
    nextStep: hasAccessibilitySignals
      ? `Keep ${standard} checks in the release checklist.`
      : `Add a focused ${standard} pass for keyboard flow, labels, contrast, and focus states.`,
    filesLikelyInvolved: files,
  }));
}

function inferPublishingReadiness(summary: ScanSummary): ProjectReport["publishingReadiness"] {
  const targets = summary.analysisProfile?.publishingTargets?.length
    ? summary.analysisProfile.publishingTargets
    : ["GitHub release" as const];

  return targets.map(target => {
    if (target === "Web/PWA") {
      const hasManifest = hasTopLevelFile(summary, ["manifest.json"]) || hasSourcePath(summary, ["manifest.json"]);
      const hasPublicManifest = hasConfig(summary, ["manifest.json"]) || readmeIncludes(summary, ["web manifest", "manifest.json"]);
      return {
        target,
        status: hasBuildScript(summary) && (hasManifest || hasPublicManifest) ? "Ready" as const : "Needs work" as const,
        requirement: "Production build, web manifest, and deploy notes.",
        nextStep: hasBuildScript(summary)
          ? "Add or verify the web app manifest and deployment checklist."
          : "Add a production build script before preparing a Web/PWA release.",
        filesLikelyInvolved: ["package.json", "README.md", "public/manifest.json"],
      };
    }

    if (target === "Steam") {
      const hasSteamSignal = readmeIncludes(summary, ["steam"]) || hasConfig(summary, ["steam"]);
      return {
        target,
        status: hasSteamSignal ? "Ready" as const : "Needs work" as const,
        requirement: "Store assets, build packaging, controller notes, and platform requirements.",
        nextStep: "Create a Steam release checklist covering assets, controller support, and depot packaging.",
        filesLikelyInvolved: ["README.md", "package.json"],
      };
    }

    if (target === "Apple App Store") {
      const hasIosSignal = hasSourcePath(summary, ["ios/", "appstore", "xcode"]) || hasConfig(summary, ["ios", "xcode"]);
      return {
        target,
        status: hasIosSignal ? "Ready" as const : "Needs work" as const,
        requirement: "iOS build settings, signing, privacy labels, screenshots, and review notes.",
        nextStep: "Document App Store signing, privacy, screenshot, and review requirements.",
        filesLikelyInvolved: ["README.md", "ios"],
      };
    }

    if (target === "Google Play") {
      const hasAndroidSignal = hasSourcePath(summary, ["android/", "play-store"]) || hasConfig(summary, ["android", "gradle"]);
      return {
        target,
        status: hasAndroidSignal ? "Ready" as const : "Needs work" as const,
        requirement: "Android build, signing, Play listing, privacy policy, and target API readiness.",
        nextStep: "Document Play Store signing, target API, listing, and privacy requirements.",
        filesLikelyInvolved: ["README.md", "android"],
      };
    }

    if (target === "Microsoft Store") {
      return {
        target,
        status: hasConfig(summary, ["appx", "msix", "electron-builder"]) ? "Ready" as const : "Needs work" as const,
        requirement: "MSIX/AppX packaging, identity, signing, screenshots, and store metadata.",
        nextStep: "Add Microsoft Store packaging and metadata notes to the release checklist.",
        filesLikelyInvolved: ["README.md", "package.json"],
      };
    }

    if (target === "Mac notarized app") {
      return {
        target,
        status: hasConfig(summary, ["electron-builder", "tauri"]) && readmeIncludes(summary, ["notar"]) ? "Ready" as const : "Needs work" as const,
        requirement: "macOS signing, notarization, entitlements, and distribution notes.",
        nextStep: "Add macOS signing and notarization steps to release documentation.",
        filesLikelyInvolved: ["README.md", "package.json"],
      };
    }

    if (target === "Linux package") {
      return {
        target,
        status: hasConfig(summary, ["appimage", "deb", "rpm", "flatpak"]) ? "Ready" as const : "Needs work" as const,
        requirement: "Package format, desktop metadata, icon assets, and install instructions.",
        nextStep: "Choose the Linux package format and document packaging steps.",
        filesLikelyInvolved: ["README.md", "package.json"],
      };
    }

    return {
      target,
      status: summary.gitInfo?.isGitRepo && summary.readmeContent ? "Ready" as const : "Needs work" as const,
      requirement: "Versioning, changelog, packaged artifacts, and release notes.",
      nextStep: "Add a GitHub release checklist with versioning, artifacts, and changelog steps.",
      filesLikelyInvolved: ["README.md", "CHANGELOG.md"],
    };
  });
}

function likelyUiFiles(summary: ScanSummary): string[] {
  const files = summary.srcFiles
    .filter(file => /\.(tsx|jsx|vue|svelte|css|scss|html)$/i.test(file))
    .slice(0, 4);
  return files.length > 0 ? files : summary.srcFiles.slice(0, 3);
}

function inferBuildOrder(summary: ScanSummary, stage: ProjectStage): string[] {
  const order: string[] = [];

  if (stage === "Concept" || stage === "Prototype") {
    order.push("Define core functionality and user flows");
    order.push("Set up project structure and build tooling");
    order.push("Implement the main feature(s)");
    order.push("Add basic error handling");
  }

  if (!summary.readmeContent) order.push("Write README with setup and usage instructions");
  if (summary.packageJson && !hasLockfile(summary)) order.push("Commit a dependency lockfile");
  if (isJavaScriptProject(summary) && !hasBuildScript(summary)) order.push("Add a build script that verifies the project compiles");
  if (summary.srcFiles.length > 5 && !hasLinting(summary)) order.push("Add linting and code formatting");
  if (hasTypeScript(summary) && !hasTypeChecking(summary)) order.push("Add TypeScript type checking");
  if (!summary.hasTests) order.push("Add test coverage for critical paths");
  if (summary.hasTests && !hasTestScript(summary)) order.push("Expose tests through a package script");
  if (summary.todoComments.length > 0) order.push("Resolve TODO and FIXME items");
  if (!summary.hasCiCd) order.push("Set up CI/CD pipeline");
  if (!summary.hasDocker) order.push("Add Docker configuration for deployment");
  if (hasEnterpriseReadinessFocus(summary)) {
    const enterprise = getEnterpriseReadinessSignals(summary);
    if (!enterprise.hasEnterprisePlan) order.push("Document enterprise readiness scope and deployment modes");
    if (!enterprise.hasPolicySignal) order.push("Define enterprise policy, identity, and access-control requirements");
    if (!enterprise.hasAuditSignal) order.push("Design audit logging for analysis and administration actions");
    if (!enterprise.hasManagedReleaseSignal) order.push("Prepare managed release, versioning, and rollback documentation");
  }

  order.push("Review and optimize performance bottlenecks");
  order.push("Polish UI/UX and responsive design");
  order.push("Prepare for production deployment");

  return order;
}

function inferRisks(summary: ScanSummary): string[] {
  const risks: string[] = [];

  if (summary.gitInfo?.hasUncommittedChanges) {
    risks.push("Uncommitted changes could be lost — commit or stash before switching tasks");
  }

  const fixmeCount = summary.todoComments.filter(t => t.type === "FIXME").length;
  if (fixmeCount > 5) {
    risks.push(`${fixmeCount} FIXME items indicate known broken code that could cause production issues`);
  }

  if (!summary.hasTests) {
    risks.push("No automated tests — regressions will be caught late or not at all");
  }

  if (summary.dependencyCount > 100) {
    risks.push(`Large dependency tree (${summary.dependencyCount} deps) increases supply chain risk and bundle size`);
  }

  if (!summary.hasCiCd) {
    risks.push("No CI/CD — manual deployments are error-prone and slow");
  }

  if (!summary.readmeContent) {
    risks.push("Missing documentation makes onboarding and maintenance difficult");
  }

  if (hasEnterpriseReadinessFocus(summary)) {
    const enterprise = getEnterpriseReadinessSignals(summary);
    if (!enterprise.hasPolicySignal) {
      risks.push("Enterprise Readiness is selected but no policy or access-control model is documented");
    }
    if (!enterprise.hasAuditSignal) {
      risks.push("Enterprise Readiness is selected but no audit logging model is documented");
    }
  }

  return risks;
}

function inferTodayPlan(
  summary: ScanSummary,
  issues: Array<{ problem: string; severity: string }>,
  wins: Array<{ task: string; filesLikelyInvolved: string[] }>
) {
  const plan: Array<{ task: string; filesToOpen: string[]; successLooksLike: string }> = [];

  // Pick top 3 items combining urgency and feasibility
  const highPriorityIssues = issues.filter(i => i.severity === "High");

  if (highPriorityIssues.length > 0) {
    plan.push({
      task: highPriorityIssues[0].problem,
      filesToOpen: wins.find(w => w.task.includes(highPriorityIssues[0].problem.split(" ").slice(0, 3).join(" ")))?.filesLikelyInvolved || [],
      successLooksLike: `${highPriorityIssues[0].problem} is resolved and verified`,
    });
  }

  if (wins.length > 0 && plan.length < 3) {
    const win = wins[0];
    if (!plan.some(p => p.task === win.task)) {
      plan.push({
        task: win.task,
        filesToOpen: win.filesLikelyInvolved,
        successLooksLike: completionSentence(win.task, "is completed and committed"),
      });
    }
  }

  if (summary.gitInfo?.hasUncommittedChanges && plan.length < 3) {
    plan.push({
      task: "Commit or stash uncommitted changes",
      filesToOpen: summary.gitInfo.modifiedFiles.slice(0, 3),
      successLooksLike: "Working directory is clean (git status shows no changes)",
    });
  }

  if (plan.length < 3 && wins.length > 1) {
    const win = wins[1];
    if (!plan.some(p => p.task === win.task)) {
      plan.push({
        task: win.task,
        filesToOpen: win.filesLikelyInvolved,
        successLooksLike: completionSentence(win.task, "is completed"),
      });
    }
  }

  return plan.slice(0, 3);
}

function completionSentence(task: string, outcome: string): string {
  const normalized = task.trim().replace(/[.!?]+$/g, "");
  return `${normalized} ${outcome}`;
}

function trackerStatus(score: number, completeAt = 70, activeAt = 30) {
  if (score >= completeAt) return "Complete" as const;
  if (score > activeAt) return "In Progress" as const;
  return "Not Started" as const;
}

function codeQualityAction(summary: ScanSummary): string {
  if (hasTypeScript(summary) && !hasTypeChecking(summary)) return "Add TypeScript type checking";
  if (summary.srcFiles.length > 5 && !hasLinting(summary)) return "Add linting and formatting";
  if (!hasFormatting(summary)) return "Add a formatter or formatting script";
  if (summary.packageJson && !hasLockfile(summary)) return "Commit a dependency lockfile";
  if (summary.todoComments.length > 0) return "Resolve TODO/FIXME markers";
  return "Refactor complex areas and keep quality gates green";
}

function stabilityAction(summary: ScanSummary): string {
  const fixmeCount = summary.todoComments.filter(t => t.type === "FIXME").length;
  if (!summary.hasTests) return "Add tests for the main critical path";
  if (!hasTestScript(summary)) return "Expose tests through a package script";
  if (fixmeCount > 0) return "Fix known FIXME items";
  return "Expand coverage around edge cases";
}

function deploymentAction(summary: ScanSummary): string {
  if (isJavaScriptProject(summary) && !hasBuildScript(summary)) return "Add a production build script";
  if (!hasCiSignal(summary)) return "Set up CI to run build and tests";
  if (!hasLockfile(summary) && summary.packageJson) return "Commit a dependency lockfile";
  if (!summary.hasDocker) return "Add deployment packaging or Docker";
  return "Document production configuration and release steps";
}

function enterpriseReadinessAction(summary: ScanSummary): string {
  const enterprise = getEnterpriseReadinessSignals(summary);
  if (!enterprise.hasEnterprisePlan) return "Create ENTERPRISE.md with governance and security readiness criteria";
  if (!enterprise.hasPolicySignal) return "Define enterprise policy, SSO/RBAC, and allowed-project controls";
  if (!enterprise.hasAuditSignal) return "Design audit logging for analysis and administration events";
  if (!enterprise.hasManagedReleaseSignal) return "Document managed release, signing, update, and rollback steps";
  return "Validate enterprise acceptance criteria with a security reviewer";
}

function hasCiSignal(summary: ScanSummary): boolean {
  return summary.hasCiCd || hasConfig(summary, ["github/workflows", "gitlab-ci", "circleci", "azure-pipelines"]);
}

function buildTrackerTable(summary: ScanSummary, scores: { overall: number; coreFunctionality: number; uiUxPolish: number; codeQuality: number; stabilityBugs: number; performance: number; documentation: number; deploymentReadiness: number }) {
  const rows = [
    {
      area: "Core Functionality",
      status: trackerStatus(scores.coreFunctionality, 80, 20),
      completionPercent: scores.coreFunctionality,
      priority: scores.coreFunctionality < 40 ? "High" as const : "Medium" as const,
      nextAction: summary.srcFiles.length === 0
        ? "Add the first source files for the core workflow"
        : !hasBuildScript(summary) && isJavaScriptProject(summary)
          ? "Add a build script to verify core functionality"
          : "Refine and extend existing features",
    },
    {
      area: "UI/UX Polish",
      status: trackerStatus(scores.uiUxPolish),
      completionPercent: scores.uiUxPolish,
      priority: scores.uiUxPolish < 30 ? "Medium" as const : "Low" as const,
      nextAction: scores.uiUxPolish < 50
        ? "Add styling, responsive states, and interaction polish"
        : "Refine visual details and accessibility states",
    },
    {
      area: "Code Quality",
      status: trackerStatus(scores.codeQuality),
      completionPercent: scores.codeQuality,
      priority: scores.codeQuality < 40 ? "High" as const : "Medium" as const,
      nextAction: codeQualityAction(summary),
    },
    {
      area: "Stability & Bugs",
      status: trackerStatus(scores.stabilityBugs),
      completionPercent: scores.stabilityBugs,
      priority: scores.stabilityBugs < 40 ? "High" as const : "Medium" as const,
      nextAction: stabilityAction(summary),
    },
    {
      area: "Performance",
      status: trackerStatus(scores.performance),
      completionPercent: scores.performance,
      priority: scores.performance < 30 ? "Medium" as const : "Low" as const,
      nextAction: hasBuildScript(summary)
        ? "Measure build output and optimize critical paths"
        : "Add a build step before performance auditing",
    },
    {
      area: "Documentation",
      status: trackerStatus(scores.documentation, 70, 20),
      completionPercent: scores.documentation,
      priority: scores.documentation < 30 ? "High" as const : "Medium" as const,
      nextAction: !summary.readmeContent
        ? "Write README with setup and usage instructions"
        : "Add contribution, release, or API documentation",
    },
    {
      area: "Deployment Readiness",
      status: trackerStatus(scores.deploymentReadiness),
      completionPercent: scores.deploymentReadiness,
      priority: scores.deploymentReadiness < 40 ? "High" as const : "Medium" as const,
      nextAction: deploymentAction(summary),
    },
  ];

  if (hasEnterpriseReadinessFocus(summary)) {
    const enterprise = getEnterpriseReadinessSignals(summary);
    rows.push({
      area: "Enterprise Readiness",
      status: trackerStatus(enterprise.score),
      completionPercent: enterprise.score,
      priority: enterprise.score < 40 ? "High" as const : "Medium" as const,
      nextAction: enterpriseReadinessAction(summary),
    });
  }

  return rows;
}

/**
 * Normalize and validate a report from OpenAI, filling in defaults for missing fields.
 */
function getAnalyzerProvider(): AnalyzerProvider {
  const provider = process.env.ANALYZER_PROVIDER?.trim().toLowerCase();
  if (provider === "local" || provider === "openai" || provider === "heuristics" || provider === "auto") {
    return provider;
  }
  return "auto";
}

function hasOpenAIKey(apiKey: string | undefined): apiKey is string {
  return Boolean(apiKey && apiKey.trim().length > 0 && apiKey !== "your_openai_api_key_here");
}

function parseModelJson(content: string): Record<string, unknown> {
  const cleanJson = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  try {
    const parsed = JSON.parse(cleanJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const start = cleanJson.indexOf("{");
    const end = cleanJson.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(cleanJson.slice(start, end + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }
  }

  throw new Error("Model response did not contain a valid JSON object.");
}

function normalizeReport(raw: Record<string, unknown>, summary: ScanSummary, options: NormalizeOptions = {}): ProjectReport {
  const fallback = options.baseReport || analyzeWithHeuristics(summary);
  const rawScores = (raw.scores as Record<string, unknown>) || {};
  const scores = options.preserveMetrics
    ? fallback.scores
    : {
        overall: clampScore(rawScores.overall, fallback.scores.overall),
        coreFunctionality: clampScore(rawScores.coreFunctionality, fallback.scores.coreFunctionality),
        uiUxPolish: clampScore(rawScores.uiUxPolish, fallback.scores.uiUxPolish),
        codeQuality: clampScore(rawScores.codeQuality, fallback.scores.codeQuality),
        stabilityBugs: clampScore(rawScores.stabilityBugs, fallback.scores.stabilityBugs),
        performance: clampScore(rawScores.performance, fallback.scores.performance),
        documentation: clampScore(rawScores.documentation, fallback.scores.documentation),
        deploymentReadiness: clampScore(rawScores.deploymentReadiness, fallback.scores.deploymentReadiness),
      };

  const report: ProjectReport = {
    projectName: options.preserveMetrics ? fallback.projectName : (raw.projectName as string) || fallback.projectName,
    purpose: (raw.purpose as string) || fallback.purpose,
    techStack: options.preserveMetrics ? fallback.techStack : Array.isArray(raw.techStack) ? raw.techStack as string[] : fallback.techStack,
    stage: options.preserveMetrics ? fallback.stage : (raw.stage as ProjectStage) || fallback.stage,
    summary: (raw.summary as string) || fallback.summary,
    scores,
    working: normalizeWorking(raw, fallback),
    needsFixing: normalizeIssues(raw, fallback),
    nextEasyWins: normalizeEasyWins(raw, fallback),
    accessibilityStandards: normalizeAccessibilityStandards(raw, fallback),
    publishingReadiness: normalizePublishingReadiness(raw, fallback),
    buildOrder: normalizeStringList(raw.buildOrder, fallback.buildOrder),
    risks: normalizeStringList(raw.risks, fallback.risks),
    todayPlan: normalizeTodayPlan(raw, fallback),
    trackerTable: options.preserveMetrics ? fallback.trackerTable : Array.isArray(raw.trackerTable) ? raw.trackerTable as ProjectReport["trackerTable"] : fallback.trackerTable,
    confidence: (raw.confidence as Confidence) || fallback.confidence,
    analysisProfile: summary.analysisProfile || fallback.analysisProfile,
  };

  return ensureActionSections(report, fallback);
}

function normalizeWorking(raw: Record<string, unknown>, fallback: ProjectReport): ProjectReport["working"] {
  if (Array.isArray(raw.working) && raw.working.length > 0) {
    const items = (raw.working as ProjectReport["working"])
      .filter(item => item?.area && !isPlaceholderText(item.area));
    if (items.length > 0) return items;
  }
  if (Array.isArray(raw.workingAreas)) {
    return raw.workingAreas
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0 && !isPlaceholderText(item))
      .slice(0, 4)
      .map(item => ({ area: item, details: item }));
  }
  return fallback.working;
}

function normalizeIssues(raw: Record<string, unknown>, fallback: ProjectReport): ProjectReport["needsFixing"] {
  if (Array.isArray(raw.needsFixing) && raw.needsFixing.length > 0) {
    const items = (raw.needsFixing as ProjectReport["needsFixing"])
      .filter(item => item?.problem && !isPlaceholderText(item.problem));
    if (items.length > 0) return items;
  }
  if (Array.isArray(raw.issues)) {
    return raw.issues
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0 && !isPlaceholderText(item))
      .slice(0, 4)
      .map(item => ({
        problem: item,
        evidence: item,
        severity: "Medium" as const,
        suggestedFix: `Address ${item}`,
      }));
  }
  return fallback.needsFixing;
}

function normalizeEasyWins(raw: Record<string, unknown>, fallback: ProjectReport): ProjectReport["nextEasyWins"] {
  if (Array.isArray(raw.nextEasyWins) && raw.nextEasyWins.length > 0) {
    const items = (raw.nextEasyWins as ProjectReport["nextEasyWins"])
      .filter(item => item?.task && !isPlaceholderText(item.task));
    if (items.length > 0) return items;
  }
  if (Array.isArray(raw.easyWins)) {
    return raw.easyWins
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0 && !isPlaceholderText(item))
      .slice(0, 4)
      .map(item => ({
        task: item,
        whyItMatters: "Improves project quality and momentum.",
        difficulty: "Easy" as const,
        estimatedTime: "30 min" as const,
        filesLikelyInvolved: [],
      }));
  }
  return fallback.nextEasyWins;
}

function normalizeTodayPlan(raw: Record<string, unknown>, fallback: ProjectReport): ProjectReport["todayPlan"] {
  if (Array.isArray(raw.todayPlan) && raw.todayPlan.length > 0) {
    const items = (raw.todayPlan as ProjectReport["todayPlan"])
      .filter(item => item?.task && !isPlaceholderText(item.task));
    if (items.length > 0) return items;
  }
  if (Array.isArray(raw.todayTasks)) {
    return raw.todayTasks
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0 && !isPlaceholderText(item))
      .slice(0, 3)
      .map(item => ({
        task: item,
        filesToOpen: [],
        successLooksLike: `${item} is completed`,
      }));
  }
  return fallback.todayPlan;
}

function normalizeAccessibilityStandards(raw: Record<string, unknown>, fallback: ProjectReport): ProjectReport["accessibilityStandards"] {
  if (!Array.isArray(raw.accessibilityStandards)) return fallback.accessibilityStandards;
  const items = (raw.accessibilityStandards as ProjectReport["accessibilityStandards"])
    .filter(item => item?.standard && item?.nextStep && !isPlaceholderText(item.nextStep))
    .slice(0, 8)
    .map(item => ({
      standard: item.standard,
      status: item.status === "Ready" ? "Ready" as const : "Needs work" as const,
      issue: item.issue || "Accessibility readiness needs review.",
      nextStep: item.nextStep,
      filesLikelyInvolved: Array.isArray(item.filesLikelyInvolved) ? item.filesLikelyInvolved : [],
    }));
  return items.length > 0 ? items : fallback.accessibilityStandards;
}

function normalizePublishingReadiness(raw: Record<string, unknown>, fallback: ProjectReport): ProjectReport["publishingReadiness"] {
  if (!Array.isArray(raw.publishingReadiness)) return fallback.publishingReadiness;
  const items = (raw.publishingReadiness as ProjectReport["publishingReadiness"])
    .filter(item => item?.target && item?.nextStep && !isPlaceholderText(item.nextStep))
    .slice(0, 8)
    .map(item => ({
      target: item.target,
      status: item.status === "Ready" ? "Ready" as const : "Needs work" as const,
      requirement: item.requirement || "Publishing readiness needs review.",
      nextStep: item.nextStep,
      filesLikelyInvolved: Array.isArray(item.filesLikelyInvolved) ? item.filesLikelyInvolved : [],
    }));
  return items.length > 0 ? items : fallback.publishingReadiness;
}

function normalizeStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0 && !isPlaceholderText(item))
    .slice(0, 8);
  return items.length > 0 ? items : fallback;
}

function ensureActionSections(report: ProjectReport, fallback: ProjectReport): ProjectReport {
  const incompleteRows = report.trackerTable.filter(row => row.status !== "Complete");
  const priorityRows = incompleteRows
    .filter(row => row.priority === "High" || row.priority === "Medium")
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));

  const nextEasyWins = report.nextEasyWins.length > 0
    ? report.nextEasyWins
    : fallback.nextEasyWins.length > 0
      ? fallback.nextEasyWins
      : priorityRows.slice(0, 3).map(row => ({
          task: row.nextAction,
          whyItMatters: `${row.area} is currently ${row.completionPercent}% complete and marked ${row.priority} priority.`,
          difficulty: row.priority === "High" ? "Medium" as const : "Easy" as const,
          estimatedTime: row.priority === "High" ? "1 hour" as const : "30 min" as const,
          filesLikelyInvolved: [],
        }));

  const buildOrder = report.buildOrder.length > 0
    ? report.buildOrder
    : fallback.buildOrder.length > 0
      ? fallback.buildOrder
      : priorityRows.map(row => row.nextAction).slice(0, 5);

  const risks = report.risks.length > 0
    ? report.risks
    : fallback.risks.length > 0
      ? fallback.risks
      : priorityRows
          .filter(row => row.priority === "High")
          .map(row => `${row.area} is high priority at ${row.completionPercent}% completion: ${row.nextAction}`)
          .slice(0, 3);

  const todayPlan = report.todayPlan.length > 0
    ? report.todayPlan
    : fallback.todayPlan.length > 0
      ? fallback.todayPlan
      : nextEasyWins.slice(0, 3).map(win => ({
          task: win.task,
          filesToOpen: win.filesLikelyInvolved,
          successLooksLike: `${win.task} is completed or converted into a tracked task`,
        }));

  return {
    ...report,
    nextEasyWins: nextEasyWins.length > 0 ? nextEasyWins : report.nextEasyWins,
    buildOrder: buildOrder.length > 0 ? buildOrder : ["Review the highest-priority tracker row and define the next implementation step"],
    risks: risks.length > 0 ? risks : ["No major blockers detected from the scan; keep validating the highest-priority incomplete areas"],
    todayPlan: todayPlan.length > 0 ? todayPlan : [{
      task: "Review the tracker priorities and pick the highest-impact incomplete area",
      filesToOpen: [],
      successLooksLike: "The next concrete implementation task is identified and started",
    }],
  };
}

function priorityRank(priority: ProjectReport["trackerTable"][number]["priority"]): number {
  if (priority === "High") return 3;
  if (priority === "Medium") return 2;
  return 1;
}

function isLowQualityLocalReport(report: ProjectReport): boolean {
  const values = [
    report.purpose,
    report.summary,
    ...report.working.map(item => `${item.area} ${item.details}`),
    ...report.needsFixing.map(item => `${item.problem} ${item.evidence} ${item.suggestedFix}`),
    ...report.nextEasyWins.map(item => `${item.task} ${item.whyItMatters}`),
    ...report.accessibilityStandards.map(item => `${item.standard} ${item.issue} ${item.nextStep}`),
    ...report.publishingReadiness.map(item => `${item.target} ${item.requirement} ${item.nextStep}`),
    ...report.buildOrder,
    ...report.risks,
    ...report.todayPlan.map(item => `${item.task} ${item.successLooksLike}`),
  ];

  const placeholderCount = values.filter(isPlaceholderText).length;
  const usefulTextCount = values.filter(value => value.trim().length >= 18 && !isPlaceholderText(value)).length;
  return placeholderCount > 0 || usefulTextCount < 5;
}

function isPlaceholderText(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return [
    "task",
    "step",
    "risk",
    "issue",
    "short task",
    "short step",
    "short risk",
    "short issue",
    "task is completed",
    "address issue",
  ].includes(normalized);
}

function clampScore(n: unknown, fallback: number): number {
  const value = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}
