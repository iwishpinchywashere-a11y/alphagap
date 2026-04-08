import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "AlphaGap <noreply@alphagap.io>";
const BASE_URL = (process.env.NEXTAUTH_URL || "https://alphagap.io").replace(/\/$/, "");

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>AlphaGap</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:48px 20px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="background:#0d0d14;border:1px solid #1a1a2e;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#0a0a0f;padding:32px 40px;text-align:center;border-bottom:1px solid #1a1a2e;">
            <img src="${BASE_URL}/alphagap_logo_dark.svg" alt="AlphaGap" width="160" height="auto" style="display:block;margin:0 auto;" />
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #1a1a2e;padding:24px 40px;text-align:center;background:#080810;">
            <p style="color:#2d2d4e;font-size:11px;margin:0 0 4px;">AlphaGap &middot; Bittensor Subnet Intelligence</p>
            <p style="color:#2d2d4e;font-size:11px;margin:0;">Visit <a href="${BASE_URL}" style="color:#10b981;text-decoration:none;">alphagap.io</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Subscription confirmation + receipt sent when Stripe checkout completes */
export async function sendSubscriptionConfirmationEmail(
  name: string,
  email: string,
  tier: "pro" | "premium",
  amountCents: number,
  periodEnd: number,
) {
  const firstName = name.split(" ")[0];
  const tierLabel = tier === "premium" ? "AlphaGap Premium" : "AlphaGap Pro";
  const accentColor = tier === "premium" ? "#a855f7" : "#10b981";
  const accentBg = tier === "premium" ? "#2e1065" : "#064e3b";
  const amountStr = `$${(amountCents / 100).toFixed(0)}/month`;
  const renewDate = new Date(periodEnd * 1000).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const proFeatures = [
    "Full Alpha Leaderboard — all 128 subnets ranked",
    "All sorting & filtering tools",
    "AI Signal Intelligence — GitHub & HuggingFace signals",
    "Daily AI Deep-Dive Reports",
    "All 128 Subnet Detail pages",
    "Leaderboard updated every 10 minutes",
  ];

  const premiumFeatures = [
    "Everything in Pro",
    "🐋 Whale & Smart Money Tracker",
    "📡 Social Intelligence & KOL Radar",
    "🧪 Pump Lab — early alpha detector",
    "📈 Performance Tracker",
    "📊 Analytics & Scatter Plots",
    "🏆 Benchmark Rankings",
    "Discord Alpha Scanner",
    "Full access to every page",
  ];

  const features = tier === "premium" ? premiumFeatures : proFeatures;

  const featureRows = features.map(f => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #1a2235;">
        <span style="color:${accentColor};font-weight:700;margin-right:10px;">✓</span>
        <span style="color:#d1d5db;font-size:13px;">${f}</span>
      </td>
    </tr>
  `).join("");

  const html = baseTemplate(`
    <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px 0;">Welcome to ${tierLabel}! 🎉</h1>
    <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 28px 0;">
      Hey ${firstName}, you&apos;re in. Your subscription is active and you have full access starting right now.
    </p>

    <!-- Access list -->
    <div style="background:#0d1117;border:1px solid #1f2937;border-radius:12px;padding:24px 28px;margin:0 0 24px 0;">
      <p style="color:${accentColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px 0;">What you have access to</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${featureRows}
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:0 0 28px 0;">
      <a href="${BASE_URL}/dashboard"
         style="display:inline-block;background:linear-gradient(135deg,${accentColor},${accentColor === "#10b981" ? "#059669" : "#7c3aed"});color:#000000;font-weight:700;font-size:15px;padding:14px 40px;border-radius:10px;text-decoration:none;letter-spacing:-0.2px;">
        Open Your Dashboard &rarr;
      </a>
    </div>

    <!-- Receipt -->
    <div style="background:#0d1117;border:1px solid #1f2937;border-radius:12px;padding:24px 28px;margin:0 0 24px 0;">
      <p style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px 0;">Receipt</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #1a2235;">Plan</td>
          <td style="color:#ffffff;font-size:13px;font-weight:600;text-align:right;padding:8px 0;border-bottom:1px solid #1a2235;">${tierLabel}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #1a2235;">Amount</td>
          <td style="color:#ffffff;font-size:13px;font-weight:600;text-align:right;padding:8px 0;border-bottom:1px solid #1a2235;">${amountStr}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;border-bottom:1px solid #1a2235;">Status</td>
          <td style="text-align:right;padding:8px 0;border-bottom:1px solid #1a2235;">
            <span style="background:${accentBg};color:${accentColor};font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">Active</span>
          </td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:8px 0;">Next renewal</td>
          <td style="color:#ffffff;font-size:13px;font-weight:600;text-align:right;padding:8px 0;">${renewDate}</td>
        </tr>
      </table>
    </div>

    <p style="color:#4b5563;font-size:12px;margin:0;line-height:1.6;">
      Manage your subscription, update payment info, or cancel anytime from
      <a href="${BASE_URL}/account" style="color:${accentColor};text-decoration:none;">Account Settings</a>.
      Questions? Email us at <a href="mailto:hello@getbeanstock.com" style="color:${accentColor};text-decoration:none;">hello@getbeanstock.com</a>
    </p>
  `);

  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `You're in — ${tierLabel} access confirmed`,
    html,
  });
}

/** Cancellation confirmation — access continues until period end */
export async function sendCancellationEmail(
  name: string,
  email: string,
  tier: "pro" | "premium",
  periodEnd: number,
) {
  const firstName = name.split(" ")[0];
  const tierLabel = tier === "premium" ? "AlphaGap Premium" : "AlphaGap Pro";
  const accessUntil = new Date(periodEnd * 1000).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const html = baseTemplate(`
    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 12px 0;">Your subscription has been cancelled</h1>
    <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
      Hi ${firstName}, we&apos;ve received your cancellation request for <strong style="color:#ffffff;">${tierLabel}</strong>.
      No further charges will be made.
    </p>

    <div style="background:#0d1117;border:1px solid #1f2937;border-radius:12px;padding:24px 28px;margin:0 0 24px 0;">
      <p style="color:#10b981;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px 0;">You still have full access until</p>
      <p style="color:#ffffff;font-size:28px;font-weight:800;margin:0;">${accessUntil}</p>
      <p style="color:#6b7280;font-size:13px;margin:12px 0 0 0;">Your ${tierLabel} features remain fully active until this date.</p>
    </div>

    <div style="text-align:center;margin:0 0 28px 0;">
      <a href="${BASE_URL}/dashboard"
         style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#000000;font-weight:700;font-size:15px;padding:14px 40px;border-radius:10px;text-decoration:none;">
        Keep Using AlphaGap &rarr;
      </a>
    </div>

    <div style="background:#0d1117;border:1px solid #1f2937;border-radius:12px;padding:20px 28px;margin:0 0 24px 0;">
      <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.7;">
        Changed your mind? You can resubscribe anytime from
        <a href="${BASE_URL}/account" style="color:#10b981;text-decoration:none;">Account Settings</a> —
        your data and history will still be there.
      </p>
    </div>

    <p style="color:#4b5563;font-size:12px;margin:0;line-height:1.6;">
      Questions or feedback? Reply to this email or reach us at
      <a href="mailto:hello@getbeanstock.com" style="color:#10b981;text-decoration:none;">hello@getbeanstock.com</a>
    </p>
  `);

  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your ${tierLabel} subscription has been cancelled`,
    html,
  });
}

/** Password reset email — token expires in 1 hour */
export async function sendPasswordResetEmail(name: string, email: string, resetToken: string) {
  const firstName = name.split(" ")[0];
  const resetUrl = `${BASE_URL}/auth/reset-password?token=${resetToken}`;

  const html = baseTemplate(`
    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 12px 0;">Reset your password</h1>
    <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 28px 0;">
      Hi ${firstName}, we received a request to reset your AlphaGap password.
      Click the button below to create a new one.
    </p>
    <div style="background:#0d1117;border:1px solid #1f2937;border-radius:12px;padding:28px;margin:0 0 28px 0;text-align:center;">
      <a href="${resetUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#000000;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">
        Reset Password &rarr;
      </a>
      <p style="color:#4b5563;font-size:11px;margin:16px 0 0 0;">This link expires in <strong style="color:#9ca3af;">1 hour</strong></p>
    </div>
    <p style="color:#4b5563;font-size:12px;margin:0;line-height:1.6;">
      If you didn&apos;t request a password reset, you can safely ignore this email — your password won&apos;t change.
    </p>
  `);

  return resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your AlphaGap password",
    html,
  });
}
