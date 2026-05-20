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
  { emoji: "📈", text: "Which subnets have the highest investing score right now?" },
  { emoji: "🐋", text: "Show me subnets where whales are accumulating" },
  { emoji: "🚨", text: "What are the biggest red flags across all subnets?" },
  { emoji: "🏆", text: "Best long-term hold right now — top 3 with reasoning" },
  { emoji: "⚡", text: "Which subnets have the fastest rising aGap velocity?" },
  { emoji: "🔐", text: "Which subnets have high conviction scores but low audit scores?" },
];

function AssistantMessage({ content }: { content: string }) {
  // Simple markdown-lite: bold **text**, bullet lines starting with -
  const lines = content.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        // Bold
        const parts = line.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((p, j) =>
          j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{p}</strong> : p
        );
        // Bullet
        if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-green-500 flex-shrink-0 mt-0.5">▸</span>
              <span>{rendered}</span>
            </div>
          );
        }
        // Heading-like (starts with emoji or #)
        if (line.trim().startsWith("#")) {
          return <p key={i} className="text-white font-bold mt-2">{line.replace(/^#+\s*/, "")}</p>;
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{rendered}</p>;
      })}
    </div>
  );
}

export default function OraclePage() {
  const { data: session, status } = useSession();
  const tier = getTier(session);
  const isPremium = tier === "premium";

  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setError(null);

    const userMsg: Message = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    // Reset textarea height
    if (inputRef.current) { inputRef.current.style.height = "auto"; }
    setLoading(true);

    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setRateLimited(true);
          setMessages(prev => prev.slice(0, -1));
        } else if (res.status === 403) {
          setError("premium_required");
          setMessages(prev => prev.slice(0, -1));
        } else {
          setError(data.error ?? "Something went wrong — please try again.");
          setMessages(prev => prev.slice(0, -1));
        }
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
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-gray-800/60 bg-[#0a0a0f]/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/alphagap_icon.svg" alt="AlphaGap" width={28} height={28} className="opacity-90" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">AlphaGap Oracle</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 uppercase tracking-wide">Beta</span>
              </div>
              <p className="text-[10px] text-gray-600 leading-tight">Live data · Every subnet · Ask anything</p>
            </div>
          </div>
          {isPremium && remaining !== null && (
            <div className={`text-[11px] tabular-nums px-2.5 py-1 rounded-full border ${
              remaining <= 5
                ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                : "text-gray-500 bg-gray-800/50 border-gray-700/50"
            }`}>
              {remaining}/{DAILY_LIMIT} left today
            </div>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="pt-6 pb-4">
              {/* Hero */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/10 border border-green-500/20 mb-5 shadow-lg shadow-green-500/10">
                  <Image src="/alphagap_icon.svg" alt="Oracle" width={36} height={36} className="opacity-80" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-white bg-clip-text text-transparent mb-2">
                  Ask the Oracle
                </h2>
                <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
                  Real-time intelligence from every Bittensor subnet — scores, signals, whale activity, and more.
                </p>
              </div>

              {/* Starter chips — only for premium */}
              {isPremium && (
                <>
                  <p className="text-[11px] text-gray-600 uppercase tracking-widest text-center mb-3 font-medium">Or try one of these</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STARTER_QUESTIONS.map(({ emoji, text }) => (
                      <button
                        key={text}
                        onClick={() => sendMessage(text)}
                        className="group flex items-start gap-3 text-left bg-gray-900/50 hover:bg-gray-800/70 border border-gray-800/80 hover:border-green-500/30 rounded-xl px-4 py-3 transition-all duration-150"
                      >
                        <span className="text-base flex-shrink-0 mt-0.5">{emoji}</span>
                        <span className="text-xs text-gray-400 group-hover:text-gray-200 leading-relaxed transition-colors">{text}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Message thread */}
          <div className="space-y-5">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-600/10 border border-green-500/20 flex items-center justify-center mt-0.5">
                    <Image src="/alphagap_icon.svg" alt="Oracle" width={16} height={16} className="opacity-70" />
                  </div>
                )}
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-green-500/10 border border-green-500/20 text-white"
                    : "bg-gray-900/60 border border-gray-800/80 text-gray-300"
                }`}>
                  {msg.role === "assistant" && msg.content === "" ? (
                    /* Typing indicator */
                    <div className="flex items-center gap-1.5 py-1">
                      {[0, 150, 300].map(delay => (
                        <span key={delay} className="w-1.5 h-1.5 rounded-full bg-green-400/60 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  ) : msg.role === "assistant" ? (
                    <AssistantMessage content={msg.content} />
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Error banner */}
          {error && error !== "premium_required" && (
            <div className="mt-4 text-center text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="flex-shrink-0 border-t border-gray-800/60 bg-[#0a0a0f]/95 backdrop-blur-sm px-4 py-4">
        <div className="max-w-3xl mx-auto">

          {/* Non-premium gate */}
          {!isPremium ? (
            <div className="relative rounded-2xl overflow-hidden border border-gray-800">
              {/* Fake input bg */}
              <div className="bg-gray-900/60 px-4 py-3.5 text-sm text-gray-700 select-none">
                Ask the Oracle anything about Bittensor subnets...
              </div>
              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/85 backdrop-blur-[2px]">
                <div className="text-center px-6">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 mb-3">
                    <span className="text-base">🔒</span>
                  </div>
                  <p className="text-sm font-semibold text-white mb-0.5">Premium only</p>
                  <p className="text-xs text-gray-500 mb-3">25 queries/day · Live data from every subnet</p>
                  <a
                    href="/checkout?plan=premium"
                    className="inline-block bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black text-xs font-bold px-5 py-2 rounded-lg transition-all shadow-lg shadow-green-500/20"
                  >
                    Upgrade to Premium →
                  </a>
                </div>
              </div>
            </div>
          ) : rateLimited ? (
            <div className="text-center text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl px-4 py-4">
              You&apos;ve used all {DAILY_LIMIT} Oracle queries for today. Resets at midnight UTC.
            </div>
          ) : (
            <>
              <div className="flex gap-2 items-end bg-gray-900/60 border border-gray-800 hover:border-gray-700 focus-within:border-green-500/40 focus-within:ring-1 focus-within:ring-green-500/10 rounded-2xl px-4 py-3 transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="Ask the Oracle anything — e.g. &quot;Which subnets should I be watching right now?&quot;"
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 resize-none focus:outline-none disabled:opacity-50 leading-relaxed"
                  style={{ maxHeight: "160px" }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black flex items-center justify-center transition-all shadow-md shadow-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none mb-0.5"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-gray-700 text-center mt-2">
                Enter to send · Shift+Enter for new line
                {remaining !== null && (
                  <span className={remaining <= 5 ? " · text-yellow-600" : ""}> · {remaining} queries left today</span>
                )}
              </p>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
