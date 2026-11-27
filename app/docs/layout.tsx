import { Geist_Mono } from "next/font/google";

// Font tekstu tylko na stronie z opisem API. Ranking ma wyłącznie pixelowy font,
// więc nie pobiera tego pliku.
const mono = Geist_Mono({ subsets: ["latin", "latin-ext"] });

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return <div className={mono.className}>{children}</div>;
}
