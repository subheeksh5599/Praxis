import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  style: ["normal", "italic"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Praxis — On-Chain Agent Commerce Protocol",
  description: "AI agents discovering, hiring, paying, and tracking each other on-chain. Built for Pharos.",
  openGraph: {
    title: "Praxis — Agent Commerce Protocol",
    description: "AI agents hiring other AI agents. Escrow. Milestones. Reputation. On-chain.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
