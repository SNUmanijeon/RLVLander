import type { ScenarioId } from './types'

const STORAGE_KEY = 'rlv-lander:v1'

interface StoredGameData {
  bestScores: Partial<Record<ScenarioId, number>>
  timeScale: 1 | 2
}

function defaultData(): StoredGameData {
  return { bestScores: {}, timeScale: 2 }
}

export function loadGameData(): StoredGameData {
  if (typeof localStorage === 'undefined') return defaultData()
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<StoredGameData>
    return {
      bestScores: parsed.bestScores ?? {},
      timeScale: parsed.timeScale === 1 ? 1 : 2,
    }
  } catch {
    return defaultData()
  }
}

export function saveBestScore(scenario: ScenarioId, score: number): StoredGameData {
  const data = loadGameData()
  data.bestScores[scenario] = Math.max(data.bestScores[scenario] ?? 0, score)
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
}

export function saveTimeScale(timeScale: 1 | 2): void {
  const data = loadGameData()
  data.timeScale = timeScale
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
