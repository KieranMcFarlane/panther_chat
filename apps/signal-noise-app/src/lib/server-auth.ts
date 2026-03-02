import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, authReady } from "@/lib/auth";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function getServerSession(requestHeaders?: Headers) {
  await authReady;

  const resolvedHeaders = requestHeaders ?? await headers();
  const session = await auth.api.getSession({
    headers: resolvedHeaders,
  });

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
