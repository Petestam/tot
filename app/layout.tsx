import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
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
  title: "This or That",
  description: "Crowd-sourced preferences from Pinterest boards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="pb-12">{children}</div>
          <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-zinc-950/95 py-3 text-center text-xs text-zinc-500 backdrop-blur-sm">
            <a
              href="https://nohotashes.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 transition-colors hover:text-zinc-200"
            >
              developed by NO HOT ASHES
            </a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
