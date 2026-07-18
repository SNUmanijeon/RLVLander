interface TouchControlsProps {
  onPitch: (value: -1 | 0 | 1) => void
  onThrottle: (value: -1 | 0 | 1) => void
  onDeployLegs: () => void
}

interface HoldButtonProps {
  label: string
  ariaLabel: string
  onPress: () => void
  onRelease: () => void
}

function HoldButton({ label, ariaLabel, onPress, onRelease }: HoldButtonProps) {
  return (
    <button
      className="touch-button"
      aria-label={ariaLabel}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        onPress()
      }}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
    >
      {label}
    </button>
  )
}

export function TouchControls({ onPitch, onThrottle, onDeployLegs }: TouchControlsProps) {
  return (
    <div className="touch-controls" aria-label="Touch flight controls">
      <div className="touch-cluster pitch-cluster">
        <HoldButton label="←" ariaLabel="Pitch left" onPress={() => onPitch(1)} onRelease={() => onPitch(0)} />
        <HoldButton label="→" ariaLabel="Pitch right" onPress={() => onPitch(-1)} onRelease={() => onPitch(0)} />
      </div>
      <button className="touch-button legs-button" onClick={onDeployLegs} aria-label="Deploy landing legs">LEGS</button>
      <div className="touch-cluster throttle-cluster">
        <HoldButton label="THR +" ariaLabel="Increase throttle" onPress={() => onThrottle(1)} onRelease={() => onThrottle(0)} />
        <HoldButton label="THR −" ariaLabel="Decrease throttle" onPress={() => onThrottle(-1)} onRelease={() => onThrottle(0)} />
      </div>
    </div>
  )
}

