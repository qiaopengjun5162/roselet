import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { CyberBackground } from "@/components/cyber-background";
import { FallingPetals } from "@/components/falling-petals";
import { RoseClickBloom } from "@/components/rose-click-bloom";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Roselet - 一起来种一个玫瑰花圃吧",
  description: "社区破冰互动：种下玫瑰（感恩）、花苞（期待）、尖刺（焦虑），形成社区花圃",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overscroll-none overflow-hidden`}
      suppressHydrationWarning
    >
      <body className="h-[100dvh] w-screen flex flex-col overflow-hidden overscroll-none" suppressHydrationWarning>
        <CyberBackground />
        <FallingPetals />
        <RoseClickBloom />
        <header className="sticky top-0 z-50 bg-gradient-to-r from-[#100720] via-[#1a0e2e] to-[#100720] backdrop-blur-xl border-b-2 border-rose-500/20 shadow-lg shadow-rose-500/5">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-rose-300 tracking-wide">
              🌹 Roselet
            </Link>
            <Nav />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
