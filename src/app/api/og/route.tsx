/**
 * GET /api/og
 *
 * Generates the Open Graph preview image for link shares on X, LinkedIn, etc.
 * Returns a 1200×630 PNG.
 *
 * NOTE: Satori (the edge runtime renderer) cannot render SVG paths or
 * base64 data URIs in <img> tags. Everything must be plain HTML + inline CSS.
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
        {/* Radial green glow */}
        <div style={{
          position: "absolute",
          width: "900px",
          height: "700px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 65%)",
          top: "-100px",
          left: "150px",
        }} />

        {/* Corner accents */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "140px", background: "linear-gradient(to bottom, #22c55e, transparent)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: "140px", height: "3px", background: "linear-gradient(to right, #22c55e, transparent)" }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: "3px", height: "140px", background: "linear-gradient(to top, #22c55e, transparent)" }} />
        <div style={{ position: "absolute", bottom: 0, right: 0, width: "140px", height: "3px", background: "linear-gradient(to left, #22c55e, transparent)" }} />

        {/* ── Logo row: icon + wordmark ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "28px", marginBottom: "32px" }}>

          {/* Icon: green rounded square with α */}
          <div style={{
            width: "96px",
            height: "96px",
            borderRadius: "22px",
            background: "linear-gradient(135deg, #059669 0%, #22c55e 55%, #4ade80 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 40px rgba(34,197,94,0.35)",
          }}>
            <span style={{
              fontSize: "52px",
              fontWeight: "900",
              color: "#000",
              lineHeight: 1,
              fontStyle: "italic",
            }}>α</span>
          </div>

          {/* Wordmark: Alpha (white) + Gap (green) */}
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{
              fontSize: "100px",
              fontWeight: "800",
              fontStyle: "italic",
              color: "#ffffff",
              letterSpacing: "-4px",
              lineHeight: 1,
            }}>Alpha</span>
            <span style={{
              fontSize: "100px",
              fontWeight: "800",
              fontStyle: "italic",
              color: "#22c55e",
              letterSpacing: "-4px",
              lineHeight: 1,
            }}>Gap</span>
          </div>
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: "23px",
          color: "#6b7280",
          fontWeight: "400",
          letterSpacing: "3px",
          textTransform: "uppercase",
          marginBottom: "48px",
        }}>
          Bittensor Subnet Intelligence
        </div>

        {/* Pill row */}
        <div style={{ display: "flex", gap: "16px" }}>
          {["AI-Powered Signals", "120+ Subnets Tracked", "Real-Time Alpha"].map((label) => (
            <div
              key={label}
              style={{
                padding: "10px 24px",
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: "999px",
                fontSize: "16px",
                color: "#86efac",
                fontWeight: "500",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Domain watermark */}
        <div style={{
          position: "absolute",
          bottom: "28px",
          right: "44px",
          fontSize: "18px",
          color: "#374151",
          fontWeight: "500",
        }}>
          alphagap.io
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
