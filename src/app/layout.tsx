import type { Metadata, Viewport } from "next";
import { Open_Sans, Source_Serif_4, Geist_Mono } from "next/font/google";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aqli.app";
const TITLE = "Aqli — The shared knowledge base for humans and AI agents";
const DESCRIPTION =
  "Aqli is the open source docs layer your team and your AI agents share. Humans write and review, agents read approved context and draft docs through a REST API. Self-host it or use Aqli Cloud.";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: TITLE,
    template: "%s — Aqli",
  },
  description: DESCRIPTION,
  applicationName: "Aqli",
  keywords: [
    "knowledge base",
    "AI agents",
    "agent context",
    "team documentation",
    "human in the loop",
    "RAG",
    "open source",
    "agent API",
  ],
  openGraph: {
    type: "website",
    siteName: "Aqli",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Aqli — the shared intellect for humans and their agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${sourceSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
