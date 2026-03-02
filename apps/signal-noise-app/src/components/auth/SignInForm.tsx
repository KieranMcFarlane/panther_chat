"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export function SignInForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [mode, setMode] = useState<"signIn" | "signUp" | "reset">("signIn")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === "signIn") {
        const result = await authClient.signIn.email({
          email,
          password,
        })

        if (result.error) {
          setError(result.error.message || "Sign in failed")
        } else {
          window.location.href = "/" // Redirect on success
        }
      } else if (mode === "signUp") {
        const result = await authClient.signUp.email({
          email,
          password,
          name: email.split("@")[0], // Default name from email
        })

        if (result.error) {
          setError(result.error.message || "Sign up failed")
        } else {
          setMessage("Account created. Sign in with your new credentials.")
          setMode("signIn") // Switch to sign in after successful sign up
        }
      } else {
        const response = await fetch("/api/auth/request-password-reset", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            redirectTo: `${window.location.origin}/sign-in`,
          }),
        })

        const result = await response.json().catch(() => null)
        if (!response.ok) {
          setError(result?.message || "Password reset request failed")
        } else {
          setMessage(result?.message || "If this email exists in our system, check your email for the reset link")
          setMode("signIn")
        }
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {mode === "signIn" ? "Sign In" : mode === "signUp" ? "Create Account" : "Reset Password"}
        </CardTitle>
        <CardDescription>
          {mode === "signIn"
            ? "Enter your email and password to access your account"
            : mode === "signUp"
              ? "Create a new account to get started"
              : "Enter your email and we'll send you a reset link"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {message && (
            <div className="p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 rounded-md border border-emerald-200 dark:border-emerald-800">
              {message}
            </div>
          )}
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          {mode !== "reset" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Loading..." : mode === "signIn" ? "Sign In" : mode === "signUp" ? "Create Account" : "Send Reset Link"}
          </Button>
          <div className="text-sm text-center">
            {mode === "signIn" ? (
              <div className="space-y-2">
                <div>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setMessage(null)
                      setMode("signUp")
                    }}
                    className="text-primary hover:underline"
                  >
                    Sign up
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setMessage(null)
                      setMode("reset")
                    }}
                    className="text-primary hover:underline"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>
            ) : mode === "signUp" ? (
              <div>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setMessage(null)
                    setMode("signIn")
                  }}
                  className="text-primary hover:underline"
                >
                  Sign in
                </button>
              </div>
            ) : (
              <div>
                Remembered your password?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setMessage(null)
                    setMode("signIn")
                  }}
                  className="text-primary hover:underline"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
