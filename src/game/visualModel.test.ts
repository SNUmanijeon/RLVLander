import { describe, expect, it } from 'vitest'
import { altitude, downrange } from '../sim/math'
import { SCENARIOS } from '../sim/scenarios'
import {
  fixedCameraScale,
  reentryIntensity,
  secondStageVisual,
  skyBlendForAltitude,
} from './visualModel'

describe('visual flight model', () => {
  it('returns one fixed landing scale for a viewport', () => {
    const scale = fixedCameraScale(1_280, 720)
    expect(scale).toBeGreaterThan(0)
    expect(scale).toBeCloseTo(1_400 / (720 * 0.7))
  })

  it('transitions from space to a blue lower atmosphere', () => {
    expect(skyBlendForAltitude(70_000)).toBe(0)
    expect(skyBlendForAltitude(30_000)).toBeCloseTo(0.5)
    expect(skyBlendForAltitude(0)).toBe(1)
  })

  it('shows reentry effects only for a fast atmospheric descent', () => {
    expect(reentryIntensity(40_000, 4, 30_000, -700)).toBeGreaterThan(0.2)
    expect(reentryIntensity(40_000, 0.8, 30_000, -700)).toBe(0)
    expect(reentryIntensity(40_000, 4, 30_000, 100)).toBe(0)
  })

  it('moves the second stage upward and downrange after separation', () => {
    const start = secondStageVisual(SCENARIOS.asds, 0)
    const later = secondStageVisual(SCENARIOS.asds, 10)
    expect(downrange(later.position)).toBeGreaterThan(downrange(start.position))
    expect(altitude(later.position)).toBeGreaterThan(altitude(start.position))
    expect(later.active).toBe(true)
    expect(secondStageVisual(SCENARIOS.asds, 46).active).toBe(false)
  })
})
