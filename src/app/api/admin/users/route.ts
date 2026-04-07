import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserList, getUserByEmail, updateUser, updateUserListEntry, addToUserList, deleteUser } from "@/lib/users";
import { getStripe } from "@/lib/stripe-client";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdmin(session: any): boolean {
  if (!session?.user) return false;
  if (session.user.isAdmin) return true;
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e: string) => e.trim().toLowerCase());
  return adminEmails.includes((session.user.email ?? "").toLowerCase());
}

// GET /api/admin/users — list all users with subscription details
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "stripe-stats") {
    // Pull live stats from Stripe — only count AlphaGap subscriptions
    try {
      const stripe = getStripe();
      // Only subscriptions with AlphaGap metadata
      const subs = await stripe.subscriptions.list({ status: "active", limit: 100 });
      const alphagapSubs = subs.data.filter(s => s.metadata?.userEmail);
      const mrr = alphagapSubs.reduce((sum, s) => {
        const item = s.items.data[0];
        return sum + (item?.price?.unit_amount ?? 0) / 100;
      }, 0);
      // Count revenue only from AlphaGap invoices
      const customerIds = alphagapSubs.map(s => s.customer as string).filter(Boolean);
      let totalRevenue = 0;
      if (customerIds.length > 0) {
        const invoices = await stripe.invoices.list({ limit: 100 });
        totalRevenue = invoices.data
          .filter(inv => inv.status === "paid" && customerIds.includes(inv.customer as string))
          .reduce((sum, inv) => sum + (inv.amount_paid ?? 0) / 100, 0);
      }
      return NextResponse.json({ activeSubscriptions: alphagapSubs.length, mrr, totalRevenue });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  const users = await getUserList();
  return NextResponse.json({ users });
}

// POST /api/admin/users — grant/revoke access manually
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { action, email, tier } = await req.json();

  // Delete doesn't require the user blob to exist — just wipe everything by email
  if (action === "delete") {
    await deleteUser(email);
    return NextResponse.json({ ok: true, message: `Account deleted: ${email}` });
  }

  const user = await getUserByEmail(email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // sync-user: user exists in blob but is missing from the admin list (e.g. after delete + re-signup race)
  if (action === "sync-user") {
    await addToUserList(user);
    return NextResponse.json({ ok: true, message: `${email} synced to user list` });
  }

  if (action === "grant") {
    const updated = await updateUser(email, { subscriptionStatus: "active" });
    // upsert into list — works even if the entry was missing
    await addToUserList(updated);
    return NextResponse.json({ ok: true, message: `Access granted to ${email}` });
  }

  if (action === "revoke") {
    const updated = await updateUser(email, { subscriptionStatus: "canceled" });
    await addToUserList(updated);
    return NextResponse.json({ ok: true, message: `Access revoked for ${email}` });
  }

  if (action === "make-admin") {
    const updated = await updateUser(email, { isAdmin: true });
    await addToUserList(updated);
    return NextResponse.json({ ok: true, message: `${email} is now an admin` });
  }

  if (action === "set-tier") {
    if (tier === "free") {
      const updated = await updateUser(email, { subscriptionStatus: "none", subscriptionTier: undefined });
      await addToUserList(updated);
      return NextResponse.json({ ok: true, message: `${email} set to Free` });
    }
    if (tier === "pro") {
      const updated = await updateUser(email, { subscriptionStatus: "active", subscriptionTier: "pro" });
      await addToUserList(updated);
      return NextResponse.json({ ok: true, message: `${email} set to Pro` });
    }
    if (tier === "premium") {
      const updated = await updateUser(email, { subscriptionStatus: "active", subscriptionTier: "premium" });
      await addToUserList(updated);
      return NextResponse.json({ ok: true, message: `${email} set to Premium` });
    }
    return NextResponse.json({ error: "Invalid tier. Use: free, pro, premium" }, { status: 400 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
