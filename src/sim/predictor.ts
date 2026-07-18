import { EARTH_RADIUS } from './constants'
import { add, magnitude, scale } from './math'
import { gravitationalAcceleration } from './simulation'
import type { Vec2, VehicleState } from './types'

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

