import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif-display", display: "swap", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "Digital Twin — every AI seat, every dollar, every person", template: "%s · Digital Twin" },
  description:
    "Split your company's AI subscriptions across people, track usage and cost per person, and ask each person's digital twin what they've been working on.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
