import { prisma } from "@/lib/db"
import { WorkshopView, type WorkshopData, type WorkshopWorker } from "@/components/production/workshop-view"

export const dynamic = "force-dynamic"

async function getWorkshopData(stage: string) {
  const tasks = await prisma.productionTask.findMany({
    where: { stage: stage as any },
    include: {
      product: {
        select: {
          id: true,
          partCode: true,
          description: true,
          productJobNumber: true,
          quantity: true,
          productionStatus: true,
          productionTargetDate: true,
        },
      },
      project: {
        select: {
          id: true,
          projectNumber: true,
          name: true,
          priority: true,
          isICUFlag: true,
          classification: true,
          targetCompletion: true,
          ragStatus: true,
          contractValue: true,
          customer: { select: { name: true } },
          projectManager: { select: { name: true } },
        },
      },
    },
    orderBy: { queuePosition: "asc" },
  })

  // Build project tracker data
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

  // Calculate stats
  const now = new Date()
  const completedToday = tasks.filter((t) => {
    if (!t.completedAt) return false
    const d = new Date(t.completedAt)
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    )
  })

  const withMins = tasks.filter((t) => t.actualMins && t.actualMins > 0)
  const avgMins =
    withMins.length > 0
      ? Math.round(withMins.reduce((s, t) => s + (t.actualMins || 0), 0) / withMins.length)
      : 0

  // Find oldest queued task
  const queuedTasks = tasks.filter((t) => t.status === "PENDING")
  let oldestInQueue = 0
  if (queuedTasks.length > 0) {
    const oldest = queuedTasks.reduce((min, t) =>
      new Date(t.createdAt) < new Date(min.createdAt) ? t : min
    )
    oldestInQueue = Math.ceil(
      (now.getTime() - new Date(oldest.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
  }

  return {
    projects: Array.from(projectMap.values()),
    tasks,
    stats: {
      totalProjects: projectMap.size,
      totalTasks: tasks.length,
      activeCount: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      pendingCount: tasks.filter((t) => t.status === "PENDING" || t.status === "REWORK").length,
      completedTodayCount: completedToday.length,
      awaitingHandoverCount: tasks.filter(
        (t) => t.status === "COMPLETED" && t.inspectionStatus === "PENDING"
      ).length,
      avgProcessingMins: avgMins,
      oldestInQueueDays: oldestInQueue,
    },
  }
}

async function getWorkers() {
  return prisma.worker.findMany({
    orderBy: { name: "asc" },
  })
}

export default async function WorkshopPage() {
  const [initialData, workers] = await Promise.all([
    getWorkshopData("CUTTING"),
    getWorkers(),
  ])

  const serializedData: WorkshopData = JSON.parse(JSON.stringify(initialData))
  const serializedWorkers: WorkshopWorker[] = JSON.parse(JSON.stringify(workers))

  return (
    <WorkshopView
      initialData={serializedData}
      initialStage="CUTTING"
      workers={serializedWorkers}
    />
  )
}
