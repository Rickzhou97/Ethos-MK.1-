import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/db"

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
    // To enable: register an app in Azure portal and set env vars
    ...(process.env.AZURE_AD_CLIENT_ID
      ? [
          MicrosoftEntraID({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID!}/v2.0`,
          }),
        ]
      : []),

    // Email/password fallback — works immediately with existing users
    Credentials({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Write debug info to DB so we can query it via debug endpoint
        const debugLog: string[] = []
        try {
          debugLog.push(`credentials keys: ${Object.keys(credentials || {}).join(",")}`)
          debugLog.push(`email type: ${typeof credentials?.email}, value: ${String(credentials?.email)}`)
          debugLog.push(`password type: ${typeof credentials?.password}, length: ${String(credentials?.password || "").length}`)

          if (!credentials?.email || !credentials?.password) {
            debugLog.push("FAIL: missing email or password")
            return null
          }

          const email = String(credentials.email).trim()
          const password = String(credentials.password)
          debugLog.push(`parsed email: "${email}", password length: ${password.length}`)

          const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, passwordHash: true, role: true, department: true },
          })
          debugLog.push(`user found: ${!!user}, name: ${user?.name || "N/A"}`)

          if (!user || !user.passwordHash) {
            debugLog.push(`FAIL: user=${!!user}, hasHash=${!!user?.passwordHash}`)
            return null
          }

          debugLog.push(`hash preview: ${user.passwordHash.substring(0, 10)}..., length: ${user.passwordHash.length}`)

          const isValid = await compare(password, user.passwordHash)
          debugLog.push(`compare result: ${isValid}`)

          if (!isValid) {
            debugLog.push("FAIL: password mismatch")
            return null
          }

          debugLog.push("SUCCESS")
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
          }
        } catch (err) {
          debugLog.push(`EXCEPTION: ${String(err)}`)
          return null
        } finally {
          // Write debug log to suggestions table for inspection
          try {
            await prisma.suggestion.create({
              data: {
                userName: "AUTH_DEBUG",
                category: "AUTH_DEBUG",
                message: debugLog.join(" | "),
              },
            })
          } catch { /* ignore write failures */ }
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // On first sign-in, add user info to token
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role || "STAFF"
        token.department = (user as { department?: string | null }).department || null
      }

      // For Microsoft SSO — match or create user in our database
      if (account?.provider === "microsoft-entra-id" && user?.email) {
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        })

        if (!dbUser) {
          // Auto-create user from Microsoft account
          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || user.email.split("@")[0],
              passwordHash: "", // No password needed for SSO
              role: "STAFF", // Default role — admin can upgrade
            },
          })
        }

        token.id = dbUser.id
        token.role = dbUser.role
        token.department = dbUser.department
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
