import { getGlobalConfig, saveGlobalConfig } from '../config.js'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, writeFileSync } from 'fs'

const SKILL_USAGE_DEBOUNCE_MS = 60_000

const CURATOR_PATH = join(homedir(), '.goodagent', 'skills', '_curator.json')

// Process-lifetime debounce cache — avoids lock + read + parse on debounced
// calls. Same pattern as lastConfigStatTime / globalConfigWriteCount in config.ts.
const lastWriteBySkill = new Map<string, number>()

/**
 * Reads usage stats from the shared curator file (~/.goodagent/skills/_curator.json).
 * Falls back to global config if file doesn't exist.
 */
function readCuratorUsage(): Record<string, { usageCount: number; lastUsedAt: number; successRate?: number }> {
  try {
    if (existsSync(CURATOR_PATH)) {
      const raw = JSON.parse(readFileSync(CURATOR_PATH, 'utf8'))
      const result: Record<string, any> = {}
      for (const [name, stats] of Object.entries(raw)) {
        if (typeof stats === 'object' && stats !== null) {
          result[name] = {
            usageCount: (stats as any).usage_count || 0,
            lastUsedAt: (stats as any).last_used_at || 0,
            successRate: (stats as any).success_rate,
          }
        }
      }
      return result
    }
  } catch {}
  // Fallback: read from global config
  const config = getGlobalConfig()
  const usage = config.skillUsage
  if (!usage) return {}
  const result: Record<string, { usageCount: number; lastUsedAt: number }> = {}
  for (const [name, stats] of Object.entries(usage)) {
    if (typeof stats === 'object' && stats !== null) {
      result[name] = {
        usageCount: (stats as any).usageCount || 0,
        lastUsedAt: (stats as any).lastUsedAt || 0,
      }
    }
  }
  return result
}

/**
 * Writes usage stats to the shared curator file.
 * Also updates the global config for backward compatibility.
 */
function writeCuratorUsage(name: string, stats: { usageCount: number; lastUsedAt: number }) {
  // Update global config (backward compat)
  saveGlobalConfig(current => ({
    ...current,
    skillUsage: {
      ...current.skillUsage,
      [name]: { usageCount: stats.usageCount, lastUsedAt: stats.lastUsedAt },
    },
  }))
}

/**
 * Records a skill usage for ranking purposes.
 * Updates both usage count and last used timestamp.
 * Writes to the shared curator file for cross-system consistency.
 */
export function recordSkillUsage(skillName: string): void {
  const now = Date.now()
  const lastWrite = lastWriteBySkill.get(skillName)
  // The ranking algorithm uses a 7-day half-life, so sub-minute granularity
  // is irrelevant. Bail out before saveGlobalConfig to avoid lock + file I/O.
  if (lastWrite !== undefined && now - lastWrite < SKILL_USAGE_DEBOUNCE_MS) {
    return
  }
  lastWriteBySkill.set(skillName, now)

  const usage = readCuratorUsage()
  const existing = usage[skillName]
  const newStats = {
    usageCount: (existing?.usageCount ?? 0) + 1,
    lastUsedAt: now,
  }

  // Write to global config (backward compat)
  writeCuratorUsage(skillName, newStats)
}

/**
 * Calculates a usage score for a skill based on frequency and recency.
 * Higher scores indicate more frequently and recently used skills.
 *
 * The score uses exponential decay with a half-life of 7 days,
 * meaning usage from 7 days ago is worth half as much as usage today.
 */
export function getSkillUsageScore(skillName: string): number {
  const usage = readCuratorUsage()
  const stats = usage[skillName]
  if (!stats) return 0

  // Recency decay: halve score every 7 days
  const daysSinceUse = stats.lastUsedAt ? (Date.now() - stats.lastUsedAt) / (1000 * 60 * 60 * 24) : 365
  const recencyFactor = Math.pow(0.5, daysSinceUse / 7)

  // Minimum recency factor of 0.1 to avoid completely dropping old but heavily used skills
  return stats.usageCount * Math.max(recencyFactor, 0.1)
}
