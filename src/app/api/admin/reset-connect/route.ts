import { NextResponse } from "next/server";
import { list as blobList, put } from "@vercel/blob";

export const dynamic = "force-dynamic";

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN ?? "";

export async function POST(req: Request): Promise<NextResponse> {
  // Simple secret guard
  const { secret } = await req.json().catch(() => ({}));
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { blobs } = await blobList({ prefix: "referral/affiliates/", token: TOKEN() });

  if (blobs.length === 0) {
    return NextResponse.json({ message: "No affiliate accounts found", cleared: 0 });
  }

  let cleared = 0;
  const details: string[] = [];

  for (const blob of blobs) {
    try {
      // Read current data
      const res = await fetch(blob.url);
      if (!res.ok) continue;
      const account = await res.json();

      // Only touch accounts that have a stripeConnectAccountId set
      if (!account.stripeConnectAccountId) continue;

      const oldId = account.stripeConnectAccountId;

      // Wipe connect fields, preserve everything else
      const cleaned = {
        ...account,
        stripeConnectAccountId: undefined,
        onboardedAt: undefined,
        payoutsEnabled: false,
      };
      // Remove undefined keys
      Object.keys(cleaned).forEach(k => cleaned[k] === undefined && delete cleaned[k]);

      await put(blob.pathname, JSON.stringify(cleaned), {
        token: TOKEN(),
        access: "private",
        allowOverwrite: true,
      });

      cleared++;
      details.push(`${account.userId} (${account.userEmail}) — removed ${oldId}`);
    } catch (e) {
      details.push(`ERROR on ${blob.pathname}: ${e}`);
    }
  }

  return NextResponse.json({
    message: `Cleared Stripe Connect data from ${cleared} affiliate account(s)`,
    cleared,
    details,
  });
}
