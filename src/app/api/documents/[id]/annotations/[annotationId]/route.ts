import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const { annotationId } = await params

  try {
    const body = await request.json()
    const { xPercent, yPercent, label, notes, metadata } = body

    const data: Record<string, unknown> = {}
    if (xPercent != null) data.xPercent = xPercent
    if (yPercent != null) data.yPercent = yPercent
    if (label !== undefined) data.label = label
    if (notes !== undefined) data.notes = notes
    if (metadata !== undefined) data.metadata = metadata

    const annotation = await prisma.documentAnnotation.update({
      where: { id: annotationId },
      data,
      include: {
        product: {
          select: {
            id: true,
            partCode: true,
            description: true,
            installStatus: true,
            installTargetDate: true,
            installPlannedStart: true,
            installCompletionDate: true,
            installEstimatedHours: true,
            ncrs: {
              where: { status: { in: ["OPEN", "INVESTIGATING"] } },
              select: {
                id: true,
                ncrNumber: true,
                title: true,
                severity: true,
                status: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(annotation)
  } catch (error) {
    console.error("Error updating annotation:", error)
    return NextResponse.json({ error: "Failed to update annotation" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const { annotationId } = await params

  try {
    await prisma.documentAnnotation.delete({ where: { id: annotationId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting annotation:", error)
    return NextResponse.json({ error: "Failed to delete annotation" }, { status: 500 })
  }
}
