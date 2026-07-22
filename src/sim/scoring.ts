import { clamp } from './math'
import type { FailureReason, MissionResult, ScenarioConfig, Telemetry, VehicleState } from './types'

export function evaluateTouchdown(
  state: VehicleState,
  telemetry: Telemetry,
  scenario: ScenarioConfig,
): MissionResult {
  const horizontalError = Math.abs(telemetry.distanceToTarget)
  const horizontalSpeed = Math.abs(telemetry.relativeHorizontalVelocity)
  const descentSpeed = Math.max(0, -telemetry.verticalVelocity)
  const pitchError = Math.abs(telemetry.pitch)
  const angularRate = Math.abs(telemetry.angularRate)
  const limits = scenario.landingLimits

  let reason: FailureReason = 'none'
  if (pitchError > Math.PI / 4) reason = 'structural_impact'
  else if (state.legs === 'stowed') reason = 'legs_stowed'
  else if (state.legs === 'broken') reason = 'legs_broken'
  else if (horizontalError > scenario.targetWidth / 2) reason = 'off_target'
  else if (descentSpeed > limits.descentSpeed) reason = 'excessive_descent_speed'
  else if (horizontalSpeed > limits.horizontalSpeed) reason = 'excessive_lateral_speed'
  else if (pitchError > limits.pitch) reason = 'excessive_tilt'
  else if (angularRate > limits.angularRate) reason = 'excessive_rotation'

  const landed = reason === 'none'
  const accuracy = clamp(1 - horizontalError / (scenario.targetWidth / 2), 0, 1)
  const verticalQuality = clamp(1 - descentSpeed / limits.descentSpeed, 0, 1)
  const lateralQuality = clamp(1 - horizontalSpeed / limits.horizontalSpeed, 0, 1)
  const attitudeQuality = clamp(1 - pitchError / limits.pitch, 0, 1)
  const score = landed
    ? Math.round(
        350 * accuracy +
          170 * verticalQuality +
          130 * lateralQuality +
          100 * attitudeQuality +
          150 * telemetry.mainFuelRatio +
          100 * telemetry.rcsRatio,
      )
    : 0

  return {
    outcome: landed ? 'landed' : 'crashed',
    reason,
    score,
    horizontalError,
    horizontalSpeed,
    descentSpeed,
    pitchError,
    angularRate,
    mainFuelRatio: telemetry.mainFuelRatio,
    rcsRatio: telemetry.rcsRatio,
  }
}
