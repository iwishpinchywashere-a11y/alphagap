import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getWatchlist, addToWatchlist, removeFromWatchlist, saveWatchlist } from "@/lib/watchlist";
import { getTier, canAccessPro } from "@/lib/subscription";

async function requirePro() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: "Unauthorized", status: 401 };
  const tier = getTier(session);
  if (!canAccessPro(tier)) return { error: "Pro subscription required", status: 403 };
  return { email: session.user.email };
}

export async function GET() {
  const auth = await requirePro();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const netuids = await getWatchlist(auth.email);
  return NextResponse.json({ netuids });
}

export async function POST(req: NextRequest) {
  const auth = await requirePro();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { netuid } = await req.json();
  if (typeof netuid !== "number") return NextResponse.json({ error: "Invalid netuid" }, { status: 400 });
  const netuids = await addToWatchlist(auth.email, netuid);
  return NextResponse.json({ netuids });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePro();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const netuid = parseInt(req.nextUrl.searchParams.get("netuid") || "");
  if (isNaN(netuid)) return NextResponse.json({ error: "Invalid netuid" }, { status: 400 });
  const netuids = await removeFromWatchlist(auth.email, netuid);
  return NextResponse.json({ netuids });
}

// PUT — replace entire watchlist at once (used by the Save button)
export async function PUT(req: NextRequest) {
  const auth = await requirePro();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { netuids } = await req.json();
  if (!Array.isArray(netuids)) return NextResponse.json({ error: "Invalid netuids" }, { status: 400 });
  const saved = await saveWatchlist(auth.email, netuids.map(Number).filter(n => !isNaN(n)));
  return NextResponse.json({ netuids: saved });
}
