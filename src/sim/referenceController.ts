import { clamp, eastUnit, wrapAngle } from './math'
import type { ControlInput, ScenarioConfig, Telemetry, VehicleState } from './types'

function desiredVerticalSpeed(altitude: number): number {
  if (altitude > 60_000) return -150
  if (altitude > 30_000) return -300
  if (altitude > 15_000) return -180
  if (altitude > 5_000) return -100
  if (altitude > 2_000) return -60
  if (altitude > 500) return -25
  if (altitude > 120) return -6
  return -2.2
}

// Deterministic reference guidance used to prove that both configurations are
// controllable. It is deliberately not exposed in the game UI.
export function referenceController(
  state: VehicleState,
  telemetry: Telemetry,
  scenario: ScenarioConfig,
): ControlInput {
  const altitude = telemetry.altitude
  const guidanceBias = scenario.id === 'asds'
    ? scenario.assistMode === 'assisted' ? -200 : -1_075
    : scenario.assistMode === 'assisted' ? -1_700 : 30
  const targetError = -telemetry.distanceToTarget + guidanceBias
  const ballisticTime = clamp(
    Math.sqrt((2 * Math.max(altitude, 1)) / 9.81) + Math.max(0, telemetry.verticalVelocity) / 9.81,
    18,
    260,
  )
  let horizontalLimit = altitude > 30_000 ? 1_700 : altitude > 10_000 ? 450 : altitude > 2_000 ? 140 : altitude > 500 ? 35 : 2
  if (scenario.id === 'rtls') {
    horizontalLimit = altitude > 10_000 ? 2_600 : altitude > 2_000 ? 800 : altitude > 500 ? 150 : 2
  }
  const guidanceTime = scenario.id === 'rtls'
    ? ballisticTime * (altitude < 50_000 ? 1.15 : 0.72)
    : ballisticTime
  const desiredHorizontalSpeed = telemetry.targetHorizontalVelocity +
    clamp(targetError / guidanceTime, -horizontalLimit, horizontalLimit)
  const desiredVertical = desiredVerticalSpeed(altitude)
  const terminalGain = scenario.id === 'rtls' ? 1.2 : 0.35
  const gain = altitude > 20_000 ? 0.035 : altitude > 5_000 ? 0.055 : altitude > 1_000 ? 0.12 : altitude > 500 ? 0.22 : terminalGain

  let horizontalAcceleration = clamp(
    (desiredHorizontalSpeed - telemetry.horizontalVelocity) * gain,
    -28,
    28,
  )
  if (
    altitude < 500 &&
    Math.abs(telemetry.distanceToTarget) < scenario.targetWidth / 2 &&
    Math.abs(telemetry.relativeHorizontalVelocity) < 5
  ) {
    horizontalAcceleration =
      (telemetry.targetHorizontalVelocity - telemetry.horizontalVelocity) * 0.25
  }
  const netVerticalAcceleration = clamp((desiredVertical - telemetry.verticalVelocity) * gain, -18, 18)
  const gravityCompensation = 9.81 * (6_371_000 / (6_371_000 + altitude)) ** 2
  const thrustVerticalAcceleration = netVerticalAcceleration + gravityCompensation
  const requestedAcceleration = Math.hypot(horizontalAcceleration, thrustVerticalAcceleration)

  const east = eastUnit(state.position)
  const eastAngle = Math.atan2(east.y, east.x)
  const desiredLocalAngle = Math.atan2(thrustVerticalAcceleration, horizontalAcceleration)
  let desiredWorldAngle = wrapAngle(eastAngle + desiredLocalAngle)
  if (altitude < 80) {
    const uprightAngle = wrapAngle(eastAngle + Math.PI / 2)
    const uprightBlend = clamp((80 - altitude) / 60, 0, 1)
    desiredWorldAngle = wrapAngle(
      desiredWorldAngle + wrapAngle(uprightAngle - desiredWorldAngle) * uprightBlend,
    )
  }
  const angleError = wrapAngle(desiredWorldAngle - state.angle)
  const pitchCommand = clamp(angleError * 1.35 - state.angularRate * 6, -1, 1)

  const engineCount = altitude > 15_000 ? 3 : 1
  const totalMass = scenario.vehicle.dryMass + state.mainPropellant
  const maximumAcceleration = (scenario.vehicle.thrustVacuum * engineCount) / totalMass
  const minimumAcceleration = maximumAcceleration * scenario.vehicle.minThrottle
  const ignitionThreshold = altitude < 5_000 ? minimumAcceleration * 0.15 : minimumAcceleration * 0.65
  let targetThrottle = requestedAcceleration < ignitionThreshold
    ? 0
    : clamp(requestedAcceleration / Math.max(maximumAcceleration, 0.1), scenario.vehicle.minThrottle, 1)
  if (altitude < 15_000) {
    const descentSpeed = Math.max(0, -telemetry.verticalVelocity)
    const maximumNetDeceleration = Math.max(1, maximumAcceleration - gravityCompensation)
    const stoppingDistance = (descentSpeed * descentSpeed) / (2 * maximumNetDeceleration)
    const burnGate = stoppingDistance * (scenario.id === 'rtls' ? 4.5 : 2) + 35
    if (altitude > burnGate || (descentSpeed < 5 && altitude > 80)) targetThrottle = 0
    else if (descentSpeed > 12) targetThrottle = Math.max(targetThrottle, 0.72)
    if (telemetry.verticalVelocity > -1.8 && altitude > 5) targetThrottle = 0
  }
  const alignmentLimit = (altitude < 50_000 ? 55 : 15) * (Math.PI / 180)
  const aligned = Math.abs(angleError) < alignmentLimit
  const commandedThrottle = aligned ? targetThrottle : 0
  const throttleDelta: -1 | 0 | 1 =
    commandedThrottle > state.throttle + 0.012 ? 1 : commandedThrottle < state.throttle - 0.012 ? -1 : 0

  return {
    throttleDelta,
    pitchCommand,
    deployLegs:
      altitude < 350 &&
      telemetry.dynamicPressure < scenario.legBreakDynamicPressure &&
      state.legs === 'stowed',
  }
}
