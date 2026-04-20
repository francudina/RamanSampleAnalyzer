import type { DrawMode, ExclusionZone } from '../../types/scan'
import Tooltip from '../UI/Tooltip'

interface Props {
  exclusionZones: ExclusionZone[]
  drawMode: DrawMode
  onDrawModeChange: (mode: DrawMode) => void
  onRemove: (id: string) => void
  onClearAll: () => void
}

const activeBtn =
  'border-red-400 bg-red-50 text-red-600 dark:border-red-500 dark:bg-red-900/30 dark:text-red-400'
const idleBtn =
  'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 ' +
  'dark:border-[#3a3a3a] dark:bg-[#2c2c2c] dark:text-[#888] dark:hover:bg-[#333] dark:hover:text-[#bbb]'

export default function ExclusionControls({
  exclusionZones,
  drawMode,
  onDrawModeChange,
  onRemove,
  onClearAll,
}: Props) {
  const isDrawing = drawMode === 'exclusion'

  return (
    <section className="space-y-3">
      {/* Draw button */}
      <Tooltip text="Draw zones over damaged areas, mounting clips, or substrate regions to skip them during scanning. Treated as holes in the sample.">
        <button
          onClick={() => onDrawModeChange(isDrawing ? 'select' : 'exclusion')}
          className={`w-full flex items-center justify-center gap-2 px-4 py-1.5 rounded border text-xs font-semibold transition-colors ${isDrawing ? activeBtn : idleBtn}`}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
            {/* Dashed polygon outline */}
            <polygon points="8,2 14,6 12,13 4,13 2,6" strokeDasharray="2.5 1.5" />
            {/* Minus / cut mark in centre */}
            <line x1="5.5" y1="8" x2="10.5" y2="8" strokeWidth="1.6" />
          </svg>
          {isDrawing ? 'Drawing… (dbl-click to close)' : 'Draw Exclusion Zone'}
        </button>
      </Tooltip>

      {isDrawing && (
        <p className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 leading-relaxed dark:text-red-400 dark:bg-red-900/20 dark:border-red-800/40">
          Click to add vertices. Double-click or click near the first point to close.
        </p>
      )}

      {/* Zone list */}
      {exclusionZones.length > 0 && (
        <div className="space-y-0.5">
          {exclusionZones.map((zone, i) => (
            <div
              key={zone.id}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-transparent hover:bg-gray-50 dark:hover:bg-[#252525] group"
            >
              <div className="w-2.5 h-2.5 rounded-sm shrink-0 bg-red-400/60 border border-red-500/50" />
              <span className="text-[10px] font-mono font-semibold text-red-500 dark:text-red-400 shrink-0">
                E{i + 1}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-[#666] flex-1">
                {zone.points.length} pts
              </span>
              <Tooltip text={`Remove exclusion zone E${i + 1}`} side="right">
                <button
                  onClick={() => onRemove(zone.id)}
                  className="text-gray-300 hover:text-red-400 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity dark:text-[#444]"
                >
                  ×
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      {/* Clear all */}
      {exclusionZones.length > 1 && (
        <Tooltip text="Remove all exclusion zones" side="right">
          <button
            onClick={onClearAll}
            className="w-full text-[10px] text-gray-400 hover:text-red-500 dark:text-[#555] dark:hover:text-red-400 py-0.5 transition-colors"
          >
            Clear all zones
          </button>
        </Tooltip>
      )}

      {exclusionZones.length === 0 && !isDrawing && null}
    </section>
  )
}
