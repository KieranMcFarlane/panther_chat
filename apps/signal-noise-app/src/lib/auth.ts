import { mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { dash } from "@better-auth/infra";
import Database from "better-sqlite3";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import { sendAuthResetPasswordEmail, sendAuthVerificationEmail } from "@/lib/auth-email";

type AuthDatabaseConfig =
  | {
      database:
        | Database.Database
        | { db: Kysely<unknown>; type: "postgres"; casing: "snake" }
        | { db: Kysely<unknown>; type: "sqlite" };
      label: string;
      runMigrations: boolean;
    }
  | {
      database: ReturnType<typeof memoryAdapter>;
      label: string;
      runMigrations: false;
    };

let sqliteHandle: Database.Database | null = null;
let libsqlKysely: Kysely<unknown> | null = null;
let postgresKysely: Kysely<unknown> | null = null;
let postgresPool: Pool | null = null;

function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function isHostedProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production";
}

function normalizeBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/+$/, "");
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

function getTursoDatabaseUrl() {
  return process.env.TURSO_DATABASE_URL?.trim() || "";
}

function getTursoAuthToken() {
  return process.env.TURSO_AUTH_TOKEN?.trim() || "";
}

function isPostgresDatabaseUrl(value?: string | null) {
  return /^(postgres(ql)?):\/\//i.test(value?.trim() || "");
}

function isLibsqlDatabaseUrl(value?: string | null) {
  return /^libsql:\/\//i.test(value?.trim() || "");
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

function getSqliteDatabasePath() {
  const configuredDatabaseUrl = getDatabaseUrl();
  if (configuredDatabaseUrl?.startsWith("file:")) {
    const configuredPath = configuredDatabaseUrl.slice("file:".length) || "better-auth.db";

    if (isHostedProductionRuntime()) {
      return join("/tmp", basename(configuredPath));
    }

    return configuredPath.startsWith("/")
      ? configuredPath
      : resolve(process.cwd(), configuredPath);
  }

  if (isHostedProductionRuntime()) {
    return join("/tmp", "better-auth.db");
  }

  const dataDir = join(process.cwd(), ".data");
  mkdirSync(dataDir, { recursive: true });
  return join(dataDir, "better-auth.db");
}

function getDatabase(): AuthDatabaseConfig {
  const tursoDatabaseUrl = getTursoDatabaseUrl();
  const tursoAuthToken = getTursoAuthToken();
  const configuredDatabaseUrl = getDatabaseUrl();

  if (isLibsqlDatabaseUrl(tursoDatabaseUrl)) {
    try {
      libsqlKysely = libsqlKysely ?? new Kysely({
        dialect: new LibsqlDialect({
          url: tursoDatabaseUrl,
          authToken: tursoAuthToken || undefined,
        }),
      });

      if (!isBuildPhase()) {
        console.log("Better Auth: Using Turso/LibSQL database");
      }

      return {
        database: {
          db: libsqlKysely,
          type: "sqlite",
        },
        label: "libsql",
        runMigrations: true,
      };
    } catch (error) {
      if (!isBuildPhase()) {
        console.warn("Better Auth: Could not initialize Turso/LibSQL database", error);
      }
    }
  }

  if (isPostgresDatabaseUrl(configuredDatabaseUrl)) {
    try {
      postgresPool = postgresPool ?? new Pool({
        connectionString: configuredDatabaseUrl,
        ssl: isHostedProductionRuntime() ? { rejectUnauthorized: false } : undefined,
        max: 5,
      });
      postgresKysely = postgresKysely ?? new Kysely({
        dialect: new PostgresDialect({
          pool: postgresPool,
        }),
      });

      if (!isBuildPhase()) {
        console.log("Better Auth: Using Postgres database");
      }

      return {
        database: {
          db: postgresKysely,
          type: "postgres",
          casing: "snake",
        },
        label: "postgres",
        runMigrations: true,
      };
    } catch (error) {
      if (!isBuildPhase()) {
        console.warn("Better Auth: Could not initialize Postgres database", error);
      }
    }
  }

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

  if (isHostedProductionRuntime()) {
    throw new Error("Better Auth: no durable database available in production");
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
const authBaseUrl = [
  normalizeBaseUrl(process.env.BETTER_AUTH_URL),
  normalizeBaseUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL),
  normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL),
  normalizeBaseUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  "http://127.0.0.1:3005",
  "http://localhost:3005",
].find((value) => value && !(isHostedProductionRuntime() && isLocalhostUrl(value)));
const trustedOrigins = Array.from(new Set([
  "http://localhost:3005",
  "http://127.0.0.1:3005",
  normalizeBaseUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL),
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
    if ((databaseConfig.label === "sqlite" || databaseConfig.label === "postgres" || databaseConfig.label === "libsql") && !isBuildPhase()) {
      console.log("Better Auth: Database migrations ready");
    }
  })
  .catch((error) => {
    if (!isBuildPhase()) {
      console.error("Better Auth: Failed to initialize database", error);
    }
    throw error;
  });
