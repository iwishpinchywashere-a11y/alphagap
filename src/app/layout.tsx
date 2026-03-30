import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Clean, readable sans-serif for body text and analysis writeups
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Mono for data tables, scores, numbers
const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlphaGap | Bittensor Subnet Intelligence",
  description: "Find alpha before everyone else. Track GitHub, HuggingFace, and on-chain signals across 128 Bittensor subnets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="font-sans bg-[#0a0a0f] text-gray-100 min-h-full flex flex-col" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
