import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { DayNightBackground } from "@/components/day-night-bg";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <DayNightBackground />
        <header className="border-b sticky top-0 z-10" style={{background:"linear-gradient(90deg,rgba(15,10,25,0.85) 0%,rgba(20,12,28,0.85) 50%,rgba(10,15,25,0.85) 100%)",backdropFilter:"blur(16px)",borderBottomColor:"rgba(244,63,94,0.15)"}}>
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-rose-300 tracking-wide">
              🌹 Roselet
            </Link>
            <Nav />
          </div>
        </header>
        <main className="flex-1 scroll-pt-14">{children}</main>
      </body>
    </html>
  );
}
