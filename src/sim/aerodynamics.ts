import {
  FIN_AXIAL_COEFFICIENT,
  FIN_FORCE_REFERENCE_Q,
  FIN_NORMAL_REFERENCE,
  MAX_FIN_ANGLE,
} from './constants'
import { clamp } from './math'

const TEN_DEGREES = (10 * Math.PI) / 180

export function gridFinNormalCoefficient(effectiveAngle: number): number {
  const sign = Math.sign(effectiveAngle)
  const angle = Math.min(Math.abs(effectiveAngle), MAX_FIN_ANGLE)
  if (angle <= TEN_DEGREES) return sign * (angle / TEN_DEGREES) * 0.08
  const t = (angle - TEN_DEGREES) / TEN_DEGREES
  return sign * (0.08 + t * (0.15 - 0.08))
}

export function gridFinAxialCoefficient(): number {
  return FIN_AXIAL_COEFFICIENT
}

export function finForceRatio(normalForce: number, referenceArea: number): number {
  const maximum = FIN_FORCE_REFERENCE_Q * referenceArea * FIN_NORMAL_REFERENCE
  return clamp(Math.abs(normalForce) / maximum, 0, 1)
}

