// RAM ATAK: strzelanka na micro:bita (projekt JiPP)
//
// Z góry spadają kości RAM, a Ty strzelasz do nich ze statku w dolnym rzędzie.
// A = w lewo, B = w prawo, A+B = strzał (na ekranie może być jeden pocisk naraz).
// DDR4 (przygaszona) pada po 1 trafieniu i daje 1 pkt.
// DDR5 (jasna) potrzebuje 2 trafień i daje 3 pkt.
// Kość, która doleci do dolnego rzędu, zabiera życie. Jasność statku = liczba żyć.
// Po grze wybierasz nick z 3 liter (A/B zmienia literę, A+B zatwierdza),
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

let ramy: game.LedSprite[] = []
let zycia = 3
let wynik = 0
let tempoSpadania = 800
let tempoPojawiania = 1400
let ostatnieSpadanie = 0
let ostatniePojawienie = 0
let ostatniRuchPocisku = 0
let klatkaTytulu = 0

radio.setGroup(GRUPA_RADIA)
radio.setTransmitPower(7)

// ---------- Przyciski ----------

input.onButtonPressed(Button.A, function () {
    if (stan == TYTUL) {
        stan = ODLICZANIE
    } else if (stan == GRA) {
        gracz.change(LedSpriteProperty.X, -1)
    } else if (stan == WYBOR_NICKU) {
        nick[pozycjaNicku] = (nick[pozycjaNicku] + 25) % 26
        pokazLitere()
    }
})

input.onButtonPressed(Button.B, function () {
    if (stan == TYTUL) {
        stan = ODLICZANIE
    } else if (stan == GRA) {
        gracz.change(LedSpriteProperty.X, 1)
    } else if (stan == WYBOR_NICKU) {
        nick[pozycjaNicku] = (nick[pozycjaNicku] + 1) % 26
        pokazLitere()
    }
})

input.onButtonPressed(Button.AB, function () {
    if (stan == TYTUL) {
        stan = ODLICZANIE
    } else if (stan == GRA) {
        strzel()
    } else if (stan == WYBOR_NICKU) {
        pozycjaNicku += 1
        if (pozycjaNicku >= 3) {
            stan = WYSYLKA
        } else {
            pokazLitere()
        }
    }
})

// ---------- Rozgrywka ----------

function nowaGra() {
    basic.clearScreen()
    zycia = 3
    wynik = 0
    tempoSpadania = 800
    tempoPojawiania = 1400
    ramy = []
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

// Jeden krok gry, wołany w pętli co ~10 ms. Każdy element ma własne tempo.
function krokGry() {
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
    pocisk.set(LedSpriteProperty.Brightness, 255)
    ostatniRuchPocisku = input.runningTime()
    music.play(music.tonePlayable(880, music.beat(BeatFraction.Sixteenth)), music.PlaybackMode.InBackground)
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
    for (let ram2 of ramy) {
        if (!(ram2.isDeleted()) && ram2.get(LedSpriteProperty.Y) == 0 && ram2.get(LedSpriteProperty.X) == x) {
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
}

function sprawdzTrafienia() {
    if (pocisk.isDeleted()) {
        return
    }
    for (let ram3 of ramy) {
        if (!(ram3.isDeleted()) && pocisk.isTouching(ram3)) {
            pocisk.delete()
            trafienie(ram3)
            return
        }
    }
}

function trafienie(ram4: game.LedSprite) {
    if (ram4.get(LedSpriteProperty.Brightness) == JASNOSC_DDR5) {
        // Pierwsze trafienie w DDR5 tylko ją uszkadza
        ram4.set(LedSpriteProperty.Brightness, JASNOSC_DDR5_USZKODZONA)
        music.play(music.tonePlayable(330, music.beat(BeatFraction.Sixteenth)), music.PlaybackMode.InBackground)
        return
    }
    if (ram4.get(LedSpriteProperty.Brightness) == JASNOSC_DDR5_USZKODZONA) {
        wynik += 3
    } else {
        wynik += 1
    }
    ram4.delete()
    music.play(music.tonePlayable(1320, music.beat(BeatFraction.Sixteenth)), music.PlaybackMode.InBackground)
    // Z każdą zestrzeloną kością gra przyspiesza
    tempoSpadania = Math.max(250, tempoSpadania - 12)
    tempoPojawiania = Math.max(500, tempoPojawiania - 20)
}

function stracZycie() {
    zycia += -1
    music.play(music.tonePlayable(131, music.beat(BeatFraction.Quarter)), music.PlaybackMode.InBackground)
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

// Usuwa z listy kości, które zostały zestrzelone albo doleciały na dół
function posprzataj() {
    let zostaja: game.LedSprite[] = []
    for (let ram5 of ramy) {
        if (!(ram5.isDeleted())) {
            zostaja.push(ram5)
        }
    }
    ramy = zostaja
}

function koniecGry() {
    for (let ram6 of ramy) {
        ram6.delete()
    }
    ramy = []
    pocisk.delete()
    gracz.delete()
    // Silnik gier odświeża ekran co 30 ms, więc wstrzymujemy go, żeby nie zamazał napisów
    game.pause()
    basic.clearScreen()
    music.play(music.builtInPlayableMelody(Melodies.Wawawawaa), music.PlaybackMode.InBackground)
    basic.showIcon(IconNames.Sad)
    basic.pause(600)
    basic.showString("" + wynik)
}

// ---------- Nick i wysyłka ----------

function pokazLitere() {
    // Krótki czas wyświetlania, żeby szybko przewijać litery (domyślnie jedna litera blokuje 0,75 s)
    basic.showString(LITERY.charAt(nick[pozycjaNicku]), 30)
}

function nickJakoTekst() {
    return "" + LITERY.charAt(nick[0]) + LITERY.charAt(nick[1]) + LITERY.charAt(nick[2])
}

// Ramka radiowa: ID_API;NICK;WYNIK, np. DK;ABC;123 (max 19 znaków).
// Bramka prowadzącego zamienia ją na POST { "id": "ABC", "wynik": 123 } do naszego API.
function wyslijWynik(gracz2: string, punkty: number) {
    radio.sendString(ID_API + ";" + gracz2 + ";" + punkty)
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

// Cały ekran rysuje ta jedna pętla, a przyciski tylko zmieniają stan.
// Dzięki temu animacje nie nachodzą na siebie.
basic.forever(function () {
    if (stan == INTRO) {
        basic.showString("RAM ATAK")
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
        basic.pause(10)
    } else if (stan == KONIEC) {
        koniecGry()
        pozycjaNicku = 0
        basic.showString("NICK")
        stan = WYBOR_NICKU
        pokazLitere()
    } else if (stan == WYSYLKA) {
        wyslijWynik(nickJakoTekst(), wynik)
        basic.showIcon(IconNames.Yes)
        basic.pause(500)
        basic.showString(nickJakoTekst() + " " + wynik)
        stan = TYTUL
    } else {
        basic.pause(50)
    }
})
