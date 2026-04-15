import { useEffect, useRef, useState } from 'react'
import type { ScanResult } from '../../types/scan'
import {
  type DisplayUnit,
  DISPLAY_UNIT_OPTIONS,
  fmtDisplay,
  fmtMm2,
  fmtTime,
} from '../../utils/units'

interface Props {
  result: ScanResult | null
  displayUnit: DisplayUnit
  isLoading: boolean
  error: string | null
  focusMode: boolean
  hoveredPass: number | null
  onPassHover: (pass: number | null) => void
}

const PASS_COLORS = ['#4a9eff', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#06b6d4']

function buildCopyText(result: ScanResult, displayUnit: DisplayUnit): string {
  const d = DISPLAY_UNIT_OPTIONS.find((o) => o.value === displayUnit)!.decimals
  const fmt = (um: number) => fmtDisplay(um, displayUnit, d)
  const lines: string[] = [
    '=== DXR3 Raman Scan Configuration ===',
    `Unit: ${displayUnit}`,
    '',
  ]

  result.passes.forEach((pass) => {
    lines.push(`Pass ${pass.pass_number}:`)
    lines.push(`  Start (X, Y):  ${fmt(pass.start_point.x)}  ,  ${fmt(pass.start_point.y)}`)
    lines.push(`  ΔX:  ${fmt(pass.delta_x)}`)
    lines.push(`  ΔY:  ${fmt(pass.delta_y)}`)
    lines.push(`  Nx:  ${pass.nx}   Ny:  ${pass.ny}   →  ${pass.nx} × ${pass.ny} = ${pass.total_points.toLocaleString()} points`)
    lines.push(`  Area:  ${fmtMm2(pass.area_mm2)}`)
    lines.push('')
  })

  lines.push('─────────────────────────────────────')
  lines.push(`Total points:    ${result.total_points.toLocaleString()}`)
  lines.push(`Total area:      ${fmtMm2(result.total_area_mm2)}`)
  lines.push(`Estimated time:  ${fmtTime(result.estimated_time_minutes)}`)

  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('Warnings:')
    result.warnings.forEach((w) => lines.push(`  ⚠  ${w}`))
  }

  return lines.join('\n')
}

export default function ScanResults({ result, displayUnit, isLoading, error, focusMode, hoveredPass, onPassHover }: Props) {
  const [copied, setCopied] = useState(false)
  const passRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    if (hoveredPass === null) return
    const el = passRefs.current[hoveredPass]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [hoveredPass])

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(buildCopyText(result, displayUnit))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-[#666] gap-2">
        <div className="w-5 h-5 border-2 border-[#4a9eff] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Computing scan grid…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400">
        <strong className="text-red-700 dark:text-red-300">Error:</strong> {error}
      </div>
    )
  }

  if (!result) {
    return (
      <div className="text-xs text-gray-400 dark:text-[#555] text-center py-8 leading-relaxed">
        Define a shape and click{' '}
        <strong className="text-gray-500 dark:text-[#888]">Generate Scan</strong>{' '}
        to see DXR3 parameters here.
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-[#888]">DXR3 Parameters</h3>
        <button
          onClick={handleCopy}
          className="text-[10px] px-2 py-1 rounded border border-gray-200 dark:border-[#3a3a3a] text-gray-500 dark:text-[#888] hover:border-blue-400 hover:text-blue-500 dark:hover:border-[#4a9eff] dark:hover:text-[#4a9eff] transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy all'}
        </button>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-1">
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="flex gap-2 text-[10px] rounded border border-amber-400 bg-amber-50 p-2 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-400"
            >
              <span>⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Per-pass blocks */}
      {result.passes.map((pass, idx) => {
        const color = PASS_COLORS[idx % PASS_COLORS.length]
        const d = DISPLAY_UNIT_OPTIONS.find((o) => o.value === displayUnit)!.decimals
        const fmt = (um: number) => fmtDisplay(um, displayUnit, d)
        const isHovered = focusMode && hoveredPass === pass.pass_number
        const isDimmed = focusMode && hoveredPass !== null && hoveredPass !== pass.pass_number
        return (
          <div
            key={pass.pass_number}
            ref={(el) => { passRefs.current[pass.pass_number] = el }}
            className="rounded border overflow-hidden transition-opacity"
            style={{
              borderColor: color + (isHovered ? 'aa' : '44'),
              opacity: isDimmed ? 0.4 : 1,
            }}
            onMouseEnter={() => focusMode && onPassHover(pass.pass_number)}
            onMouseLeave={() => focusMode && onPassHover(null)}
          >
            <div
              className="px-3 py-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: color + '18', color }}
            >
              <span>Pass {pass.pass_number}</span>
              <span className="font-mono">{pass.nx} × {pass.ny} = {pass.total_points.toLocaleString()} pts</span>
            </div>
            <div className="px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-2 bg-white dark:bg-[#252525]">
              {[
                { label: 'Start X', val: fmt(pass.start_point.x) },
                { label: 'Start Y', val: fmt(pass.start_point.y) },
                { label: 'ΔX', val: fmt(pass.delta_x) },
                { label: 'ΔY', val: fmt(pass.delta_y) },
                { label: 'Nx', val: String(pass.nx) },
                { label: 'Ny', val: String(pass.ny) },
              ].map(({ label, val }) => (
                <div key={label}>
                  <span className="text-[9px] text-gray-400 dark:text-[#666] uppercase tracking-wide block">{label}</span>
                  <span className="text-xs font-mono text-gray-800 dark:text-[#d4d4d4]">{val}</span>
                </div>
              ))}
              <div className="col-span-2 border-t border-gray-200 dark:border-[#333] pt-1.5 mt-0.5">
                <span className="text-[9px] text-gray-400 dark:text-[#666] uppercase tracking-wide block">Area</span>
                <span className="text-[11px] font-mono text-gray-600 dark:text-[#aaa]">{fmtMm2(pass.area_mm2)}</span>
              </div>
            </div>
          </div>
        )
      })}

      {/* Summary */}
      <div className="rounded border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] px-3 py-2 space-y-1.5">
        {[
          { label: 'Total points', val: result.total_points.toLocaleString() },
          { label: 'Total area', val: fmtMm2(result.total_area_mm2) },
          { label: 'Estimated time', val: fmtTime(result.estimated_time_minutes) },
        ].map(({ label, val }) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-gray-400 dark:text-[#666]">{label}</span>
            <span className="font-mono text-gray-800 dark:text-[#d4d4d4]">{val}</span>
          </div>
        ))}
        {result.requires_multiple_passes && (
          <div className="pt-1 border-t border-gray-200 dark:border-[#333] text-[10px] text-amber-600 dark:text-amber-400">
            {result.passes.length} passes — reposition stage between each pass.
          </div>
        )}
      </div>

      {/* Print button */}
      <button
        onClick={() => window.print()}
        className="w-full py-1.5 rounded border border-gray-200 dark:border-[#3a3a3a] text-gray-400 dark:text-[#666] text-xs hover:border-gray-300 dark:hover:border-[#555] hover:text-gray-600 dark:hover:text-[#999] transition-colors"
      >
        Print / Export
      </button>
    </div>
  )
}
