# Hunyadi művészeti órarend

A Hunyadi Mátyás Általános Iskola délutáni művészeti foglalkozásainak órarendje osztályonként. A szülő kiválasztja az osztályt (pl. 4.a), és látja a hétfő–péntek, 7–10. órás rácsot; egy foglalkozásra koppintva kiemeli azt. Az adatot az iskola egy Google Táblázatban szerkeszti; az oldal ezt olvassa, és ha nem éri el, a repóban tárolt utolsó jó pillanatképet (`data/snapshot.json`) mutatja.

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

A közzétett CSV-k böngészőből való letöltését (CORS) még nem ellenőriztük valódi táblázattal; ez a bekötéskor történik a `scripts/check-cors.html` oldallal. Az eredményt ide írjuk.
