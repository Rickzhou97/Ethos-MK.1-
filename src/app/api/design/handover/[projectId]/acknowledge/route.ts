import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

// POST /api/design/handover/[projectId]/acknowledge — Production Manager acknowledges handover
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params

  try {
    const body = await request.json()
    const { receivedById } = body

    // Fetch existing handover
    const handover = await prisma.designHandover.findUnique({
      where: { projectId },
    })

    if (!handover) {
      return NextResponse.json(
        { error: "No handover found for this project" },
        { status: 404 }
      )
    }

    if (handover.status !== "SUBMITTED") {
      return NextResponse.json(
        {
          error: `Handover status is ${handover.status}, only SUBMITTED handovers can be acknowledged`,
        },
        { status: 400 }
      )
    }

    const now = new Date()

    // Update handover to ACKNOWLEDGED
    const updatedHandover = await prisma.designHandover.update({
      where: { projectId },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: now,
        receivedById: receivedById || null,
      },
      include: {
        initiatedBy: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, name: true } },
      },
    })

    // Advance the project: set p3Date, projectStatus to MANUFACTURE, reset departmentStatus
    await prisma.project.update({
      where: { id: projectId },
      data: {
        p3Date: now,
        projectStatus: "MANUFACTURE",
        departmentStatus: "TODO",
      },
    })

    // Log audit for handover acknowledgement
    await logAudit({
      userId: receivedById,
      action: "UPDATE",
      entity: "DesignHandover",
      entityId: updatedHandover.id,
      field: "status",
      oldValue: "SUBMITTED",
      newValue: "ACKNOWLEDGED",
      metadata: JSON.stringify({ projectId }),
    })

    // Log audit for project status advancement
    await logAudit({
      userId: receivedById,
      action: "UPDATE",
      entity: "Project",
      entityId: projectId,
      field: "projectStatus",
      oldValue: "DESIGN",
      newValue: "MANUFACTURE",
      metadata: JSON.stringify({
        trigger: "DesignHandover acknowledged",
        handoverId: updatedHandover.id,
      }),
    })

    return NextResponse.json(JSON.parse(JSON.stringify(updatedHandover)))
  } catch (error) {
    console.error("Failed to acknowledge design handover:", error)
    return NextResponse.json(
      { error: "Failed to acknowledge design handover" },
      { status: 500 }
    )
  }
}
