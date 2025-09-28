import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: new Map(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    useSecureCookies: false,
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
});