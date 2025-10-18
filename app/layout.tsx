import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phavai — The Internet’s Opinion, Distilled",
  description: "Distilling public sentiment into a single trusted score.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
