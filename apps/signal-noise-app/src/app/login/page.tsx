"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isSignUp) {
        // Sign up
        const { data, error } = await authClient.signUp.email({
          email,
          password,
          name,
        });

        if (error) {
          setError(error.message);
        } else {
          // Redirect to dashboard or show success message
          window.location.href = "/dashboard";
        }
      } else {
        // Sign in
        const { data, error } = await authClient.signIn.email({
          email,
          password,
        });

        if (error) {
          setError(error.message);
        } else {
          // Redirect to dashboard
          window.location.href = "/dashboard";
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-black">{isSignUp ? "Create Account" : "Welcome Back"}</CardTitle>
          <CardDescription className="text-gray-600">
            {isSignUp 
              ? "Create a new account to access ClaudeBox Multi-Slot System"
              : "Sign in to access your ClaudeBox Multi-Slot System"
            }
          </CardDescription>
          <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            💡 Note: User data is stored in memory and resets when server restarts. Create a new account if login fails.
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-black">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required={isSignUp}
                  className="text-black border-gray-300"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-black">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="text-black border-gray-300"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-black">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="text-black border-gray-300"
              />
            </div>
            
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full bg-black text-white hover:bg-gray-800" disabled={isLoading}>
              {isLoading ? "Processing..." : (isSignUp ? "Sign Up" : "Sign In")}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-black hover:text-gray-600"
            >
              {isSignUp 
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}