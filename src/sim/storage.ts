import { TIME_SCALES } from './constants'
import { scoreKey } from './scenarios'
import type {
  AssistMode,
  CameraMode,
  ScenarioId,
  ScoreKey,
  TimeScale,
} from './types'

const STORAGE_KEY = 'rlv-lander:v1'

interface StoredGameData {
  bestScores: Partial<Record<ScoreKey, number>>
  timeScale: TimeScale
  cameraMode: CameraMode
  assistMode: AssistMode
}

function defaultData(): StoredGameData {
  return { bestScores: {}, timeScale: 2, cameraMode: 'auto', assistMode: 'assisted' }
}

function normalizeBestScores(value: unknown): Partial<Record<ScoreKey, number>> {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const scores: Partial<Record<ScoreKey, number>> = {}

  for (const id of ['asds', 'rtls'] as const) {
    for (const mode of ['assisted', 'standard'] as const) {
      const key = scoreKey(id, mode)
      const score = raw[key]
      if (typeof score === 'number' && Number.isFinite(score)) scores[key] = score
    }
    const legacyScore = raw[id]
    const standardKey = scoreKey(id, 'standard')
    if (typeof legacyScore === 'number' && Number.isFinite(legacyScore)) {
      scores[standardKey] = Math.max(scores[standardKey] ?? 0, legacyScore)
    }
  }
  return scores
}

export function loadGameData(): StoredGameData {
  if (typeof localStorage === 'undefined') return defaultData()
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<StoredGameData>
    return {
      bestScores: normalizeBestScores(parsed.bestScores),
      timeScale: TIME_SCALES.includes(parsed.timeScale as TimeScale) ? parsed.timeScale as TimeScale : 2,
      cameraMode: ['base', 'zoom', 'auto'].includes(parsed.cameraMode ?? '')
        ? parsed.cameraMode as CameraMode
        : 'auto',
      assistMode: parsed.assistMode === 'standard' ? 'standard' : 'assisted',
    }
  } catch {
    return defaultData()
  }
}

export function saveBestScore(
  scenario: ScenarioId,
  mode: AssistMode,
  score: number,
): StoredGameData {
  const data = loadGameData()
  const key = scoreKey(scenario, mode)
  data.bestScores[key] = Math.max(data.bestScores[key] ?? 0, score)
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
}

export function saveTimeScale(timeScale: TimeScale): void {
  const data = loadGameData()
  data.timeScale = timeScale
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function saveCameraMode(cameraMode: CameraMode): void {
  const data = loadGameData()
  data.cameraMode = cameraMode
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function saveAssistMode(assistMode: AssistMode): void {
  const data = loadGameData()
  data.assistMode = assistMode
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
