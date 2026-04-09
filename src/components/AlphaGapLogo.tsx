"use client";

interface AlphaGapLogoProps {
  className?: string;
  height?: number; // px height for the crown image
}

export default function AlphaGapLogo({ className = "", height = 48 }: AlphaGapLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ height }}>
      <img
        src="/alphagap_crown.png"
        alt=""
        style={{ height, width: "auto" }}
      />
      <span
        style={{
          fontFamily: "Inter, 'Segoe UI', Arial, sans-serif",
          fontSize: height * 0.58,
          fontWeight: 800,
          fontStyle: "italic",
          letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #059669 0%, #22c55e 55%, #4ade80 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1,
        }}
      >
        AlphaGap
      </span>
    </div>
  );
}
