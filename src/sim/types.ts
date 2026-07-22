export interface Vec2 {
  x: number
  y: number
}

export type ScenarioId = 'asds' | 'rtls'
export type AssistMode = 'assisted' | 'standard'
export type CameraMode = 'base' | 'zoom' | 'auto'
export type TimeScale = 1 | 2 | 5 | 10 | 20
export type ScoreKey = `${ScenarioId}:${AssistMode}`
export type LegState = 'stowed' | 'deployed' | 'broken'
export type MissionPhase = 'briefing' | 'active' | 'paused' | 'landed' | 'crashed'

export interface LandingLimits {
  horizontalSpeed: number
  descentSpeed: number
  pitch: number
  angularRate: number
}

export interface VehicleConfig {
  length: number
  diameter: number
  referenceArea: number
  dryMass: number
  bodyCd: number
  thrustSeaLevel: number
  thrustVacuum: number
  ispSeaLevel: number
  ispVacuum: number
  minThrottle: number
  finLeverArm: number
  maxRcsTorque: number
  rcsFullCommandSeconds: number
  staticMargin: number
  staticNormalSlope: number
  pitchDampingCoefficient: number
}

export interface TargetMotionConfig {
  maxSpeed: number
  maxAcceleration: number
  responseTime: number
  predictionInterval: number
}

export interface ScenarioConfig {
  id: ScenarioId
  name: string
  shortName: string
  difficulty: 'Guided' | 'Expert'
  description: string
  objective: string
  initialAltitude: number
  initialDownrange: number
  initialHorizontalVelocity: number
  initialVerticalVelocity: number
  initialMainPropellant: number
  targetDownrange: number
  targetWidth: number
  targetKind: 'ship' | 'pad'
  targetMotion?: TargetMotionConfig
  assistMode: AssistMode
  landingLimits: LandingLimits
  legBreakDynamicPressure: number
  vehicle: VehicleConfig
  calibrationNote: string
}

export interface VehicleState {
  time: number
  position: Vec2
  velocity: Vec2
  angle: number
  angularRate: number
  mainPropellant: number
  initialMainPropellant: number
  throttle: number
  engineCount: number
  rcsRemaining: number
  rcsCommand: number
  finDeflection: number
  legs: LegState
  targetDownrange: number
  targetHorizontalVelocity: number
  estimatedImpactDownrange: number
}

export interface ControlInput {
  throttleDelta: -1 | 0 | 1
  pitchCommand: number
  deployLegs: boolean
  pause?: boolean
  retry?: boolean
  timeScale?: TimeScale
}

export type FailureReason =
  | 'none'
  | 'off_target'
  | 'excessive_descent_speed'
  | 'excessive_lateral_speed'
  | 'excessive_tilt'
  | 'excessive_rotation'
  | 'legs_stowed'
  | 'legs_broken'
  | 'structural_impact'

export interface MissionResult {
  outcome: 'landed' | 'crashed'
  reason: FailureReason
  score: number
  horizontalError: number
  horizontalSpeed: number
  descentSpeed: number
  pitchError: number
  angularRate: number
  mainFuelRatio: number
  rcsRatio: number
}

export interface Telemetry {
  elapsedTime: number
  altitude: number
  downrange: number
  horizontalVelocity: number
  verticalVelocity: number
  speed: number
  mach: number
  dynamicPressure: number
  aerodynamicDeceleration: number
  density: number
  pressure: number
  mainFuelRatio: number
  rcsRatio: number
  finForceRatio: number
  rcsBlend: number
  distanceToTarget: number
  targetDownrange: number
  targetHorizontalVelocity: number
  relativeHorizontalVelocity: number
  estimatedImpactDownrange: number
  estimatedImpactError: number
  pitch: number
  angularRate: number
  throttle: number
  engineCount: number
  legs: LegState
}

export interface SimulationStep {
  state: VehicleState
  telemetry: Telemetry
  result?: MissionResult
}
