# Elfogadási lista (SPEC 1.1/1.2, 8. szakasz)

Minden pont mellett: mi ellenőrzi, és hol tart. **Autom.** = `node --test` (a fájl a `tests/` mappában), **Kézi** = `docs/manual-checks.md` szakasza. A böngészős ellenőrzéseket a fejlesztés során Chromiumban lefuttattuk (asztali és mobil szélességen); a négy böngészős kézi kört a megrendelő végzi.

Állapot: az 1–18. pont 2026-09-26, élesítés után (`main` 9197cbd); a 19–24. pont (1.2, több gyerek) 2026-10-18, a `claude/spec-1.2-tobb-gyerek` ágon, még nem élesben.

| # | Kritérium (röviden) | Autom. | Kézi | Állapot |
| --- | --- | --- | --- | --- |
| 1 | Betöltéskor „Összes” / „Összes”, minden óra, PDF-gomb letiltva magyarázattal | `selection.test.mjs`: Összes osztály + Összes tanszak; `state.test.mjs`: start state | A | ✔ |
| 2 | Osztálychip egyszeres, tanszakchip kapcsoló, `aria-pressed`; „Összes” törli | `selection.test.mjs`: clicks | B, C, H | ✔ |
| 3 | Lista, cím, darabszám az 5.2–5.3 szerint; évfolyam minden osztálynak, osztálysor csak annak | `selection.test.mjs`: criteria 3–4, title, count; `model.test.mjs`: targeting | D | ✔ |
| 4 | m osztálynak szóló óra csak az m osztálynál | `model.test.mjs`: targeting (7.m); `selection.test.mjs` | D | ✔ |
| 5 | Osztályváltáskor a tanszak-kijelölés marad | `selection.test.mjs`: clicks | B | ✔ |
| 6 | `?o=3.b&f=balett,keramia` visszaállít; ismeretlen kulcs nem hiba | `selection.test.mjs`: URL round trip, unknown | E | ✔ |
| 7 | Választható címke; bizonytalan sor jelölve képernyőn és PDF-ben, billentyűzettel elérhető | `selection.test.mjs`: Választható; `print.test.mjs`: overlaps, uncertain | F, J13–J14 | ✔ (Chromium); Safari/iOS kézi |
| 8 | Mobilon évfolyamonkénti osztálysorok, „Összes” legfelül; asztalin egy sor | `state.test.mjs`: mobile class rows | B | ✔ |
| 9 | PDF: nyomtatási párbeszéd, egy A4 fekvő oldal, 6.4 elrendezés, kijelölhető szöveg, cím, szürkeárnyalat | `print.test.mjs`: rács, cím | J1–J19 | ✔ Chromiumban (mind a 18 osztály egy oldal) |
| 10 | 9. pont négy böngészőben; Ctrl+P is | – | J (négy böngésző) | ⏳ asztali Chrome ✔ (megrendelő), többi kézi |
| 11 | Megjelenés 4.1–4.5 szerint, nincs átfedés, 768–1023 px asztali elrendezés görgetés nélkül | `static.test.mjs`: tokenek | G | ✔ |
| 12 | 7. szakasz (akadálymentesség) | `static.test.mjs`: `lang`, szövegek | H | ✔ (axe 0 hiba, Lighthouse 100); képernyőolvasó kézi |
| 13 | Sheet-módosítás 10 percen belül látszik deploy nélkül | `load.test.mjs`: élő mód | I (Közlemény) | ✔ a megrendelő szerint az oldal a táblából olvas |
| 14 | Hibás sor kimarad, Adathibák panel sorszámmal | `model.test.mjs`: err.*; row numbers | I1 | ✔ |
| 15 | Google nem elérhető → snapshot, dátummal | `load.test.mjs`: falls back … | I2–I3 | ✔ |
| 16 | Snapshot-Action érvénytelen adatnál nem commitol | `snapshot.test.mjs`: broken header, sanity guard | – | ✔ |
| 17 | Nincs npm-függőség, nincs build; Pages deploy a `main`-ről | `static.test.mjs`: deploy-lefedettség | – | ✔ (az élesítés így ment ki) |
| 18 | A „Nincs benne” listából semmi | – | K | ✔ |
| 19 | Gyerek hozzáadása és törlése, 1–4 gyerek; 4-nél a gomb letiltva magyarázattal; 1-nél nincs törlés | `children.test.mjs`: add, remove | L1–L5 | ✔ Chromiumban; Safari/iOS/Android kézi |
| 20 | A választók az aktív gyereket szerkesztik; váltáskor a többiek választása marad | `children.test.mjs`: selectors change only the active child | L3 | ✔ Chromiumban; Safari/iOS/Android kézi |
| 21 | 1 gyereknél az 1.1 nézet; 2–4 gyereknél kártyák egymás alatt, saját Választható-jelöléssel | `selection.test.mjs` (gyerekenként ugyanaz a logika); `static.test.mjs`: feliratok | L6–L8 | ✔ Chromiumban (320–1440 px, axe 0 hiba); Safari/iOS/Android kézi |
| 22 | Keresztnév: nem kötelező, ≤ 20 karakter, csak `localStorage`, URL-be nem kerül; üresen „{n}. gyerek” | `children.test.mjs`: name, label, URL | L9–L11 | ✔ Chromiumban; Safari/iOS/Android kézi |
| 23 | A `?o=3.b&f=balett&gy=2&o2=5.a&f2=keramia` link visszaállít; az 1.1-es link 1 gyerek; hibás `gy` nem hiba | `children.test.mjs`: URL | L12–L13, E7 | ✔ Chromiumban; másik böngészőben kézi |
| 24 | PDF 2–4 gyereknél: csak ha minden gyereknek van osztálya; egy dokumentum, két gyerek oldalanként tömör listával; 9–10. pont erre is | `print.test.mjs`: compact list; `children.test.mjs`: pages | L16–L24 | ✔ Chromiumban (valódi PDF: 2/3/4 gyerek → 1/2/2 oldal, Letteren is; 0 levágás; tartalékszabály); ⏳ Safari/iOS/Android kézi |

## Nyitott tételek

- **10. pont:** asztali Safari, iOS Safari és Androidos Chrome nyomtatása (`docs/manual-checks.md` J). Innen nem tesztelhető.
- **24. pont:** a több gyerekes PDF asztali Safariban, iOS Safariban és Androidos Chrome-ban (`docs/manual-checks.md` L16–L24), különösen a többoldalas mentés iPhone-on.
- **Ismert korlát (24. pont):** napi kb. 12-nél több foglalkozásnál egy blokk egész oldalon sem fér el (`docs/manual-checks.md` L vége).
- **Adatvédelem (SPEC 2.1):** a Sheetben jelenleg teljes tanárnevek vannak; az iskolának keresztnévre kell javítania. Az oldal kódja nem módosítja az adatot.

## A megrendelő döntései a SPEC-hez képest (2026-09-26, a `SPEC.md`-ben rögzítve)

- PDF: az átfedő órák egymás mellett, közös „VÁLASZTHATÓ” felirattal; a keskeny kártyán nincs időpont, a hosszú szó szótaghatáron törik.
- Fejlécdísz: a korong ott tolódik el, ahol a szövegre lógna.
- Osztály oszlop: asztalin 150 px, táblagépen 80 px.

## A megrendelő döntései (2026-10-18, a `SPEC.md` 1.2-es részében rögzítve)

- Több gyerek: legfeljebb 4, gyerekenként saját osztály és tanszak; a képernyőn a gyerekek kártyái egymás alatt; időütközés-jelzés továbbra sincs.
- Keresztnév: nem kötelező, csak a böngészőben tárolódik; a mező csak 2 vagy több gyereknél látszik.
- URL: a nem egész `gy` hiányzónak számít (a gyerekszám a legnagyobb jelen lévő sorszám).
- PDF több gyereknél: két gyerek oldalanként, tömör listával. A 6.4 rácsa fél oldalon nem fér el (5 órasorral kb. 45 px/sor; a 112 kártyából 50 levágódna); a tömör listában mind a 18 osztály elfér (a legszorosabb az 1.a, a hely kb. 90%-ával).
