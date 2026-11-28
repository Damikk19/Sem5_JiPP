// Stan przeglądarki dla rankingu: dźwięk.
// window, document, matchMedia i localStorage są czytane tylko w efektach i zdarzeniach, nigdy w renderze:
// strona renderuje się na serwerze i przy hydracji musi wyglądać tak samo jak tam.
import { useCallback, useEffect, useRef, useState } from "react";
import { doZapisu, harmonogram, KLUCZ, zagraj, zapamietany, type Rodzaj } from "@/lib/dzwiek";

// Dźwięk 8-bit, domyślnie wyłączony, wybór zapamiętany w localStorage. Przeglądarka pozwala grać dopiero
// po kliknięciu albo klawiszu, więc kontekst Web Audio powstaje w obsłudze takiego zdarzenia: przy włączeniu
// przyciskiem albo (po przeładowaniu z zapamiętanym „WŁ”) przy pierwszym kliknięciu na stronie.
export function useDzwiek() {
  const [wlaczony, setWlaczony] = useState(false);
  const wlaczonyRef = useRef(false);
  const kontekst = useRef<AudioContext | null>(null);

  const zamknijKontekst = useCallback(() => {
    kontekst.current?.close().catch(() => {});
    kontekst.current = null;
  }, []);

  const uruchom = useCallback(() => {
    let ctx = kontekst.current;
    if (!ctx) {
      if (typeof AudioContext === "undefined") return null;
      ctx = new AudioContext();
      kontekst.current = ctx;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }, []);

  useEffect(() => {
    const wczytaj = () => {
      let w = false;
      try {
        w = zapamietany(localStorage.getItem(KLUCZ));
      } catch {
        // Zablokowany localStorage (np. tryb prywatny): zostaje domyślne „WYŁ”
      }
      wlaczonyRef.current = w;
      setWlaczony(w);
      if (!w) zamknijKontekst();
    };
    // Zmiana w innej karcie z rankingiem
    const zInnejKarty = (e: StorageEvent) => {
      if (e.key === KLUCZ || e.key === null) wczytaj();
    };
    const gest = () => {
      if (wlaczonyRef.current && !document.hidden) uruchom();
    };
    // Karta w tle nic nie gra: kontekst śpi do powrotu
    const widocznosc = () => {
      const ctx = kontekst.current;
      if (!ctx) return;
      if (document.hidden) ctx.suspend().catch(() => {});
      else if (wlaczonyRef.current) ctx.resume().catch(() => {});
    };
    wczytaj();
    window.addEventListener("storage", zInnejKarty);
    window.addEventListener("click", gest);
    window.addEventListener("keydown", gest);
    document.addEventListener("visibilitychange", widocznosc);
    return () => {
      window.removeEventListener("storage", zInnejKarty);
      window.removeEventListener("click", gest);
      window.removeEventListener("keydown", gest);
      document.removeEventListener("visibilitychange", widocznosc);
      zamknijKontekst();
    };
  }, [uruchom, zamknijKontekst]);

  const przelacz = useCallback(() => {
    const w = !wlaczonyRef.current;
    wlaczonyRef.current = w;
    setWlaczony(w);
    try {
      localStorage.setItem(KLUCZ, doZapisu(w));
    } catch {
      // Bez localStorage wybór działa do przeładowania strony
    }
    if (!w) {
      zamknijKontekst();
      return;
    }
    const ctx = uruchom();
    if (ctx) zagraj(ctx, harmonogram("wlaczenie"));
  }, [uruchom, zamknijKontekst]);

  const graj = useCallback((rodzaj: Rodzaj) => {
    const ctx = kontekst.current;
    if (!wlaczonyRef.current || !ctx || ctx.state !== "running" || document.hidden) return;
    zagraj(ctx, harmonogram(rodzaj));
  }, []);

  return { wlaczony, przelacz, graj };
}
