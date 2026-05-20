"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getTier } from "@/lib/subscription";
import Image from "next/image";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const DAILY_LIMIT = 25;

const STARTER_QUESTIONS = [
  { emoji: "😴", text: "Which subnets are being slept on right now?" },
  { emoji: "🐋", text: "Show me subnets whales are accumulating" },
  { emoji: "🔐", text: "Which subnets are showing the most \"Conviction\"?" },
  { emoji: "🚨", text: "What are the biggest red flags across all subnets?" },
  { emoji: "🏆", text: "Best long-term holds — top 3 with reasoning" },
  { emoji: "⚡", text: "Which subnets have been very active with new developments lately?" },
];

function AssistantMessage({ content }: { content: string }) {
  // Strip markdown table rows (lines full of | and ---) and excessive dashes
  const cleaned = content
    .split("\n")
    .filter(line => {
      const t = line.trim();
      if (/^\|[-\s|]+\|$/.test(t)) return false;   // separator rows |---|---|
      if (/^\|.*\|$/.test(t) && (t.match(/\|/g) ?? []).length > 3) return false; // wide table rows
      if (/^-{3,}$/.test(t)) return false;           // --- dividers
      return true;
    })
    .join("\n");

  const lines = cleaned.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        // Bold: **text**
        const parts = line.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((p, j) =>
          j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{p}</strong> : p
        );
        // Bullet points
        if (line.trim().startsWith("- ") || line.trim().startsWith("• ") || line.trim().startsWith("* ")) {
          const bulletText = line.trim().replace(/^[-•*]\s+/, "");
          const bParts = bulletText.split(/\*\*(.*?)\*\*/g);
          const bRendered = bParts.map((p, j) =>
            j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{p}</strong> : p
          );
          return (
            <div key={i} className="flex gap-2.5 pl-1">
              <span className="text-green-400 flex-shrink-0 mt-0.5">▸</span>
              <span className="text-[15px] leading-relaxed">{bRendered}</span>
            </div>
          );
        }
        // Numbered lists
        if (/^\d+\.\s/.test(line.trim())) {
          return <p key={i} className="text-[15px] leading-relaxed pl-1">{rendered}</p>;
        }
        // Headings
        if (line.trim().startsWith("#")) {
          return <p key={i} className="text-white font-bold text-base mt-3 mb-1">{line.replace(/^#+\s*/, "")}</p>;
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i} className="text-[15px] leading-relaxed">{rendered}</p>;
      })}
    </div>
  );
}

function InputBar({
  inputRef,
  input,
  setInput,
  loading,
  onSend,
  placeholder = `Ask the Oracle anything...`,
  large = false,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  onSend: (text: string) => void;
  placeholder?: string;
  large?: boolean;
}) {
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(input); }
  };

  return (
    <div className={`flex gap-3 bg-[#111118] border-2 border-green-500/25 hover:border-green-500/40 focus-within:border-green-400/60 focus-within:shadow-[0_0_24px_rgba(34,197,94,0.12)] rounded-2xl transition-all duration-200 ${large ? "items-center px-5 py-4" : "items-end px-4 py-3"}`}>
      <textarea
        ref={inputRef}
        value={input}
        onChange={e => { setInput(e.target.value); autoResize(e.target); }}
        onKeyDown={handleKeyDown}
        disabled={loading}
        placeholder={placeholder}
        rows={1}
        className={`flex-1 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none disabled:opacity-50 leading-relaxed ${large ? "text-base text-center" : "text-[15px]"}`}
        style={{ maxHeight: "200px" }}
      />
      <button
        onClick={() => onSend(input)}
        disabled={loading || !input.trim()}
        className={`flex-shrink-0 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 hover:from-green-300 hover:to-emerald-400 text-black flex items-center justify-center transition-all shadow-lg shadow-green-500/30 disabled:opacity-25 disabled:cursor-not-allowed disabled:shadow-none active:scale-95 ${large ? "w-11 h-11" : "w-9 h-9 mb-0.5"}`}
      >
        {loading ? (
          <div className={`border-2 border-black/30 border-t-black rounded-full animate-spin ${large ? "w-4 h-4" : "w-3.5 h-3.5"}`} />
        ) : (
          <svg className={large ? "w-4.5 h-4.5" : "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function OraclePage() {
  const { data: session, status } = useSession();
  const tier = getTier(session);
  const isPremium = tier === "premium";

  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [remaining, setRemaining]     = useState<number | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [streamingIdx, setStreamingIdx] = useState<number | null>(null);
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const inputRef                      = useRef<HTMLTextAreaElement>(null);
  const responseStartRef              = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;

  // When the response starts generating, scroll to the TOP of the new message
  // so the user can read from the beginning as it streams in.
  useEffect(() => {
    if (loading && streamingIdx !== null) {
      responseStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [streamingIdx, loading]);

  // Lock body scroll when in chat mode so the dashboard layout can't scroll
  // and drag the viewport down to the footer on mobile.
  useEffect(() => {
    if (hasMessages) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [hasMessages]);

  useEffect(() => {
    if (isPremium) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isPremium]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setError(null);

    const userMsg: Message = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);
    setMessages(prev => {
      const next: Message[] = [...prev, { role: "assistant", content: "" }];
      setStreamingIdx(next.length - 1);
      return next;
    });

    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessages(prev => prev.slice(0, -1));
        if (res.status === 429) setRateLimited(true);
        else if (res.status === 403) setError("premium_required");
        else setError(data.error ?? "Something went wrong — please try again.");
        return;
      }

      const rem = res.headers.get("X-Oracle-Remaining");
      if (rem !== null) setRemaining(Number(rem));

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: full };
          return copy;
        });
      }
    } catch {
      setError("Connection error — please try again.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setStreamingIdx(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, loading]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     CHAT MODE
  ───────────────────────────────────────────── */
  if (hasMessages) {
    return (
      <div className="fixed inset-0 flex flex-col bg-[#080810] overflow-hidden z-50">

        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/5 bg-[#080810]/95 backdrop-blur-md">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                <Image src="/alphagap_icon.svg" alt="Oracle" width={16} height={16} />
              </div>
              <span className="font-bold text-white text-sm tracking-wide">AlphaGap Oracle</span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20 uppercase tracking-widest">Beta</span>
            </div>
            <div className="flex items-center gap-4">
              {isPremium && remaining !== null && (
                <span className={`text-xs tabular-nums font-medium ${
                  remaining <= 5 ? "text-yellow-400" : "text-gray-500"
                }`}>
                  {remaining}/{DAILY_LIMIT} left
                </span>
              )}
              <button
                onClick={() => { setMessages([]); setError(null); setRateLimited(false); }}
                className="text-xs text-gray-500 hover:text-green-400 font-medium transition-colors"
              >
                ↺ New chat
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} ref={i === streamingIdx ? responseStartRef : undefined} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center mt-0.5 shadow-sm shadow-green-500/10">
                    <Image src="/alphagap_icon.svg" alt="" width={15} height={15} />
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-3 leading-relaxed ${
                  msg.role === "user"
                    ? "max-w-[85%] sm:max-w-[75%] bg-green-500/10 border border-green-500/20 text-white text-[15px]"
                    : "w-full bg-white/[0.03] border border-white/8 text-gray-200"
                }`}>
                  {msg.role === "assistant" && msg.content === "" ? (
                    <div className="flex items-center gap-1.5 py-1">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 rounded-full bg-green-400/70 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  ) : msg.role === "assistant" ? (
                    <AssistantMessage content={msg.content} />
                  ) : (
                    <span className="whitespace-pre-wrap text-[15px]">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
            {error && error !== "premium_required" && (
              <div className="text-center text-sm text-red-400 bg-red-500/5 border border-red-500/15 rounded-2xl px-5 py-4">{error}</div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input at bottom */}
        <div className="flex-shrink-0 border-t border-white/5 bg-[#080810]/95 backdrop-blur-md px-4 sm:px-6 py-4">
          <div className="max-w-3xl mx-auto">
            {rateLimited ? (
              <div className="text-center text-sm text-yellow-400 bg-yellow-500/5 border border-yellow-500/15 rounded-2xl px-5 py-4 font-medium">
                You&apos;ve used all {DAILY_LIMIT} queries for today. Resets at midnight UTC.
              </div>
            ) : (
              <>
                <InputBar inputRef={inputRef} input={input} setInput={setInput} loading={loading} onSend={sendMessage} placeholder="Ask a follow-up..." />
                <p className="text-[11px] text-gray-600 text-center mt-2">Enter to send · Shift+Enter for new line</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     EMPTY STATE
  ───────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#080810] flex flex-col relative overflow-hidden">

      {/* Green radial glow atmosphere */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <div className="w-[600px] h-[600px] rounded-full bg-green-500/[0.04] blur-[100px]" />
      </div>

      {/* Top bar */}
      <div className="flex-shrink-0 px-5 pt-5 pb-0 relative">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-green-500/15 border border-green-500/20 flex items-center justify-center">
              <Image src="/alphagap_icon.svg" alt="AlphaGap" width={14} height={14} />
            </div>
            <span className="text-sm text-gray-400 font-medium">AlphaGap Oracle</span>
          </div>
          {isPremium && remaining !== null && (
            <span className={`text-xs font-medium tabular-nums ${remaining <= 5 ? "text-yellow-400" : "text-gray-500"}`}>
              {remaining}/{DAILY_LIMIT} queries left
            </span>
          )}
        </div>
      </div>

      {/* Main centered content */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 relative">
        <div className="w-full max-w-2xl">

          {/* Hero */}
          <div className="text-center mb-10">
            {/* Icon with glow ring */}
            <div className="relative inline-flex mb-7">
              <div className="absolute inset-0 rounded-3xl bg-green-400/20 blur-2xl scale-150" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-green-500/20 to-emerald-600/10 border border-green-400/25 flex items-center justify-center shadow-2xl shadow-green-500/10">
                <Image src="/alphagap_icon.svg" alt="Oracle" width={44} height={44} className="sm:w-[52px] sm:h-[52px]" />
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
              Ask the{" "}
              <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-green-400 bg-clip-text text-transparent">
                Oracle
              </span>
            </h1>
            <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
              Live data from every Bittensor subnet — scores, signals,
              whale activity, and more.
            </p>
          </div>

          {/* Premium gate OR input + chips */}
          {!isPremium ? (
            <div className="relative rounded-2xl overflow-hidden border-2 border-green-500/20 shadow-xl shadow-green-500/5">
              {/* Blurred background input */}
              <div className="bg-[#111118] px-5 py-4 text-gray-500 text-base select-none">
                Ask anything — e.g. &quot;Which subnets should I watch right now?&quot;
              </div>
              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-[#080810]/90 backdrop-blur-[3px]">
                <div className="text-center px-6 py-4">
                  <div className="text-4xl mb-3">🔒</div>
                  <p className="text-lg font-bold text-white mb-1">Premium members only</p>
                  <p className="text-sm text-gray-400 mb-5">25 queries/day · Live data from every subnet</p>
                  <a
                    href="/checkout?plan=premium"
                    className="inline-block bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-300 hover:to-emerald-400 text-black text-sm font-bold px-7 py-3 rounded-xl transition-all shadow-lg shadow-green-500/25 active:scale-95"
                  >
                    Upgrade to Premium →
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Input */}
              <div className="mb-6">
                <InputBar
                  inputRef={inputRef}
                  input={input}
                  setInput={setInput}
                  loading={loading}
                  onSend={sendMessage}
                  placeholder="Ask me anything about Bittensor"
                  large
                />
                <p className="text-xs text-gray-600 text-center mt-2.5">Enter to send · Shift+Enter for new line</p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-5">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold">or try one of these</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* Starter chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STARTER_QUESTIONS.map(({ emoji, text }) => (
                  <button
                    key={text}
                    onClick={() => sendMessage(text)}
                    className="group flex items-start gap-3 text-left bg-white/[0.03] hover:bg-green-500/[0.07] border border-white/8 hover:border-green-500/30 rounded-xl px-4 py-3.5 transition-all duration-150 active:scale-[0.98] shadow-sm"
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">{emoji}</span>
                    <span className="text-sm text-gray-300 group-hover:text-white leading-relaxed transition-colors font-medium">{text}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
