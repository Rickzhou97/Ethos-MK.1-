import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, projectNumber: true, name: true } },
      supplier: { select: { id: true, name: true } },
      poLines: {
        orderBy: { createdAt: "asc" },
        include: { product: { select: { partCode: true, description: true } } },
      },
    },
  })
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(po)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  const data: Record<string, unknown> = {}
  if (body.status !== undefined) data.status = body.status
  if (body.supplierId !== undefined) data.supplierId = body.supplierId || null
  if (body.notes !== undefined) data.notes = body.notes
  if (body.totalValue !== undefined) data.totalValue = body.totalValue ? parseFloat(body.totalValue) : null
  if (body.dateSent !== undefined) data.dateSent = body.dateSent ? new Date(body.dateSent) : null
  if (body.expectedDelivery !== undefined) data.expectedDelivery = body.expectedDelivery ? new Date(body.expectedDelivery) : null

  const po = await prisma.purchaseOrder.update({ where: { id }, data })
  return NextResponse.json(po)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.purchaseOrder.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
