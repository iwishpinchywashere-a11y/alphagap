import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getTier, canAccessPro } from "@/lib/subscription";
import { getNotificationStore, saveNotificationStore } from "@/lib/notifications";
import type { AppNotification, NotificationSnapshot } from "@/lib/notification-types";

async function requirePro() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: "Unauthorized", status: 401 };
  const tier = getTier(session);
  if (!canAccessPro(tier)) return { error: "Pro subscription required", status: 403 };
  return { email: session.user.email };
}

// GET — fetch notifications + snapshot
export async function GET() {
  const auth = await requirePro();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const store = await getNotificationStore(auth.email);
  return NextResponse.json(store);
}

// POST — add new notifications + update snapshot
export async function POST(req: NextRequest) {
  const auth = await requirePro();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { notifications: newOnes, snapshot }: {
    notifications: AppNotification[];
    snapshot: NotificationSnapshot;
  } = await req.json();

  const store = await getNotificationStore(auth.email);
  const existingIds = new Set(store.notifications.map(n => n.id));
  const toAdd = (newOnes ?? []).filter(n => !existingIds.has(n.id));
  store.notifications = [...toAdd, ...store.notifications];
  if (snapshot) store.snapshot = snapshot;
  await saveNotificationStore(auth.email, store);
  return NextResponse.json({ ok: true, added: toAdd.length });
}

// PATCH — mark as read (body: { all: true } or { id: string })
export async function PATCH(req: NextRequest) {
  const auth = await requirePro();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { all, id }: { all?: boolean; id?: string } = await req.json();
  const store = await getNotificationStore(auth.email);
  if (all) {
    store.notifications = store.notifications.map(n => ({ ...n, read: true }));
  } else if (id) {
    store.notifications = store.notifications.map(n => n.id === id ? { ...n, read: true } : n);
  }
  await saveNotificationStore(auth.email, store);
  return NextResponse.json({ ok: true });
}

// DELETE — clear all notifications and reset the snapshot baseline.
// Resetting the snapshot means the next check will establish a fresh baseline
// from current scores/signals — preventing old data from re-triggering alerts.
export async function DELETE() {
  const auth = await requirePro();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const store = await getNotificationStore(auth.email);
  store.notifications = [];
  store.snapshot = null;
  await saveNotificationStore(auth.email, store);
  return NextResponse.json({ ok: true });
}
