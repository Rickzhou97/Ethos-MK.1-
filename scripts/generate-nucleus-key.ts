import "dotenv/config"
import pg from "pg"
import { createHash } from "crypto"
import { randomUUID } from "crypto"

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

  // Ensure api_keys table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "keyHash" TEXT UNIQUE NOT NULL,
      "keyPrefix" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES users(id),
      scopes TEXT[] NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT true,
      "lastUsedAt" TIMESTAMPTZ,
      "expiresAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "revokedAt" TIMESTAMPTZ
    )
  `)

  // Find the AI_AGENT user
  const userResult = await pool.query(
    `SELECT id, name FROM users WHERE role = 'AI_AGENT' LIMIT 1`
  )
  if (userResult.rows.length === 0) {
    console.error("No AI_AGENT user found!")
    await pool.end()
    return
  }
  const agentUser = userResult.rows[0]

  // Generate key
  const rawKey = "nuc_" + createHash("sha256")
    .update(randomUUID() + Date.now())
    .digest("hex")
    .slice(0, 48)

  const keyHash = createHash("sha256").update(rawKey).digest("hex")
  const keyPrefix = rawKey.slice(0, 12)
  const id = "c" + createHash("md5").update(randomUUID()).digest("hex").slice(0, 24)

  const expiresAt = new Date(Date.now() + 90 * 86400000) // 90 days

  const scopes = [
    "prospects:read", "prospects:create",
    "opportunities:read", "opportunities:create",
    "customers:read",
    "projects:read",
  ]

  await pool.query(
    `INSERT INTO api_keys (id, name, "keyHash", "keyPrefix", "userId", scopes, active, "expiresAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, "NUCLEUS CRM Agent", keyHash, keyPrefix, agentUser.id, scopes, true, expiresAt]
  )

  console.log("=".repeat(60))
  console.log("NUCLEUS API KEY GENERATED")
  console.log("=".repeat(60))
  console.log("")
  console.log("Key (save this — it will NOT be shown again):")
  console.log("")
  console.log(`  ${rawKey}`)
  console.log("")
  console.log(`Prefix:    ${keyPrefix}`)
  console.log(`User:      ${agentUser.name} (${agentUser.id})`)
  console.log(`Scopes:    ${scopes.join(", ")}`)
  console.log(`Expires:   ${expiresAt.toISOString().slice(0, 10)}`)
  console.log("")
  console.log("Usage:")
  console.log(`  Authorization: Bearer ${rawKey}`)
  console.log("")
  console.log("=".repeat(60))

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
