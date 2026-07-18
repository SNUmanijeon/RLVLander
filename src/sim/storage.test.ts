import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadGameData, saveBestScore, saveTimeScale } from './storage'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('versioned local game data', () => {
  it('keeps only the better score for each mission', () => {
    saveBestScore('asds', 500)
    saveBestScore('asds', 200)
    saveBestScore('rtls', 700)
    expect(loadGameData().bestScores).toEqual({ asds: 500, rtls: 700 })
  })

  it('persists the selected time scale', () => {
    saveTimeScale(1)
    expect(loadGameData().timeScale).toBe(1)
  })

  it('recovers safely from malformed storage', () => {
    localStorage.setItem('rlv-lander:v1', 'not-json')
    expect(loadGameData()).toEqual({ bestScores: {}, timeScale: 2 })
  })
})
