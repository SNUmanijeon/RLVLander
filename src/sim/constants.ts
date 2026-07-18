import type { VehicleConfig } from './types'

export const EARTH_RADIUS = 6_371_000
export const EARTH_MU = 3.986_004_418e14
export const G0 = 9.80665
export const SEA_LEVEL_PRESSURE = 101_325
export const FIXED_STEP = 1 / 120

export const DEG = Math.PI / 180
export const RAD = 180 / Math.PI

export const MAX_FIN_ANGLE = 20 * DEG
export const FIN_RATE = 60 * DEG
export const FIN_NORMAL_REFERENCE = 0.15
export const FIN_AXIAL_COEFFICIENT = 0.05
export const FIN_FORCE_REFERENCE_Q = 80_000
export const LEG_BREAK_Q = 5_000
export const RCS_FULL_Q = 5_000
export const RCS_ZERO_Q = 20_000

export const LANDING_LIMITS = {
  horizontalSpeed: 2.5,
  descentSpeed: 3,
  pitch: 5 * DEG,
  angularRate: 5 * DEG,
}

export const VEHICLE: VehicleConfig = {
  length: 41.2,
  diameter: 3.66,
  referenceArea: 10.52,
  dryMass: 25_600,
  bodyCd: 0.5,
  thrustSeaLevel: 854_000,
  thrustVacuum: 914_000,
  ispSeaLevel: 282,
  ispVacuum: 311,
  minThrottle: 0.4,
  finLeverArm: 14.5,
  maxRcsTorque: 650_000,
  rcsFullCommandSeconds: 60,
  staticMargin: 0.12,
  staticNormalSlope: 0.8,
  pitchDampingCoefficient: 0.55,
}
