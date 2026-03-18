import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const task = await prisma.installationTask.findUnique({ where: { id } })
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  if (task.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: `Cannot complete task: current status is ${task.status}` },
      { status: 400 }
    )
  }

  const now = new Date()
  const actualMins = task.startedAt
    ? Math.round((now.getTime() - task.startedAt.getTime()) / 60000)
    : null

  const updated = await prisma.installationTask.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: now,
      actualMins,
      inspectionStatus: "PENDING",
    },
  })

  await logAudit({
    action: "UPDATE",
    entity: "InstallationTask",
    entityId: id,
    field: "status",
    oldValue: "IN_PROGRESS",
    newValue: "COMPLETED",
    metadata: JSON.stringify({ stage: task.stage, actualMins }),
  })

  revalidatePath("/installation")
  revalidatePath("/installation/dashboard")

  return NextResponse.json(updated)
}
