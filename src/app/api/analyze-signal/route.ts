import { NextRequest, NextResponse } from "next/server";
import { fetchRecentCommits, fetchRecentPRs, fetchLatestRelease } from "@/lib/context-fetcher";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return NextResponse.json({ error: "No API key" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { title, description, subnet_name, netuid, source_url, composite_score, alpha_price, price_change_24h, market_cap } = body;

    if (!title) {
      return NextResponse.json({ error: "Missing signal title" }, { status: 400 });
    }

    // If this is a GitHub signal, fetch fresh commit/PR context
    let commitContext = "";
    if (source_url && source_url.includes("github.com")) {
      let repoPath = source_url;
      if (repoPath.includes("github.com/")) repoPath = repoPath.split("github.com/")[1];
      repoPath = repoPath.replace(/^\/|\/$/g, "").replace(/\.git$/, "");
      const parts = repoPath.split("/");
      if (parts.length >= 2) {
        const [owner, repo] = parts;
        const [commits, prs, release] = await Promise.all([
          fetchRecentCommits(owner, repo, 5),
          fetchRecentPRs(owner, repo, 3),
          fetchLatestRelease(owner, repo),
        ]);
        if (commits.length) commitContext += `\nRECENT COMMITS:\n${commits.join("\n")}`;
        if (prs.length) commitContext += `\nMERGED PRs:\n${prs.join("\n")}`;
        if (release) commitContext += `\nLATEST RELEASE: ${release.name} (${release.tag})\n${release.body.slice(0, 500)}`;
      }
    }

    const prompt = `You are the AlphaGap intelligence engine — the smartest Bittensor analyst in the world. You read raw GitHub commits and PRs from Bittensor subnets and translate them into clear, compelling intelligence reports.

SUBNET: ${subnet_name || `SN${netuid}`} (aGap: ${composite_score || "?"})
TOKEN: $${alpha_price ? Number(alpha_price).toFixed(2) : "?"} (24h: ${price_change_24h ? Number(price_change_24h).toFixed(1) : "?"}%) | MCap: $${market_cap ? (Number(market_cap) / 1e6).toFixed(1) + "M" : "?"}

SIGNAL: ${title}
${description || ""}
${commitContext}

Write your analysis using EXACTLY this format (1-3 sentences per section):

🔧 What they built:
(Specific features, fixes, models, improvements. Be concrete.)

📡 Why it matters:
(Why this is significant for the subnet and Bittensor ecosystem.)

💡 In simple terms:
(Explain like telling a friend who knows nothing about tech.)

🎯 The AlphaGap take:
(Is the market sleeping on this? Does dev activity justify the price? Actionable insight.)`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `API error: ${res.status} ${text}` }, { status: 502 });
    }

    const data = await res.json();
    const analysis = data.content?.[0]?.text || null;

    return NextResponse.json({ analysis });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
