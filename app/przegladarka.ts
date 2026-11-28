// Stan przeglądarki dla rankingu: media query, widoczność karty, cykl pokazu i dźwięk.
// window, document, matchMedia i localStorage są czytane tylko w efektach i zdarzeniach, nigdy w renderze:
// strona renderuje się na serwerze i przy hydracji musi wyglądać tak samo jak tam.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { faza } from "@/lib/atrakcja";
import { doZapisu, harmonogram, KLUCZ, zagraj, zapamietany, type Rodzaj } from "@/lib/dzwiek";

export function useMedia(zapytanie: string) {
  const [pasuje, setPasuje] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(zapytanie);
    const zmiana = () => setPasuje(mq.matches);
    zmiana();
    mq.addEventListener("change", zmiana);
    return () => mq.removeEventListener("change", zmiana);
  }, [zapytanie]);
  return pasuje;
}

export function useWidoczna() {
  const [widoczna, setWidoczna] = useState(true);
  useEffect(() => {
    const zmiana = () => setWidoczna(!document.hidden);
    zmiana();
    document.addEventListener("visibilitychange", zmiana);
    return () => document.removeEventListener("visibilitychange", zmiana);
  }, []);
  return widoczna;
}

// Cykl ekranu pokazowego (lib/atrakcja.ts). Kliknięcie, klawisz, powrót do karty i nowa gra (ruch)
// od razu wracają do tabeli i liczą minutę od nowa. seria rośnie przy każdym pokazie.
export function usePokaz(mozna: boolean) {
  const [pokaz, setPokaz] = useState(false);
  const [seria, setSeria] = useState(0);
  // Ostatnia aktywność w ms od otwarcia strony (performance.now): na starcie wejście na stronę
  const aktywnosc = useRef(0);
  const widac = useRef(false);

  const ruch = useCallback(() => {
    aktywnosc.current = performance.now();
    widac.current = false;
    setPokaz(false);
  }, []);

  useEffect(() => {
    const powrot = () => {
      if (!document.hidden) ruch();
    };
    window.addEventListener("pointerdown", ruch);
    window.addEventListener("keydown", ruch);
    document.addEventListener("visibilitychange", powrot);
    return () => {
      window.removeEventListener("pointerdown", ruch);
      window.removeEventListener("keydown", ruch);
      document.removeEventListener("visibilitychange", powrot);
    };
  }, [ruch]);

  // Przed narysowaniem: gdy warunki wracają (np. koniec ekranu rekordu), nie miga stary stan pokazu.
  // Timer po aktywności może się obudzić za wcześnie, ale wtedy tylko przelicza fazę od nowa.
  useLayoutEffect(() => {
    if (!mozna) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const plan = () => {
      const f = faza(performance.now() - aktywnosc.current);
      if (f.pokaz && !widac.current) setSeria((n) => n + 1);
      widac.current = f.pokaz;
      setPokaz(f.pokaz);
      timer = setTimeout(plan, Math.ceil(f.doZmiany));
    };
    plan();
    return () => {
      clearTimeout(timer);
      widac.current = false;
    };
  }, [mozna]);

  return { pokaz: pokaz && mozna, seria, ruch };
}

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
