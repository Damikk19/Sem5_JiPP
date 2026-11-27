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
    return { kod: 0, stdout };
  } catch (e) {
    return { kod: (e as { code: number }).code, stdout: "" };
  }
}

describe("skrypt usuwania wyniku (npm run usun)", () => {
  it("wysyła DELETE z kluczem admina na adres wyniku", async () => {
    const wynik = await usun(ID, adres);
    expect(wynik.kod).toBe(0);
    expect(odebrane).toEqual([{ method: "DELETE", url: `/api/scores/${ID}`, auth: "Bearer klucz-admina-testowy" }]);
  });

  it.each(["../../docs?x=", "abc", `${ID}/../../x`, `${ID}?a=1`, ""])(
    "odrzuca id, które nie jest UUID, i niczego nie wysyła: %j",
    async (id) => {
      expect((await usun(id, adres)).kod).toBe(1);
      expect(odebrane).toEqual([]);
    },
  );

  it("nie wysyła klucza zwykłym http na obcy serwer", async () => {
    expect((await usun(ID, "http://example.com")).kod).toBe(1);
  });
});
