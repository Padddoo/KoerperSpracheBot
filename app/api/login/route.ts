import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { code } = (await req.json()) as { code?: string };
    const expected = process.env.ACCESS_CODE;

    if (!expected) {
      return NextResponse.json(
        { error: "Kein Zugangscode konfiguriert." },
        { status: 500 },
      );
    }

    if (!code || code.trim() !== expected) {
      return NextResponse.json({ error: "Code falsch." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("fred-auth", expected, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("fred-auth");
  return res;
}
