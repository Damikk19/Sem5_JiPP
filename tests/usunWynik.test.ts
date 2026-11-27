import { execFile } from "node:child_process";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Skrypt npm run usun wysyła klucz admina, więc nie może go wysłać pod inny adres niż usuwanie wyniku.
const run = promisify(execFile);
const ID = "3f2b8c1e-7a4d-4c2b-9e1f-0a6b5c4d3e2f";
const odebrane: { method?: string; url?: string; auth?: string }[] = [];
const serwer = createServer((req: IncomingMessage, res) => {
  odebrane.push({ method: req.method, url: req.url, auth: req.headers.authorization });
  res.end("{}");
});
let adres = "";

beforeAll(async () => {
  await new Promise<void>((ok) => serwer.listen(0, "127.0.0.1", ok));
  adres = `http://127.0.0.1:${(serwer.address() as AddressInfo).port}`;
});

afterAll(() => {
  serwer.close();
});

beforeEach(() => {
  odebrane.length = 0;
});

async function usun(id: string, apiUrl: string) {
  try {
    const { stdout } = await run(process.execPath, ["scripts/usun-wynik.mjs", id], {
      env: { PATH: process.env.PATH, NODE_ENV: "test", ADMIN_TOKEN: "klucz-admina-testowy", API_URL: apiUrl },
    });
    return { kod: 0, stdout, stderr: "" };
  } catch (e) {
    const blad = e as { code: number; stderr: string };
    return { kod: blad.code, stdout: "", stderr: blad.stderr };
  }
}

describe("skrypt usuwania wyniku (npm run usun)", () => {
  it("wysyła DELETE z kluczem admina na adres wyniku", async () => {
    const wynik = await usun(ID, adres);
    expect(wynik.kod).toBe(0);
    expect(odebrane).toEqual([{ method: "DELETE", url: `/api/scores/${ID}`, auth: "Bearer klucz-admina-testowy" }]);
  });

  it.each(["../../docs?x=", "abc", `${ID}/../../x`, `${ID}?a=1`, "", `../../${ID}`, `x?${ID}`])(
    "odrzuca id, które nie jest UUID, i niczego nie wysyła: %j",
    async (id) => {
      const wynik = await usun(id, adres);
      expect(wynik.kod).toBe(1);
      expect(wynik.stderr).toContain("Podaj id wyniku");
      expect(odebrane).toEqual([]);
    },
  );

  // Komunikat, a nie sam kod 1: kod 1 daje też nieudane połączenie, więc test nie może zależeć od sieci.
  // Domena .invalid nigdy nie istnieje, więc nawet zepsuty skrypt niczego nie wyśle.
  it.each(["http://localhost.evil.com", "http://127.0.0.1.nip.io"])("nie myli obcego hosta z localhost: %s", async (adresApi) => {
    const wynik = await usun(ID, adresApi);
    expect(wynik.kod).toBe(1);
    expect(wynik.stderr).toContain("API_URL musi zaczynać się od https://");
  });

  it("nie wysyła klucza zwykłym http na obcy serwer", async () => {
    const wynik = await usun(ID, "http://example.invalid");
    expect(wynik.kod).toBe(1);
    expect(wynik.stderr).toContain("API_URL musi zaczynać się od https://");
  });
});
