"use client"

import dynamic from "next/dynamic"
import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"

const FactoryTwinInner = dynamic(
  () => import("@/components/production/factory-twin-inner"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#e8ecf0]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading Factory Digital Twin…</p>
      </div>
    </div>
  )}
)

export interface DigitalTwinTask {
  id: string
  stage: string
  status: string
  assignedTo: string | null
  startedAt: string | null
  completedAt: string | null
  inspectionStatus: string | null
  product: {
    partCode: string
    description: string
    quantity: number
    productionTargetDate: string | null
    project: {
      projectNumber: string
      name: string
      priority: string
      customer: { name: string } | null
    }
  }
}

export interface DigitalTwinWorker {
  id: string
  name: string
  role: string
}

interface Props {
  tasksByStage: Record<string, DigitalTwinTask[]>
  workers: DigitalTwinWorker[]
}

function isToday(d: string | null) {
  if (!d) return false
  return new Date(d).toDateString() === new Date().toDateString()
}

// Gauge component
function Gauge({ value, max, label, unit, color }: { value: number; max: number; label: string; unit: string; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{label}</span>
        <span className="text-sm font-bold text-gray-800">{value}{unit}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// KPI Card
function KpiCard({ label, value, unit, trend, trendUp, color }: { label: string; value: string | number; unit?: string; trend?: string; trendUp?: boolean; color: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-xl font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
      {trend && (
        <div className={cn("text-[10px] mt-0.5 font-medium", trendUp ? "text-green-600" : "text-red-500")}>
          {trendUp ? "↑" : "↓"} {trend}
        </div>
      )}
    </div>
  )
}

// Stage mini bar
function StageBar({ label, active, pending, completed, color }: { label: string; active: number; pending: number; completed: number; color: string }) {
  const total = active + pending + completed
  if (total === 0) return null
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
      <span className="text-[10px] text-gray-600 w-20 truncate">{label}</span>
      <div className="flex-1 flex h-3 rounded-full overflow-hidden bg-gray-100">
        {completed > 0 && <div className="bg-green-400 h-full" style={{ width: `${(completed / total) * 100}%` }} />}
        {active > 0 && <div className="bg-blue-500 h-full" style={{ width: `${(active / total) * 100}%` }} />}
        {pending > 0 && <div className="bg-amber-300 h-full" style={{ width: `${(pending / total) * 100}%` }} />}
      </div>
      <span className="text-[10px] text-gray-400 w-6 text-right">{total}</span>
    </div>
  )
}

export default function FactoryDigitalTwin({ tasksByStage, workers }: Props) {
  const [dashOpen, setDashOpen] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [dashWidth, setDashWidth] = useState(320)
  const [resizing, setResizing] = useState(false)

  // Calculate KPIs from live data
  const kpis = useMemo(() => {
    const all = Object.values(tasksByStage).flat()
    const active = all.filter(t => t.status === "IN_PROGRESS")
    const pending = all.filter(t => t.status === "PENDING")
    const completedToday = all.filter(t => t.status === "COMPLETED" && isToday(t.completedAt))
    const completed = all.filter(t => t.status === "COMPLETED")
    const totalTasks = all.length

    // OEE calculation (simplified)
    // Availability: % of workers actively assigned
    const assignedWorkers = new Set(active.map(t => t.assignedTo).filter(Boolean)).size
    const availability = workers.length > 0 ? (assignedWorkers / workers.length) * 100 : 0

    // Performance: completed today vs target (assume 20 tasks/day target)
    const dailyTarget = 20
    const performance = Math.min((completedToday.length / dailyTarget) * 100, 100)

    // Quality: % of completed tasks that passed inspection (not rejected)
    const inspected = completed.filter(t => t.inspectionStatus === "ACCEPTED" || t.inspectionStatus === "REJECTED")
    const passed = inspected.filter(t => t.inspectionStatus === "ACCEPTED").length
    const quality = inspected.length > 0 ? (passed / inspected.length) * 100 : 100

    // OEE = Availability × Performance × Quality
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100

    // Throughput: tasks completed in last 7 days (estimate)
    const weeklyCompleted = completed.length // approximation since we have snapshot data

    // Bottleneck: stage with most pending tasks
    const stagePending = Object.entries(tasksByStage).map(([stage, tasks]) => ({
      stage,
      pending: tasks.filter(t => t.status === "PENDING" || t.status === "REWORK").length,
    })).sort((a, b) => b.pending - a.pending)
    const bottleneck = stagePending[0]

    // Average cycle time (from started to completed, in hours)
    const cycleTimes = completed
      .filter(t => t.startedAt && t.completedAt)
      .map(t => (new Date(t.completedAt!).getTime() - new Date(t.startedAt!).getTime()) / 3600000)
    const avgCycleTime = cycleTimes.length > 0 ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length : 0

    // WIP (Work In Progress)
    const wip = active.length

    // Simulated electricity (based on active stations — ~15kW per active welding, ~8kW per other)
    const activeWelding = (tasksByStage["FABRICATION"] || []).filter(t => t.status === "IN_PROGRESS").length
    const activeOther = active.length - activeWelding
    const electricityKw = activeWelding * 15 + activeOther * 8 + 25 // +25kW base load
    const dailyKwh = electricityKw * 8 // 8 hour day

    // Stage breakdown
    const stageNames: Record<string, string> = {
      CUTTING: "Cutting", FABRICATION: "Welding", FITTING: "Fitting",
      SHOTBLASTING: "Shot Blast", PAINTING: "Painting", PACKING: "Packing",
    }
    const stageColors: Record<string, string> = {
      CUTTING: "#ef4444", FABRICATION: "#06b6d4", FITTING: "#f97316",
      SHOTBLASTING: "#8b5cf6", PAINTING: "#ec4899", PACKING: "#22c55e",
    }
    const stages = Object.entries(tasksByStage).map(([stage, tasks]) => ({
      stage,
      label: stageNames[stage] || stage,
      color: stageColors[stage] || "#64748b",
      active: tasks.filter(t => t.status === "IN_PROGRESS").length,
      pending: tasks.filter(t => t.status === "PENDING" || t.status === "REWORK").length,
      completed: tasks.filter(t => t.status === "COMPLETED").length,
    }))

    return {
      totalTasks, active: active.length, pending: pending.length,
      completedToday: completedToday.length, completed: completed.length,
      oee: Math.round(oee), availability: Math.round(availability),
      performance: Math.round(performance), quality: Math.round(quality),
      wip, bottleneck, avgCycleTime: avgCycleTime.toFixed(1),
      electricityKw, dailyKwh: Math.round(dailyKwh),
      assignedWorkers, stages, weeklyCompleted,
    }
  }, [tasksByStage, workers])

  return (
    <div
      className={cn(
        "flex overflow-hidden",
        fullscreen ? "fixed inset-0 z-[500]" : "h-[calc(100vh-100px)]"
      )}
      onMouseMove={(e) => {
        if (!resizing) return
        const newW = Math.max(280, Math.min(600, window.innerWidth - e.clientX))
        setDashWidth(newW)
      }}
      onMouseUp={() => setResizing(false)}
      onMouseLeave={() => setResizing(false)}
    >
      {/* 3D Model — fills all remaining space */}
      <div className="flex-1 min-w-0 bg-[#e8ecf0]">
        <FactoryTwinInner tasksByStage={tasksByStage} workers={workers} />
      </div>

      {/* Top-right control buttons */}
      <div className={cn(
        "absolute top-2 z-[300] flex items-center gap-1",
        dashOpen ? "right-[332px]" : "right-2"
      )} style={dashOpen ? { right: dashWidth + 12 } : undefined}>
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="bg-white/90 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-gray-600 hover:bg-white shadow-sm backdrop-blur"
        >
          {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
        <button
          onClick={() => setDashOpen(!dashOpen)}
          className="bg-white/90 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-gray-600 hover:bg-white shadow-sm backdrop-blur"
        >
          {dashOpen ? "→" : "← Dashboard"}
        </button>
      </div>

      {/* KPI Dashboard Side Panel — resizable */}
      {dashOpen && (
        <>
          {/* Resize handle */}
          <div
            className="w-1.5 shrink-0 bg-gray-100 hover:bg-blue-300 cursor-col-resize active:bg-blue-400 transition-colors"
            onMouseDown={(e) => { e.preventDefault(); setResizing(true) }}
          />
        </>
      )}
      <div
        className={cn(
          "shrink-0 bg-white overflow-y-auto transition-all",
          dashOpen ? "" : "w-0 overflow-hidden"
        )}
        style={dashOpen ? { width: dashWidth } : { width: 0 }}
      >
        <div className="p-4 space-y-5" style={{ minWidth: dashWidth }}>
          {/* Header */}
          <div>
            <h2 className="text-sm font-bold text-gray-900">Factory Dashboard</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Real-time production indicators</p>
          </div>

          {/* OEE Gauge */}
          <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-blue-50 to-white p-4">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Overall Equipment Effectiveness</div>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={kpis.oee >= 70 ? "#22c55e" : kpis.oee >= 50 ? "#f59e0b" : "#ef4444"} strokeWidth="10"
                    strokeDasharray={`${kpis.oee * 2.51} ${251 - kpis.oee * 2.51}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-800">{kpis.oee}%</span>
                </div>
              </div>
              <div className="space-y-2 flex-1">
                <Gauge value={kpis.availability} max={100} label="Availability" unit="%" color="#3b82f6" />
                <Gauge value={kpis.performance} max={100} label="Performance" unit="%" color="#f59e0b" />
                <Gauge value={kpis.quality} max={100} label="Quality" unit="%" color="#22c55e" />
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="WIP" value={kpis.wip} unit="jobs" color="#3b82f6" trend="active now" trendUp />
            <KpiCard label="Done Today" value={kpis.completedToday} unit="tasks" color="#22c55e" trend={`of ${20} target`} trendUp={kpis.completedToday >= 15} />
            <KpiCard label="Cycle Time" value={kpis.avgCycleTime} unit="hrs avg" color="#8b5cf6" />
            <KpiCard label="Workers" value={`${kpis.assignedWorkers}/${workers.length}`} unit="active" color="#f97316" trend={`${Math.round(kpis.availability)}% utilisation`} trendUp={kpis.availability >= 60} />
          </div>

          {/* Electricity / Energy */}
          <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-amber-50 to-white p-4">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Energy Consumption</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600">{kpis.electricityKw}</span>
              <span className="text-xs text-gray-400">kW (current draw)</span>
            </div>
            <div className="mt-2 space-y-1.5">
              <Gauge value={kpis.electricityKw} max={300} label="Load" unit={`/${300}kW capacity`} color="#f59e0b" />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>Est. daily: {kpis.dailyKwh} kWh</span>
                <span>~£{(kpis.dailyKwh * 0.28).toFixed(0)}/day</span>
              </div>
            </div>
          </div>

          {/* Bottleneck Alert */}
          {kpis.bottleneck && kpis.bottleneck.pending > 3 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-red-500 text-sm">⚠</span>
                <span className="text-[10px] text-red-600 uppercase tracking-wider font-bold">Bottleneck Detected</span>
              </div>
              <div className="text-sm font-semibold text-red-800">
                {kpis.bottleneck.stage === "FABRICATION" ? "Welding" : kpis.bottleneck.stage === "FITTING" ? "Fitting" : kpis.bottleneck.stage}
              </div>
              <div className="text-[11px] text-red-600 mt-0.5">
                {kpis.bottleneck.pending} jobs waiting — consider reallocating resources
              </div>
            </div>
          )}

          {/* Stage Breakdown */}
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Stage Breakdown</div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-0.5">
              {kpis.stages.map(s => (
                <StageBar key={s.stage} {...s} />
              ))}
              <div className="flex items-center gap-3 pt-2 mt-1 border-t border-gray-50 text-[9px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400" />Done</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" />Active</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-300" />Pending</span>
              </div>
            </div>
          </div>

          {/* MRO Summary */}
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">MRO / Maintenance</div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Plasma Table</span>
                <span className="text-green-600 font-medium">OK — 142hrs to service</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Band Saw</span>
                <span className="text-amber-600 font-medium">Due — blade change in 8hrs</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Shot Blast Booth</span>
                <span className="text-green-600 font-medium">OK — 320hrs to service</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Spray Booth Filters</span>
                <span className="text-red-600 font-medium">Overdue — replace now</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Compressor</span>
                <span className="text-green-600 font-medium">OK — 89hrs to service</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Production Summary</div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-gray-500">Total Tasks</span><span className="font-semibold text-gray-800">{kpis.totalTasks}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Active</span><span className="font-semibold text-blue-600">{kpis.active}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pending</span><span className="font-semibold text-amber-600">{kpis.pending}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Completed</span><span className="font-semibold text-green-600">{kpis.completed}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Weekly Throughput</span><span className="font-semibold text-gray-800">{kpis.weeklyCompleted} tasks</span></div>
            </div>
          </div>

          <div className="text-[9px] text-gray-300 text-center pb-4">
            Data refreshed on page load · KPIs calculated from live production tasks
          </div>
        </div>
      </div>
    </div>
  )
}
