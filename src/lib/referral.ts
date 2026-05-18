import { getDb } from "@/lib/db";

export const COMMISSION_RATE = 0.20; // 20%
export const COMMISSION_DURATION_MONTHS = 12;
export const COOKIE_NAME = "ag_ref";
export const COOKIE_DAYS = 90;

// ── DB row types ──────────────────────────────────────────────────────────────

interface ReferralCodeRow {
  id: number;
  code: string;
  user_id: string;
  user_email: string;
  created_at: string;
  is_active: number;
}

export interface ReferralAttributionRow {
  id: number;
  ref_code: string;
  referrer_user_id: string;
  referrer_email: string;
  referred_user_id: string;
  referred_email: string;
  stripe_customer_id: string | null;
  signed_up_at: string;
  first_payment_at: string | null;
  commission_expires_at: string | null;
}

interface AffiliateAccountRow {
  id: number;
  user_id: string;
  user_email: string;
  stripe_connect_account_id: string | null;
  onboarded_at: string | null;
  payouts_enabled: number;
  created_at: string;
}

interface CommissionLedgerRow {
  id: number;
  attribution_id: number;
  stripe_invoice_id: string;
  stripe_charge_id: string | null;
  gross_amount: number;
  commission_amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  stripe_transfer_id: string | null;
}

// ── Public stats type ─────────────────────────────────────────────────────────

export interface AffiliateStats {
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
  pendingEarned: number;
  referralCode: string;
  connectOnboarded: boolean;
  payoutsEnabled: boolean;
  recentReferrals: RecentReferral[];
}

export interface RecentReferral {
  email: string;
  signedUpAt: string;
  status: "subscribed" | "free";
  commissionEarned: number;
}

// ── Code generation ───────────────────────────────────────────────────────────

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function generateCode(userId: string): string {
  const db = getDb();
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomCode(6);
    const existing = db
      .prepare("SELECT id FROM referral_codes WHERE code = ? COLLATE NOCASE")
      .get(code) as { id: number } | undefined;
    if (!existing) return code;
  }
  // Fallback: use userId prefix + random suffix to guarantee uniqueness
  return (userId.slice(0, 4) + randomCode(4)).toUpperCase();
}

// ── Code management ───────────────────────────────────────────────────────────

const CUSTOM_CODE_RE = /^[A-Za-z0-9-]{3,20}$/;

export function createReferralCode(
  userId: string,
  userEmail: string,
  customCode?: string,
): { code: string } | { error: string } {
  const db = getDb();

  // Only one active code per user — check if they already have one
  const existingForUser = db
    .prepare("SELECT code FROM referral_codes WHERE user_id = ? AND is_active = 1")
    .get(userId) as { code: string } | undefined;
  if (existingForUser) return { code: existingForUser.code };

  let code: string;
  if (customCode) {
    if (!CUSTOM_CODE_RE.test(customCode)) {
      return { error: "Custom code must be 3–20 alphanumeric characters or hyphens" };
    }
    const taken = db
      .prepare("SELECT id FROM referral_codes WHERE code = ? COLLATE NOCASE")
      .get(customCode) as { id: number } | undefined;
    if (taken) return { error: "That code is already taken" };
    code = customCode.toUpperCase();
  } else {
    code = generateCode(userId);
  }

  db.prepare(
    "INSERT INTO referral_codes (code, user_id, user_email) VALUES (?, ?, ?)",
  ).run(code, userId, userEmail);

  return { code };
}

export function getUserReferralCode(userId: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT code FROM referral_codes WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1")
    .get(userId) as { code: string } | undefined;
  return row?.code ?? null;
}

export function getOrCreateReferralCode(userId: string, userEmail: string): string {
  const existing = getUserReferralCode(userId);
  if (existing) return existing;
  const result = createReferralCode(userId, userEmail);
  if ("error" in result) {
    // Shouldn't happen on auto-create, but fall back
    throw new Error(`Failed to create referral code: ${result.error}`);
  }
  return result.code;
}

export function setCustomCode(
  userId: string,
  userEmail: string,
  customCode: string,
): { code: string } | { error: string } {
  if (!CUSTOM_CODE_RE.test(customCode)) {
    return { error: "Custom code must be 3–20 alphanumeric characters or hyphens" };
  }

  const db = getDb();
  const normalized = customCode.toUpperCase();

  const taken = db
    .prepare("SELECT user_id FROM referral_codes WHERE code = ? COLLATE NOCASE")
    .get(normalized) as { user_id: string } | undefined;
  if (taken && taken.user_id !== userId) return { error: "That code is already taken" };
  if (taken && taken.user_id === userId) return { code: normalized }; // already theirs

  // Deactivate old codes for this user
  db.prepare("UPDATE referral_codes SET is_active = 0 WHERE user_id = ?").run(userId);
  // Insert new code
  db.prepare("INSERT INTO referral_codes (code, user_id, user_email) VALUES (?, ?, ?)").run(
    normalized,
    userId,
    userEmail,
  );

  return { code: normalized };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateCode(
  code: string,
): { valid: boolean; referrerUserId?: string; referrerEmail?: string } {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT user_id, user_email FROM referral_codes WHERE code = ? COLLATE NOCASE AND is_active = 1",
    )
    .get(code) as ReferralCodeRow | undefined;
  if (!row) return { valid: false };
  return { valid: true, referrerUserId: row.user_id, referrerEmail: row.user_email };
}

// ── Attribution ───────────────────────────────────────────────────────────────

export function createAttribution(
  refCode: string,
  referredUserId: string,
  referredEmail: string,
  stripeCustomerId?: string,
): void {
  const validation = validateCode(refCode);
  if (!validation.valid || !validation.referrerUserId || !validation.referrerEmail) {
    console.warn(`[referral] createAttribution: invalid code ${refCode}`);
    return;
  }

  // Prevent self-referral
  if (validation.referrerUserId === referredUserId) {
    console.warn(`[referral] Self-referral blocked for user ${referredUserId}`);
    return;
  }

  const db = getDb();

  // Only one attribution per referred user
  const existing = db
    .prepare("SELECT id FROM referral_attributions WHERE referred_user_id = ?")
    .get(referredUserId) as { id: number } | undefined;
  if (existing) return;

  db.prepare(
    `INSERT INTO referral_attributions
       (ref_code, referrer_user_id, referrer_email, referred_user_id, referred_email, stripe_customer_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    refCode.toUpperCase(),
    validation.referrerUserId,
    validation.referrerEmail,
    referredUserId,
    referredEmail,
    stripeCustomerId ?? null,
  );
}

export function getAttributionByReferredUser(
  referredUserId: string,
): ReferralAttributionRow | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM referral_attributions WHERE referred_user_id = ? LIMIT 1")
      .get(referredUserId) as ReferralAttributionRow | undefined) ?? null
  );
}

// ── Commission recording ──────────────────────────────────────────────────────

export function recordCommission(
  attributionId: number,
  invoiceId: string,
  chargeId: string,
  grossAmount: number,
): void {
  const db = getDb();

  // Get attribution to check expiry window
  const attribution = db
    .prepare("SELECT * FROM referral_attributions WHERE id = ?")
    .get(attributionId) as ReferralAttributionRow | undefined;
  if (!attribution) {
    console.warn(`[referral] recordCommission: attribution ${attributionId} not found`);
    return;
  }

  // If no expiry set yet, this is the first payment — set it now
  if (!attribution.commission_expires_at) {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + COMMISSION_DURATION_MONTHS);
    db.prepare(
      "UPDATE referral_attributions SET first_payment_at = datetime('now'), commission_expires_at = ? WHERE id = ?",
    ).run(expiresAt.toISOString(), attributionId);
  } else {
    // Check if within window
    const expires = new Date(attribution.commission_expires_at);
    if (new Date() > expires) {
      console.log(`[referral] Commission window expired for attribution ${attributionId}`);
      return;
    }
  }

  const commissionAmount = Math.floor(grossAmount * COMMISSION_RATE);

  try {
    db.prepare(
      `INSERT INTO commission_ledger
         (attribution_id, stripe_invoice_id, stripe_charge_id, gross_amount, commission_amount, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
    ).run(attributionId, invoiceId, chargeId ?? null, grossAmount, commissionAmount);
    console.log(
      `[referral] Commission recorded: $${(commissionAmount / 100).toFixed(2)} for attribution ${attributionId}`,
    );
  } catch (e) {
    // UNIQUE constraint on invoice_id — already recorded, skip
    console.log(`[referral] Invoice ${invoiceId} already recorded, skipping`);
  }
}

// ── Payout processing ─────────────────────────────────────────────────────────

export async function payPendingCommissions(): Promise<number> {
  const db = getDb();

  // Get pending ledger entries where affiliate has payouts enabled
  const pendingRows = db
    .prepare(
      `SELECT cl.*, ra.referrer_user_id, aa.stripe_connect_account_id
       FROM commission_ledger cl
       JOIN referral_attributions ra ON ra.id = cl.attribution_id
       JOIN affiliate_accounts aa ON aa.user_id = ra.referrer_user_id
       WHERE cl.status = 'pending' AND aa.payouts_enabled = 1 AND aa.stripe_connect_account_id IS NOT NULL`,
    )
    .all() as (CommissionLedgerRow & {
    referrer_user_id: string;
    stripe_connect_account_id: string;
  })[];

  if (pendingRows.length === 0) return 0;

  // Lazy import to avoid pulling Stripe into edge contexts
  const { createTransfer } = await import("@/lib/stripe-connect");

  let paid = 0;
  for (const row of pendingRows) {
    try {
      const transferId = await createTransfer(
        row.commission_amount,
        row.currency,
        row.stripe_connect_account_id,
        `AlphaGap affiliate commission — invoice ${row.stripe_invoice_id}`,
      );
      db.prepare(
        "UPDATE commission_ledger SET status = 'paid', paid_at = datetime('now'), stripe_transfer_id = ? WHERE id = ?",
      ).run(transferId, row.id);
      paid++;
      console.log(`[referral] Paid commission ${row.id} → transfer ${transferId}`);
    } catch (e) {
      console.error(`[referral] Failed to pay commission ${row.id}:`, e);
    }
  }

  return paid;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getAffiliateStats(userId: string): AffiliateStats {
  const db = getDb();

  // Get the existing code; auto-create only if there's already one or fallback
  const existingCode = getUserReferralCode(userId);
  const referralCode = existingCode ?? "";

  const affiliateAccount = db
    .prepare("SELECT * FROM affiliate_accounts WHERE user_id = ?")
    .get(userId) as AffiliateAccountRow | undefined;

  const totalReferralsRow = db
    .prepare("SELECT COUNT(*) as cnt FROM referral_attributions WHERE referrer_user_id = ?")
    .get(userId) as { cnt: number };

  // "Active" = referred users who have a paid commission
  const activeReferralsRow = db
    .prepare(
      `SELECT COUNT(DISTINCT ra.id) as cnt
       FROM referral_attributions ra
       JOIN commission_ledger cl ON cl.attribution_id = ra.id
       WHERE ra.referrer_user_id = ?`,
    )
    .get(userId) as { cnt: number };

  const totalEarnedRow = db
    .prepare(
      `SELECT COALESCE(SUM(cl.commission_amount), 0) as total
       FROM commission_ledger cl
       JOIN referral_attributions ra ON ra.id = cl.attribution_id
       WHERE ra.referrer_user_id = ? AND cl.status = 'paid'`,
    )
    .get(userId) as { total: number };

  const pendingEarnedRow = db
    .prepare(
      `SELECT COALESCE(SUM(cl.commission_amount), 0) as total
       FROM commission_ledger cl
       JOIN referral_attributions ra ON ra.id = cl.attribution_id
       WHERE ra.referrer_user_id = ? AND cl.status = 'pending'`,
    )
    .get(userId) as { total: number };

  // Recent referrals (last 20)
  const recentRows = db
    .prepare(
      `SELECT ra.referred_email, ra.signed_up_at,
              COALESCE(SUM(CASE WHEN cl.status IN ('paid','pending') THEN cl.commission_amount ELSE 0 END), 0) as commission_earned,
              COUNT(cl.id) as payment_count
       FROM referral_attributions ra
       LEFT JOIN commission_ledger cl ON cl.attribution_id = ra.id
       WHERE ra.referrer_user_id = ?
       GROUP BY ra.id
       ORDER BY ra.signed_up_at DESC
       LIMIT 20`,
    )
    .all(userId) as {
    referred_email: string;
    signed_up_at: string;
    commission_earned: number;
    payment_count: number;
  }[];

  const recentReferrals: RecentReferral[] = recentRows.map((row) => ({
    email: maskEmail(row.referred_email),
    signedUpAt: row.signed_up_at,
    status: row.payment_count > 0 ? "subscribed" : "free",
    commissionEarned: row.commission_earned,
  }));

  return {
    totalReferrals: totalReferralsRow.cnt,
    activeReferrals: activeReferralsRow.cnt,
    totalEarned: totalEarnedRow.total,
    pendingEarned: pendingEarnedRow.total,
    referralCode,
    connectOnboarded: !!affiliateAccount?.stripe_connect_account_id,
    payoutsEnabled: affiliateAccount?.payouts_enabled === 1,
    recentReferrals,
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const masked =
    local.length <= 2
      ? local[0] + "*".repeat(local.length - 1)
      : local.slice(0, 2) + "*".repeat(Math.max(local.length - 3, 3)) + local.slice(-1);
  return `${masked}@${domain}`;
}
