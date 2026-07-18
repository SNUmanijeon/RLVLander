import { DEG } from '../sim/constants'
import { altitude, clamp, downrange, eastUnit, wrapAngle } from '../sim/math'
import type { MissionPhase, ScenarioConfig, Telemetry, Vec2, VehicleState } from '../sim/types'

interface RenderFrame {
  state: VehicleState
  telemetry: Telemetry
  scenario: ScenarioConfig
  path: Vec2[]
  prediction: Vec2[]
  phase: MissionPhase
}

interface Viewport {
  width: number
  height: number
  metersPerPixel: number
  cameraX: number
  groundY: number
}

function resizeCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const bounds = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.floor(bounds.width * dpr))
  const height = Math.max(1, Math.floor(bounds.height * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  context?.setTransform(dpr, 0, 0, dpr, 0, 0)
  return context
}

function localPointToScreen(point: Vec2, viewport: Viewport): { x: number; y: number } {
  return {
    x: viewport.width / 2 + (downrange(point) - viewport.cameraX) / viewport.metersPerPixel,
    y: viewport.groundY - altitude(point) / viewport.metersPerPixel,
  }
}

function makeViewport(frame: RenderFrame, width: number, height: number): Viewport {
  const horizontalDistance = Math.abs(frame.telemetry.distanceToTarget)
  const h = frame.telemetry.altitude
  let horizontalSpan: number
  let verticalSpan: number

  if (h < 2_000) {
    horizontalSpan = clamp(Math.max(1_400, horizontalDistance * 2.2, h * 2.2), 1_400, 12_000)
    verticalSpan = Math.max(1_400, h * 1.35)
  } else if (h < 15_000) {
    horizontalSpan = clamp(Math.max(12_000, horizontalDistance * 1.5), 12_000, 80_000)
    verticalSpan = Math.max(18_000, h * 1.3)
  } else {
    horizontalSpan = clamp(Math.max(120_000, horizontalDistance * 1.18), 120_000, 500_000)
    verticalSpan = Math.max(110_000, h * 1.28)
  }

  const metersPerPixel = Math.max(horizontalSpan / (width * 0.82), verticalSpan / (height * 0.7))
  const landingBlend = clamp(1 - h / 25_000, 0, 0.8)
  const cameraX =
    frame.telemetry.downrange * (1 - landingBlend) + frame.scenario.targetDownrange * landingBlend
  return { width, height, metersPerPixel, cameraX, groundY: height * 0.78 }
}

function drawBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
  const sky = context.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#030813')
  sky.addColorStop(0.56, '#08192b')
  sky.addColorStop(0.78, '#12334a')
  sky.addColorStop(1, '#0b1925')
  context.fillStyle = sky
  context.fillRect(0, 0, width, height)

  for (let index = 0; index < 72; index += 1) {
    const x = (index * 97.13 + 31) % width
    const y = (index * 53.77 + 17) % (height * 0.67)
    const radius = index % 9 === 0 ? 1.25 : 0.65
    context.globalAlpha = 0.2 + ((index * 17) % 50) / 100
    context.fillStyle = '#d8efff'
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1

  const atmosphere = context.createLinearGradient(0, height * 0.52, 0, height * 0.83)
  atmosphere.addColorStop(0, 'rgba(38, 146, 187, 0)')
  atmosphere.addColorStop(0.7, 'rgba(38, 146, 187, 0.11)')
  atmosphere.addColorStop(1, 'rgba(80, 187, 213, 0.18)')
  context.fillStyle = atmosphere
  context.fillRect(0, height * 0.5, width, height * 0.34)
}

function drawGround(context: CanvasRenderingContext2D, viewport: Viewport): void {
  const { width, height, groundY, metersPerPixel } = viewport
  context.beginPath()
  context.moveTo(0, groundY)
  const curve = Math.min(22, (width * width * metersPerPixel) / 50_968_000)
  context.quadraticCurveTo(width / 2, groundY - curve, width, groundY)
  context.lineTo(width, height)
  context.lineTo(0, height)
  context.closePath()
  const ground = context.createLinearGradient(0, groundY, 0, height)
  ground.addColorStop(0, '#10222b')
  ground.addColorStop(1, '#050b10')
  context.fillStyle = ground
  context.fill()
  context.strokeStyle = 'rgba(112, 211, 221, 0.35)'
  context.lineWidth = 1
  context.stroke()
}

function drawPath(
  context: CanvasRenderingContext2D,
  points: Vec2[],
  viewport: Viewport,
  color: string,
  dashed = false,
): void {
  if (points.length < 2) return
  context.save()
  context.strokeStyle = color
  context.lineWidth = dashed ? 1.3 : 1.8
  context.setLineDash(dashed ? [6, 7] : [])
  context.beginPath()
  points.forEach((point, index) => {
    const screen = localPointToScreen(point, viewport)
    if (index === 0) context.moveTo(screen.x, screen.y)
    else context.lineTo(screen.x, screen.y)
  })
  context.stroke()
  context.restore()
}

function drawTarget(context: CanvasRenderingContext2D, frame: RenderFrame, viewport: Viewport): void {
  const x = viewport.width / 2 +
    (frame.scenario.targetDownrange - viewport.cameraX) / viewport.metersPerPixel
  const y = viewport.groundY
  const exaggeratedWidth = clamp(frame.scenario.targetWidth / viewport.metersPerPixel, 24, 104)

  context.save()
  context.translate(x, y)
  if (frame.scenario.targetKind === 'ship') {
    context.fillStyle = '#182d39'
    context.strokeStyle = '#73d4dc'
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(-exaggeratedWidth * 0.58, 2)
    context.lineTo(exaggeratedWidth * 0.58, 2)
    context.lineTo(exaggeratedWidth * 0.42, 13)
    context.lineTo(-exaggeratedWidth * 0.38, 13)
    context.closePath()
    context.fill()
    context.stroke()
    context.fillStyle = '#d8edf0'
    context.fillRect(-exaggeratedWidth / 2, -2, exaggeratedWidth, 4)
    context.fillStyle = '#f4a261'
    context.fillRect(exaggeratedWidth * 0.22, -14, 12, 12)
  } else {
    context.strokeStyle = '#78d9df'
    context.lineWidth = 2
    context.beginPath()
    context.ellipse(0, 0, exaggeratedWidth / 2, 7, 0, 0, Math.PI * 2)
    context.stroke()
    context.fillStyle = 'rgba(120, 217, 223, 0.14)'
    context.fill()
    context.strokeStyle = 'rgba(120, 217, 223, 0.5)'
    context.beginPath()
    context.moveTo(-exaggeratedWidth / 2, 0)
    context.lineTo(exaggeratedWidth / 2, 0)
    context.stroke()
  }
  context.fillStyle = '#8eeaf0'
  context.font = '600 10px "IBM Plex Mono", monospace'
  context.textAlign = 'center'
  context.fillText(frame.scenario.shortName, 0, -22)
  context.restore()
}

function drawBooster(context: CanvasRenderingContext2D, frame: RenderFrame, viewport: Viewport): void {
  const screen = localPointToScreen(frame.state.position, viewport)
  const length = clamp(frame.scenario.vehicle.length / viewport.metersPerPixel, 30, 88)
  const bodyWidth = Math.max(5, length / 11)
  const east = eastUnit(frame.state.position)
  const eastAngle = Math.atan2(east.y, east.x)
  const localAngle = wrapAngle(frame.state.angle - eastAngle)

  context.save()
  context.translate(screen.x, screen.y)
  context.rotate(-localAngle)

  if (frame.state.throttle > 0 && frame.state.engineCount > 0) {
    const plumeLength = length * (0.28 + frame.state.throttle * 0.52)
    const plume = context.createLinearGradient(-length / 2 - plumeLength, 0, -length / 2, 0)
    plume.addColorStop(0, 'rgba(86, 210, 255, 0)')
    plume.addColorStop(0.45, 'rgba(86, 210, 255, 0.65)')
    plume.addColorStop(1, 'rgba(255, 190, 92, 0.95)')
    context.fillStyle = plume
    context.beginPath()
    context.moveTo(-length / 2, -bodyWidth * 0.36)
    context.lineTo(-length / 2 - plumeLength, 0)
    context.lineTo(-length / 2, bodyWidth * 0.36)
    context.closePath()
    context.fill()
  }

  context.fillStyle = '#dce6ea'
  context.strokeStyle = '#ffffff'
  context.lineWidth = 1
  context.beginPath()
  context.roundRect(-length / 2, -bodyWidth / 2, length * 0.88, bodyWidth, bodyWidth * 0.35)
  context.fill()
  context.stroke()
  context.beginPath()
  context.moveTo(length * 0.38, -bodyWidth / 2)
  context.lineTo(length / 2, 0)
  context.lineTo(length * 0.38, bodyWidth / 2)
  context.closePath()
  context.fill()
  context.stroke()

  context.fillStyle = '#283844'
  context.fillRect(-length * 0.48, -bodyWidth * 0.55, length * 0.09, bodyWidth * 1.1)
  context.fillStyle = '#aebcc2'
  context.fillRect(-length * 0.2, -bodyWidth * 0.48, length * 0.03, bodyWidth * 0.96)

  context.strokeStyle = '#88dfe5'
  context.lineWidth = 1.5
  const finX = length * 0.29
  context.beginPath()
  context.moveTo(finX, -bodyWidth / 2)
  context.lineTo(finX - length * 0.08, -bodyWidth * 1.15)
  context.moveTo(finX, bodyWidth / 2)
  context.lineTo(finX - length * 0.08, bodyWidth * 1.15)
  context.stroke()

  if (frame.state.legs !== 'stowed') {
    context.strokeStyle = frame.state.legs === 'broken' ? '#ff6174' : '#f3c675'
    context.lineWidth = 1.8
    context.beginPath()
    context.moveTo(-length * 0.4, -bodyWidth / 2)
    context.lineTo(-length * 0.53, -bodyWidth * 1.35)
    context.moveTo(-length * 0.4, bodyWidth / 2)
    context.lineTo(-length * 0.53, bodyWidth * 1.35)
    context.stroke()
  }
  context.restore()

  const targetX = viewport.width / 2 +
    (frame.scenario.targetDownrange - viewport.cameraX) / viewport.metersPerPixel
  const targetY = viewport.groundY
  const dx = targetX - screen.x
  const dy = targetY - screen.y
  const direction = Math.atan2(dy, dx)
  context.save()
  context.translate(screen.x, screen.y)
  context.rotate(direction)
  context.strokeStyle = '#71dce5'
  context.fillStyle = '#71dce5'
  context.lineWidth = 1.5
  context.beginPath()
  context.moveTo(18, 0)
  context.lineTo(54, 0)
  context.stroke()
  context.beginPath()
  context.moveTo(54, 0)
  context.lineTo(45, -5)
  context.lineTo(45, 5)
  context.closePath()
  context.fill()
  context.restore()

  const popupX = clamp(screen.x + 30, 12, viewport.width - 170)
  const popupY = clamp(screen.y - 52, 76, viewport.height - 70)
  context.fillStyle = 'rgba(3, 12, 22, 0.82)'
  context.strokeStyle = 'rgba(116, 220, 228, 0.35)'
  context.lineWidth = 1
  context.beginPath()
  context.roundRect(popupX, popupY, 142, 40, 5)
  context.fill()
  context.stroke()
  context.font = '600 10px "IBM Plex Mono", monospace'
  context.fillStyle = '#f4c16e'
  context.textAlign = 'left'
  context.fillText(`THR  ${Math.round(frame.telemetry.throttle * 100).toString().padStart(3, '0')}%`, popupX + 9, popupY + 15)
  context.fillStyle = '#78dce4'
  context.fillText(`FIN  ${Math.round(frame.telemetry.finForceRatio * 100).toString().padStart(3, '0')}%`, popupX + 9, popupY + 30)
}

function drawMiniMap(context: CanvasRenderingContext2D, frame: RenderFrame, width: number): void {
  const panelWidth = Math.min(285, width * 0.42)
  const panelHeight = Math.max(118, panelWidth * 0.52)
  const x = 18
  const y = 76
  const padding = 15
  const allPoints = [...frame.path, ...frame.prediction, frame.state.position]
  const xs = allPoints.map(downrange).concat(frame.scenario.targetDownrange, frame.scenario.initialDownrange)
  const hs = allPoints.map((point) => Math.max(0, altitude(point))).concat(frame.scenario.initialAltitude)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const spanX = Math.max(1, maxX - minX)
  const maxH = Math.max(1, ...hs)
  const mapX = (worldX: number): number => x + padding + ((worldX - minX) / spanX) * (panelWidth - padding * 2)
  const mapY = (h: number): number => y + panelHeight - padding - (h / maxH) * (panelHeight - padding * 2)

  context.save()
  context.fillStyle = 'rgba(2, 10, 19, 0.86)'
  context.strokeStyle = 'rgba(120, 220, 227, 0.28)'
  context.lineWidth = 1
  context.beginPath()
  context.roundRect(x, y, panelWidth, panelHeight, 8)
  context.fill()
  context.stroke()
  context.beginPath()
  context.rect(x + 1, y + 1, panelWidth - 2, panelHeight - 2)
  context.clip()

  context.strokeStyle = 'rgba(111, 210, 220, 0.18)'
  context.setLineDash([2, 4])
  for (let row = 1; row < 4; row += 1) {
    const gy = y + (panelHeight * row) / 4
    context.beginPath()
    context.moveTo(x, gy)
    context.lineTo(x + panelWidth, gy)
    context.stroke()
  }
  context.setLineDash([])

  const plot = (points: Vec2[], color: string, dashed: boolean): void => {
    if (points.length < 2) return
    context.strokeStyle = color
    context.lineWidth = 1.4
    context.setLineDash(dashed ? [5, 5] : [])
    context.beginPath()
    points.forEach((point, index) => {
      const px = mapX(downrange(point))
      const py = mapY(Math.max(0, altitude(point)))
      if (index === 0) context.moveTo(px, py)
      else context.lineTo(px, py)
    })
    context.stroke()
  }
  plot(frame.prediction, 'rgba(244, 193, 110, 0.75)', true)
  plot(frame.path, '#67d9e3', false)

  const startX = mapX(frame.scenario.initialDownrange)
  const startY = mapY(frame.scenario.initialAltitude)
  context.fillStyle = '#8b99a5'
  context.fillRect(startX - 2, startY - 2, 4, 4)
  context.fillStyle = '#f4c16e'
  context.beginPath()
  context.arc(mapX(frame.scenario.targetDownrange), mapY(0), 4, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#7ce4eb'
  context.beginPath()
  context.arc(mapX(frame.telemetry.downrange), mapY(frame.telemetry.altitude), 4, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#a8c0cb'
  context.font = '600 9px "IBM Plex Mono", monospace'
  context.textAlign = 'left'
  context.fillText('TRAJECTORY / GRAVITY', x + 10, y + 15)
  context.fillStyle = '#f4c16e'
  context.textAlign = 'right'
  context.fillText(`${(frame.telemetry.distanceToTarget / 1000).toFixed(1)} km`, x + panelWidth - 10, y + 15)
  context.restore()
}

function drawWarnings(context: CanvasRenderingContext2D, frame: RenderFrame, width: number, height: number): void {
  const warnings: string[] = []
  if (frame.telemetry.rcsRatio < 0.15) warnings.push('RCS RESERVE LOW')
  if (frame.state.legs === 'deployed' && frame.telemetry.dynamicPressure > 3_500) warnings.push('LEG LOAD HIGH')
  if (frame.state.legs === 'broken') warnings.push('LANDING LEGS LOST')
  if (frame.telemetry.mainFuelRatio < 0.1) warnings.push('MAIN FUEL LOW')
  if (warnings.length === 0) return

  context.font = '700 11px "IBM Plex Mono", monospace'
  context.textAlign = 'center'
  warnings.forEach((warning, index) => {
    context.fillStyle = 'rgba(255, 64, 85, 0.12)'
    context.fillRect(width / 2 - 92, height - 74 - index * 23, 184, 18)
    context.fillStyle = '#ff687b'
    context.fillText(warning, width / 2, height - 61 - index * 23)
  })
}

export function drawGame(canvas: HTMLCanvasElement, frame: RenderFrame): void {
  const context = resizeCanvas(canvas)
  if (!context) return
  const bounds = canvas.getBoundingClientRect()
  const width = bounds.width
  const height = bounds.height
  context.clearRect(0, 0, width, height)
  drawBackground(context, width, height)
  const viewport = makeViewport(frame, width, height)
  drawPath(context, frame.prediction, viewport, 'rgba(244, 193, 110, 0.52)', true)
  drawPath(context, frame.path, viewport, 'rgba(102, 221, 230, 0.72)')
  drawGround(context, viewport)
  drawTarget(context, frame, viewport)
  drawBooster(context, frame, viewport)
  drawMiniMap(context, frame, width)
  drawWarnings(context, frame, width, height)

  if (frame.phase === 'paused') {
    context.fillStyle = 'rgba(2, 8, 16, 0.35)'
    context.fillRect(0, 0, width, height)
  }
}

export function pitchDegrees(telemetry: Telemetry): number {
  return telemetry.pitch / DEG
}

