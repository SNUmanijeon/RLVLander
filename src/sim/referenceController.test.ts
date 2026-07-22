import { describe, expect, it } from 'vitest'
import { FIXED_STEP } from './constants'
import { referenceController } from './referenceController'
import { SCENARIOS, scenarioForMode } from './scenarios'
import { createInitialState, stepSimulation, telemetryFor } from './simulation'
import type { MissionResult, ScenarioConfig } from './types'

interface ReferenceFlight {
  result: MissionResult
  signedTargetError: number
}

function flyReferenceMission(scenario: ScenarioConfig): ReferenceFlight | undefined {
  let state = createInitialState(scenario)
  let telemetry = telemetryFor(state, scenario)
  for (let index = 0; index < 108_000; index += 1) {
    const input = referenceController(state, telemetry, scenario)
    const step = stepSimulation(state, input, scenario, FIXED_STEP)
    state = step.state
    telemetry = step.telemetry
    if (step.result) {
      return { result: step.result, signedTargetError: telemetry.distanceToTarget }
    }
  }
  return undefined
}

describe('reference guidance', () => {
  it.each([
    SCENARIOS.asds,
    SCENARIOS.rtls,
    scenarioForMode('asds', 'assisted'),
    scenarioForMode('rtls', 'assisted'),
  ])('can complete $shortName $assistMode with reserves remaining', (scenario) => {
    const flight = flyReferenceMission(scenario)
    expect(flight?.result.outcome, JSON.stringify(flight)).toBe('landed')
    expect(flight?.result.mainFuelRatio).toBeGreaterThan(0)
    expect(flight?.result.rcsRatio).toBeGreaterThan(0)
  })
})
