import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export type QuestionFirstScaleManifest = {
  entities?: Array<{
    entity_id?: string
    entity_name?: string
    entity_type?: string
    default_rollout_phase?: string
  }>
  sort_key?: string[]
  [key: string]: unknown
}

export type QuestionFirstLiveQueueSnapshot = {
  loop_status?: Record<string, unknown>
  queue?: Record<string, unknown>
  [key: string]: unknown
}

function readJsonIfExists<T>(candidatePaths: string[]): T | null {
  for (const candidatePath of candidatePaths) {
    if (!existsSync(candidatePath)) continue
    try {
      return JSON.parse(readFileSync(candidatePath, 'utf8')) as T
    } catch {
      // Keep searching; a malformed generated artifact should not break the build.
    }
  }

  return null
}

function resolveCandidatePaths(appRoot: string, fileName: string): string[] {
  return [
    path.resolve(appRoot, 'backend', 'data', fileName),
    path.resolve(appRoot, 'apps', 'signal-noise-app', 'backend', 'data', fileName),
  ]
}

export function loadQuestionFirstScaleManifest(appRoot = process.cwd()): QuestionFirstScaleManifest {
  return readJsonIfExists<QuestionFirstScaleManifest>(resolveCandidatePaths(appRoot, 'question_first_scale_batch_3000_live.json')) || { entities: [] }
}

export function loadQuestionFirstLiveQueueSnapshot(appRoot = process.cwd()): QuestionFirstLiveQueueSnapshot {
  return readJsonIfExists<QuestionFirstLiveQueueSnapshot>(resolveCandidatePaths(appRoot, 'question_first_live_queue_snapshot.json')) || {}
}
