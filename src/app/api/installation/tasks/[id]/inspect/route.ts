import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

const INSTALLATION_STAGES = [
  "PREPARATION",
  "CIVIL_WORKS",
  "LIFTING",
  "INSTALLATION",
  "SEALING",
  "INSPECTION",
] as const

function getNextStage(currentStage: string): string | null {
  const idx = INSTALLATION_STAGES.indexOf(currentStage as typeof INSTALLATION_STAGES[number])
  if (idx === -1 || idx === INSTALLATION_STAGES.length - 1) return null
  return INSTALLATION_STAGES[idx + 1]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const {
    decision,
    inspectedBy,
    ncrTitle,
    ncrDescription,
    ncrSeverity,
    ncrCostImpact,
    ncrRootCause,
  } = body

  if (!decision || !inspectedBy) {
    return NextResponse.json(
      { error: "decision and inspectedBy are required" },
      { status: 400 }
    )
  }

  if (decision !== "ACCEPTED" && decision !== "REJECTED") {
    return NextResponse.json(
      { error: "decision must be ACCEPTED or REJECTED" },
      { status: 400 }
    )
  }

  const task = await prisma.installationTask.findUnique({ where: { id } })
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  if (task.status !== "COMPLETED" || task.inspectionStatus !== "PENDING") {
    return NextResponse.json(
      { error: "Task is not awaiting inspection" },
      { status: 400 }
    )
  }

  const now = new Date()

  if (decision === "ACCEPTED") {
    // Update inspection fields
    await prisma.installationTask.update({
      where: { id },
      data: {
        inspectionStatus: "ACCEPTED",
        inspectedBy,
        inspectedAt: now,
      },
    })

    const nextStage = getNextStage(task.stage)

    if (nextStage) {
      // Create next stage task
      const maxPos = await prisma.installationTask.findFirst({
        where: { stage: nextStage },
        orderBy: { queuePosition: "desc" },
        select: { queuePosition: true },
      })
      const queuePosition = (maxPos?.queuePosition ?? -1) + 1

      await prisma.installationTask.create({
        data: {
          productId: task.productId,
          projectId: task.projectId,
          crewId: task.crewId,
          stage: nextStage,
          status: "PENDING",
          queuePosition,
        },
      })

      // Update product installStatus to next stage
      await prisma.product.update({
        where: { id: task.productId },
        data: { installStatus: nextStage },
      })
    } else {
      // INSPECTION (last stage) — mark installation complete
      await prisma.product.update({
        where: { id: task.productId },
        data: {
          installCompletionDate: now,
          installStatus: "COMPLETED",
        },
      })
    }

    await logAudit({
      action: "UPDATE",
      entity: "InstallationTask",
      entityId: id,
      field: "inspectionStatus",
      oldValue: "PENDING",
      newValue: "ACCEPTED",
      metadata: JSON.stringify({
        stage: task.stage,
        inspectedBy,
        nextStage: nextStage || "COMPLETED",
      }),
    })

    revalidatePath("/installation")
    revalidatePath("/installation/dashboard")
    revalidatePath("/projects")

    return NextResponse.json({ success: true, nextStage: nextStage || "COMPLETED" })
  }

  // REJECTED — create NCR
  if (!ncrTitle) {
    return NextResponse.json(
      { error: "ncrTitle is required for rejection" },
      { status: 400 }
    )
  }

  // Auto-generate NCR number
  const lastNcr = await prisma.nonConformanceReport.findFirst({
    orderBy: { ncrNumber: "desc" },
  })
  const lastNum = lastNcr ? parseInt(lastNcr.ncrNumber.replace("NCR-", "")) : 0
  const ncrNumber = `NCR-${String(lastNum + 1).padStart(4, "0")}`

  const ncr = await prisma.nonConformanceReport.create({
    data: {
      ncrNumber,
      projectId: task.projectId,
      productId: task.productId,
      title: ncrTitle,
      description: ncrDescription || null,
      severity: ncrSeverity || "MINOR",
      rootCause: ncrRootCause || "OTHER",
      originStage: task.stage as any,
      costImpact: ncrCostImpact ? parseFloat(ncrCostImpact) : null,
    },
  })

  // Update task with rejection
  await prisma.installationTask.update({
    where: { id },
    data: {
      inspectionStatus: "REJECTED",
      inspectedBy,
      inspectedAt: now,
      ncrId: ncr.id,
    },
  })

  // Create rework task at same stage
  const maxPos = await prisma.installationTask.findFirst({
    where: { stage: task.stage },
    orderBy: { queuePosition: "desc" },
    select: { queuePosition: true },
  })
  const queuePosition = (maxPos?.queuePosition ?? -1) + 1

  await prisma.installationTask.create({
    data: {
      productId: task.productId,
      projectId: task.projectId,
      crewId: task.crewId,
      stage: task.stage,
      status: "REWORK",
      queuePosition,
    },
  })

  // Update project NCR cost total
  if (ncrCostImpact) {
    const ncrs = await prisma.nonConformanceReport.findMany({
      where: { projectId: task.projectId },
    })
    const totalNcrCost = ncrs.reduce(
      (sum, n) => sum + Number(n.costImpact || 0),
      0
    )
    await prisma.project.update({
      where: { id: task.projectId },
      data: { ncrCost: totalNcrCost },
    })
  }

  await logAudit({
    action: "UPDATE",
    entity: "InstallationTask",
    entityId: id,
    field: "inspectionStatus",
    oldValue: "PENDING",
    newValue: "REJECTED",
    metadata: JSON.stringify({
      stage: task.stage,
      inspectedBy,
      ncrNumber,
      ncrId: ncr.id,
    }),
  })

  revalidatePath("/installation")
  revalidatePath("/installation/dashboard")
  revalidatePath("/projects")
  revalidatePath("/ncrs")

  return NextResponse.json({ success: true, ncrId: ncr.id, ncrNumber })
}
