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
        try {
          if (!credentials?.email || !credentials?.password) return null

          const email = String(credentials.email).trim()
          const password = String(credentials.password)

          // Use explicit select to avoid querying columns that may not exist in DB
          const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, passwordHash: true, role: true },
          })

          if (!user || !user.passwordHash) return null

          const isValid = await compare(password, user.passwordHash)
          if (!isValid) return null

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }
        } catch (err) {
          console.error("[AUTH] authorize error:", err)
          return null
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
        // department may not exist in DB yet — use explicit select
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            select: { department: true },
          })
          token.department = dbUser?.department || null
        } catch {
          token.department = null
        }
      }

      // For Microsoft SSO — match or create user in our database
      if (account?.provider === "microsoft-entra-id" && user?.email) {
        try {
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true, role: true, department: true },
          })

          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || user.email.split("@")[0],
                passwordHash: "",
                role: "STAFF",
              },
              select: { id: true, role: true, department: true },
            })
          }

          token.id = dbUser.id
          token.role = dbUser.role
          token.department = dbUser.department
        } catch (err) {
          console.error("[AUTH] JWT callback SSO error:", err)
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
