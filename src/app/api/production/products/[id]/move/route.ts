import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { productionStatus } = body

  if (!productionStatus) {
    return NextResponse.json(
      { error: "productionStatus is required" },
      { status: 400 }
    )
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, productionStatus: true, projectId: true },
  })

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  await prisma.product.update({
    where: { id },
    data: { productionStatus },
  })

  await logAudit({
    action: "UPDATE",
    entity: "Product",
    entityId: id,
    field: "productionStatus",
    oldValue: product.productionStatus,
    newValue: productionStatus,
  })

  return NextResponse.json({ success: true })
}
