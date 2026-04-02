"use client";

import { useState } from "react";
import { SUBNET_LOGOS, subnetAvatarColor } from "@/lib/subnet-logos";

interface SubnetLogoProps {
  netuid: number;
  name: string;
  size?: number; // px, default 20
}

export default function SubnetLogo({ netuid, name, size = 20 }: SubnetLogoProps) {
  const logoUrl = SUBNET_LOGOS[netuid];
  const [failed, setFailed] = useState(false);

  const initials = name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || String(netuid);

  const avatarColor = subnetAvatarColor(netuid);
  const px = `${size}px`;

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="rounded-full object-cover flex-shrink-0 bg-gray-800"
        style={{ width: px, height: px, minWidth: px }}
      />
    );
  }

  // Initials fallback
  const fontSize = size <= 16 ? "7px" : size <= 20 ? "8px" : "9px";
  return (
    <div
      className={`${avatarColor} rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white/80`}
      style={{ width: px, height: px, minWidth: px, fontSize }}
    >
      {initials}
    </div>
  );
}
