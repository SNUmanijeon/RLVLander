import { pitchDegrees } from '../game/render'
import type { CameraMode, ScenarioConfig, Telemetry, TimeScale } from '../sim/types'

interface TelemetryPanelProps {
  telemetry: Telemetry
  scenario: ScenarioConfig
  timeScale: TimeScale
  cameraMode: CameraMode
  onCycleTimeScale: () => void
  onSetCameraMode: (mode: CameraMode) => void
}

function number(value: number, digits = 0): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function velocity(value: number): string {
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${Math.abs(value).toFixed(1)}`
}

export function TelemetryPanel({
  telemetry,
  scenario,
  timeScale,
  cameraMode,
  onCycleTimeScale,
  onSetCameraMode,
}: TelemetryPanelProps) {
  const pitchRate = (telemetry.angularRate * 180) / Math.PI
  const values = [
    ['MET', `${number(telemetry.elapsedTime, 1)} s`],
    ['ALT', `${number(telemetry.altitude / 1000, 2)} km`],
    ['DOWNRANGE', `${number(telemetry.downrange / 1000, 1)} km`],
    ['TARGET Δ', `${number(telemetry.distanceToTarget / 1000, 2)} km`],
    ['SPEED', `${number(telemetry.speed, 0)} m/s`],
    ['MACH', number(telemetry.mach, 2)],
    ['DYN PRESS', `${number(telemetry.dynamicPressure / 1000, 2)} kPa`],
    ['AERO DECEL', `${number(telemetry.aerodynamicDeceleration, 2)} m/s²`],
    ['PITCH', `${velocity(pitchDegrees(telemetry))}°`],
    ['ENGINES', telemetry.engineCount.toString()],
    ['LEGS', telemetry.legs.toUpperCase()],
  ]

  if (scenario.targetKind === 'ship') {
    values.splice(
      4,
      0,
      ['SHIP V', `${velocity(telemetry.targetHorizontalVelocity)} m/s`],
      ['COAST Δ', `${number(telemetry.estimatedImpactError / 1000, 2)} km`],
    )
  }

  return (
    <aside className="telemetry-panel" aria-label="Flight telemetry">
      <div className="telemetry-heading">
        <div>
          <span>LIVE TELEMETRY</span>
          <strong>{scenario.shortName}</strong>
        </div>
        <button
          className="time-scale"
          onClick={onCycleTimeScale}
          aria-label={`Simulation speed ${timeScale} times. Select next speed.`}
        >
          {timeScale}×
        </button>
      </div>
      <div className="flight-vitals" aria-label="Primary flight rates">
        <div className="vital pitch-rate">
          <span>PITCH RATE</span>
          <strong>{velocity(pitchRate)}<small>°/s</small></strong>
        </div>
        <div className="vital horizontal-rate">
          <span>HORIZONTAL</span>
          <strong>{velocity(telemetry.horizontalVelocity)}<small>m/s</small></strong>
        </div>
        <div className="vital vertical-rate">
          <span>VERTICAL</span>
          <strong>{velocity(telemetry.verticalVelocity)}<small>m/s</small></strong>
        </div>
      </div>
      <div className="camera-selector" role="group" aria-label="Camera zoom mode">
        {(['base', 'zoom', 'auto'] as const).map((mode) => (
          <button
            type="button"
            key={mode}
            className={cameraMode === mode ? 'selected' : ''}
            aria-pressed={cameraMode === mode}
            onClick={() => onSetCameraMode(mode)}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="telemetry-grid">
        {values.map(([label, value]) => (
          <div className="telemetry-row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="resource">
        <div className="resource-label"><span>MAIN PROPELLANT</span><strong>{Math.round(telemetry.mainFuelRatio * 100)}%</strong></div>
        <div className="resource-track"><i style={{ width: `${telemetry.mainFuelRatio * 100}%` }} /></div>
      </div>
      <div className="resource rcs-resource">
        <div className="resource-label"><span>RCS GAS</span><strong>{Math.round(telemetry.rcsRatio * 100)}%</strong></div>
        <div className="resource-track"><i style={{ width: `${telemetry.rcsRatio * 100}%` }} /></div>
      </div>
      <div className="control-source">
        <span>ATTITUDE SOURCE</span>
        <strong>{telemetry.rcsBlend > 0.66 ? 'RCS' : telemetry.rcsBlend > 0.1 ? 'BLENDED' : 'GRID FINS'}</strong>
      </div>
    </aside>
  )
}
