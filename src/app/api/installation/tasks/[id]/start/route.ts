import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { assignedTo } = body as { assignedTo?: string }

  const task = await prisma.installationTask.findUnique({ where: { id } })
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  if (task.status !== "PENDING" && task.status !== "REWORK") {
    return NextResponse.json(
      { error: `Cannot start task: current status is ${task.status}` },
      { status: 400 }
    )
  }

  const now = new Date()
  const updated = await prisma.installationTask.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      startedAt: now,
      assignedTo: assignedTo || task.assignedTo || null,
    },
  })

  // Update product's installStatus to this stage
  await prisma.product.update({
    where: { id: task.productId },
    data: {
      installStatus: task.stage,
      currentDepartment: "INSTALLATION",
    },
  })

  await logAudit({
    action: "UPDATE",
    entity: "InstallationTask",
    entityId: id,
    field: "status",
    oldValue: task.status,
    newValue: "IN_PROGRESS",
    metadata: JSON.stringify({ stage: task.stage, assignedTo: assignedTo || task.assignedTo }),
  })

  revalidatePath("/installation")
  revalidatePath("/installation/dashboard")

  return NextResponse.json(updated)
}
