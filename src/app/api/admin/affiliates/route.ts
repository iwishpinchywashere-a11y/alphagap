/**
 * GET /api/admin/affiliates
 *
 * Admin-only endpoint that returns every affiliate's stats:
 *   - name / email
 *   - referral code
 *   - total signups, pro subs, premium subs
 *   - total earned (paid), pending earned, estimated MRR
 *   - Stripe Connect status
 *
 * Data is aggregated live from Vercel Blob on each request.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { get as blobGet, list as blobList } from "@vercel/blob";
import { getUserList } from "@/lib/users";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN ?? "";

async function readBlob<T>(pathname: string): Promise<T | null> {
  try {
    const blob = await blobGet(pathname, { token: TOKEN(), access: "private" });
    if (!blob?.stream) return null;
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const buf = chunks.reduce((a, b) => {
      const c = new Uint8Array(a.length + b.length);
      c.set(a); c.set(b, a.length); return c;
    }, new Uint8Array(0));
    return JSON.parse(Buffer.from(buf).toString("utf-8")) as T;
  } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  if (!session?.user) return false;
  if (session.user.isAdmin) return true;
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e: string) => e.trim().toLowerCase());
  return adminEmails.includes((session.user.email ?? "").toLowerCase());
}

interface AffiliateBlob {
  userId: string;
  userEmail: string;
  stripeConnectAccountId?: string;
  payoutsEnabled: boolean;
  createdAt: string;
}
interface CodeBlob {
  code: string;
  userId: string;
  userEmail: string;
  isActive: boolean;
  createdAt: string;
}
interface AttributionBlob {
  refCode: string;
  referrerUserId: string;
  referrerEmail: string;
  referredUserId: string;
  referredEmail: string;
  signedUpAt: string;
  firstPaymentAt?: string;
}
interface CommissionBlob {
  invoiceId: string;
  referrerUserId: string;
  attributionReferredUserId: string;
  grossAmount: number;
  commissionAmount: number;
  currency: string;
  status: "pending" | "paid" | "reversed";
  createdAt: string;
}

export interface AdminAffiliateEntry {
  userId: string;
  email: string;
  name: string;
  referralCode: string | null;
  totalSignups: number;
  proSubs: number;
  premiumSubs: number;
  totalEarned: number;    // cents — paid commissions
  pendingEarned: number;  // cents — pending commissions
  monthlyEarnings: number; // cents — last 30 days
  payoutsEnabled: boolean;
  hasStripeConnect: boolean;
  joinedAt: string;
}

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // ── Fetch all blob lists in parallel ────────────────────────────
    const [
      { blobs: affiliateBlobs },
      { blobs: codeBlobs },
      { blobs: attributionBlobs },
      { blobs: commissionBlobs },
      users,
    ] = await Promise.all([
      blobList({ prefix: "referral/affiliates/", token: TOKEN() }),
      blobList({ prefix: "referral/codes/",      token: TOKEN() }),
      blobList({ prefix: "referral/attributions/", token: TOKEN() }),
      blobList({ prefix: "referral/commissions/",  token: TOKEN() }),
      getUserList().catch(() => [] as Awaited<ReturnType<typeof getUserList>>),
    ]);

    // ── Read all blobs in parallel ──────────────────────────────────
    const [affiliates, codes, attributions, commissions] = await Promise.all([
      Promise.all(affiliateBlobs.map(b => readBlob<AffiliateBlob>(b.pathname))),
      Promise.all(codeBlobs.map(b => readBlob<CodeBlob>(b.pathname))),
      Promise.all(attributionBlobs.map(b => readBlob<AttributionBlob>(b.pathname))),
      Promise.all(commissionBlobs.map(b => readBlob<CommissionBlob>(b.pathname))),
    ]);

    // ── Build lookup maps ───────────────────────────────────────────
    // userId → affiliate account
    const affiliateMap = new Map<string, AffiliateBlob>();
    for (const a of affiliates) {
      if (a) affiliateMap.set(a.userId, a);
    }

    // userId → referral code (from the code blobs, pick the active one)
    const codeMap = new Map<string, string>();
    for (const c of codes) {
      if (c?.isActive) codeMap.set(c.userId, c.code);
    }

    // email → { subscriptionTier, name } from user list
    const userByEmail = new Map<string, { name: string; tier: "pro" | "premium" | null }>();
    for (const u of users) {
      const isActive = u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tier: "pro" | "premium" | null = isActive ? ((u as any).subscriptionTier ?? "pro") : null;
      userByEmail.set(u.email.toLowerCase(), { name: u.name, tier });
    }

    // referrerUserId → attributions[]
    const attributionsByReferrer = new Map<string, AttributionBlob[]>();
    for (const a of attributions) {
      if (!a) continue;
      const list = attributionsByReferrer.get(a.referrerUserId) ?? [];
      list.push(a);
      attributionsByReferrer.set(a.referrerUserId, list);
    }

    // referrerUserId → commissions[]
    const commissionsByReferrer = new Map<string, CommissionBlob[]>();
    for (const c of commissions) {
      if (!c) continue;
      const list = commissionsByReferrer.get(c.referrerUserId) ?? [];
      list.push(c);
      commissionsByReferrer.set(c.referrerUserId, list);
    }

    // ── Collect all unique affiliate userIds ────────────────────────
    // Include anyone who has either an affiliate account OR a referral code
    const allAffiliateUserIds = new Set<string>([
      ...Array.from(affiliateMap.keys()),
      ...Array.from(codeMap.keys()),
    ]);

    // We need emails for code-only users (no affiliate account)
    // Get email from code blobs
    const emailByUserId = new Map<string, string>();
    for (const c of codes) {
      if (c) emailByUserId.set(c.userId, c.userEmail);
    }
    for (const a of affiliates) {
      if (a) emailByUserId.set(a.userId, a.userEmail);
    }

    const thirtyDaysAgo = Date.now() - 30 * 86400_000;

    // ── Build result rows ───────────────────────────────────────────
    const result: AdminAffiliateEntry[] = [];

    for (const userId of allAffiliateUserIds) {
      const email = emailByUserId.get(userId) ?? "";
      const affiliate = affiliateMap.get(userId);
      const code = codeMap.get(userId) ?? null;

      const userInfo = userByEmail.get(email.toLowerCase());
      const name = userInfo?.name || email.split("@")[0] || "Unknown";

      const myAttributions = attributionsByReferrer.get(userId) ?? [];
      const myCommissions  = commissionsByReferrer.get(userId) ?? [];

      // Count pro/premium among referred users (by their current tier)
      let proSubs     = 0;
      let premiumSubs = 0;
      for (const attr of myAttributions) {
        const referred = userByEmail.get(attr.referredEmail.toLowerCase());
        if (!referred?.tier) continue;
        if (referred.tier === "premium") premiumSubs++;
        else proSubs++;
      }

      const paidCommissions    = myCommissions.filter(c => c.status === "paid");
      const pendingCommissions = myCommissions.filter(c => c.status === "pending");
      const recentCommissions  = myCommissions.filter(c =>
        c.status !== "reversed" && new Date(c.createdAt).getTime() > thirtyDaysAgo
      );

      const totalEarned    = paidCommissions.reduce((s, c) => s + c.commissionAmount, 0);
      const pendingEarned  = pendingCommissions.reduce((s, c) => s + c.commissionAmount, 0);
      const monthlyEarnings = recentCommissions.reduce((s, c) => s + c.commissionAmount, 0);

      result.push({
        userId,
        email,
        name,
        referralCode: code,
        totalSignups: myAttributions.length,
        proSubs,
        premiumSubs,
        totalEarned,
        pendingEarned,
        monthlyEarnings,
        payoutsEnabled:   affiliate?.payoutsEnabled ?? false,
        hasStripeConnect: !!(affiliate?.stripeConnectAccountId),
        joinedAt: affiliate?.createdAt ?? (codes.find(c => c?.userId === userId)?.createdAt ?? new Date().toISOString()),
      });
    }

    // Sort by total signups desc, then total earned desc
    result.sort((a, b) => b.totalSignups - a.totalSignups || b.totalEarned - a.totalEarned);

    return NextResponse.json({ affiliates: result });
  } catch (e) {
    console.error("[admin/affiliates]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
