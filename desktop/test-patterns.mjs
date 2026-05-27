import { detectPatterns } from "./skills-store.mjs";
import { DatabaseSync } from "node:sqlite";
import { join } from "path";
import { homedir } from "os";

const db = new DatabaseSync(join(homedir(), ".goodagent", "sessions.db"));
const mockDb = {
  listSessions: (n) => db.prepare("SELECT id, title FROM sessions ORDER BY updated_at DESC LIMIT ?").all(n),
  loadSession: (id) => {
    const msgs = db.prepare("SELECT role, content FROM messages WHERE session_id=? ORDER BY id").all(id);
    return { id, history: msgs };
  }
};

const patterns = detectPatterns(mockDb);
console.log("Detected", patterns.length, "patterns:");
patterns.forEach(p => console.log(`  - "${p.phrase}" (${p.count}x)`));
db.close();
