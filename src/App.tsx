import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TelemetryPanel } from './components/TelemetryPanel'
import { TouchControls } from './components/TouchControls'
import { drawGame } from './game/render'
import { applyFlightControl, keyboardAction } from './input/controls'
import { FIXED_STEP, TIME_SCALES } from './sim/constants'
import { clamp, wrapAngle } from './sim/math'
import { predictGravityOnly } from './sim/predictor'
import { SCENARIOS, scenarioForMode, scoreKey } from './sim/scenarios'
import { createInitialState, stepSimulation, telemetryFor } from './sim/simulation'
import {
  loadGameData,
  saveAssistMode,
  saveBestScore,
  saveCameraMode,
  saveTimeScale,
} from './sim/storage'
import type {
  AssistMode,
  CameraMode,
  ControlInput,
  MissionPhase,
  MissionResult,
  ScenarioConfig,
  ScenarioId,
  ScoreKey,
  Telemetry,
  TimeScale,
  Vec2,
  VehicleState,
} from './sim/types'

const FAILURE_COPY: Record<string, string> = {
  off_target: 'Touchdown occurred outside the marked landing zone.',
  excessive_descent_speed: 'Vertical speed exceeded the landing gear limit.',
  excessive_lateral_speed: 'Too much horizontal velocity remained at contact.',
  excessive_tilt: 'The booster was not upright at touchdown.',
  excessive_rotation: 'Angular rate was too high for a stable landing.',
  legs_stowed: 'The landing legs were still stowed.',
  legs_broken: 'The legs were damaged by dynamic pressure before touchdown.',
  structural_impact: 'The vehicle struck the surface outside its landing attitude envelope.',
}

const NEUTRAL_INPUT: ControlInput = { throttleDelta: 0, pitchCommand: 0, deployLegs: false }

function interpolateState(previous: VehicleState, current: VehicleState, alpha: number): VehicleState {
  const t = clamp(alpha, 0, 1)
  const mix = (from: number, to: number) => from + (to - from) * t
  return {
    ...current,
    time: mix(previous.time, current.time),
    position: {
      x: mix(previous.position.x, current.position.x),
      y: mix(previous.position.y, current.position.y),
    },
    velocity: {
      x: mix(previous.velocity.x, current.velocity.x),
      y: mix(previous.velocity.y, current.velocity.y),
    },
    angle: wrapAngle(previous.angle + wrapAngle(current.angle - previous.angle) * t),
    angularRate: mix(previous.angularRate, current.angularRate),
    mainPropellant: mix(previous.mainPropellant, current.mainPropellant),
    throttle: mix(previous.throttle, current.throttle),
    rcsRemaining: mix(previous.rcsRemaining, current.rcsRemaining),
    rcsCommand: mix(previous.rcsCommand, current.rcsCommand),
    finDeflection: mix(previous.finDeflection, current.finDeflection),
    targetDownrange: mix(previous.targetDownrange, current.targetDownrange),
    targetHorizontalVelocity: mix(
      previous.targetHorizontalVelocity,
      current.targetHorizontalVelocity,
    ),
    estimatedImpactDownrange: mix(
      previous.estimatedImpactDownrange,
      current.estimatedImpactDownrange,
    ),
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function MissionBriefing({
  selected,
  scenario,
  assistMode,
  bestScores,
  onSelect,
  onAssistMode,
  onStart,
}: {
  selected: ScenarioId
  scenario: ScenarioConfig
  assistMode: AssistMode
  bestScores: Partial<Record<ScoreKey, number>>
  onSelect: (scenario: ScenarioId) => void
  onAssistMode: (mode: AssistMode) => void
  onStart: () => void
}) {
  return (
    <div className="modal-layer briefing-layer">
      <section className="briefing-card" aria-labelledby="briefing-title">
        <div className="eyebrow">RECOVERY FLIGHT PROGRAM // 01</div>
        <div className="briefing-title-row">
          <div>
            <h1 id="briefing-title">Bring the booster home.</h1>
            <p>One body axis. No thrust-vector control. Every correction has a cost.</p>
          </div>
          <div className="mission-mark" aria-hidden="true"><i /><span>RLV</span></div>
        </div>

        <div className="scenario-picker" role="radiogroup" aria-label="Select recovery mission">
          {(Object.values(SCENARIOS) as ScenarioConfig[]).map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected === item.id}
              className={`scenario-option ${selected === item.id ? 'selected' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="scenario-index">0{item.id === 'asds' ? '1' : '2'}</span>
              <span className="scenario-copy">
                <span className="scenario-kicker">{item.difficulty} recovery</span>
                <strong>{item.shortName}</strong>
                <small>{item.name}</small>
              </span>
              <span className="scenario-score">
                BEST {bestScores[scoreKey(item.id, assistMode)] ?? '—'}
              </span>
            </button>
          ))}
        </div>

        <div className="assist-picker">
          <div>
            <span>FLIGHT PROFILE</span>
            <small>
              {assistMode === 'assisted'
                ? 'Expanded reserves, lower throttle floor, wider zones, and forgiving touchdown limits.'
                : 'Original vehicle reserves and touchdown limits.'}
            </small>
          </div>
          <div className="assist-options" role="radiogroup" aria-label="Select flight difficulty">
            {(['assisted', 'standard'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={assistMode === mode}
                className={assistMode === mode ? 'selected' : ''}
                onClick={() => onAssistMode(mode)}
              >
                {mode === 'assisted' ? 'EASY' : 'STANDARD'}
              </button>
            ))}
          </div>
        </div>

        <div className="mission-detail">
          <div>
            <span>MISSION PROFILE</span>
            <strong>{scenario.objective}</strong>
            <p>{scenario.description}</p>
          </div>
          <dl>
            <div><dt>INITIAL ALT</dt><dd>{scenario.initialAltitude / 1000} km</dd></div>
            <div><dt>INITIAL Vₓ</dt><dd>{scenario.initialHorizontalVelocity} m/s</dd></div>
            <div><dt>LANDING ZONE</dt><dd>{scenario.targetWidth} m</dd></div>
          </dl>
        </div>

        <div className="briefing-bottom">
          <div className="control-legend">
            <span><kbd>↑</kbd><kbd>↓</kbd> THROTTLE</span>
            <span><kbd>←</kbd><kbd>→</kbd> PITCH</span>
            <span><kbd>SPACE</kbd> LEGS</span>
          </div>
          <button className="primary-action" onClick={onStart}>
            <span>START {scenario.shortName} // {assistMode === 'assisted' ? 'EASY' : 'STANDARD'}</span><b>↗</b>
          </button>
        </div>

        <p className="flight-note">
          Cold-gas RCS rotates the vehicle in thin air. Grid-fin authority rises with dynamic pressure.
          Deploying the legs above {scenario.legBreakDynamicPressure / 1000} kPa will break them.
        </p>
      </section>
    </div>
  )
}

function Debrief({
  result,
  scenario,
  elapsed,
  onRetry,
  onBriefing,
}: {
  result: MissionResult
  scenario: ScenarioConfig
  elapsed: number
  onRetry: () => void
  onBriefing: () => void
}) {
  const success = result.outcome === 'landed'
  return (
    <div className="modal-layer debrief-layer">
      <section className={`debrief-card ${success ? 'success' : 'failure'}`} aria-labelledby="debrief-title">
        <div className="result-icon" aria-hidden="true">{success ? '✓' : '×'}</div>
        <div className="eyebrow">
          {scenario.shortName} // {scenario.assistMode === 'assisted' ? 'EASY' : 'STANDARD'} // FLIGHT COMPLETE
        </div>
        <h2 id="debrief-title">{success ? 'Booster secured.' : 'Vehicle lost.'}</h2>
        <p>{success ? 'A stable touchdown inside the recovery zone.' : FAILURE_COPY[result.reason]}</p>
        <div className="score-block">
          <span>SCORE</span><strong>{result.score.toString().padStart(4, '0')}</strong><small>/ 1000</small>
        </div>
        <div className="result-grid">
          <div><span>MISSION TIME</span><strong>{formatTime(elapsed)}</strong></div>
          <div><span>{scenario.targetKind === 'ship' ? 'DECK ERROR' : 'PAD ERROR'}</span><strong>{result.horizontalError.toFixed(1)} m</strong></div>
          <div><span>DESCENT</span><strong>{result.descentSpeed.toFixed(1)} m/s</strong></div>
          <div><span>LATERAL</span><strong>{result.horizontalSpeed.toFixed(1)} m/s</strong></div>
          <div><span>MAIN FUEL</span><strong>{Math.round(result.mainFuelRatio * 100)}%</strong></div>
          <div><span>RCS GAS</span><strong>{Math.round(result.rcsRatio * 100)}%</strong></div>
        </div>
        <div className="debrief-actions">
          <button className="secondary-action" onClick={onBriefing}>CHANGE MISSION</button>
          <button className="primary-action" onClick={onRetry}><span>RETRY</span><b>↻</b></button>
        </div>
      </section>
    </div>
  )
}

export default function App() {
  const stored = useRef(loadGameData())
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('asds')
  const [phase, setPhaseState] = useState<MissionPhase>('briefing')
  const [timeScale, setTimeScale] = useState<TimeScale>(stored.current.timeScale)
  const [cameraMode, setCameraMode] = useState<CameraMode>(stored.current.cameraMode)
  const [assistMode, setAssistMode] = useState<AssistMode>(stored.current.assistMode)
  const [bestScores, setBestScores] = useState(stored.current.bestScores)
  const [result, setResult] = useState<MissionResult | null>(null)
  const scenario = useMemo(
    () => scenarioForMode(selectedScenario, assistMode),
    [selectedScenario, assistMode],
  )

  const initialState = createInitialState(scenario)
  const stateRef = useRef<VehicleState>(initialState)
  const previousStateRef = useRef<VehicleState>(initialState)
  const telemetryRef = useRef<Telemetry>(telemetryFor(initialState, scenario))
  const [telemetry, setTelemetry] = useState<Telemetry>(telemetryRef.current)
  const controlsRef = useRef<ControlInput>({ ...NEUTRAL_INPUT })
  const phaseRef = useRef<MissionPhase>('briefing')
  const pathRef = useRef<Vec2[]>([{ ...initialState.position }])
  const predictionRef = useRef<Vec2[]>(predictGravityOnly(initialState))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const accumulatorRef = useRef(0)
  const lastFrameRef = useRef<number | null>(null)
  const lastUiUpdateRef = useRef(0)
  const lastPathTimeRef = useRef(0)
  const lastPredictionTimeRef = useRef(0)

  const setPhase = useCallback((next: MissionPhase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const initializeSession = useCallback((nextScenario: ScenarioConfig, nextPhase: MissionPhase) => {
    const nextState = createInitialState(nextScenario)
    const nextTelemetry = telemetryFor(nextState, nextScenario)
    stateRef.current = nextState
    previousStateRef.current = nextState
    telemetryRef.current = nextTelemetry
    pathRef.current = [{ ...nextState.position }]
    predictionRef.current = predictGravityOnly(nextState)
    controlsRef.current = { ...NEUTRAL_INPUT }
    accumulatorRef.current = 0
    lastFrameRef.current = null
    lastPathTimeRef.current = 0
    lastPredictionTimeRef.current = 0
    setTelemetry(nextTelemetry)
    setResult(null)
    setPhase(nextPhase)
  }, [setPhase])

  const chooseScenario = (id: ScenarioId) => {
    setSelectedScenario(id)
    initializeSession(scenarioForMode(id, assistMode), 'briefing')
  }

  const chooseAssistMode = (mode: AssistMode) => {
    setAssistMode(mode)
    saveAssistMode(mode)
    initializeSession(scenarioForMode(selectedScenario, mode), 'briefing')
  }

  const cycleTimeScale = () => {
    const currentIndex = TIME_SCALES.indexOf(timeScale)
    const next = TIME_SCALES[(currentIndex + 1) % TIME_SCALES.length]
    setTimeScale(next)
    saveTimeScale(next)
  }

  const chooseCameraMode = (mode: CameraMode) => {
    setCameraMode(mode)
    saveCameraMode(mode)
  }

  const retry = useCallback(() => initializeSession(scenario, 'active'), [initializeSession, scenario])
  const returnToBriefing = useCallback(
    () => initializeSession(scenario, 'briefing'),
    [initializeSession, scenario],
  )

  useEffect(() => {
    const releaseControls = () => {
      controlsRef.current.throttleDelta = 0
      controlsRef.current.pitchCommand = 0
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const flightKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)
      if (flightKey && phaseRef.current === 'active') event.preventDefault()

      if (event.code === 'KeyP' || event.code === 'Escape') {
        if (phaseRef.current === 'active') setPhase('paused')
        else if (phaseRef.current === 'paused') setPhase('active')
        return
      }
      if (event.code === 'KeyR' && phaseRef.current !== 'briefing') {
        retry()
        return
      }
      if (phaseRef.current !== 'active') return
      const action = keyboardAction(event.code, true, event.repeat)
      if (action) applyFlightControl(controlsRef.current, action)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      const action = keyboardAction(event.code, false)
      if (action) applyFlightControl(controlsRef.current, action)
    }

    const onVisibility = () => {
      if (document.hidden && phaseRef.current === 'active') setPhase('paused')
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', releaseControls)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseControls)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [retry, setPhase])

  useEffect(() => {
    let animationFrame = 0
    const animate = (now: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const previousFrame = lastFrameRef.current ?? now
      const frameDelta = Math.min((now - previousFrame) / 1000, 0.1)
      lastFrameRef.current = now

      if (phaseRef.current === 'active') {
        accumulatorRef.current += frameDelta * timeScale
        while (accumulatorRef.current >= FIXED_STEP) {
          previousStateRef.current = stateRef.current
          const step = stepSimulation(stateRef.current, controlsRef.current, scenario, FIXED_STEP)
          stateRef.current = step.state
          telemetryRef.current = step.telemetry
          controlsRef.current.deployLegs = false
          accumulatorRef.current -= FIXED_STEP

          if (step.state.time - lastPathTimeRef.current >= 0.7) {
            pathRef.current.push({ ...step.state.position })
            if (pathRef.current.length > 1_000) pathRef.current.shift()
            lastPathTimeRef.current = step.state.time
          }
          if (step.state.time - lastPredictionTimeRef.current >= 0.5) {
            predictionRef.current = predictGravityOnly(step.state)
            lastPredictionTimeRef.current = step.state.time
          }
          if (step.result) {
            setResult(step.result)
            if (step.result.outcome === 'landed') {
              const saved = saveBestScore(scenario.id, scenario.assistMode, step.result.score)
              setBestScores({ ...saved.bestScores })
              setPhase('landed')
            } else {
              setPhase('crashed')
            }
            break
          }
        }
      }

      if (now - lastUiUpdateRef.current >= 100) {
        setTelemetry({ ...telemetryRef.current })
        lastUiUpdateRef.current = now
      }
      const renderState = phaseRef.current === 'active'
        ? interpolateState(previousStateRef.current, stateRef.current, accumulatorRef.current / FIXED_STEP)
        : stateRef.current
      const interpolatedTelemetry = telemetryFor(renderState, scenario)
      const renderTelemetry = {
        ...telemetryRef.current,
        ...interpolatedTelemetry,
        finForceRatio: telemetryRef.current.finForceRatio,
      }
      drawGame(canvas, {
        state: renderState,
        telemetry: renderTelemetry,
        scenario,
        path: pathRef.current,
        prediction: predictionRef.current,
        phase: phaseRef.current,
        cameraMode,
      })
      animationFrame = requestAnimationFrame(animate)
    }
    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [cameraMode, scenario, setPhase, timeScale])

  return (
    <main className={`app-shell phase-${phase}`}>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="Reusable booster flight view"
        tabIndex={0}
      />

      <header className="top-bar">
        <button className="brand" onClick={returnToBriefing} aria-label="Return to mission briefing">
          <span className="brand-symbol"><i /></span>
          <span><strong>RLV</strong><small>// LANDER</small></span>
        </button>
        <div className="top-status">
          <span className="status-dot" />
          <span>{phase === 'active' ? 'FLIGHT ACTIVE' : phase.toUpperCase()}</span>
          <b>{scenario.shortName} · {scenario.assistMode === 'assisted' ? 'EASY' : 'STANDARD'}</b>
        </div>
        <button className="abort-button" onClick={returnToBriefing}>MISSION BRIEF</button>
      </header>

      {phase !== 'briefing' && (
        <TelemetryPanel
          telemetry={telemetry}
          scenario={scenario}
          timeScale={timeScale}
          cameraMode={cameraMode}
          onCycleTimeScale={cycleTimeScale}
          onSetCameraMode={chooseCameraMode}
        />
      )}

      {phase === 'active' && (
        <div className="desktop-control-strip" aria-hidden="true">
          <span><kbd>←</kbd><kbd>→</kbd> PITCH</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> THROTTLE</span>
          <span><kbd>SPACE</kbd> DEPLOY LEGS</span>
          <span><kbd>P</kbd> PAUSE</span>
        </div>
      )}

      {phase === 'active' && (
        <TouchControls
          onPitch={(value) => applyFlightControl(controlsRef.current, { kind: 'pitch', value })}
          onThrottle={(value) => applyFlightControl(controlsRef.current, { kind: 'throttle', value })}
          onDeployLegs={() => applyFlightControl(controlsRef.current, { kind: 'deploy-legs' })}
        />
      )}

      {phase === 'briefing' && (
        <MissionBriefing
          selected={selectedScenario}
          scenario={scenario}
          assistMode={assistMode}
          bestScores={bestScores}
          onSelect={chooseScenario}
          onAssistMode={chooseAssistMode}
          onStart={() => setPhase('active')}
        />
      )}

      {phase === 'paused' && (
        <div className="modal-layer pause-layer">
          <section className="pause-card">
            <div className="eyebrow">FLIGHT HOLD</div>
            <h2>Simulation paused</h2>
            <p>Flight controls are neutral while paused.</p>
            <button className="primary-action" onClick={() => setPhase('active')}><span>RESUME</span><b>▶</b></button>
            <button className="text-action" onClick={retry}>RESTART MISSION</button>
          </section>
        </div>
      )}

      {(phase === 'landed' || phase === 'crashed') && result && (
        <Debrief
          result={result}
          scenario={scenario}
          elapsed={telemetry.elapsedTime}
          onRetry={retry}
          onBriefing={returnToBriefing}
        />
      )}

      <footer className="disclaimer">UNOFFICIAL EDUCATIONAL SIMULATION · VEHICLE VALUES ARE APPROXIMATE</footer>
    </main>
  )
}
