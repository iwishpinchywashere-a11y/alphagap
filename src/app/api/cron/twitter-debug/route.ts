// Quick debug route - add temporarily
import { NextRequest, NextResponse } from "next/server";
import { postTweet } from "@/lib/twitter-bot";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Test multiple content types from Vercel to isolate which passes
  const tests = [
    "Allways (SN7) — unusual on-chain activity 🏗️\n\nVolume 11.8× above baseline while price steady. Dev score 94, aGap 95/100.\n\nBuilders shipping, metrics strong → alphagap.io\n\n$ALLWAYS #Bittensor",
    "Allways (SN7) 🏗️ Dev score 94 · Flow 90 · aGap 95/100\n\nVolume up 11.8× baseline, price +17.6% in 7 days. On-chain metrics unusually active.\n\n→ alphagap.io | $ALLWAYS #Bittensor",
    "SN7 Allways — high on-chain activity detected 📊\n\nDev 94 · Flow 90 · aGap 95/100 · Volume 11.8× avg · +17.6% in 7d\n\nTracking full data → alphagap.io\n\n$ALLWAYS #Bittensor",
  ];

  const results = [];
  for (const text of tests) {
    const r = await postTweet(text);
    results.push({ len: text.length, ok: !!r?.id && r.id !== "", error: r?.error?.slice(0, 80) });
    // small delay between attempts
    await new Promise(res => setTimeout(res, 1000));
  }

  return NextResponse.json({ results });
}
