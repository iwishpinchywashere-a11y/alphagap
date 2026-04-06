import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/users";
import { createToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const user = await getUserByEmail(email.toLowerCase().trim());

    // Always return success even if user doesn't exist — prevents email enumeration
    if (user) {
      const token = await createToken(user.email, "reset", 60 * 60 * 1000); // 1 hour
      await sendPasswordResetEmail(user.name, user.email, token).catch((e) =>
        console.error("[forgot-password] email send failed:", e),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[forgot-password]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
