import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Phavai — The internet’s opinion, distilled",
  description: "Transparent product recommendations with scores, confidence, and sources.",
  metadataBase: new URL("https://phavai.com")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full bg-gray-50 text-gray-900`}>
        <Suspense fallback={null}>
          <Nav />
        </Suspense>
        {children}
        <Footer />
      </body>
    </html>
  );
}
