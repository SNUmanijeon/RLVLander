import { describe, expect, it } from 'vitest'
import { FIXED_STEP, LEG_BREAK_Q } from './constants'
import { altitude, downrange, localVelocity, positionFromLocal, velocityFromLocal } from './math'
import { SCENARIOS, scenarioForMode } from './scenarios'
import { evaluateTouchdown } from './scoring'
import { createInitialState, dragMagnitudeFor, stepSimulation, telemetryFor } from './simulation'
import type { ControlInput, VehicleState } from './types'

const neutral: ControlInput = { throttleDelta: 0, pitchCommand: 0, deployLegs: false }

describe('simulation', () => {
  it('creates scenario state in Earth-centered coordinates', () => {
    const scenario = SCENARIOS.asds
    const state = createInitialState(scenario)
    expect(altitude(state.position)).toBeCloseTo(scenario.initialAltitude, 3)
    expect(downrange(state.position)).toBeCloseTo(scenario.initialDownrange, 3)
    expect(localVelocity(state.position, state.velocity).x).toBeCloseTo(scenario.initialHorizontalVelocity, 3)
  })

  it('never consumes propellant or RCS below zero', () => {
    let state = { ...createInitialState(SCENARIOS.rtls), mainPropellant: 5, rcsRemaining: 0.00001 }
    const input: ControlInput = { throttleDelta: 1, pitchCommand: 1, deployLegs: false }
    for (let index = 0; index < 2_000; index += 1) state = stepSimulation(state, input, SCENARIOS.rtls, FIXED_STEP).state
    expect(state.mainPropellant).toBeGreaterThanOrEqual(0)
    expect(state.rcsRemaining).toBeGreaterThanOrEqual(0)
  })

  it('breaks deployed legs under excessive dynamic pressure', () => {
    const scenario = SCENARIOS.asds
    const position = positionFromLocal(scenario.targetDownrange, 8_000)
    const state: VehicleState = {
      ...createInitialState(scenario),
      position,
      velocity: velocityFromLocal(position, 900, -100),
      legs: 'deployed',
    }
    const telemetry = telemetryFor(state, scenario)
    expect(telemetry.dynamicPressure).toBeGreaterThan(LEG_BREAK_Q)
    expect(stepSimulation(state, neutral, scenario, FIXED_STEP).state.legs).toBe('broken')
  })

  it('preserves the 0-or-40-to-100-percent throttle range', () => {
    const scenario = SCENARIOS.asds
    let state = createInitialState(scenario)
    state = stepSimulation(state, { ...neutral, throttleDelta: 1 }, scenario, FIXED_STEP).state
    expect(state.throttle).toBeCloseTo(0.4, 4)
    state = stepSimulation(state, { ...neutral, throttleDelta: -1 }, scenario, FIXED_STEP).state
    expect(state.throttle).toBe(0)
  })

  it('applies atmospheric drag opposite the velocity in dense air', () => {
    const scenario = SCENARIOS.asds
    const position = positionFromLocal(0, 10_000)
    const state: VehicleState = {
      ...createInitialState(scenario),
      position,
      velocity: velocityFromLocal(position, 1_000, 0),
      angle: Math.PI,
    }
    const before = telemetryFor(state, scenario)
    const after = stepSimulation(state, neutral, scenario, 0.1)
    expect(before.aerodynamicDeceleration).toBeGreaterThan(0)
    expect(dragMagnitudeFor(before.dynamicPressure, scenario)).toBeGreaterThan(0)
    expect(after.telemetry.horizontalVelocity).toBeLessThan(before.horizontalVelocity)
  })

  it('passively restores a perturbed tail-first attitude', () => {
    const baseScenario = SCENARIOS.asds
    const scenario = {
      ...baseScenario,
      vehicle: { ...baseScenario.vehicle, finLeverArm: 0 },
    }
    const position = positionFromLocal(0, 15_000)
    const state: VehicleState = {
      ...createInitialState(scenario),
      position,
      velocity: velocityFromLocal(position, 500, 0),
      angle: -Math.PI + 10 * Math.PI / 180,
      angularRate: 0,
    }
    const after = stepSimulation(state, neutral, scenario, 0.1).state
    expect(after.angularRate).toBeLessThan(0)
  })

  it('records signed RCS activity for visual feedback', () => {
    const scenario = SCENARIOS.asds
    const state = createInitialState(scenario)
    const positive = stepSimulation(
      state,
      { ...neutral, pitchCommand: 1 },
      scenario,
      FIXED_STEP,
    ).state
    expect(positive.rcsCommand).toBeGreaterThan(0)
  })

  it('moves the ASDS toward the estimated coast impact within its motion limits', () => {
    const scenario = SCENARIOS.asds
    const motion = scenario.targetMotion!
    let state = createInitialState(scenario)
    const initialTarget = state.targetDownrange

    for (let index = 0; index < 60 * 120; index += 1) {
      const previousVelocity = state.targetHorizontalVelocity
      state = stepSimulation(state, neutral, scenario, FIXED_STEP).state
      expect(Math.abs(state.targetHorizontalVelocity)).toBeLessThanOrEqual(motion.maxSpeed + 1e-9)
      expect(Math.abs(state.targetHorizontalVelocity - previousVelocity)).toBeLessThanOrEqual(
        motion.maxAcceleration * FIXED_STEP + 1e-9,
      )
    }

    expect(state.targetDownrange).toBeGreaterThan(initialTarget)
    expect(state.targetHorizontalVelocity).toBeGreaterThan(0)
  })

  it('keeps the RTLS pad fixed', () => {
    const scenario = SCENARIOS.rtls
    const state = stepSimulation(createInitialState(scenario), neutral, scenario, 10).state
    expect(state.targetDownrange).toBe(scenario.targetDownrange)
    expect(state.targetHorizontalVelocity).toBe(0)
  })

  it('gives both assisted missions wider control and landing margins', () => {
    for (const id of ['asds', 'rtls'] as const) {
      const standard = SCENARIOS[id]
      const assisted = scenarioForMode(id, 'assisted')
      expect(assisted.initialMainPropellant).toBeGreaterThan(standard.initialMainPropellant)
      expect(assisted.targetWidth).toBeGreaterThan(standard.targetWidth)
      expect(assisted.vehicle.minThrottle).toBeLessThan(standard.vehicle.minThrottle)
      expect(assisted.vehicle.rcsFullCommandSeconds).toBeGreaterThan(
        standard.vehicle.rcsFullCommandSeconds,
      )
      expect(assisted.landingLimits.descentSpeed).toBeGreaterThan(
        standard.landingLimits.descentSpeed,
      )
      expect(assisted.legBreakDynamicPressure).toBeGreaterThan(
        standard.legBreakDynamicPressure,
      )
    }
  })
})

describe('touchdown classification', () => {
  it('accepts a centered, upright, soft touchdown', () => {
    const scenario = SCENARIOS.rtls
    const position = positionFromLocal(scenario.targetDownrange, 0)
    const radialAngle = Math.atan2(position.y, position.x)
    const state: VehicleState = {
      ...createInitialState(scenario),
      position,
      velocity: velocityFromLocal(position, 1, -2),
      angle: radialAngle,
      angularRate: 0,
      legs: 'deployed',
    }
    const result = evaluateTouchdown(state, telemetryFor(state, scenario), scenario)
    expect(result.outcome).toBe('landed')
    expect(result.score).toBeGreaterThan(0)
  })

  it('rejects a touchdown without legs', () => {
    const scenario = SCENARIOS.rtls
    const position = positionFromLocal(scenario.targetDownrange, 0)
    const state: VehicleState = {
      ...createInitialState(scenario),
      position,
      velocity: velocityFromLocal(position, 0, -1),
      angle: Math.atan2(position.y, position.x),
      legs: 'stowed',
    }
    expect(evaluateTouchdown(state, telemetryFor(state, scenario), scenario).reason).toBe('legs_stowed')
  })

  it('judges ASDS lateral speed relative to the moving deck', () => {
    const scenario = SCENARIOS.asds
    const position = positionFromLocal(scenario.targetDownrange, 0)
    const state: VehicleState = {
      ...createInitialState(scenario),
      position,
      velocity: velocityFromLocal(position, 7, -2),
      angle: Math.atan2(position.y, position.x),
      angularRate: 0,
      legs: 'deployed',
      targetDownrange: scenario.targetDownrange,
      targetHorizontalVelocity: 7,
    }
    const result = evaluateTouchdown(state, telemetryFor(state, scenario), scenario)
    expect(result.outcome).toBe('landed')
    expect(result.horizontalSpeed).toBeCloseTo(0)
  })

  it('accepts a forgiving touchdown only in the assisted profile', () => {
    const standard = SCENARIOS.rtls
    const assisted = scenarioForMode('rtls', 'assisted')
    const position = positionFromLocal(assisted.targetDownrange, 0)
    const radialAngle = Math.atan2(position.y, position.x)
    const state: VehicleState = {
      ...createInitialState(assisted),
      position,
      velocity: velocityFromLocal(position, 4, -5),
      angle: radialAngle + 8 * Math.PI / 180,
      angularRate: 8 * Math.PI / 180,
      legs: 'deployed',
    }
    expect(evaluateTouchdown(state, telemetryFor(state, standard), standard).outcome).toBe('crashed')
    expect(evaluateTouchdown(state, telemetryFor(state, assisted), assisted).outcome).toBe('landed')
  })
})
