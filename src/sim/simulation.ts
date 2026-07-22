import { gridFinAxialCoefficient, gridFinNormalCoefficient, finForceRatio } from './aerodynamics'
import { sampleAtmosphere } from './atmosphere'
import {
  EARTH_MU,
  EARTH_RADIUS,
  FIN_RATE,
  G0,
  MAX_FIN_ANGLE,
  RCS_FULL_Q,
  RCS_ZERO_Q,
  SEA_LEVEL_PRESSURE,
} from './constants'
import {
  add,
  altitude,
  clamp,
  cross,
  downrange,
  eastUnit,
  lerp,
  localVelocity,
  magnitude,
  normalize,
  positionFromLocal,
  radialUnit,
  scale,
  velocityFromLocal,
  wrapAngle,
} from './math'
import { evaluateTouchdown } from './scoring'
import { predictPassiveImpactDownrange } from './predictor'
import type {
  ControlInput,
  ScenarioConfig,
  SimulationStep,
  Telemetry,
  Vec2,
  VehicleState,
} from './types'

function moveToward(current: number, target: number, maximumDelta: number): number {
  if (Math.abs(target - current) <= maximumDelta) return target
  return current + Math.sign(target - current) * maximumDelta
}

export function createInitialState(scenario: ScenarioConfig): VehicleState {
  const position = positionFromLocal(scenario.initialDownrange, scenario.initialAltitude)
  const velocity = velocityFromLocal(
    position,
    scenario.initialHorizontalVelocity,
    scenario.initialVerticalVelocity,
  )
  const state: VehicleState = {
    time: 0,
    position,
    velocity,
    angle: Math.atan2(velocity.y, velocity.x),
    angularRate: 0,
    mainPropellant: scenario.initialMainPropellant,
    initialMainPropellant: scenario.initialMainPropellant,
    throttle: 0,
    engineCount: 0,
    rcsRemaining: 1,
    rcsCommand: 0,
    finDeflection: 0,
    legs: 'stowed',
    targetDownrange: scenario.targetDownrange,
    targetHorizontalVelocity: 0,
    estimatedImpactDownrange: scenario.targetDownrange,
  }
  state.estimatedImpactDownrange = predictPassiveImpactDownrange(state, scenario)
  return state
}

function rcsBlendForQ(dynamicPressure: number): number {
  if (dynamicPressure <= RCS_FULL_Q) return 1
  if (dynamicPressure >= RCS_ZERO_Q) return 0
  return 1 - (dynamicPressure - RCS_FULL_Q) / (RCS_ZERO_Q - RCS_FULL_Q)
}

function applyThrottleInput(current: number, direction: -1 | 0 | 1, dt: number, minimum: number): number {
  if (direction === 0) return current
  if (direction > 0) return current === 0 ? minimum : clamp(current + 0.35 * dt, minimum, 1)
  if (current <= minimum + 1e-6) return 0
  return Math.max(minimum, current - 0.35 * dt)
}

function enginePerformance(pressure: number, scenario: ScenarioConfig): { thrust: number; isp: number } {
  const vacuumFraction = 1 - clamp(pressure / SEA_LEVEL_PRESSURE, 0, 1)
  return {
    thrust: lerp(scenario.vehicle.thrustSeaLevel, scenario.vehicle.thrustVacuum, vacuumFraction),
    isp: lerp(scenario.vehicle.ispSeaLevel, scenario.vehicle.ispVacuum, vacuumFraction),
  }
}

function aerodynamicOrientation(state: VehicleState): { axisAngle: number; directionSign: 1 | -1 } {
  const forward: Vec2 = { x: Math.cos(state.angle), y: Math.sin(state.angle) }
  const noseFirst = state.velocity.x * forward.x + state.velocity.y * forward.y >= 0
  return {
    axisAngle: noseFirst ? state.angle : state.angle + Math.PI,
    directionSign: noseFirst ? 1 : -1,
  }
}

export function dragMagnitudeFor(dynamicPressure: number, scenario: ScenarioConfig): number {
  return dynamicPressure * scenario.vehicle.referenceArea *
    (scenario.vehicle.bodyCd + gridFinAxialCoefficient())
}

export function telemetryFor(
  state: VehicleState,
  scenario: ScenarioConfig,
  currentFinForce = 0,
): Telemetry {
  const h = Math.max(0, altitude(state.position))
  const atmosphere = sampleAtmosphere(h)
  const speed = magnitude(state.velocity)
  const local = localVelocity(state.position, state.velocity)
  const q = 0.5 * atmosphere.density * speed * speed
  const radialAngle = Math.atan2(state.position.y, state.position.x)
  const mass = scenario.vehicle.dryMass + state.mainPropellant
  const dragMagnitude = dragMagnitudeFor(q, scenario)
  return {
    elapsedTime: state.time,
    altitude: h,
    downrange: downrange(state.position),
    horizontalVelocity: local.x,
    verticalVelocity: local.y,
    speed,
    mach: atmosphere.speedOfSound > 0 ? speed / atmosphere.speedOfSound : 0,
    dynamicPressure: q,
    aerodynamicDeceleration: mass > 0 ? dragMagnitude / mass : 0,
    density: atmosphere.density,
    pressure: atmosphere.pressure,
    mainFuelRatio: state.initialMainPropellant > 0 ? state.mainPropellant / state.initialMainPropellant : 0,
    rcsRatio: state.rcsRemaining,
    finForceRatio: finForceRatio(currentFinForce, scenario.vehicle.referenceArea),
    rcsBlend: rcsBlendForQ(q),
    distanceToTarget: downrange(state.position) - state.targetDownrange,
    targetDownrange: state.targetDownrange,
    targetHorizontalVelocity: state.targetHorizontalVelocity,
    relativeHorizontalVelocity: local.x - state.targetHorizontalVelocity,
    estimatedImpactDownrange: state.estimatedImpactDownrange,
    estimatedImpactError: state.estimatedImpactDownrange - state.targetDownrange,
    pitch: wrapAngle(state.angle - radialAngle),
    angularRate: state.angularRate,
    throttle: state.throttle,
    engineCount: state.engineCount,
    legs: state.legs,
  }
}

export function stepSimulation(
  previous: VehicleState,
  input: ControlInput,
  scenario: ScenarioConfig,
  dt: number,
): SimulationStep {
  const vehicle = scenario.vehicle
  const h = Math.max(0, altitude(previous.position))
  const atmosphere = sampleAtmosphere(h)
  const speed = magnitude(previous.velocity)
  const velocityDirection = normalize(previous.velocity)
  const flowAngle = speed > 1e-6 ? Math.atan2(previous.velocity.y, previous.velocity.x) : previous.angle
  const dynamicPressure = 0.5 * atmosphere.density * speed * speed

  let targetDownrange = previous.targetDownrange
  let targetHorizontalVelocity = previous.targetHorizontalVelocity
  if (scenario.targetMotion) {
    const targetError = previous.estimatedImpactDownrange - previous.targetDownrange
    const desiredVelocity = clamp(
      targetError / scenario.targetMotion.responseTime,
      -scenario.targetMotion.maxSpeed,
      scenario.targetMotion.maxSpeed,
    )
    targetHorizontalVelocity = moveToward(
      previous.targetHorizontalVelocity,
      desiredVelocity,
      scenario.targetMotion.maxAcceleration * dt,
    )
    targetDownrange +=
      (previous.targetHorizontalVelocity + targetHorizontalVelocity) * 0.5 * dt
  }

  let throttle = applyThrottleInput(previous.throttle, input.throttleDelta, dt, vehicle.minThrottle)
  const finTarget = clamp(input.pitchCommand, -1, 1) * MAX_FIN_ANGLE
  const finDeflection = moveToward(previous.finDeflection, finTarget, FIN_RATE * dt)
  let legs = input.deployLegs && previous.legs === 'stowed' ? 'deployed' : previous.legs
  if (legs === 'deployed' && dynamicPressure > scenario.legBreakDynamicPressure) legs = 'broken'

  const engineCount = throttle > 0 && previous.mainPropellant > 0 ? (h > 15_000 ? 3 : 1) : 0
  const performance = enginePerformance(atmosphere.pressure, scenario)
  const desiredThrust = engineCount * performance.thrust * throttle
  const desiredMassFlow = desiredThrust / (performance.isp * G0)
  const propellantNeeded = desiredMassFlow * dt
  const burnScale = propellantNeeded > 0 ? Math.min(1, previous.mainPropellant / propellantNeeded) : 0
  const propellantUsed = propellantNeeded * burnScale
  const mainPropellant = Math.max(0, previous.mainPropellant - propellantUsed)
  if (mainPropellant <= 0) throttle = 0

  const mass = vehicle.dryMass + previous.mainPropellant
  const radius = magnitude(previous.position)
  const gravity = scale(previous.position, -EARTH_MU / (radius * radius * radius))
  const gravityForce = scale(gravity, mass)

  const thrustDirection = { x: Math.cos(previous.angle), y: Math.sin(previous.angle) }
  const thrustForce = scale(thrustDirection, desiredThrust * burnScale)

  const aerodynamicOrientationState = aerodynamicOrientation(previous)
  const bodyAoA = wrapAngle(flowAngle - aerodynamicOrientationState.axisAngle)
  const effectiveFinAngle = clamp(bodyAoA + finDeflection, -MAX_FIN_ANGLE, MAX_FIN_ANGLE)
  const normalCoefficient =
    gridFinNormalCoefficient(effectiveFinAngle) * aerodynamicOrientationState.directionSign
  const normalMagnitude = dynamicPressure * vehicle.referenceArea * normalCoefficient
  const normalDirection = { x: -velocityDirection.y, y: velocityDirection.x }
  const normalForce = scale(normalDirection, normalMagnitude)
  const dragMagnitude = dragMagnitudeFor(dynamicPressure, scenario)
  const dragForce = scale(velocityDirection, -dragMagnitude)
  const aerodynamicForce = add(normalForce, dragForce)

  const finPosition = scale(thrustDirection, vehicle.finLeverArm)
  const finTorque = cross(finPosition, normalForce)
  const blend = rcsBlendForQ(dynamicPressure)
  const rcsAvailable = previous.rcsRemaining > 0 ? 1 : 0
  const rcsCommand = clamp(input.pitchCommand, -1, 1) * blend * rcsAvailable
  const rcsTorque = rcsCommand * vehicle.maxRcsTorque
  const rcsUse = (Math.abs(rcsCommand) * dt) / vehicle.rcsFullCommandSeconds
  const rcsRemaining = Math.max(0, previous.rcsRemaining - rcsUse)

  const tailFirst = aerodynamicOrientationState.directionSign === -1
  const staticAngle = clamp(bodyAoA, -25 * Math.PI / 180, 25 * Math.PI / 180)
  const staticTorque = tailFirst
    ? dynamicPressure * vehicle.referenceArea * vehicle.length * vehicle.staticMargin *
      (vehicle.staticNormalSlope * staticAngle -
        vehicle.pitchDampingCoefficient * previous.angularRate)
    : 0

  const totalForce = add(add(gravityForce, thrustForce), aerodynamicForce)
  const acceleration = scale(totalForce, 1 / mass)
  const velocity = add(previous.velocity, scale(acceleration, dt))
  let position = add(previous.position, scale(velocity, dt))

  const inertia = (mass * (vehicle.length * vehicle.length + 3 * (vehicle.diameter / 2) ** 2)) / 12
  const angularAcceleration = (finTorque + rcsTorque + staticTorque) / inertia
  let angularRate = previous.angularRate + angularAcceleration * dt
  let angle = wrapAngle(previous.angle + angularRate * dt)

  let state: VehicleState = {
    time: previous.time + dt,
    position,
    velocity,
    angle,
    angularRate,
    mainPropellant,
    initialMainPropellant: previous.initialMainPropellant,
    throttle,
    engineCount,
    rcsRemaining,
    rcsCommand,
    finDeflection,
    legs,
    targetDownrange,
    targetHorizontalVelocity,
    estimatedImpactDownrange: previous.estimatedImpactDownrange,
  }

  if (scenario.targetMotion) {
    const previousPredictionTick = Math.floor(
      previous.time / scenario.targetMotion.predictionInterval,
    )
    const currentPredictionTick = Math.floor(
      state.time / scenario.targetMotion.predictionInterval,
    )
    if (currentPredictionTick > previousPredictionTick) {
      state.estimatedImpactDownrange = predictPassiveImpactDownrange(state, scenario)
    }
  }

  const telemetry = telemetryFor(state, scenario, normalMagnitude)
  const contactPitch = wrapAngle(angle - Math.atan2(position.y, position.x))
  const contactAltitude =
    (vehicle.length / 2) * Math.abs(Math.cos(contactPitch)) +
    (vehicle.diameter / 2) * Math.abs(Math.sin(contactPitch))
  if (altitude(position) <= contactAltitude) {
    const result = evaluateTouchdown(state, telemetry, scenario)
    const radial = radialUnit(position)
    position = scale(radial, EARTH_RADIUS + contactAltitude)
    angle = result.outcome === 'landed' ? Math.atan2(radial.y, radial.x) : angle
    angularRate = 0
    state = {
      ...state,
      position,
      velocity: { x: 0, y: 0 },
      angle,
      angularRate,
      throttle: 0,
      engineCount: 0,
    }
    return { state, telemetry, result }
  }

  return { state, telemetry }
}

export function gravitationalAcceleration(position: Vec2): Vec2 {
  const radius = magnitude(position)
  return scale(position, -EARTH_MU / (radius * radius * radius))
}

export function surfacePointAt(downrangeMeters: number): Vec2 {
  return positionFromLocal(downrangeMeters, 0)
}

export function localBasis(position: Vec2): { radial: Vec2; east: Vec2 } {
  return { radial: radialUnit(position), east: eastUnit(position) }
}

export const Simulation = { step: stepSimulation } as const
