import type { Metadata } from "next";
import { Geist_Mono, Press_Start_2P } from "next/font/google";
import { OPEN_GRAPH } from "@/lib/metadata";
import "./globals.css";

const mono = Geist_Mono({
  variable: "--font-mono-text",
  subsets: ["latin", "latin-ext"],
});

const pixel = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sem5-jipp.vercel.app"),
  title: "RAM INVADERS · ranking",
  description: "Gra na micro:bicie z rankingiem online (projekt JiPP)",
  openGraph: OPEN_GRAPH,
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${mono.variable} ${pixel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
