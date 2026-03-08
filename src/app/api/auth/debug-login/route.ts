import { prisma } from "@/lib/db"
import { compare, hash } from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"

// TEMPORARY debug endpoint — remove after fixing login
export async function POST(request: NextRequest) {
  try {
    const { email, password, resetPassword } = await request.json()

    // Step 1: Check DB connection
    const userCount = await prisma.user.count()

    // Step 2: Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
      },
    })

    if (!user) {
      return NextResponse.json({
        step: "user_lookup",
        error: "User not found",
        totalUsers: userCount,
        emailSearched: email,
      })
    }

    // Step 3: If resetPassword flag is set, update the password via raw SQL
    if (resetPassword) {
      const newHash = await hash(password, 10)
      await prisma.$executeRawUnsafe(
        `UPDATE "users" SET "passwordHash" = $1 WHERE "id" = $2`,
        newHash,
        user.id
      )
      // Re-fetch to verify
      const updated = await prisma.user.findUnique({
        where: { email },
        select: { passwordHash: true },
      })
      const verifyValid = updated ? await compare(password, updated.passwordHash) : false
      return NextResponse.json({
        step: "password_reset",
        success: true,
        userName: user.name,
        verifyValid,
      })
    }

    // Step 4: Check password hash exists
    if (!user.passwordHash) {
      return NextResponse.json({
        step: "password_hash",
        error: "No password hash stored",
        userName: user.name,
      })
    }

    // Step 5: Compare password
    const hashPreview = user.passwordHash.substring(0, 10) + "..."
    const isValid = await compare(password, user.passwordHash)

    return NextResponse.json({
      step: "complete",
      userFound: true,
      userName: user.name,
      userRole: user.role,
      hashExists: true,
      hashPreview,
      hashLength: user.passwordHash.length,
      passwordValid: isValid,
      totalUsers: userCount,
    })
  } catch (err) {
    return NextResponse.json(
      { step: "error", error: String(err) },
      { status: 500 }
    )
  }
}
