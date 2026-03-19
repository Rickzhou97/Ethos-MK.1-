"use client"

import { useState, useMemo, useRef } from "react"
import { INSTALL_STAGES, INSTALL_STAGE_DISPLAY_NAMES } from "@/lib/install-utils"

// ─── Types ───

type GanttTask = {
  id: string
  stage: string
  status: string
  startedAt: string | null
  completedAt: string | null
  assignedTo: string | null
  inspectionStatus: string | null
  ncrId: string | null
}

type GanttProduct = {
  partCode: string
  description: string
  quantity: number
  installTargetDate: string | null
  project: {
    projectNumber: string
    name: string
    priority: string
    siteLocation: string | null
    customer: { name: string } | null
  }
}

type ProductRow = {
  productId: string
  product: GanttProduct
  tasks: Map<string, GanttTask>
}

interface GanttChartProps {
  productRows: ProductRow[]
  onTaskAction?: (taskId: string, action: "start" | "complete" | "approve" | "reject") => void
}

// ─── Constants ───

const DAY_WIDTH = 40
const ROW_HEIGHT = 64
const HEADER_HEIGHT = 40
const LEFT_WIDTH = 280

const STAGE_COLORS: Record<string, string> = {
  PREPARATION: "#f97316",
  CIVIL_WORKS: "#3b82f6",
  LIFTING: "#8b5cf6",
  INSTALLATION: "#6366f1",
  SEALING: "#06b6d4",
  INSPECTION: "#22c55e",
}

// ─── Helpers ───

function toDay(d: Date): number {
  return Math.floor(d.getTime() / (1000 * 60 * 60 * 24))
}

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function formatDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${months[d.getMonth()]} ${d.getDate()}`
}

function formatFullDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

function isMonday(d: Date): boolean {
  return d.getDay() === 1
}

// ─── Component ───

export function GanttChart({ productRows, onTaskAction }: GanttChartProps) {
  const [tooltip, setTooltip] = useState<{
    task: GanttTask
    stage: string
    x: number
    y: number
    startDate: Date | null
    endDate: Date | null
    duration: number
  } | null>(null)
  const [actionMenuTask, setActionMenuTask] = useState<{ task: GanttTask; x: number; y: number } | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Calculate timeline bounds
  const { timelineStart, timelineEnd, totalDays, totalWidth } = useMemo(() => {
    let earliest = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
    let latest = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

    for (const row of productRows) {
      for (const [, task] of row.tasks) {
        const started = parseDate(task.startedAt)
        const completed = parseDate(task.completedAt)
        if (started && started < earliest) earliest = started
        if (completed && completed > latest) latest = completed
      }
      const target = parseDate(row.product.installTargetDate)
      if (target && target > latest) latest = target
    }

    // Add 7-day buffer
    const start = new Date(earliest.getTime() - 7 * 24 * 60 * 60 * 1000)
    start.setHours(0, 0, 0, 0)
    const end = new Date(latest.getTime() + 7 * 24 * 60 * 60 * 1000)
    end.setHours(0, 0, 0, 0)

    const days = daysBetween(start, end)
    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: days,
      totalWidth: days * DAY_WIDTH,
    }
  }, [productRows, today])

  // Get x position for a date
  function dateToX(d: Date): number {
    return daysBetween(timelineStart, d) * DAY_WIDTH
  }

  // Build date labels (every 3 days)
  const dateLabels = useMemo(() => {
    const labels: Array<{ date: Date; x: number; label: string }> = []
    const d = new Date(timelineStart)
    for (let i = 0; i < totalDays; i++) {
      if (i % 3 === 0) {
        labels.push({ date: new Date(d), x: i * DAY_WIDTH, label: formatDate(d) })
      }
      d.setDate(d.getDate() + 1)
    }
    return labels
  }, [timelineStart, totalDays])

  // Build day columns for grid lines and weekend shading
  const dayColumns = useMemo(() => {
    const cols: Array<{ date: Date; x: number; weekend: boolean; monday: boolean }> = []
    const d = new Date(timelineStart)
    for (let i = 0; i < totalDays; i++) {
      cols.push({
        date: new Date(d),
        x: i * DAY_WIDTH,
        weekend: isWeekend(d),
        monday: isMonday(d),
      })
      d.setDate(d.getDate() + 1)
    }
    return cols
  }, [timelineStart, totalDays])

  const todayX = dateToX(today)

  // Calculate bar position for a task
  function getBarInfo(task: GanttTask, row: ProductRow): { left: number; width: number; animated: boolean; pending: boolean; rework: boolean; inspectPending: boolean } | null {
    const started = parseDate(task.startedAt)
    const completed = parseDate(task.completedAt)

    if (task.status === "COMPLETED" || task.status === "IN_PROGRESS") {
      if (!started) return null
      const left = dateToX(started)
      let endDate: Date
      if (completed) {
        endDate = completed
      } else {
        // IN_PROGRESS - extends to today
        endDate = today
      }
      const width = Math.max(daysBetween(started, endDate), 1) * DAY_WIDTH
      return {
        left,
        width,
        animated: task.status === "IN_PROGRESS",
        pending: false,
        rework: false,
        inspectPending: task.status === "COMPLETED" && task.inspectionStatus === "PENDING",
      }
    }

    if (task.status === "REWORK") {
      // Similar to IN_PROGRESS but with rework flag
      const reworkStart = started || today
      const left = dateToX(reworkStart)
      const width = Math.max(1, 2) * DAY_WIDTH
      return { left, width, animated: false, pending: false, rework: true, inspectPending: false }
    }

    if (task.status === "PENDING") {
      // Estimate position based on last completed task
      const stageIdx = INSTALL_STAGES.indexOf(task.stage as any)
      let estimateStart = today

      // Look for the previous completed stage
      for (let i = stageIdx - 1; i >= 0; i--) {
        const prevTask = row.tasks.get(INSTALL_STAGES[i])
        if (prevTask) {
          const prevEnd = parseDate(prevTask.completedAt)
          if (prevEnd) {
            estimateStart = prevEnd
            break
          }
          if (prevTask.status === "IN_PROGRESS") {
            estimateStart = today
            break
          }
        }
      }

      const left = dateToX(estimateStart)
      const width = 2 * DAY_WIDTH // 2-day default duration
      return { left, width, animated: false, pending: true, rework: false, inspectPending: false }
    }

    return null
  }

  // Target date indicator color
  function getTargetColor(targetDate: string | null): string {
    if (!targetDate) return "#9ca3af"
    const target = new Date(targetDate)
    const diffDays = daysBetween(today, target)
    if (diffDays < 0) return "#ef4444" // past due - red
    if (diffDays <= 7) return "#f59e0b" // within 7 days - amber
    return "#9ca3af" // gray
  }

  function handleBarClick(e: React.MouseEvent, task: GanttTask) {
    if (!onTaskAction) return
    e.stopPropagation()

    if (task.status === "PENDING" || task.status === "REWORK") {
      onTaskAction(task.id, "start")
    } else if (task.status === "IN_PROGRESS") {
      onTaskAction(task.id, "complete")
    } else if (task.status === "COMPLETED" && task.inspectionStatus === "PENDING") {
      // Show approve/reject menu
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setActionMenuTask({ task, x: rect.left, y: rect.bottom + 4 })
    }
  }

  function handleBarHover(e: React.MouseEvent, task: GanttTask, stage: string) {
    const started = parseDate(task.startedAt)
    const completed = parseDate(task.completedAt)
    const dur = started
      ? daysBetween(started, completed || today)
      : 0
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const containerRect = timelineRef.current?.getBoundingClientRect()
    setTooltip({
      task,
      stage,
      x: rect.left - (containerRect?.left || 0) + rect.width / 2,
      y: rect.top - (containerRect?.top || 0) - 8,
      startDate: started,
      endDate: completed,
      duration: Math.max(dur, 0),
    })
  }

  if (productRows.length === 0) {
    return (
      <div className="text-center text-gray-400 py-16 border rounded-lg bg-white">
        No tasks assigned to this crew
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex border rounded-lg overflow-hidden bg-white">
        {/* Left: Fixed product labels */}
        <div className="shrink-0 border-r bg-white z-10" style={{ width: LEFT_WIDTH }}>
          {/* Header */}
          <div
            className="border-b bg-gray-50 px-3 flex items-center font-semibold text-xs text-gray-600 uppercase tracking-wider"
            style={{ height: HEADER_HEIGHT }}
          >
            Product
          </div>
          {/* Rows */}
          {productRows.map((row) => (
            <div
              key={row.productId}
              className="border-b px-3 flex flex-col justify-center"
              style={{ height: ROW_HEIGHT }}
            >
              <span className="font-medium text-sm text-gray-900 truncate leading-tight">
                {row.product.description}
              </span>
              <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                {row.product.partCode}
              </span>
              <span className="text-[10px] text-gray-400 truncate mt-0.5">
                {row.product.project.projectNumber} &mdash; {row.product.project.name}
              </span>
            </div>
          ))}
        </div>

        {/* Right: Scrollable timeline */}
        <div className="flex-1 overflow-x-auto" ref={timelineRef}>
          <div style={{ width: totalWidth, position: "relative" }}>
            {/* Date header */}
            <div
              className="border-b bg-gray-50 relative"
              style={{ height: HEADER_HEIGHT, width: totalWidth }}
            >
              {dateLabels.map((lbl, i) => (
                <div
                  key={i}
                  className="absolute text-[10px] text-gray-500 font-medium whitespace-nowrap"
                  style={{ left: lbl.x + 2, top: "50%", transform: "translateY(-50%)" }}
                >
                  {lbl.label}
                </div>
              ))}
              {/* Today label in header */}
              <div
                className="absolute text-[10px] font-bold text-red-500 whitespace-nowrap"
                style={{ left: todayX - 12, top: 2 }}
              >
                Today
              </div>
            </div>

            {/* Row area with grid lines */}
            <div style={{ position: "relative" }}>
              {/* Weekend shading and grid lines (behind everything) */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ height: productRows.length * ROW_HEIGHT }}
              >
                {dayColumns.map((col, i) => (
                  <div key={i}>
                    {/* Weekend shading */}
                    {col.weekend && (
                      <div
                        className="absolute top-0 bottom-0"
                        style={{
                          left: col.x,
                          width: DAY_WIDTH,
                          height: productRows.length * ROW_HEIGHT,
                          backgroundColor: "rgba(0,0,0,0.02)",
                        }}
                      />
                    )}
                    {/* Grid line */}
                    <div
                      className="absolute top-0"
                      style={{
                        left: col.x,
                        width: 1,
                        height: productRows.length * ROW_HEIGHT,
                        backgroundColor: col.monday ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.04)",
                      }}
                    />
                  </div>
                ))}

                {/* Today marker line */}
                <div
                  className="absolute top-0"
                  style={{
                    left: todayX,
                    width: 2,
                    height: productRows.length * ROW_HEIGHT,
                    borderLeft: "2px dashed #ef4444",
                  }}
                />
              </div>

              {/* Product rows */}
              {productRows.map((row) => (
                <div
                  key={row.productId}
                  className="border-b relative"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Stage bars */}
                  {INSTALL_STAGES.map((stage) => {
                    const task = row.tasks.get(stage)
                    if (!task) return null
                    const bar = getBarInfo(task, row)
                    if (!bar) return null

                    const color = STAGE_COLORS[stage] || "#6b7280"
                    const isClickable = onTaskAction && (
                      task.status === "PENDING" ||
                      task.status === "REWORK" ||
                      task.status === "IN_PROGRESS" ||
                      (task.status === "COMPLETED" && task.inspectionStatus === "PENDING")
                    )

                    return (
                      <div
                        key={stage}
                        className="absolute rounded transition-opacity"
                        style={{
                          left: bar.left,
                          width: Math.max(bar.width, DAY_WIDTH * 0.5),
                          top: 12,
                          height: 32,
                          backgroundColor: color,
                          opacity: bar.pending ? 0.3 : 1,
                          border: bar.pending
                            ? `2px dashed ${color}`
                            : bar.rework
                            ? "2px solid #ef4444"
                            : bar.inspectPending
                            ? `2px solid ${color}`
                            : "none",
                          borderRight: bar.inspectPending ? "4px solid #22c55e" : undefined,
                          cursor: isClickable ? "pointer" : "default",
                          backgroundImage: bar.animated
                            ? `repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.2) 6px, rgba(255,255,255,0.2) 12px)`
                            : undefined,
                          animation: bar.animated ? "gantt-pulse 2s ease-in-out infinite" : undefined,
                          zIndex: 2,
                        }}
                        onClick={(e) => handleBarClick(e, task)}
                        onMouseEnter={(e) => handleBarHover(e, task, stage)}
                        onMouseLeave={() => setTooltip(null)}
                        title={`${INSTALL_STAGE_DISPLAY_NAMES[stage]} - ${task.status}`}
                      >
                        {/* Stage label inside bar if wide enough */}
                        {bar.width >= DAY_WIDTH * 2 && (
                          <div
                            className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-semibold truncate px-1"
                            style={{ pointerEvents: "none" }}
                          >
                            {INSTALL_STAGE_DISPLAY_NAMES[stage]}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Target date marker */}
                  {row.product.installTargetDate && (() => {
                    const target = parseDate(row.product.installTargetDate)
                    if (!target) return null
                    const x = dateToX(target)
                    const markerColor = getTargetColor(row.product.installTargetDate)
                    return (
                      <div
                        key="target"
                        className="absolute"
                        style={{
                          left: x - 6,
                          top: ROW_HEIGHT / 2 - 6,
                          width: 12,
                          height: 12,
                          zIndex: 3,
                        }}
                        title={`Target: ${formatFullDate(target)}`}
                      >
                        <svg viewBox="0 0 12 12" width="12" height="12">
                          <polygon
                            points="6,0 12,6 6,12 0,6"
                            fill="white"
                            stroke={markerColor}
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white rounded-lg shadow-xl px-3 py-2 text-xs pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-semibold mb-1">{INSTALL_STAGE_DISPLAY_NAMES[tooltip.stage] || tooltip.stage}</div>
          <div className="space-y-0.5 text-gray-300">
            <div>Status: <span className="text-white">{tooltip.task.status}{tooltip.task.inspectionStatus ? ` (${tooltip.task.inspectionStatus})` : ""}</span></div>
            <div>Started: <span className="text-white">{tooltip.startDate ? formatFullDate(tooltip.startDate) : "Not started"}</span></div>
            <div>Completed: <span className="text-white">{tooltip.endDate ? formatFullDate(tooltip.endDate) : tooltip.task.status === "IN_PROGRESS" ? "In progress" : "—"}</span></div>
            {tooltip.duration > 0 && (
              <div>Duration: <span className="text-white">{tooltip.duration} day{tooltip.duration !== 1 ? "s" : ""}</span></div>
            )}
            {tooltip.task.assignedTo && (
              <div>Assigned: <span className="text-white">{tooltip.task.assignedTo}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Action menu for inspect */}
      {actionMenuTask && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setActionMenuTask(null)} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[140px]"
            style={{ left: actionMenuTask.x, top: actionMenuTask.y }}
          >
            <button
              onClick={() => {
                onTaskAction?.(actionMenuTask.task.id, "approve")
                setActionMenuTask(null)
              }}
              className="w-full text-left px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 rounded-md"
            >
              Approve
            </button>
            <button
              onClick={() => {
                onTaskAction?.(actionMenuTask.task.id, "reject")
                setActionMenuTask(null)
              }}
              className="w-full text-left px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md"
            >
              Reject (NCR)
            </button>
          </div>
        </>
      )}

      {/* Stage legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 px-1">
        {INSTALL_STAGES.map((stage) => (
          <div key={stage} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: STAGE_COLORS[stage] }}
            />
            <span className="text-[10px] text-gray-500">{INSTALL_STAGE_DISPLAY_NAMES[stage]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-200">
          <svg viewBox="0 0 12 12" width="10" height="10">
            <polygon points="6,0 12,6 6,12 0,6" fill="white" stroke="#9ca3af" strokeWidth="2" />
          </svg>
          <span className="text-[10px] text-gray-500">Target date</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0 border-t-2 border-dashed border-red-400" />
          <span className="text-[10px] text-gray-500">Today</span>
        </div>
      </div>

      {/* CSS animation */}
      <style jsx>{`
        @keyframes gantt-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
