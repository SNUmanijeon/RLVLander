import { describe, expect, it } from 'vitest'
import { FIXED_STEP } from './constants'
import { SCENARIOS } from './scenarios'
import { createInitialState, stepSimulation } from './simulation'
import type { ScenarioConfig } from './types'

function passiveFlight(scenario: ScenarioConfig) {
  let state = createInitialState(scenario)
  let maximumMach = 0
  let maximumQ = 0
  let finalDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < 90_000; index += 1) {
    const step = stepSimulation(
      state,
      { throttleDelta: 0, pitchCommand: 0, deployLegs: false },
      scenario,
      FIXED_STEP,
    )
    state = step.state
    maximumMach = Math.max(maximumMach, step.telemetry.mach)
    maximumQ = Math.max(maximumQ, step.telemetry.dynamicPressure)
    finalDistance = step.telemetry.distanceToTarget
    if (step.result) break
  }
  return { maximumMach, maximumQ, finalDistance, elapsed: state.time }
}

describe('scenario calibration', () => {
  it('places the ASDS close to the passive impact corridor', () => {
    const flight = passiveFlight(SCENARIOS.asds)
    expect(Math.abs(flight.finalDistance)).toBeLessThan(5_000)
  })

  it('makes RTLS the higher-energy mission and requires boost-back', () => {
    const asds = passiveFlight(SCENARIOS.asds)
    const rtls = passiveFlight(SCENARIOS.rtls)
    expect(Math.abs(rtls.finalDistance)).toBeGreaterThan(200_000)
    expect(rtls.maximumMach).toBeGreaterThan(asds.maximumMach)
    expect(rtls.maximumQ).toBeGreaterThan(asds.maximumQ)
  })
})
