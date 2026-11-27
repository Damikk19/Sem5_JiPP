import type { Metadata } from "next";

// Wspólne ustawienia podglądu linku (Open Graph). Next.js nie łączy openGraph z layoutu i strony,
// tylko podmienia całość, więc każda strona z własnym openGraph musi zacząć od tej stałej.
export const OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  title: "RAM INVADERS · ranking",
  description: "Gra na micro:bicie z rankingiem online (projekt JiPP)",
  url: "/",
  siteName: "RAM INVADERS",
  locale: "pl_PL",
  type: "website",
};
