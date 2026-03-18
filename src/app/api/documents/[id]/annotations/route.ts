import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params

  const annotations = await prisma.documentAnnotation.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
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

  return NextResponse.json(annotations)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params

  try {
    const body = await request.json()
    const { productId, pageNumber, xPercent, yPercent, label, notes, pinType, metadata } = body

    if (xPercent == null || yPercent == null) {
      return NextResponse.json(
        { error: "xPercent and yPercent are required" },
        { status: 400 }
      )
    }

    // Verify document exists
    const document = await prisma.document.findUnique({ where: { id: documentId } })
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const annotation = await prisma.documentAnnotation.create({
      data: {
        documentId,
        productId: productId || null,
        pageNumber: pageNumber ?? 1,
        xPercent,
        yPercent,
        label: label || null,
        notes: notes || null,
        pinType: pinType || "PRODUCT",
        metadata: metadata || undefined,
      },
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

    return NextResponse.json(annotation, { status: 201 })
  } catch (error) {
    console.error("Error creating annotation:", error)
    return NextResponse.json({ error: "Failed to create annotation" }, { status: 500 })
  }
}
