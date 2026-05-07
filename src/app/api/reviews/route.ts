/**
 * /api/reviews
 *
 * GET  — returns all approved reviews (public)
 * POST — submit a new review (requires active Pro or Premium subscription)
 * PATCH — approve or deny a pending review (requires admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put, get as blobGet } from "@vercel/blob";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export interface Review {
  id: string;
  userId: string;
  name: string;
  xHandle: string;   // stored without @, displayed with @
  review: string;
  status: "pending" | "approved" | "denied";
  submittedAt: string;
  approvedAt?: string;
}

const BLOB_NAME = "reviews.json";
const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN ?? "";

async function loadReviews(): Promise<Review[]> {
  try {
    const blob = await blobGet(BLOB_NAME, { token: TOKEN(), access: "private", abortSignal: AbortSignal.timeout(8000) });
    if (!blob?.stream) return [];
    const reader = blob.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as Review[];
  } catch { return []; }
}

async function saveReviews(reviews: Review[]): Promise<void> {
  await put(BLOB_NAME, JSON.stringify(reviews), {
    access: "private", token: TOKEN(), addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  });
}

// GET — public list of approved reviews
export async function GET() {
  const all = await loadReviews();
  const approved = all.filter(r => r.status === "approved");
  return NextResponse.json({ reviews: approved });
}

// POST — submit a review (Pro/Premium users only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = session.user as { id?: string; email?: string; subscriptionStatus?: string; subscriptionTier?: string };
  const isActive = user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";
  if (!isActive) return NextResponse.json({ error: "Pro or Premium subscription required to write a review" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { name?: string; xHandle?: string; review?: string };
  const name = (body.name ?? "").trim();
  const xHandle = (body.xHandle ?? "").trim().replace(/^@/, ""); // strip leading @
  const review = (body.review ?? "").trim();

  if (!name || !review) return NextResponse.json({ error: "Name and review are required" }, { status: 400 });
  if (review.length > 1000) return NextResponse.json({ error: "Review must be under 1000 characters" }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: "Name must be under 80 characters" }, { status: 400 });

  const all = await loadReviews();

  // One pending or approved review per user
  const existing = all.find(r => r.userId === (user.id ?? user.email ?? "") && r.status !== "denied");
  if (existing) {
    return NextResponse.json({
      error: existing.status === "approved"
        ? "You already have an approved review."
        : "Your review is pending approval.",
    }, { status: 409 });
  }

  const newReview: Review = {
    id: randomUUID(),
    userId: user.id ?? user.email ?? "",
    name,
    xHandle,
    review,
    status: "pending",
    submittedAt: new Date().toISOString(),
  };

  all.push(newReview);
  await saveReviews(all);

  return NextResponse.json({ ok: true, message: "Review submitted for approval. Thank you!" });
}

// PATCH — approve or deny (admin only)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isAdmin?: boolean } | undefined;
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { id?: string; action?: "approve" | "deny" | "delete" };
  if (!body.id || !body.action) return NextResponse.json({ error: "Missing id or action" }, { status: 400 });

  const all = await loadReviews();
  const idx = all.findIndex(r => r.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  if (body.action === "delete") {
    all.splice(idx, 1);
  } else {
    all[idx].status = body.action === "approve" ? "approved" : "denied";
    if (body.action === "approve") all[idx].approvedAt = new Date().toISOString();
  }

  await saveReviews(all);
  return NextResponse.json({ ok: true, action: body.action, id: body.id });
}

// GET all reviews (admin — includes pending/denied)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isAdmin?: boolean } | undefined;
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const all = await loadReviews();
  return NextResponse.json({ reviews: all });
}
