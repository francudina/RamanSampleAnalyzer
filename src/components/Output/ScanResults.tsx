import { useEffect, useRef, useState } from 'react'
import type { ScanPass, ScanResult } from '../../types/scan'
import {
  type DisplayUnit,
  DISPLAY_UNIT_OPTIONS,
  fmtAreaDisplay,
  fmtCount,
  fmtDisplay,
  fmtMm2,
  fmtTime,
} from '../../utils/units'
import { analytics } from '../../utils/analytics'

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
    '=== Raman Scan Configuration ===',
    `Unit: ${displayUnit}`,
    '',
  ]

  result.passes.forEach((pass) => {
    lines.push(`Pass ${pass.pass_number}:`)
    lines.push(`  Start (X, Y):  ${fmt(pass.start_point.x)}  ,  ${fmt(pass.start_point.y)}`)
    lines.push(`  Step X:  ${fmt(pass.delta_x)}`)
    lines.push(`  Step Y:  ${fmt(pass.delta_y)}`)
    lines.push(`  Dots X:  ${fmtCount(pass.nx)}`)
    lines.push(`  Dots Y:  ${fmtCount(pass.ny)}`)
    lines.push(`  Points:  ${fmtCount(pass.total_points)}  (${pass.nx} cols x ${pass.ny} rows)`)
    lines.push(`  Area:  ${fmtMm2(pass.area_mm2)}`)
    lines.push('')
  })

  lines.push('─────────────────────────────────────')
  lines.push(`Total points:    ${fmtCount(result.total_points)}`)
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
  const [detailPass, setDetailPass] = useState<ScanPass | null>(null)
  const [loadingPass, setLoadingPass] = useState<number | null>(null)
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
    analytics.scanCopied()
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
        to see scan parameters here.
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-[#888]">Scan Parameters</h3>
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

      {/* Summary */}
      <div className="rounded border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] px-3 py-2 space-y-1.5">
        {[
          { label: 'Total points', val: fmtCount(result.total_points) },
          { label: 'Total area', val: fmtAreaDisplay(result.total_area_mm2 * 1e6, displayUnit) },
          { label: 'Estimated time', val: fmtTime(result.estimated_time_minutes) },
        ].map(({ label, val }) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-gray-400 dark:text-[#666]">{label}</span>
            <span className="font-mono text-gray-800 dark:text-[#d4d4d4]">{val}</span>
          </div>
        ))}
        {result.requires_multiple_passes && (
          <div className="pt-1 border-t border-gray-200 dark:border-[#333] text-[10px] text-amber-600 dark:text-amber-400">
            {result.passes.length} passes, reposition stage between each pass.
          </div>
        )}
      </div>

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
              <div className="flex items-center gap-2">
                <span className="font-mono">{fmtCount(pass.total_points)} pts</span>
                <button
                  onClick={() => {
                    setLoadingPass(pass.pass_number)
                    analytics.passDetailOpened(pass.pass_number)
                    setTimeout(() => { setDetailPass(pass); setLoadingPass(null) }, 50)
                  }}
                  className="text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide transition-colors min-w-[48px] flex items-center justify-center gap-1"
                  style={{ borderColor: color + '88', color, background: color + '18' }}
                  onMouseEnter={e => (e.currentTarget.style.background = color + '33')}
                  onMouseLeave={e => (e.currentTarget.style.background = color + '18')}
                >
                  {loadingPass === pass.pass_number ? (
                    <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="15" strokeLinecap="round"/>
                    </svg>
                  ) : 'Details'}
                </button>
              </div>
            </div>
            <div className="px-3 py-2 bg-white dark:bg-[#252525]">
              {/* Table: rows = Start/Step/Dots, cols = X/Y */}
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#666] pb-1 w-10"></th>
                    <th className="text-right text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#666] pb-1">X</th>
                    <th className="text-right text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#666] pb-1">Y</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Start', x: fmt(pass.start_point.x), y: fmt(pass.start_point.y) },
                    { label: 'Step',  x: fmt(pass.delta_x),       y: fmt(pass.delta_y)       },
                    { label: 'Dots',  x: fmtCount(pass.nx),       y: fmtCount(pass.ny)       },
                  ].map(({ label, x, y }) => (
                    <tr key={label}>
                      <td className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#666] py-0.5">{label}</td>
                      <td className="text-right font-mono text-gray-800 dark:text-[#d4d4d4] py-0.5">{x}</td>
                      <td className="text-right font-mono text-gray-800 dark:text-[#d4d4d4] py-0.5">{y}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gray-200 dark:border-[#333] pt-1.5 mt-1.5 flex justify-between text-xs">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[#666]">Area</span>
                <span className="font-mono text-gray-600 dark:text-[#aaa]">{fmtAreaDisplay(pass.area_mm2 * 1e6, displayUnit)}</span>
              </div>
            </div>
          </div>
        )
      })}

      {/* Pass dots detail modal */}
      {detailPass && (() => {
        const idx = result!.passes.indexOf(detailPass)
        const color = PASS_COLORS[idx % PASS_COLORS.length]
        const d = DISPLAY_UNIT_OPTIONS.find((o) => o.value === displayUnit)!.decimals
        const fmt = (um: number) => fmtDisplay(um, displayUnit, d)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setDetailPass(null)}
          >
            <div
              className="relative bg-white dark:bg-[#1e1e1e] rounded-lg shadow-2xl border border-gray-200 dark:border-[#333] w-[calc(100vw-2rem)] max-w-[420px] max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="px-4 py-3 flex items-center justify-between rounded-t-lg border-b border-gray-200 dark:border-[#333]"
                style={{ background: color + '18' }}
              >
                <div>
                  <span className="text-sm font-bold" style={{ color }}>Pass {detailPass.pass_number}</span>
                  <span className="ml-2 text-xs text-gray-400 dark:text-[#888]">
                    {fmtCount(detailPass.total_points)} points
                  </span>
                </div>
                <button
                  onClick={() => setDetailPass(null)}
                  className="text-gray-400 hover:text-gray-600 dark:text-[#666] dark:hover:text-[#aaa] text-lg leading-none"
                >
                  ×
                </button>
              </div>
              {/* Column headers */}
              <div className="px-4 py-1.5 grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-[#666] border-b border-gray-100 dark:border-[#2a2a2a]">
                <span>#</span>
                <span>X</span>
                <span>Y</span>
              </div>
              {/* Dots list */}
              <div className="overflow-y-auto flex-1 px-4 py-1 divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                {detailPass.grid_points.map((pt, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 py-1 text-xs font-mono text-gray-700 dark:text-[#ccc]">
                    <span className="text-gray-400 dark:text-[#555]">{i + 1}</span>
                    <span>{fmt(pt.x)}</span>
                    <span>{fmt(pt.y)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
