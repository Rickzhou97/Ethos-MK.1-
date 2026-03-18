import { prisma } from "@/lib/db"
import { InstallWorkshopView } from "@/components/installation/install-workshop-view"

export const dynamic = "force-dynamic"

export default async function InstallWorkshopPage() {
  const crews = await prisma.installCrew.findMany({
    where: { isActive: true },
    include: {
      members: {
        where: { endDate: null },
        include: { worker: { select: { id: true, name: true, role: true } } },
        orderBy: { startDate: "asc" },
      },
      equipment: { orderBy: { name: "asc" } },
      instructions: {
        include: { document: { select: { filename: true, filePath: true } } },
        orderBy: { createdAt: "desc" },
      },
      expenses: {
        orderBy: { date: "desc" },
        take: 20,
      },
    },
    orderBy: { name: "asc" },
  })

  const allTasks = await prisma.installationTask.findMany({
    where: { crewId: { not: null } },
    include: {
      product: {
        select: {
          partCode: true,
          description: true,
          quantity: true,
          installTargetDate: true,
          project: {
            select: {
              projectNumber: true,
              name: true,
              priority: true,
              siteLocation: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { queuePosition: "asc" },
  })

  // Fetch drawing documents for projects that have installation tasks
  const projectIdsWithTasks = [...new Set(allTasks.map((t) => t.projectId))]
  const drawingDocuments = projectIdsWithTasks.length > 0
    ? await prisma.document.findMany({
        where: {
          projectId: { in: projectIdsWithTasks },
          documentType: "DRAWING",
        },
        select: {
          id: true,
          filename: true,
          filePath: true,
          description: true,
          uploadedAt: true,
          projectId: true,
        },
        orderBy: { uploadedAt: "desc" },
      })
    : []

  // Group tasks by crewId
  const tasksByCrewId: Record<string, typeof allTasks> = {}
  for (const task of allTasks) {
    if (task.crewId) {
      if (!tasksByCrewId[task.crewId]) tasksByCrewId[task.crewId] = []
      tasksByCrewId[task.crewId].push(task)
    }
  }

  // Serialize to strip Prisma types / Date objects
  const serializedCrews = JSON.parse(JSON.stringify(crews))
  const serializedTasks = JSON.parse(JSON.stringify(tasksByCrewId))
  const serializedDocuments = JSON.parse(JSON.stringify(drawingDocuments))

  return (
    <InstallWorkshopView
      crews={serializedCrews}
      tasksByCrewId={serializedTasks}
      drawingDocuments={serializedDocuments}
    />
  )
}
