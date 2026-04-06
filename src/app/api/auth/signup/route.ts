import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByEmail, createUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await createUser({
      id: crypto.randomUUID(),
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash,
      subscriptionStatus: "none",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[signup]", e);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
