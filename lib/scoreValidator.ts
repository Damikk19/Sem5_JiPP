import { MAX_PLAYER_ID_LENGTH, MAX_SCORE, type ScoreDto } from "./score";

export type ParseResult =
  | { ok: true; dto: ScoreDto }
  | { ok: false; error: string };

// Znaki, które psują bazę albo wyświetlanie: sterujące (np. NUL, którego baza nie przyjmuje), samotne
// połówki par UTF-16, prywatne i nieprzypisane, separatory wierszy i znaki zmiany kierunku tekstu
// (nick odwracałby na ekranie cyfry wyniku obok). Łącznik zerowej szerokości zostaje, bo skleja emoji (👩‍💻).
const GROZNE = /[\p{Cc}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
// Znaki, które same niczego nie rysują: łączące, spacje, formatujące, wypełniacze Hangul, pusty znak Braille'a.
// Nick złożony tylko z nich byłby w rankingu pusty.
const NIEWIDOCZNE = /[\p{M}\p{Z}\p{Cf}\u115F\u1160\u3164\uFFA0\u2800]/gu;

// Spacje (zwykłe, twarde U+00A0, ideograficzne U+3000 itd.) zamieniamy na jedną zwykłą, także kilka z rzędu:
// "A  BC" i "A BC" z twardą spacją wyglądają na ekranie tak samo, więc mają być tym samym nickiem
const SPACJE = /\p{Zs}+/gu;

// Znaki, które Unicode każe przy wyświetlaniu pomijać (Default_Ignorable_Code_Point: m.in. miękki dywiz,
// spacja zerowej szerokości, BOM, łącznik wyrazów, wypełniacze Hangul, selektory wariantów), pozostałe znaki
// formatujące (\p{Cf}, np. U+FFF9, U+0600) i pusty znak Braille'a. W dowolnym miejscu nicku dają nick, który
// wygląda tak samo albo prawie tak samo, a dla bazy jest inny, więc omija limit nicku i duplikaty.
const UKRYTE = /[\p{Default_Ignorable_Code_Point}\p{Cf}\u2800]/u;
// Wyjątki potrzebne emoji i znakom CJK (kontrakt: emoji złożone są w porządku). Każdy tylko w swoim miejscu:
// - znaki tagów tylko w trzech flagach z tagami, które są w standardzie emoji: Anglii, Szkocji i Walii,
// - selektor wariantu VS15/VS16 zaraz po emoji (❤️, ☺︎), ale nie po cyfrze, # ani *: tam VS16 tylko w keycapie
//   (cyfra + VS16 + U+20E3, np. 1️⃣), a selektory znaków CJK (U+FE00–FE0F, U+E0100–E01EF) zaraz po znaku CJK;
//   mongolskie selektory (U+180B–180D, U+180F) nigdy,
// - łącznik ZWJ między dwoma emoji (👩‍💻; po emoji może być selektor wariantu albo odcień skóry).
const FLAGA_Z_TAGAMI = /\u{1F3F4}\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F}/gu;
const SELEKTOR_W_MIEJSCU =
  /(?<=[^\P{Emoji}0-9#*])[\uFE0E\uFE0F]|(?<=[0-9#*])\uFE0F(?=\u20E3)|(?<=\p{Ideographic})[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu;
const ZWJ_W_EMOJI = /(?<=\p{Extended_Pictographic}[\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]*)\u200D(?=\p{Extended_Pictographic})/gu;

function maUkryteZnaki(nick: string) {
  const bezCzesciEmoji = nick.replace(FLAGA_Z_TAGAMI, "\u{1F3F4}").replace(SELEKTOR_W_MIEJSCU, "").replace(ZWJ_W_EMOJI, "");
  return UKRYTE.test(bezCzesciEmoji);
}

// Format od bramki prowadzącego (lab 13.11): { "id": "<gracz>", "wynik": <liczba> }.
// Bramka przepisuje dane z radia, więc liczba może przyjść jako tekst, np. "50".
export function parse(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Body musi być obiektem JSON: { "id": "...", "wynik": 123 }' };
  }
  const { id, wynik } = body as Record<string, unknown>;

  if (typeof id !== "string" && typeof id !== "number") {
    return { ok: false, error: 'Brak pola "id" (identyfikator gracza)' };
  }
  // Nick zapisujemy w jednej postaci, żeby ten sam napis zawsze był tym samym nickiem (dla limitu nicku
  // i duplikatów): litery w postaci złożonej NFC ("ë" jako jeden znak, nie "e" + kropki) i zwykłe spacje
  const playerId = String(id).normalize("NFC").replace(SPACJE, " ").trim();
  // Znak to najwyżej 2 jednostki UTF-16, więc tekst dłuższy niż 2 × limit na pewno ma za dużo znaków.
  // Odrzucamy go od razu, bez rozbijania na znaki (nie budujemy tablicy z każdego znaku długiego tekstu).
  if (playerId.length > MAX_PLAYER_ID_LENGTH * 2) {
    return { ok: false, error: `"id" musi mieć od 1 do ${MAX_PLAYER_ID_LENGTH} znaków` };
  }
  // Długość w znakach, tak jak liczy varchar w Postgresie (emoji to jeden znak, choć w JS ma length 2)
  const znaki = [...playerId].length;
  if (znaki === 0 || znaki > MAX_PLAYER_ID_LENGTH) {
    return { ok: false, error: `"id" musi mieć od 1 do ${MAX_PLAYER_ID_LENGTH} znaków` };
  }
  if (GROZNE.test(playerId)) {
    return { ok: false, error: '"id" nie może zawierać znaków sterujących ani zmieniających kierunek tekstu' };
  }
  if (playerId.replace(NIEWIDOCZNE, "") === "") {
    return { ok: false, error: '"id" musi zawierać co najmniej jeden widoczny znak' };
  }
  if (maUkryteZnaki(playerId)) {
    return { ok: false, error: '"id" nie może zawierać niewidocznych znaków (np. spacji zerowej szerokości)' };
  }

  // Wynik jako tekst tylko z samych cyfr: "123" tak, ale "1e3", "0x1F" czy "12.5" już nie
  const score = typeof wynik === "string" && /^\d+$/.test(wynik.trim()) ? Number(wynik.trim()) : wynik;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { ok: false, error: `"wynik" musi być liczbą całkowitą od 0 do ${MAX_SCORE}` };
  }

  return { ok: true, dto: { playerId, score } };
}
