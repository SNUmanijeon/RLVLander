import { describe, expect, it } from 'vitest'
import { sampleAtmosphere } from './atmosphere'

describe('sampleAtmosphere', () => {
  it('returns sea-level conditions at and below zero altitude', () => {
    const sample = sampleAtmosphere(-100)
    expect(sample.density).toBeCloseTo(1.225, 3)
    expect(sample.pressure).toBeCloseTo(101_325, 0)
  })

  it('decreases density and pressure with altitude', () => {
    const low = sampleAtmosphere(10_000)
    const high = sampleAtmosphere(40_000)
    expect(high.density).toBeLessThan(low.density)
    expect(high.pressure).toBeLessThan(low.pressure)
  })

  it('returns vacuum above the supported table', () => {
    expect(sampleAtmosphere(121_000).density).toBe(0)
    expect(sampleAtmosphere(121_000).pressure).toBe(0)
  })
})

