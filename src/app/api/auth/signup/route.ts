import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByEmail, createUser } from "@/lib/users";
import { createToken } from "@/lib/tokens";
import { sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Skip if not configured (local dev)
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { email, password, name, turnstileToken } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Verify CAPTCHA (skipped if TURNSTILE_SECRET_KEY not set)
    if (process.env.TURNSTILE_SECRET_KEY) {
      const captchaOk = await verifyTurnstile(turnstileToken ?? "");
      if (!captchaOk) {
        return NextResponse.json({ error: "CAPTCHA verification failed. Please try again." }, { status: 400 });
      }
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    await createUser({
      id: crypto.randomUUID(),
      email: cleanEmail,
      name: cleanName,
      passwordHash,
      subscriptionStatus: "none",
      emailVerified: false,
      createdAt: new Date().toISOString(),
    });

    // Send welcome + verification email (fire and forget — don't block signup)
    createToken(cleanEmail, "verify").then((token) =>
      sendWelcomeEmail(cleanName, cleanEmail, token).catch((e) =>
        console.error("[signup] welcome email failed:", e),
      ),
    ).catch((e) => console.error("[signup] token create failed:", e));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[signup]", e);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
