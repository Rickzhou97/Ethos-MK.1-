import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

// PATCH /api/installation/equipment/:id — Reassign equipment between crews / pool
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { crewId } = body as { crewId: string | null }

    const equipment = await prisma.crewEquipment.findUnique({
      where: { id },
    })
    if (!equipment) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 })
    }

    const oldCrewId = equipment.crewId

    const updated = await prisma.crewEquipment.update({
      where: { id },
      data: { crewId },
    })

    await logAudit({
      action: "UPDATE",
      entity: "CrewEquipment",
      entityId: id,
      oldValue: JSON.stringify({ crewId: oldCrewId }),
      newValue: JSON.stringify({ crewId }),
      metadata: JSON.stringify({ reassignment: true }),
    })

    revalidatePath("/installation")

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Failed to reassign equipment:", error)
    return NextResponse.json({ error: "Failed to reassign equipment" }, { status: 500 })
  }
}
