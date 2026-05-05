import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import fg from "fast-glob";
import { simpleGit, SimpleGit } from "simple-git";
import { AnalysisProfile, ScanSummary, TodoItem } from "../types/report.js";

const IGNORED_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".easywins",
  ".next",
  "vendor",
  ".turbo",
  ".cache",
  "out",
  "target",
  "bin",
  "obj",
  ".vercel",
  ".netlify",
];
const IGNORED_GLOBS = IGNORED_DIRS.flatMap(dir => [dir, `${dir}/**`, `**/${dir}`, `**/${dir}/**`]);
const PROJECT_MARKERS = [
  "package.json",
  "pyproject.toml",
  "cargo.toml",
  "go.mod",
  "composer.json",
  "gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
];

const MEDIA_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".svg", ".ico", ".mp4", ".mp3",
  ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar", ".exe", ".dll",
  ".so", ".dylib", ".bin", ".dat", ".db", ".sqlite", ".sqlite3",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
];

const SOURCE_EXTENSIONS = [
  ".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".go", ".rs",
  ".rb", ".php", ".cs", ".swift", ".kt", ".scala", ".cpp", ".c",
  ".h", ".hpp", ".lua", ".r", ".pl", ".sh", ".bash", ".zsh",
  ".ps1", ".sql", ".graphql", ".gql",
];

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_TODO_ITEMS = 30;
const MAX_TREE_DEPTH = 3;
const MAX_README_LENGTH = 5000;
const MAX_FILE_READ_LINES = 500;

/**
 * Scan a project directory and return a compact summary.
 */
export async function scanProject(projectPath: string, analysisProfile?: AnalysisProfile): Promise<ScanSummary> {
  const requestedPath = path.resolve(projectPath);

  // Ensure path exists and is a directory
  const stat = await fs.stat(requestedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${requestedPath}`);
  }

  const resolvedPath = await resolveProjectRoot(requestedPath);

  // Get basic counts
  const allFiles = await getAllFiles(resolvedPath);
  const filteredFiles = allFiles.filter(f => !isIgnoredFile(f, resolvedPath));
  const fileCount = filteredFiles.length;
  const allDirs = await getAllDirectories(resolvedPath);
  const dirCount = allDirs.length;

  // Project name
  const projectName = await getProjectName(resolvedPath);

  // File tree
  const fileTree = await buildFileTree(resolvedPath);

  // Top-level files
  const topLevelFiles = await getTopLevelFiles(resolvedPath);

  // Package.json
  const packageJson = await readPackageJson(resolvedPath);

  // README
  const readmeContent = await readReadme(resolvedPath);

  // Config files
  const configFiles = await findConfigFiles(resolvedPath);

  // Source files and type counts
  const { srcFiles, fileTypeCounts } = analyzeFileTypes(filteredFiles, resolvedPath);

  // TODO/FIXME/HACK comments
  const todoComments = await findTodoComments(resolvedPath, filteredFiles);

  // Git info
  const gitInfo = await getGitInfo(resolvedPath);

  // Lines of code (approximate)
  const totalLinesOfCode = await countLinesOfCode(resolvedPath, filteredFiles);

  // Dependency count
  const dependencyCount = countDependencies(packageJson);

  // Tests
  const { hasTests, testFileCount } = detectTests(filteredFiles, resolvedPath);

  // CI/CD
  const hasCiCd = await detectCiCd(resolvedPath);

  // Docker
  const hasDocker = await detectDocker(resolvedPath);

  return {
    projectPath: resolvedPath,
    projectName,
    analysisProfile,
    fileCount,
    dirCount,
    fileTree,
    topLevelFiles,
    packageJson,
    readmeContent,
    configFiles,
    srcFiles,
    fileTypeCounts,
    todoComments,
    gitInfo,
    totalLinesOfCode,
    dependencyCount,
    hasTests,
    testFileCount,
    hasCiCd,
    hasDocker,
  };
}

async function getAllFiles(projectPath: string): Promise<string[]> {
  return fg("**/*", {
    cwd: projectPath,
    ignore: IGNORED_GLOBS,
    onlyFiles: true,
    dot: true,
    absolute: true,
  });
}

async function getAllDirectories(projectPath: string): Promise<string[]> {
  return fg("**/*", {
    cwd: projectPath,
    ignore: IGNORED_GLOBS,
    onlyDirectories: true,
    dot: true,
    absolute: true,
  });
}

async function resolveProjectRoot(projectPath: string): Promise<string> {
  if (await hasProjectMarker(projectPath)) return projectPath;

  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    const candidates: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || IGNORED_DIRS.includes(entry.name)) continue;
      const childPath = path.join(projectPath, entry.name);
      if (await hasProjectMarker(childPath)) candidates.push(childPath);
    }

    return candidates.length === 1 ? candidates[0] : projectPath;
  } catch {
    return projectPath;
  }
}

async function hasProjectMarker(projectPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(projectPath);
    const names = entries.map(entry => entry.toLowerCase());
    return names.some(name => PROJECT_MARKERS.includes(name) || name.startsWith("readme"));
  } catch {
    return false;
  }
}

function isIgnoredFile(filePath: string, projectPath: string): boolean {
  const relativeParts = path.relative(projectPath, filePath).split(/[\\/]+/);
  if (relativeParts.some(part => IGNORED_DIRS.includes(part))) return true;

  const ext = path.extname(filePath).toLowerCase();
  if (MEDIA_EXTENSIONS.includes(ext)) return true;
  try {
    const stat = fsSync.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) return true;
  } catch {
    return true;
  }
  return false;
}

async function getProjectName(projectPath: string): Promise<string> {
  try {
    const pkgPath = path.join(projectPath, "package.json");
    const content = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    if (pkg.name) return pkg.name;
  } catch {
    // ignore
  }
  return path.basename(projectPath);
}

async function buildFileTree(projectPath: string): Promise<string> {
  const dirs = await fg("**/*", {
    cwd: projectPath,
    ignore: IGNORED_GLOBS,
    onlyDirectories: true,
    dot: false,
    deep: MAX_TREE_DEPTH,
    absolute: false,
  });

  const files = await fg("**/*", {
    cwd: projectPath,
    ignore: IGNORED_GLOBS,
    onlyFiles: true,
    dot: false,
    deep: MAX_TREE_DEPTH,
    absolute: false,
  });

  // Build a simple tree representation
  const allEntries = [...dirs.map(d => d + "/"), ...files];
  allEntries.sort();

  // Take top 60 entries
  const topEntries = allEntries.slice(0, 60);

  const treeLines = topEntries.map(entry => {
    const depth = entry.split("/").length - 1;
    const indent = "  ".repeat(depth);
    const name = entry.endsWith("/") ? entry.slice(0, -1).split("/").pop() + "/" : entry.split("/").pop();
    return `${indent}${name}`;
  });

  if (allEntries.length > 60) {
    treeLines.push(`  ... and ${allEntries.length - 60} more entries`);
  }

  return treeLines.join("\n");
}

async function getTopLevelFiles(projectPath: string): Promise<string[]> {
  const entries = await fs.readdir(projectPath, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && (!e.name.startsWith(".") || e.name === ".env.example" || e.name === ".dockerignore"))
    .map(e => e.name)
    .sort();
}

async function readPackageJson(projectPath: string) {
  try {
    const content = await fs.readFile(path.join(projectPath, "package.json"), "utf-8");
    const pkg = JSON.parse(content);
    return {
      name: pkg.name || "unnamed",
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      scripts: pkg.scripts || {},
    };
  } catch {
    return undefined;
  }
}

async function readReadme(projectPath: string): Promise<string | undefined> {
  try {
    const files = await fg("README*", { cwd: projectPath, caseSensitiveMatch: false, absolute: false });
    if (files.length === 0) return undefined;
    const content = await fs.readFile(path.join(projectPath, files[0]), "utf-8");
    return content.slice(0, MAX_README_LENGTH);
  } catch {
    return undefined;
  }
}

async function findConfigFiles(projectPath: string): Promise<string[]> {
  const patterns = [
    "*config*.{js,ts,json,mjs,cjs}",
    "webpack*",
    "vite*",
    "tsconfig*",
    "eslint*",
    "prettier*",
    "docker*",
    "Dockerfile*",
    "docker-compose*",
    "tailwind*",
    "postcss*",
    "jest*",
    "vitest*",
    "playwright*",
    "cypress*",
    ".github/**/*",
    ".gitlab-ci*",
    "Jenkinsfile*",
    "Makefile",
    "CMakeLists*",
    "setup*",
    "pyproject*",
    "requirements*.txt",
    "Cargo*",
    "go.mod",
    "go.sum",
    "Gemfile*",
    "composer*",
    "build.gradle*",
    "pom.xml",
  ];

  const configFiles: string[] = [];
  for (const pattern of patterns) {
    const matches = await fg(pattern, {
      cwd: projectPath,
      ignore: IGNORED_GLOBS,
      caseSensitiveMatch: false,
      absolute: false,
    });
    configFiles.push(...matches);
  }

  return [...new Set(configFiles)].sort();
}

function analyzeFileTypes(files: string[], projectPath: string): { srcFiles: string[]; fileTypeCounts: Record<string, number> } {
  const counts: Record<string, number> = {};
  const srcFiles: string[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase() || "(no ext)";
    counts[ext] = (counts[ext] || 0) + 1;

    const relPath = path.relative(projectPath, file);
    if (SOURCE_EXTENSIONS.includes(ext) && !relPath.includes("node_modules")) {
      srcFiles.push(relPath);
    }
  }

  return { srcFiles: srcFiles.slice(0, 100), fileTypeCounts: counts };
}

async function findTodoComments(projectPath: string, files: string[]): Promise<TodoItem[]> {
  const todoRegex = /(?:^|\s)(TODO|FIXME|HACK)[\s:;-]+(.{0,200})/gi;
  const items: TodoItem[] = [];
  const sourceFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return SOURCE_EXTENSIONS.includes(ext);
  });

  // Process up to 200 source files
  const filesToCheck = sourceFiles.slice(0, 200);

  for (const file of filesToCheck) {
    if (items.length >= MAX_TODO_ITEMS) break;

    try {
      const content = await fs.readFile(file, "utf-8");
      const lines = content.split("\n").slice(0, MAX_FILE_READ_LINES);
      const relPath = path.relative(projectPath, file);

      for (let i = 0; i < lines.length && items.length < MAX_TODO_ITEMS; i++) {
        const line = lines[i];
        const matches = [...line.matchAll(todoRegex)];
        for (const match of matches) {
          if (items.length >= MAX_TODO_ITEMS) break;
          const type = (match[1] as "TODO" | "FIXME" | "HACK").toUpperCase() as "TODO" | "FIXME" | "HACK";
          const text = match[2]?.trim() || "";
          if (text.length > 5) {
            items.push({
              file: relPath,
              line: i + 1,
              text: text.slice(0, 120),
              type,
            });
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return items;
}

async function getGitInfo(projectPath: string) {
  if (!hasGitMetadata(projectPath)) {
    return emptyGitInfo();
  }

  const git: SimpleGit = simpleGit(projectPath);

  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return emptyGitInfo();
    }

    const branchSummary = await git.branchLocal();
    const currentBranch = branchSummary.current;

    const log = await git.log({ maxCount: 10 });
    const recentCommits = log.all.map(c => `${c.hash.substring(0, 7)} - ${c.message} (${c.date})`);
    const lastCommit = recentCommits[0] || "";

    const status = await git.status();
    const hasUncommittedChanges = status.files.length > 0;
    const modifiedFiles = status.files.map(f => f.path);

    // Get total commit count (approximate via rev-list)
    let commitCount = log.total;
    try {
      const revList = await git.raw(["rev-list", "--count", "HEAD"]);
      commitCount = parseInt(revList.trim(), 10) || log.total;
    } catch {
      // use log.total as fallback
    }

    return {
      isGitRepo: true,
      branch: currentBranch,
      commitCount,
      lastCommit,
      recentCommits,
      hasUncommittedChanges,
      modifiedFiles,
    };
  } catch {
    return emptyGitInfo();
  }
}

function hasGitMetadata(projectPath: string): boolean {
  return fsSync.existsSync(path.join(projectPath, ".git"));
}

function emptyGitInfo() {
  return {
    isGitRepo: false,
    branch: "",
    commitCount: 0,
    lastCommit: "",
    recentCommits: [],
    hasUncommittedChanges: false,
    modifiedFiles: [],
  };
}

async function countLinesOfCode(projectPath: string, files: string[]): Promise<number> {
  let total = 0;
  const sourceFiles = files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return SOURCE_EXTENSIONS.includes(ext);
  }).slice(0, 100);

  for (const file of sourceFiles) {
    try {
      const content = await fs.readFile(file, "utf-8");
      total += content.split("\n").length;
    } catch {
      // Skip
    }
  }

  return total;
}

function countDependencies(packageJson?: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }): number {
  if (!packageJson) return 0;
  const deps = Object.keys(packageJson.dependencies || {}).length;
  const devDeps = Object.keys(packageJson.devDependencies || {}).length;
  return deps + devDeps;
}

function detectTests(files: string[], projectPath: string): { hasTests: boolean; testFileCount: number } {
  const testPatterns = [/\.(test|spec)\./i, /__(tests|mocks)__/i, /\/(tests?|spec)\//i];
  const testFiles = files.filter(f => {
    const relPath = path.relative(projectPath, f);
    return testPatterns.some(p => p.test(relPath));
  });

  return {
    hasTests: testFiles.length > 0,
    testFileCount: testFiles.length,
  };
}

async function detectCiCd(projectPath: string): Promise<boolean> {
  const patterns = [
    ".github/workflows/*",
    ".gitlab-ci*",
    "Jenkinsfile*",
    ".circleci/*",
    "azure-pipelines*",
    "travis*",
    "appveyor*",
    "bitrise*",
    "codefresh*",
    "buildkite*",
  ];

  for (const pattern of patterns) {
    const matches = await fg(pattern, { cwd: projectPath, ignore: IGNORED_GLOBS, caseSensitiveMatch: false });
    if (matches.length > 0) return true;
  }
  return false;
}

async function detectDocker(projectPath: string): Promise<boolean> {
  const patterns = ["Dockerfile*", "docker-compose*", ".dockerignore", "docker/*"];
  for (const pattern of patterns) {
    const matches = await fg(pattern, { cwd: projectPath, ignore: IGNORED_GLOBS, caseSensitiveMatch: false });
    if (matches.length > 0) return true;
  }
  return false;
}
