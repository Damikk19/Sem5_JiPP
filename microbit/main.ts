// RAM INVADERS: strzelanka na micro:bita (projekt JiPP)
//
// Z góry spadają kości RAM, a Ty strzelasz do nich ze statku w dolnym rzędzie.
// A = w lewo, B = w prawo, A+B = strzał (na ekranie może być jeden pocisk naraz).
// DDR4 (przygaszona) pada po 1 trafieniu i daje 1 pkt.
// DDR5 (jasna) potrzebuje 2 trafień i daje 3 pkt.
// Kość, która doleci do dolnego rzędu, zabiera życie. Jasność statku = liczba żyć.
// Potrząśnięcie = Garbage Collector: raz na grę czyści z ekranu wszystkie kości.
// Po grze wybierasz nick z 3 liter (przed każdą literą jej numer, A/B zmienia literę, A+B zatwierdza),
// a wynik leci radiem do bramki prowadzącego, która wysyła go do naszego API.

let gracz: game.LedSprite = null
let pocisk: game.LedSprite = null

// Radio: do potwierdzenia z prowadzącym (grupa i identyfikator naszego API w bramce)
let GRUPA_RADIA = 1
let ID_API = "DK"

// Stany gry
let INTRO = 0
let TYTUL = 1
let ODLICZANIE = 2
let GRA = 3
let KONIEC = 4
let WYBOR_NICKU = 5
let WYSYLKA = 6
let stan = INTRO

// Jasność kości RAM pokazuje ich wytrzymałość
let JASNOSC_DDR5 = 200
let JASNOSC_DDR5_USZKODZONA = 90
let JASNOSC_DDR4 = 30

let LITERY = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
// Nick to indeksy liter. Zostaje z poprzedniej gry, żeby ten sam gracz tylko zatwierdzał.
let nick = [0, 0, 0]
let pozycjaNicku = 0
// Litera nicku, która jest teraz na ekranie (-1: jeszcze żadna)
let pokazanaLitera = -1
// Pozycja nicku, której numer był ostatnio pokazany (-1: jeszcze żadna)
let pokazanaPozycja = -1

let ramy: game.LedSprite[] = []
let zycia = 3
let wynik = 0
let tempoSpadania = 900
let tempoPojawiania = 1600
let ostatnieSpadanie = 0
let ostatniePojawienie = 0
let ostatniRuchPocisku = 0
let klatkaTytulu = 0
let gcDostepny = true
let gcTeraz = false

// Ton czekający na wątek dźwięku (tonMs = 0: nic nie czeka)
let tonHz = 0
let tonMs = 0
let melodiaKonca = false

radio.setGroup(GRUPA_RADIA)
radio.setTransmitPower(7)

// ---------- Przyciski ----------

// W trakcie błysku i GC gra stoi, a silnik niczego nie rysuje, więc przyciski w grze nic wtedy nie robią.
// Inaczej strzał mógłby trafić niewidocznie, a statek przeskoczyłby dopiero po wznowieniu.
input.onButtonPressed(Button.A, function () {
    if (stan == TYTUL) {
        stan = ODLICZANIE
    } else if (stan == GRA && !(game.isPaused())) {
        gracz.change(LedSpriteProperty.X, -1)
    } else if (stan == WYBOR_NICKU) {
        nick[pozycjaNicku] = (nick[pozycjaNicku] + 25) % 26
    }
})

input.onButtonPressed(Button.B, function () {
    if (stan == TYTUL) {
        stan = ODLICZANIE
    } else if (stan == GRA && !(game.isPaused())) {
        gracz.change(LedSpriteProperty.X, 1)
    } else if (stan == WYBOR_NICKU) {
        nick[pozycjaNicku] = (nick[pozycjaNicku] + 1) % 26
    }
})

input.onButtonPressed(Button.AB, function () {
    if (stan == TYTUL) {
        stan = ODLICZANIE
    } else if (stan == GRA && !(game.isPaused())) {
        strzel()
    } else if (stan == WYBOR_NICKU) {
        pozycjaNicku += 1
        if (pozycjaNicku >= 3) {
            stan = WYSYLKA
        } else {
            // Następna litera bywa taka sama jak poprzednia, więc przejście słychać (coraz wyższy ton)
            dzwiek(523 + 200 * pozycjaNicku, 60)
        }
    }
})

// Potrząśnięcie odpala Garbage Collector (raz na grę). Samo czyszczenie robi pętla gry.
input.onGesture(Gesture.Shake, function () {
    if (stan == GRA && gcDostepny) {
        gcDostepny = false
        gcTeraz = true
    }
})

// ---------- Rozgrywka ----------

function nowaGra() {
    basic.clearScreen()
    zycia = 3
    wynik = 0
    tempoSpadania = 900
    tempoPojawiania = 1600
    ramy = []
    gcDostepny = true
    gcTeraz = false
    game.resume()
    gracz = game.createSprite(2, 4)
    // Pocisk istnieje od startu, ale jest usunięty: usunięty = nie ma pocisku na ekranie
    pocisk = game.createSprite(2, 3)
    pocisk.delete()
    gracz.set(LedSpriteProperty.Brightness, jasnoscGracza())
    ostatnieSpadanie = input.runningTime()
    ostatniePojawienie = input.runningTime()
    ostatniRuchPocisku = input.runningTime()
}

// Jeden krok gry, wołany w pętli co ok. 36 ms na V1 (ok. 32 ms na V2): pause(10), potem 20 ms przerwy, którą basic.forever
// robi po każdym obiegu, a planista budzi wątek dopiero w swoim takcie (6 ms na V1, 4 ms na V2).
// Każdy element ma własne tempo.
function krokGry() {
    if (gcTeraz) {
        gcTeraz = false
        odpalGC()
    }
    if (!(pocisk.isDeleted()) && input.runningTime() - ostatniRuchPocisku >= 70) {
        ostatniRuchPocisku = input.runningTime()
        ruchPocisku()
    }
    if (input.runningTime() - ostatnieSpadanie >= tempoSpadania) {
        ostatnieSpadanie = input.runningTime()
        spadanie()
    }
    if (input.runningTime() - ostatniePojawienie >= tempoPojawiania) {
        ostatniePojawienie = input.runningTime()
        nowyRam()
    }
    posprzataj()
}

function strzel() {
    // Jeden pocisk naraz, jak na automatach
    if (!(pocisk.isDeleted())) {
        return
    }
    pocisk = game.createSprite(gracz.get(LedSpriteProperty.X), 3)
    ostatniRuchPocisku = input.runningTime()
    dzwiek(880, 40)
    sprawdzTrafienia()
}

function ruchPocisku() {
    if (pocisk.get(LedSpriteProperty.Y) == 0) {
        pocisk.delete()
    } else {
        pocisk.change(LedSpriteProperty.Y, -1)
        sprawdzTrafienia()
    }
}

function spadanie() {
    for (let ram of ramy) {
        if (!(ram.isDeleted())) {
            ram.change(LedSpriteProperty.Y, 1)
            if (ram.get(LedSpriteProperty.Y) == 4) {
                // Kość doleciała do dolnego rzędu
                ram.delete()
                stracZycie()
            }
        }
    }
    sprawdzTrafienia()
}

function nowyRam() {
    let x = randint(0, 4)
    // Nie stawiamy kości na innej kości w górnym rzędzie
    for (let innyRam of ramy) {
        if (!(innyRam.isDeleted()) && innyRam.get(LedSpriteProperty.Y) == 0 && innyRam.get(LedSpriteProperty.X) == x) {
            return
        }
    }
    let nowy = game.createSprite(x, 0)
    // DDR5 pojawia się coraz częściej, maksymalnie w 40% przypadków
    if (randint(0, 99) < Math.min(40, wynik * 2)) {
        nowy.set(LedSpriteProperty.Brightness, JASNOSC_DDR5)
    } else {
        nowy.set(LedSpriteProperty.Brightness, JASNOSC_DDR4)
    }
    ramy.push(nowy)
    // Kość mogła pojawić się dokładnie tam, gdzie leci pocisk
    sprawdzTrafienia()
}

function sprawdzTrafienia() {
    if (pocisk.isDeleted()) {
        return
    }
    for (let cel of ramy) {
        if (!(cel.isDeleted()) && pocisk.isTouching(cel)) {
            pocisk.delete()
            trafienie(cel)
            return
        }
    }
}

function trafienie(trafiony: game.LedSprite) {
    if (trafiony.get(LedSpriteProperty.Brightness) == JASNOSC_DDR5) {
        // Pierwsze trafienie w DDR5 tylko ją uszkadza
        trafiony.set(LedSpriteProperty.Brightness, JASNOSC_DDR5_USZKODZONA)
        dzwiek(330, 40)
        return
    }
    if (trafiony.get(LedSpriteProperty.Brightness) == JASNOSC_DDR5_USZKODZONA) {
        wynik += 3
    } else {
        wynik += 1
    }
    trafiony.delete()
    dzwiek(1320, 40)
    // Z każdą zestrzeloną kością gra przyspiesza (tempo dobrane symulacją: partia trwa ok. minuty)
    tempoSpadania = Math.max(300, tempoSpadania - 7)
    tempoPojawiania = Math.max(650, tempoPojawiania - 12)
}

function stracZycie() {
    zycia -= 1
    blysk()
    dzwiek(131, 150)
    if (zycia <= 0) {
        stan = KONIEC
    } else {
        gracz.set(LedSpriteProperty.Brightness, jasnoscGracza())
    }
}

function jasnoscGracza() {
    if (zycia >= 3) {
        return 255
    }
    if (zycia == 2) {
        return 90
    }
    return 25
}

// Garbage Collector: ekran "skanuje pamięć" od góry do dołu, a potem znikają wszystkie kości.
// Gra na chwilę staje, jak przy prawdziwym GC typu stop-the-world. Punktów za to nie ma.
function odpalGC() {
    game.pause()
    dzwiek(660, 300)
    zapalEkran(160, 60)
    for (let smiec of ramy) {
        smiec.delete()
    }
    pocisk.delete()
    basic.pause(100)
    basic.clearScreen()
    game.resume()
    // Chwila oddechu po czyszczeniu
    ostatniePojawienie = input.runningTime()
    ostatnieSpadanie = input.runningTime()
}

// Krótki błysk całego ekranu, kiedy kość "wycieknie" na dół
function blysk() {
    game.pause()
    zapalEkran(120, 0)
    basic.pause(120)
    basic.clearScreen()
    game.resume()
}

// Zapala cały ekran wiersz po wierszu. Przerwa po każdym wierszu daje efekt skanowania od góry.
function zapalEkran(jasnosc: number, przerwa: number) {
    for (let wiersz = 0; wiersz <= 4; wiersz++) {
        for (let kolumna = 0; kolumna <= 4; kolumna++) {
            led.plotBrightness(kolumna, wiersz, jasnosc)
        }
        if (przerwa > 0) {
            basic.pause(przerwa)
        }
    }
}

// Przewija tekst szybciej niż domyślnie (domyślne "OUT OF MEMORY" trwałoby ok. 12 s)
function przewin(tekst: string) {
    basic.showString(tekst, 80)
}

// Usuwa z listy kości, które zostały zestrzelone albo doleciały na dół
function posprzataj() {
    let zostaja: game.LedSprite[] = []
    for (let kosc of ramy) {
        if (!(kosc.isDeleted())) {
            zostaja.push(kosc)
        }
    }
    ramy = zostaja
}

function koniecGry() {
    for (let pozostaly of ramy) {
        pozostaly.delete()
    }
    ramy = []
    pocisk.delete()
    gracz.delete()
    // Silnik game rysuje duszki co ok. 54 ms: czeka tylko, aż wyświetlacz skończy animację, i rysuje swoje.
    // Bez pauzy zamazałby to, co zostaje na ekranie po animacji: literę nicku, znaczek wysyłki, klatki tytułu.
    game.pause()
    basic.clearScreen()
    // Melodię puści wątek dźwięku (na dole pliku)
    melodiaKonca = true
    przewin("OUT OF MEMORY")
    przewin("" + wynik)
}

// ---------- Nick i wysyłka ----------

// Numer litery (1, 2, 3) przed samą literą, żeby było widać, którą literę nicku się wybiera
function pokazNumerLitery() {
    pokazanaPozycja = pozycjaNicku
    // Po numerze trzeba znowu narysować literę
    pokazanaLitera = -1
    basic.showString("" + (pozycjaNicku + 1), 80)
}

function pokazLitere() {
    pokazanaLitera = nick[pozycjaNicku]
    // Krótki czas wyświetlania, żeby przy szybkim przewijaniu pętla szybko pokazała następną literę
    // (domyślnie jedna litera blokuje 0,75 s)
    basic.showString(LITERY.charAt(pokazanaLitera), 30)
}

function nickJakoTekst() {
    return "" + LITERY.charAt(nick[0]) + LITERY.charAt(nick[1]) + LITERY.charAt(nick[2])
}

// Ramka radiowa: ID_API;NICK;WYNIK, np. DK;ABC;123 (max 19 znaków).
// Bramka prowadzącego zamienia ją na POST { "id": "ABC", "wynik": 123 } do naszego API.
// API przyjmuje wynik 0-99999, więc większego nie wysyłamy (inaczej wynik by przepadł).
function wyslijWynik(nickGracza: string, punkty: number) {
    radio.sendString(ID_API + ";" + nickGracza + ";" + Math.min(punkty, 99999))
}

// ---------- Ekrany ----------

function klatkaRamu() {
    if (klatkaTytulu == 0) {
        basic.showLeds(`
            . . . . .
            # # # # #
            # . # . #
            # # # # #
            . # . # .
            `)
    } else {
        basic.showLeds(`
            . . . . .
            # # # # #
            . # . # .
            # # # # #
            . # . # .
            `)
    }
    klatkaTytulu = 1 - klatkaTytulu
}

// Napisy, litery i animacje rysuje tylko ta pętla, a przyciski tylko zmieniają stan
// (w grze przesuwają duszki, które rysuje silnik game). Dzięki temu animacje nie nachodzą na siebie.
basic.forever(function () {
    if (stan == INTRO) {
        przewin("RAM INVADERS")
        stan = TYTUL
    } else if (stan == TYTUL) {
        klatkaRamu()
    } else if (stan == ODLICZANIE) {
        basic.showNumber(3)
        basic.showNumber(2)
        basic.showNumber(1)
        nowaGra()
        stan = GRA
    } else if (stan == GRA) {
        krokGry()
        // Razem z przerwą basic.forever krok wypada co ok. 36 ms na V1, 32 ms na V2 (opis przy krokGry)
        basic.pause(10)
    } else if (stan == KONIEC) {
        koniecGry()
        pozycjaNicku = 0
        przewin("NICK")
        // Numer i pierwszą literę narysuje gałąź wyboru nicku
        pokazanaPozycja = -1
        pokazanaLitera = -1
        stan = WYBOR_NICKU
    } else if (stan == WYBOR_NICKU) {
        // Przyciski zmieniają tylko nick, a rysujemy tu: po zmianie pozycji jej numer, potem literę, kiedy się zmieni.
        // Najwyżej jedno rysowanie na obieg, bo w jego trakcie A+B może zatwierdzić ostatnią literę (wtedy stan to już WYSYLKA).
        if (pozycjaNicku != pokazanaPozycja) {
            pokazNumerLitery()
        } else if (nick[pozycjaNicku] != pokazanaLitera) {
            pokazLitere()
        }
    } else if (stan == WYSYLKA) {
        wyslijWynik(nickJakoTekst(), wynik)
        basic.showIcon(IconNames.Yes)
        basic.pause(500)
        przewin(nickJakoTekst() + " " + wynik)
        stan = TYTUL
    }
})

// ---------- Dźwięk ----------

// Dźwięki gra jeden wątek na całą grę: dzwiek() tylko zapisuje ton, a gra go pętla niżej
// (gdy nic nie gra, najpóźniej po ok. 24 ms). Każdy ton gra do końca, więc strzał nie ucina
// dźwięku utraty życia, a gra nie tworzy nowego wątku przy każdym dźwięku (na V1 jest mało pamięci).
function dzwiek(czestotliwosc: number, czas: number) {
    // Dłuższy dźwięk (utrata życia, GC) jest ważniejszy, więc krótszy go nie zastępuje
    if (czas >= tonMs) {
        tonHz = czestotliwosc
        tonMs = czas
    }
}

basic.forever(function () {
    if (tonMs > 0) {
        let dlugosc = tonMs
        tonMs = 0
        music.playTone(tonHz, dlugosc)
    } else if (melodiaKonca) {
        // Melodia końca gry: te same nuty co wbudowana "wawawawaa" (E, D#, D, Cis). Wbudowane melodie
        // wciągają cały silnik melodii, a z nim gra nie mieści się na micro:bicie V1.
        melodiaKonca = false
        music.playTone(330, 375)
        basic.pause(125)
        music.playTone(311, 375)
        basic.pause(125)
        music.playTone(294, 500)
        basic.pause(125)
        music.playTone(277, 1000)
    }
})
