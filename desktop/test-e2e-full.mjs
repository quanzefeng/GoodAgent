/**
 * Comprehensive E2E test — all memory systems
 */
import sessionDb from "./session-db.mjs";
import * as memory from "./memory-store.mjs";
import * as skills from "./skills-store.mjs";
import { DatabaseSync } from "node:sqlite";
import { join } from "path";
import { homedir } from "os";

const failed = [];
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.log(`  ✗ ${name}: ${e.message}`); failed.push(name); }
}

console.log("═══ Session DB ═══");
const s = sessionDb.createSession("E2E Test");
test("create session", () => { if (!s.id) throw new Error("no id"); });

sessionDb.saveSession(s.id, [
  { role: "user", content: "Hello world test" },
  { role: "assistant", content: "Hi there!" },
  { role: "user", content: "Can you search me?" },
], "Test Session");
test("save session", () => { if (sessionDb.loadSession(s.id).history.length !== 3) throw new Error("wrong count"); });

test("list sessions", () => { if (sessionDb.listSessions(10).length < 1) throw new Error("empty"); });

test("search FTS5", () => {
  const r = sessionDb.searchMessages("search", 10);
  if (r.length === 0) throw new Error("no results");
});

test("search CJK fallback", () => {
  const r = sessionDb.searchMessages("测试", 10);
  // CJK fallback may or may not find it — just test no crash
});

test("update title", () => {
  sessionDb.updateTitle(s.id, "Updated Title");
  if (sessionDb.loadSession(s.id).title !== "Updated Title") throw new Error("not updated");
});

test("delete session", () => {
  sessionDb.deleteSession(s.id);
  if (sessionDb.loadSession(s.id) !== null) throw new Error("not deleted");
});

test("getLastSession excludeId", () => {
  const s2 = sessionDb.createSession("A"); sessionDb.saveSession(s2.id, [{role:"user",content:"a"}], "A");
  const s3 = sessionDb.createSession("B"); sessionDb.saveSession(s3.id, [{role:"user",content:"b"}], "B");
  const last = sessionDb.getLastSession(2, s3.id);
  if (!last || last.id === s3.id) throw new Error("did not exclude current");
  sessionDb.deleteSession(s2.id); sessionDb.deleteSession(s3.id);
});

console.log("\n═══ Memory Store ═══");
const origUser = memory.readUserMemory();
test("read user memory", () => { /* no throw */ });
test("write user memory", () => {
  memory.writeUserMemory("## Test\n- Item 1\n- Item 2");
  if (!memory.readUserMemory().includes("Item 1")) throw new Error("write failed");
});
test("append user memory", () => {
  memory.appendUserMemory("- Item 3");
  if (!memory.readUserMemory().includes("Item 3")) throw new Error("append failed");
});
test("check duplicate", () => {
  // Should detect similarity
  const isDup = memory.checkDuplicate("user", "Test Item 1 Item 2");
  if (!isDup) throw new Error("dup not detected");
  const notDup = memory.checkDuplicate("user", "Completely different content here");
  if (notDup) throw new Error("false positive");
});

console.log("\n═══ Skills Store ═══");
test("list skills (empty)", () => { if (skills.listSkills().length !== 0) throw new Error("not empty"); });

test("save skill", () => {
  skills.saveSkill("test-skill", {
    name: "test-skill", description: "A test skill", triggers: ["test"], version: "1.0.0", status: "active", created_at: new Date().toISOString()
  }, "## Steps\n1. Do A\n2. Do B\n## Notes\n- Important");
  if (skills.listSkills().length !== 1) throw new Error("not saved");
});

test("load skill", () => {
  const sk = skills.loadSkill("test-skill");
  if (!sk || !sk.body.includes("Steps")) throw new Error("load failed");
});

test("record usage", () => {
  skills.recordSkillUsage("test-skill", true);
  skills.recordSkillUsage("test-skill", true);
  const list = skills.listSkills();
  if (list[0].usage_count < 2) throw new Error("usage not recorded");
});

test("set status", () => {
  skills.setSkillStatus("test-skill", "archived");
  const list = skills.listSkills().filter(s => s.name === "test-skill");
  if (list[0]?.status !== "archived") throw new Error("status not set");
  skills.setSkillStatus("test-skill", "active");
});

test("health score", () => {
  const h = skills.getSkillHealth("test-skill");
  if (!h || h.totalScore < 0) throw new Error("invalid health");
  if (h.status !== "healthy" && h.status !== "ok" && h.status !== "weak") throw new Error("invalid status");
});

test("curator status", () => {
  const cs = skills.getCuratorStatus();
  if (cs.totalSkills < 1) throw new Error("curator empty");
});

test("run curator", () => {
  const r = skills.runCurator();
  if (r.lastRun === undefined) throw new Error("curator not run");
});

test("delete skill", () => {
  skills.deleteSkill("test-skill");
  if (skills.listSkills().length !== 0) throw new Error("not deleted");
});

// Cleanup
memory.writeUserMemory(origUser);

console.log(`\n${failed.length > 0 ? '✗ ' + failed.length + ' FAILED' : '✓ ALL ' + (failed.length === undefined ? '' : '') + 'PASSED'}`);
if (failed.length > 0) console.log("Failed:", failed.join(", "));
sessionDb.close();
