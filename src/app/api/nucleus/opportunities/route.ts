import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey } from "@/lib/api-key-auth"
import { logAudit } from "@/lib/audit"

/** GET /api/nucleus/opportunities — list opportunities (read-only) */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "opportunities:read")
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const prospectId = searchParams.get("prospectId")
  const status = searchParams.get("status")
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100)

  const where: Record<string, unknown> = {}
  if (prospectId) where.prospectId = prospectId
  if (status) where.status = status

  const opportunities = await prisma.opportunity.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      prospectId: true,
      name: true,
      description: true,
      estimatedValue: true,
      contactPerson: true,
      leadSource: true,
      status: true,
      expectedCloseDate: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      prospect: { select: { id: true, companyName: true } },
    },
  })

  return NextResponse.json({ data: opportunities, count: opportunities.length })
}

/** POST /api/nucleus/opportunities — create an opportunity under an existing prospect */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, "opportunities:create")
  if (auth instanceof NextResponse) return auth

  const body = await req.json()

  // Validate
  if (!body.prospectId || typeof body.prospectId !== "string") {
    return NextResponse.json(
      { error: "prospectId is required" },
      { status: 400 },
    )
  }
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json(
      { error: "name is required (opportunity title)" },
      { status: 400 },
    )
  }

  // Verify prospect exists
  const prospect = await prisma.prospect.findUnique({
    where: { id: body.prospectId },
    select: { id: true, companyName: true, status: true },
  })

  if (!prospect) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 })
  }

  if (prospect.status === "DISQUALIFIED") {
    return NextResponse.json(
      { error: "Cannot add opportunity to a disqualified prospect" },
      { status: 400 },
    )
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      prospectId: body.prospectId,
      name: body.name,
      description: body.description || null,
      estimatedValue: body.estimatedValue || null,
      contactPerson: body.contactPerson || null,
      leadSource: body.leadSource || "OTHER",
      status: "ACTIVE_LEAD",
      expectedCloseDate: body.expectedCloseDate
        ? new Date(body.expectedCloseDate)
        : null,
      notes: body.notes
        ? `[NUCLEUS] ${body.notes}`
        : "[NUCLEUS] Created by AI agent",
    },
  })

  await logAudit({
    userId: auth.userId,
    userName: auth.userName,
    action: "CREATE",
    entity: "Opportunity",
    entityId: opportunity.id,
    metadata: `[NUCLEUS] ${opportunity.name} for ${prospect.companyName}`,
  })

  return NextResponse.json({ data: opportunity }, { status: 201 })
}
