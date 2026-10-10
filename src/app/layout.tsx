import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BMW Requirements Copilot",
  description: "AI-assisted product requirement derivation, prioritization and human-in-the-loop review.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
