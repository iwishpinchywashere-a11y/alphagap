import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAffiliateStats, getOrCreateReferralCode } from "@/lib/referral";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  if (!process.env.REFERRAL_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !(session.user as { id?: string }).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  try {
    // Ensure user has a referral code before fetching stats
    getOrCreateReferralCode(userId, session.user.email!);
    const stats = getAffiliateStats(userId);
    return NextResponse.json(stats);
  } catch (e) {
    console.error("[referral] dashboard error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
