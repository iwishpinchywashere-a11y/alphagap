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
      <table cellpadding="0" cellspacing="0" style="background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#064e3b 0%,#065f46 100%);padding:32px 40px;text-align:center;">
            <div style="color:#10b981;font-size:26px;font-weight:800;letter-spacing:-0.5px;">AlphaGap</div>
            <div style="color:#6ee7b7;font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Bittensor Intelligence</div>
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
          <td style="border-top:1px solid #1f2937;padding:24px 40px;text-align:center;">
            <p style="color:#374151;font-size:11px;margin:0 0 4px;">AlphaGap &middot; Bittensor Subnet Intelligence</p>
            <p style="color:#374151;font-size:11px;margin:0;">Questions? Reply to this email or visit <a href="${BASE_URL}" style="color:#6b7280;text-decoration:underline;">alphagap.io</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Welcome email sent immediately after signup with email verification link */
export async function sendWelcomeEmail(name: string, email: string, verificationToken: string) {
  const verifyUrl = `${BASE_URL}/auth/verify-email?token=${verificationToken}`;
  const firstName = name.split(" ")[0];

  const html = baseTemplate(`
    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 12px 0;">Welcome to AlphaGap, ${firstName}! 👋</h1>
    <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 28px 0;">
      You now have access to Bittensor subnet intelligence — the leaderboard, AI signals, whale tracking, and more.
      Just verify your email to secure your account and you're good to go.
    </p>
    <div style="background:#0d1117;border:1px solid #1f2937;border-radius:12px;padding:28px;margin:0 0 28px 0;text-align:center;">
      <p style="color:#9ca3af;font-size:13px;margin:0 0 20px 0;">Click below to confirm your email address:</p>
      <a href="${verifyUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#000000;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:-0.2px;">
        Verify Email Address &rarr;
      </a>
      <p style="color:#4b5563;font-size:11px;margin:16px 0 0 0;">Link expires in 24 hours</p>
    </div>
    <p style="color:#4b5563;font-size:12px;margin:0;line-height:1.6;">
      If you didn&apos;t create an AlphaGap account, you can safely ignore this email.
    </p>
  `);

  return resend.emails.send({
    from: FROM,
    to: email,
    subject: "Welcome to AlphaGap — please verify your email",
    html,
  });
}

/** Subscription receipt sent when Stripe checkout completes */
export async function sendSubscriptionConfirmationEmail(
  name: string,
  email: string,
  tier: "pro" | "premium",
  amountCents: number,
  periodEnd: number,
) {
  const firstName = name.split(" ")[0];
  const tierLabel = tier === "premium" ? "AlphaGap Premium" : "AlphaGap Pro";
  const amountStr = `$${(amountCents / 100).toFixed(0)}/month`;
  const renewDate = new Date(periodEnd * 1000).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const html = baseTemplate(`
    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 12px 0;">Subscription confirmed! 🎉</h1>
    <p style="color:#9ca3af;font-size:15px;line-height:1.7;margin:0 0 28px 0;">
      Hi ${firstName}, your <strong style="color:#ffffff;">${tierLabel}</strong> subscription is now active. Here&apos;s your receipt.
    </p>
    <div style="background:#0d1117;border:1px solid #1f2937;border-radius:12px;padding:28px;margin:0 0 28px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:10px 0;border-bottom:1px solid #1f2937;">Plan</td>
          <td style="color:#ffffff;font-size:13px;font-weight:600;text-align:right;padding:10px 0;border-bottom:1px solid #1f2937;">${tierLabel}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:10px 0;border-bottom:1px solid #1f2937;">Amount</td>
          <td style="color:#ffffff;font-size:13px;font-weight:600;text-align:right;padding:10px 0;border-bottom:1px solid #1f2937;">${amountStr}</td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:10px 0;border-bottom:1px solid #1f2937;">Status</td>
          <td style="text-align:right;padding:10px 0;border-bottom:1px solid #1f2937;">
            <span style="background:#064e3b;color:#10b981;font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">Active</span>
          </td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding:10px 0;">Next renewal</td>
          <td style="color:#ffffff;font-size:13px;font-weight:600;text-align:right;padding:10px 0;">${renewDate}</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin:0 0 28px 0;">
      <a href="${BASE_URL}/dashboard"
         style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#000000;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">
        Go to Dashboard &rarr;
      </a>
    </div>
    <p style="color:#4b5563;font-size:12px;margin:0;line-height:1.6;">
      Manage your subscription, update payment, or download invoices anytime from
      <a href="${BASE_URL}/account" style="color:#10b981;text-decoration:none;">Account Settings</a>.
    </p>
  `);

  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `${tierLabel} — subscription confirmed`,
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
