import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// GET /api/design/bom/:designCardId — Get all BOM lines for a design card
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ designCardId: string }> }
) {
  const { designCardId } = await params

  const designCard = await prisma.productDesignCard.findUnique({
    where: { id: designCardId },
    select: {
      id: true,
      product: {
        select: { id: true, description: true, partCode: true, productJobNumber: true },
      },
      bomLines: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!designCard) {
    return NextResponse.json({ error: "Design card not found" }, { status: 404 })
  }

  return NextResponse.json(JSON.parse(JSON.stringify(designCard)))
}

// POST /api/design/bom/:designCardId — Add a BOM line
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ designCardId: string }> }
) {
  const { designCardId } = await params

  const card = await prisma.productDesignCard.findUnique({ where: { id: designCardId } })
  if (!card) {
    return NextResponse.json({ error: "Design card not found" }, { status: 404 })
  }

  const body = await request.json()

  // Get next sort order
  const lastLine = await prisma.designBomLine.findFirst({
    where: { designCardId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })
  const nextSort = (lastLine?.sortOrder ?? -1) + 1

  const line = await prisma.designBomLine.create({
    data: {
      designCardId,
      description: body.description || "New item",
      category: body.category || "MATERIALS",
      partNumber: body.partNumber || null,
      supplier: body.supplier || null,
      quantity: body.quantity ?? 1,
      unit: body.unit || "each",
      unitCost: body.unitCost ?? 0,
      notes: body.notes || null,
      sortOrder: nextSort,
    },
  })

  return NextResponse.json(JSON.parse(JSON.stringify(line)), { status: 201 })
}

// PATCH /api/design/bom/:designCardId — Update a BOM line (pass line id in body)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ designCardId: string }> }
) {
  const { designCardId } = await params
  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: "Line id is required" }, { status: 400 })
  }

  // Verify the line belongs to this design card
  const existing = await prisma.designBomLine.findFirst({
    where: { id: body.id, designCardId },
  })
  if (!existing) {
    return NextResponse.json({ error: "BOM line not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.description !== undefined) data.description = body.description
  if (body.category !== undefined) data.category = body.category
  if (body.partNumber !== undefined) data.partNumber = body.partNumber || null
  if (body.supplier !== undefined) data.supplier = body.supplier || null
  if (body.quantity !== undefined) data.quantity = body.quantity
  if (body.unit !== undefined) data.unit = body.unit
  if (body.unitCost !== undefined) data.unitCost = body.unitCost
  if (body.notes !== undefined) data.notes = body.notes || null
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder

  const updated = await prisma.designBomLine.update({
    where: { id: body.id },
    data,
  })

  return NextResponse.json(JSON.parse(JSON.stringify(updated)))
}

// DELETE /api/design/bom/:designCardId — Delete a BOM line (pass line id in query)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ designCardId: string }> }
) {
  const { designCardId } = await params
  const { searchParams } = new URL(request.url)
  const lineId = searchParams.get("lineId")

  if (!lineId) {
    return NextResponse.json({ error: "lineId query param is required" }, { status: 400 })
  }

  const existing = await prisma.designBomLine.findFirst({
    where: { id: lineId, designCardId },
  })
  if (!existing) {
    return NextResponse.json({ error: "BOM line not found" }, { status: 404 })
  }

  await prisma.designBomLine.delete({ where: { id: lineId } })

  return NextResponse.json({ success: true })
}
