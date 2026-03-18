import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// GET /api/installation/crews/:id/members — List crew members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const showAll = request.nextUrl.searchParams.get("all") === "true"

  try {
    const crew = await prisma.installCrew.findUnique({ where: { id } })
    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    const where: Record<string, unknown> = { crewId: id }
    if (!showAll) {
      where.endDate = null
    }

    const members = await prisma.installCrewMember.findMany({
      where,
      include: {
        worker: { select: { id: true, name: true, role: true } },
      },
      orderBy: { startDate: "asc" },
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error("Failed to fetch crew members:", error)
    return NextResponse.json({ error: "Failed to fetch crew members" }, { status: 500 })
  }
}

// POST /api/installation/crews/:id/members — Add a member to the crew
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { workerId, role } = body

    if (!workerId) {
      return NextResponse.json({ error: "workerId is required" }, { status: 400 })
    }

    // Check crew exists
    const crew = await prisma.installCrew.findUnique({ where: { id } })
    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    // Check worker exists
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, name: true },
    })
    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    }

    const member = await prisma.installCrewMember.create({
      data: {
        crewId: id,
        workerId,
        role: role || null,
        startDate: new Date(),
      },
      include: {
        worker: { select: { id: true, name: true, role: true } },
      },
    })

    await logAudit({
      action: "CREATE",
      entity: "InstallCrewMember",
      entityId: member.id,
      newValue: JSON.stringify({ crewId: id, crewName: crew.name, workerId, workerName: worker.name, role }),
    })

    revalidatePath("/installation")

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error("Failed to add crew member:", error)
    return NextResponse.json({ error: "Failed to add crew member" }, { status: 500 })
  }
}
