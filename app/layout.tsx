import type { Metadata } from "next";
import { Orbitron, Rajdhani } from "next/font/google";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-orbitron",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Nexus | Quantum Knowledge Core",
  description: "AI Nexus — Quantum Knowledge Core v4.0.2. Created by Shafiq Chohan.",
  keywords: ["AI Nexus", "Quantum Knowledge", "Machine Learning", "AI Platform"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${rajdhani.variable}`}>
      <body className="min-h-screen bg-[#030b1a]">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
