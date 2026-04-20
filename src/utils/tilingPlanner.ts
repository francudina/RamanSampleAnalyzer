import type { SampleShape, StageConstraints, Point } from '../types/scan'
import type { RotationOptimum } from '../types/scan'
import { getBoundingBox, pointInShape } from './scanGenerator'

// ── Public helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a synthetic rectangle SampleShape whose bounds equal the
 * axis-aligned bounding box of `shape` after rotating it `angleDeg` degrees
 * clockwise around the shape's centroid.  Used to generate a "rotated" scan
 * result for preview purposes.
 */
export function getRotatedBoundingRectShape(
  shape: SampleShape,
  angleDeg: number,
): SampleShape {
  if (shape.type === 'circle') return shape // AABB of a circle is rotation-invariant

  const pts = getShapePolygon(shape)
  if (pts.length === 0) return shape

  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length

  const xs = pts.map((p) => cx + (p.x - cx) * cos - (p.y - cy) * sin)
  const ys = pts.map((p) => cy + (p.x - cx) * sin + (p.y - cy) * cos)

  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = Math.min(...ys), yMax = Math.max(...ys)

  return {
    type: 'rectangle',
    rect: { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin },
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getShapePolygon(shape: SampleShape): Point[] {
  if (shape.type === 'rectangle' && shape.rect) {
    const r = shape.rect
    return [
      { x: r.x,           y: r.y            },
      { x: r.x + r.width, y: r.y            },
      { x: r.x + r.width, y: r.y + r.height },
      { x: r.x,           y: r.y + r.height },
    ]
  }
  if (shape.type === 'freeform' && shape.freeform) {
    return shape.freeform.points
  }
  return []
}

/**
 * Returns the axis-aligned bounding box of the shape after rotating it by
 * `angleDeg` degrees clockwise around its centroid.
 */
function rotatedBBox(shape: SampleShape, angleDeg: number): [number, number, number, number] {
  if (shape.type === 'circle') return getBoundingBox(shape)

  const pts = getShapePolygon(shape)
  if (pts.length === 0) return getBoundingBox(shape)

  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length

  const xs = pts.map((p) => cx + (p.x - cx) * cos - (p.y - cy) * sin)
  const ys = pts.map((p) => cy + (p.x - cx) * sin + (p.y - cy) * cos)

  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

function countTiles(bbox: [number, number, number, number], effW: number, effH: number): number {
  const [xMin, yMin, xMax, yMax] = bbox
  const w = xMax - xMin
  const h = yMax - yMin
  if (w <= 0 || h <= 0) return 0
  return Math.max(1, Math.ceil(w / effW)) * Math.max(1, Math.ceil(h / effH))
}

/**
 * Like countTiles but filters out tiles where none of the 9 sample points
 * (4 corners, 4 edge midpoints, centre) falls inside the shape.
 * Used for the baseline (unrotated) count so empty-corner tiles aren't counted.
 */
function countNonEmptyTiles(
  shape: SampleShape,
  bbox: [number, number, number, number],
  effW: number,
  effH: number,
  maxW: number,
  maxH: number,
): number {
  const [xMin, yMin, xMax, yMax] = bbox
  const cols = Math.max(1, Math.ceil((xMax - xMin) / effW))
  const rows = Math.max(1, Math.ceil((yMax - yMin) / effH))
  let count = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const txMin = xMin + col * effW
      const tyMin = yMin + row * effH
      const txMax = Math.min(txMin + maxW, xMax)
      const tyMax = Math.min(tyMin + maxH, yMax)
      const xs = [txMin, (txMin + txMax) / 2, txMax]
      const ys = [tyMin, (tyMin + tyMax) / 2, tyMax]
      if (xs.some((x) => ys.some((y) => pointInShape(x, y, shape)))) count++
    }
  }
  return count
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Sweep rotation angles 0–89° in 1° increments and find the angle that
 * minimises the number of tiles needed to cover the sample bounding box.
 */
export function findOptimalRotation(
  shape: SampleShape,
  stage: StageConstraints,
): RotationOptimum {
  const tileOverlap = stage.tile_overlap ?? 0
  const effW = Math.max(1, stage.max_scan_width  * (1 - tileOverlap))
  const effH = Math.max(1, stage.max_scan_height * (1 - tileOverlap))

  const baseBbox  = getBoundingBox(shape)
  // Use 9-point sampling to skip tiles that contain no actual scan points
  const baseCount = countNonEmptyTiles(shape, baseBbox, effW, effH, stage.max_scan_width, stage.max_scan_height)

  let bestAngle = 0
  let bestCount = baseCount

  for (let angle = 1; angle < 90; angle++) {
    const bbox = rotatedBBox(shape, angle)
    // Rotated shape is always a rectangle (AABB), so all tiles are non-empty — geometric count is exact
    const count = countTiles(bbox, effW, effH)
    if (count < bestCount) {
      bestCount = count
      bestAngle = angle
    }
  }

  return {
    angle_deg:           bestAngle,
    tile_count:          bestCount,
    baseline_tile_count: baseCount,
  }
}
