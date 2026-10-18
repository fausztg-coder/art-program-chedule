# Hunyadi művészeti órarend

A Hunyadi Mátyás Általános Iskola délutáni művészeti foglalkozásainak heti órarendje. A szülő kiválaszt egy osztályt (vagy az „Összes”-t) és egy vagy több tanszakot, és napok szerint csoportosított listában látja az órákat; egy osztály listáját a böngésző nyomtatásával A4-es PDF-be mentheti. Az adatot az iskola egy Google Táblázatban szerkeszti; az oldal ezt olvassa, és ha nem éri el, a repóban tárolt utolsó jó pillanatképet (`data/snapshot.json`) mutatja.

## Táblázat bekötése

1. A `data/template/hunyadi-orarend-adatforras.xlsx` fájlt töltsd fel a Google Drive-ra, nyisd meg, és mentsd Google Táblázatként (Fájl → Mentés Google Táblázatként).
2. Fájl → Megosztás → Közzététel az interneten → Teljes dokumentum, formátum: CSV → Közzététel.
3. A kapott link `/d/e/…/pub` közötti azonosítója a `PUB_ID` (`2PACX-…`); a fülek `gid=` számát fülenként a böngésző címsorából olvasd ki.
4. Szerkesztési jogot csak az kapjon, aki frissíti az órarendet. A közzétett CSV bárki számára olvasható: személyes adat ne kerüljön bele.
5. Ha a Közzététel menüpont tiltott, az iskolai rendszergazda letiltotta: kérd meg, vagy vezesd a táblát magánfiókban.

Ezután a `config.js`-ben töltsd ki a `PUB_ID`-t és a `GIDS` öt értékét (`foglalkozasok`, `foglalkozastipusok`, `osztalyok`, `orak`, `beallitasok`), és commitold a `main` ágra. Amíg bármelyik üres, az oldal csak a pillanatképet mutatja.

## Közzététel (GitHub Pages)

- Egyszeri beállítás: Settings → Pages → Source: **GitHub Actions**.
- A `.github/workflows/pages.yml` minden `main`-re pusholáskor tesztel és telepít. Éjjelente (és kézzel: Actions → Pages → Run workflow) frissíti a pillanatképet a táblázatból; hibás táblázatnál nem ír semmit, és a telepítés a régi pillanatképpel megy tovább.
- A GitHub 60 nap repó-aktivitás nélkül kikapcsolja az ütemezett futást. Ilyenkor az Actions fülön kapcsold vissza a workflow-t.

## Helyi futtatás

```bash
node --test                                        # tesztek, hálózat nélkül
python3 -m http.server 8000                        # majd: http://localhost:8000/?forras=minta
node scripts/snapshot.mjs --from-dir data/sample   # pillanatkép a mintaadatból
node scripts/snapshot.mjs --check                  # az élő táblázat ellenőrzése, írás nélkül
```

A `?forras=minta` a `data/sample/` CSV-it a teljes élő feldolgozáson futtatja; a telepített oldalon ezek nincsenek fent.

## CORS

A közzétett CSV-ket a böngésző közvetlenül tölti le a Google-tól (CORS). Ezt az élesítés után, 2026-09-26-án a megrendelő az élő oldalon ellenőrizte: az oldal működik, a táblázatból olvas. Ha egyszer mégsem sikerülne, az oldal a pillanatképre vált, és sárga sávban jelzi: „Az órarend nem frissült, a {dátum} állapotot látod.” Kézzel a `scripts/check-cors.html` oldallal lehet újra ellenőrizni.

## Mi hol van

| Fájl | Szerep |
| --- | --- |
| `index.html`, `css/tokens.css`, `css/app.css` | a képernyős oldal (SPEC 4.) |
| `css/print.css`, `src/print-view.js` | a PDF-oldal (SPEC 6.) |
| `src/csv.js`, `src/model.js` | CSV-elemzés, validálás, célzás, színek |
| `src/state.js` | választás, szűrés, cím, Választható, URL, nyomtatási rács, szótagolás (tiszta függvények) |
| `src/load.js` | letöltés, időkorlát, tartalék a pillanatképre |
| `src/render.js`, `src/main.js`, `src/dom.js` | DOM és eseménykezelés |
| `scripts/snapshot.mjs` | az éjszakai pillanatkép (ugyanazzal a validálóval) |
| `docs/manual-checks.md` | kézi ellenőrzőlista négy böngészőre |
| `docs/elfogadas.md` | a SPEC 8. szakaszának elfogadási pontjai és ellenőrzésük |
| `docs/kezikonyv.md`, `docs/kezikonyv.pdf` | rövid használati útmutató a szülőknek (a PDF továbbküldhető) |

## Tudnivalók a tábla szerkesztőjének

- A tábla nyilvános: tanárnévből csak keresztnév kerüljön bele (SPEC 2.1).
- Egy átírás kb. 5–10 perc múlva látszik az oldalon (a Google gyorsítótára miatt), újratöltés után; deploy nem kell.
- A hibás sor kimarad, és az oldal alján az „Adathibák” panel mutatja a táblázatbeli sorszámmal. Ellentmondásos, de érvényes sornál a „Bizonytalan = igen” jelölést használd, a Megjegyzésbe írd az okát.
