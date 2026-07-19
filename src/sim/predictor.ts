import { sampleAtmosphere } from './atmosphere'
import { EARTH_MU, EARTH_RADIUS, FIN_AXIAL_COEFFICIENT } from './constants'
import { add, altitude, downrange, magnitude, normalize, scale } from './math'
import type { ScenarioConfig, Vec2, VehicleState } from './types'

function gravitationalAcceleration(position: Vec2): Vec2 {
  const radius = magnitude(position)
  return scale(position, -EARTH_MU / (radius * radius * radius))
}

export function predictGravityOnly(state: VehicleState, horizonSeconds = 600, stepSeconds = 1): Vec2[] {
  let position = { ...state.position }
  let velocity = { ...state.velocity }
  const points: Vec2[] = [{ ...position }]
  const count = Math.ceil(horizonSeconds / stepSeconds)

  for (let index = 0; index < count; index += 1) {
    velocity = add(velocity, scale(gravitationalAcceleration(position), stepSeconds))
    position = add(position, scale(velocity, stepSeconds))
    points.push({ ...position })
    if (magnitude(position) <= EARTH_RADIUS) break
  }

  return points
}

export function predictPassiveImpactDownrange(
  state: VehicleState,
  scenario: ScenarioConfig,
  horizonSeconds = 600,
  stepSeconds = 0.5,
): number {
  let position = { ...state.position }
  let velocity = { ...state.velocity }
  const mass = scenario.vehicle.dryMass + state.mainPropellant
  const dragCoefficient = scenario.vehicle.bodyCd + FIN_AXIAL_COEFFICIENT
  const count = Math.ceil(horizonSeconds / stepSeconds)

  for (let index = 0; index < count; index += 1) {
    const h = Math.max(0, altitude(position))
    const atmosphere = sampleAtmosphere(h)
    const speed = magnitude(velocity)
    const dynamicPressure = 0.5 * atmosphere.density * speed * speed
    const dragMagnitude = dynamicPressure * scenario.vehicle.referenceArea * dragCoefficient
    const dragAcceleration = scale(normalize(velocity), -dragMagnitude / mass)
    const acceleration = add(gravitationalAcceleration(position), dragAcceleration)
    velocity = add(velocity, scale(acceleration, stepSeconds))
    position = add(position, scale(velocity, stepSeconds))
    if (magnitude(position) <= EARTH_RADIUS) return downrange(position)
  }

  return downrange(position)
}
