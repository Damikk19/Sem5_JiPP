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
import { GET, POST } from "@/app/api/scores/route";
import { DELETE } from "@/app/api/scores/[id]/route";

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
  it("bez klucza odpowiada 401 i nic nie trafia do bazy", async () => {
    const res = await POST(post('{"id":"ABC","wynik":123}'));
    expect(res.status).toBe(401);
    expect(repo.save).not.toHaveBeenCalled();
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
  ])("limit=%s pobiera %s wyników", async (limit, oczekiwany) => {
    vi.mocked(repo.getTop).mockResolvedValue([]);
    await GET(new NextRequest(`${ADRES}?limit=${limit}`));
    expect(repo.getTop).toHaveBeenCalledWith(oczekiwany);
  });

  it("?sort=latest zwraca ostatnie gry zamiast rankingu", async () => {
    vi.mocked(repo.getLatest).mockResolvedValue([WYNIK]);
    await GET(new NextRequest(`${ADRES}?sort=latest&limit=1`));
    expect(repo.getLatest).toHaveBeenCalledWith(1);
    expect(repo.getTop).not.toHaveBeenCalled();
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

  it("kluczem admina usuwa wynik i zwraca usunięty wpis", async () => {
    vi.mocked(repo.remove).mockResolvedValue(WYNIK);
    const res = await usun(ID, { "x-api-key": "klucz-admina" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(WYNIK);
    expect(repo.remove).toHaveBeenCalledWith(ID);
  });
});
