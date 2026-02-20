"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  WORKSHOP_STAGES,
  STAGE_DISPLAY_NAMES,
  STAGE_BORDER_COLORS,
} from "@/lib/production-utils"
import { WorkshopSummaryBar } from "./workshop-summary-bar"
import { ProjectTrackerRail } from "./project-tracker-rail"
import { ProductQueueRail } from "./product-queue-rail"

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

  // Derived data splits
  const projectIds = new Set(data.projects.map((p) => p.id))
  const activeTasks = data.tasks.filter((t) => t.status === "IN_PROGRESS")
  const blockedTasks = data.tasks.filter((t) => t.status === "BLOCKED")
  const queuedTasks = data.tasks.filter(
    (t) => t.status === "PENDING" || t.status === "REWORK" || t.status === "ON_HOLD"
  )
  const completedTasks = data.tasks.filter(
    (t) => t.status === "COMPLETED" && t.inspectionStatus === "PENDING"
  )
  const inspectedTasks = data.tasks.filter(
    (t) => t.status === "COMPLETED" && t.inspectionStatus === "ACCEPTED"
  )

  const fetchStageData = useCallback(async (stage: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/production/workshop/${stage}`)
      if (res.ok) {
        const json = await res.json()
        // Reconstruct the data structure
        const tasks = json.allTasks || []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projectMap = new Map<string, any>()
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

  const handleTaskAction = async () => {
    // Refresh data after any task action
    await fetchStageData(activeStage)
  }

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

      {/* Summary Bar */}
      <WorkshopSummaryBar
        stageName={STAGE_DISPLAY_NAMES[activeStage]}
        stats={data.stats}
      />

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      )}

      {!loading && (
        <>
          {/* Upper Rail: Project Trackers */}
          <ProjectTrackerRail
            projects={data.projects}
            activeStage={activeStage}
          />

          {/* Lower Rail: Product Queue */}
          <ProductQueueRail
            activeTasks={activeTasks}
            blockedTasks={blockedTasks}
            queuedTasks={queuedTasks}
            completedTasks={completedTasks}
            inspectedTasks={inspectedTasks}
            projectIds={projectIds}
            workers={workers}
            stage={activeStage}
            onAction={handleTaskAction}
          />
        </>
      )}
    </div>
  )
}
