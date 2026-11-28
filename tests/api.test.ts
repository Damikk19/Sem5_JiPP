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
  vi.unstubAllEnvs();
  vi.stubEnv("API_TOKEN", "klucz-bramki");
  vi.stubEnv("ADMIN_TOKEN", "klucz-admina");
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
    vi.mocked(repo.save).mockResolvedValue(WYNIK);
    const req = new NextRequest(`${ADRES}?key=klucz-bramki`, { method: "POST", body: '{"id":"ABC","wynik":1}' });
    expect((await POST(req)).status).toBe(201);
  });

  it("z kluczem zapisuje wynik i odpowiada 201", async () => {
    vi.mocked(repo.save).mockResolvedValue(WYNIK);
    const res = await POST(post('{"id":"ABC","wynik":123}', { authorization: "Bearer klucz-bramki" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(WYNIK);
    expect(repo.save).toHaveBeenCalledWith({ playerId: "ABC", score: 123 });
  });

  it("działa bez nagłówka Content-Type, bo bramka może go nie wysłać", async () => {
    vi.mocked(repo.save).mockResolvedValue(WYNIK);
    const req = new NextRequest(ADRES, {
      method: "POST",
      body: new TextEncoder().encode('{"id":"ABC","wynik":"123"}'),
      headers: { "x-api-key": "klucz-bramki" },
    });
    expect((await POST(req)).status).toBe(201);
  });

  it("zepsuty JSON: 400, baza nietknięta", async () => {
    const res = await POST(post("{zepsuty", { authorization: "Bearer klucz-bramki" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Niepoprawny JSON" });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("złe dane: 400 z opisem, baza nietknięta", async () => {
    const res = await POST(post('{"id":"ABC","wynik":1000000}', { authorization: "Bearer klucz-bramki" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("wynik");
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("błąd bazy: 500 bez szczegółów technicznych w odpowiedzi", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(repo.save).mockRejectedValue(new Error("connection refused 10.0.0.1"));
    const res = await POST(post('{"id":"ABC","wynik":1}', { authorization: "Bearer klucz-bramki" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Błąd bazy danych" });
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
    vi.mocked(repo.save).mockResolvedValue(WYNIK);
    vi.mocked(repo.remove).mockResolvedValue(WYNIK);
    const odpowiedzi = [
      await POST(post('{"id":"ABC","wynik":1}', { authorization: "Bearer klucz-bramki" })),
      await POST(post('{"id":"ABC","wynik":1}')),
      await POST(post("{zepsuty", { authorization: "Bearer klucz-bramki" })),
      await usun(ID, { authorization: "Bearer klucz-admina" }),
      await usun("abc", { authorization: "Bearer klucz-admina" }),
      OPTIONS(),
      OPTIONS_RANKINGU(),
    ];
    expect(odpowiedzi.map((r) => r.status)).toEqual([201, 401, 400, 200, 400, 204, 204]);
    for (const res of odpowiedzi) expect(res.headers.get(CDN)).toBeNull();
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
    const res = await usun(ID, { authorization: "Bearer klucz-bramki" });
    expect(res.status).toBe(401);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("złe id: 400 bez pytania bazy", async () => {
    const res = await usun("abc", { authorization: "Bearer klucz-admina" });
    expect(res.status).toBe(400);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("nie ma takiego wyniku: 404", async () => {
    vi.mocked(repo.remove).mockResolvedValue(null);
    expect((await usun(ID, { authorization: "Bearer klucz-admina" })).status).toBe(404);
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
    const res = await usun(ID, { authorization: "Bearer klucz-admina" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Błąd bazy danych" });
  });

  it("kluczem admina usuwa wynik i zwraca usunięty wpis", async () => {
    vi.mocked(repo.remove).mockResolvedValue(WYNIK);
    const res = await usun(ID, { "x-api-key": "klucz-admina" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(WYNIK);
    expect(repo.remove).toHaveBeenCalledWith(ID);
  });
});
