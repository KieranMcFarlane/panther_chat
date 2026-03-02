import { auth, authReady } from "@/lib/auth";

export const dynamic = 'force-dynamic';

const handler = async (request: Request) => {
  const { pathname } = new URL(request.url);

  if (pathname.endsWith("/api/auth")) {
    return Response.json({
      status: "ok",
      service: "better-auth",
    });
  }

  await authReady;
  return auth.handler(request);
};

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
