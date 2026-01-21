import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: new Map(), // Use in-memory Map database for development
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes cache
    },
  },
  advanced: {
    useSecureCookies: false,
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3005", // Match dev server port
  trustedOrigins: ["http://localhost:3005"], // Allow the dev server origin
});