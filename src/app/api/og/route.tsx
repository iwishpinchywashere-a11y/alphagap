/**
 * GET /api/og
 *
 * Generates the Open Graph preview image for link shares on X, LinkedIn, etc.
 * Returns a 1200×630 PNG — the standard og:image size for large card previews.
 *
 * Uses next/og (ImageResponse) which ships with Next.js — no extra packages needed.
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
        {/* Subtle green glow in the centre */}
        <div
          style={{
            position: "absolute",
            width: "700px",
            height: "700px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
            top: "-100px",
            left: "250px",
          }}
        />

        {/* Top-left corner accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "3px",
            height: "120px",
            background: "linear-gradient(to bottom, #10b981, transparent)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "120px",
            height: "3px",
            background: "linear-gradient(to right, #10b981, transparent)",
          }}
        />

        {/* Bottom-right corner accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: "3px",
            height: "120px",
            background: "linear-gradient(to top, #10b981, transparent)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: "120px",
            height: "3px",
            background: "linear-gradient(to left, #10b981, transparent)",
          }}
        />

        {/* Logo mark — stylised "A" triangle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
          }}
        >
          {/* Triangle icon built from divs */}
          <div
            style={{
              width: "0",
              height: "0",
              borderLeft: "36px solid transparent",
              borderRight: "36px solid transparent",
              borderBottom: "62px solid #10b981",
              marginRight: "18px",
            }}
          />
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "0px",
            marginBottom: "16px",
          }}
        >
          <span
            style={{
              fontSize: "80px",
              fontWeight: "800",
              color: "#ffffff",
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            Alpha
          </span>
          <span
            style={{
              fontSize: "80px",
              fontWeight: "800",
              color: "#10b981",
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            Gap
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "24px",
            color: "#6b7280",
            fontWeight: "400",
            letterSpacing: "0.5px",
            marginBottom: "48px",
          }}
        >
          Bittensor Subnet Intelligence
        </div>

        {/* Bottom pill stats row */}
        <div
          style={{
            display: "flex",
            gap: "16px",
          }}
        >
          {["AI-Powered Signals", "120+ Subnets Tracked", "Real-Time Alpha"].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 20px",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.25)",
                borderRadius: "999px",
                fontSize: "16px",
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
            fontSize: "18px",
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
