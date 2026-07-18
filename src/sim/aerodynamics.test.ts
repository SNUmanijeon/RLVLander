import { describe, expect, it } from 'vitest'
import { gridFinAxialCoefficient, gridFinNormalCoefficient } from './aerodynamics'
import { DEG } from './constants'

describe('grid-fin coefficient model', () => {
  it('interpolates the digitized normal-force curve', () => {
    expect(gridFinNormalCoefficient(0)).toBe(0)
    expect(gridFinNormalCoefficient(10 * DEG)).toBeCloseTo(0.08, 6)
    expect(gridFinNormalCoefficient(15 * DEG)).toBeCloseTo(0.115, 6)
    expect(gridFinNormalCoefficient(20 * DEG)).toBeCloseTo(0.15, 6)
  })

  it('is odd-symmetric and clamps outside the data range', () => {
    expect(gridFinNormalCoefficient(-10 * DEG)).toBeCloseTo(-0.08, 6)
    expect(gridFinNormalCoefficient(40 * DEG)).toBeCloseTo(0.15, 6)
  })

  it('keeps axial coefficient independent of angle', () => {
    expect(gridFinAxialCoefficient()).toBe(0.05)
  })
})

