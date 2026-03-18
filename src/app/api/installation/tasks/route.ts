import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const crewId = searchParams.get("crewId")
  const projectId = searchParams.get("projectId")
  const stage = searchParams.get("stage")
  const status = searchParams.get("status")
  const productId = searchParams.get("productId")

  const where: Record<string, unknown> = {}
  if (crewId) where.crewId = crewId
  if (projectId) where.projectId = projectId
  if (stage) where.stage = stage
  if (status) where.status = status
  if (productId) where.productId = productId

  const tasks = await prisma.installationTask.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          partCode: true,
          description: true,
          quantity: true,
          installTargetDate: true,
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
    orderBy: { queuePosition: "asc" },
  })

  return NextResponse.json(tasks)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { productId, projectId, crewId, stage, assignedTo, estimatedMins, notes, siteNotes } = body

  if (!productId || !projectId || !stage) {
    return NextResponse.json(
      { error: "productId, projectId, and stage are required" },
      { status: 400 }
    )
  }

  // Auto-set queue position to max + 1
  const maxPos = await prisma.installationTask.findFirst({
    where: { stage },
    orderBy: { queuePosition: "desc" },
    select: { queuePosition: true },
  })
  const queuePosition = (maxPos?.queuePosition ?? -1) + 1

  const task = await prisma.installationTask.create({
    data: {
      productId,
      projectId,
      crewId: crewId || null,
      stage,
      queuePosition,
      assignedTo: assignedTo || null,
      estimatedMins: estimatedMins || null,
      notes: notes || null,
      siteNotes: siteNotes || null,
    },
  })

  await logAudit({
    action: "CREATE",
    entity: "InstallationTask",
    entityId: task.id,
    field: "stage",
    newValue: stage,
  })

  revalidatePath("/installation")
  revalidatePath("/installation/dashboard")

  return NextResponse.json(task, { status: 201 })
}
