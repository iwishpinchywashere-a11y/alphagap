"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getTier } from "@/lib/subscription";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const DAILY_LIMIT = 25;

const STARTER_QUESTIONS = [
  "Which subnets have the highest investing score right now?",
  "Show me subnets where whales are accumulating",
  "What are the biggest red flags across all subnets?",
  "Which subnets have Const buying but price is still down?",
  "Compare SN64 Chutes and SN44 Manako for a long-term hold",
  "Which subnets have high conviction scores but low audit scores?",
];

export default function OraclePage() {
  const { data: session, status } = useSession();
  const tier = getTier(session);
  const isPremium = tier === "premium";

  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [remaining, setRemaining]     = useState<number | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const inputRef                      = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setError(null);

    const userMsg: Message = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    // Optimistically add assistant placeholder
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
          setError(data.message ?? "Daily limit reached. Resets at midnight UTC.");
        } else if (res.status === 403) {
          setError("premium_required");
        } else {
          setError(data.error ?? "Something went wrong. Please try again.");
        }
        // Remove the placeholder
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      const rem = res.headers.get("X-Oracle-Remaining");
      if (rem !== null) setRemaining(Number(rem));

      // Stream into the last message
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
      setError("Connection error. Please try again.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-purple-400 text-2xl animate-spin">⟳</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800/60 bg-[#0d0d14]/80 backdrop-blur-sm px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-sm shadow-lg shadow-purple-500/30">
              🔮
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">AlphaGap Oracle</h1>
              <p className="text-[11px] text-gray-500 leading-tight">Live data · Every subnet · Ask anything</p>
            </div>
          </div>
          {isPremium && remaining !== null && (
            <div className="text-[11px] text-gray-600 tabular-nums">
              <span className={remaining <= 5 ? "text-yellow-400" : "text-gray-500"}>
                {remaining}/{DAILY_LIMIT} queries left today
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="pt-8">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🔮</div>
                <h2 className="text-xl font-bold text-white mb-2">Ask the Oracle anything</h2>
                <p className="text-gray-500 text-sm">
                  Real-time data from every Bittensor subnet — scores, signals, market data, and more.
                </p>
              </div>

              {/* Starter chips */}
              {isPremium && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STARTER_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left text-xs text-gray-400 hover:text-white bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800 hover:border-purple-500/30 rounded-xl px-4 py-3 transition-all leading-snug"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 flex-shrink-0 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xs shadow-md shadow-purple-500/20 mt-0.5">
                  🔮
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-purple-600/20 border border-purple-500/30 text-white"
                  : "bg-gray-900/70 border border-gray-800 text-gray-200"
              }`}>
                {msg.content || (
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Error */}
          {error && error !== "premium_required" && (
            <div className="text-center text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-800/60 bg-[#0d0d14]/80 backdrop-blur-sm px-4 py-4">
        <div className="max-w-3xl mx-auto">

          {/* Premium gate */}
          {!isPremium ? (
            <div className="relative">
              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-600 select-none pointer-events-none">
                Ask the Oracle anything about any subnet...
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gray-950/80 backdrop-blur-sm">
                <div className="text-center px-4">
                  <p className="text-sm font-semibold text-white mb-1">Premium only</p>
                  <p className="text-xs text-gray-500 mb-3">Upgrade to unlock the Oracle — 25 queries/day</p>
                  <a
                    href="/checkout?plan=premium"
                    className="inline-block bg-gradient-to-r from-purple-500 to-violet-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:from-purple-400 hover:to-violet-500 transition-all shadow-lg shadow-purple-500/20"
                  >
                    Upgrade to Premium →
                  </a>
                </div>
              </div>
            </div>
          ) : remaining === 0 ? (
            <div className="text-center text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl px-4 py-4">
              You&apos;ve used all {DAILY_LIMIT} Oracle queries for today. Resets at midnight UTC.
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask the Oracle anything about any subnet..."
                rows={1}
                className="flex-1 bg-gray-900/60 border border-gray-800 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none transition-colors disabled:opacity-50"
                style={{ maxHeight: "120px" }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-400 hover:to-violet-500 text-white flex items-center justify-center transition-all shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="text-xs animate-spin">⟳</span>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
          )}

          <p className="text-[10px] text-gray-700 text-center mt-2">
            Press Enter to send · Shift+Enter for new line · {isPremium && remaining !== null ? `${remaining} queries remaining today` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
