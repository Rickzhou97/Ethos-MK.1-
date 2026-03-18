import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// PATCH /api/installation/crews/:id/instructions/:instrId — Update instruction
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instrId: string }> }
) {
  const { id, instrId } = await params

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.title !== undefined) data.title = body.title
    if (body.type !== undefined) data.type = body.type
    if (body.documentId !== undefined) data.documentId = body.documentId
    if (body.fileUrl !== undefined) data.fileUrl = body.fileUrl
    if (body.notes !== undefined) data.notes = body.notes

    const old = await prisma.crewInstruction.findFirst({
      where: { id: instrId, crewId: id },
    })
    if (!old) {
      return NextResponse.json({ error: "Instruction not found" }, { status: 404 })
    }

    const instruction = await prisma.crewInstruction.update({
      where: { id: instrId },
      data,
      include: {
        document: {
          select: { filename: true, filePath: true },
        },
      },
    })

    await logAudit({
      action: "UPDATE",
      entity: "CrewInstruction",
      entityId: instrId,
      oldValue: JSON.stringify({ title: old.title, type: old.type, documentId: old.documentId, fileUrl: old.fileUrl, notes: old.notes }),
      newValue: JSON.stringify(data),
      metadata: JSON.stringify({ crewId: id }),
    })

    revalidatePath("/installation")

    return NextResponse.json(instruction)
  } catch (error) {
    console.error("Failed to update instruction:", error)
    return NextResponse.json({ error: "Failed to update instruction" }, { status: 500 })
  }
}

// DELETE /api/installation/crews/:id/instructions/:instrId — Remove instruction
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; instrId: string }> }
) {
  const { id, instrId } = await params

  try {
    const instruction = await prisma.crewInstruction.findFirst({
      where: { id: instrId, crewId: id },
    })
    if (!instruction) {
      return NextResponse.json({ error: "Instruction not found" }, { status: 404 })
    }

    await prisma.crewInstruction.delete({ where: { id: instrId } })

    await logAudit({
      action: "DELETE",
      entity: "CrewInstruction",
      entityId: instrId,
      oldValue: JSON.stringify({ crewId: id, title: instruction.title, type: instruction.type, documentId: instruction.documentId }),
    })

    revalidatePath("/installation")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete instruction:", error)
    return NextResponse.json({ error: "Failed to delete instruction" }, { status: 500 })
  }
}
