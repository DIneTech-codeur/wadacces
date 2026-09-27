import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { initializeDatabase } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await initializeDatabase();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, data: user });
}
