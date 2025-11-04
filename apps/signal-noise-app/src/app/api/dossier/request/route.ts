import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const resp = await fetch(`${BACKEND_BASE_URL}/dossier/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const contentType = resp.headers.get("content-type") || "application/json";
    const data = contentType.includes("application/json") ? await resp.json() : await resp.text();
    return NextResponse.json(data as any, { status: resp.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to proxy dossier request", details: String(error?.message || error) },
      { status: 502 }
    );
  }
}


