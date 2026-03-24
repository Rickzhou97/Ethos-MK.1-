import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey } from "@/lib/api-key-auth"

/** GET /api/nucleus/projects — read-only project lookup (limited fields) */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "projects:read")
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")
  const customerId = searchParams.get("customerId")
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100)

  const where: Record<string, unknown> = {}
  if (customerId) where.customerId = customerId
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { projectNumber: { contains: search, mode: "insensitive" } },
    ]
  }

  const projects = await prisma.project.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      status: true,
      customer: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ data: projects, count: projects.length })
}
