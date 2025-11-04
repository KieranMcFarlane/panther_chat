import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("task_id");
    if (!taskId) {
      return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    }

    const resp = await fetch(`${BACKEND_BASE_URL}/dossier/${encodeURIComponent(taskId)}`);
    const contentType = resp.headers.get("content-type") || "application/json";
    const data = contentType.includes("application/json") ? await resp.json() : await resp.text();
    return NextResponse.json(data as any, { status: resp.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to proxy dossier status", details: String(error?.message || error) },
      { status: 502 }
    );
  }
}


