import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/db"

// Helper to write debug logs to DB (since we can't see Vercel console logs)
async function authLog(msg: string) {
  try {
    await prisma.suggestion.create({
      data: { userName: "AUTH_DEBUG", category: "AUTH_DEBUG", message: msg },
    })
  } catch { /* ignore */ }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  providers: [
    // Microsoft Entra ID (Azure AD) — for SSO with Microsoft Authenticator
    ...(process.env.AZURE_AD_CLIENT_ID
      ? [
          MicrosoftEntraID({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID!}/v2.0`,
          }),
        ]
      : []),

    // Email/password fallback
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            await authLog("authorize: missing credentials")
            return null
          }

          const email = String(credentials.email).trim()
          const password = String(credentials.password)

          const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, passwordHash: true, role: true },
          })

          if (!user || !user.passwordHash) {
            await authLog(`authorize: user not found or no hash for ${email}`)
            return null
          }

          const isValid = await compare(password, user.passwordHash)
          if (!isValid) {
            await authLog(`authorize: password mismatch for ${email}`)
            return null
          }

          await authLog(`authorize: SUCCESS for ${email}`)
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }
        } catch (err) {
          await authLog(`authorize: EXCEPTION ${String(err)}`)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        await authLog(`jwt callback: user=${user.email}, id=${user.id}`)
        token.id = user.id
        token.role = (user as { role?: string }).role || "STAFF"
        token.department = null // Skip DB query for department — will fix with db:push later
      }

      if (account?.provider === "microsoft-entra-id" && user?.email) {
        try {
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true, role: true },
          })

          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || user.email.split("@")[0],
                passwordHash: "",
                role: "STAFF",
              },
              select: { id: true, role: true },
            })
          }

          token.id = dbUser.id
          token.role = dbUser.role
        } catch (err) {
          await authLog(`jwt SSO error: ${String(err)}`)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as { role?: string }).role = token.role as string
        ;(session.user as { department?: string | null }).department = (token.department as string | null) || null
      }
      return session
    },
  },
})
