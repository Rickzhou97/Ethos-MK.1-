import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// GET /api/installation/crews — List all crews with active member count
export async function GET() {
  try {
    const crews = await prisma.installCrew.findMany({
      orderBy: { name: "asc" },
      include: {
        members: {
          where: { endDate: null },
          include: {
            worker: { select: { id: true, name: true } },
          },
        },
      },
    })

    const result = crews.map((crew) => ({
      ...crew,
      memberCount: crew.members.length,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Failed to fetch crews:", error)
    return NextResponse.json({ error: "Failed to fetch crews" }, { status: 500 })
  }
}

// POST /api/installation/crews — Create a new crew
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, code, notes } = body

    if (!name || !code) {
      return NextResponse.json({ error: "name and code are required" }, { status: 400 })
    }

    // Check code uniqueness
    const existing = await prisma.installCrew.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: "A crew with this code already exists" }, { status: 409 })
    }

    const crew = await prisma.installCrew.create({
      data: {
        name,
        code,
        notes: notes || null,
      },
    })

    await logAudit({
      action: "CREATE",
      entity: "InstallCrew",
      entityId: crew.id,
      newValue: JSON.stringify({ name, code }),
    })

    revalidatePath("/installation")

    return NextResponse.json(crew, { status: 201 })
  } catch (error) {
    console.error("Failed to create crew:", error)
    return NextResponse.json({ error: "Failed to create crew" }, { status: 500 })
  }
}
