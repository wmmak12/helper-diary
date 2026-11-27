import type { Metadata, Viewport } from "next";
import { Newsreader, Noto_Serif_SC, Noto_Serif_Myanmar } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-newsreader", display: "swap" });
const notoSc = Noto_Serif_SC({ weight: ["400", "600"], variable: "--font-noto-sc", display: "swap", preload: false });
const notoMy = Noto_Serif_Myanmar({ subsets: ["myanmar"], weight: ["400", "500", "600"], variable: "--font-noto-my", display: "swap" });

export const metadata: Metadata = {
  title: "Helper Diary",
  description: "Talk with your helper on one phone. What you agree is written down, in her language.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: "/icon-180.png",
  },
  openGraph: {
    title: "Helper Diary",
    description: "Talk with your helper on one phone. What you agree is written down, in her language.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Helper Diary: talk with your helper on one phone. What you agree is written down, in her language." }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#EFE6D6", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${notoSc.variable} ${notoMy.variable}`}>
      <body>{children}</body>
    </html>
  );
}
