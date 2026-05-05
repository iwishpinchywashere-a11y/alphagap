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

/** Telegram Bot announcement blast — sent to all users */
export async function sendTelegramAnnouncementEmail(
  name: string,
  email: string,
  tier: "free" | "pro" | "premium",
) {
  const firstName = name?.split(" ")[0] || "there";
  const isPremium = tier === "premium";

  const ctaHref = isPremium ? `${BASE_URL}/alerts` : `${BASE_URL}/pricing`;
  const ctaLabel = isPremium ? "Connect Your Telegram Now →" : "Unlock Telegram Alerts →";
  const ctaNote = isPremium
    ? "Takes 30 seconds. Head to alphagap.io/alerts to get your connect code."
    : "Available on the Premium plan · $49/mo · Cancel anytime";

  const alertTypes = [
    { icon: "📊", label: "aGap Score Change", desc: "Catch momentum shifts the second they happen — before the market reacts." },
    { icon: "⚡", label: "Emissions Change", desc: "Know the moment validators rotate weight to a subnet. Be first." },
    { icon: "🔮", label: "Development Updates", desc: "GitHub commit spikes & HuggingFace model releases, filtered by signal strength so you only see the real ones." },
    { icon: "🐋", label: "Whale Activity / Volume Surge", desc: "Large wallet accumulation and unusual on-chain volume — straight from the flow page." },
    { icon: "💬", label: "Discord Alpha", desc: "AlphaGap scans every Bittensor subnet Discord in real time. High-signal posts come straight to you." },
    { icon: "𝕏", label: "Going Viral on X", desc: "When a KOL thread breaks in the Bittensor ecosystem, you'll know within minutes." },
    { icon: "💰", label: "Price Movement", desc: "Your threshold, your subnets. Fires once per 24h per subnet — no spam." },
  ];

  const alertRows = alertTypes.map(a => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #1a2235;vertical-align:top;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width:36px;vertical-align:top;padding-top:2px;">
              <span style="font-size:20px;line-height:1;">${a.icon}</span>
            </td>
            <td style="vertical-align:top;">
              <p style="color:#ffffff;font-size:13px;font-weight:700;margin:0 0 3px 0;">${a.label}</p>
              <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;">${a.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  const html = baseTemplate(`
    <!-- Hero -->
    <div style="text-align:center;margin:0 0 36px 0;">
      <div style="display:inline-block;background:linear-gradient(135deg,#0d2b1f,#0a1a2e);border:1px solid #10b98130;border-radius:16px;padding:28px 32px;margin-bottom:24px;">
        <div style="font-size:52px;line-height:1;margin-bottom:12px;">📡</div>
        <div style="display:inline-block;background:#10b98115;border:1px solid #10b98130;border-radius:20px;padding:4px 14px;margin-bottom:16px;">
          <span style="color:#10b981;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">New Feature</span>
        </div>
        <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px 0;line-height:1.2;">
          Introducing: AlphaGap<br>Telegram Alerts
        </h1>
        <p style="color:#9ca3af;font-size:14px;margin:0;line-height:1.6;">Real-time signals. Straight to your phone.</p>
      </div>
    </div>

    <!-- Intro -->
    <p style="color:#d1d5db;font-size:15px;line-height:1.8;margin:0 0 12px 0;">
      Hey ${firstName},
    </p>
    <p style="color:#9ca3af;font-size:15px;line-height:1.8;margin:0 0 24px 0;">
      The gap between what a team ships and when the market prices it in closes fast. By the time you open a dashboard, the opportunity may already be moving.
    </p>
    <p style="color:#9ca3af;font-size:15px;line-height:1.8;margin:0 0 32px 0;">
      We just launched the <strong style="color:#ffffff;">AlphaGap Telegram Bot</strong> — the fastest way to stay ahead. The moment something worth acting on happens on your watchlist, you get a ping. No refreshing. No missed signals. No FOMO.
    </p>

    <!-- Alert types -->
    <div style="background:#0a0f1a;border:1px solid #1f2937;border-radius:14px;padding:24px 28px;margin:0 0 28px 0;">
      <p style="color:#10b981;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px 0;">7 customisable alert types</p>
      <p style="color:#4b5563;font-size:12px;margin:0 0 20px 0;">You control exactly what fires and when.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${alertRows}
        <tr><td style="padding-top:14px;"><p style="color:#4b5563;font-size:12px;margin:0;">Set score thresholds · watchlist-scoped · pause anytime</p></td></tr>
      </table>
    </div>

    <!-- How to connect (premium only) or upgrade prompt -->
    ${isPremium ? `
    <div style="background:#0d2b1f;border:1px solid #10b98130;border-radius:14px;padding:24px 28px;margin:0 0 28px 0;">
      <p style="color:#10b981;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px 0;">You already have access — set up in 60 seconds</p>
      <table cellpadding="0" cellspacing="0" width="100%">
        ${[
          "Head to alphagap.io/alerts",
          "Click &ldquo;Get connect code&rdquo;",
          "Open Telegram, find @alphagapalertsbot, send the code",
          "Pick your alert types — done",
        ].map((step, i) => `
          <tr>
            <td style="padding:8px 0;vertical-align:top;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="width:28px;vertical-align:top;">
                  <div style="width:22px;height:22px;background:#10b98120;border:1px solid #10b98140;border-radius:50%;text-align:center;line-height:22px;">
                    <span style="color:#10b981;font-size:11px;font-weight:700;">${i + 1}</span>
                  </div>
                </td>
                <td style="vertical-align:middle;padding-left:10px;">
                  <span style="color:#d1d5db;font-size:13px;">${step}</span>
                </td>
              </tr></table>
            </td>
          </tr>
        `).join("")}
      </table>
    </div>
    ` : `
    <div style="background:#0a0f1a;border:1px solid #1f2937;border-radius:14px;padding:20px 28px;margin:0 0 28px 0;">
      <p style="color:#9ca3af;font-size:13px;line-height:1.7;margin:0;">
        Telegram Alerts are available on the <strong style="color:#ffffff;">Premium plan ($49/mo)</strong>.
        If you're already finding alpha on Pro — this takes it to the next level.
        Upgrade anytime and keep everything you already have.
      </p>
    </div>
    `}

    <!-- CTA -->
    <div style="text-align:center;margin:0 0 32px 0;">
      <a href="${ctaHref}"
         style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#000000;font-weight:800;font-size:15px;padding:16px 44px;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;">
        ${ctaLabel}
      </a>
      <p style="color:#4b5563;font-size:11px;margin:12px 0 0 0;">${ctaNote}</p>
    </div>

    <!-- Sign-off -->
    <p style="color:#6b7280;font-size:13px;line-height:1.7;margin:0;border-top:1px solid #1a1a2e;padding-top:24px;">
      Good luck out there,<br>
      <strong style="color:#9ca3af;">— The AlphaGap Team</strong>
    </p>
  `);

  return resend.emails.send({
    from: FROM,
    to: email,
    subject: "📡 Introducing: AlphaGap Telegram Alerts",
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
