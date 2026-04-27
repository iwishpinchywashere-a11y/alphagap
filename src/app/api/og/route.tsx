/**
 * GET /api/og
 *
 * Generates the Open Graph preview image for link shares on X, LinkedIn, etc.
 * Returns a 1200×630 PNG — the standard og:image size for large card previews.
 *
 * The AlphaGap logo is inlined as JSX SVG paths so Satori renders it correctly.
 * (Satori cannot decode base64/data-URI SVGs embedded in <img> tags.)
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0a0a0f",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle green radial glow */}
        <div
          style={{
            position: "absolute",
            width: "800px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)",
            top: "-80px",
            left: "200px",
          }}
        />

        {/* Top-left corner accent */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "120px", background: "linear-gradient(to bottom, #10b981, transparent)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: "120px", height: "3px", background: "linear-gradient(to right, #10b981, transparent)" }} />

        {/* Bottom-right corner accent */}
        <div style={{ position: "absolute", bottom: 0, right: 0, width: "3px", height: "120px", background: "linear-gradient(to top, #10b981, transparent)" }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: "120px", height: "3px", background: "linear-gradient(to left, #10b981, transparent)" }} />

        {/* ── AlphaGap logo: icon + wordmark inlined as SVG JSX ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "32px", marginBottom: "28px" }}>

          {/* Icon — the A-shaped arrow mark */}
          <svg
            width="110"
            height="110"
            viewBox="0 80 480 320"
            fill="none"
          >
            {/* A body — silver/white */}
            <path
              d="M105 360 L248 82 Q258 68 274 83 L378 195 Q388 206 376 214 L338 240 Q328 247 320 236 L264 165 L149 360 Z"
              fill="#e5e7eb"
            />
            {/* Right leg accent — green */}
            <path
              d="M312 285 L404 365 Q415 375 406 386 Q398 395 382 390 L298 360 Z"
              fill="#22c55e"
            />
            {/* Growth swoosh — green */}
            <path
              d="M105 360 C170 338, 235 300, 294 245 C338 205, 365 173, 393 136 L375 136 Q365 136 360 127 Q356 118 362 110 L445 72 Q454 68 461 72 Q469 77 466 87 L438 172 Q434 182 425 184 Q415 186 408 178 L404 173 C364 223, 328 261, 286 294 C231 338, 174 366, 111 379 Q95 382 91 373 Q87 364 105 360 Z"
              fill="#22c55e"
            />
          </svg>

          {/* Wordmark — "Alpha" white, "Gap" green */}
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span
              style={{
                fontSize: "96px",
                fontWeight: "800",
                fontStyle: "italic",
                color: "#ffffff",
                letterSpacing: "-3px",
                lineHeight: 1,
              }}
            >
              Alpha
            </span>
            <span
              style={{
                fontSize: "96px",
                fontWeight: "800",
                fontStyle: "italic",
                color: "#22c55e",
                letterSpacing: "-3px",
                lineHeight: 1,
              }}
            >
              Gap
            </span>
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "22px",
            color: "#6b7280",
            fontWeight: "400",
            letterSpacing: "3px",
            textTransform: "uppercase",
            marginBottom: "44px",
          }}
        >
          Bittensor Subnet Intelligence
        </div>

        {/* Bottom pill stats row */}
        <div style={{ display: "flex", gap: "16px" }}>
          {["AI-Powered Signals", "120+ Subnets Tracked", "Real-Time Alpha"].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 20px",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.25)",
                borderRadius: "999px",
                fontSize: "15px",
                color: "#6ee7b7",
                fontWeight: "500",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Domain watermark */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            right: "40px",
            fontSize: "17px",
            color: "#374151",
            fontWeight: "500",
          }}
        >
          alphagap.io
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
