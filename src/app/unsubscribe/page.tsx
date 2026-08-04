/**
 * One-click unsubscribe landing page. Linked from every announcement email.
 * Opts the address out of announcements only — billing and account mail
 * continues, as it must.
 */

import { verifyUnsubToken, addOptOut } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const email = t ? verifyUnsubToken(t) : null;
  if (email) await addOptOut(email);

  return (
    <div className="ag-aurora min-h-screen flex items-center justify-center px-6">
      <div className="ag-glass p-8 max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold text-white mb-3">
          {email ? "You're unsubscribed" : "Link not recognised"}
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          {email
            ? <>We won&apos;t send <strong className="text-gray-200">{email}</strong> any more product announcements. Billing and account emails will still reach you.</>
            : <>That unsubscribe link is invalid or incomplete. Reply to any email from us and we&apos;ll remove you by hand.</>}
        </p>
        <a href="/" className="text-emerald-400/90 hover:text-emerald-300 text-sm">Back to AlphaGap</a>
      </div>
    </div>
  );
}
