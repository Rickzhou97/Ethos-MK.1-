import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// PATCH /api/installation/crews/:id/expenses/:expenseId — Update expense
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { id, expenseId } = await params

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.category !== undefined) data.category = body.category
    if (body.description !== undefined) data.description = body.description
    if (body.amount !== undefined) data.amount = body.amount
    if (body.date !== undefined) data.date = new Date(body.date)
    if (body.receiptRef !== undefined) data.receiptRef = body.receiptRef
    if (body.claimedBy !== undefined) data.claimedBy = body.claimedBy
    if (body.approved !== undefined) data.approved = body.approved
    if (body.notes !== undefined) data.notes = body.notes

    const old = await prisma.crewExpense.findFirst({
      where: { id: expenseId, crewId: id },
    })
    if (!old) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    const expense = await prisma.crewExpense.update({
      where: { id: expenseId },
      data,
    })

    await logAudit({
      action: "UPDATE",
      entity: "CrewExpense",
      entityId: expenseId,
      oldValue: JSON.stringify({
        category: old.category,
        description: old.description,
        amount: old.amount,
        date: old.date,
        receiptRef: old.receiptRef,
        claimedBy: old.claimedBy,
        approved: old.approved,
        notes: old.notes,
      }),
      newValue: JSON.stringify(data),
      metadata: JSON.stringify({ crewId: id }),
    })

    revalidatePath("/installation")

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Failed to update expense:", error)
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 })
  }
}

// DELETE /api/installation/crews/:id/expenses/:expenseId — Delete expense
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { id, expenseId } = await params

  try {
    const expense = await prisma.crewExpense.findFirst({
      where: { id: expenseId, crewId: id },
    })
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    await prisma.crewExpense.delete({ where: { id: expenseId } })

    await logAudit({
      action: "DELETE",
      entity: "CrewExpense",
      entityId: expenseId,
      oldValue: JSON.stringify({
        crewId: id,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        claimedBy: expense.claimedBy,
      }),
    })

    revalidatePath("/installation")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete expense:", error)
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 })
  }
}
