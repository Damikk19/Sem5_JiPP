import type { Metadata } from "next";

export const TYTUL = "RAM INVADERS · ranking";
export const OPIS = "Gra na micro:bicie z rankingiem online (projekt JiPP)";

// Wspólne ustawienia podglądu linku (Open Graph). Next.js nie łączy openGraph z layoutu i strony,
// tylko podmienia całość, więc każda strona z własnym openGraph musi zacząć od tej stałej.
export const OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  title: TYTUL,
  description: OPIS,
  url: "/",
  siteName: "RAM INVADERS",
  locale: "pl_PL",
  type: "website",
};
