const LOCAL_AUTH_BASE_URL = "http://localhost:3005";

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => Boolean(value && value.trim()));
}

export function resolveClientAuthBaseUrl() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  if (process.env.NODE_ENV === "production") {
    return firstDefined(
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      LOCAL_AUTH_BASE_URL
    )!;
  }

  return LOCAL_AUTH_BASE_URL;
}

export function resolveServerAuthBaseUrl() {
  if (process.env.NODE_ENV === "production") {
    return firstDefined(
      process.env.BETTER_AUTH_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      LOCAL_AUTH_BASE_URL
    )!;
  }

  return LOCAL_AUTH_BASE_URL;
}

export function resolveTrustedOrigins() {
  if (process.env.NODE_ENV === "production") {
    return [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.BETTER_AUTH_URL,
    ].filter(Boolean) as string[];
  }

  return [LOCAL_AUTH_BASE_URL];
}
