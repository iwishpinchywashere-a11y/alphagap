import { NextResponse } from "next/server";
import { consumeToken } from "@/lib/tokens";
import { updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";

  const email = await consumeToken(token, "verify");
  if (!email) {
    return NextResponse.redirect(
      new URL("/auth/verify-email?error=invalid", req.url),
    );
  }

  try {
    await updateUser(email, { emailVerified: true });
  } catch {
    return NextResponse.redirect(
      new URL("/auth/verify-email?error=update", req.url),
    );
  }

  return NextResponse.redirect(
    new URL("/auth/verify-email?success=1", req.url),
  );
}
