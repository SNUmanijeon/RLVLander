import { describe, expect, it } from 'vitest'
import { FIXED_STEP } from './constants'
import { referenceController } from './referenceController'
import { SCENARIOS } from './scenarios'
import { createInitialState, stepSimulation, telemetryFor } from './simulation'
import type { MissionResult, ScenarioConfig } from './types'

function flyReferenceMission(scenario: ScenarioConfig): MissionResult | undefined {
  let state = createInitialState(scenario)
  let telemetry = telemetryFor(state, scenario)
  for (let index = 0; index < 108_000; index += 1) {
    const input = referenceController(state, telemetry, scenario)
    const step = stepSimulation(state, input, scenario, FIXED_STEP)
    state = step.state
    telemetry = step.telemetry
    if (step.result) return step.result
  }
  return undefined
}

describe('reference guidance', () => {
  it.each([SCENARIOS.asds, SCENARIOS.rtls])('can complete $shortName with reserves remaining', (scenario) => {
    const result = flyReferenceMission(scenario)
    expect(result?.outcome).toBe('landed')
    expect(result?.mainFuelRatio).toBeGreaterThan(0)
    expect(result?.rcsRatio).toBeGreaterThan(0)
  })
})
