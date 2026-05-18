import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateReferralCode, setCustomCode } from "@/lib/referral";

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
  const userEmail = session.user.email;

  const code = getOrCreateReferralCode(userId, userEmail);
  return NextResponse.json({ code });
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!process.env.REFERRAL_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !(session.user as { id?: string }).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userEmail = session.user.email;

  let body: { customCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.customCode || typeof body.customCode !== "string") {
    return NextResponse.json({ error: "customCode is required" }, { status: 400 });
  }

  const result = setCustomCode(userId, userEmail, body.customCode);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ code: result.code });
}
