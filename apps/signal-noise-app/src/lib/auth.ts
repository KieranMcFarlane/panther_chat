import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { dash } from "@better-auth/infra";
import Database from "better-sqlite3";

import { sendAuthResetPasswordEmail, sendAuthVerificationEmail } from "@/lib/auth-email";

type AuthDatabaseConfig =
  | {
      database: Database.Database;
      label: string;
      runMigrations: boolean;
    }
  | {
      database: ReturnType<typeof memoryAdapter>;
      label: string;
      runMigrations: false;
    };

let sqliteHandle: Database.Database | null = null;

function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function normalizeBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/+$/, "");
}

function getSqliteDatabasePath() {
  const dataDir = join(process.cwd(), ".data");
  mkdirSync(dataDir, { recursive: true });
  return join(dataDir, "better-auth.db");
}

function getDatabase(): AuthDatabaseConfig {
  try {
    const sqlitePath = getSqliteDatabasePath();
    sqliteHandle = sqliteHandle ?? new Database(sqlitePath);
    if (!isBuildPhase()) {
      console.log(`Better Auth: Using sqlite database at ${sqlitePath}`);
    }
    return {
      database: sqliteHandle,
      label: "sqlite",
      runMigrations: true,
    };
  } catch (error) {
    if (!isBuildPhase()) {
      console.warn("Better Auth: Could not initialize sqlite database, falling back to in-memory storage", error);
    }
  }

  if (!isBuildPhase()) {
    console.warn("Better Auth: Falling back to in-memory adapter");
  }
  return {
    database: memoryAdapter({}),
    label: "memory",
    runMigrations: false,
  };
}

const databaseConfig = getDatabase();
const authBaseUrl = normalizeBaseUrl(process.env.BETTER_AUTH_URL)
  || normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
  || "http://localhost:3005";
const trustedOrigins = Array.from(new Set([
  "http://localhost:3005",
  normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL),
  authBaseUrl,
].filter(Boolean))) as string[];

export const auth = betterAuth({
  database: databaseConfig.database,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthVerificationEmail({
        email: user.email,
        name: user.name,
        url,
      });
    },
    sendResetPassword: async ({ user, url }) => {
      await sendAuthResetPasswordEmail({
        email: user.email,
        name: user.name,
        url,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
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
  baseURL: authBaseUrl,
  trustedOrigins,
  plugins: [
    dash({
      apiKey: process.env.BETTER_AUTH_API_KEY,
      apiUrl: normalizeBaseUrl(process.env.BETTER_AUTH_API_URL),
      kvUrl: normalizeBaseUrl(process.env.BETTER_AUTH_KV_URL),
    }),
  ],
});

async function runAuthMigrations() {
  if (!databaseConfig.runMigrations) {
    return;
  }

  const authContext = await auth.$context;
  await authContext.runMigrations();
}

export const authReady = runAuthMigrations()
  .then(() => {
    if (databaseConfig.label === "sqlite" && !isBuildPhase()) {
      console.log("Better Auth: Database migrations ready");
    }
  })
  .catch((error) => {
    if (!isBuildPhase()) {
      console.error("Better Auth: Failed to initialize database", error);
    }
    throw error;
  });
