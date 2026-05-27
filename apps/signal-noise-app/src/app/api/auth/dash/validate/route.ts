import { createLocalJWKSet, jwtVerify } from "jose";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_INFRA_API_URL = "https://dash.better-auth.com";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function unauthorized() {
  return NextResponse.json(
    { code: "INVALID_API_KEY", message: "Invalid API key" },
    { status: 401 },
  );
}

function logValidationFailure(reason: string, details: Record<string, unknown> = {}) {
  console.warn("[Dash validate] ownership check failed", {
    reason,
    ...details,
  });
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    logValidationFailure("missing_bearer_token");
    return unauthorized();
  }

  const apiKey = process.env.BETTER_AUTH_API_KEY?.trim() || "";
  if (!apiKey) {
    logValidationFailure("missing_better_auth_api_key");
    return unauthorized();
  }

  const apiUrl = (process.env.BETTER_AUTH_API_URL || DEFAULT_INFRA_API_URL).replace(/\/+$/, "");

  try {
    const jwksResponse = await fetch(`${apiUrl}/api/auth/jwks`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!jwksResponse.ok) {
      logValidationFailure("jwks_fetch_failed", {
        status: jwksResponse.status,
        apiUrl,
      });
      return unauthorized();
    }

    const jwks = await jwksResponse.json();
    const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
      maxTokenAge: "5m",
    });

    if (typeof payload.apiKeyHash !== "string") {
      logValidationFailure("missing_api_key_hash", {
        payloadKeys: Object.keys(payload),
      });
      return unauthorized();
    }

    const expectedHash = await sha256(apiKey);
    if (payload.apiKeyHash !== expectedHash) {
      logValidationFailure("api_key_hash_mismatch", {
        apiKeyLength: apiKey.length,
        payloadHashLength: payload.apiKeyHash.length,
      });
      return unauthorized();
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    logValidationFailure("jwt_validation_error", {
      message: error instanceof Error ? error.message : String(error),
      apiUrl,
    });
    return unauthorized();
  }
}
