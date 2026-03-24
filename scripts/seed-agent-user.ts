import "dotenv/config"
import pg from "pg"
import { hash } from "bcryptjs"
import crypto from "crypto"

function cuid() {
  return "c" + crypto.randomBytes(12).toString("hex").slice(0, 24)
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const email = "openclaw-agent@ethos.ai"

  const existing = await pool.query("SELECT id, role FROM users WHERE email = $1", [email])
  if (existing.rows.length > 0) {
    console.log("Agent user already exists:", existing.rows[0].id, existing.rows[0].role)
    await pool.end()
    return
  }

  const id = cuid()
  const passwordHash = await hash("OpenClaw2026!Agent", 12)
  const now = new Date()

  await pool.query(
    `INSERT INTO users (id, name, email, "passwordHash", role, department, "mustChangePassword", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'AI_AGENT'::"UserRole", 'SALES'::"UserDepartment", $5, $6, $7)`,
    [id, "OpenClaw Agent", email, passwordHash, false, now, now]
  )

  console.log("Created agent user:", id, "OpenClaw Agent", "AI_AGENT")
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
