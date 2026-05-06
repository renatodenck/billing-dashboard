import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing Dashboard",
  description: "OpenAI + Meta billing snapshot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-bg text-zinc-100">{children}</body>
    </html>
  );
}
