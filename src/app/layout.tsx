import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YAHRIA CODE OS — Autonomous Hybrid Reasoning Intelligence Assistant",
  description:
    "YAHRIA Mission Control : système d'exploitation de développement logiciel autonome à raisonnement hybride — gouvernance, preuves, agents, exécution sandbox.",
  keywords: ["YAHRIA", "Hybrid Reasoning", "Agent OS", "Evidence Engine", "Autonomous Coding"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0B1120] text-slate-200 min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
