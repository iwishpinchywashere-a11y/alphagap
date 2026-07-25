import type { Metadata } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import AuthSessionProvider from "@/components/auth/SessionProvider";
import { ReferralTracker } from "@/components/ReferralTracker";
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

// Display face for the Obsidian Glass redesign — headlines, KPI numbers, ranks
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const SITE_URL = "https://www.alphagap.io";

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
    url: SITE_URL,
    siteName: "AlphaGap",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "AlphaGap — Bittensor Subnet Intelligence",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaGap | Bittensor Subnet Intelligence",
    description: "Find the alpha gap before everyone else. Our AI scans thousands of data points across the Bittensor ecosystem to surface undervalued subnets before the market catches on.",
    images: [`${SITE_URL}/og-image.png`],
    site: "@AlphaGapTAO",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <head>
        {/* Google Analytics — next/script keeps hydration clean (raw <script>
            tags in JSX trigger "Encountered a script tag while rendering" and
            are never executed client-side) */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-95NFVBB3JC" strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-95NFVBB3JC');
          `}
        </Script>
      </head>
      <body className="font-sans bg-[#0a0a0f] text-gray-100 min-h-full flex flex-col" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        <AuthSessionProvider>
          {process.env.REFERRAL_ENABLED && <ReferralTracker />}
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
