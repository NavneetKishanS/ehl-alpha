import type { Metadata } from "next";
// Self-hosted so the font works offline (Google Fonts fetches can time out on venue Wi-Fi).
import "@fontsource-variable/inter";
import "./globals.css";
import { PinguChat } from "@/components/pingu/PinguChat";

export const metadata: Metadata = {
  title: "PM Kompass · BMW Group",
  description: "AI-assisted product requirement derivation, prioritization and human-in-the-loop review.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}
        <PinguChat />
      </body>
    </html>
  );
}
