import { pitchDegrees } from '../game/render'
import type { ScenarioConfig, Telemetry } from '../sim/types'

interface TelemetryPanelProps {
  telemetry: Telemetry
  scenario: ScenarioConfig
  timeScale: 1 | 2
  onToggleTimeScale: () => void
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
  onToggleTimeScale,
}: TelemetryPanelProps) {
  const values = [
    ['MET', `${number(telemetry.elapsedTime, 1)} s`],
    ['ALT', `${number(telemetry.altitude / 1000, 2)} km`],
    ['DOWNRANGE', `${number(telemetry.downrange / 1000, 1)} km`],
    ['TARGET Δ', `${number(telemetry.distanceToTarget / 1000, 2)} km`],
    ['V-HORIZ', `${velocity(telemetry.horizontalVelocity)} m/s`],
    ['V-VERT', `${velocity(telemetry.verticalVelocity)} m/s`],
    ['SPEED', `${number(telemetry.speed, 0)} m/s`],
    ['MACH', number(telemetry.mach, 2)],
    ['DYN PRESS', `${number(telemetry.dynamicPressure / 1000, 2)} kPa`],
    ['AERO DECEL', `${number(telemetry.aerodynamicDeceleration, 2)} m/s²`],
    ['PITCH', `${velocity(pitchDegrees(telemetry))}°`],
    ['ROT RATE', `${velocity((telemetry.angularRate * 180) / Math.PI)} °/s`],
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
        <button className="time-scale" onClick={onToggleTimeScale} aria-label="Change simulation speed">
          {timeScale}×
        </button>
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
