import type { ControlInput } from '../sim/types'

export type FlightControlAction =
  | { kind: 'throttle'; value: -1 | 0 | 1 }
  | { kind: 'pitch'; value: -1 | 0 | 1 }
  | { kind: 'deploy-legs' }

export function keyboardAction(
  code: string,
  pressed: boolean,
  repeat = false,
): FlightControlAction | null {
  if (code === 'ArrowUp') return { kind: 'throttle', value: pressed ? 1 : 0 }
  if (code === 'ArrowDown') return { kind: 'throttle', value: pressed ? -1 : 0 }
  if (code === 'ArrowLeft') return { kind: 'pitch', value: pressed ? 1 : 0 }
  if (code === 'ArrowRight') return { kind: 'pitch', value: pressed ? -1 : 0 }
  if (code === 'Space' && pressed && !repeat) return { kind: 'deploy-legs' }
  return null
}

export function applyFlightControl(input: ControlInput, action: FlightControlAction): void {
  if (action.kind === 'throttle') input.throttleDelta = action.value
  if (action.kind === 'pitch') input.pitchCommand = action.value
  if (action.kind === 'deploy-legs') input.deployLegs = true
}
