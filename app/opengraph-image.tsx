// Obrazek podglądu linku (np. po wklejeniu adresu na Teams): tytuł gry i kość RAM jak na stronie.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { KLATKA_A, LED } from "@/lib/ram";

export const alt = "RAM INVADERS: ranking gry na micro:bicie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generator obrazków nie czyta formatu woff2 z next/font, więc font leży w repo jako TTF (licencja OFL)
const font = await readFile(join(process.cwd(), "assets/fonts/PressStart2P-Regular.ttf"));

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 72,
          background: "#000",
          fontFamily: "Press Start 2P",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {KLATKA_A.map((wiersz, y) => (
            <div key={y} style={{ display: "flex", gap: 12 }}>
              {wiersz.split("").map((znak, x) => (
                <div
                  key={x}
                  style={{
                    width: 40,
                    height: 40,
                    background: znak === "#" ? LED : "#1c1c1c",
                    boxShadow: znak === "#" ? `0 0 18px ${LED}` : "none",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 56, color: LED, textShadow: `0 0 14px ${LED}` }}>RAM</div>
          <div style={{ fontSize: 56, color: LED, textShadow: `0 0 14px ${LED}` }}>INVADERS</div>
          <div style={{ fontSize: 24, color: "#f4f1e8", marginTop: 16 }}>HIGH SCORES</div>
          <div style={{ fontSize: 16, color: "#8b8b8b" }}>GRA NA MICRO:BICIE · JIPP</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Press Start 2P", data: font, style: "normal", weight: 400 }] },
  );
}
