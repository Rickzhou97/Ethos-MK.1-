import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/api-auth"
import { generateApiKey, NUCLEUS_SCOPES } from "@/lib/api-key-auth"
import { prisma } from "@/lib/db"

/** POST /api/nucleus/keys — generate a new NUCLEUS API key (admin only) */
export async function POST(req: NextRequest) {
  const denied = await requirePermission("settings:admin")
  if (denied) return denied

  const body = await req.json()

  // Find the AI_AGENT user
  const agentUser = await prisma.user.findFirst({
    where: { role: "AI_AGENT" },
    select: { id: true },
  })

  if (!agentUser) {
    return NextResponse.json(
      { error: "No AI_AGENT user found. Create one first." },
      { status: 400 },
    )
  }

  const result = await generateApiKey({
    name: body.name || "NUCLEUS CRM Agent",
    userId: agentUser.id,
    scopes: NUCLEUS_SCOPES,
    expiresInDays: body.expiresInDays || 90,
  })

  return NextResponse.json({
    message: "API key generated. Copy the key now — it will not be shown again.",
    key: result.rawKey,
    keyPrefix: result.keyPrefix,
    id: result.id,
    scopes: NUCLEUS_SCOPES,
    expiresInDays: body.expiresInDays || 90,
  }, { status: 201 })
}

/** GET /api/nucleus/keys — list active keys (admin only, no secrets) */
export async function GET() {
  const denied = await requirePermission("settings:admin")
  if (denied) return denied

  const keys = await prisma.apiKey.findMany({
    where: { name: { contains: "NUCLEUS" } },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      active: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ data: keys })
}
