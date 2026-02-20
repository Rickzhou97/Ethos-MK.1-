import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"
import { canStartJob } from "@/lib/design-utils"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Fetch job card with sibling job cards via the parent design card
  const jobCard = await prisma.designJobCard.findUnique({
    where: { id },
    include: {
      designCard: {
        include: {
          jobCards: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  })

  if (!jobCard) {
    return NextResponse.json({ error: "Job card not found" }, { status: 404 })
  }

  if (jobCard.status !== "READY") {
    return NextResponse.json(
      { error: `Cannot start job card: current status is ${jobCard.status}, expected READY` },
      { status: 400 }
    )
  }

  // Validate dependency is met
  const siblingCards = jobCard.designCard.jobCards
  if (!canStartJob(jobCard.jobType, siblingCards)) {
    return NextResponse.json(
      { error: "Cannot start this job: prerequisite job has not been approved or signed off" },
      { status: 400 }
    )
  }

  const now = new Date()

  // Update job card status to IN_PROGRESS
  const updated = await prisma.designJobCard.update({
    where: { id },
    data: {
      status: "IN_PROGRESS",
      startedAt: now,
    },
  })

  // If the parent design card is still QUEUED, move it to IN_PROGRESS
  if (jobCard.designCard.status === "QUEUED") {
    await prisma.productDesignCard.update({
      where: { id: jobCard.designCardId },
      data: {
        status: "IN_PROGRESS",
        actualStartDate: now,
      },
    })
  }

  await logAudit({
    action: "UPDATE",
    entity: "DesignJobCard",
    entityId: id,
    field: "status",
    oldValue: "READY",
    newValue: "IN_PROGRESS",
    metadata: JSON.stringify({ designCardId: jobCard.designCardId }),
  })

  return NextResponse.json(updated)
}
