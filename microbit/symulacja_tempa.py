"""Symulacja tempa RAM INVADERS: logika gry z main.ts przepisana na Pythona + boty o różnym refleksie.
Pokazuje, ile trwa partia i jakie są wyniki przy danych ustawieniach tempa.
Tymi pomiarami dobrałem tempo w grze (przeciętna partia ok. minuty).
Uruchomienie: python3 symulacja_tempa.py"""
import random
import statistics

DDR5, DDR5_U, DDR4 = 200, 90, 30
# Pętla gry na micro:bicie: pause(10), potem 20 ms przerwy z basic.forever, a planista budzi wątek
# w swoim takcie (6 ms na V1). Razem ok. 36 ms na jeden krok gry.
KROK_PETLI = 36
# Błysk po utracie życia: pętla stoi, a przyciski w grze nic nie robią
BLYSK = 120


class Gra:
    def __init__(self, rng, fall0=900, spawn0=1600, fall_min=300, spawn_min=650, fall_step=7, spawn_step=12):
        self.rng = rng
        self.t = 0
        self.zycia = 3
        self.wynik = 0
        self.fall, self.spawn = fall0, spawn0
        self.fall_min, self.spawn_min, self.fall_step, self.spawn_step = fall_min, spawn_min, fall_step, spawn_step
        self.last_fall = self.last_spawn = self.last_bullet = 0
        self.px = 2
        self.bullet = None  # (x, y)
        self.ramy = []  # [x, y, jasnosc]
        self.koniec = False
        self.zabite = 0
        self.pauza_do = 0  # do kiedy trwa błysk

    def pauza(self):
        return self.t < self.pauza_do

    # --- akcje gracza ---
    def lewo(self):
        if not self.pauza():
            self.px = max(0, self.px - 1)

    def prawo(self):
        if not self.pauza():
            self.px = min(4, self.px + 1)

    def strzal(self):
        if self.pauza() or self.bullet is not None:
            return
        self.bullet = [self.px, 3]
        self.last_bullet = self.t
        self.hits()

    # --- logika ---
    def hits(self):
        if self.bullet is None:
            return
        for r in self.ramy:
            if r[0] == self.bullet[0] and r[1] == self.bullet[1]:
                self.bullet = None
                if r[2] == DDR5:
                    r[2] = DDR5_U
                    return
                self.wynik += 3 if r[2] == DDR5_U else 1
                self.ramy.remove(r)
                self.zabite += 1
                self.fall = max(self.fall_min, self.fall - self.fall_step)
                self.spawn = max(self.spawn_min, self.spawn - self.spawn_step)
                return

    def krok(self):
        if self.bullet is not None and self.t - self.last_bullet >= 70:
            self.last_bullet = self.t
            if self.bullet[1] == 0:
                self.bullet = None
            else:
                self.bullet[1] -= 1
                self.hits()
        if self.t - self.last_fall >= self.fall:
            self.last_fall = self.t
            for r in list(self.ramy):
                r[1] += 1
                if r[1] == 4:
                    self.ramy.remove(r)
                    self.zycia -= 1
                    self.pauza_do = max(self.pauza_do, self.t) + BLYSK
                    if self.zycia <= 0:
                        self.koniec = True
            self.hits()
        if self.t - self.last_spawn >= self.spawn:
            self.last_spawn = self.t
            x = self.rng.randint(0, 4)
            if not any(r[1] == 0 and r[0] == x for r in self.ramy):
                b = DDR5 if self.rng.randint(0, 99) < min(40, self.wynik * 2) else DDR4
                self.ramy.append([x, 0, b])
                self.hits()


def partia(seed, reakcja=250, klik=180, klik_ab=260, **kw):
    """Bot: patrzy na aktualną planszę i celuje w najniższą kość. Po każdym naciśnięciu jest zajęty
    przez `klik` ms (A+B: `klik_ab`), a potem (także gdy nic nie nacisnął) losowo do `reakcja` ms, zanim znów spojrzy.
    GC nie używa."""
    rng = random.Random(seed)
    g = Gra(rng, **kw)
    zajety_do = 0
    nastepny_krok = 0
    while not g.koniec and g.t < 15 * 60 * 1000:
        g.t += 2
        # Krok gry co KROK_PETLI ms, a po błysku dopiero wtedy, gdy pętla przestanie stać
        if g.t >= nastepny_krok:
            g.krok()
            if g.koniec:
                break
            nastepny_krok = max(g.t, g.pauza_do) + KROK_PETLI
        # Przyciski działają między krokami, bo ich obsługa nie czeka na pętlę gry
        if g.t < zajety_do:
            continue
        # cel: najniższa kość (najbliżej dna), przy remisie najbliższa kolumnie
        widoczne = [r for r in g.ramy]
        if not widoczne:
            continue
        cel = max(widoczne, key=lambda r: (r[1], -abs(r[0] - g.px)))
        if cel[0] < g.px:
            g.lewo(); zajety_do = g.t + klik
        elif cel[0] > g.px:
            g.prawo(); zajety_do = g.t + klik
        elif g.bullet is None:
            g.strzal(); zajety_do = g.t + klik_ab
        # opóźnienie reakcji na nowy stan po każdej akcji
        zajety_do += rng.randint(0, reakcja)
    return g.t / 1000, g.wynik, g.zabite


def raport(nazwa, n=400, **kw):
    wyniki = [partia(s, **kw) for s in range(n)]
    czasy = [w[0] for w in wyniki]
    pkt = [w[1] for w in wyniki]
    q = lambda xs, p: sorted(xs)[int(p * (len(xs) - 1))]
    print(f"{nazwa:38s} czas med {statistics.median(czasy):5.0f}s (p10 {q(czasy,.1):4.0f}, p90 {q(czasy,.9):4.0f})"
          f" | wynik med {statistics.median(pkt):4.0f} (p10 {q(pkt,.1):3.0f}, p90 {q(pkt,.9):3.0f})")


if __name__ == "__main__":
    print("Ustawienia jak w main.ts (start 900/1600 ms, -7/-12 ms na kość, min 300/650 ms,"
          f" krok pętli {KROK_PETLI} ms, błysk {BLYSK} ms):")
    raport("  gracz szybki   (reakcja 150, klik 140)", reakcja=150, klik=140, klik_ab=200)
    raport("  gracz średni   (reakcja 250, klik 180)", reakcja=250, klik=180, klik_ab=260)
    raport("  gracz wolny    (reakcja 400, klik 250)", reakcja=400, klik=250, klik_ab=350)
