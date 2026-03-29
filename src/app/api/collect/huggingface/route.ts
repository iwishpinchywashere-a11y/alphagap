import { NextResponse } from "next/server";
import { collectHuggingFace } from "@/lib/collectors";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pre-seed HF orgs before running collector (avoids slow discovery on Vercel)
const SEED_ORGS = [
  "bittensor", "opentensor", "macrocosm-os", "SocialTensor", "bitmind-ai",
  "tenstorrent", "MyShell-TTS", "NousResearch", "targon-hubai", "manifold-inc",
  "TensorAlchemy", "corcel-api", "omega-labs-ai", "datura-mining", "fractal-inc",
];

export async function POST() {
  try {
    // Seed orgs first so discovery can be skipped
    const db = getDb();
    const upsert = db.prepare("INSERT OR IGNORE INTO hf_orgs (netuid, org_name) VALUES (?, ?)");
    for (const org of SEED_ORGS) upsert.run(null, org);

    const result = await collectHuggingFace();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
