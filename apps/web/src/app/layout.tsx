import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-rose-700">
              🌹 Roselet
            </Link>
            <nav className="flex gap-4">
              <Link href="/plant" className="text-sm text-muted-foreground hover:text-rose-600">
                种玫瑰
              </Link>
              <Link href="/garden" className="text-sm text-muted-foreground hover:text-rose-600">
                花圃
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
