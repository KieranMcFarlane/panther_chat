import { createAuthClient } from "better-auth/react";

// Better Auth client for frontend components
// Uses the API route at /api/auth/[...all]
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3005",
});

// Export hooks and actions for convenience
export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
