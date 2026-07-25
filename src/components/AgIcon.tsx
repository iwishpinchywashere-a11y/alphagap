/**
 * AgIcon — AlphaGap's branded icon set.
 *
 * Replaces OS default emojis site-wide (🔥 ⚡ 🐋 …) with consistent
 * line-style SVG marks that inherit currentColor, so they always match
 * the Obsidian Glass design instead of rendering platform-dependent
 * emoji artwork.
 *
 * Usage: <AgIcon name="flame" className="w-4 h-4 text-emerald-400" />
 * Sizing defaults to 1em so icons track the surrounding font size.
 */

import React from "react";

export type AgIconName =
  | "bolt" | "whale" | "flame" | "chart" | "trendUp" | "trendDown"
  | "warning" | "chat" | "target" | "oracle" | "radar" | "search"
  | "lock" | "rocket" | "bell" | "money" | "crown" | "brain"
  | "wave" | "bulb" | "robot" | "scope" | "eye" | "globe"
  | "star" | "heart" | "repost" | "signal" | "shield" | "gem"
  | "clock" | "users" | "link" | "doc" | "gift" | "key";

const PATHS: Record<AgIconName, React.ReactNode> = {
  bolt: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  whale: <><path d="M3 13c0-4.4 3.6-8 8-8 5.5 0 10 3.6 10 8 0 2.2-1.8 4-4 4h-1l1.5 3.5c-2.5 0-4.5-1.5-5.5-3.5H9c-3.3 0-6-1.8-6-4z" /><circle cx="16.5" cy="11.5" r="0.5" fill="currentColor" /></>,
  flame: <path d="M12 2c1 4-4 6-4 11a6 6 0 0 0 12 0c0-2-1-4-2-5 0 2-1 3-2 3 .5-3-1-7-4-9z" />,
  chart: <><line x1="4" y1="20" x2="20" y2="20" /><line x1="7" y1="20" x2="7" y2="12" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="17" y1="20" x2="17" y2="10" /></>,
  trendUp: <><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></>,
  trendDown: <><polyline points="3 7 9 13 13 9 21 17" /><polyline points="15 17 21 17 21 11" /></>,
  warning: <><path d="M12 3 2.5 20h19L12 3z" /><line x1="12" y1="10" x2="12" y2="14" /><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" /></>,
  chat: <path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.5A8 8 0 1 1 21 12z" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  oracle: <><circle cx="12" cy="11" r="6" /><path d="M8 20h8M10 17l-.7 3M14 17l.7 3" /><path d="M9.5 9.5a3 3 0 0 1 2.5-1.5" opacity=".6" /></>,
  radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" opacity=".55" /><line x1="12" y1="12" x2="18" y2="5.5" /><circle cx="15" cy="9" r="0.8" fill="currentColor" stroke="none" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><line x1="15.5" y1="15.5" x2="21" y2="21" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  rocket: <><path d="M12 2c3 2 5 6 5 10l3 4-4-1c-1 2-2.5 3.5-4 4-1.5-.5-3-2-4-4l-4 1 3-4c0-4 2-8 5-10z" /><circle cx="12" cy="9" r="1.6" /></>,
  bell: <><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M10.5 20a1.8 1.8 0 0 0 3 0" /></>,
  money: <><circle cx="12" cy="12" r="9" /><path d="M12 6.5v11M15 8.8c-.6-1-1.7-1.4-3-1.4-1.8 0-3 .9-3 2.3 0 3 6 1.6 6 4.6 0 1.4-1.2 2.3-3 2.3-1.3 0-2.4-.5-3-1.4" /></>,
  crown: <path d="M3 17 2 7l5.5 4L12 4l4.5 7L22 7l-1 10H3zM3 20h18" />,
  brain: <><path d="M9.5 3A3.5 3.5 0 0 0 6 6.5c-2 .5-3 2-3 4 0 1.5.7 2.7 1.8 3.4C4.3 16.6 5.6 19 8 19c.5 1.2 1.6 2 3 2h1V3H9.5z" /><path d="M14.5 3A3.5 3.5 0 0 1 18 6.5c2 .5 3 2 3 4 0 1.5-.7 2.7-1.8 3.4.5 2.7-.8 5.1-3.2 5.1-.5 1.2-1.6 2-3 2h-1V3h2.5z" /></>,
  wave: <path d="M2 12c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3M2 18c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3" />,
  bulb: <><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.6 1 2.5h6c0-.9.2-1.8 1-2.5A6 6 0 0 0 12 3z" /></>,
  robot: <><rect x="5" y="8" width="14" height="11" rx="2.5" /><line x1="12" y1="4" x2="12" y2="8" /><circle cx="12" cy="3.5" r="1" /><circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" /><path d="M9.5 16.5h5" /></>,
  scope: <><circle cx="12" cy="12" r="7" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  eye: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></>,
  star: <polygon points="12 2.5 14.9 8.6 21.5 9.4 16.6 14 17.9 20.6 12 17.3 6.1 20.6 7.4 14 2.5 9.4 9.1 8.6 12 2.5" />,
  heart: <path d="M12 20.5C6 16 3 12.7 3 9.3 3 6.9 4.9 5 7.3 5c1.7 0 3.2.8 4.7 2.7C13.5 5.8 15 5 16.7 5 19.1 5 21 6.9 21 9.3c0 3.4-3 6.7-9 11.2z" />,
  repost: <><polyline points="17 2 21 6 17 10" /><path d="M21 6H8a4 4 0 0 0-4 4v1" /><polyline points="7 22 3 18 7 14" /><path d="M3 18h13a4 4 0 0 0 4-4v-1" /></>,
  signal: <><path d="M5 12.5a7 7 0 0 1 14 0" opacity=".5" /><path d="M8 12.5a4 4 0 0 1 8 0" opacity=".75" /><circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none" /><line x1="12" y1="15.5" x2="12" y2="21" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  gem: <><polygon points="6 3 18 3 22 9 12 21 2 9 6 3" /><polyline points="2 9 22 9" /><polyline points="12 21 8 9 12 3 16 9 12 21" opacity=".6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" /><rect x="5" y="12" width="14" height="9" /><line x1="12" y1="8" x2="12" y2="21" /><path d="M12 8s-1.5-5-4.5-5C5.5 3 5 4.5 5 5.5 5 7 6.5 8 8 8h4zM12 8s1.5-5 4.5-5c2 0 2.5 1.5 2.5 2.5C19 7 17.5 8 16 8h-4z" /></>,
  key: <><circle cx="8" cy="15" r="5" /><path d="M11.5 11.5 21 2M17 6l3 3M14 9l2 2" /></>,
};

export default function AgIcon({
  name,
  className = "",
  strokeWidth = 1.8,
}: {
  name: AgIconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={!className.includes("w-") ? { width: "1em", height: "1em", display: "inline-block", verticalAlign: "-0.125em" } : { display: "inline-block", verticalAlign: "-0.125em" }}
    >
      {PATHS[name]}
    </svg>
  );
}
