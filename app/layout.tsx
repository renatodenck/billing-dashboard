import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Custos de IA & Mídia · PSA",
  description: "Painel de custos OpenAI e Meta Ads · Profissionaissa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-psa-bg font-sans text-psa-ink">{children}</body>
    </html>
  );
}
