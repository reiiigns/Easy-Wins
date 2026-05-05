import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanProject } from "../server/services/scanner";

test("scanProject resolves a wrapper folder to the single child project", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "project-tracker-scan-"));
  const project = path.join(workspace, "app");

  try {
    await fs.mkdir(path.join(project, "src"), { recursive: true });
    await fs.mkdir(path.join(project, "node_modules", "fixture"), { recursive: true });
    await fs.writeFile(path.join(workspace, "AGENTS.md"), "wrapper notes");
    await fs.writeFile(path.join(project, "package.json"), JSON.stringify({
      name: "fixture-app",
      scripts: {
        build: "tsc",
        test: "node --test",
      },
      dependencies: {},
      devDependencies: {
        typescript: "^5.0.0",
      },
    }));
    await fs.writeFile(path.join(project, "README.md"), "# Fixture App");
    await fs.writeFile(path.join(project, "src", "index.ts"), "export const value = 1;\n");
    await fs.writeFile(path.join(project, "src", "index.test.ts"), "import 'node:test';\n");
    await fs.writeFile(path.join(project, "node_modules", "fixture", "ignored.py"), "print('ignored')\n");
    await fs.mkdir(path.join(project, ".easywins"), { recursive: true });
    await fs.writeFile(path.join(project, ".easywins", "ignored.ts"), "export const ignored = true;\n");

    const summary = await scanProject(workspace);

    assert.equal(summary.projectPath, project);
    assert.equal(summary.projectName, "fixture-app");
    assert.equal(summary.packageJson?.scripts.build, "tsc");
    assert.equal(summary.readmeContent?.startsWith("# Fixture App"), true);
    assert.equal(summary.hasTests, true);
    assert.equal(summary.testFileCount, 1);
    assert.equal(summary.fileTypeCounts[".py"], undefined);
    assert.equal(summary.srcFiles.includes(path.join(".easywins", "ignored.ts")), false);
    assert.ok(summary.fileCount < 10);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
