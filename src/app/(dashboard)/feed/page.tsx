"use client";

/**
 * /feed — one written card per subnet with real recent activity.
 *
 * This replaces the filterable raw-signal firehose. The old page surfaced
 * every flow blip and made the reader assemble the story with filter
 * controls; now a 6-hourly cron (api/cron/feed-digest) aggregates 48h of
 * signals per subnet, applies a materiality bar, and writes one short card
 * for each subnet that actually did something. The page just renders them —
 * no filters, no sensitivity sliders, one feed.
 */

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SubnetLogo from "@/components/dashboard/SubnetLogo";
import AgIcon from "@/components/AgIcon";
import BlurGate from "@/components/BlurGate";
import { getTier } from "@/lib/subscription";
import type { FeedCard } from "@/app/api/cron/feed-digest/route";

function timeAgo(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export default function FeedPage() {
  const { data: session } = useSession();
  const tier = getTier(session);
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/feed-digest")
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((d) => setCards(Array.isArray(d?.cards) ? d.cards : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fresh = cards.filter((c) => Date.now() - new Date(c.writtenAt).getTime() < 48 * 3600000);
  const older = cards.filter((c) => Date.now() - new Date(c.writtenAt).getTime() >= 48 * 3600000);

  return (
    <main className="flex-1 bg-[#07090b] text-white ag-aurora">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] leading-tight flex items-center gap-2.5">
            <AgIcon name="bolt" className="w-7 h-7 text-emerald-400" />
            <span>The <span className="ag-gradient-text">Feed</span></span>
          </h1>
        </div>
        <p className="text-[14.5px] text-gray-400 max-w-2xl leading-relaxed mb-8">
          What every subnet actually did, one card each. Written from the last 48 hours of
          dev activity, emission moves and score changes — quiet subnets don&apos;t post.
        </p>

        <BlurGate tier={tier} required="premium" minHeight="400px">
          {loading && (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="ag-glass rounded-2xl h-36 animate-pulse bg-white/[0.02]" />
              ))}
            </div>
          )}

          {!loading && cards.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              No updates yet — cards generate every six hours from the latest scan.
            </div>
          )}

          <div className="space-y-4">
            {fresh.map((c) => <Card key={c.netuid} c={c} />)}
          </div>

          {older.length > 0 && (
            <>
              <div className="flex items-center gap-3 mt-10 mb-4">
                <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-gray-600">Earlier this week</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="space-y-4 opacity-80">
                {older.map((c) => <Card key={c.netuid} c={c} />)}
              </div>
            </>
          )}
        </BlurGate>
      </div>
    </main>
  );
}

function Card({ c }: { c: FeedCard }) {
  return (
    <article className="ag-glass rounded-2xl p-5 border border-white/[0.07] hover:border-white/[0.14] transition-colors">
      <div className="flex items-start gap-3">
        <Link href={`/subnets/${c.netuid}`} className="flex-shrink-0 mt-0.5">
          <SubnetLogo netuid={c.netuid} name={c.name} size={34} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Link
              href={`/subnets/${c.netuid}`}
              className="text-white font-display font-semibold hover:text-emerald-300 transition-colors"
            >
              {c.name}
            </Link>
            <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-full px-1.5 py-px">
              SN{c.netuid}
            </span>
            <span className="text-[11px] text-gray-600 ml-auto flex-shrink-0">{timeAgo(c.writtenAt)}</span>
          </div>
          <h2 className="text-[15px] font-semibold text-gray-100 leading-snug mb-1.5">{c.headline}</h2>
          <p className="text-[13.5px] text-gray-400 leading-relaxed mb-3">{c.body}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {c.facts.map((f, i) => (
              <span key={i} className="text-[10.5px] font-mono text-gray-500 bg-white/[0.03] border border-white/[0.07] rounded-md px-1.5 py-0.5">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
