import { createAuthClient } from "better-auth/react";
import { resolveClientAuthBaseUrl } from "@/lib/auth-url";

// Better Auth client for frontend components
// Uses the API route at /api/auth/[...all]
export const authClient = createAuthClient({
  baseURL: resolveClientAuthBaseUrl(),
});

// Export hooks and actions for convenience
export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
