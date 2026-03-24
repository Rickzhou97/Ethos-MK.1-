import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { authenticateApiKey } from "@/lib/api-key-auth"
import { logAudit } from "@/lib/audit"

/** PATCH /api/nucleus/opportunities/[id] — append a note or update status on an existing opportunity */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiKey(req, "opportunities:update")
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await req.json()

  const existing = await prisma.opportunity.findUnique({
    where: { id },
    select: { id: true, notes: true, prospectId: true, prospect: { select: { companyName: true } } },
  })

  if (!existing) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}

  // Append new note to existing notes
  if (body.notes) {
    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ")
    const newNote = `[NUCLEUS ${timestamp}] ${body.notes}`
    updateData.notes = existing.notes
      ? `${existing.notes}\n\n${newNote}`
      : newNote
  }

  // Allow status update if provided
  if (body.status) {
    updateData.status = body.status
  }

  // Allow estimated value update
  if (body.estimatedValue !== undefined) {
    updateData.estimatedValue = body.estimatedValue ? parseFloat(body.estimatedValue) : null
  }

  const opportunity = await prisma.opportunity.update({
    where: { id },
    data: updateData,
  })

  await logAudit({
    userId: auth.userId,
    userName: auth.userName,
    action: "UPDATE",
    entity: "Opportunity",
    entityId: opportunity.id,
    metadata: `[NUCLEUS] Appended update to ${existing.prospect.companyName}`,
  })

  return NextResponse.json({ data: opportunity })
}
