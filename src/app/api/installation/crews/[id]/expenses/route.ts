import { prisma } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

// GET /api/installation/crews/:id/expenses — List crew expenses with summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const crew = await prisma.installCrew.findUnique({ where: { id } })
    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    // Build filters from query params
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const where: Record<string, unknown> = { crewId: id }
    if (category) where.category = category
    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      }
    }

    const expenses = await prisma.crewExpense.findMany({
      where,
      orderBy: { date: "desc" },
    })

    // Build summary
    const totalSpent = expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0
    )
    const budget = crew.budget ? Number(crew.budget) : null
    const remaining = budget !== null ? budget - totalSpent : null

    const byCategory: Record<string, number> = {}
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
    }

    return NextResponse.json({
      expenses,
      summary: {
        totalSpent,
        budget,
        remaining,
        expenseCount: expenses.length,
        byCategory,
      },
    })
  } catch (error) {
    console.error("Failed to fetch crew expenses:", error)
    return NextResponse.json({ error: "Failed to fetch crew expenses" }, { status: 500 })
  }
}

// POST /api/installation/crews/:id/expenses — Create expense
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json()
    const { category, description, amount, date, receiptRef, claimedBy, notes } = body

    if (!category || !description || amount === undefined) {
      return NextResponse.json(
        { error: "category, description, and amount are required" },
        { status: 400 }
      )
    }

    const crew = await prisma.installCrew.findUnique({ where: { id } })
    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    const expense = await prisma.crewExpense.create({
      data: {
        crewId: id,
        category,
        description,
        amount,
        date: date ? new Date(date) : new Date(),
        receiptRef: receiptRef || null,
        claimedBy: claimedBy || null,
        notes: notes || null,
      },
    })

    await logAudit({
      action: "CREATE",
      entity: "CrewExpense",
      entityId: expense.id,
      newValue: JSON.stringify({ crewId: id, crewName: crew.name, category, description, amount }),
    })

    revalidatePath("/installation")

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error("Failed to create crew expense:", error)
    return NextResponse.json({ error: "Failed to create crew expense" }, { status: 500 })
  }
}
