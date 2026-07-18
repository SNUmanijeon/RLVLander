import { clamp, lerp } from './math'

export interface AtmosphereSample {
  density: number
  pressure: number
  speedOfSound: number
}

interface AtmosphereRow extends AtmosphereSample {
  altitude: number
}

// Compact 1976-standard-atmosphere approximation. Density and pressure use
// logarithmic interpolation so the reentry forces remain smooth.
const TABLE: AtmosphereRow[] = [
  { altitude: 0, density: 1.225, pressure: 101_325, speedOfSound: 340.3 },
  { altitude: 5_000, density: 0.7361, pressure: 54_020, speedOfSound: 320.5 },
  { altitude: 10_000, density: 0.4135, pressure: 26_436, speedOfSound: 299.5 },
  { altitude: 15_000, density: 0.1948, pressure: 12_045, speedOfSound: 295.1 },
  { altitude: 20_000, density: 0.08891, pressure: 5_475, speedOfSound: 295.1 },
  { altitude: 25_000, density: 0.04008, pressure: 2_511, speedOfSound: 298.5 },
  { altitude: 30_000, density: 0.01841, pressure: 1_172, speedOfSound: 301.7 },
  { altitude: 40_000, density: 0.003996, pressure: 287.1, speedOfSound: 317.2 },
  { altitude: 50_000, density: 0.001027, pressure: 79.8, speedOfSound: 329.8 },
  { altitude: 60_000, density: 0.0003097, pressure: 21.96, speedOfSound: 314.3 },
  { altitude: 70_000, density: 0.00008283, pressure: 5.22, speedOfSound: 295.1 },
  { altitude: 80_000, density: 0.00001846, pressure: 1.05, speedOfSound: 282.5 },
  { altitude: 90_000, density: 0.00000342, pressure: 0.184, speedOfSound: 274 },
  { altitude: 100_000, density: 0.00000056, pressure: 0.032, speedOfSound: 276 },
  { altitude: 110_000, density: 0.000000097, pressure: 0.007, speedOfSound: 300 },
  { altitude: 120_000, density: 0.000000022, pressure: 0.002, speedOfSound: 335 },
]

export function sampleAtmosphere(altitudeMeters: number): AtmosphereSample {
  if (altitudeMeters >= TABLE[TABLE.length - 1].altitude) {
    return { density: 0, pressure: 0, speedOfSound: TABLE[TABLE.length - 1].speedOfSound }
  }

  const h = clamp(altitudeMeters, 0, TABLE[TABLE.length - 1].altitude)
  let upperIndex = 1
  while (TABLE[upperIndex].altitude < h) upperIndex += 1
  const lower = TABLE[upperIndex - 1]
  const upper = TABLE[upperIndex]
  const t = (h - lower.altitude) / (upper.altitude - lower.altitude)

  return {
    density: Math.exp(lerp(Math.log(lower.density), Math.log(upper.density), t)),
    pressure: Math.exp(lerp(Math.log(lower.pressure), Math.log(upper.pressure), t)),
    speedOfSound: lerp(lower.speedOfSound, upper.speedOfSound, t),
  }
}

