/**
 * GET /api/audits
 * Returns the latest subnet audit data from audit-data.json.
 * Optional ?netuid=X returns single-subnet detail.
 * Optional ?history=1 returns list of historical audit snapshots.
 */

import { NextResponse } from "next/server";
import { get as blobGet, list } from "@vercel/blob";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getTier } from "@/lib/subscription";
import type { AuditData, SubnetAudit } from "@/app/api/cron/audit-scan/route";

export const dynamic = "force-dynamic";

async function readBlob<T>(name: string, token: string): Promise<T | null> {
  try {
    const result = await blobGet(name, { token, access: "private" });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  // Require Premium tier
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tier = getTier(session);
  if (tier !== "premium") {
    return NextResponse.json({ error: "Premium subscription required" }, { status: 403 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return NextResponse.json({ error: "No blob token" }, { status: 500 });

  const url = new URL(req.url);
  const netuidParam = url.searchParams.get("netuid");
  const wantHistory = url.searchParams.get("history") === "1";

  // Return list of historical audit snapshots
  if (wantHistory) {
    try {
      const { blobs } = await list({ prefix: "audit-history/", token });
      const history = blobs
        .map(b => {
          const dateMatch = b.pathname.match(/audit-history\/(\d{4}-\d{2}-\d{2})\.json/);
          return dateMatch ? { date: dateMatch[1], url: b.downloadUrl, size: b.size } : null;
        })
        .filter(Boolean)
        .sort((a, b) => (b?.date || "").localeCompare(a?.date || ""));
      return NextResponse.json({ history });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  const data = await readBlob<AuditData>("audit-data.json", token);
  if (!data) {
    return NextResponse.json({ error: "Audit data not yet available — first cron run pending" }, { status: 404 });
  }

  // Single subnet detail
  if (netuidParam) {
    const netuid = parseInt(netuidParam, 10);
    const audit: SubnetAudit | undefined = data.subnets[netuid];
    if (!audit) {
      return NextResponse.json({ error: `No audit data for SN${netuid}` }, { status: 404 });
    }
    return NextResponse.json({ audit, updatedAt: data.updatedAt });
  }

  // Subnets permanently excluded (Root network SN0 is not a real task subnet)
  const AUDIT_EXCLUDED = new Set([0]);

  // All subnets — enrich with grade breakdown summary
  const subnets = Object.values(data.subnets)
    .filter(s => !AUDIT_EXCLUDED.has(s.netuid))
    .sort((a, b) => a.operationalScore - b.operationalScore);
  const grades = subnets.reduce((acc, s) => {
    acc[s.grade] = (acc[s.grade] || 0) + 1; return acc;
  }, {} as Record<string, number>);
  const criticalCount = subnets.filter(s => s.flags.some(f => f.severity === "critical")).length;
  const avgScore = subnets.length > 0
    ? Math.round(subnets.reduce((s, a) => s + a.operationalScore, 0) / subnets.length)
    : 0;

  return NextResponse.json({
    subnets,
    summary: { total: subnets.length, grades, criticalCount, avgScore },
    updatedAt: data.updatedAt,
    totalScanned: data.totalScanned,
  });
}
