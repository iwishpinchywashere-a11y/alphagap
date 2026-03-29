import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return NextResponse.json({ error: "No API key" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { title, description, subnet_name, netuid, composite_score, alpha_price, price_change_24h, market_cap } = body;

    if (!title) {
      return NextResponse.json({ error: "Missing signal title" }, { status: 400 });
    }

    const prompt = `You are AlphaGap, a Bittensor subnet intelligence analyst. Analyze this signal and explain it in 2-3 sentences. Be specific about WHAT happened and WHY it matters for the subnet's alpha token price. No emoji, no headers.

Signal: ${title}
Details: ${description || ""}
Subnet: ${subnet_name || `SN${netuid}`} (aGap score: ${composite_score || "?"})
Price: $${alpha_price ? Number(alpha_price).toFixed(2) : "?"} (24h: ${price_change_24h ? Number(price_change_24h).toFixed(1) : "?"}%)
MCap: $${market_cap ? (Number(market_cap) / 1e6).toFixed(1) + "M" : "?"}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Anthropic API error: ${res.status} ${text}` }, { status: 502 });
    }

    const data = await res.json();
    const analysis = data.content?.[0]?.text || null;

    return NextResponse.json({ analysis });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
