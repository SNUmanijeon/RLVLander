import { EARTH_RADIUS } from './constants'
import type { Vec2 } from './types'

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const scale = (v: Vec2, amount: number): Vec2 => ({ x: v.x * amount, y: v.y * amount })
export const magnitude = (v: Vec2): number => Math.hypot(v.x, v.y)
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x

export function normalize(v: Vec2): Vec2 {
  const length = magnitude(v)
  return length > 1e-9 ? scale(v, 1 / length) : { x: 0, y: 0 }
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function wrapAngle(angle: number): number {
  let wrapped = angle
  while (wrapped > Math.PI) wrapped -= Math.PI * 2
  while (wrapped < -Math.PI) wrapped += Math.PI * 2
  return wrapped
}

export function radialUnit(position: Vec2): Vec2 {
  return normalize(position)
}

export function eastUnit(position: Vec2): Vec2 {
  const radial = radialUnit(position)
  return { x: radial.y, y: -radial.x }
}

export function altitude(position: Vec2): number {
  return magnitude(position) - EARTH_RADIUS
}

export function downrange(position: Vec2): number {
  return Math.atan2(position.x, position.y) * EARTH_RADIUS
}

export function localVelocity(position: Vec2, velocity: Vec2): Vec2 {
  return {
    x: dot(velocity, eastUnit(position)),
    y: dot(velocity, radialUnit(position)),
  }
}

export function positionFromLocal(downrangeMeters: number, altitudeMeters: number): Vec2 {
  const theta = downrangeMeters / EARTH_RADIUS
  const radius = EARTH_RADIUS + altitudeMeters
  return {
    x: Math.sin(theta) * radius,
    y: Math.cos(theta) * radius,
  }
}

export function velocityFromLocal(position: Vec2, horizontal: number, vertical: number): Vec2 {
  return add(scale(eastUnit(position), horizontal), scale(radialUnit(position), vertical))
}

