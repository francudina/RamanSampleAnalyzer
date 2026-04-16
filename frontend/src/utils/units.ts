// ── Display unit system ────────────────────────────────────────────────────────

export type DisplayUnit = 'nm' | 'µm' | 'mm' | 'cm'

export interface DisplayUnitOption {
  value: DisplayUnit
  label: string
  step: number       // sensible input step in this unit
  decimals: number   // decimal places for display
}

export const DISPLAY_UNIT_OPTIONS: DisplayUnitOption[] = [
  { value: 'nm',  label: 'nm  (nanometres)',  step: 1,      decimals: 1 },
  { value: 'µm',  label: 'µm  (microns)',     step: 0.1,    decimals: 3 },
  { value: 'mm',  label: 'mm  (millimetres)', step: 0.001,  decimals: 4 },
  { value: 'cm',  label: 'cm  (centimetres)', step: 0.0001, decimals: 5 },
]

/** Convert internal µm value to the selected display unit. */
export function umToDisplay(um: number, unit: DisplayUnit): number {
  switch (unit) {
    case 'nm': return um * 1_000
    case 'µm': return um
    case 'mm': return um / 1_000
    case 'cm': return um / 10_000
  }
}

/** Convert a display-unit value back to internal µm. */
export function displayToUm(val: number, unit: DisplayUnit): number {
  switch (unit) {
    case 'nm': return val / 1_000
    case 'µm': return val
    case 'mm': return val * 1_000
    case 'cm': return val * 10_000
  }
}

/** Format a µm value using the chosen display unit. */
export function fmtDisplay(um: number, unit: DisplayUnit, decimals?: number): string {
  const opts = DISPLAY_UNIT_OPTIONS.find((o) => o.value === unit)!
  const d = decimals ?? opts.decimals
  return `${umToDisplay(um, unit).toFixed(d)} ${unit}`
}

// ── Legacy helpers (kept for internal use) ────────────────────────────────────

/** Convert µm → mm */
export const umToMm = (um: number): number => um / 1_000

/** Convert µm → cm */
export const umToCm = (um: number): number => um / 10_000

/** Convert mm → µm */
export const mmToUm = (mm: number): number => mm * 1_000

/** Convert cm → µm */
export const cmToUm = (cm: number): number => cm * 10_000

/**
 * Format a micron value with the most readable unit.
 * < 1000 µm → show in µm
 * ≥ 1000 µm → show in mm
 * ≥ 10 000 µm → show in cm
 */
export function formatUm(um: number, decimals = 2): string {
  const abs = Math.abs(um)
  if (abs >= 10_000) return `${umToCm(um).toFixed(decimals)} cm`
  if (abs >= 1_000)  return `${umToMm(um).toFixed(decimals)} mm`
  return `${um.toFixed(decimals)} µm`
}

/** Always show in µm with fixed decimals */
export function fmtUm(um: number, decimals = 3): string {
  return `${um.toFixed(decimals)} µm`
}

/** Format µm² in the current display unit's area (unit²) */
export function fmtAreaDisplay(um2: number, unit: DisplayUnit): string {
  switch (unit) {
    case 'nm': return `${(um2 * 1e6).toFixed(1)} nm²`
    case 'µm': return `${um2.toFixed(2)} µm²`
    case 'mm': return `${(um2 / 1e6).toFixed(4)} mm²`
    case 'cm': return `${(um2 / 1e8).toFixed(6)} cm²`
  }
}

/** Format mm² */
export function fmtMm2(mm2: number): string {
  if (mm2 >= 100) return `${(mm2 / 100).toFixed(3)} cm²`
  return `${mm2.toFixed(4)} mm²`
}

/** Format minutes into h m s */
export function fmtTime(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} s`
  if (minutes < 60) return `${minutes.toFixed(1)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h} h ${m} min`
}
