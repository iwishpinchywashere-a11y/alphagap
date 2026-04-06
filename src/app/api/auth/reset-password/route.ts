import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { consumeToken } from "@/lib/tokens";
import { updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const email = await consumeToken(token, "reset");
    if (!email) {
      return NextResponse.json(
        { error: "This link is invalid or has expired. Please request a new one." },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await updateUser(email, { passwordHash });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset-password]", e);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
