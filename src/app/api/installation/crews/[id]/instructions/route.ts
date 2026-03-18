import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// GET /api/installation/crews/:id/instructions — List crew instructions
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

    const instructions = await prisma.crewInstruction.findMany({
      where: { crewId: id },
      include: {
        document: {
          select: { filename: true, filePath: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(instructions)
  } catch (error) {
    console.error("Failed to fetch crew instructions:", error)
    return NextResponse.json({ error: "Failed to fetch crew instructions" }, { status: 500 })
  }
}

// POST /api/installation/crews/:id/instructions — Add instruction to crew
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { title, type, documentId, fileUrl, notes } = body

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    const crew = await prisma.installCrew.findUnique({ where: { id } })
    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    const instruction = await prisma.crewInstruction.create({
      data: {
        crewId: id,
        title,
        type: type || null,
        documentId: documentId || null,
        fileUrl: fileUrl || null,
        notes: notes || null,
      },
      include: {
        document: {
          select: { filename: true, filePath: true },
        },
      },
    })

    await logAudit({
      action: "CREATE",
      entity: "CrewInstruction",
      entityId: instruction.id,
      newValue: JSON.stringify({ crewId: id, crewName: crew.name, title, type, documentId, fileUrl }),
    })

    revalidatePath("/installation")

    return NextResponse.json(instruction, { status: 201 })
  } catch (error) {
    console.error("Failed to add crew instruction:", error)
    return NextResponse.json({ error: "Failed to add crew instruction" }, { status: 500 })
  }
}
