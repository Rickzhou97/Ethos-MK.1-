import { prisma } from "@/lib/db"
import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { logAudit } from "@/lib/audit"

export type NucleusScope =
  | "prospects:read" | "prospects:create"
  | "opportunities:read" | "opportunities:create" | "opportunities:update"
  | "customers:read"
  | "projects:read"

/** All scopes available to NUCLEUS */
export const NUCLEUS_SCOPES: NucleusScope[] = [
  "prospects:read", "prospects:create",
  "opportunities:read", "opportunities:create", "opportunities:update",
  "customers:read",
  "projects:read",
]

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

type ApiKeyResult = {
  id: string
  name: string
  userId: string
  userName: string
  scopes: string[]
}

/**
 * Validate a Bearer token from the Authorization header against api_keys table.
 * Returns the resolved key info, or a 401/403 NextResponse.
 */
export async function authenticateApiKey(
  req: NextRequest,
  requiredScope: NucleusScope,
): Promise<ApiKeyResult | NextResponse> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 },
    )
  }

  const rawKey = authHeader.slice(7)
  const keyHash = hashKey(rawKey)

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, name: true, role: true } } },
  })

  if (!apiKey || !apiKey.active) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 })
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return NextResponse.json({ error: "API key has expired" }, { status: 401 })
  }

  if (!apiKey.scopes.includes(requiredScope)) {
    return NextResponse.json(
      { error: `API key does not have scope: ${requiredScope}` },
      { status: 403 },
    )
  }

  // Update last used (fire and forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return {
    id: apiKey.id,
    name: apiKey.name,
    userId: apiKey.user.id,
    userName: apiKey.user.name,
    scopes: apiKey.scopes,
  }
}

/** Generate a new API key. Returns the raw key (only shown once). */
export async function generateApiKey(opts: {
  name: string
  userId: string
  scopes: NucleusScope[]
  expiresInDays?: number
}): Promise<{ rawKey: string; keyPrefix: string; id: string }> {
  const rawKey = "nuc_" + createHash("sha256")
    .update(crypto.randomUUID() + Date.now())
    .digest("hex")
    .slice(0, 48)

  const keyHash = hashKey(rawKey)
  const keyPrefix = rawKey.slice(0, 12)

  const expiresAt = opts.expiresInDays
    ? new Date(Date.now() + opts.expiresInDays * 86400000)
    : null

  const apiKey = await prisma.apiKey.create({
    data: {
      name: opts.name,
      keyHash,
      keyPrefix,
      userId: opts.userId,
      scopes: opts.scopes,
      expiresAt,
    },
  })

  await logAudit({
    userId: opts.userId,
    action: "CREATE",
    entity: "ApiKey",
    entityId: apiKey.id,
    metadata: `API key created: ${opts.name} (${keyPrefix}...)`,
  })

  return { rawKey, keyPrefix, id: apiKey.id }
}
