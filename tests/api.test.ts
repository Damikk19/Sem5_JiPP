import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Score } from "@/lib/score";

// Baza jest tu podmieniona, bo te testy sprawdzają zachowanie HTTP:
// kody odpowiedzi, na których polegają bramka i strona, oraz to, że bez klucza nic nie dociera do bazy.
vi.mock("@/lib/scoreRepository", () => ({
  save: vi.fn(),
  getTop: vi.fn(),
  getLatest: vi.fn(),
  remove: vi.fn(),
}));

import * as repo from "@/lib/scoreRepository";
import { GET, OPTIONS, POST } from "@/app/api/scores/route";
import { DELETE, OPTIONS as OPTIONS_USUWANIA } from "@/app/api/scores/[id]/route";
import { GET as RANKING, OPTIONS as OPTIONS_RANKINGU } from "@/app/api/ranking/route";

const ADRES = "https://sem5-jipp.vercel.app/api/scores";
const ID = "3f2b8c1e-7a4d-4c2b-9e1f-0a6b5c4d3e2f";
const WYNIK: Score = { id: ID, playerId: "ABC", score: 123, timestamp: "2026-11-23T12:00:00.000Z" };
const NOWY = { rodzaj: "nowy", wynik: WYNIK } as const;
// Klucze testowe mają co najmniej 32 znaki, jak prawdziwe (krótszy klucz serwer traktuje jak brak klucza)
const BRAMKA = "klucz-bramki-0123456789abcdef0123456789";
const ADMIN = "klucz-admina-0123456789abcdef0123456789";

function post(body: string, headers: Record<string, string> = {}) {
  return new NextRequest(ADRES, { method: "POST", body, headers });
}

function usun(id: string, headers: Record<string, string> = {}) {
  return DELETE(new NextRequest(`${ADRES}/${id}`, { method: "DELETE", headers }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Ślad zapisów i usunięć (console.info) sprawdzają osobne testy niżej
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.unstubAllEnvs();
  vi.stubEnv("API_TOKEN", BRAMKA);
  vi.stubEnv("ADMIN_TOKEN", ADMIN);
});

describe("POST /api/scores (zapis wyniku od bramki)", () => {
  it("bez klucza odpowiada 401 z nagłówkiem WWW-Authenticate i nic nie trafia do bazy", async () => {
    const res = await POST(post('{"id":"ABC","wynik":123}'));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("serwer bez skonfigurowanego klucza: 500 i nic nie trafia do bazy", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("API_TOKEN", "");
    const res = await POST(post('{"id":"ABC","wynik":1}', { authorization: "Bearer cokolwiek" }));
    expect(res.status).toBe(500);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("przyjmuje klucz w adresie (?key=)", async () => {
    vi.mocked(repo.save).mockResolvedValue(NOWY);
    const req = new NextRequest(`${ADRES}?key=${BRAMKA}`, { method: "POST", body: '{"id":"ABC","wynik":1}' });
    expect((await POST(req)).status).toBe(201);
  });

  it("z kluczem zapisuje wynik i odpowiada 201", async () => {
    vi.mocked(repo.save).mockResolvedValue(NOWY);
    const res = await POST(post('{"id":"ABC","wynik":123}', { authorization: `Bearer ${BRAMKA}` }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(WYNIK);
    expect(repo.save).toHaveBeenCalledWith({ playerId: "ABC", score: 123 });
  });

  it("działa bez nagłówka Content-Type, bo bramka może go nie wysłać", async () => {
    vi.mocked(repo.save).mockResolvedValue(NOWY);
    const req = new NextRequest(ADRES, {
      method: "POST",
      body: new TextEncoder().encode('{"id":"ABC","wynik":"123"}'),
      headers: { "x-api-key": BRAMKA },
    });
    expect((await POST(req)).status).toBe(201);
  });

  it("zepsuty JSON: 400, baza nietknięta", async () => {
    const res = await POST(post("{zepsuty", { authorization: `Bearer ${BRAMKA}` }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Niepoprawny JSON" });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("złe dane: 400 z opisem, baza nietknięta", async () => {
    const res = await POST(post('{"id":"ABC","wynik":1000000}', { authorization: `Bearer ${BRAMKA}` }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("wynik");
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("ta sama gra jeszcze raz (duplikat): 200 z istniejącym wpisem", async () => {
    vi.mocked(repo.save).mockResolvedValue({ rodzaj: "duplikat", wynik: WYNIK });
    const res = await POST(post('{"id":"ABC","wynik":123}', { authorization: `Bearer ${BRAMKA}` }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(WYNIK);
  });

  it.each([
    ["nick", 3, "5 s"],
    ["wszystkie", 42, "30 na 60 s"],
  ] as const)("limit zapisów (%s): 429 z Retry-After", async (powod, ponowZaS, opis) => {
    vi.mocked(repo.save).mockResolvedValue({ rodzaj: "limit", powod, ponowZaS });
    const res = await POST(post('{"id":"ABC","wynik":123}', { authorization: `Bearer ${BRAMKA}` }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe(String(ponowZaS));
    // Skrypt w przeglądarce (test z innej strony) może przeczytać Retry-After tylko z tym nagłówkiem
    expect(res.headers.get("access-control-expose-headers")).toBe("Retry-After");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const { error } = await res.json();
    expect(error).toContain(opis);
    expect(error).toContain(`${ponowZaS} s`);
  });

  it("błąd bazy: 500 bez szczegółów technicznych w odpowiedzi", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(repo.save).mockRejectedValue(new Error("connection refused 10.0.0.1"));
    const res = await POST(post('{"id":"ABC","wynik":1}', { authorization: `Bearer ${BRAMKA}` }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Błąd bazy danych" });
  });
});

// Body jako strumień bez Content-Length, tak jak przy Transfer-Encoding: chunked
function postStrumien(body: ReadableStream<Uint8Array>, headers: Record<string, string>) {
  const init = { method: "POST", body, headers, duplex: "half" };
  return new NextRequest(ADRES, init as ConstructorParameters<typeof NextRequest>[1]);
}

function postKawalki(kawalki: Uint8Array[], headers: Record<string, string> = { "x-api-key": BRAMKA }) {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const k of kawalki) c.enqueue(k);
      c.close();
    },
  });
  return postStrumien(body, headers);
}

// Poprawne body dopełnione spacjami (JSON je pomija) do podanej liczby bajtów
function bodyBajtow(bajty: number) {
  const json = '{"id":"ABC","wynik":1}';
  return new TextEncoder().encode(json + " ".repeat(bajty - json.length));
}

describe("POST /api/scores: limit rozmiaru body (1024 B)", () => {
  const KLUCZ = { authorization: `Bearer ${BRAMKA}` };

  it("Content-Length powyżej limitu: 413 bez czytania body", async () => {
    // Body jest małe, a nagłówek większy: odrzucić może tylko sprawdzenie nagłówka
    const req = post('{"id":"ABC","wynik":1}', { ...KLUCZ, "content-length": "1025" });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain("1024");
    expect(req.body?.locked).toBe(false);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("Content-Length równy limitowi przepuszcza", async () => {
    vi.mocked(repo.save).mockResolvedValue(NOWY);
    const req = new NextRequest(ADRES, { method: "POST", body: bodyBajtow(1024), headers: { ...KLUCZ, "content-length": "1024" } });
    expect((await POST(req)).status).toBe(201);
  });

  it.each(["99999999999999999999", " 5000 "])("bardzo duży albo ze spacjami Content-Length (%j): 413", async (dlugosc) => {
    const res = await POST(post('{"id":"ABC","wynik":1}', { ...KLUCZ, "content-length": dlugosc }));
    expect(res.status).toBe(413);
  });

  it("strumień bez Content-Length: 1024 B przechodzi, 1025 B daje 413", async () => {
    vi.mocked(repo.save).mockResolvedValue(NOWY);
    const dokladnie = bodyBajtow(1024);
    expect((await POST(postKawalki([dokladnie.slice(0, 600), dokladnie.slice(600)]))).status).toBe(201);
    const zaDuzo = bodyBajtow(1025);
    expect((await POST(postKawalki([zaDuzo.slice(0, 600), zaDuzo.slice(600)]))).status).toBe(413);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it("liczy bajty, nie znaki: 600 liter ł to 1200 B", async () => {
    const body = new TextEncoder().encode(`{"id":"ABC","wynik":1,"x":"${"ł".repeat(600)}"}`);
    expect((await POST(postKawalki([body]))).status).toBe(413);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("nieskończony strumień: 413 i przerwanie czytania zaraz po limicie", async () => {
    let przeczytane = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        przeczytane += 512;
        c.enqueue(new TextEncoder().encode(" ".repeat(512)));
      },
      cancel,
    });
    expect((await POST(postStrumien(body, KLUCZ))).status).toBe(413);
    await vi.waitFor(() => expect(cancel).toHaveBeenCalled());
    expect(przeczytane).toBeLessThanOrEqual(2048);
  });

  it("znak rozcięty między kawałkami strumienia nie psuje nicku", async () => {
    vi.mocked(repo.save).mockResolvedValue(NOWY);
    const body = new TextEncoder().encode('{"id":"ŁĄC","wynik":1}');
    // Bajt 8 to środek litery Ł (2 bajty w UTF-8)
    expect((await POST(postKawalki([body.slice(0, 8), body.slice(8)]))).status).toBe(201);
    expect(repo.save).toHaveBeenCalledWith({ playerId: "ŁĄC", score: 1 });
  });

  it("bez klucza: 401, a duże body nie jest nawet czytane", async () => {
    const req = postKawalki([new Uint8Array(5000)], {});
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(req.body?.locked).toBe(false);
  });

  it("puste body: 400 jak zepsuty JSON", async () => {
    const res = await POST(new NextRequest(ADRES, { method: "POST", headers: KLUCZ }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Niepoprawny JSON" });
  });
});

describe("GET /api/scores (ranking)", () => {
  it("jest publiczny i domyślnie zwraca TOP 10", async () => {
    vi.unstubAllEnvs();
    vi.mocked(repo.getTop).mockResolvedValue([WYNIK]);
    const res = await GET(new NextRequest(ADRES));
    expect(res.status).toBe(200);
    // Strona z innej domeny (np. test prowadzącego w przeglądarce) musi móc przeczytać odpowiedź
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toBeNull();
    expect(await res.json()).toEqual([WYNIK]);
    expect(repo.getTop).toHaveBeenCalledWith(10);
  });

  it.each([
    ["5", 5],
    ["0", 1],
    ["1000", 100],
    ["abc", 10],
    ["2.5", 10],
    ["", 10],
    ["%20", 10],
    ["%207%20", 7],
    ["0x10", 10],
    ["1e1", 10],
    ["-5", 10],
    ["%2B5", 10],
    ["99999999999999999999", 100],
  ])("limit=%s pobiera %s wyników", async (limit, oczekiwany) => {
    vi.mocked(repo.getTop).mockResolvedValue([]);
    await GET(new NextRequest(`${ADRES}?limit=${limit}`));
    expect(repo.getTop).toHaveBeenCalledWith(oczekiwany);
  });

  it("?sort=latest zwraca ostatnie gry zamiast rankingu", async () => {
    vi.mocked(repo.getLatest).mockResolvedValue([WYNIK]);
    const res = await GET(new NextRequest(`${ADRES}?sort=latest&limit=1`));
    expect(await res.json()).toEqual([WYNIK]);
    expect(repo.getLatest).toHaveBeenCalledWith(1);
    expect(repo.getTop).not.toHaveBeenCalled();
  });

  it("błąd bazy: 500 bez szczegółów technicznych", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(repo.getTop).mockRejectedValue(new Error("timeout postgres://u:haslo@db"));
    const res = await GET(new NextRequest(ADRES));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Błąd bazy danych" });
  });
});

describe("GET /api/ranking (dane dla strony w jednym żądaniu)", () => {
  it("zwraca TOP 10 i 10 ostatnich gier, bez klucza", async () => {
    vi.unstubAllEnvs();
    vi.mocked(repo.getTop).mockResolvedValue([WYNIK]);
    vi.mocked(repo.getLatest).mockResolvedValue([WYNIK]);
    const res = await RANKING();
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({ top: [WYNIK], latest: [WYNIK] });
    expect(repo.getTop).toHaveBeenCalledWith(10);
    expect(repo.getLatest).toHaveBeenCalledWith(10);
  });

  it("błąd bazy: 500, żeby strona pokazała brak sygnału", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(repo.getTop).mockResolvedValue([]);
    vi.mocked(repo.getLatest).mockRejectedValue(new Error("timeout"));
    const res = await RANKING();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Błąd bazy danych" });
  });
});

// CDN Vercela zapamiętuje odpowiedź tylko z tym nagłówkiem. Błąd zapamiętany na 30 s pokazywałby stronie
// brak sygnału po naprawie bazy, a zapis czy usunięcie w cache CDN nie mają czego szukać.
describe("cache CDN tylko dla udanych publicznych GET", () => {
  const CDN = "vercel-cdn-cache-control";

  it.each([
    ["GET /api/scores", () => GET(new NextRequest(ADRES))],
    ["GET /api/scores?sort=latest", () => GET(new NextRequest(`${ADRES}?sort=latest`))],
    ["GET /api/ranking", () => RANKING()],
  ])("%s z odpowiedzią 200 ma krótki cache CDN", async (_, wyslij) => {
    vi.mocked(repo.getTop).mockResolvedValue([WYNIK]);
    vi.mocked(repo.getLatest).mockResolvedValue([WYNIK]);
    const res = await wyslij();
    expect(res.status).toBe(200);
    expect(res.headers.get(CDN)).toBe("max-age=5, stale-while-revalidate=25");
    // Przeglądarka nie dostaje własnego cache: strona i tak pyta co 5 s
    expect(res.headers.get("cache-control")).toBeNull();
  });

  it.each([
    ["GET /api/scores", () => GET(new NextRequest(ADRES))],
    ["GET /api/scores?sort=latest", () => GET(new NextRequest(`${ADRES}?sort=latest`))],
    ["GET /api/ranking", () => RANKING()],
  ])("%s z błędem bazy (500) nie ma cache", async (_, wyslij) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(repo.getTop).mockRejectedValue(new Error("timeout"));
    vi.mocked(repo.getLatest).mockRejectedValue(new Error("timeout"));
    const res = await wyslij();
    expect(res.status).toBe(500);
    expect(res.headers.get(CDN)).toBeNull();
  });

  it("zapis, odrzucony zapis i usuwanie nie mają cache", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(repo.save).mockResolvedValue(NOWY);
    vi.mocked(repo.remove).mockResolvedValue(WYNIK);
    const odpowiedzi = [
      await POST(post('{"id":"ABC","wynik":1}', { authorization: `Bearer ${BRAMKA}` })),
      await POST(post('{"id":"ABC","wynik":1}')),
      await (async () => {
        vi.mocked(repo.save).mockResolvedValueOnce({ rodzaj: "duplikat", wynik: WYNIK });
        return POST(post('{"id":"ABC","wynik":1}', { authorization: `Bearer ${BRAMKA}` }));
      })(),
      await (async () => {
        vi.mocked(repo.save).mockResolvedValueOnce({ rodzaj: "limit", powod: "nick", ponowZaS: 2 });
        return POST(post('{"id":"ABC","wynik":1}', { authorization: `Bearer ${BRAMKA}` }));
      })(),
      await POST(post("{zepsuty", { authorization: `Bearer ${BRAMKA}` })),
      await usun(ID, { authorization: `Bearer ${ADMIN}` }),
      await usun("abc", { authorization: `Bearer ${ADMIN}` }),
      OPTIONS(),
      OPTIONS_RANKINGU(),
    ];
    expect(odpowiedzi.map((r) => r.status)).toEqual([201, 401, 200, 429, 400, 200, 400, 204, 204]);
    for (const res of odpowiedzi) expect(res.headers.get(CDN)).toBeNull();
  });
});

// Klient nie może z odpowiedzi poznać, którego klucza brakuje (np. na wdrożeniu bez zmiennych).
// Szczegół dostaje tylko właściciel w logu serwera.
describe("zła konfiguracja kluczy: ogólny błąd 500, szczegół tylko w logu", () => {
  function log() {
    return vi.spyOn(console, "error").mockImplementation(() => {});
  }

  it.each([
    ["brak API_TOKEN", { API_TOKEN: "" }, "brak zmiennej API_TOKEN"],
    ["krótki API_TOKEN", { API_TOKEN: "krotki-klucz-bramki" }, "API_TOKEN ma mniej niż 32 znaki"],
  ])("POST, %s", async (_, env, opis) => {
    const spy = log();
    for (const [nazwa, wartosc] of Object.entries(env)) vi.stubEnv(nazwa, wartosc);
    const res = await POST(post('{"id":"ABC","wynik":1}', { authorization: "Bearer krotki-klucz-bramki" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Błąd konfiguracji serwera" });
    expect(repo.save).not.toHaveBeenCalled();
    const zalogowane = spy.mock.calls.flat().join(" ");
    expect(zalogowane).toContain(opis);
    expect(zalogowane).not.toContain("krotki-klucz-bramki");
  });

  it.each([
    ["brak ADMIN_TOKEN", { ADMIN_TOKEN: "" }, "brak zmiennej ADMIN_TOKEN"],
    ["ADMIN_TOKEN taki sam jak API_TOKEN", { ADMIN_TOKEN: BRAMKA }, "ADMIN_TOKEN jest taki sam jak API_TOKEN"],
  ])("DELETE, %s", async (_, env, opis) => {
    const spy = log();
    for (const [nazwa, wartosc] of Object.entries(env)) vi.stubEnv(nazwa, wartosc);
    const res = await usun(ID, { authorization: `Bearer ${BRAMKA}` });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Błąd konfiguracji serwera" });
    expect(repo.remove).not.toHaveBeenCalled();
    const zalogowane = spy.mock.calls.flat().join(" ");
    expect(zalogowane).toContain(opis);
    expect(zalogowane).not.toContain(BRAMKA);
  });

  it("ten sam klucz w obu zmiennych blokuje tylko usuwanie: zapis działa", async () => {
    vi.stubEnv("ADMIN_TOKEN", BRAMKA);
    vi.mocked(repo.save).mockResolvedValue(NOWY);
    expect((await POST(post('{"id":"ABC","wynik":1}', { authorization: `Bearer ${BRAMKA}` }))).status).toBe(201);
  });
});

// Jedna linia w logu przy każdej udanej zmianie danych: widać zalew zapisów i to, co zostało usunięte
describe("ślad w logach", () => {
  function zalogowane() {
    return vi.mocked(console.info).mock.calls.map((wywolanie) => wywolanie.join(" "));
  }

  it("udany zapis: jedna linia z id, nickiem i wynikiem, bez klucza", async () => {
    vi.mocked(repo.save).mockResolvedValue(NOWY);
    await POST(new NextRequest(`${ADRES}?key=${BRAMKA}`, { method: "POST", body: '{"id":"ABC","wynik":123}' }));
    expect(zalogowane()).toEqual([`POST /api/scores zapisany id=${ID} nick="ABC" wynik=123`]);
  });

  it("duplikat: linia z istniejącym wpisem", async () => {
    vi.mocked(repo.save).mockResolvedValue({ rodzaj: "duplikat", wynik: WYNIK });
    await POST(post('{"id":"ABC","wynik":123}', { authorization: `Bearer ${BRAMKA}` }));
    expect(zalogowane()).toEqual([`POST /api/scores duplikat id=${ID} nick="ABC" wynik=123`]);
  });

  it("udane usunięcie: linia z usuniętym wpisem, bez klucza admina", async () => {
    vi.mocked(repo.remove).mockResolvedValue(WYNIK);
    await usun(ID, { authorization: `Bearer ${ADMIN}` });
    expect(zalogowane()).toEqual([`DELETE /api/scores usunięty id=${ID} nick="ABC" wynik=123`]);
  });

  it("nick ze spacją i cudzysłowem nie miesza się z resztą linii", async () => {
    vi.mocked(repo.save).mockResolvedValue({ rodzaj: "nowy", wynik: { ...WYNIK, playerId: 'A" wynik=9' } });
    await POST(post('{"id":"A\\" wynik=9","wynik":123}', { authorization: `Bearer ${BRAMKA}` }));
    expect(zalogowane()).toEqual([`POST /api/scores zapisany id=${ID} nick="A\\" wynik=9" wynik=123`]);
  });

  it("odrzucone żądania i nieudane usunięcie nie zostawiają śladu zmiany", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(repo.save).mockResolvedValueOnce({ rodzaj: "limit", powod: "nick", ponowZaS: 2 });
    await POST(post('{"id":"ABC","wynik":1}', { authorization: `Bearer ${BRAMKA}` }));
    await POST(post('{"id":"ABC","wynik":1}'));
    await POST(post('{"id":"","wynik":1}', { authorization: `Bearer ${BRAMKA}` }));
    vi.mocked(repo.save).mockRejectedValueOnce(new Error("timeout"));
    await POST(post('{"id":"ABC","wynik":1}', { authorization: `Bearer ${BRAMKA}` }));
    vi.mocked(repo.remove).mockResolvedValueOnce(null);
    await usun(ID, { authorization: `Bearer ${ADMIN}` });
    await usun(ID, { authorization: `Bearer ${BRAMKA}` });
    expect(zalogowane()).toEqual([]);
  });
});

describe("OPTIONS (zapytanie wstępne przeglądarki)", () => {
  it.each([
    ["/api/scores", OPTIONS, "GET, POST, OPTIONS"],
    ["/api/scores/{id}", OPTIONS_USUWANIA, "DELETE, OPTIONS"],
    ["/api/ranking", OPTIONS_RANKINGU, "GET, OPTIONS"],
  ])("%s podaje tylko swoje metody", (_, options, metody) => {
    const res = options();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toBe(metody);
    expect(res.headers.get("access-control-allow-headers")).toContain("X-API-Key");
  });
});

describe("DELETE /api/scores/{id} (usuwanie kluczem admina)", () => {
  it("kluczem bramki odpowiada 401 i niczego nie usuwa", async () => {
    const res = await usun(ID, { authorization: `Bearer ${BRAMKA}` });
    expect(res.status).toBe(401);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("złe id: 400 bez pytania bazy", async () => {
    const res = await usun("abc", { authorization: `Bearer ${ADMIN}` });
    expect(res.status).toBe(400);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("nie ma takiego wyniku: 404", async () => {
    vi.mocked(repo.remove).mockResolvedValue(null);
    expect((await usun(ID, { authorization: `Bearer ${ADMIN}` })).status).toBe(404);
  });

  it("serwer bez klucza admina: 500 i nic nie jest usuwane", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ADMIN_TOKEN", "");
    expect((await usun(ID, { authorization: "Bearer cokolwiek" })).status).toBe(500);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("błąd bazy: 500 bez szczegółów technicznych", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(repo.remove).mockRejectedValue(new Error("timeout"));
    const res = await usun(ID, { authorization: `Bearer ${ADMIN}` });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Błąd bazy danych" });
  });

  it("kluczem admina usuwa wynik i zwraca usunięty wpis", async () => {
    vi.mocked(repo.remove).mockResolvedValue(WYNIK);
    const res = await usun(ID, { "x-api-key": ADMIN });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(WYNIK);
    expect(repo.remove).toHaveBeenCalledWith(ID);
  });
});
