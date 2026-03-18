import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// GET /api/installation/crews/:id/equipment — List crew equipment
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const crew = await prisma.installCrew.findUnique({ where: { id } })
    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    const equipment = await prisma.crewEquipment.findMany({
      where: { crewId: id },
      orderBy: { name: "asc" },
    })

    return NextResponse.json(equipment)
  } catch (error) {
    console.error("Failed to fetch crew equipment:", error)
    return NextResponse.json({ error: "Failed to fetch crew equipment" }, { status: 500 })
  }
}

// POST /api/installation/crews/:id/equipment — Add equipment to crew
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { name, type, registration, notes } = body

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const crew = await prisma.installCrew.findUnique({ where: { id } })
    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    const equipment = await prisma.crewEquipment.create({
      data: {
        crewId: id,
        name,
        type: type || null,
        registration: registration || null,
        notes: notes || null,
      },
    })

    await logAudit({
      action: "CREATE",
      entity: "CrewEquipment",
      entityId: equipment.id,
      newValue: JSON.stringify({ crewId: id, crewName: crew.name, name, type, registration }),
    })

    revalidatePath("/installation")

    return NextResponse.json(equipment, { status: 201 })
  } catch (error) {
    console.error("Failed to add crew equipment:", error)
    return NextResponse.json({ error: "Failed to add crew equipment" }, { status: 500 })
  }
}
