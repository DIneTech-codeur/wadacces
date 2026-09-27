import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logoutUser, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) {
      await logoutUser(token);
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ ok: false, error: "Erreur lors de la déconnexion" }, { status: 500 });
  }
}
