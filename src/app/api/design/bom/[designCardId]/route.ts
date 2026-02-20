import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

// Default BOM template for flood barrier products (used when no catalogue match)
const DEFAULT_BOM_TEMPLATE = [
  { description: "Steel Frame", category: "MATERIALS", unitCost: 380, sortOrder: 1 },
  { description: "Panel / Leaf", category: "MATERIALS", unitCost: 520, sortOrder: 2 },
  { description: "Hinge Set", category: "HARDWARE", unitCost: 95, sortOrder: 3 },
  { description: "Lock / Latch Assembly", category: "HARDWARE", unitCost: 145, sortOrder: 4 },
  { description: "Seal Kit", category: "SEALS", unitCost: 65, sortOrder: 5 },
  { description: "Threshold / Cill", category: "MATERIALS", unitCost: 110, sortOrder: 6 },
  { description: "Galvanising / Finish", category: "FINISH", unitCost: 180, sortOrder: 7 },
  { description: "Fixings Pack", category: "HARDWARE", unitCost: 35, sortOrder: 8 },
  { description: "Labour — Fabrication", category: "LABOUR", unitCost: 320, sortOrder: 9 },
  { description: "Labour — Assembly & Test", category: "LABOUR", unitCost: 180, sortOrder: 10 },
]

// Try to find catalogue BaseBomItems for a product and auto-create DesignBomLines
async function autoPopulateBom(designCardId: string, productId: string): Promise<void> {
  // 1. Try via product's catalogueItemId → ProductCatalogue → variants → baseBomItems
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { catalogueItemId: true, description: true },
  })
  if (!product) return

  let baseBomItems: Array<{ description: string; category: string; stockCode: string | null; unitCost: unknown; quantity: unknown; sortOrder: number }> = []

  if (product.catalogueItemId) {
    const variants = await prisma.productVariant.findMany({
      where: { catalogueItemId: product.catalogueItemId },
      include: { baseBomItems: { orderBy: { sortOrder: "asc" } } },
      take: 1,
    })
    if (variants.length > 0 && variants[0].baseBomItems.length > 0) {
      baseBomItems = variants[0].baseBomItems
    }
  }

  // 2. Fallback: fuzzy match product description to ProductType name
  if (baseBomItems.length === 0) {
    const desc = product.description.toLowerCase()
    const types = await prisma.productType.findMany({
      select: { id: true, name: true },
    })
    const matched = types.find((t) => {
      const words = t.name.toLowerCase().split(" ")
      return words.every((w) => desc.includes(w))
    })
    if (matched) {
      const variant = await prisma.productVariant.findFirst({
        where: { typeId: matched.id },
        include: { baseBomItems: { orderBy: { sortOrder: "asc" } } },
      })
      if (variant && variant.baseBomItems.length > 0) {
        baseBomItems = variant.baseBomItems
      }
    }
  }

  // 3. Build the BOM lines to create
  const lineData = baseBomItems.length > 0
    ? baseBomItems.map((item, i) => ({
        designCardId,
        description: item.description,
        category: item.category,
        partNumber: item.stockCode || null,
        quantity: Number(item.quantity) || 1,
        unitCost: Number(item.unitCost) || 0,
        unit: "each",
        sortOrder: i,
      }))
    : DEFAULT_BOM_TEMPLATE.map((item) => ({
        designCardId,
        description: item.description,
        category: item.category,
        partNumber: null,
        quantity: 1,
        unitCost: item.unitCost,
        unit: "each",
        sortOrder: item.sortOrder,
      }))

  // Bulk create
  await prisma.designBomLine.createMany({ data: lineData })
}

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

  // Auto-populate from catalogue on first load
  if (designCard.bomLines.length === 0) {
    await autoPopulateBom(designCardId, designCard.product.id)
    // Re-fetch with newly created lines
    const refreshed = await prisma.productDesignCard.findUnique({
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
    return NextResponse.json(JSON.parse(JSON.stringify(refreshed)))
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
