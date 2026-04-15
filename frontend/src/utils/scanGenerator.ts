import type {
  SampleShape,
  ScanParameters,
  ScanPass,
  ScanResult,
  StageConstraints,
} from '../types/scan'

// ── Bounding box ───────────────────────────────────────────────────────────────

function getBoundingBox(shape: SampleShape): [number, number, number, number] {
  if (shape.type === 'rectangle' && shape.rect) {
    const r = shape.rect
    return [r.x, r.y, r.x + r.width, r.y + r.height]
  }
  if (shape.type === 'circle' && shape.circle) {
    const c = shape.circle
    return [c.cx - c.radius, c.cy - c.radius, c.cx + c.radius, c.cy + c.radius]
  }
  if (shape.type === 'freeform' && shape.freeform) {
    const xs = shape.freeform.points.map((p) => p.x)
    const ys = shape.freeform.points.map((p) => p.y)
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }
  throw new Error('Unsupported or incomplete shape')
}

// ── Point containment ──────────────────────────────────────────────────────────

function inRect(x: number, y: number, shape: SampleShape): boolean {
  const r = shape.rect!
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
}

function inCircle(x: number, y: number, shape: SampleShape): boolean {
  const c = shape.circle!
  return (x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.radius ** 2
}

function inPolygon(x: number, y: number, shape: SampleShape): boolean {
  const pts = shape.freeform!.points
  const n = pts.length
  let inside = false
  let j = n - 1
  for (let i = 0; i < n; i++) {
    const xi = pts[i].x, yi = pts[i].y
    const xj = pts[j].x, yj = pts[j].y
    if ((yi > y) !== (yj > y)) {
      const intersectX = ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (x < intersectX) inside = !inside
    }
    j = i
  }
  return inside
}

function pointInShape(x: number, y: number, shape: SampleShape): boolean {
  if (shape.type === 'rectangle') return inRect(x, y, shape)
  if (shape.type === 'circle') return inCircle(x, y, shape)
  if (shape.type === 'freeform') return inPolygon(x, y, shape)
  return false
}

// ── Region splitting ───────────────────────────────────────────────────────────

function splitRegion(
  bounds: [number, number, number, number],
  maxW: number,
  maxH: number,
): [number, number, number, number][] {
  const [xMin, yMin, xMax, yMax] = bounds
  const cols = Math.ceil((xMax - xMin) / maxW)
  const rows = Math.ceil((yMax - yMin) / maxH)
  const tiles: [number, number, number, number][] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const txMin = xMin + col * maxW
      const tyMin = yMin + row * maxH
      const txMax = Math.min(txMin + maxW, xMax)
      const tyMax = Math.min(tyMin + maxH, yMax)
      tiles.push([txMin, tyMin, txMax, tyMax])
    }
  }
  return tiles
}

// ── Single pass ────────────────────────────────────────────────────────────────

function generatePass(
  passNumber: number,
  region: [number, number, number, number],
  effStepX: number,
  effStepY: number,
  shape: SampleShape,
): ScanPass {
  const [xMin, yMin, xMax, yMax] = region

  let nx = Math.max(1, Math.floor((xMax - xMin) / effStepX) + 1)
  let ny = Math.max(1, Math.floor((yMax - yMin) / effStepY) + 1)

  if (nx > 1 && xMin + (nx - 1) * effStepX > xMax + 1e-9) nx--
  if (ny > 1 && yMin + (ny - 1) * effStepY > yMax + 1e-9) ny--

  const gridPoints: { x: number; y: number }[] = []
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const px = xMin + i * effStepX
      const py = yMin + j * effStepY
      if (pointInShape(px, py, shape)) {
        gridPoints.push({ x: Math.round(px * 1e4) / 1e4, y: Math.round(py * 1e4) / 1e4 })
      }
    }
  }

  const spanX = nx > 1 ? (nx - 1) * effStepX : 0
  const spanY = ny > 1 ? (ny - 1) * effStepY : 0
  const areaMm2 = (spanX / 1000) * (spanY / 1000)

  return {
    pass_number: passNumber,
    region: {
      x_min: Math.round(xMin * 1e4) / 1e4,
      y_min: Math.round(yMin * 1e4) / 1e4,
      x_max: Math.round(xMax * 1e4) / 1e4,
      y_max: Math.round(yMax * 1e4) / 1e4,
    },
    start_point: { x: Math.round(xMin * 1e4) / 1e4, y: Math.round(yMin * 1e4) / 1e4 },
    delta_x: Math.round(effStepX * 1e4) / 1e4,
    delta_y: Math.round(effStepY * 1e4) / 1e4,
    nx,
    ny,
    total_points: gridPoints.length,
    area_mm2: Math.round(areaMm2 * 1e6) / 1e6,
    grid_points: gridPoints,
  }
}

// ── Public entry point ─────────────────────────────────────────────────────────

export function generateScanGrid(
  shape: SampleShape,
  scanParams: ScanParameters,
  stage: StageConstraints,
): ScanResult {
  const warnings: string[] = []

  const effStepX = scanParams.step_x * (1 - scanParams.overlap)
  const effStepY = scanParams.step_y * (1 - scanParams.overlap)

  if (effStepX <= 0 || effStepY <= 0) {
    throw new Error('Effective step size must be positive (reduce overlap)')
  }
  if (scanParams.step_x < 1 || scanParams.step_y < 1) {
    warnings.push('Step size < 1 µm — may exceed hardware positioning precision.')
  }

  const bounds = getBoundingBox(shape)
  const [xMin, yMin, xMax, yMax] = bounds
  const totalW = xMax - xMin
  const totalH = yMax - yMin

  const needsSplit = totalW > stage.max_scan_width || totalH > stage.max_scan_height

  let regions: [number, number, number, number][]
  if (needsSplit) {
    const cols = Math.ceil(totalW / stage.max_scan_width)
    const rows = Math.ceil(totalH / stage.max_scan_height)
    warnings.push(
      `Sample area (${(totalW / 1000).toFixed(2)} mm × ${(totalH / 1000).toFixed(2)} mm) exceeds ` +
      `stage scan limit (${(stage.max_scan_width / 1000).toFixed(0)} mm × ` +
      `${(stage.max_scan_height / 1000).toFixed(0)} mm). ` +
      `Scan split into ${cols * rows} passes (${cols} col × ${rows} row). ` +
      'Reposition the stage between passes.',
    )
    regions = splitRegion(bounds, stage.max_scan_width, stage.max_scan_height)
  } else {
    regions = [bounds]
  }

  const passes: ScanPass[] = regions.map((region, i) =>
    generatePass(i + 1, region, effStepX, effStepY, shape),
  )

  const totalPoints = passes.reduce((s, p) => s + p.total_points, 0)
  const totalAreaMm2 = passes.reduce((s, p) => s + p.area_mm2, 0)

  if (totalPoints === 0) {
    warnings.push(
      'No scan points generated — check that the shape is valid and step size is smaller than the sample dimensions.',
    )
  } else if (totalPoints > 50_000) {
    warnings.push(`Very large scan: ${totalPoints.toLocaleString()} points. This will take a very long time.`)
  } else if (totalPoints > 10_000) {
    warnings.push(`Large scan: ${totalPoints.toLocaleString()} points. Estimated long scan time.`)
  }

  const estimatedTimeMinutes = (totalPoints * stage.time_per_point_seconds) / 60

  return {
    passes,
    total_points: totalPoints,
    total_area_mm2: Math.round(totalAreaMm2 * 1e6) / 1e6,
    warnings,
    estimated_time_minutes: Math.round(estimatedTimeMinutes * 10) / 10,
    requires_multiple_passes: passes.length > 1,
  }
}
