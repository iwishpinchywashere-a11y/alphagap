"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "./NotificationProvider";
import type { AppNotification, NotificationType } from "@/lib/notification-types";

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_CONFIG: Record<NotificationType, { emoji: string; label: string; color: string }> = {
  score:     { emoji: "📊", label: "Score",     color: "text-green-400" },
  signal:    { emoji: "🔔", label: "Signal",    color: "text-yellow-400" },
  whale:     { emoji: "🐋", label: "Whale",     color: "text-blue-400" },
  report:    { emoji: "📄", label: "Report",    color: "text-purple-400" },
  social:    { emoji: "🐦", label: "Social",    color: "text-sky-400" },
  benchmark: { emoji: "⚡", label: "Benchmark", color: "text-orange-400" },
};

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const openDropdown = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setOpen(true);
  }, []);

  const closeDropdown = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      closeDropdown();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, closeDropdown]);

  // Reposition on scroll / resize
  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function handleClick(n: AppNotification) {
    markRead(n.id);
    closeDropdown();
    router.push(n.url);
  }

  return (
    <>
      {/* Bell button */}
      <button
        ref={btnRef}
        onClick={() => open ? closeDropdown() : openDropdown()}
        className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 border border-gray-700 hover:border-yellow-500/50 transition-colors flex-shrink-0"
        title="Notifications"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown — fixed-position like DashboardHeader user menu */}
      {open && pos && (
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center px-4">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm text-gray-400 font-medium">No notifications yet</p>
                <p className="text-xs text-gray-600 mt-1">
                  Activity from your watched subnets will appear here — score moves, new signals, whale activity, reports, social mentions, and benchmark updates.
                </p>
              </div>
            ) : (
              <div>
                {notifications.map(n => {
                  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.signal;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-800/50 last:border-b-0 hover:bg-gray-800/60 ${
                        !n.read ? "bg-gray-800/25" : ""
                      }`}
                    >
                      <span className="text-xl flex-shrink-0 mt-0.5">{cfg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px] text-gray-600">·</span>
                          <span className="text-[10px] text-gray-500 font-mono">SN{n.netuid}</span>
                          {!n.read && (
                            <span className="ml-auto w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-xs font-semibold text-white truncate">{n.subnetName}</div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">{n.message}</div>
                        <div className="text-[10px] text-gray-600 mt-1">{timeAgo(n.timestamp)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-800 px-4 py-2">
            <p className="text-[10px] text-gray-600 text-center">
              Watchlist activity only · Pro &amp; Premium
            </p>
          </div>
        </div>
      )}
    </>
  );
}
