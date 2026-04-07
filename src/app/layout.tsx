import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import AuthSessionProvider from "@/components/auth/SessionProvider";
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
  description: "Find the alpha gap before everyone else. Our AI scans thousands of data points across the Bittensor ecosystem to surface undervalued subnets before the market catches on.",
  icons: {
    icon: [
      { url: "/alphagap_icon.svg", type: "image/svg+xml" },
    ],
    apple: "/alphagap_icon.svg",
    shortcut: "/alphagap_icon.svg",
  },
  openGraph: {
    title: "AlphaGap | Bittensor Subnet Intelligence",
    description: "Find the alpha gap before everyone else. Our AI scans thousands of data points across the Bittensor ecosystem to surface undervalued subnets before the market catches on.",
    images: [{ url: "/alphagap_logo_dark.svg" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="font-sans bg-[#0a0a0f] text-gray-100 min-h-full flex flex-col" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
