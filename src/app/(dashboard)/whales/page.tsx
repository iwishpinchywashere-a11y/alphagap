/**
 * /whales has been renamed to /flow.
 * This component redirects immediately — the canonical URL is /flow.
 */
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WhalesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/flow"); }, [router]);
  return null;
}
