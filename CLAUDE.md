# CLAUDE.md – Művészeti órarend-kereső 1.1

## Mi ez

Statikus weboldal a Hunyadi Mátyás Általános Iskola (Budapest XIII.) délutáni művészeti foglalkozásaihoz. A szülő kiválaszt egy osztályt és egy vagy több tanszakot, listában látja a heti órákat, és A4 fekvő PDF-be mentheti őket a böngésző nyomtatásával. Az adat az iskola Google Táblázatából jön, közzétett CSV-ként.

**A teljes, kötelező specifikáció a `SPEC.md`.** Minden munka előtt olvasd el. Ha ez a fájl és a `SPEC.md` ütközik, a `SPEC.md` az irányadó.

## Első lépés minden munkamenetben

1. Olvasd el a `SPEC.md`-t, és nézd meg a repó állapotát (`git log`, fájlok).
2. **Ha van már 1.0 kód:** arra építs. Tartsd meg a szerkezetét, a CSV-elemzést, a validálást, a snapshot-mechanizmust és a workflow-kat. Az 1.1 a felületet cseréli (heti rács → lista, új dizájn), és két funkciót ad hozzá. Az 1.0 viselkedései közül ami a `SPEC.md`-ben szerepel, maradjon meg.
3. **Ha nincs kód:** a `SPEC.md` 11. szakasza szerinti szerkezettel indulj, a 12. szakasz mérföldkövei szerint.
4. Mielőtt kódolsz, írj rövid tervet (melyik mérföldkő, mely fájlok, milyen tesztek), és várd meg a jóváhagyást.

## Kemény szabályok

- **Nincs npm-függőség, nincs build lépés, nincs bundler, nincs framework.** Natív HTML, CSS, ES modulok. Ne hozz létre `package.json`-t függőségekkel. Ha a tesztekhez vagy a scripthez `package.json` kell, csak `"type": "module"` és `scripts` lehet benne, `dependencies` és `devDependencies` nem.
- **Nincs PDF-könyvtár** (jsPDF, pdfmake, html2canvas stb.). A PDF a `window.print()` és egy `@media print` stíluslap eredménye.
- **Nincs külső hálózati kérés** a Google Sheets CSV-n és a Google Fonts-on kívül. Nincs analitika, nincs CDN-es script.
- **Csak a `SPEC.md`-ben szereplő funkciók.** Ne adj hozzá a 1. szakasz „Nincs benne” listájáról semmit (több gyerek, időütközés, naptár, sötét mód, tanári nézet stb.), akkor sem, ha kézenfekvőnek tűnik. Ha valami hiányzik a specifikációból, kérdezz, ne találd ki.
- **Az adatot ne javítsd csendben.** Érvénytelen sor → Adathibák panel. Ellentmondásos, de érvényes sor → `Bizonytalan = igen` a Sheetben, az oldal jelöli.
- **A `docs/design/*.dc.html` mintaadatai nem igazak** (1.m–8.m, hét tanszak, 12:50-es kezdés, teljes tanárnevek). Csak a méreteket, színeket és elrendezést vedd át belőlük.
- Minden UI-szöveg magyar, a `SPEC.md`-ben idézett pontos felirattal. Ne fordítsd, ne fogalmazd át.
- Tanárnévből csak keresztnév jelenhet meg, ahogy a Sheet tartalmazza.

## Logika, amit könnyű elrontani

- **Célzás (SPEC 3.3):** a Célcsoport `6` eleme a 6.a-nak, 6.b-nek **és 6.m-nek** is szól. A `7.m` elem **csak** a 7.m-nek. Egy adatsor a listában egyszer jelenik meg, akkor is, ha több osztálynak szól.
- **Választható (SPEC 4.6):** csak kiválasztott osztálynál, a tanszakszűrés utáni listán, (nap, óra) idősávonként.
- **„Összes” osztály:** a PDF-gomb le van tiltva; Választható-jelölés nincs.
- **Tanszakchipek:** mindig a teljes Foglalkozástípusok lista, a fül sorrendjében; osztályváltáskor a kijelölés megmarad.
- **Mobil osztályválasztó:** évfolyamonként tagolt sorok, az „Összes” legfelül (a `mobil.dc.html` ezt még nem mutatja – a `SPEC.md` az irányadó).
- **URL-kulcsok:** slug, ékezet nélkül (SPEC 3.5). Ha az 1.0 kódban már van kulcsképzés, azt tartsd meg.
- **Nyomtatás:** `beforeprint`-en is renderelj, mert a felhasználó Ctrl+P-vel is nyomtathat.

## Kódstílus

- A logika tiszta, DOM nélküli függvényekben legyen (`js/model.js`, `js/data.js`), hogy `node --test`-tel tesztelhető legyen. A `scripts/snapshot.mjs` ugyanezt a validálót használja.
- A színek és méretek CSS változók (`css/tokens.css`), a `SPEC.md` 4.2 tokenneveivel.
- A DOM-ot biztonságosan építsd: a Sheetből jövő szöveg `textContent`-tel kerüljön a lapra, soha `innerHTML`-lel.
- `localStorage` csak `try/catch`-ben; ha nem elérhető, az oldal működjön nélküle.
- Magyar kommentek elfogadottak, az azonosítók angolul.

## Tesztelés

- `node --test tests/` – az elfogadási kritériumok logikai részei (SPEC 8.): célzás (`6` → 6.m igen, `7.m` → 7.a nem, `3.b` → 3.a nem), szűrés, cím 0/1/3/4 tanszaknál és „Összes” osztálynál, darabszám, Választható, slug, URL oda-vissza, tanév-rag, CSV-validálás hibás sorokkal.
- A vizuális és nyomtatási kritériumokat írd le a `docs/manual-checks.md`-ben lépésenként, ellenőrzőlistaként (asztali Chrome, asztali Safari, iOS Safari, Androidos Chrome; 390 px, 800 px, 1440 px szélesség; szürkeárnyalatos nyomtatás; csak billentyűzettel kezelés).
- Helyi futtatás: `python3 -m http.server 8000` a repó gyökerében (ES modulokhoz szerver kell, `file://` nem elég).

## Munkamenet

- Mérföldkövenként haladj (SPEC 12.), mindegyik végén: tesztek zöldek, rövid összefoglaló arról, mi készült el és melyik elfogadási pont teljesül, majd commit.
- Kis, beszédes commitok magyarul vagy angolul, pl. `feat: többes tanszakválasztás`.
- Ha egy döntés nincs a `SPEC.md`-ben, és nem triviális, állj meg és kérdezz. A `SPEC.md` 13. szakaszának nyitott pontjainál a javasolt alapértelmezést használd, és jelezd, hogy azt használtad.
- A `config.js` titkot nem tartalmaz (a közzétett CSV nyilvános), de a `PUB_ID`-t csak a megrendelő adja meg; ne találj ki értéket.
