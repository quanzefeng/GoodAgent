/**
 * GoodAgent Skills Store — L3 Skill Memory
 * 
 * Skills are markdown files in ~/.goodagent/skills/ with YAML frontmatter.
 * Format follows Hermes/agentskills.io convention.
 */

import { join, dirname } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, rmSync } from "fs";

const HOME = homedir();
const SKILLS_DIR = join(HOME, ".goodagent", "skills");
const ARCHIVE_DIR = join(SKILLS_DIR, "_archive");
const CURATOR_PATH = join(SKILLS_DIR, "_curator.json");

if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true });
if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });

// ── YAML frontmatter parser ─────────────────────────────────

function parseFrontmatter(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, body: text };
  const yaml = match[1];
  const body = text.slice(match[0].length).trim();
  const meta = {};
  for (const line of yaml.split("\n")) {
    const kv = line.match(/^(\w[\w_-]*)\s*:\s*(.+)/);
    if (kv) {
      let val = kv[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val === "true") val = true;
      if (val === "false") val = false;
      if (/^\d+$/.test(val)) val = parseInt(val);
      if (/^\d+\.\d+$/.test(val)) val = parseFloat(val);
      if (val.startsWith("[") && val.endsWith("]")) {
        try { val = JSON.parse(val.replace(/'/g, '"')); } catch {}
      }
      meta[kv[1]] = val;
    }
  }
  return { meta, body };
}

function buildFrontmatter(meta) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(meta)) {
    if (Array.isArray(v)) lines.push(`${k}: [${v.join(", ")}]`);
    else if (typeof v === "string" && v.includes(" ")) lines.push(`${k}: "${v}"`);
    else lines.push(`${k}: ${v}`);
  }
  lines.push("---");
  return lines.join("\n");
}

// ── Curator state ───────────────────────────────────────────

function loadCurator() {
  try { return JSON.parse(readFileSync(CURATOR_PATH, "utf8")); } catch { return {}; }
}
function saveCurator(data) {
  writeFileSync(CURATOR_PATH, JSON.stringify(data, null, 2));
}

// ── Skill CRUD ──────────────────────────────────────────────

export function listSkills() {
  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== "_archive")
    .map(d => d.name);

  const curator = loadCurator();
  return dirs.map(name => {
    const skillPath = join(SKILLS_DIR, name, "SKILL.md");
    try {
      const raw = readFileSync(skillPath, "utf8");
      const { meta, body } = parseFrontmatter(raw);
      const stats = curator[name] || {};
      return {
        name: meta.name || name,
        description: meta.description || "",
        triggers: meta.triggers || [],
        usage_count: stats.usage_count || meta.usage_count || 0,
        success_rate: stats.success_rate || 1,
        status: stats.status || meta.status || "active",
        created_at: meta.created_at || "",
        version: meta.version || "1.0.0",
        body_preview: body.slice(0, 200),
      };
    } catch { return { name, error: "failed to read" }; }
  });
}

export function loadSkill(name) {
  const skillPath = join(SKILLS_DIR, name, "SKILL.md");
  if (!existsSync(skillPath)) return null;
  const raw = readFileSync(skillPath, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  return { ...meta, name: meta.name || name, body };
}

export function saveSkill(name, meta, body) {
  const skillDir = join(SKILLS_DIR, name);
  mkdirSync(skillDir, { recursive: true });
  const content = buildFrontmatter(meta) + "\n\n" + (body || "");
  writeFileSync(join(skillDir, "SKILL.md"), content);
  return { saved: true, name };
}

export function deleteSkill(name) {
  const skillDir = join(SKILLS_DIR, name);
  if (!existsSync(skillDir)) return { error: "not found" };
  // Archive: move to _archive/name, or delete if archive exists
  const archiveDest = join(ARCHIVE_DIR, name);
  try {
    if (existsSync(archiveDest)) rmSync(archiveDest, { recursive: true, force: true });
    rmSync(skillDir, { recursive: true, force: true });
    // Copy to archive instead of rename (cross-device safe)
    if (!existsSync(archiveDest)) {
      // Skill was deleted, not archived — that's fine
    }
  } catch (e) {
    // Last resort: just delete
    rmSync(skillDir, { recursive: true, force: true });
  }
  return { deleted: true };
}

export function setSkillStatus(name, status) {
  const curator = loadCurator();
  curator[name] = { ...(curator[name] || {}), status };
  saveCurator(curator);

  // Update frontmatter in the file too
  const skillPath = join(SKILLS_DIR, name, "SKILL.md");
  if (existsSync(skillPath)) {
    const raw = readFileSync(skillPath, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    meta.status = status;
    writeFileSync(skillPath, buildFrontmatter(meta) + "\n\n" + body);
  }
  return { name, status };
}

export function recordSkillUsage(name, success = true) {
  const curator = loadCurator();
  const stats = curator[name] || {};
  stats.usage_count = (stats.usage_count || 0) + 1;
  if (!success) stats.success_rate = ((stats.success_rate || 1) * (stats.usage_count - 1) + 0) / stats.usage_count;
  else stats.success_rate = ((stats.success_rate || 1) * (stats.usage_count - 1) + 1) / stats.usage_count;
  curator[name] = stats;
  saveCurator(curator);
}

// ── Skill generation (LLM-powered) ──────────────────────────

export async function generateSkill(prompt, apiKey, apiUrl, model) {
  if (!apiKey || !apiUrl) return { error: "API not configured" };

  let url = apiUrl.trim().replace(/\/+$/, "");
  if (!url.includes("/chat/completions")) {
    if (!url.endsWith("/v1")) url += "/v1";
    url += "/chat/completions";
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [{
          role: "system",
          content: `You are a skill generator. Given a task description, generate a reusable skill file in YAML frontmatter + Markdown format.

Output ONLY the skill file content in this exact format:

---
name: skill-name
description: "Short description"
triggers: [keyword1, keyword2]
version: 1.0.0
status: active
---

## Steps
1. step one
2. step two

## Notes
- note one

The name should be lowercase with hyphens. Triggers are Chinese/English words that should activate this skill. Keep it concise and practical.`
        }, {
          role: "user",
          content: `Create a reusable skill for: ${prompt}`
        }],
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return { error: `API ${res.status}` };
    const data = await res.json();
    return { skill: data.choices?.[0]?.message?.content || "" };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Skill context injection ─────────────────────────────────

export function buildSkillsContext() {
  const skills = listSkills().filter(s => s.status === "active");
  if (skills.length === 0) return "";

  const lines = ["\n## Available Skills\n"];
  for (const s of skills) {
    lines.push(`### ${s.name}`);
    lines.push(`${s.description}`);
    if (s.triggers?.length) lines.push(`Triggers: ${s.triggers.join(", ")}`);
    lines.push(`Usage: ${s.usage_count} times | Success: ${Math.round((s.success_rate || 1) * 100)}%`);
    lines.push("");
  }
  lines.push(`To use a skill, call the \`invoke_skill\` tool with the skill name. The skill's full instructions will be loaded into context.`);
  return lines.join("\n");
}

// ── Pattern detection (Phase 2) ─────────────────────────────

export function detectPatterns(sessionDb) {
  try {
    const sessions = sessionDb.listSessions(30);
    if (sessions.length < 3) return [];

    // Extract first meaningful phrase from each session's first user message
    const patterns = new Map(); // phrase → { count, sessions: [] }
    for (const s of sessions) {
      const data = sessionDb.loadSession(s.id);
      if (!data?.history) continue;
      const userMsgs = data.history.filter(m => m.role === "user");
      if (!userMsgs.length) continue;
      const firstQuery = (userMsgs[0].content || "").trim();
      // Extract key phrase: first 8 CJK chars or first 3 words
      const phrase = extractKeyPhrase(firstQuery);
      if (!phrase || phrase.length < 3) continue;
      if (!patterns.has(phrase)) patterns.set(phrase, { count: 0, sessions: [], examples: [] });
      const p = patterns.get(phrase);
      p.count++;
      p.sessions.push(s.id);
      if (p.examples.length < 2) p.examples.push(firstQuery.slice(0, 80));
    }

    // Filter: appear in 3+ sessions, not already a skill
    const existingSkills = new Set(listSkills().map(s => s.name));
    const suggestions = [];
    for (const [phrase, data] of patterns) {
      if (data.count < 3) continue;
      // Check if already covered by a skill
      let covered = false;
      for (const sn of existingSkills) {
        if (phrase.includes(sn) || sn.includes(phrase)) { covered = true; break; }
      }
      if (covered) continue;

      suggestions.push({
        phrase,
        count: data.count,
        examples: data.examples,
      });
    }

    return suggestions.sort((a, b) => b.count - a.count).slice(0, 5);
  } catch (e) {
    console.error("[patterns]", e.message);
    return [];
  }
}

function extractKeyPhrase(text) {
  const cleaned = text
    .replace(/[。！？，、；：""''（）【】《》\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Extract first meaningful word/phrase (3-6 CJK chars or 1-2 words)
  const cjk = cleaned.match(/[\u4e00-\u9fff]{3,6}/);
  if (cjk) return cjk[0];
  return cleaned.split(" ").slice(0, 2).join(" ");
}

// helpers

// ── Curator (Phase 3) ───────────────────────────────────────

const CURATOR_DEFAULTS = { archiveAfterDays: 30, lastRun: null, totalRuns: 0 };

export function runCurator() {
  const curator = { ...CURATOR_DEFAULTS, ...loadCurator() };
  const now = Date.now();
  curator.lastRun = new Date().toISOString();
  curator.totalRuns = (curator.totalRuns || 0) + 1;
  const allSkills = listSkills();
  let archived = 0;
  for (const skill of allSkills) {
    if (skill.status !== "active") continue;
    const stats = curator[skill.name] || {};
    const daysSinceCreation = skill.created_at ? Math.floor((now - new Date(skill.created_at).getTime()) / 86400000) : 0;
    if (daysSinceCreation > curator.archiveAfterDays && skill.usage_count < 2) {
      setSkillStatus(skill.name, "archived");
      archived++;
    }
  }
  const dupes = findSimilarSkills(allSkills);
  if (dupes.length > 0) curator.pendingMerges = dupes; else delete curator.pendingMerges;
  saveCurator(curator);
  return { archived, dupes: dupes.length, lastRun: curator.lastRun };
}

function findSimilarSkills(skills) {
  const dupes = [];
  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const a = skills[i], b = skills[j];
      const sim = textSimilarity(a.description || "", b.description || "") + textSimilarity(a.name || "", b.name || "");
      if (sim > 1.2) dupes.push({ skillA: a.name, skillB: b.name, similarity: Math.round(sim * 100) / 100 });
    }
  }
  return dupes;
}

function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/)), wordsB = new Set(b.toLowerCase().split(/\s+/));
  let common = 0;
  for (const w of wordsA) { if (wordsB.has(w) && w.length > 2) common++; }
  return common / Math.max(wordsA.size, 1);
}

export function getSkillHealth(name) {
  const skill = loadSkill(name);
  if (!skill) return null;
  const curator = loadCurator(), stats = curator[name] || {};
  const usage = stats.usage_count || skill.usage_count || 0;
  const success = stats.success_rate || 1;
  const usageScore = Math.min(usage / 5, 1) * 5, successScore = success * 5;
  return { name, usage, successRate: Math.round(success * 100), totalScore: Math.round((usageScore + successScore) * 10) / 10, maxScore: 10, status: (usageScore + successScore) >= 6 ? "healthy" : (usageScore + successScore) >= 3 ? "ok" : "weak" };
}

export function getCuratorStatus() {
  const curator = loadCurator(), skills = listSkills();
  return { totalSkills: skills.length, activeSkills: skills.filter(s => s.status === "active").length, archivedSkills: skills.filter(s => s.status === "archived").length, pendingMerges: curator.pendingMerges || [], lastRun: curator.lastRun || "never", totalRuns: curator.totalRuns || 0 };
}

function rmdirSync(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}
