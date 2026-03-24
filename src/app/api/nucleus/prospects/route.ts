import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey } from "@/lib/api-key-auth"
import { logAudit } from "@/lib/audit"

/** GET /api/nucleus/prospects — list prospects (read-only) */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "prospects:read")
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const search = searchParams.get("search")
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100)

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
    ]
  }

  const prospects = await prisma.prospect.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { opportunities: true } },
    },
  })

  return NextResponse.json({ data: prospects, count: prospects.length })
}

/** POST /api/nucleus/prospects — create a new prospect from WhatsApp capture */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, "prospects:create")
  if (auth instanceof NextResponse) return auth

  const body = await req.json()

  // Validate required fields
  if (!body.companyName || typeof body.companyName !== "string") {
    return NextResponse.json(
      { error: "companyName is required and must be a string" },
      { status: 400 },
    )
  }

  // Check for duplicate by company name (fuzzy)
  const existing = await prisma.prospect.findFirst({
    where: {
      companyName: { equals: body.companyName, mode: "insensitive" },
      status: { not: "DISQUALIFIED" },
    },
    select: { id: true, companyName: true, status: true },
  })

  if (existing) {
    return NextResponse.json(
      {
        error: "A prospect with this company name already exists",
        existingProspect: existing,
      },
      { status: 409 },
    )
  }

  const prospect = await prisma.prospect.create({
    data: {
      companyName: body.companyName,
      contactName: body.contactName || null,
      contactEmail: body.contactEmail || null,
      contactPhone: body.contactPhone || null,
      address: body.address || null,
      sector: body.sector || null,
      source: body.source || "OTHER",
      status: "ACTIVE",
      notes: body.notes
        ? `[NUCLEUS] ${body.notes}`
        : "[NUCLEUS] Created by AI agent",
    },
  })

  await logAudit({
    userId: auth.userId,
    userName: auth.userName,
    action: "CREATE",
    entity: "Prospect",
    entityId: prospect.id,
    metadata: `[NUCLEUS] ${prospect.companyName}`,
  })

  return NextResponse.json({ data: prospect }, { status: 201 })
}
