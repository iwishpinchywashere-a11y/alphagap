/**
 * POST /api/auth/register
 *
 * Secret free-account registration endpoint.
 * Creates a user with subscriptionStatus: "none" — admin upgrades them manually.
 * Not linked from any public page; URL is shared privately.
 */

import { NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/users";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      name?: string;
      email?: string;
      password?: string;
    };

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").toLowerCase().trim();
    const password = body.password ?? "";

    // Basic validation
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Check for existing account
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12);
    await createUser({
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash,
      subscriptionStatus: "none",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "Registration failed — please try again" }, { status: 500 });
  }
}
