import { createAuthClient } from "better-auth/react";
import { sentinelClient } from "@better-auth/infra/client";

function normalizeBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/+$/, "");
}

function isLocalhostUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function getBrowserOrigin() {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeBaseUrl(window.location.origin) || null;
}

function resolveAuthBaseUrl() {
  const browserOrigin = getBrowserOrigin();
  const envBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL)
    || normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (browserOrigin && (!envBaseUrl || isLocalhostUrl(envBaseUrl))) {
    return browserOrigin;
  }

  return envBaseUrl || browserOrigin || "http://localhost:3005";
}

const authBaseUrl = resolveAuthBaseUrl();

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
