import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// PATCH /api/installation/crews/:id/equipment/:equipId — Update equipment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; equipId: string }> }
) {
  const { id, equipId } = await params

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.name !== undefined) data.name = body.name
    if (body.type !== undefined) data.type = body.type
    if (body.registration !== undefined) data.registration = body.registration
    if (body.notes !== undefined) data.notes = body.notes
    if (body.isAvailable !== undefined) data.isAvailable = body.isAvailable

    const old = await prisma.crewEquipment.findFirst({
      where: { id: equipId, crewId: id },
    })
    if (!old) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 })
    }

    const equipment = await prisma.crewEquipment.update({
      where: { id: equipId },
      data,
    })

    await logAudit({
      action: "UPDATE",
      entity: "CrewEquipment",
      entityId: equipId,
      oldValue: JSON.stringify({ name: old.name, type: old.type, registration: old.registration, notes: old.notes, isAvailable: old.isAvailable }),
      newValue: JSON.stringify(data),
      metadata: JSON.stringify({ crewId: id }),
    })

    revalidatePath("/installation")

    return NextResponse.json(equipment)
  } catch (error) {
    console.error("Failed to update equipment:", error)
    return NextResponse.json({ error: "Failed to update equipment" }, { status: 500 })
  }
}

// DELETE /api/installation/crews/:id/equipment/:equipId — Remove equipment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; equipId: string }> }
) {
  const { id, equipId } = await params

  try {
    const equipment = await prisma.crewEquipment.findFirst({
      where: { id: equipId, crewId: id },
    })
    if (!equipment) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 })
    }

    await prisma.crewEquipment.delete({ where: { id: equipId } })

    await logAudit({
      action: "DELETE",
      entity: "CrewEquipment",
      entityId: equipId,
      oldValue: JSON.stringify({ crewId: id, name: equipment.name, type: equipment.type, registration: equipment.registration }),
    })

    revalidatePath("/installation")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete equipment:", error)
    return NextResponse.json({ error: "Failed to delete equipment" }, { status: 500 })
  }
}
