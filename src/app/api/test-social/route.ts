import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const results: string[] = [];

  try {
    // 1. Test Desearch API directly
    results.push("Step 1: Testing Desearch API...");
    const DESEARCH_KEY = process.env.DESEARCH_API_KEY || "dsr_zUMktfSxGqfTl2sdOJyywg8AlBTtBSvj9cNyGgEj";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      "https://api.desearch.ai/twitter?query=bittensor+templar&sort=Top&count=5",
      { headers: { Authorization: DESEARCH_KEY }, signal: controller.signal }
    );
    clearTimeout(timeout);

    results.push(`  API status: ${res.status}`);
    if (!res.ok) {
      results.push(`  API error: ${await res.text()}`);
      return NextResponse.json({ results });
    }

    const tweets = await res.json();
    results.push(`  Got ${tweets.length} tweets`);

    if (tweets.length > 0) {
      const t = tweets[0];
      results.push(`  Top tweet: @${t.user.username} - likes:${t.like_count} rt:${t.retweet_count} views:${t.view_count}`);

      // 2. Test inserting into DB
      results.push("Step 2: Testing DB insert...");
      try {
        const engagement = t.like_count + t.retweet_count + t.reply_count + (t.quote_count || 0);
        db.prepare(`
          INSERT OR IGNORE INTO social_posts
            (netuid, platform, post_id, author, author_type, content, url, likes, retweets, replies, views, posted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          3, "twitter",
          `test:${t.id}`,
          t.user.username,
          "user",
          t.text.slice(0, 500),
          t.url,
          t.like_count, t.retweet_count, t.reply_count,
          t.view_count || 0,
          t.created_at
        );
        results.push("  DB insert: SUCCESS");

        // 3. Verify it's in DB
        const count = db.prepare("SELECT COUNT(*) as cnt FROM social_posts").get() as { cnt: number };
        results.push(`  Total social_posts: ${count.cnt}`);

        // 4. Update metrics
        db.prepare(`
          INSERT OR REPLACE INTO social_metrics (netuid, timestamp, mentions_24h, mentions_7d, total_engagement_24h, top_post_url)
          VALUES (3, datetime('now'), ?, ?, ?, ?)
        `).run(tweets.length, tweets.length, engagement, t.url);
        results.push("  Metrics insert: SUCCESS");

        const metrics = db.prepare("SELECT * FROM social_metrics WHERE netuid = 3").get();
        results.push(`  Metrics: ${JSON.stringify(metrics)}`);
      } catch (dbErr) {
        results.push(`  DB ERROR: ${dbErr}`);
      }
    }
  } catch (e) {
    results.push(`ERROR: ${e}`);
  }

  return NextResponse.json({ results });
}
