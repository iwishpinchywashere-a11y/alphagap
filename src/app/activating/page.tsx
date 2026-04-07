"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ActivatingPage() {
  const { update: updateSession } = useSession();
  const router = useRouter();
  const [message, setMessage] = useState("Activating your subscription…");
  const [dots, setDots] = useState("");

  // Animated dots
  useEffect(() => {
    const id = setInterval(() => {
      setDots(d => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20;
    let timerId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const redirectToDashboard = async () => {
      try {
        await updateSession();
      } catch {
        // ignore — redirect regardless
      }
      if (!cancelled) {
        window.location.replace("/dashboard");
      }
    };

    const poll = async () => {
      if (cancelled) return;
      if (attempts >= maxAttempts) {
        // Timeout — just go to dashboard anyway
        setMessage("Taking you to your dashboard");
        await redirectToDashboard();
        return;
      }

      attempts++;

      try {
        const res = await fetch("/api/sync-subscription", { method: "POST" });
        const data = await res.json() as { status?: string };

        if (data.status === "active" || data.status === "trialing") {
          setMessage("Access confirmed — loading your dashboard");
          await redirectToDashboard();
          return;
        }
      } catch {
        // network error — keep retrying
      }

      if (attempts === 5) {
        setMessage("Verifying payment with Stripe");
      } else if (attempts === 10) {
        setMessage("Almost there — finalising access");
      }

      timerId = setTimeout(poll, 2000);
    };

    // Start after a short delay to let Stripe webhook arrive
    timerId = setTimeout(poll, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <img
        src="/alphagap_logo_dark.svg"
        alt="AlphaGap"
        className="h-10 w-auto mb-12 opacity-80"
      />

      {/* Spinner */}
      <div className="relative mb-8">
        <div className="w-16 h-16 rounded-full border-2 border-gray-800" />
        <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-green-400 animate-spin" />
        <div className="absolute inset-2 w-12 h-12 rounded-full border-2 border-transparent border-t-green-600/50 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
      </div>

      {/* Message */}
      <div className="text-center">
        <p className="text-white font-semibold text-lg mb-2">
          {message}
          <span className="text-green-400">{dots}</span>
        </p>
        <p className="text-gray-600 text-sm">
          Your payment was successful — we&apos;re activating your Pro access
        </p>
      </div>

      {/* Green pulse bar */}
      <div className="mt-10 w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full animate-pulse" style={{ width: "60%" }} />
      </div>
    </div>
  );
}
