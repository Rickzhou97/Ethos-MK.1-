import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const task = await prisma.installationTask.findUnique({
    where: { id },
    include: {
      product: {
        select: {
          id: true,
          partCode: true,
          description: true,
          quantity: true,
          installTargetDate: true,
          installStatus: true,
          project: {
            select: {
              id: true,
              projectNumber: true,
              name: true,
              priority: true,
              customer: { select: { name: true } },
              siteLocation: true,
            },
          },
        },
      },
      project: {
        select: {
          id: true,
          projectNumber: true,
          name: true,
          priority: true,
          customer: { select: { name: true } },
          siteLocation: true,
        },
      },
      crew: true,
    },
  })

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  return NextResponse.json(task)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  const task = await prisma.installationTask.findUnique({ where: { id } })
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  const allowedFields = [
    "assignedTo",
    "notes",
    "siteNotes",
    "weatherCondition",
    "crewId",
    "queuePosition",
    "estimatedMins",
    "status",
  ]
  const data: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field]
    }
  }

  const updated = await prisma.installationTask.update({
    where: { id },
    data,
  })

  if (data.status) {
    await logAudit({
      action: "UPDATE",
      entity: "InstallationTask",
      entityId: id,
      field: "status",
      oldValue: task.status,
      newValue: data.status as string,
    })
  }

  revalidatePath("/installation")
  revalidatePath("/installation/dashboard")

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const task = await prisma.installationTask.findUnique({ where: { id } })
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  await prisma.installationTask.delete({ where: { id } })

  await logAudit({
    action: "DELETE",
    entity: "InstallationTask",
    entityId: id,
    field: "stage",
    oldValue: task.stage,
  })

  revalidatePath("/installation")
  revalidatePath("/installation/dashboard")

  return NextResponse.json({ success: true })
}
