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

// Real AlphaGap logo (alphagap_logo.svg) embedded as a base64 data URI.
// The SVG contains the proper A-shaped icon with gradients + the italic bold wordmark.
const LOGO_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwMCIgaGVpZ2h0PSI1MDAiIHZpZXdCb3g9IjAgMCAxNjAwIDUwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JlZW5HcmFkIiB4MT0iMTIwIiB5MT0iMjYwIiB4Mj0iNDIwIiB5Mj0iODAiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzA1OTY2OSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjU1JSIgc3RvcC1jb2xvcj0iIzIyYzU1ZSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM0YWRlODAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InNpbHZlckdyYWQiIHgxPSIxMTAiIHkxPSIyODAiIHgyPSIzMDAiIHkyPSI3MCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRDZEOURFIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0ZGRkZGRiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9InNvZnRTaGFkb3ciIHg9Ii0yMCUiIHk9Ii0yMCUiIHdpZHRoPSIxNDAlIiBoZWlnaHQ9IjE0MCUiPgogICAgICA8ZmVEcm9wU2hhZG93IGR4PSIwIiBkeT0iNiIgc3RkRGV2aWF0aW9uPSIxMCIgZmxvb2QtY29sb3I9IiMwMDAwMDAiIGZsb29kLW9wYWNpdHk9IjAuMTgiLz4KICAgIDwvZmlsdGVyPgogIDwvZGVmcz4KCiAgPCEtLSBTeW1ib2wgLS0+CiAgPGcgZmlsdGVyPSJ1cmwoI3NvZnRTaGFkb3cpIj4KICAgIDwhLS0gQSBib2R5IC0tPgogICAgPHBhdGggZD0iTTEwNSAzNjAgTDI0OCA4MiBRMjU4IDY4IDI3NCA4MyBMMzc4IDE5NSBRMzg4IDIwNiAzNzYgMjE0IEwzMzggMjQwIFEzMjggMjQ3IDMyMCAyMzYgTDI2NCAxNjUgTDE0OSAzNjAgWiIKICAgICAgICAgIGZpbGw9InVybCgjc2lsdmVyR3JhZCkiIHN0cm9rZT0iIzExMTExMSIgc3Ryb2tlLXdpZHRoPSIxMCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogICAgPCEtLSByaWdodCBsZWcgYWNjZW50IC0tPgogICAgPHBhdGggZD0iTTMxMiAyODUgTDQwNCAzNjUgUTQxNSAzNzUgNDA2IDM4NiBRMzk4IDM5NSAzODIgMzkwIEwyOTggMzYwIFoiCiAgICAgICAgICBmaWxsPSJ1cmwoI2dyZWVuR3JhZCkiIHN0cm9rZT0iIzExMTExMSIgc3Ryb2tlLXdpZHRoPSIxMCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogICAgPCEtLSBhcnJvdy9ncm93dGggc3dvb3NoIC0tPgogICAgPHBhdGggZD0iTTEwNSAzNjAgCiAgICAgICAgICAgICBDMTcwIDMzOCwgMjM1IDMwMCwgMjk0IDI0NQogICAgICAgICAgICAgQzMzOCAyMDUsIDM2NSAxNzMsIDM5MyAxMzYKICAgICAgICAgICAgIEwzNzUgMTM2CiAgICAgICAgICAgICBRMzY1IDEzNiAzNjAgMTI3CiAgICAgICAgICAgICBRMzU2IDExOCAzNjIgMTEwCiAgICAgICAgICAgICBMNDQ1IDcyCiAgICAgICAgICAgICBRNDU0IDY4IDQ2MSA3MgogICAgICAgICAgICAgUTQ2OSA3NyA0NjYgODcKICAgICAgICAgICAgIEw0MzggMTcyCiAgICAgICAgICAgICBRNDM0IDE4MiA0MjUgMTg0CiAgICAgICAgICAgICBRNDE1IDE4NiA0MDggMTc4CiAgICAgICAgICAgICBMNDA0IDE3MwogICAgICAgICAgICAgQzM2NCAyMjMsIDMyOCAyNjEsIDI4NiAyOTQKICAgICAgICAgICAgIEMyMzEgMzM4LCAxNzQgMzY2LCAxMTEgMzc5CiAgICAgICAgICAgICBROTUgMzgyIDkxIDM3MwogICAgICAgICAgICAgUTg3IDM2NCAxMDUgMzYwIFoiCiAgICAgICAgICBmaWxsPSJ1cmwoI2dyZWVuR3JhZCkiIHN0cm9rZT0iIzExMTExMSIgc3Ryb2tlLXdpZHRoPSIxMCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDwvZz4KCiAgPCEtLSBXb3JkbWFyayAtLT4KICA8ZyBhcmlhLWxhYmVsPSJBbHBoYUdhcCI+CiAgICA8dGV4dCB4PSI1MDUiIHk9IjI5MiIKICAgICAgICAgIGZvbnQtZmFtaWx5PSJJbnRlciwgUG9wcGlucywgQXZlbmlyIE5leHQsIFNlZ29lIFVJLCBBcmlhbCwgc2Fucy1zZXJpZiIKICAgICAgICAgIGZvbnQtc2l6ZT0iMTgwIgogICAgICAgICAgZm9udC1zdHlsZT0iaXRhbGljIgogICAgICAgICAgZm9udC13ZWlnaHQ9IjgwMCIKICAgICAgICAgIGxldHRlci1zcGFjaW5nPSItNSIKICAgICAgICAgIHN0cm9rZT0iIzExMTExMSIKICAgICAgICAgIHN0cm9rZS13aWR0aD0iMTQiCiAgICAgICAgICBwYWludC1vcmRlcj0ic3Ryb2tlIGZpbGwiCiAgICAgICAgICBmaWxsPSJ1cmwoI2dyZWVuR3JhZCkiPkFscGhhR2FwPC90ZXh0PgogIDwvZz4KPC9zdmc+Cg==";

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
        {/* Subtle green glow */}
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

        {/* Real AlphaGap logo — icon + wordmark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_DATA_URI}
          width={900}
          height={281}
          alt="AlphaGap"
          style={{ marginBottom: "28px" }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: "22px",
            color: "#6b7280",
            fontWeight: "400",
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: "40px",
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
