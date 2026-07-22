import { clamp, lerp, positionFromLocal, velocityFromLocal } from '../sim/math'
import type { CameraMode, ScenarioConfig, Vec2 } from '../sim/types'

export interface SecondStageVisual {
  position: Vec2
  angle: number
  active: boolean
}

export function fixedCameraScale(width: number, height: number): number {
  return Math.max(1_400 / Math.max(width * 0.82, 1), 1_400 / Math.max(height * 0.7, 1))
}

export function cameraScaleFor(
  mode: CameraMode,
  width: number,
  height: number,
  altitude: number,
  distanceToTarget: number,
): number {
  const zoomScale = fixedCameraScale(width, height)
  const baseScale = zoomScale * 4.5
  if (mode === 'zoom') return zoomScale
  if (mode === 'base') return baseScale

  const altitudeBlend = clamp((altitude - 1_500) / 18_500, 0, 1)
  const distanceBlend = clamp((Math.abs(distanceToTarget) - 2_500) / 37_500, 0, 1)
  const wideBlend = Math.max(altitudeBlend, distanceBlend)
  const smoothBlend = wideBlend * wideBlend * (3 - 2 * wideBlend)
  return lerp(zoomScale, baseScale, smoothBlend)
}

export function skyBlendForAltitude(altitude: number): number {
  return clamp(1 - altitude / 60_000, 0, 1)
}

export function reentryIntensity(
  altitude: number,
  mach: number,
  dynamicPressure: number,
  verticalVelocity: number,
): number {
  const descending = clamp((-verticalVelocity - 60) / 500, 0, 1)
  const compressibility = clamp((mach - 1.2) / 3.8, 0, 1)
  const aerodynamicLoad = clamp(dynamicPressure / 45_000, 0, 1)
  const atmosphereWindow = clamp((80_000 - altitude) / 45_000, 0, 1)
  return descending * compressibility * Math.sqrt(aerodynamicLoad) * atmosphereWindow
}

export function secondStageVisual(scenario: ScenarioConfig, elapsedTime: number): SecondStageVisual {
  const time = Math.max(0, elapsedTime)
  const initialSpeed = Math.hypot(
    scenario.initialHorizontalVelocity,
    scenario.initialVerticalVelocity,
  )
  const separationDistance = 48
  const horizontalVelocity = scenario.initialHorizontalVelocity + 80
  const verticalVelocity = scenario.initialVerticalVelocity + 50
  const horizontalAcceleration = 4
  const verticalAcceleration = 6
  const initialDownrange = scenario.initialDownrange +
    separationDistance * scenario.initialHorizontalVelocity / initialSpeed
  const initialAltitude = scenario.initialAltitude +
    separationDistance * scenario.initialVerticalVelocity / initialSpeed
  const downrange = initialDownrange + horizontalVelocity * time +
    0.5 * horizontalAcceleration * time * time
  const altitude = initialAltitude + verticalVelocity * time +
    0.5 * verticalAcceleration * time * time
  const position = positionFromLocal(downrange, altitude)
  const velocity = velocityFromLocal(
    position,
    horizontalVelocity + horizontalAcceleration * time,
    verticalVelocity + verticalAcceleration * time,
  )
  return {
    position,
    angle: Math.atan2(velocity.y, velocity.x),
    active: time <= 45,
  }
}
