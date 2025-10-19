// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phavai — The Internet’s Opinion, Distilled",
  description:
    "Phavai aggregates public sentiment into one trusted, transparent score.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-gray-50">
      <body className="min-h-full antialiased text-gray-900">{children}</body>
    </html>
  );
}
