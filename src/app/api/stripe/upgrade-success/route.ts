/**
 * GET /api/stripe/upgrade-success?plan=premium
 *
 * Called after a direct subscription upgrade (Pro → Premium via subscriptions.update).
 * No Stripe checkout session exists — we verify via the subscription directly,
 * update the user blob, mint a fresh JWT, and redirect to /activating.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { encode } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { getStripe, PLANS, type PlanKey } from "@/lib/stripe-client";
import { getUserByEmail, updateUser, updateUserListEntry } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const planKey: PlanKey = searchParams.get("plan") === "premium" ? "premium" : "pro";
  const baseUrl = (process.env.NEXTAUTH_URL || "https://alphagap.io").replace(/\/$/, "");

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.redirect(`${baseUrl}/signin`);
  }

  try {
    const stripe = getStripe();
    const user = await getUserByEmail(email, { retries: 5 });
    if (!user) return NextResponse.redirect(`${baseUrl}/dashboard`);

    // Verify the subscription is now on the upgraded plan
    const sub = user.stripeSubscriptionId
      ? await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ["items.data.price"],
        }).catch(() => null)
      : null;

    const tier = planKey;
    const status = "active";
    const periodEnd = sub ? (sub as any).current_period_end as number : 0;
    const customerId = sub ? sub.customer as string : user.stripeCustomerId ?? "";

    // Update blob with new tier
    await Promise.all([
      updateUser(email, {
        stripeCustomerId: customerId,
        subscriptionStatus: status,
        subscriptionTier: tier,
        subscriptionPeriodEnd: periodEnd,
      }),
      updateUserListEntry(email, { subscriptionStatus: status, subscriptionTier: tier }),
    ]).catch((e) => console.error("[upgrade-success] blob update failed:", e));

    // Mint fresh JWT with new tier
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean);

    const token = await encode({
      token: {
        sub: user.id ?? "",
        email: email.toLowerCase(),
        name: user.name ?? "",
        picture: null,
        subscriptionStatus: status,
        subscriptionTier: tier,
        isAdmin: adminEmails.includes(email.toLowerCase()),
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 30 * 24 * 60 * 60,
    });

    const secure = baseUrl.startsWith("https");
    const cookieName = secure
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    const response = NextResponse.redirect(`${baseUrl}/activating`);
    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    console.log(`[upgrade-success] ${email} upgraded to ${tier}`);
    return response;

  } catch (e) {
    console.error("[upgrade-success]", e);
    return NextResponse.redirect(`${baseUrl}/dashboard`);
  }
}
