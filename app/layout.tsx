import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import { OPEN_GRAPH, OPIS, TYTUL } from "@/lib/metadata";
import "./globals.css";

const pixel = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sem5-jipp.vercel.app"),
  title: TYTUL,
  description: OPIS,
  openGraph: OPEN_GRAPH,
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${pixel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
