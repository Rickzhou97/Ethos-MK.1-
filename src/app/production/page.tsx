import { prisma } from "@/lib/db"
import { ProductionBoardView } from "@/components/production/production-board-view"

async function getBoardData() {
  const [pendingHandovers, producingProjects, completeProjects] = await Promise.all([
    // Pending handovers (SUBMITTED status — awaiting acceptance)
    prisma.designHandover.findMany({
      where: { status: "SUBMITTED" },
      include: {
        project: {
          select: {
            id: true,
            projectNumber: true,
            name: true,
            targetCompletion: true,
            priority: true,
            isICUFlag: true,
            customer: { select: { name: true } },
            products: {
              select: { id: true, partCode: true, description: true, quantity: true },
            },
            designCards: {
              select: {
                id: true,
                status: true,
                product: { select: { id: true, description: true, partCode: true } },
              },
            },
          },
        },
        initiatedBy: { select: { id: true, name: true } },
      },
      orderBy: { initiatedAt: "asc" },
    }),

    // Active production projects (MANUFACTURE + DESIGN_FREEZE with acknowledged handovers)
    prisma.project.findMany({
      where: { projectStatus: { in: ["MANUFACTURE", "DESIGN_FREEZE"] } },
      orderBy: [{ priority: "asc" }, { targetCompletion: "asc" }],
      select: {
        id: true,
        projectNumber: true,
        name: true,
        projectStatus: true,
        departmentStatus: true,
        priority: true,
        isICUFlag: true,
        classification: true,
        ragStatus: true,
        targetCompletion: true,
        customer: { select: { id: true, name: true } },
        coordinator: { select: { id: true, name: true } },
        products: {
          select: {
            id: true,
            partCode: true,
            description: true,
            quantity: true,
            productionStatus: true,
            productionTargetDate: true,
            productionCompletionDate: true,
            currentDepartment: true,
          },
        },
        _count: { select: { products: true, ncrs: true } },
      },
    }),

    // Completed production projects (INSTALLATION or later — handed over from production)
    prisma.project.findMany({
      where: { projectStatus: { in: ["INSTALLATION", "REVIEW", "COMPLETE"] } },
      orderBy: [{ actualCompletion: "desc" }, { targetCompletion: "desc" }],
      take: 20,
      select: {
        id: true,
        projectNumber: true,
        name: true,
        projectStatus: true,
        priority: true,
        isICUFlag: true,
        targetCompletion: true,
        actualCompletion: true,
        customer: { select: { id: true, name: true } },
        products: {
          select: {
            id: true,
            partCode: true,
            description: true,
            quantity: true,
            productionStatus: true,
          },
        },
        _count: { select: { products: true } },
      },
    }),
  ])

  return { pendingHandovers, producingProjects, completeProjects }
}

export default async function ProductionPage() {
  const { pendingHandovers, producingProjects, completeProjects } = await getBoardData()

  return (
    <ProductionBoardView
      pendingHandovers={JSON.parse(JSON.stringify(pendingHandovers))}
      producingProjects={JSON.parse(JSON.stringify(producingProjects))}
      completeProjects={JSON.parse(JSON.stringify(completeProjects))}
    />
  )
}
