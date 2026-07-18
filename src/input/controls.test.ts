import { describe, expect, it } from 'vitest'
import { applyFlightControl, keyboardAction, type FlightControlAction } from './controls'
import type { ControlInput } from '../sim/types'

function inputAfter(action: FlightControlAction): ControlInput {
  const input: ControlInput = { throttleDelta: 0, pitchCommand: 0, deployLegs: false }
  applyFlightControl(input, action)
  return input
}

describe('flight control bindings', () => {
  it.each([
    ['ArrowUp', { kind: 'throttle', value: 1 }],
    ['ArrowDown', { kind: 'throttle', value: -1 }],
    ['ArrowLeft', { kind: 'pitch', value: 1 }],
    ['ArrowRight', { kind: 'pitch', value: -1 }],
  ] as const)('maps %s to the same action used by touch controls', (code, touchAction) => {
    const keyAction = keyboardAction(code, true)
    expect(keyAction).toEqual(touchAction)
    expect(inputAfter(keyAction as FlightControlAction)).toEqual(inputAfter(touchAction))
  })

  it('makes leg deployment a one-shot press and ignores key repeat', () => {
    expect(keyboardAction('Space', true, false)).toEqual({ kind: 'deploy-legs' })
    expect(keyboardAction('Space', true, true)).toBeNull()
    expect(keyboardAction('Space', false)).toBeNull()
  })
})
