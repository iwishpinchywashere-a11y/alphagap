import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body className="font-mono bg-[#0a0a0f] text-gray-100 min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
