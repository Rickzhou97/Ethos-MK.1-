"use client"

import { useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import {
  INSTALL_STAGES,
  INSTALL_STAGE_DISPLAY_NAMES,
  INSTALL_STAGE_BORDER_COLORS,
} from "@/lib/install-utils"
import { useLayout } from "@/components/layout/layout-context"
import { MapPin, Clock, Users } from "lucide-react"
import { InstallNcrDialog, type InstallNcrData } from "./install-ncr-dialog"

// ─── Types ───

export type InstallTaskProduct = {
  id: string
  partCode: string
  description: string
  productJobNumber: string | null
  quantity: number
  installTargetDate: string | null
  project: {
    id: string
    projectNumber: string
    name: string
    priority: string
    siteLocation: string | null
    customer: { name: string } | null
  }
}

export type InstallTask = {
  id: string
  productId: string
  projectId: string
  crewId: string | null
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
  siteNotes: string | null
  weatherCondition: string | null
  createdAt: string
  product: InstallTaskProduct
  crew: { id: string; name: string; code: string } | null
}

export type InstallWorkshopStats = {
  activeCount: number
  pendingCount: number
  completedTodayCount: number
  awaitingInspectionCount: number
  totalCount: number
}

export type InstallWorkshopData = {
  tasks: InstallTask[]
  stats: InstallWorkshopStats
}

export type InstallCrew = {
  id: string
  name: string
  code: string
}

// ─── Theme helpers ───

type AppTheme = "light" | "cyberpunk" | "sage"
type ThemeColor = "cyan" | "amber" | "green" | "slate"

function getLaneStyles(themeColor: ThemeColor, appTheme: AppTheme) {
  const base = {
    cyan:  { border: "border-cyan-500",  accent: "text-cyan-600",  line: "bg-cyan-500" },
    amber: { border: "border-amber-500", accent: "text-amber-600", line: "bg-amber-500" },
    green: { border: "border-green-500", accent: "text-green-600", line: "bg-green-500" },
    slate: { border: "border-slate-400", accent: "text-slate-600", line: "bg-slate-400" },
  }[themeColor]

  if (appTheme === "cyberpunk") {
    const accentMap: Record<ThemeColor, string> = {
      cyan: "text-cyan-400", amber: "text-amber-400", green: "text-green-400", slate: "text-slate-400",
    }
    const borderMap: Record<ThemeColor, string> = {
      cyan: "border-cyan-700", amber: "border-amber-700", green: "border-green-700", slate: "border-slate-600",
    }
    return {
      ...base,
      accent: accentMap[themeColor],
      laneBg: "bg-[#1A1A1E]",
      cardBg: "bg-[#2A2A30]",
      cardBorder: borderMap[themeColor],
      titleText: "text-white",
      subtitleText: "text-gray-500",
      bodyText: "text-gray-300",
      mutedText: "text-gray-500",
      emptyText: "text-gray-600",
    }
  }

  if (appTheme === "sage") {
    const accentMap: Record<ThemeColor, string> = {
      cyan: "text-cyan-500", amber: "text-amber-500", green: "text-green-500", slate: "text-slate-400",
    }
    const borderMap: Record<ThemeColor, string> = {
      cyan: "border-cyan-700", amber: "border-amber-700", green: "border-green-700", slate: "border-slate-600",
    }
    return {
      ...base,
      accent: accentMap[themeColor],
      laneBg: "bg-[#2D2D2D]",
      cardBg: "bg-[#3A3A3A]",
      cardBorder: borderMap[themeColor],
      titleText: "text-white",
      subtitleText: "text-gray-400",
      bodyText: "text-gray-200",
      mutedText: "text-gray-400",
      emptyText: "text-gray-500",
    }
  }

  // Light theme
  const bgMap: Record<ThemeColor, string> = {
    cyan: "bg-cyan-50", amber: "bg-amber-50", green: "bg-green-50", slate: "bg-slate-50",
  }
  const cardBorderMap: Record<ThemeColor, string> = {
    cyan: "border-cyan-200", amber: "border-amber-200", green: "border-green-200", slate: "border-slate-200",
  }
  return {
    ...base,
    laneBg: bgMap[themeColor],
    cardBg: "bg-white",
    cardBorder: cardBorderMap[themeColor],
    titleText: "text-gray-900",
    subtitleText: "text-gray-500",
    bodyText: "text-gray-700",
    mutedText: "text-gray-500",
    emptyText: "text-gray-400",
  }
}

// ─── Main Component ───

export function InstallWorkshopView({
  initialData,
  initialStage,
  crews,
}: {
  initialData: InstallWorkshopData
  initialStage: string
  crews: InstallCrew[]
}) {
  const [activeStage, setActiveStage] = useState(initialStage)
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null)
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const { theme: appTheme } = useLayout()

  // Split tasks into lanes
  const liveTasks = data.tasks.filter((t) => t.status === "IN_PROGRESS")
  const readyTasks = data.tasks.filter(
    (t) => t.status === "PENDING" || t.status === "REWORK"
  )
  const completedTasks = data.tasks.filter(
    (t) => t.status === "COMPLETED" && t.inspectionStatus === "PENDING"
  )

  const fetchStageData = useCallback(async (stage: string, crewId: string | null) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (crewId) params.set("crewId", crewId)
      const url = `/api/installation/workshop/${stage}${params.toString() ? `?${params}` : ""}`
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setData({
          tasks: json.tasks || [],
          stats: json.stats,
        })
      }
    } catch (err) {
      console.error("Failed to fetch installation workshop data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleStageChange = (stage: string) => {
    setActiveStage(stage)
    fetchStageData(stage, selectedCrewId)
  }

  const handleCrewChange = (crewId: string | null) => {
    setSelectedCrewId(crewId)
    fetchStageData(activeStage, crewId)
  }

  const refresh = () => fetchStageData(activeStage, selectedCrewId)

  return (
    <div className="space-y-4">
      {/* Crew selector tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => handleCrewChange(null)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5",
            selectedCrewId === null
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          <Users className="h-3 w-3" />
          All Crews
        </button>
        {crews.map((crew) => (
          <button
            key={crew.id}
            onClick={() => handleCrewChange(crew.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              selectedCrewId === crew.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {crew.name}
          </button>
        ))}
      </div>

      {/* Stage Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200">
        {INSTALL_STAGES.map((stage) => {
          const isActive = stage === activeStage
          const borderColor = INSTALL_STAGE_BORDER_COLORS[stage]

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
              {INSTALL_STAGE_DISPLAY_NAMES[stage]}
            </button>
          )
        })}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1 flex-wrap">
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
        <span>{data.stats.totalCount} total</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Row 1: LIVE (left) | divider | COMPLETED (right) */}
          <div className="flex gap-0 min-h-[200px]">
            <div className="flex-1 min-w-0">
              <SwimLane
                title="LIVE"
                subtitle="Active work in progress"
                themeColor="cyan"
                tasks={liveTasks}
                cardType="live"
                onAction={refresh}
                appTheme={appTheme}
              />
            </div>

            {/* Vertical divider */}
            <div className="w-px bg-gray-300 mx-3 self-stretch" />

            <div className="flex-1 min-w-0">
              <SwimLane
                title="COMPLETED"
                subtitle="Work done, awaiting inspection"
                themeColor="green"
                tasks={completedTasks}
                cardType="completed"
                onAction={refresh}
                appTheme={appTheme}
              />
            </div>
          </div>

          {/* Row 2: READY TO START — full width */}
          <SwimLane
            title="READY TO START"
            subtitle="Stage reached, awaiting start"
            themeColor="amber"
            tasks={readyTasks}
            cardType="ready"
            onAction={refresh}
            appTheme={appTheme}
          />

          {/* Row 3: ALLOCATED — placeholder */}
          <AllocatedLane appTheme={appTheme} activeStage={activeStage} />
        </div>
      )}
    </div>
  )
}

// ─── Swim Lane ───

function SwimLane({
  title,
  subtitle,
  themeColor,
  tasks,
  cardType,
  onAction,
  appTheme,
}: {
  title: string
  subtitle: string
  themeColor: ThemeColor
  tasks: InstallTask[]
  cardType: "live" | "ready" | "completed"
  onAction: () => void
  appTheme: AppTheme
}) {
  const styles = getLaneStyles(themeColor, appTheme)

  return (
    <div className={cn("rounded-lg border-2 overflow-hidden h-full", styles.border, styles.laneBg)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1">
          <h3 className={cn("text-sm font-bold uppercase tracking-wider", styles.accent)}>
            {title}
          </h3>
          <p className={cn("text-[10px] mt-0.5", styles.subtitleText)}>{subtitle}</p>
        </div>
        <span className={cn("text-xs font-semibold", styles.accent)}>
          {tasks.length}
        </span>
      </div>

      {/* Horizontal line */}
      <div className={cn("h-0.5", styles.line)} />

      {/* Cards — horizontal scroll */}
      <div className="flex gap-3 p-3 overflow-x-auto min-h-[140px]">
        {tasks.length === 0 && (
          <div className={cn("flex flex-col items-center justify-center w-full gap-2", styles.emptyText)}>
            <span className="text-lg font-semibold italic opacity-40">All clear</span>
            <span className="text-xs">No tasks</span>
          </div>
        )}
        {tasks.map((task) => (
          <InstallTaskCard
            key={task.id}
            task={task}
            cardType={cardType}
            themeColor={themeColor}
            onAction={onAction}
            appTheme={appTheme}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Allocated Lane (placeholder) ───

function AllocatedLane({
  appTheme,
  activeStage,
}: {
  appTheme: AppTheme
  activeStage: string
}) {
  const styles = getLaneStyles("slate", appTheme)

  return (
    <div className={cn("rounded-lg border-2 overflow-hidden", styles.border, styles.laneBg)}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1">
          <h3 className={cn("text-sm font-bold uppercase tracking-wider", styles.accent)}>
            ALLOCATED
          </h3>
          <p className={cn("text-[10px] mt-0.5", styles.subtitleText)}>
            Allocated to {INSTALL_STAGE_DISPLAY_NAMES[activeStage] || activeStage}, previous stage not finished
          </p>
        </div>
        <span className={cn("text-xs font-semibold", styles.accent)}>0</span>
      </div>

      <div className={cn("h-0.5", styles.line)} />

      <div className="flex gap-3 p-3 overflow-x-auto min-h-[140px]">
        <div className={cn("flex flex-col items-center justify-center w-full gap-2", styles.emptyText)}>
          <span className="text-lg font-semibold italic opacity-40">All clear</span>
          <span className="text-xs">No allocated items</span>
        </div>
      </div>
    </div>
  )
}

// ─── Elapsed time helper ───

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return ""
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  const diffMs = now - start
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins % 60}m`
  return `${mins}m`
}

// ─── Task Card ───

function InstallTaskCard({
  task,
  cardType,
  themeColor,
  onAction,
  appTheme,
}: {
  task: InstallTask
  cardType: "live" | "ready" | "completed"
  themeColor: ThemeColor
  onAction: () => void
  appTheme: AppTheme
}) {
  const [actionLoading, setActionLoading] = useState(false)
  const [ncrOpen, setNcrOpen] = useState(false)
  const styles = getLaneStyles(themeColor, appTheme)

  const project = task.product.project

  async function handleStart() {
    const assignedTo = prompt("Assign to (worker name):")
    if (!assignedTo) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/installation/tasks/${task.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo }),
      })
      if (res.ok) onAction()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleComplete() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/installation/tasks/${task.id}/complete`, {
        method: "POST",
      })
      if (res.ok) onAction()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApprove() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/installation/tasks/${task.id}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "ACCEPTED", inspectedBy: "Workshop Inspector" }),
      })
      if (res.ok) onAction()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(ncrData: InstallNcrData) {
    setNcrOpen(false)
    setActionLoading(true)
    try {
      const res = await fetch(`/api/installation/tasks/${task.id}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "REJECTED",
          inspectedBy: "Workshop Inspector",
          ...ncrData,
        }),
      })
      if (res.ok) onAction()
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <div className={cn(
        "shrink-0 w-[220px] rounded-lg border p-3 flex flex-col gap-2 shadow-sm",
        styles.cardBg, styles.cardBorder
      )}>
        {/* Product info */}
        <div>
          <div className={cn("text-xs font-semibold truncate", styles.bodyText)}>
            {task.product.description}
          </div>
          <div className={cn("text-[10px] font-mono mt-0.5", styles.mutedText)}>
            {task.product.productJobNumber || task.product.partCode}
          </div>
        </div>

        {/* Project & customer */}
        <div className={cn("text-[10px] space-y-0.5", styles.mutedText)}>
          <div className="truncate">{project.projectNumber} — {project.name}</div>
          <div className="truncate">{project.customer?.name || "No customer"}</div>
        </div>

        {/* Assigned worker */}
        <div className={cn("text-[10px]", styles.mutedText)}>
          {task.assignedTo || "Unassigned"}
        </div>

        {/* Site location */}
        {project.siteLocation && (
          <div className={cn("text-[10px] flex items-center gap-1", styles.mutedText)}>
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{project.siteLocation}</span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Card-specific content + action */}
        {cardType === "live" && (
          <div className="flex items-center gap-1 text-[10px] text-cyan-600">
            <Clock className="h-2.5 w-2.5" />
            <span>{formatElapsed(task.startedAt)} elapsed</span>
          </div>
        )}

        {cardType === "ready" && task.status === "REWORK" && (
          <div className="text-[10px] font-semibold text-purple-500 uppercase">Rework</div>
        )}

        <div className="mt-auto pt-1">
          {cardType === "ready" && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="w-full rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? "Starting..." : "Start"}
            </button>
          )}

          {cardType === "live" && (
            <button
              onClick={handleComplete}
              disabled={actionLoading}
              className="w-full rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-400 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? "Completing..." : "Complete"}
            </button>
          )}

          {cardType === "completed" && (
            <div className="flex gap-1.5">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex-1 rounded-md bg-green-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? "..." : "Approve"}
              </button>
              <button
                onClick={() => setNcrOpen(true)}
                disabled={actionLoading}
                className={cn(
                  "rounded-md border border-red-500 px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors",
                  appTheme !== "light" && "hover:bg-red-950"
                )}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {/* NCR Dialog */}
      <InstallNcrDialog
        open={ncrOpen}
        onClose={() => setNcrOpen(false)}
        onSubmit={handleReject}
      />
    </>
  )
}
