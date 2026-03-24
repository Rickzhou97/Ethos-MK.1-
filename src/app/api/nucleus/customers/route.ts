import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey } from "@/lib/api-key-auth"

/** GET /api/nucleus/customers — read-only customer lookup */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "customers:read")
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100)

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ]
  }

  const customers = await prisma.customer.findMany({
    where,
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      customerType: true,
      address: true,
      phone: true,
      email: true,
      contacts: {
        select: { id: true, name: true, role: true, phone: true, email: true },
      },
      _count: { select: { projects: true } },
    },
  })

  return NextResponse.json({ data: customers, count: customers.length })
}
