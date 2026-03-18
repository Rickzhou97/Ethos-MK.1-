import { prisma } from "@/lib/db"
import { InstallWorkshopView, type InstallWorkshopData, type InstallCrew } from "@/components/installation/install-workshop-view"

export const dynamic = 'force-dynamic'

async function getWorkshopData(stage: string, crewId?: string) {
  const where: any = { stage: stage as any }
  if (crewId) where.crewId = crewId

  const tasks = await prisma.installationTask.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          partCode: true,
          description: true,
          productJobNumber: true,
          quantity: true,
          installTargetDate: true,
          project: {
            select: {
              id: true,
              projectNumber: true,
              name: true,
              priority: true,
              siteLocation: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
      crew: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: { queuePosition: "asc" },
  })

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

  return {
    tasks,
    stats: {
      activeCount: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      pendingCount: tasks.filter((t) => t.status === "PENDING" || t.status === "REWORK").length,
      completedTodayCount: completedToday.length,
      awaitingInspectionCount: tasks.filter(
        (t) => t.status === "COMPLETED" && t.inspectionStatus === "PENDING"
      ).length,
      totalCount: tasks.length,
    },
  }
}

async function getCrews() {
  return prisma.installCrew.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
    },
  })
}

export default async function InstallWorkshopPage() {
  const [initialData, crews] = await Promise.all([
    getWorkshopData("SITE_PREP"),
    getCrews(),
  ])

  const serializedData: InstallWorkshopData = JSON.parse(JSON.stringify(initialData))
  const serializedCrews: InstallCrew[] = JSON.parse(JSON.stringify(crews))

  return (
    <InstallWorkshopView
      initialData={serializedData}
      initialStage="SITE_PREP"
      crews={serializedCrews}
    />
  )
}
