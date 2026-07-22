import { DEG, LANDING_LIMITS, LEG_BREAK_Q, VEHICLE } from './constants'
import type { AssistMode, ScenarioConfig, ScenarioId, ScoreKey } from './types'

export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  asds: {
    id: 'asds',
    name: 'Drone Ship Recovery',
    shortName: 'ASDS',
    difficulty: 'Guided',
    description: 'Brake the overshooting downrange arc while the ship chases your estimated coast impact, then settle onto its 90 m deck.',
    objective: 'The ship can reposition, but its speed and acceleration are limited. Shape the trajectory so it can keep up.',
    initialAltitude: 70_000,
    initialDownrange: 100_000,
    initialHorizontalVelocity: 1_500,
    initialVerticalVelocity: 500,
    initialMainPropellant: 65_000,
    targetDownrange: 370_000,
    targetWidth: 90,
    targetKind: 'ship',
    targetMotion: {
      maxSpeed: 10,
      maxAcceleration: 0.25,
      responseTime: 18,
      predictionInterval: 0.5,
    },
    assistMode: 'standard',
    landingLimits: LANDING_LIMITS,
    legBreakDynamicPressure: LEG_BREAK_Q,
    vehicle: VEHICLE,
    calibrationNote: 'The initial coast estimate overshoots the ship; drag, retroburn, and limited ship repositioning close the gap.',
  },
  rtls: {
    id: 'rtls',
    name: 'Return to Launch Site',
    shortName: 'RTLS',
    difficulty: 'Expert',
    description: 'Flip with finite RCS, cancel downrange velocity, and fly the booster back to the pad.',
    objective: 'The launch site is behind you. Every second of boost-back costs landing reserve.',
    initialAltitude: 70_000,
    initialDownrange: 20_000,
    initialHorizontalVelocity: 1_550,
    initialVerticalVelocity: 500,
    initialMainPropellant: 165_000,
    targetDownrange: 0,
    targetWidth: 80,
    targetKind: 'pad',
    assistMode: 'standard',
    landingLimits: LANDING_LIMITS,
    legBreakDynamicPressure: LEG_BREAK_Q,
    vehicle: VEHICLE,
    calibrationNote: 'Gameplay-tuned as the higher-Mach, higher-dynamic-pressure mission.',
  },
}

export function scoreKey(id: ScenarioId, mode: AssistMode): ScoreKey {
  return `${id}:${mode}`
}

export function scenarioForMode(id: ScenarioId, mode: AssistMode): ScenarioConfig {
  const standard = SCENARIOS[id]
  if (mode === 'standard') return standard

  return {
    ...standard,
    assistMode: 'assisted',
    description: id === 'asds'
      ? 'Use the lower-throttle engine and expanded reserves to shape the overshooting arc while the faster ship follows your coast estimate.'
      : 'Practice the flip and boost-back with expanded reserves, stronger RCS, lower minimum throttle, and a wider landing zone.',
    objective: id === 'asds'
      ? 'Assisted profile: more control authority, a wider deck corridor, and a more responsive recovery ship.'
      : 'Assisted profile: extra propellant, stronger attitude control, and more forgiving touchdown limits.',
    initialMainPropellant: id === 'asds' ? 90_000 : 175_000,
    targetWidth: standard.targetWidth * 2,
    targetMotion: standard.targetMotion
      ? {
          ...standard.targetMotion,
          maxSpeed: 14,
          maxAcceleration: 0.4,
          responseTime: 14,
        }
      : undefined,
    landingLimits: {
      horizontalSpeed: 5,
      descentSpeed: 6,
      pitch: 10 * DEG,
      angularRate: 10 * DEG,
    },
    legBreakDynamicPressure: 10_000,
    vehicle: {
      ...standard.vehicle,
      minThrottle: 0.28,
      maxRcsTorque: 850_000,
      rcsFullCommandSeconds: 100,
    },
    calibrationNote: `${standard.calibrationNote} Assisted profile adds wider margins and reserves.`,
  }
}
