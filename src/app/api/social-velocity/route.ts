import { NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DESEARCH_KEY = process.env.DESEARCH_API_KEY || "";

// Known high-weight accounts (founders, validators, major KOLs)
const TIER_1_ACCOUNTS = new Set([
  "opaborlmaduro", // OTF
  "baborlmaduro",
  "jacobsteeves",
  "const_reborn",  // Bittensor core
  "TaoStats",
  "TaoAlerts",
  "ShizzyUnchained",
  "TaoOutsider",
  "bittensor_",
]);

const TIER_2_ACCOUNTS = new Set([
  "0xai_dev",
  "tplr_ai",
  "ChutesAI",
  "Ridges_xyz",
  "NousResearch",
  "MacrocosmosAI",
]);

interface MentionSnapshot {
  timestamp: string;
  subnets: Record<number, {
    mentions: number;
    engagement: number;
    tier1_mentions: number;
    tier2_mentions: number;
    top_tweets: Array<{ text: string; engagement: number; username: string }>;
  }>;
}

// Subnet name to netuid mapping for matching
const SUBNET_KEYWORDS: Record<string, number[]> = {
  "templar": [3], "τemplar": [3], "tplr": [3],
  "chutes": [64],
  "ridges": [62],
  "targon": [4],
  "basilica": [39],
  "grail": [81],
  "dsperse": [2],
  "bitrecs": [16],
  "trajectoryrl": [11], "tplr-ai": [11],
  "soma": [114],
  "vanta": [8],
  "oro": [15],
  "nova": [68],
  "readyai": [33],
  "bitmind": [34],
  "numinous": [6],
  "cortex": [18], "zeus": [18],
  "resi": [57],
  "groundlayer": [20],
  "redteam": [61],
  "kaito": [5],
  "compute horde": [12],
  "synth": [2],
};

export async function GET() {
  if (!DESEARCH_KEY) {
    return NextResponse.json({ error: "No Desearch key" }, { status: 500 });
  }

  try {
    // 1. Poll Desearch for current mentions
    const searches = [
      { query: "bittensor subnet alpha", count: 100, sort: "Latest" as const },
      { query: "$TAO subnet", count: 50, sort: "Latest" as const },
      { query: "bittensor templar chutes ridges basilica grail", count: 50, sort: "Latest" as const },
    ];

    const allTweets = new Map<string, { text: string; engagement: number; username: string; created_at: string }>();

    for (const search of searches) {
      try {
        const res = await fetch(
          `https://api.desearch.ai/twitter?query=${encodeURIComponent(search.query)}&sort=${search.sort}&count=${search.count}`,
          { headers: { Authorization: DESEARCH_KEY } }
        );
        if (res.ok) {
          const tweets = await res.json();
          if (Array.isArray(tweets)) {
            for (const t of tweets) {
              const id = t.id || t.tweet_id || `${t.user?.username}-${t.created_at}`;
              if (!allTweets.has(id)) {
                allTweets.set(id, {
                  text: t.text || "",
                  engagement: (t.like_count || 0) + (t.retweet_count || 0) + (t.reply_count || 0),
                  username: t.user?.username || "",
                  created_at: t.created_at || "",
                });
              }
            }
          }
        }
        await new Promise(r => setTimeout(r, 300));
      } catch { /* skip failed search */ }
    }

    // 2. Match tweets to subnets
    const subnetMentions: Record<number, {
      mentions: number;
      engagement: number;
      tier1_mentions: number;
      tier2_mentions: number;
      top_tweets: Array<{ text: string; engagement: number; username: string }>;
    }> = {};

    for (const [, tweet] of allTweets) {
      const textLower = tweet.text.toLowerCase();
      const username = tweet.username.toLowerCase();

      // Match to subnets — use word boundaries to avoid substring false positives
      // (e.g. "chutes" must not match "parachutes", "swap" must not match "swapping")
      const matchedNetuids = new Set<number>();
      for (const [keyword, netuids] of Object.entries(SUBNET_KEYWORDS)) {
        const kw = keyword.toLowerCase();
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`\\b${escaped}\\b`, "i").test(textLower)) {
          netuids.forEach(n => matchedNetuids.add(n));
        }
      }

      // Also match SN## patterns
      const snMatches = textLower.matchAll(/\bsn(\d{1,3})\b/g);
      for (const m of snMatches) {
        const n = parseInt(m[1]);
        if (n > 0 && n <= 128) matchedNetuids.add(n);
      }

      for (const netuid of matchedNetuids) {
        if (!subnetMentions[netuid]) {
          subnetMentions[netuid] = { mentions: 0, engagement: 0, tier1_mentions: 0, tier2_mentions: 0, top_tweets: [] };
        }
        const entry = subnetMentions[netuid];
        entry.mentions++;
        entry.engagement += tweet.engagement;

        if (TIER_1_ACCOUNTS.has(tweet.username)) entry.tier1_mentions++;
        else if (TIER_2_ACCOUNTS.has(tweet.username)) entry.tier2_mentions++;

        if (entry.top_tweets.length < 3) {
          entry.top_tweets.push({ text: tweet.text.slice(0, 200), engagement: tweet.engagement, username: tweet.username });
        }
      }
    }

    // 3. Create snapshot
    const snapshot: MentionSnapshot = {
      timestamp: new Date().toISOString(),
      subnets: subnetMentions,
    };

    // 4. Save to Vercel Blob
    const snapshotKey = `social-velocity/${Date.now()}.json`;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put(snapshotKey, JSON.stringify(snapshot), {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      });
    }

    // 5. Load recent snapshots and compute velocity
    let velocity: Record<number, { velocityScore: number; acceleration: number; trend: string }> = {};

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { blobs } = await list({
          prefix: "social-velocity/",
          limit: 10, // Last 10 snapshots
        });

        if (blobs.length >= 2) {
          // Sort by name (timestamp-based) newest first
          const sorted = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));

          // Load newest and oldest from recent window
          const newest = snapshot; // Current one
          let oldest: MentionSnapshot | null = null;

          // Get the oldest snapshot (last in sorted array)
          const oldestBlob = sorted[sorted.length - 1];
          try {
            const oldRes = await fetch(oldestBlob.downloadUrl);
            if (oldRes.ok) {
              oldest = await oldRes.json();
            }
          } catch { /* skip */ }

          if (oldest) {
            const timeDiffMs = new Date(newest.timestamp).getTime() - new Date(oldest.timestamp).getTime();
            const timeDiffMin = timeDiffMs / 60000;

            if (timeDiffMin > 1) {
              // Compute velocity for each subnet
              const allNetuids = new Set([
                ...Object.keys(newest.subnets).map(Number),
                ...Object.keys(oldest.subnets).map(Number),
              ]);

              for (const netuid of allNetuids) {
                const now = newest.subnets[netuid];
                const then = oldest.subnets[netuid];

                const mentionsNow = now?.mentions || 0;
                const mentionsThen = then?.mentions || 0;
                const engNow = now?.engagement || 0;
                const engThen = then?.engagement || 0;

                // Mention velocity: change per minute
                const mentionVelocity = (mentionsNow - mentionsThen) / timeDiffMin;
                const engVelocity = (engNow - engThen) / timeDiffMin;

                // Acceleration: is velocity increasing?
                // We'd need 3+ snapshots for true acceleration, but we can approximate
                const velocityScore = Math.min(100, Math.round(
                  (mentionVelocity * 10) + // Each new mention/min = 10 points
                  (engVelocity * 0.5) + // Engagement velocity bonus
                  ((now?.tier1_mentions || 0) * 15) + // Tier 1 account boost
                  ((now?.tier2_mentions || 0) * 8) // Tier 2 account boost
                ));

                let trend = "stable";
                if (mentionVelocity > 1) trend = "accelerating";
                else if (mentionVelocity > 0.2) trend = "growing";
                else if (mentionVelocity < -0.2) trend = "cooling";

                velocity[netuid] = {
                  velocityScore: Math.max(0, velocityScore),
                  acceleration: mentionVelocity,
                  trend,
                };
              }
            }
          }
        }
      } catch (e) {
        console.error("[velocity] Failed to compute velocity:", e);
      }
    }

    // 6. Save velocity data as a separate blob for the scan to read
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await put("social-velocity-latest.json", JSON.stringify({
        timestamp: snapshot.timestamp,
        snapshot: subnetMentions,
        velocity,
        tweets_processed: allTweets.size,
      }), {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      });
    }

    return NextResponse.json({
      ok: true,
      tweets_processed: allTweets.size,
      subnets_matched: Object.keys(subnetMentions).length,
      velocity_computed: Object.keys(velocity).length,
      snapshot_saved: snapshotKey,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
