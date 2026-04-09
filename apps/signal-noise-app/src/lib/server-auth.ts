import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, authReady } from "@/lib/auth";

const LOCAL_DEV_AUTH_BYPASS_ENABLED = process.env.LOCAL_DEV_AUTH_BYPASS !== "false";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function isLocalHost(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1";
}

function parseForwardedHost(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.split(",")[0]?.trim() || "";
}

function resolveRequestHostname(requestHeaders: Headers) {
  const forwardedHost = parseForwardedHost(requestHeaders.get("x-forwarded-host"));
  const hostHeader = requestHeaders.get("host")?.trim() || "";
  const host = forwardedHost || hostHeader;

  if (!host) {
    return "";
  }

  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return host.split(":")[0] || "";
  }
}

function shouldBypassAuthForLocalDev(requestHeaders: Headers) {
  if (!LOCAL_DEV_AUTH_BYPASS_ENABLED) {
    return false;
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    return false;
  }

  return isLocalHost(resolveRequestHostname(requestHeaders));
}

function buildLocalDevSession() {
  return {
    session: {
      id: "local-dev-auth-bypass",
      token: "local-dev-auth-bypass",
    },
    user: {
      id: "local-dev-auth-bypass",
      email: "local-dev@signalnoise.local",
      name: "Local Dev",
    },
  };
}

export async function getServerSession(requestHeaders?: Headers) {
  await authReady;

  const resolvedHeaders = requestHeaders ?? await headers();
  const session = await auth.api.getSession({
    headers: resolvedHeaders,
  });

  if (!session?.session || !session.user) {
    if (shouldBypassAuthForLocalDev(resolvedHeaders)) {
      return buildLocalDevSession();
    }
  }

  return session ?? null;
}

export async function requireApiSession(request: Request) {
  const session = await getServerSession(request.headers);

  if (!session?.session || !session.user) {
    throw new UnauthorizedError();
  }

  return session;
}

export async function requirePageSession(returnTo: string) {
  const session = await getServerSession();

  if (!session?.session || !session.user) {
    redirect(`/sign-in?redirect=${encodeURIComponent(returnTo)}`);
  }

  return session;
}

export async function redirectAuthenticatedUser(destination = "/") {
  const session = await getServerSession();

  if (session?.session && session.user) {
    redirect(destination);
  }
}
