"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { PROJECT_COLOR_PALETTE } from "@/lib/production-utils"
import { Grid3X3, Loader2, Minus, Plus, RefreshCw, X, CheckCircle2, TrendingDown, TrendingUp, Minus as MinusIcon } from "lucide-react"

// ─── Reschedule types ────────────────────────────────────────────────────────

type RescheduleChange = {
  projectId: string
  projectNumber: string
  projectName: string
  isICU: boolean
  deadline: string | null
  currentEnd: string
  optimisedEnd: string
  deltaDays: number
  meetsDeadline: boolean
}

type ReschedulePreview = {
  applied: boolean
  algorithm: string
  totalProjects: number
  improvedCount: number
  degradedCount: number
  changes: RescheduleChange[]
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
}

// ─── Types ──────────────────────────────────────────────

type CellEntry = {
  blockId: string
  productId: string
  projectId: string
  label: string
  colorIndex: number
  projectNumber: string
  productDesc: string
  isBlockStart: boolean
  isBlockEnd: boolean
}

type StageColumn = {
  stageId: string
  stageLabel: string
  stations: Array<{ stationIdx: number; label: string; designerId?: string }>
}

type EndMarker = {
  projectId: string
  projectNumber: string
  colorIndex: number
}

type GridRow = {
  date: string
  label: string
  dayName: string
  isToday: boolean
  isWeekend: boolean
  isMonday: boolean
  cells: Record<string, CellEntry[][]> // stageId → station[] → entries[]
  endMarkers: EndMarker[]
}

type LegendEntry = {
  projectId: string
  projectNumber: string
  projectName: string
  customerName: string
  colorIndex: number
  isICU: boolean
  deadline: string | null
  products: Array<{ label: string; partCode: string; desc: string }>
}

type GridData = {
  rows: GridRow[]
  stages: StageColumn[]
  legend: LegendEntry[]
  todayIndex: number
}

type DragInfo = {
  blockId: string
  productId: string
  stage: string
  stationIdx: number
  sourceDate: string
}

// ─── Page Component ─────────────────────────────────────

export default function ProductionGridPage() {
  const [horizonDays, setHorizonDays] = useState("60")
  const [data, setData] = useState<GridData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null)
  const [dropTarget, setDropTarget] = useState<{ date: string; stage: string; stationIdx: number } | null>(null)
  const todayRowRef = useRef<HTMLTableRowElement>(null)

  // ─── Reschedule state ──────────────────────────────────────────
  const [rescheduling, setRescheduling] = useState(false)
  const [preview, setPreview] = useState<ReschedulePreview | null>(null)
  const [applying, setApplying] = useState(false)
  const [applySuccess, setApplySuccess] = useState(false)

  // Adjustable cell dimensions
  const [cellWidth, setCellWidth] = useState(90)
  const [rowHeight, setRowHeight] = useState(44)

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch(`/api/planning/aggregated?days=${horizonDays}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [horizonDays])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!loading && todayRowRef.current) {
      todayRowRef.current.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }, [loading, data])

  // ─── Drag & Drop handlers ──────────────────────────────

  function handleDragStart(e: React.DragEvent, entry: CellEntry, stage: string, stationIdx: number, date: string) {
    setDragInfo({
      blockId: entry.blockId,
      productId: entry.productId,
      stage,
      stationIdx,
      sourceDate: date,
    })
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", entry.blockId)
  }

  function handleDragOver(e: React.DragEvent, date: string, stage: string, stationIdx: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTarget({ date, stage, stationIdx })
  }

  function handleDragLeave() {
    setDropTarget(null)
  }

  async function handleDrop(e: React.DragEvent, targetDate: string, targetStage: string, targetStationIdx: number) {
    e.preventDefault()
    setDropTarget(null)

    if (!dragInfo) return

    const stageCol = data?.stages.find(s => s.stageId === targetStage)
    const designerId = stageCol?.stations[targetStationIdx]?.designerId

    // Call PATCH API to persist
    try {
      await fetch("/api/planning/aggregated/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: dragInfo.productId,
          stage: targetStage,
          newStartDate: targetDate,
          newStationIdx: targetStationIdx,
          designerId,
        }),
      })
      fetchData()
    } catch {
      // silently fail
    }

    setDragInfo(null)
  }

  function handleDragEnd() {
    setDragInfo(null)
    setDropTarget(null)
  }

  // ─── Reschedule handlers ────────────────────────────────────────

  async function handleReschedule() {
    setRescheduling(true)
    setApplySuccess(false)
    try {
      const res = await fetch("/api/planning/aggregated/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: false }),
      })
      const data: ReschedulePreview = await res.json()
      setPreview(data)
    } finally {
      setRescheduling(false)
    }
  }

  async function handleApplySchedule() {
    setApplying(true)
    try {
      await fetch("/api/planning/aggregated/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true }),
      })
      setPreview(null)
      setApplySuccess(true)
      fetchData()   // reload grid with new anchors
    } finally {
      setApplying(false)
    }
  }

  // Total station columns
  const totalStationCols = data?.stages.reduce(
    (sum, s) => sum + s.stations.length, 0
  ) || 0

  // Find the index of Design stage for the blue divider
  const designStageIdx = data?.stages.findIndex(s => s.stageId === "DESIGN") ?? -1

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Grid3X3 className="h-6 w-6 text-blue-600" />
            Production Grid
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Daily schedule — drag blocks to reschedule
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Size controls */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="whitespace-nowrap">Width</span>
            <Button variant="outline" size="icon-xs" onClick={() => setCellWidth(w => Math.max(60, w - 10))}>
              <Minus className="h-3 w-3" />
            </Button>
            <input
              type="range"
              value={cellWidth}
              onChange={e => setCellWidth(Number(e.target.value))}
              min={60}
              max={160}
              step={5}
              className="w-20 h-1 accent-blue-500"
            />
            <Button variant="outline" size="icon-xs" onClick={() => setCellWidth(w => Math.min(160, w + 10))}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="whitespace-nowrap">Height</span>
            <Button variant="outline" size="icon-xs" onClick={() => setRowHeight(h => Math.max(28, h - 4))}>
              <Minus className="h-3 w-3" />
            </Button>
            <input
              type="range"
              value={rowHeight}
              onChange={e => setRowHeight(Number(e.target.value))}
              min={28}
              max={80}
              step={2}
              className="w-20 h-1 accent-blue-500"
            />
            <Button variant="outline" size="icon-xs" onClick={() => setRowHeight(h => Math.min(80, h + 4))}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <Select value={horizonDays} onValueChange={setHorizonDays}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="120">120 days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleReschedule}
            disabled={rescheduling || loading}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 h-auto"
            title="Re-optimise schedule using Minimum Slack First (MSF) algorithm"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", rescheduling && "animate-spin")} />
            {rescheduling ? "Optimising…" : "Reschedule"}
          </Button>

          {applySuccess && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium whitespace-nowrap">
              <CheckCircle2 className="h-3.5 w-3.5" /> Applied
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            Failed to load schedule data
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Legend */}
          <ProjectLegend legend={data.legend} />

          {/* Grid Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[82vh]">
                <table className="border-collapse text-xs">
                  <thead className="sticky top-0 z-20">
                    {/* Level 1: Process names */}
                    <tr className="bg-gray-100 border-b border-border">
                      <th
                        className="sticky left-0 z-30 bg-gray-100 min-w-[120px] border-r border-border"
                        rowSpan={2}
                      >
                        <div className="px-2 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">
                          Date
                        </div>
                      </th>
                      {data.stages.map((stage, stageIdx) => (
                        <th
                          key={stage.stageId}
                          colSpan={stage.stations.length}
                          className={cn(
                            "px-0 py-2 text-center",
                            stageIdx === designStageIdx + 1
                              ? "border-l-[3px] border-l-blue-500"
                              : "",
                            "border-r border-border/60",
                          )}
                        >
                          <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
                            {stage.stageLabel}
                          </div>
                        </th>
                      ))}
                      {/* End Date column header */}
                      <th
                        className="px-2 py-2 text-center border-l-[3px] border-l-green-500 min-w-[100px]"
                        rowSpan={2}
                      >
                        <div className="text-[11px] font-semibold text-green-700 uppercase tracking-wider">
                          End Date
                        </div>
                      </th>
                    </tr>
                    {/* Level 2: Station / designer labels */}
                    <tr className="bg-gray-50 border-b border-border">
                      {data.stages.flatMap((stage, stageIdx) =>
                        stage.stations.map((stn, si) => {
                          const isFirstOfProductionDept = stageIdx === designStageIdx + 1 && si === 0
                          const isLastInStage = si === stage.stations.length - 1
                          return (
                            <th
                              key={`${stage.stageId}-${stn.stationIdx}`}
                              className={cn(
                                "px-0 py-1.5 text-center text-[10px] font-medium text-gray-500",
                                isFirstOfProductionDept
                                  ? "border-l-[3px] border-l-blue-500"
                                  : "",
                                isLastInStage
                                  ? "border-r border-border/60"
                                  : "border-r border-border/20",
                              )}
                              style={{ minWidth: `${cellWidth}px`, width: `${cellWidth}px` }}
                              title={stage.stageId === "DESIGN" ? `Designer: ${stn.label}` : stn.label}
                            >
                              {stn.label}
                            </th>
                          )
                        })
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {data.rows.map((row) => (
                      <tr
                        key={row.date}
                        ref={row.isToday ? todayRowRef : undefined}
                        className={cn(
                          "border-b",
                          row.isToday
                            ? "bg-blue-50 border-blue-200"
                            : row.isWeekend
                              ? "bg-gray-50/70 border-border/20"
                              : row.isMonday
                                ? "border-border/60"
                                : "border-border/20"
                        )}
                        style={{ minHeight: `${rowHeight}px` }}
                      >
                        {/* Date cell */}
                        <td
                          className={cn(
                            "sticky left-0 z-10 px-2 py-0.5 border-r border-border whitespace-nowrap",
                            row.isToday
                              ? "bg-blue-100 font-bold text-blue-800"
                              : row.isWeekend
                                ? "bg-gray-100 text-gray-400"
                                : "bg-white text-gray-600"
                          )}
                        >
                          <span className="text-[11px]">
                            <span className={cn("inline-block w-[28px]", row.isWeekend && "text-gray-400")}>
                              {row.dayName}
                            </span>
                            {" "}{row.label}
                          </span>
                          {row.isToday && (
                            <span className="ml-1 text-[8px] bg-blue-600 text-white px-1 py-px rounded font-bold">
                              TODAY
                            </span>
                          )}
                        </td>

                        {/* Station cells */}
                        {data.stages.flatMap((stage, stageIdx) =>
                          stage.stations.map((stn, si) => {
                            const entries = row.cells[stage.stageId]?.[stn.stationIdx] || []
                            const isLastInStage = si === stage.stations.length - 1
                            const isFirstOfProductionDept = stageIdx === designStageIdx + 1 && si === 0
                            const isDropHere = dropTarget?.date === row.date
                              && dropTarget?.stage === stage.stageId
                              && dropTarget?.stationIdx === stn.stationIdx

                            return (
                              <td
                                key={`${stage.stageId}-${stn.stationIdx}`}
                                className={cn(
                                  "px-0 py-0 relative align-top",
                                  isFirstOfProductionDept
                                    ? "border-l-[3px] border-l-blue-500"
                                    : "",
                                  isLastInStage ? "border-r border-border/60" : "border-r border-border/10",
                                  row.isToday && entries.length === 0 && "bg-blue-50/40",
                                  row.isWeekend && entries.length === 0 && "bg-gray-50/40",
                                  isDropHere && "ring-2 ring-inset ring-blue-400 bg-blue-100/50",
                                )}
                                style={{ minWidth: `${cellWidth}px`, width: `${cellWidth}px` }}
                                onDragOver={e => handleDragOver(e, row.date, stage.stageId, stn.stationIdx)}
                                onDragLeave={handleDragLeave}
                                onDrop={e => handleDrop(e, row.date, stage.stageId, stn.stationIdx)}
                              >
                                <div className="flex flex-col gap-px py-px">
                                  {entries.map((entry, ei) => {
                                    const color = PROJECT_COLOR_PALETTE[entry.colorIndex % PROJECT_COLOR_PALETTE.length]
                                    const isDragging = dragInfo?.blockId === entry.blockId
                                    return (
                                      <div
                                        key={`${entry.productId}-${ei}`}
                                        draggable
                                        onDragStart={e => handleDragStart(e, entry, stage.stageId, stn.stationIdx, row.date)}
                                        onDragEnd={handleDragEnd}
                                        className={cn(
                                          "mx-0.5 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing leading-tight select-none overflow-hidden py-0.5",
                                          color.bg,
                                          color.text,
                                          isDragging && "opacity-40",
                                          entry.isBlockStart && entry.isBlockEnd && "rounded-sm",
                                          entry.isBlockStart && !entry.isBlockEnd && "rounded-t-sm",
                                          !entry.isBlockStart && entry.isBlockEnd && "rounded-b-sm",
                                        )}
                                        title={`${entry.projectNumber} — ${entry.label} — ${entry.productDesc}`}
                                      >
                                        <span className="text-[10px] font-bold truncate w-full text-center px-0.5 leading-tight">
                                          {entry.projectNumber}
                                        </span>
                                        <span className="text-[9px] font-semibold opacity-80 truncate w-full text-center px-0.5 leading-tight">
                                          {entry.label}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </td>
                            )
                          })
                        )}

                        {/* End Date column */}
                        <td className="px-1 py-0 border-l-[3px] border-l-green-500 align-top">
                          {row.endMarkers.length > 0 && (
                            <div className="flex flex-col gap-px py-px">
                              {row.endMarkers.map(marker => {
                                const color = PROJECT_COLOR_PALETTE[marker.colorIndex % PROJECT_COLOR_PALETTE.length]
                                return (
                                  <div
                                    key={marker.projectId}
                                    className={cn(
                                      "rounded-sm px-1.5 py-1 text-center font-bold text-[10px] truncate",
                                      color.bg,
                                      color.text,
                                    )}
                                    title={`${marker.projectNumber} finishes`}
                                  >
                                    {marker.projectNumber}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}

                    {data.rows.length === 0 && (
                      <tr>
                        <td colSpan={2 + totalStationCols} className="text-center py-12 text-gray-400">
                          No products to schedule
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
      {/* ─── Reschedule Preview Modal ───────────────────────────────────── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden border border-gray-200">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Reschedule Preview</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Algorithm: <span className="font-medium text-blue-600">{preview.algorithm}</span>
                  {" · "}sort by <em>slack = deadline − remaining work</em> (least slack first)
                </p>
              </div>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-700 transition-colors mt-0.5">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Summary strip */}
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-6 bg-white text-xs text-gray-600">
              <span><strong className="text-gray-900">{preview.totalProjects}</strong> projects compared</span>
              {preview.improvedCount > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <TrendingDown className="h-3.5 w-3.5" />
                  <strong>{preview.improvedCount}</strong> finish earlier
                </span>
              )}
              {preview.degradedCount > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <strong>{preview.degradedCount}</strong> finish later
                </span>
              )}
              {preview.improvedCount === 0 && preview.degradedCount === 0 && (
                <span className="flex items-center gap-1 text-gray-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Schedule is already optimal
                </span>
              )}
            </div>

            {/* Table */}
            <div className="px-6 py-4 max-h-[55vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    {["Project", "Deadline", "Current End", "Optimised End", "Δ Days"].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 text-[10px] text-gray-400 uppercase font-semibold tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.changes.map(c => (
                    <tr key={c.projectId} className="hover:bg-gray-50/60">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-1.5">
                          {c.isICU && <span className="text-[8px] bg-red-100 text-red-700 px-1 py-px rounded font-bold">ICU</span>}
                          <span className="font-semibold text-gray-900">{c.projectNumber}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[140px]">{c.projectName}</div>
                      </td>
                      <td className={cn("py-2.5 pr-4 font-mono text-[11px]", !c.meetsDeadline ? "text-red-500" : "text-gray-500")}>
                        {fmtDate(c.deadline)}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-[11px] text-gray-500">{fmtDate(c.currentEnd)}</td>
                      <td className={cn(
                        "py-2.5 pr-4 font-mono text-[11px] font-medium",
                        c.deltaDays > 0 ? "text-green-600" : c.deltaDays < 0 ? "text-red-500" : "text-gray-400"
                      )}>
                        {fmtDate(c.optimisedEnd)}
                      </td>
                      <td className="py-2.5">
                        {c.deltaDays === 0 ? (
                          <span className="flex items-center gap-0.5 text-gray-300 text-[10px]">
                            <MinusIcon className="h-3 w-3" /> same
                          </span>
                        ) : c.deltaDays > 0 ? (
                          <span className="flex items-center gap-0.5 text-green-600 font-semibold text-[11px]">
                            <TrendingDown className="h-3 w-3" /> -{c.deltaDays}d
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-red-500 font-semibold text-[11px]">
                            <TrendingUp className="h-3 w-3" /> +{Math.abs(c.deltaDays)}d
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <p className="text-[10px] text-gray-400 max-w-[420px]">
                Applying writes planned-start anchors to the database. The grid reloads using the optimised order.
                Drag-and-drop overrides are preserved for individual products you manually adjusted.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreview(null)} className="text-xs">
                  Cancel
                </Button>
                {(preview.improvedCount > 0 || preview.degradedCount === 0) && (
                  <Button
                    onClick={handleApplySchedule}
                    disabled={applying}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 h-8"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", applying && "animate-spin")} />
                    {applying ? "Applying…" : "Apply Schedule"}
                  </Button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

// ─── Legend ──────────────────────────────────────────────

function ProjectLegend({ legend }: { legend: LegendEntry[] }) {
  if (legend.length === 0) return null

  return (
    <Card>
      <CardContent className="px-3 py-2">
        <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Project Legend
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {legend.map(entry => {
            const color = PROJECT_COLOR_PALETTE[entry.colorIndex % PROJECT_COLOR_PALETTE.length]
            return (
              <div key={entry.projectId} className="flex items-center gap-1.5 text-[11px]">
                <div
                  className={cn(
                    "w-5 h-4 rounded-sm flex items-center justify-center text-[7px] font-bold",
                    color.bg,
                    color.text,
                  )}
                >
                  {entry.products.length}
                </div>
                <span className="font-medium text-gray-800">
                  {entry.projectNumber}
                </span>
                <span className="text-gray-400 max-w-[120px] truncate">
                  {entry.projectName}
                </span>
                {entry.isICU && (
                  <Badge className="bg-red-100 text-red-700 text-[7px] px-1 py-0">ICU</Badge>
                )}
                <span className="text-[9px] text-gray-300">
                  {entry.products.length} product{entry.products.length !== 1 ? "s" : ""}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
