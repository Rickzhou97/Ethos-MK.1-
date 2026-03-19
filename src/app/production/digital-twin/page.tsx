import { prisma } from "@/lib/db"
import FactoryDigitalTwin from "@/components/production/factory-digital-twin"

export const dynamic = "force-dynamic"

export default async function DigitalTwinPage() {
  // Get all production tasks grouped by stage with product/project details
  const tasks = await prisma.productionTask.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] } },
    include: {
      product: {
        select: {
          partCode: true,
          description: true,
          quantity: true,
          productionTargetDate: true,
          project: {
            select: {
              projectNumber: true,
              name: true,
              priority: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { queuePosition: "asc" },
  })

  // Group by stage
  const tasksByStage: Record<string, typeof tasks> = {}
  for (const t of tasks) {
    if (!tasksByStage[t.stage]) tasksByStage[t.stage] = []
    tasksByStage[t.stage].push(t)
  }

  // Get workers
  const workers = await prisma.worker.findMany({
    where: { isAvailable: true },
    select: { id: true, name: true, role: true },
  })

  const serialized = JSON.parse(JSON.stringify({ tasksByStage, workers }))
  return (
    <FactoryDigitalTwin
      tasksByStage={serialized.tasksByStage}
      workers={serialized.workers}
    />
  )
}
