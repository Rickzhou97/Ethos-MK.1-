import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// PATCH /api/installation/crews/:id/members/:memberId — Update member role or deactivate
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.role !== undefined) data.role = body.role
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null

    const old = await prisma.installCrewMember.findFirst({
      where: { id: memberId, crewId: id },
      include: { worker: { select: { name: true } } },
    })
    if (!old) {
      return NextResponse.json({ error: "Crew member not found" }, { status: 404 })
    }

    const member = await prisma.installCrewMember.update({
      where: { id: memberId },
      data,
      include: {
        worker: { select: { id: true, name: true, role: true } },
      },
    })

    await logAudit({
      action: "UPDATE",
      entity: "InstallCrewMember",
      entityId: memberId,
      oldValue: JSON.stringify({ role: old.role, endDate: old.endDate }),
      newValue: JSON.stringify(data),
      metadata: JSON.stringify({ crewId: id, workerName: old.worker.name }),
    })

    revalidatePath("/installation")

    return NextResponse.json(member)
  } catch (error) {
    console.error("Failed to update crew member:", error)
    return NextResponse.json({ error: "Failed to update crew member" }, { status: 500 })
  }
}

// DELETE /api/installation/crews/:id/members/:memberId — Remove member record
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params

  try {
    const member = await prisma.installCrewMember.findFirst({
      where: { id: memberId, crewId: id },
      include: { worker: { select: { name: true } } },
    })
    if (!member) {
      return NextResponse.json({ error: "Crew member not found" }, { status: 404 })
    }

    await prisma.installCrewMember.delete({ where: { id: memberId } })

    await logAudit({
      action: "DELETE",
      entity: "InstallCrewMember",
      entityId: memberId,
      oldValue: JSON.stringify({ crewId: id, workerId: member.workerId, workerName: member.worker.name, role: member.role }),
    })

    revalidatePath("/installation")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to remove crew member:", error)
    return NextResponse.json({ error: "Failed to remove crew member" }, { status: 500 })
  }
}
