/**
 * POST /api/auth/create-session
 *
 * Called right after signup to establish a session without going through
 * next-auth's client-side CSRF / callback dance, which has timing issues
 * when the user blob was just written on a different serverless instance.
 *
 * We verify credentials server-side (with blob-propagation retries),
 * create a next-auth–compatible JWT, and set the session cookie directly.
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";
import { getUserByEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    // Retry up to 6x with 700ms spacing (4.2s total) to handle Vercel Blob
    // propagation delay right after signup on a different serverless instance.
    const user = await getUserByEmail(email.toLowerCase().trim(), { retries: 6 });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = (user.isAdmin ?? false) || adminEmails.includes(user.email.toLowerCase());

    // Build the same token shape that next-auth's jwt callback produces
    const token = await encode({
      token: {
        sub: user.id,
        email: user.email,
        name: user.name,
        picture: null,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionTier: user.subscriptionTier ?? null,
        isAdmin,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // next-auth uses __Secure- prefix on HTTPS (production)
    const secure = (process.env.NEXTAUTH_URL || "").startsWith("https");
    const cookieName = secure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (e) {
    console.error("[create-session]", e);
    return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
  }
}
