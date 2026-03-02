import { createAuthClient } from "better-auth/react";
import { sentinelClient } from "@better-auth/infra/client";

const authBaseUrl = (
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL
  || process.env.NEXT_PUBLIC_APP_URL
  || "http://localhost:3005"
).replace(/\/+$/, "");

// Better Auth client for frontend components
// Uses the API route at /api/auth/[[...all]]
export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [
    sentinelClient(),
  ],
});

// Export hooks and actions for convenience
export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
