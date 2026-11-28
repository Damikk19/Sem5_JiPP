import type { Ranking } from "./odswiezanie";
import type { Score } from "./score";

// Jak długo widać ekran NEW HIGH SCORE. Klik albo Escape zamyka go wcześniej.
export const REKORD_MS = 5_000;

// Nowy rekord to nowa gra (z listy nowych gier z odpytywania) na 1. miejscu z wynikiem większym niż
// rekord, który widać teraz na stronie (przy pustej tabeli 0, więc wynik 0 nie jest rekordem).
// Remis nie jest rekordem: przy remisie wyżej jest starsza gra (WF-11), więc nowa nie trafia na 1. miejsce.
// Pierwsze pobranie i usunięcie wpisu nie dają nowych gier, więc nie świętują.
export function nowyRekord(top: Score[], nowe: string[], dotychczasowy: number): Score | null {
  const pierwszy = top[0];
  if (!pierwszy || !nowe.includes(pierwszy.id)) return null;
  return pierwszy.score > dotychczasowy ? pierwszy : null;
}

// Dane do tabeli razem z grami, które w nich migają, i rekordem, który je przyniósł.
// trzyma: wyróżnienie przetrwa jeszcze jedno pytanie bez nowych gier (dane po zamknięciu ekranu rekordu).
export type Paczka = { dane: Ranking; nowe: string[]; rekord: Score | null; trzyma?: boolean };

// Co widać na stronie. Kiedy przychodzi rekord, pod ekranem rekordu zostaje stara tabela, a nowe dane
// czekają na jego zamknięcie: dopiero wtedy wiersze przesuwają się w dół, więc widać, co się zmieniło.
export type Widok = {
  tabela: Paczka | null;
  // otwarty ekran rekordu
  rekord: Score | null;
  // dane, które czekają na zamknięcie ekranu rekordu
  czeka: Paczka | null;
  // gry, które już mają swój dźwięk: fanfara rekordu gra za całą paczkę, w której przyszedł
  zagrane: string[];
};

// Jeden dźwięk na raz: kilka nowych gier naraz to jeden dźwięk, a rekord ma pierwszeństwo
export type Dzwiek = "nowa-gra" | "rekord" | null;

export const POCZATEK: Widok = { tabela: null, rekord: null, czeka: null, zagrane: [] };

const suma = (a: string[], b: string[]) => [...new Set([...a, ...b])];

// Nowe dane z odpytywania. nowaPetla: pierwsze pobranie po wejściu na stronę albo powrocie z innej podstrony.
export function przyjmij(w: Widok, dane: Ranking, nowe: string[], nowaPetla = false): { widok: Widok; dzwiek: Dzwiek } {
  if (nowaPetla) {
    // Jak pierwsze pobranie: nic nie świętuje i nic z wcześniejszych danych nie zostaje wyróżnione
    return { widok: { tabela: { dane, nowe: [], rekord: null }, rekord: null, czeka: null, zagrane: [] }, dzwiek: null };
  }
  if (w.rekord) {
    // Ekran rekordu jest otwarty: czekają najnowsze dane, a nowe gry z kolejnych pytań się sumują
    const wszystkie = suma(w.czeka?.nowe ?? [], nowe);
    // Wyższy rekord w trakcie podmienia ekran (od nowa 5 s, fanfara, komunikat). Niższa i równa gra czeka.
    const wyzszy = nowyRekord(dane.top, nowe, w.rekord.score);
    if (wyzszy) {
      return {
        widok: { tabela: w.tabela, rekord: wyzszy, czeka: { dane, nowe: wszystkie, rekord: wyzszy }, zagrane: suma(w.zagrane, nowe) },
        dzwiek: "rekord",
      };
    }
    return { widok: { ...w, czeka: { dane, nowe: wszystkie, rekord: w.rekord } }, dzwiek: null };
  }
  const rekord = nowyRekord(dane.top, nowe, w.tabela?.dane.top[0]?.score ?? 0);
  if (rekord) {
    return { widok: { tabela: w.tabela, rekord, czeka: { dane, nowe, rekord }, zagrane: nowe }, dzwiek: "rekord" };
  }
  // Po zamknięciu ekranu rekordu kolejne pytanie przychodzi zwykle zaraz (oba czasy liczą się od tej samej
  // odpowiedzi): bez nowych gier wyróżnienie i komunikat zostają na to jedno pytanie, żeby rekord mignął
  // w całości. Następne pytanie gasi je jak po zwykłej grze.
  if (nowe.length === 0 && w.tabela?.trzyma) {
    return { widok: { ...w, tabela: { ...w.tabela, dane, trzyma: false } }, dzwiek: null };
  }
  return {
    widok: { tabela: { dane, nowe, rekord: null }, rekord: null, czeka: null, zagrane: [] },
    dzwiek: nowe.length > 0 ? "nowa-gra" : null,
  };
}

// Zamknięcie ekranu rekordu (czas, klik albo Escape): do tabeli wchodzą dane, które czekały.
// Rekord już zagrał fanfarę (za całą swoją paczkę), więc dźwięk jest tylko wtedy, gdy w międzyczasie
// przyszły inne gry.
export function zamknij(w: Widok): { widok: Widok; dzwiek: Dzwiek } {
  const { rekord, czeka } = w;
  if (!rekord || !czeka) return { widok: w, dzwiek: null };
  const bezDzwieku = czeka.nowe.some((id) => !w.zagrane.includes(id));
  return {
    widok: { tabela: { ...czeka, trzyma: true }, rekord: null, czeka: null, zagrane: [] },
    dzwiek: bezDzwieku ? "nowa-gra" : null,
  };
}

// Komunikat dla czytnika ekranu (region aria-live). Rekord z otwartego ekranu albo ten, który przyniósł dane
// w tabeli: po zamknięciu ekranu tekst się nie zmienia, więc czytnik nie czyta go drugi raz.
export function komunikat(w: Widok) {
  const rekord = w.rekord ?? w.tabela?.rekord;
  if (rekord) return `Nowy rekord: ${rekord.playerId}, ${rekord.score} pkt`;
  const ostatnia = w.tabela?.dane.latest[0];
  if (ostatnia && w.tabela?.nowe.includes(ostatnia.id)) return `Nowy wynik: ${ostatnia.playerId}, ${ostatnia.score} pkt`;
  return "";
}
