import { NextResponse } from "next/server";
import { validateCode } from "@/lib/referral";
import { getUserByEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  if (!process.env.REFERRAL_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ valid: false });
  }

  const result = await validateCode(code);
  if (!result.valid) {
    return NextResponse.json({ valid: false });
  }

  // Get referrer name for display (best-effort)
  let referrerName: string | undefined;
  if (result.referrerEmail) {
    try {
      const user = await getUserByEmail(result.referrerEmail);
      if (user?.name) referrerName = user.name;
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ valid: true, referrerName });
}
