import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS } from './constants'
import { magnitude } from './math'
import { predictGravityOnly } from './predictor'
import { SCENARIOS } from './scenarios'
import { createInitialState } from './simulation'

describe('gravity-only predictor', () => {
  it('returns a forward path that terminates at the surface', () => {
    const points = predictGravityOnly(createInitialState(SCENARIOS.asds))
    expect(points.length).toBeGreaterThan(2)
    expect(magnitude(points.at(-1)!)).toBeLessThanOrEqual(EARTH_RADIUS)
  })
})
