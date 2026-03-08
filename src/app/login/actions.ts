"use server"

import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"

export async function authenticate(formData: FormData) {
  try {
    await signIn("credentials", formData)
  } catch (error) {
    if (error instanceof AuthError) {
      console.error("[AUTH] AuthError type:", error.type, "| message:", error.message)
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid email or password. Check credentials and try again."
        case "Configuration":
          return "Server configuration error — please contact admin."
        default:
          return `Authentication error (${error.type}) — please try again.`
      }
    }
    throw error // Re-throw redirects and other errors
  }
}
