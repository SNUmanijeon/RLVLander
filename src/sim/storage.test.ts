import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TIME_SCALES } from './constants'
import {
  loadGameData,
  saveAssistMode,
  saveBestScore,
  saveCameraMode,
  saveTimeScale,
} from './storage'

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
  it('offers the requested simulation speed ladder', () => {
    expect(TIME_SCALES).toEqual([1, 2, 5, 10, 20])
  })

  it('keeps only the better score for each mission', () => {
    saveBestScore('asds', 'standard', 500)
    saveBestScore('asds', 'standard', 200)
    saveBestScore('asds', 'assisted', 700)
    expect(loadGameData().bestScores).toEqual({
      'asds:standard': 500,
      'asds:assisted': 700,
    })
  })

  it('persists the selected time scale', () => {
    saveTimeScale(20)
    expect(loadGameData().timeScale).toBe(20)
  })

  it('persists camera and assistance preferences', () => {
    saveCameraMode('base')
    saveAssistMode('standard')
    expect(loadGameData().cameraMode).toBe('base')
    expect(loadGameData().assistMode).toBe('standard')
  })

  it('migrates legacy mission scores to the standard profile', () => {
    localStorage.setItem('rlv-lander:v1', JSON.stringify({
      bestScores: { asds: 450, rtls: 600 },
      timeScale: 2,
    }))
    expect(loadGameData().bestScores).toEqual({
      'asds:standard': 450,
      'rtls:standard': 600,
    })
  })

  it('recovers safely from malformed storage', () => {
    localStorage.setItem('rlv-lander:v1', 'not-json')
    expect(loadGameData()).toEqual({
      bestScores: {},
      timeScale: 2,
      cameraMode: 'auto',
      assistMode: 'assisted',
    })
  })
})
