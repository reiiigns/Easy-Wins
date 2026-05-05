import assert from "node:assert/strict";
import test from "node:test";

test("review knowledge includes app-local analyzer skills", async () => {
  process.env.ANALYZER_SKILLS_ENABLED = "1";
  process.env.ANALYZER_SKILLS_ALLOWLIST = "missing/SKILL.md";
  process.env.ANALYZER_APP_SKILLS_ALLOWLIST = "production-readiness/SKILL.md,accessibility-audit/SKILL.md";
  process.env.ANALYZER_SKILLS_MAX_CHARS = "5000";

  const { getReviewKnowledgeContext } = await import("../server/services/reviewKnowledge");
  const context = await getReviewKnowledgeContext();

  assert.match(context, /Skill: production-readiness/);
  assert.match(context, /Skill: accessibility-audit/);
  assert.match(context, /production readiness/i);
  assert.match(context, /keyboard/i);
});
