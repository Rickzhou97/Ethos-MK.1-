import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// GET /api/installation/crews/:id — Single crew with members and worker details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const crew = await prisma.installCrew.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            worker: { select: { id: true, name: true, role: true } },
          },
          orderBy: { startDate: "asc" },
        },
      },
    })

    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    return NextResponse.json(crew)
  } catch (error) {
    console.error("Failed to fetch crew:", error)
    return NextResponse.json({ error: "Failed to fetch crew" }, { status: 500 })
  }
}

// PATCH /api/installation/crews/:id — Update crew details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.name !== undefined) data.name = body.name
    if (body.code !== undefined) data.code = body.code
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.notes !== undefined) data.notes = body.notes

    // If updating code, check uniqueness
    if (body.code !== undefined) {
      const existing = await prisma.installCrew.findFirst({
        where: { code: body.code, id: { not: id } },
      })
      if (existing) {
        return NextResponse.json({ error: "A crew with this code already exists" }, { status: 409 })
      }
    }

    const old = await prisma.installCrew.findUnique({ where: { id } })
    if (!old) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    const crew = await prisma.installCrew.update({ where: { id }, data })

    await logAudit({
      action: "UPDATE",
      entity: "InstallCrew",
      entityId: id,
      oldValue: JSON.stringify({ name: old.name, code: old.code, isActive: old.isActive, notes: old.notes }),
      newValue: JSON.stringify(data),
    })

    revalidatePath("/installation")

    return NextResponse.json(crew)
  } catch (error) {
    console.error("Failed to update crew:", error)
    return NextResponse.json({ error: "Failed to update crew" }, { status: 500 })
  }
}

// DELETE /api/installation/crews/:id — Delete crew (cascade handles members)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const crew = await prisma.installCrew.findUnique({ where: { id } })
    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    await prisma.installCrew.delete({ where: { id } })

    await logAudit({
      action: "DELETE",
      entity: "InstallCrew",
      entityId: id,
      oldValue: JSON.stringify({ name: crew.name, code: crew.code }),
    })

    revalidatePath("/installation")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete crew:", error)
    return NextResponse.json({ error: "Failed to delete crew" }, { status: 500 })
  }
}
