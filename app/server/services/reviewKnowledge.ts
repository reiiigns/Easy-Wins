import fs from "fs/promises";
import path from "path";

const DEFAULT_SKILLS_ROOT = "\\\\wsl.localhost\\Ubuntu\\home\\dair\\.hermes\\skills";
const DEFAULT_SKILLS = [
  "github/github-code-review/SKILL.md",
  "github/codebase-inspection/SKILL.md",
  "creative/open-design-reviewer/SKILL.md",
  "creative/open-design/SKILL.md",
  "creative/design-md/SKILL.md",
  "creative/popular-web-designs/SKILL.md",
  "creative/claude-design/SKILL.md",
  "research/deep-dive-research-synthesis/SKILL.md",
];
const APP_SKILLS_ROOT = path.resolve(process.cwd(), "analyzer-skills");
const APP_ANALYZER_SKILLS = [
  "production-readiness/SKILL.md",
  "store-publishing/SKILL.md",
  "accessibility-audit/SKILL.md",
  "game-release/SKILL.md",
];
const DEFAULT_MAX_CHARS = 3200;
const PER_SKILL_MAX_CHARS = 900;

let cachedKnowledge: string | null = null;
let cachedSignature = "";

export async function getReviewKnowledgeContext(): Promise<string> {
  if (!isEnabled()) return "";

  const root = process.env.ANALYZER_SKILLS_PATH?.trim() || DEFAULT_SKILLS_ROOT;
  const skills = getConfiguredSkills();
  const appSkills = getConfiguredAppSkills();
  const maxChars = getMaxChars();
  const signature = `${root}|${skills.join(",")}|${APP_SKILLS_ROOT}|${appSkills.join(",")}|${maxChars}`;

  if (cachedKnowledge !== null && cachedSignature === signature) {
    return cachedKnowledge;
  }

  const sections: string[] = [];

  sections.push(...await readSkillSections(root, skills));
  sections.push(...await readSkillSections(APP_SKILLS_ROOT, appSkills));

  cachedSignature = signature;
  cachedKnowledge = truncate(sections.join("\n\n"), maxChars);
  return cachedKnowledge;
}

function isEnabled(): boolean {
  const value = process.env.ANALYZER_SKILLS_ENABLED?.trim().toLowerCase();
  return !["0", "false", "no", "off", "disabled"].includes(value || "");
}

function getConfiguredSkills(): string[] {
  const configured = process.env.ANALYZER_SKILLS_ALLOWLIST?.trim();
  if (!configured) return DEFAULT_SKILLS;

  return configured
    .split(",")
    .map(skill => skill.trim())
    .filter(Boolean);
}

function getConfiguredAppSkills(): string[] {
  const configured = process.env.ANALYZER_APP_SKILLS_ALLOWLIST?.trim();
  if (!configured) return APP_ANALYZER_SKILLS;

  return configured
    .split(",")
    .map(skill => skill.trim())
    .filter(Boolean);
}

function getMaxChars(): number {
  const configured = Number(process.env.ANALYZER_SKILLS_MAX_CHARS);
  if (Number.isFinite(configured) && configured >= 1000) {
    return Math.min(configured, 12000);
  }
  return DEFAULT_MAX_CHARS;
}

function compactSkill(skillPath: string, content: string): string {
  const frontmatter = extractFrontmatter(content);
  const body = stripFrontmatter(content).replace(/```[\s\S]*?```/g, "");
  const title = frontmatter.name || skillPath.replace(/\/SKILL\.md$/i, "");
  const description = frontmatter.description ? `Description: ${frontmatter.description}\n` : "";
  const lines = body
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => isKnowledgeLine(line))
    .map(line => line.replace(/\s+/g, " "));
  const uniqueLines = Array.from(new Set(lines)).slice(0, 28);
  const section = [`Skill: ${title}`, description.trim(), ...uniqueLines].filter(Boolean).join("\n");

  return truncate(section, PER_SKILL_MAX_CHARS);
}

async function readSkillSections(root: string, skills: string[]): Promise<string[]> {
  const sections: string[] = [];

  for (const skill of skills) {
    try {
      const filePath = path.join(root, ...skill.split(/[\\/]+/));
      const content = await fs.readFile(filePath, "utf-8");
      const compacted = compactSkill(skill, content);
      if (compacted) sections.push(compacted);
    } catch {
      continue;
    }
  }

  return sections;
}

function extractFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map(line => line.match(/^([A-Za-z0-9_-]+):\s*["']?(.+?)["']?\s*$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map(match => [match[1], match[2]])
  );
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---/, "").trim();
}

function isKnowledgeLine(line: string): boolean {
  if (!line) return false;
  if (/^(cd|cat|ls|git|gh|curl|pip|npm|yarn|pnpm|python|node|explorer\.exe)\b/i.test(line)) return false;
  if (/^[-*]\s+/.test(line)) return true;
  if (/^#{1,4}\s+/.test(line)) return true;
  if (/^\d+\.\s+/.test(line)) return true;
  if (/^(IMPORTANT|Important|Red flags?|Check|Does|Are|Is)\b/.test(line)) return true;
  return line.length >= 50 && line.length <= 180 && !line.includes("/") && !line.includes("\\");
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n...review knowledge truncated...` : value;
}
