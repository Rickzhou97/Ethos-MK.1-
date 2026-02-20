import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

// POST /api/design/jobs/:id/assign — Assign a designer to a specific job card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let designerId: string
  try {
    const body = await request.json()
    designerId = body.designerId
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!designerId) {
    return NextResponse.json({ error: "designerId is required" }, { status: 400 })
  }

  const jobCard = await prisma.designJobCard.findUnique({
    where: { id },
    include: {
      designCard: {
        select: { id: true, assignedDesignerId: true, projectId: true, status: true },
      },
    },
  })

  if (!jobCard) {
    return NextResponse.json({ error: "Job card not found" }, { status: 404 })
  }

  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    select: { id: true, name: true },
  })

  if (!designer) {
    return NextResponse.json({ error: "Designer not found" }, { status: 404 })
  }

  const oldAssignedToId = jobCard.assignedToId

  // Update job card assignment
  const updated = await prisma.designJobCard.update({
    where: { id },
    data: { assignedToId: designerId },
  })

  // Always update the design card's assigned designer to keep workload board in sync
  await prisma.productDesignCard.update({
    where: { id: jobCard.designCardId },
    data: { assignedDesignerId: designerId },
  })

  await logAudit({
    action: "UPDATE",
    entity: "DesignJobCard",
    entityId: id,
    field: "assignedToId",
    oldValue: oldAssignedToId,
    newValue: designerId,
    metadata: JSON.stringify({
      designerName: designer.name,
      jobType: jobCard.jobType,
      designCardId: jobCard.designCardId,
    }),
  })

  return NextResponse.json(updated)
}
