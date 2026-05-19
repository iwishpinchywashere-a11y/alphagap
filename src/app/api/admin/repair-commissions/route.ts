/**
 * POST /api/admin/repair-commissions
 *
 * Admin tool to backfill any missed referral commissions.
 *
 * How it works:
 * 1. Read all attribution blobs (who referred who)
 * 2. For each attributed user, look up their Stripe customer ID
 * 3. List all paid Stripe invoices for that customer
 * 4. For each paid invoice with no existing commission blob → record it
 * 5. Run payPendingCommissions() to attempt Stripe payouts
 *
 * Also checks the stripe-customers lookup blob to diagnose missing entries.
 *
 * Returns a detailed report of what was found and fixed.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { get as blobGet, list as blobList } from "@vercel/blob";
import { getStripe } from "@/lib/stripe-client";
import { recordCommission, payPendingCommissions, COMMISSION_RATE } from "@/lib/referral";
import { getUserByEmail } from "@/lib/users";
import type Stripe from "stripe";

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

interface AttributionBlob {
  refCode:          string;
  referrerUserId:   string;
  referrerEmail:    string;
  referredUserId:   string;
  referredEmail:    string;
  stripeCustomerId?: string;
  signedUpAt:       string;
  firstPaymentAt?:  string;
}

interface CommissionBlob {
  invoiceId: string;
  referrerUserId: string;
  status: "pending" | "paid" | "reversed";
}

export async function POST(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const stripe  = getStripe();
  const report: {
    attributionsScanned: number;
    usersChecked:        { email: string; referredBy: string; customerId: string | null; invoicesFound: number; commissionsAdded: number; issue?: string }[];
    commissionsAdded:    number;
    payoutAttempted:     boolean;
    payoutsPaid:         number;
    errors:              string[];
  } = {
    attributionsScanned: 0,
    usersChecked:        [],
    commissionsAdded:    0,
    payoutAttempted:     false,
    payoutsPaid:         0,
    errors:              [],
  };

  try {
    // ── 1. Load all attribution blobs ───────────────────────────────
    const { blobs: attrBlobs } = await blobList({ prefix: "referral/attributions/", token: TOKEN() });
    report.attributionsScanned = attrBlobs.length;

    // ── 2. Load existing commission invoice IDs (to avoid duplicates) ──
    const { blobs: commBlobs } = await blobList({ prefix: "referral/commissions/", token: TOKEN() });
    const existingCommissions = new Set<string>(); // invoiceId set
    await Promise.all(commBlobs.map(async (b) => {
      const c = await readBlob<CommissionBlob>(b.pathname);
      if (c?.invoiceId) existingCommissions.add(c.invoiceId);
    }));

    // ── 3. Process each attribution ─────────────────────────────────
    const attributions = await Promise.all(attrBlobs.map(b => readBlob<AttributionBlob>(b.pathname)));

    for (const attr of attributions) {
      if (!attr) continue;

      const row: (typeof report.usersChecked)[0] = {
        email:            attr.referredEmail,
        referredBy:       attr.referrerEmail,
        customerId:       null,
        invoicesFound:    0,
        commissionsAdded: 0,
      };

      try {
        // Look up user to get their Stripe customer ID
        const user = await getUserByEmail(attr.referredEmail);
        if (!user) {
          row.issue = "User not found in blob store";
          report.usersChecked.push(row);
          continue;
        }

        // Try to get stripeCustomerId from user blob, then fallback to Stripe search
        let customerId = user.stripeCustomerId;
        if (!customerId) {
          const customers = await stripe.customers.list({ email: attr.referredEmail, limit: 5 }).catch(() => null);
          customerId = customers?.data[0]?.id ?? undefined;
        }

        if (!customerId) {
          row.issue = "No Stripe customer found — user may never have subscribed";
          report.usersChecked.push(row);
          continue;
        }
        row.customerId = customerId;

        // ── List all paid invoices for this customer ────────────────
        const invoices = await stripe.invoices.list({
          customer: customerId,
          status:   "paid",
          limit:    20,
        });

        row.invoicesFound = invoices.data.length;

        for (const invoice of invoices.data) {
          const amountPaid = (invoice as unknown as { amount_paid?: number }).amount_paid ?? invoice.amount_due ?? 0;
          if (amountPaid <= 0) continue;                          // skip $0 / trial
          if (existingCommissions.has(invoice.id)) continue;     // already recorded

          // Record the commission
          const chargeId = typeof (invoice as unknown as { charge?: string | null }).charge === "string"
            ? ((invoice as unknown as { charge: string }).charge)
            : "";

          await recordCommission(attr.referredUserId, invoice.id, chargeId, amountPaid);

          existingCommissions.add(invoice.id);
          row.commissionsAdded++;
          report.commissionsAdded++;

          console.log(`[repair] Commission recorded: $${(amountPaid * COMMISSION_RATE / 100).toFixed(2)} for ${attr.referrerEmail} ← ${attr.referredEmail}`);
        }

        if (row.invoicesFound === 0) {
          row.issue = "No paid Stripe invoices found yet";
        }
      } catch (e) {
        row.issue = `Error: ${String(e)}`;
        report.errors.push(`${attr.referredEmail}: ${String(e)}`);
      }

      report.usersChecked.push(row);
    }

    // ── 4. Attempt to pay pending commissions via Stripe Transfers ──
    if (report.commissionsAdded > 0 || commBlobs.length > 0) {
      report.payoutAttempted = true;
      try {
        report.payoutsPaid = await payPendingCommissions();
      } catch (e) {
        report.errors.push(`payPendingCommissions: ${String(e)}`);
      }
    }

  } catch (e) {
    report.errors.push(`Top-level error: ${String(e)}`);
  }

  return NextResponse.json(report);
}

// ── GET: diagnostic only (no writes) ─────────────────────────────
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const stripe = getStripe();

  try {
    const [
      { blobs: attrBlobs },
      { blobs: commBlobs },
    ] = await Promise.all([
      blobList({ prefix: "referral/attributions/", token: TOKEN() }),
      blobList({ prefix: "referral/commissions/",  token: TOKEN() }),
    ]);

    const existingInvoiceIds = new Set<string>();
    const commDetails: { invoiceId: string; referrerUserId: string; status: string; amount: number }[] = [];
    await Promise.all(commBlobs.map(async (b) => {
      const c = await readBlob<CommissionBlob & { commissionAmount: number }>(b.pathname);
      if (c) {
        existingInvoiceIds.add(c.invoiceId);
        commDetails.push({ invoiceId: c.invoiceId, referrerUserId: c.referrerUserId, status: c.status, amount: c.commissionAmount });
      }
    }));

    const diagnoses = await Promise.all(attrBlobs.map(async (b) => {
      const attr = await readBlob<AttributionBlob>(b.pathname);
      if (!attr) return null;

      const user = await getUserByEmail(attr.referredEmail).catch(() => null);
      let customerId = user?.stripeCustomerId ?? null;
      let invoiceCount = 0;
      let missedInvoices = 0;

      if (!customerId) {
        const customers = await stripe.customers.list({ email: attr.referredEmail, limit: 2 }).catch(() => null);
        customerId = customers?.data[0]?.id ?? null;
      }

      if (customerId) {
        const invoices = await stripe.invoices.list({ customer: customerId, status: "paid", limit: 10 }).catch(() => ({ data: [] as Stripe.Invoice[] }));
        invoiceCount = invoices.data.length;
        missedInvoices = invoices.data.filter(inv => {
          const amt = (inv as unknown as { amount_paid?: number }).amount_paid ?? 0;
          return amt > 0 && !existingInvoiceIds.has(inv.id);
        }).length;
      }

      return {
        referredEmail:    attr.referredEmail,
        referredBy:       attr.referrerEmail,
        signedUpAt:       attr.signedUpAt,
        hasStripeCustomer: !!customerId,
        customerId,
        paidInvoices:     invoiceCount,
        missedCommissions: missedInvoices,
        existingCommissions: commDetails.filter(c => c.referrerUserId === attr.referrerUserId).length,
      };
    }));

    // Check if invoice.payment_succeeded is in Stripe webhook events
    let webhookStatus = null;
    try {
      const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
      const ourWebhook = webhooks.data.find(w => w.url?.includes("alphagap"));
      webhookStatus = ourWebhook ? {
        url:    ourWebhook.url,
        status: ourWebhook.status,
        events: ourWebhook.enabled_events,
        hasInvoiceEvent: ourWebhook.enabled_events.includes("invoice.payment_succeeded") ||
                         ourWebhook.enabled_events.includes("*"),
      } : { url: null, status: "not found", events: [], hasInvoiceEvent: false };
    } catch (e) {
      webhookStatus = { error: String(e) };
    }

    return NextResponse.json({
      attributions:    diagnoses.filter(Boolean),
      commissions:     commDetails,
      webhookStatus,
      totalMissed:     diagnoses.filter(d => d && d.missedCommissions > 0).length,
    });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
