/**
 * Referral system — Vercel Blob backed.
 *
 * Blob keys:
 *   referral/codes/{CODE}.json        → ReferralCode  (code → user lookup)
 *   referral/users/{userId}.json      → { code }       (user → code lookup)
 *   referral/attributions/{referredUserId}.json → ReferralAttribution
 *   referral/affiliates/{userId}.json → AffiliateAccount
 *   referral/commissions/{invoiceId}.json → CommissionEntry
 *   referral/stats/{userId}.json      → cached AffiliateStats (updated on write)
 */

import { put, get as blobGet, list as blobList } from "@vercel/blob";

export const COMMISSION_RATE    = 0.20;   // 20%
export const COMMISSION_LIFETIME = true;  // commissions never expire
export const COOKIE_NAME        = "ag_ref";
export const COOKIE_DAYS        = 90;

const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN ?? "";

// ── Blob types ────────────────────────────────────────────────────────────────

interface ReferralCode {
  code: string;
  userId: string;
  userEmail: string;
  isActive: boolean;
  createdAt: string;
}

export interface ReferralAttribution {
  refCode: string;
  referrerUserId: string;
  referrerEmail: string;
  referredUserId: string;
  referredEmail: string;
  stripeCustomerId?: string;
  signedUpAt: string;
  firstPaymentAt?: string;
}

interface AffiliateAccount {
  userId: string;
  userEmail: string;
  stripeConnectAccountId?: string;
  onboardedAt?: string;
  payoutsEnabled: boolean;
  createdAt: string;
}

interface CommissionEntry {
  invoiceId: string;
  attributionReferredUserId: string; // FK to attribution
  referrerUserId: string;
  stripeChargeId?: string;
  grossAmount: number;
  commissionAmount: number;
  currency: string;
  status: "pending" | "paid" | "reversed";
  createdAt: string;
  paidAt?: string;
  stripeTransferId?: string;
}

// ── Public types ──────────────────────────────────────────────────────────────

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

// ── Blob helpers ──────────────────────────────────────────────────────────────

async function readBlob<T>(key: string): Promise<T | null> {
  try {
    const result = await blobGet(key, { token: TOKEN(), access: "private" });
    if (!result?.stream) return null;
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const bytes = chunks.reduce((a, b) => {
      const c = new Uint8Array(a.length + b.length);
      c.set(a); c.set(b, a.length); return c;
    }, new Uint8Array(0));
    return JSON.parse(Buffer.from(bytes).toString("utf-8")) as T;
  } catch {
    return null;
  }
}

async function writeBlob(key: string, data: unknown): Promise<void> {
  await put(key, JSON.stringify(data), {
    token: TOKEN(),
    access: "private",
    allowOverwrite: true,
  });
}

// ── Code generation ───────────────────────────────────────────────────────────

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CUSTOM_CODE_RE = /^[A-Za-z0-9-]{3,20}$/;

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

async function isCodeTaken(code: string): Promise<boolean> {
  const existing = await readBlob<ReferralCode>(`referral/codes/${code.toUpperCase()}.json`);
  return existing !== null;
}

// ── Code management ───────────────────────────────────────────────────────────

export async function getUserReferralCode(userId: string): Promise<string | null> {
  const data = await readBlob<{ code: string }>(`referral/users/${userId}.json`);
  return data?.code ?? null;
}

export async function getOrCreateReferralCode(userId: string, userEmail: string): Promise<string> {
  const existing = await getUserReferralCode(userId);
  if (existing) return existing;

  // Auto-generate a unique code
  let code = randomCode(6);
  let attempts = 0;
  while (await isCodeTaken(code) && attempts < 20) {
    code = randomCode(6);
    attempts++;
  }

  const entry: ReferralCode = {
    code,
    userId,
    userEmail,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await Promise.all([
    writeBlob(`referral/codes/${code}.json`, entry),
    writeBlob(`referral/users/${userId}.json`, { code }),
  ]);

  return code;
}

export async function setCustomCode(
  userId: string,
  userEmail: string,
  customCode: string,
): Promise<{ code: string } | { error: string }> {
  if (!CUSTOM_CODE_RE.test(customCode)) {
    return { error: "Custom code must be 3–20 alphanumeric characters or hyphens" };
  }

  const normalized = customCode.toUpperCase();

  // Check if taken by someone else
  const existing = await readBlob<ReferralCode>(`referral/codes/${normalized}.json`);
  if (existing && existing.userId !== userId) {
    return { error: "That code is already taken" };
  }
  if (existing && existing.userId === userId) {
    return { code: normalized }; // already theirs
  }

  // Deactivate old code
  const oldCode = await getUserReferralCode(userId);
  if (oldCode) {
    const oldEntry = await readBlob<ReferralCode>(`referral/codes/${oldCode}.json`);
    if (oldEntry) {
      await writeBlob(`referral/codes/${oldCode}.json`, { ...oldEntry, isActive: false });
    }
  }

  const entry: ReferralCode = {
    code: normalized,
    userId,
    userEmail,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await Promise.all([
    writeBlob(`referral/codes/${normalized}.json`, entry),
    writeBlob(`referral/users/${userId}.json`, { code: normalized }),
  ]);

  return { code: normalized };
}

// ── Validation ────────────────────────────────────────────────────────────────

export async function validateCode(
  code: string,
): Promise<{ valid: boolean; referrerUserId?: string; referrerEmail?: string }> {
  const entry = await readBlob<ReferralCode>(`referral/codes/${code.toUpperCase()}.json`);
  if (!entry || !entry.isActive) return { valid: false };
  return { valid: true, referrerUserId: entry.userId, referrerEmail: entry.userEmail };
}

// ── Attribution ───────────────────────────────────────────────────────────────

export async function createAttribution(
  refCode: string,
  referredUserId: string,
  referredEmail: string,
  stripeCustomerId?: string,
): Promise<void> {
  const validation = await validateCode(refCode);
  if (!validation.valid || !validation.referrerUserId || !validation.referrerEmail) {
    console.warn(`[referral] createAttribution: invalid code ${refCode}`);
    return;
  }

  // Prevent self-referral
  if (validation.referrerUserId === referredUserId) {
    console.warn(`[referral] Self-referral blocked for user ${referredUserId}`);
    return;
  }

  // Only one attribution per referred user
  const existing = await readBlob<ReferralAttribution>(
    `referral/attributions/${referredUserId}.json`,
  );
  if (existing) return;

  const attribution: ReferralAttribution = {
    refCode: refCode.toUpperCase(),
    referrerUserId: validation.referrerUserId,
    referrerEmail: validation.referrerEmail,
    referredUserId,
    referredEmail,
    stripeCustomerId,
    signedUpAt: new Date().toISOString(),
  };

  await writeBlob(`referral/attributions/${referredUserId}.json`, attribution);
  console.log(`[referral] Attribution created: ${refCode} → ${referredEmail}`);
}

export async function getAttributionByReferredUser(
  referredUserId: string,
): Promise<ReferralAttribution | null> {
  return readBlob<ReferralAttribution>(`referral/attributions/${referredUserId}.json`);
}

// ── Commission recording ──────────────────────────────────────────────────────

export async function recordCommission(
  referredUserId: string,
  invoiceId: string,
  chargeId: string,
  grossAmount: number,
): Promise<void> {
  const attribution = await getAttributionByReferredUser(referredUserId);
  if (!attribution) {
    console.warn(`[referral] recordCommission: no attribution for user ${referredUserId}`);
    return;
  }

  // Record first payment date if not set yet
  if (!attribution.firstPaymentAt) {
    await writeBlob(`referral/attributions/${referredUserId}.json`, {
      ...attribution,
      firstPaymentAt: new Date().toISOString(),
    });
  }

  // Check for duplicate
  const existing = await readBlob<CommissionEntry>(`referral/commissions/${invoiceId}.json`);
  if (existing) {
    console.log(`[referral] Invoice ${invoiceId} already recorded, skipping`);
    return;
  }

  const commission: CommissionEntry = {
    invoiceId,
    attributionReferredUserId: referredUserId,
    referrerUserId: attribution.referrerUserId,
    stripeChargeId: chargeId,
    grossAmount,
    commissionAmount: Math.floor(grossAmount * COMMISSION_RATE),
    currency: "usd",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await writeBlob(`referral/commissions/${invoiceId}.json`, commission);
  console.log(
    `[referral] Commission recorded: $${(commission.commissionAmount / 100).toFixed(2)} for ${attribution.referrerEmail}`,
  );
}

// ── Payout processing ─────────────────────────────────────────────────────────

export async function payPendingCommissions(): Promise<number> {
  // List all pending commission blobs
  const { blobs } = await blobList({ prefix: "referral/commissions/", token: TOKEN() });
  if (!blobs.length) return 0;

  const { createTransfer } = await import("@/lib/stripe-connect");
  let paid = 0;

  for (const blob of blobs) {
    const commission = await readBlob<CommissionEntry>(blob.pathname);
    if (!commission || commission.status !== "pending") continue;

    // Get affiliate account
    const affiliate = await readBlob<AffiliateAccount>(
      `referral/affiliates/${commission.referrerUserId}.json`,
    );
    if (!affiliate?.payoutsEnabled || !affiliate.stripeConnectAccountId) continue;

    try {
      const transferId = await createTransfer(
        commission.commissionAmount,
        commission.currency,
        affiliate.stripeConnectAccountId,
        `AlphaGap affiliate commission — invoice ${commission.invoiceId}`,
      );
      await writeBlob(`referral/commissions/${commission.invoiceId}.json`, {
        ...commission,
        status: "paid",
        paidAt: new Date().toISOString(),
        stripeTransferId: transferId,
      });
      paid++;
      console.log(`[referral] Paid commission ${commission.invoiceId} → transfer ${transferId}`);
    } catch (e) {
      console.error(`[referral] Failed to pay commission ${commission.invoiceId}:`, e);
    }
  }

  return paid;
}

// ── Affiliate account ─────────────────────────────────────────────────────────

export async function getOrCreateAffiliateAccount(
  userId: string,
  userEmail: string,
): Promise<AffiliateAccount> {
  const existing = await readBlob<AffiliateAccount>(`referral/affiliates/${userId}.json`);
  if (existing) return existing;
  const account: AffiliateAccount = {
    userId,
    userEmail,
    payoutsEnabled: false,
    createdAt: new Date().toISOString(),
  };
  await writeBlob(`referral/affiliates/${userId}.json`, account);
  return account;
}

export async function updateAffiliateAccount(
  userId: string,
  updates: Partial<AffiliateAccount>,
): Promise<void> {
  const existing = await readBlob<AffiliateAccount>(`referral/affiliates/${userId}.json`);
  if (!existing) return;
  await writeBlob(`referral/affiliates/${userId}.json`, { ...existing, ...updates });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getAffiliateStats(userId: string, userEmail: string): Promise<AffiliateStats> {
  // Get or create referral code
  const referralCode = await getOrCreateReferralCode(userId, userEmail);

  // Get affiliate account
  const affiliate = await readBlob<AffiliateAccount>(`referral/affiliates/${userId}.json`);

  // List all commission blobs to find ones belonging to this referrer
  const { blobs: commissionBlobs } = await blobList({
    prefix: "referral/commissions/",
    token: TOKEN(),
  });

  // List all attribution blobs to find ones from this referrer
  const { blobs: attributionBlobs } = await blobList({
    prefix: "referral/attributions/",
    token: TOKEN(),
  });

  // Read all attributions for this referrer
  const myAttributions: ReferralAttribution[] = [];
  await Promise.all(
    attributionBlobs.map(async (blob) => {
      const a = await readBlob<ReferralAttribution>(blob.pathname);
      if (a && a.referrerUserId === userId) myAttributions.push(a);
    }),
  );

  // Read all commissions for this referrer
  const myCommissions: CommissionEntry[] = [];
  await Promise.all(
    commissionBlobs.map(async (blob) => {
      const c = await readBlob<CommissionEntry>(blob.pathname);
      if (c && c.referrerUserId === userId) myCommissions.push(c);
    }),
  );

  const totalEarned = myCommissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.commissionAmount, 0);

  const pendingEarned = myCommissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + c.commissionAmount, 0);

  // Build recent referrals (last 20, newest first)
  const sorted = [...myAttributions].sort(
    (a, b) => new Date(b.signedUpAt).getTime() - new Date(a.signedUpAt).getTime(),
  );

  const recentReferrals: RecentReferral[] = sorted.slice(0, 20).map((attr) => {
    const earned = myCommissions
      .filter((c) => c.attributionReferredUserId === attr.referredUserId)
      .reduce((sum, c) => sum + c.commissionAmount, 0);
    const hasPayment = myCommissions.some(
      (c) => c.attributionReferredUserId === attr.referredUserId,
    );
    return {
      email: maskEmail(attr.referredEmail),
      signedUpAt: attr.signedUpAt,
      status: hasPayment ? "subscribed" : "free",
      commissionEarned: earned,
    };
  });

  const activeReferrals = new Set(
    myCommissions.map((c) => c.attributionReferredUserId),
  ).size;

  return {
    totalReferrals: myAttributions.length,
    activeReferrals,
    totalEarned,
    pendingEarned,
    referralCode,
    connectOnboarded: !!affiliate?.stripeConnectAccountId,
    payoutsEnabled: affiliate?.payoutsEnabled === true,
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
