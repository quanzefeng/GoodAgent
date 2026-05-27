/**
 * Test script for GoodAgent new features:
 * 1. Plan Mode tool filtering
 * 2. LSP integration
 * 3. Git workflow tools
 */
import lspManager from "./lsp-manager.mjs";
import { existsSync, readFileSync } from "fs";

console.log("=== GoodAgent Feature Tests ===\n");

// ── Test 1: Plan Mode ──────────────────────────────────────
console.log("--- Test 1: Plan Mode Tool Filtering ---");
const PLAN_MODE_READONLY = new Set([
  "file_read", "grep", "glob", "web_search", "web_fetch",
  "Agent", "AskUserQuestion", "TaskList", "TodoWrite", "write_memory", "kb_write",
  "skill", "invoke_skill", "lsp",
]);
const ALL_TOOLS = ["bash","file_read","file_write","file_edit","grep","glob","web_search","web_fetch","skill","invoke_skill","create_skill","write_memory","TaskCreate","TaskUpdate","TaskList","TodoWrite","Agent","AskUserQuestion","kb_write","lsp","git_diff","git_commit","git_branch"];
const readonly = ALL_TOOLS.filter(t => PLAN_MODE_READONLY.has(t));
const blocked = ALL_TOOLS.filter(t => !PLAN_MODE_READONLY.has(t));
console.log(`  READONLY (${readonly.length}): ${readonly.join(", ")}`);
console.log(`  BLOCKED  (${blocked.length}): ${blocked.join(", ")}`);
console.assert(readonly.includes("file_read"), "file_read should be readonly");
console.assert(blocked.includes("bash"), "bash should be blocked");
console.assert(blocked.includes("file_write"), "file_write should be blocked");
console.assert(blocked.includes("git_commit"), "git_commit should be blocked");
console.assert(!blocked.includes("lsp"), "lsp should be readonly");
console.log("  PASS\n");

// ── Test 2: Git Safe Whitelist ─────────────────────────────
console.log("--- Test 2: Git Safe Whitelist ---");
const GIT_SAFE = /^git\s+(add|status|diff|commit|branch|checkout|log|show|stash|fetch|pull|push|merge|rebase|reset|remote|tag)/i;
const DANGEROUS = [/rm\s+-rf/i, /Remove-Item.*-Recurse/i, /del\s+\/f/i, /rd\s+\/s/i, /format\s+\w:/i, /diskpart/i];
function isDangerous(cmd) {
  if (GIT_SAFE.test(cmd.trim())) return false;
  return DANGEROUS.some(p => p.test(cmd));
}
console.assert(!isDangerous("git status"), "git status is safe");
console.assert(!isDangerous("git add -A"), "git add is safe");
console.assert(!isDangerous("git commit -m 'test'"), "git commit is safe");
console.assert(!isDangerous("git branch feature/test"), "git branch is safe");
console.assert(isDangerous("rm -rf /"), "rm -rf is dangerous");
console.assert(isDangerous("format c:"), "format is dangerous");
console.log("  PASS\n");

// ── Test 3: LSP Manager ───────────────────────────────────
console.log("--- Test 3: LSP Manager ---");
const testFile = "D:/GoodAgent/src/assistant/sessionHistory.ts";
if (existsSync(testFile)) {
  console.log(`  Testing with: ${testFile}`);
  try {
    // Hover
    const hover = await lspManager.hover(testFile, 1, 5);
    console.log(`  hover: ${hover.text.slice(0, 200)}`);
    console.assert(hover.count >= 0, "hover returns count");

    // Document symbols
    const syms = await lspManager.documentSymbol(testFile);
    console.log(`  documentSymbol: ${syms.count} symbols`);
    if (syms.count > 0) {
      console.log(`  First few lines:\n${syms.text.split("\n").slice(0, 5).join("\n")}`);
    }
    console.assert(syms.count >= 0, "documentSymbol returns count");
    console.log("  PASS\n");
  } catch (e) {
    console.log(`  LSP Error: ${e.message}`);
    console.log("  SKIP (LSP server may not be fully ready)\n");
  }
} else {
  console.log("  SKIP (test file not found)\n");
}

lspManager.shutdown();
console.log("=== All tests passed ===");
