"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  WORKSHOP_STAGES,
  STAGE_DISPLAY_NAMES,
  STAGE_BORDER_COLORS,
} from "@/lib/production-utils"

// ─── Types ───

export type WorkshopTask = {
  id: string
  productId: string
  projectId: string
  stage: string
  status: string
  queuePosition: number
  assignedTo: string | null
  notes: string | null
  estimatedMins: number | null
  actualMins: number | null
  startedAt: string | null
  completedAt: string | null
  inspectedBy: string | null
  inspectedAt: string | null
  inspectionStatus: string | null
  ncrId: string | null
  createdAt: string
  product: {
    id: string
    partCode: string
    description: string
    productJobNumber: string | null
    quantity: number
    productionStatus: string | null
    productionTargetDate: string | null
  }
  project: {
    id: string
    projectNumber: string
    name: string
    priority: string
    isICUFlag: boolean
    classification: string
    targetCompletion: string | null
    ragStatus: string | null
    contractValue: string | number | null
    customer: { name: string } | null
    projectManager: { name: string } | null
  }
}

export type WorkshopProject = {
  id: string
  projectNumber: string
  name: string
  priority: string
  isICUFlag: boolean
  classification: string
  targetCompletion: string | null
  ragStatus: string | null
  contractValue: string | number | null
  customer: { name: string } | null
  projectManager: { name: string } | null
  productCount: number
  tasks: WorkshopTask[]
}

export type WorkshopStats = {
  totalProjects: number
  totalTasks: number
  activeCount: number
  pendingCount: number
  completedTodayCount: number
  awaitingHandoverCount: number
  avgProcessingMins: number
  oldestInQueueDays: number
}

export type WorkshopData = {
  projects: WorkshopProject[]
  tasks: WorkshopTask[]
  stats: WorkshopStats
}

export type WorkshopWorker = {
  id: string
  name: string
  role: string
  isAvailable: boolean
}

// ─── Main Component ───

export function WorkshopView({
  initialData,
  initialStage,
  workers,
}: {
  initialData: WorkshopData
  initialStage: string
  workers: WorkshopWorker[]
}) {
  const [activeStage, setActiveStage] = useState(initialStage)
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  // Split tasks into 3 lanes
  const liveTasks = data.tasks.filter((t) => t.status === "IN_PROGRESS")
  const readyTasks = data.tasks.filter(
    (t) => t.status === "PENDING" || t.status === "REWORK"
  )
  const completedTasks = data.tasks.filter(
    (t) => t.status === "COMPLETED" && t.inspectionStatus === "PENDING"
  )

  const fetchStageData = useCallback(async (stage: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/production/workshop/${stage}`)
      if (res.ok) {
        const json = await res.json()
        const tasks = json.allTasks || []
        const projectMap = new Map<string, WorkshopProject>()
        for (const task of tasks) {
          if (!projectMap.has(task.projectId)) {
            projectMap.set(task.projectId, {
              ...task.project,
              productCount: 0,
              tasks: [],
            })
          }
          const proj = projectMap.get(task.projectId)!
          proj.productCount++
          proj.tasks.push(task)
        }
        setData({
          projects: Array.from(projectMap.values()),
          tasks,
          stats: json.stats,
        })
      }
    } catch (err) {
      console.error("Failed to fetch workshop data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleStageChange = (stage: string) => {
    setActiveStage(stage)
    fetchStageData(stage)
  }

  const refresh = () => fetchStageData(activeStage)

  return (
    <div className="space-y-4">
      {/* Stage Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {WORKSHOP_STAGES.map((stage) => {
          const isActive = stage === activeStage
          const borderColor = STAGE_BORDER_COLORS[stage]

          return (
            <button
              key={stage}
              onClick={() => handleStageChange(stage)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                isActive
                  ? `${borderColor.replace("border-t-", "border-")} text-gray-900`
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {STAGE_DISPLAY_NAMES[stage]}
            </button>
          )
        })}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          {liveTasks.length} live
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {readyTasks.length} ready
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          {completedTasks.length} awaiting inspection
        </span>
        <span className="text-gray-400">|</span>
        <span>{data.stats.completedTodayCount} completed today</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* LIVE — active work in progress */}
          <SwimLane
            title="LIVE"
            subtitle="Active work in progress"
            themeColor="cyan"
            tasks={liveTasks}
            cardType="live"
            workers={workers}
            onAction={refresh}
          />

          {/* READY TO START — awaiting start */}
          <SwimLane
            title="READY TO START"
            subtitle="Stage reached, awaiting start"
            themeColor="amber"
            tasks={readyTasks}
            cardType="ready"
            workers={workers}
            onAction={refresh}
          />

          {/* COMPLETED — awaiting inspection */}
          <SwimLane
            title="COMPLETED"
            subtitle="Work done, awaiting inspection"
            themeColor="green"
            tasks={completedTasks}
            cardType="completed"
            workers={workers}
            onAction={refresh}
          />
        </div>
      )}
    </div>
  )
}

// ─── Swim Lane ───

const THEME: Record<string, { border: string; bg: string; text: string; accent: string; line: string }> = {
  cyan:  { border: "border-cyan-500",  bg: "bg-cyan-950/80",   text: "text-cyan-300",  accent: "text-cyan-400",  line: "bg-cyan-500" },
  amber: { border: "border-amber-500", bg: "bg-amber-950/80",  text: "text-amber-300", accent: "text-amber-400", line: "bg-amber-500" },
  green: { border: "border-green-500", bg: "bg-green-950/80",  text: "text-green-300", accent: "text-green-400", line: "bg-green-500" },
}

function SwimLane({
  title,
  subtitle,
  themeColor,
  tasks,
  cardType,
  workers,
  onAction,
}: {
  title: string
  subtitle: string
  themeColor: "cyan" | "amber" | "green"
  tasks: WorkshopTask[]
  cardType: "live" | "ready" | "completed"
  workers: WorkshopWorker[]
  onAction: () => void
}) {
  const theme = THEME[themeColor]

  return (
    <div className={cn("rounded-lg border-2 overflow-hidden", theme.border, "bg-gray-950")}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1">
          <h3 className={cn("text-sm font-bold uppercase tracking-wider", theme.accent)}>
            {title}
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <span className={cn("text-xs font-semibold", theme.accent)}>
          {tasks.length}
        </span>
      </div>

      {/* Horizontal line */}
      <div className={cn("h-0.5", theme.line)} />

      {/* Cards — horizontal scroll */}
      <div className="flex gap-3 p-3 overflow-x-auto min-h-[140px]">
        {tasks.length === 0 && (
          <div className="flex items-center justify-center w-full text-xs text-gray-600">
            No tasks
          </div>
        )}
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            cardType={cardType}
            themeColor={themeColor}
            workers={workers}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Task Card ───

function TaskCard({
  task,
  cardType,
  themeColor,
  workers,
  onAction,
}: {
  task: WorkshopTask
  cardType: "live" | "ready" | "completed"
  themeColor: string
  workers: WorkshopWorker[]
  onAction: () => void
}) {
  const [actionLoading, setActionLoading] = useState(false)

  const borderClass =
    themeColor === "cyan" ? "border-cyan-700" :
    themeColor === "amber" ? "border-amber-700" :
    "border-green-700"

  async function handleStart() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/production/tasks/${task.id}/start`, { method: "POST" })
      if (res.ok) onAction()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleComplete() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/production/tasks/${task.id}/complete`, { method: "POST" })
      if (res.ok) onAction()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleInspect(result: "ACCEPTED" | "REJECTED") {
    if (result === "REJECTED") {
      const reason = prompt("Rejection reason / NCR description:")
      if (!reason) return
      setActionLoading(true)
      try {
        const res = await fetch(`/api/production/tasks/${task.id}/inspect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result: "REJECTED", reason }),
        })
        if (res.ok) onAction()
      } finally {
        setActionLoading(false)
      }
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/production/tasks/${task.id}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: "ACCEPTED" }),
      })
      if (res.ok) onAction()
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className={cn(
      "shrink-0 w-[220px] rounded-lg border bg-gray-900 p-3 flex flex-col gap-2",
      borderClass
    )}>
      {/* Product info */}
      <div>
        <Link href={`/projects/${task.project.id}`} className="hover:underline">
          <div className="text-xs font-semibold text-gray-100 truncate">
            {task.product.description}
          </div>
        </Link>
        <div className="text-[10px] font-mono text-gray-500 mt-0.5">
          {task.product.productJobNumber || task.product.partCode}
        </div>
      </div>

      {/* Project & customer */}
      <div className="text-[10px] text-gray-500 space-y-0.5">
        <div className="truncate">{task.project.projectNumber} — {task.project.name}</div>
        <div className="truncate">{task.project.customer?.name || "No customer"}</div>
      </div>

      {/* Assigned worker */}
      <div className="text-[10px] text-gray-400">
        {task.assignedTo || "Unassigned"}
      </div>

      {/* Card-specific content */}
      {cardType === "live" && (
        <LiveCountdown targetDate={task.project.targetCompletion} />
      )}

      {cardType === "ready" && task.status === "REWORK" && (
        <div className="text-[10px] font-semibold text-purple-400 uppercase">Rework</div>
      )}

      {/* Action buttons */}
      <div className="mt-auto pt-1">
        {cardType === "ready" && (
          <button
            onClick={handleStart}
            disabled={actionLoading}
            className="w-full rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-gray-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {actionLoading ? "Starting..." : "Start"}
          </button>
        )}

        {cardType === "live" && (
          <button
            onClick={handleComplete}
            disabled={actionLoading}
            className="w-full rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-gray-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors"
          >
            {actionLoading ? "Completing..." : "Complete"}
          </button>
        )}

        {cardType === "completed" && (
          <div className="flex gap-1.5">
            <button
              onClick={() => handleInspect("ACCEPTED")}
              disabled={actionLoading}
              className="flex-1 rounded-md bg-green-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? "..." : "Approve"}
            </button>
            <button
              onClick={() => handleInspect("REJECTED")}
              disabled={actionLoading}
              className="rounded-md border border-red-600 px-2 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Live Countdown ───

function LiveCountdown({ targetDate }: { targetDate: string | null }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  if (!targetDate) {
    return <div className="text-[10px] text-gray-600">No target date</div>
  }

  const target = new Date(targetDate).getTime()
  const diffMs = target - now
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const isOverdue = diffMs < 0

  if (isOverdue) {
    const absDays = Math.abs(diffDays)
    return (
      <div className="text-xs font-bold text-red-400">
        {absDays}d overdue
      </div>
    )
  }

  const urgencyColor =
    diffDays <= 2 ? "text-red-400" :
    diffDays <= 7 ? "text-amber-400" :
    "text-cyan-400"

  return (
    <div className={cn("text-xs font-bold", urgencyColor)}>
      {diffDays}d {diffHours}h left
    </div>
  )
}
