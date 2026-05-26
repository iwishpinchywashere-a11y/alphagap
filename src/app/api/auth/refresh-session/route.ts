/**
 * POST /api/auth/refresh-session
 *
 * Reads the user's current tier from the blob and returns it.
 * The client calls this then triggers updateSession() so the JWT
 * re-runs its callback with trigger="update", pulling fresh data.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await getUserByEmail(email, { retries: 3 });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    subscriptionStatus: user.subscriptionStatus ?? "none",
    subscriptionTier: user.subscriptionTier ?? null,
  });
}
