"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Eye, EyeOff } from "lucide-react"
import { authenticate } from "./actions"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleCredentialLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("email", email)
      formData.append("password", password)
      formData.append("redirectTo", "/")

      const errorMsg = await authenticate(formData)
      if (errorMsg) {
        setError(errorMsg)
        setLoading(false)
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("Connection error — please try again.")
      setLoading(false)
    }
  }

  async function handleMicrosoftLogin() {
    await signIn("microsoft-entra-id", { callbackUrl: "/" })
  }

  const hasMicrosoftSSO = true

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      {/* Background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/login-bg.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* MM Engineering logo */}
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mme-logo.svg" alt="MM Engineering" className="h-10 opacity-90" />
        </div>

        {/* ETHOS logo */}
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ethos-logo.svg" alt="ETHOS MK.1" className="mx-auto w-full max-w-[320px]" />
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-xl space-y-5">
          {/* Microsoft SSO */}
          {hasMicrosoftSSO && (
            <>
              <Button
                onClick={handleMicrosoftLogin}
                variant="outline"
                className="w-full h-11 gap-3 bg-white/90 hover:bg-white text-gray-800 border-white/30"
              >
                <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
                  <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
                Sign in with Microsoft
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-transparent px-3 text-white/50">or use email</span>
                </div>
              </div>
            </>
          )}

          {/* Email/Password form */}
          <form onSubmit={handleCredentialLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80 text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@mme.co.uk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-sky-400 focus:ring-sky-400/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80 text-sm">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-sky-400 focus:ring-sky-400/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/20 p-2.5 text-sm text-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-sky-500 hover:bg-sky-400 text-white font-medium"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-white/30">
          Authorised personnel only. All access is logged.
        </p>
      </div>
    </div>
  )
}
