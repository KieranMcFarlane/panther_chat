import { betterAuth } from "better-auth";
import { createClient } from "@libsql/client";
import { memoryAdapter } from "better-auth/adapters/memory";
import { resolveServerAuthBaseUrl, resolveTrustedOrigins } from "@/lib/auth-url";

const buildSafeSecret = process.env.BETTER_AUTH_SECRET ||
  (process.env.npm_lifecycle_event === "build" ? "local-build-secret-panther-chat-2026" : undefined);

// Create LibSQL client for persistent session storage
// Falls back to in-memory Map if connection fails
const getDatabase = () => {
  try {
    const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;

    if (url && authToken) {
      const client = createClient({
        url,
        authToken,
      });
      if (process.env.npm_lifecycle_event !== "build") {
        console.log("Better Auth: Using LibSQL database");
      }
      return client;
    }
  } catch (error) {
    if (process.env.npm_lifecycle_event !== "build") {
      console.warn("Better Auth: Could not connect to LibSQL, using in-memory storage", error);
    }
  }

  if (process.env.npm_lifecycle_event !== "build") {
    console.log("Better Auth: Using in-memory adapter (development mode)");
  }
  return memoryAdapter({});
};

export const auth = betterAuth({
  secret: buildSafeSecret,
  database: getDatabase(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // Send email verification function
    sendVerificationEmail: async ({ user, url }) => {
      console.log("Verification email sent to:", user.email, "URL:", url);
      // TODO: Integrate with your email service (Resend, SendGrid, etc.)
    },
    // Send password reset email
    sendResetPassword: async ({ user, url }) => {
      console.log("Password reset email sent to:", user.email, "URL:", url);
      // TODO: Integrate with your email service
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes cache
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["email-password"],
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
    cookiePrefix: "signal_noise",
  },
  baseURL: resolveServerAuthBaseUrl(),
  trustedOrigins: resolveTrustedOrigins(),
});
