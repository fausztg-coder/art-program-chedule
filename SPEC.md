# Művészeti órarend-kereső – 1.1 specifikáció

Verzió: 1.1 · 2026-09-26 · Hunyadi Mátyás Általános Iskola (Budapest XIII.), délutáni művészeti foglalkozások

Ez a fájl önmagában teljes. A forrásdokumentumok (1.0 specifikáció, dizájnspecifikáció, 1.1 specifikáció, v3 dizájn canvas) claude.ai-on élnek; minden, ami a fejlesztéshez kell, ide van átemelve. A vizuális referencia a `docs/design/` mappa három `.dc.html` fájlja (lásd 9. szakasz).

---

## 1. Cél és hatókör

Statikus, mobilon is jól használható oldal, amelyen a szülő kiválaszt egy osztályt és egy vagy több tanszakot, listában látja a hozzájuk tartozó heti délutáni művészeti foglalkozásokat, és a választást A4 fekvő PDF-be mentheti.

**Új az 1.0-hoz képest (csak ez a két funkció):**

1. Több tanszak kiválasztása egyszerre.
2. PDF-export a böngésző beépített nyomtatásával.

**Az új dizájnnal együtt érkezik:** új megjelenés (bordó–arany, krém alapszínek), eredménylista a heti rács helyett, „Összes” osztály nézet (minden osztály órái egy listában, ez a betöltési alapállapot).

**Nincs benne:**

- navigációs menü, eseménynaptár, hírek, kapcsolat oldal, oldalsó/alsó lábléc-menü, belépés, jelentkezés;
- több gyerek (gyerekprofilok, családi nézet), időütközés-jelzés, naptár-feliratkozás (.ics);
- tanári és teremnézet;
- sötét mód (a dizájn nem tartalmaz sötét tokeneket; lásd 13. szakasz);
- PDF-könyvtár (pl. jsPDF), bármilyen npm-függőség, build lépés.

**Nem cél** a forrástábla hibáinak csendes kijavítása. Ellentmondásos adat bizonytalanként jelenik meg.

---

## 2. Technikai keret (változatlan az 1.0-hoz képest)

- Statikus oldal GitHub Pages-en, **build lépés nélkül**: HTML, CSS, natív ES modulok. **Nincs npm-függőség.** Tesztekhez a Node beépített tesztfuttatója (`node --test`) használható, függőség nélkül.
- Az adat egy Google Táblázatból jön, amelyet az iskola szerkeszt és CSV-ként tesz közzé. Az oldal betöltéskor élőben olvassa.
- Tartalék: a repóban tárolt `data/snapshot.json`. Egy napi GitHub Action frissíti.
- Konfiguráció: egyetlen `config.js` (`PUB_ID` és fülenkénti `GID`). Kitöltetlen konfigurációnál az oldal a snapshotból fut, így a fejlesztés a Sheet nélkül is elkezdhető.
- Deploy: `main` ágra push után GitHub Actions workflow publikál GitHub Pages-re. A két workflow (deploy és napi snapshot) a repó része.

### 2.1 Betöltés és tartalék

1. **Betöltés:** párhuzamosan lekéri az öt fül CSV-jét (`https://docs.google.com/spreadsheets/d/e/<PUB_ID>/pub?gid=<GID>&single=true&output=csv`), fülenként 8 másodperces időkorláttal.
2. **Feldolgozás:** CSV-elemzés, fejlécfelismerés, soronkénti validálás (3.4), időrácsra bontás, renderelés.
3. **Tartalék:** ha a hálózat, az időkorlát, egy hiányzó fül vagy kötelező fejléc miatt nincs érvényes adat, az oldal a `data/snapshot.json` alapján renderel, és sávban kiírja: „Az órarend nem frissült, a {dátum} állapotot látod.”
4. **Pillanatkép-frissítés:** ütemezett GitHub Action naponta letölti a CSV-ket, **ugyanazzal a kóddal** validál, és csak akkor commitol, ha az adat érvényes és változott. Érvénytelen adatnál nem commitol, hanem hibával leáll.

**Késleltetés:** a Google a közzétett CSV-t kb. 5 percig gyorsítótárazza, egy szerkesztés 5–10 perc múlva látszik.

**Technikai kockázat:** a közzétett Google-CSV böngészőből (CORS) általában olvasható, de ezt az első mérföldkőben valódi közzétett táblával ellenőrizni kell. Ha nem működik: `gviz/tq?tqx=out:csv` végpont, vagy csak snapshotos üzem óránkénti Actionnel.

**Adatvédelem:** a közzétett CSV nyilvános. Csak tanári keresztnevek és teremnevek szerepelhetnek benne. A tábla tulajdonosa és szerkesztője az iskola; a repo karbantartója a kódért és a `config.js`-ért felel, az adatért nem.

---

## 3. Adatmodell

### 3.1 A Google Táblázat fülei

A fülek neve és a fejlécek szövege rögzített (az oldal ez alapján ismeri fel őket). Az oszlopok sorrendje szabad, ismeretlen oszlopokat az oldal figyelmen kívül hagy.

| Fül | Egy sor | Oszlopok (a fejléc pontos szövege) | Kötelező |
| --- | --- | --- | --- |
| Foglalkozások | egy foglalkozás egy napon, egy összefüggő óratartományban | Nap, Első óra, Utolsó óra, Foglalkozás, Tanár, Terem, Célcsoport, Bizonytalan, Megjegyzés, Megjelenik | Nap, Első óra, Utolsó óra, Foglalkozás, Célcsoport |
| Foglalkozástípusok | egy foglalkozásnév | Foglalkozás, Szín | Foglalkozás |
| Osztályok | egy osztály | Osztály | Osztály |
| Órák | egy óra | Óra, Kezdés, Vége | mind |
| Beállítások | kulcs–érték pár | Kulcs, Érték (kulcsok: Tanév, Iskola, Hibabejelentés, Közlemény) | – |

Példasor a Foglalkozások fülön: `Kedd · 7 · 8 · Képzőművészet · Lotti · rajzstúdió · 3.b · nem · · igen`. A dupla óra egy sor.

### 3.2 Osztálylista

Az Osztályok fül tartalmazza, **a fül sorrendjében** jelenik meg. Jelenleg 18 osztály:

`1.a · 1.b · 2.a · 3.a · 3.b · 4.a · 4.b · 5.a · 5.b · 6.a · 6.b · 6.m · 7.a · 7.b · 7.m · 8.a · 8.b · 8.m`

A 2. évfolyamon csak a osztály van, a 6–8. évfolyamon m osztály is. Az évfolyam az osztálynév pont előtti száma.

### 3.3 Célzás (melyik óra melyik osztálynál látszik)

A Célcsoport vesszővel elválasztott lista. Egy elem:

- **évfolyam:** egy szám (`5`) – az évfolyam **minden** osztályának szól, **az m osztálynak is** (pl. `6` → 6.a, 6.b, 6.m);
- **osztály:** osztálynév (`3.a`, `6.m`) – csak annak az osztálynak szól.

Ebből következik, és elfogadási kritérium: **m osztálynak szóló óra (pl. `7.m`) kizárólag az m osztálynál jelenik meg**, az a és b osztálynál nem.

Normalizálás: szóközök levágása; a régi táblából örökölt záró pont elfogadott (`7.m.` = `7.m`). Az `5.-6.` vagy `4.evf` jellegű régi írásmódot a tábla már nem használja; ha mégis előfordul, a sor érvénytelen (3.4).

Egy osztályt egy sor akkor érint, ha a Célcsoportban szerepel az osztály évfolyama vagy maga az osztály.

### 3.4 Érvényesség, bizonytalanság, megjelenés

Egy sor kimarad, és bekerül az „Adathibák” panelbe (táblázatbeli sorszámmal és okkal), ha:

- a Nap nem hétfő és péntek közötti nap;
- az Első vagy az Utolsó óra nincs az Órák fülön, vagy az Utolsó óra korábbi az Elsőnél;
- a Foglalkozás nincs a Foglalkozástípusok között;
- a Célcsoport üres, vagy valamelyik eleme nem létező évfolyamra vagy osztályra mutat.

Ha egy fül vagy kötelező fejléc hiányzik, az egész adat érvénytelen, és az oldal a snapshotra vált.

- **Bizonytalan = igen:** a sort bizonytalanként jelöli (4.6), a Megjegyzés szövegét mutatja indoklásként.
- **Megjelenik = nem:** a sor nem jelenik meg (piszkozat, tisztázatlan tétel).

**A dizájnspecifikáció adatellenőrzése („egy osztály órái nem fedhetik át egymást”) itt nem alkalmazható:** az adat szándékosan tartalmaz párhuzamos választási lehetőségeket (pl. 4. évfolyam, kedd 9. óra: modern tánc vagy képző). Ezek „Választható” jelölést kapnak (4.6).

### 3.5 Tanszakok (a dizájnban „Tanszak”, az adatban „Foglalkozás”)

- A tanszakchipek a Foglalkozástípusok fül foglalkozásai, **a fül sorrendjében**. A chipsor mindig a **teljes** listát mutatja, nem csak a választott osztályt érintőket.
- A listában és a PDF-ben a foglalkozás neve jelenik meg (nincs külön leckenév).
- **URL-kulcs:** a foglalkozásnév slugja: kisbetű, ékezet nélkül (á→a, é→e, í→i, ó/ö/ő→o, ú/ü/ű→u), minden nem alfanumerikus szakasz → egy kötőjel, a szélső kötőjelek levágva. Pl. „Képzőművészet” → `kepzomuveszet`, „Modern tánc” → `modern-tanc`. Ha a repóban lévő 1.0 kód már definiált kulcsokat, azokat kell megtartani.

### 3.6 Színek

Minden tanszaknak két színe van: **pötty** (pötty, PDF-cellakeret) és **tint** (pill-háttér, PDF-cellakitöltés).

- Ha a Szín oszlop ki van töltve (`#RRGGBB`), az a pötty színe. A tint ebből képződik: a szín 18%-a keverve 82% fehérrel (`color-mix(in srgb, <szín> 18%, white)`, vagy JS-ben előre kiszámolva). Az `ink` (#3A1F06) szöveg kontrasztja a tinten legalább 4.5:1 legyen; ha nem, a keverést világosabbra kell venni.
- Ha üres, a rögzített palettából kap párt, a Foglalkozástípusok sorrendjében, körbe járva:

| # | Tint | Pötty |
| --- | --- | --- |
| 1 | #F4DADC | #A8434F |
| 2 | #F6E0CC | #B8662A |
| 3 | #F5E7B8 | #9A7414 |
| 4 | #DCEADF | #3F7556 |
| 5 | #DEE3F0 | #3F5A8C |
| 6 | #EADCEC | #7A4A86 |
| 7 | #D9EAEC | #2E6D74 |

- A szín mellett **mindig** ott a szöveges név; a szín sosem az egyetlen jelzés.

### 3.7 Időrács

Az Órák fül adja. Jelenlegi értékek: 7. óra 14:00–14:45, 8. óra 14:45–15:30, 9. óra 15:30–16:00, 10. óra 16:00–16:45 (a 9. óra a tábla szerint 30 perces; az oldal így mutatja). Egy sor időpontja: Első óra Kezdés – Utolsó óra Vége, `HH:MM–HH:MM` formában, nagykötőjellel (en dash).

### 3.8 Beállítások

- **Tanév** (pl. `2026/2027`): a PDF levélfejében „{Tanév}-{rag} tanév” formában. A rag az utolsó számjegy kiejtéséhez igazodik: 0 → `-s`, 1/2/4/7/9 → `-es`, 3/8 → `-as`, 5 → `-ös`, 6 → `-os` (pl. „2026/2027-es tanév”). Ha üres, a levélfejből a tanév kimarad.
- **Közlemény:** ha nem üres, felül semleges sávban jelenik meg.
- **Hibabejelentés:** az Adathibák panelben jelenik meg.
- **Iskola:** nem használt (a fejléc szövege rögzített).

---

## 4. Felhasználói felület

Egy oldal, egyetlen függőleges sorban: fejléc → választókártya → eredmény (asztali: eredménykártya, mobil: eredménylista). Minden UI-szöveg magyar. Az idézőjeles szövegek a pontos feliratok.

### 4.1 Töréspontok és elrendezés

| Tulajdonság | Asztali (≥ 1024 px) | Mobil (< 768 px) |
| --- | --- | --- |
| Tartalomszélesség | 1100 px, középre | nézetszélesség − 32 px |
| Fejléc padding (fent / lent) | 32 / 44 px | 20 / 26 px, oldalt 16 px |
| Fejléc belső rés (iskolasor → cím) | 28 px | 18 px |
| Fő terület padding (fent / lent) | 32 / 40 px | 16 / 16 px |
| Rés a választó és az eredmény között | 20 px | 16 px |
| Eredmény | egy kártya, táblázatszerű sorok | kártyák soronként |
| PDF-gomb | az eredményfejléc jobb végén | teljes szélességben, a cím alatt |

- **Táblagép (768–1023 px):** asztali elrendezés, tartalomszélesség = nézetszélesség − 48 px.
- A fejléc és a fő terület sosem zsugorodhat a tartalma alá (a v2 dizájnban ebből lett átfedés).
- Az oldal normálisan görget; nincs belső görgetési terület (a dizájn csak a vászon miatt görget kártyán belül).

### 4.2 Színtokenek

| Token | Érték | Mire |
| --- | --- | --- |
| `brand-burgundy` | #761117 | fejléc háttere, H1/H2 világos alapon, kijelölt chip, elsődleges gomb, fókuszgyűrű |
| `brand-gold` | #E6A328 | fejléc díszkörei |
| `on-brand` | #FBF1DE | szöveg bordón (H1, kijelölt chip felirata) |
| `on-brand-accent` | #F2C66B | kis nagybetűs sor bordón („MŰVÉSZETI KÉPZÉS”) |
| `ink` | #3A1F06 | szövegtörzs, időpontok, tanszaknevek |
| `ink-label` | #653706 | mezőcímkék (Osztály, Tanszak), osztályoszlop |
| `ink-muted` | #7A5A3A | darabszám, segédszöveg, ikonok, üres állapot, letiltott gomb szövege |
| `ink-secondary` | #5A3A1A | tanár és terem mobilon |
| `accent-text` | #8A5A0C | oszlopfejlécek, PDF „szemöldök” sor |
| `ink-muted-print` | #6B4E30 | másodlagos szöveg a PDF-ben |
| `bg-page` | #FBF7EF | oldal háttere, táblázatfejléc-sor |
| `surface` | #FFFFFF | kártyák, kijelöletlen chipek |
| `border` | #E8D9C0 | kártyakeret, eredményfejléc-vonal |
| `border-control` | #E1CDAE | kijelöletlen chip kerete, szaggatott üres állapot |
| `divider` | #EFE4D2 | választósorok közti vonal, oszlopfejléc-vonal |
| `divider-row` | #F3EADB | eredménysorok közti vonal |
| `disabled-fill` | #EFE4D2 | letiltott PDF-gomb |
| `decor-ring` | rgba(251,241,222,0.35) | körvonal az asztali fejlécben |

Minden szövegpár legalább 4.5:1 kontrasztú.

### 4.3 Tipográfia

Két Google Fonts család, teljes magyar karakterkészlettel (ő, ű): **Fraunces** (címek; 600/700, optikai méret 9–144) és **Source Sans 3** (felület és törzs; 400/600/700). Tartalék: `Georgia, serif` és `system-ui, sans-serif`.

| Stílus | Család / vastagság | Asztali | Mobil | Szín | Megjegyzés |
| --- | --- | --- | --- | --- | --- |
| Oldalcím (H1) | Fraunces 600 | 60 px / 1.0 | 38 px / 1.02 | `on-brand` | betűköz −0.015em |
| Iskolanév | Fraunces 600 | 20 px / 1.0 | 15 px / 1.1 | `on-brand` | |
| Kis nagybetűs sor | Source Sans 700 | 11 px | 10 px | `on-brand-accent` | betűköz 0.24em / 0.22em |
| Eredménycím (H2) | Fraunces 600 | 24 px | 21 px | `brand-burgundy` | |
| Napcím | Fraunces 600 | 18 px | 17 px | `ink` | |
| Mezőcímke | Source Sans 700 | 15 px | 14 px | `ink-label` | |
| Segédszöveg („több is választható”) | Source Sans 400 | 13 px / 1.3 | 13 px | `ink-muted` | |
| Chip / gomb felirat | Source Sans 700 | 15 px | 15 px | állapot szerint | |
| Óra időpontja | Source Sans 700 | 16 px | 16 px | `ink` | `HH:MM–HH:MM` |
| Tanszak-pill | Source Sans 600 | 15 px | 15 px | `ink` | |
| Tanár, terem | Source Sans 400 | 15 px | 14 px | `ink` / `ink-secondary` | előtte 16 / 14 px vonalas ikon |
| Darabszám | Source Sans 400 | 15 px | 14 px | `ink-muted` | |
| Oszlopfejléc | Source Sans 700 | 12 px | – | `accent-text` | nagybetű, betűköz 0.1em |

### 4.4 Térközök, lekerekítés, keretek

Minden vezérlő legalább 44 px magas.

| Elem | Asztali | Mobil |
| --- | --- | --- |
| Kártya lekerekítés (választó, eredmény) | 18 px | 16 px (választó); órakártyák 14 px |
| Chip / tanszak-pill lekerekítés | 999 px | 999 px |
| Gomb lekerekítés | 12 px | 12 px |
| Kártyakeret | 1 px `border` | 1 px `border` |
| Chipkeret | 1.5 px (`border-control`, kijelölve bordó) | ugyanaz |
| Chip magasság / oldalsó padding | 44 px / 16 px | 44 px / 12–14 px |
| Rés chipek között | 8 px | 6 px |
| Választókártya padding | 24 px × 28 px | 16 px |
| Rés választósorok között | 18 px (+ 1 px `divider`) | 14 px |
| Címkeoszlop | 96 px széles, 20 px rés a chipekig | címke a chipek fölött |
| Eredményfejléc padding | 16 px 20 px 16 px 28 px | nincs (a cím az oldalon ül) |
| Eredménysor | padding 12 × 28 px; oszlopok 150 px · 1.2fr · 1fr · 0.8fr · 150 px (táblagépen az utolsó 80 px)¹; rés 16 px | kártya padding 12 × 14 px; rés 8 px |
| Napcím padding | 14 px 28 px 6 px | 0 2 px; 8 px az első kártyáig |
| Rés napcsoportok között | 0 (a sorok folyamatosak) | 14 px |
| PDF-gomb magasság | 44 px | 48 px |

**Fejlécdísz** (tisztán dekoratív, `aria-hidden`, a fejléc levágja):

- Asztali: arany korong 420 px, jobbra −40 px / fent −190 px; körvonal 260 px, 1.5 px `decor-ring`, jobbra 300 px / fent 60 px.
- Mobil: arany korong 220 px, jobbra −90 px / fent −120 px; körvonal nincs.
- A fejléc szövege sosem kerülhet a korongra (a kontraszt ott 1.95:1)¹. Ahol a fenti hely a szövegre lógna, a korong jobbra és feljebb tolódik: táblagépen 890 px alatt jobbra −165 px, és táblagépen körvonal nincs; mobilon 448 px alatt −60 / −160 px, 400 px alatt −100 / −160 px, 360 px alatt −145 / −150 px (jobbra / fent).

¹ A megrendelő döntése, 2026-09-26.

### 4.5 Komponensek

**1. Fejléc.** Teljes szélességű `brand-burgundy` blokk a díszítéssel. 1. sor: „Hunyadi Mátyás Általános Iskola” fölött, alatta „MŰVÉSZETI KÉPZÉS”, csak szöveg, címer nélkül. 2. sor: H1 „Művészeti órarend”. A dizájn „MINTAADATOK” címkéje nem kerül az éles oldalra.

**2. Osztályválasztó (egyszeres választás).** Címke „Osztály”; chipek: „Összes”, majd a 18 osztály (3.2). Pontosan egy kijelölt (rádió viselkedés).

- **Asztali:** egyetlen, tördelődő chipsor.
- **Mobil (döntés):** évfolyamonként tagolva. Legfelül az „Összes” chip, alatta évfolyamonként egy sor: a sor elején az évfolyam jelölése (pl. „6.”, `ink-label`, 14 px, 700), mellette az évfolyam osztályainak chipjei (6.a, 6.b, 6.m). Az egész csoportban egyszeres választás marad. Az évfolyamsorok közti rés 6 px.

| Állapot | Kitöltés | Keret | Felirat |
| --- | --- | --- | --- |
| Alap | `surface` | 1.5 px `border-control` | `ink` |
| Kijelölt | `brand-burgundy` | 1.5 px `brand-burgundy` | `on-brand` |

**3. Tanszakválasztó (többes választás).** Címke „Tanszak”, segédszöveg „több is választható” (asztalin a címke alatt, mobilon mellette). Chipek: „Összes”, majd a tanszakok (3.5), mindegyik előtt 10 px-es pötty a pöttyszínnel.

| Állapot | Kitöltés / keret / felirat | Extra |
| --- | --- | --- |
| Alap | mint az osztálychip alapállapota | pötty, gyűrű nélkül |
| Kijelölt | mint az osztálychip kijelölt állapota | 14 px pipa ikon (vonalvastagság 2.6) a pötty előtt; a pötty 2 px `on-brand` gyűrűt kap |
| „Összes” kijelölt | mint a kijelölt | pipa ikon, pötty nincs |

**4. Eredményfejléc.** H2 = a választás címe (5.3), alatta/mellette darabszám „{n} foglalkozás hetente”, és a PDF-gomb (6. szakasz). Asztalin egy sor, a gomb jobbra tolva. Mobilon cím és darabszám egymás alatt, alatta a teljes szélességű gomb.

**5. Eredménylista.**

- Napok szerint csoportosítva, hétfőtől; csak a foglalkozással rendelkező napok jelennek meg. Napon belül: Első óra szerint, majd az osztályoszlop szövege szerint.
- **Egy adatsor = egy listaelem**, akkor is, ha több osztálynak szól (nem sokszorozódik osztályonként).
- **Asztali sor:** időpont · tanszak-pill (tint + pötty + név) · tanár (személy ikon) · terem (tű ikon) · osztály. Az első nap fölött oszlopfejléc-sor `bg-page` alapon: „IDŐPONT · TANSZAK · TANÁR · TEREM · OSZTÁLY”.
- **Mobil kártya:** 1. sor időpont (bal) + osztály (jobb); 2. sor tanszak-pill; 3. sor tanár és terem, tördelődve.
- **Időpont mellett** az órasorszám is látszik, kisebben (`ink-muted`): pl. „7–8. óra”, egyórás foglalkozásnál „9. óra”.
- **Osztályoszlop szövege:** a Célcsoport olvasható formája: évfolyamelem → „{n}. évf.”, osztályelem → az osztálynév; vesszővel elválasztva, évfolyam szerint rendezve. Pl. `5,6` → „5. évf., 6. évf.”, `3.b` → „3.b”.
- Hiányzó tanár vagy terem esetén az adott elem (ikonnal együtt) kimarad.

**6. PDF-gomb:** lásd 6. szakasz.

**7. Üres állapot.** „Erre a választásra nincs foglalkozás.” – középre, 15–16 px, `ink-muted`; mobilon szaggatott `border-control` keretű kártyában. A lista helyén jelenik meg; a PDF-gomb az osztályszabály szerint működik.

### 4.6 Választható és bizonytalan adat (az 1.0 szerint, megtartva)

- **Választható:** ha **egy kiválasztott osztály** esetén ugyanarra a (nap, óra) idősávra több megjelenő sor esik, az érintett sorok „Választható” címkét kapnak (kis pill a tanszak-pill mellett: 11 px, 700, nagybetű, betűköz 0.08em, `accent-text` szöveg, `bg-page` háttér, 1 px `border-control` keret). „Összes” osztálynál nincs Választható-jelölés, mert az osztályonként értelmes. A jelölés a tanszakszűrés **utáni** listára vonatkozik.
- **Bizonytalan:** a sor szaggatott keretet (1.5 px dashed `accent-text`) és „?” jelet kap a név után. Koppintásra vagy billentyűfókuszra megjelenik a Megjegyzés szövege (pl. „A tanári sor 3.–6. évfolyamot ír, a teremsor 5.–6.-ot”). A „?” egy natív `<button>`, `aria-expanded` állapottal; a magyarázat `aria-describedby`-jal kapcsolódik a sorhoz.

### 4.7 Adatállapotok (az 1.0 szerint, a dizájn színeivel)

- **Betöltés:** a lista helyén „Betöltés…” felirat, legfeljebb 8 másodpercig, utána snapshot.
- **Tartalék üzem:** a fejléc alatt sáv (`#FFF3D6` háttér, `#8A5A0C` keret és szöveg): „Az órarend nem frissült, a {dátum} állapotot látod.”
- **Közlemény:** ha a Beállítások Közlemény nem üres, a fejléc alatt semleges sáv (`surface` háttér, `border` keret, `ink` szöveg).
- **Adathibák:** ha volt kihagyott sor, az oldal alján összecsukott „Adathibák (N)” panel (`<details>`) sorolja fel őket („Foglalkozások, 14. sor: ismeretlen foglalkozás: ‚Képzö’”), a Hibabejelentés címmel. Szerkesztőknek szól, a szülőket nem zavarja.

---

## 5. Új funkció 1: több tanszak kiválasztása

### 5.1 Állapot

- `class`: „Összes” vagy pontosan egy osztály a 18-ból.
- `disciplines`: tanszakok halmaza; üres halmaz = „Összes”.

A lista minden kattintásra azonnal frissül; nincs keresés vagy küldés gomb.

### 5.2 Kattintások

| Művelet | Eredmény |
| --- | --- |
| Osztálychipre kattint | az lesz az egyetlen kijelölt osztály |
| Kijelöletlen tanszakra kattint | bekerül a halmazba; az „Összes” elveszti a kijelölt állapotát |
| Kijelölt tanszakra kattint | kikerül a halmazból |
| Az utolsó kijelöltet is kiveszi | üres halmaz → az „Összes” kijelöltnek látszik |
| Az „Összes” (tanszak) chipre kattint | a halmaz törlődik |
| Osztályt vált | a tanszak-kijelölés megmarad |

**Szűrés:** egy sor akkor látszik, ha `Megjelenik ≠ nem`, érvényes, és (`class` = „Összes” **vagy** a sor érinti a `class` osztályt, 3.3) **és** (`disciplines` üres **vagy** a sor foglalkozása benne van `disciplines`-ben).

### 5.3 Cím és darabszám

Cím = osztályrész + „ · ” + tanszakrész.

| Eset | Osztályrész | Tanszakrész |
| --- | --- | --- |
| Osztály „Összes” | „Minden osztály” | – |
| Egy osztály | „3.b osztály” | – |
| Nincs kijelölt tanszak | – | „minden tanszak” |
| 1–3 tanszak | – | a nevek a chipsor sorrendjében, vesszővel („Balett, Kerámia”) |
| 4 vagy több | – | „{n} tanszak” |

Darabszám: „{n} foglalkozás hetente”, n = a megjelenő listaelemek száma.

### 5.4 Alapállapot, URL, megjegyzett választás

- **Betöltéskor:** osztály „Összes”, tanszak „Összes” – az első nézet minden osztály minden óráját listázza, a PDF-gomb le van tiltva.
- **URL:** `?o=3.b&f=balett,keramia`. „Összes” osztálynál nincs `o`, üres tanszak-halmaznál nincs `f`. A kulcsok a 3.5 szerinti slugok. Ismeretlen osztály vagy kulcs figyelmen kívül marad, hibát nem okoz. Minden változáskor `history.replaceState`.
- **Megjegyzett választás:** a böngésző (`localStorage`, `try/catch`-ben) megjegyzi az utolsó választást; ha az URL-ben van `o` vagy `f`, az URL felülírja.

---

## 6. Új funkció 2: PDF-export a böngésző nyomtatásával

### 6.1 Gomb

| Állapot | Mikor | Megjelenés | Felirat |
| --- | --- | --- | --- |
| Aktív | egy osztály kiválasztva | `brand-burgundy` kitöltés, `on-brand` felirat, 18 px ikon | „PDF/nyomtatás” |
| Letiltott | osztály = „Összes” | `disabled-fill`, `ink-muted` felirat, `cursor: not-allowed` | gomb + megjegyzés: „PDF/nyomtatás csak egy osztály kiválasztásakor érhető el.” (asztali: a gombtól balra; mobil: alatta, középre) |

Letiltva natív `disabled`, a megjegyzés `aria-describedby`-jal kapcsolódik.

### 6.2 Előállítás

Nincs PDF-könyvtár, nincs szerveroldali generálás. A PDF-oldal egy **csak nyomtatásban látható** elem az oldalon, amelyet a `@media print` stíluslap jelenít meg. Kattintásra:

1. a PDF-oldal tartalma az aktuális választásból renderelődik;
2. a `document.title` az eredmény címére vált: „Művészeti órarend – {cím}” (pl. „Művészeti órarend – 3.b osztály · Balett, Kerámia”); ebből lesz a PDF dokumentumcíme, és a legtöbb böngésző ebből javasol fájlnevet;
3. `window.print()` megnyitja a nyomtatási párbeszédet („Mentés PDF-ként”);
4. az `afterprint` esemény után a `document.title` visszaáll.

Ha a felhasználó a böngésző saját menüjéből nyomtat (Ctrl+P), ugyanez a nyomtatási nézet jelenjen meg (`beforeprint` eseményen renderelni). „Összes” osztálynál a nyomtatási nézet egy rövid szöveget mutat: „Válassz egy osztályt a nyomtatáshoz.”

### 6.3 Nyomtatási szabályok

- `@page { size: A4 landscape; margin: 11.6mm 12.7mm; }` – egy oldal.
- Nyomtatásban a képernyős felület (fejléc, választó, lista, gombok, sávok, Adathibák) rejtve van.
- `print-color-adjust: exact` (és `-webkit-print-color-adjust: exact`), hogy a tanszakszínek megmaradjanak.
- Fehér háttér, sötét kitöltés nincs; szürkeárnyalatos nyomtatásban is olvasható, mert minden cella megnevezi a tanszakot.
- A legkisebb szöveg 12 px (9 pt).
- Valódi szöveg: kijelölhető, kereshető. Olvasási sorrend: levélfej → cím → rács naponként → lábléc.

### 6.4 A PDF-oldal elrendezése (A4 fekvő, 1123 × 794 px @ 96 dpi)

Margók: 44 px fent és lent, 48 px bal és jobb oldalt. A szakaszok között 14 px.

1. **Levélfej:** „Hunyadi Mátyás Általános Iskola” (13 px, 700, `ink`) + „· Művészeti képzés” (13 px, `ink-muted-print`); jobbra igazítva a tanév („2026/2027-es tanév”, 3.8). Alatta 10 px-re 2 px `brand-burgundy` vonal.
2. **Cím:** „MŰVÉSZETI ÓRAREND” (12 px, 700, `accent-text`, betűköz 0.14em); H1 = a képernyős eredménycím (Fraunces 600, 28 px, `brand-burgundy`); jobbra a darabszám (14 px, `ink-muted-print`).
3. **Rács:** kitölti a maradék magasságot.
4. **Lábléc:** „Hunyadi Mátyás Általános Iskola · Művészeti képzés”, 12 px, `ink-muted-print`. Ha a rácsban van bizonytalan cella, a lábléc fölött egy sor: „? = az adat pontosítás alatt”.

**Rács:**

| Rész | Előírás |
| --- | --- |
| Oszlopok | 78 px-es óraoszlop + 5 egyenlő naposzlop (Hétfő … Péntek); 6 px rés |
| Sorok | 30 px-es napfejléc-sor + az Órák fül minden órájára egy egyforma magas sor; 6 px rés |
| Napfejléc | 14 px, 700, középre, 1.5 px `brand-burgundy` aláhúzás |
| Órácella | „7. ÓRA” (12 px, 700, `accent-text`), kezdés (13 px, 600), vége (12 px, `ink-muted-print`) |
| Üres idősáv | 1 px szaggatott #DCCBAE körvonal, 8 px lekerekítés |
| Órakártya | tanszak-tint kitöltés, 1 px keret a pöttyszínnel, 8 px lekerekítés, padding 8 × 10 px; annyi sort fog át, ahány órás (dupla óra = két sor) |
| Órakártya szövege | név (Fraunces 700, 15 px); időpont (12 px, 600); tanár és terem (12 px) a kártya alján |
| Választható idősáv² | az egymással átfedő kártyák a nap oszlopában **egymás mellett**, egyenlő szélességű sávokban állnak; mindegyik a saját sávjában fogja át a saját óráit. Az ilyen csoport fölött egyetlen „VÁLASZTHATÓ” jelölés (12 px, 700, `accent-text`, fehér alapon) fut végig a nap oszlopán, vékony zárójellel a sávok fölött. A keskeny (sávos) kártyán nincs időpont (az óraoszlop mutatja), a padding 6 × 5 px; a túl hosszú szó csak magyar szótaghatáron, kötőjellel törik. Három vagy több sávnál a név 13 px, a padding 4 px. |
| Bizonytalan | a név után „?” |

² A megrendelő döntése, 2026-09-26: az eredeti „a cella függőlegesen egyenlő részekre osztva” helyett. A SPEC méreteivel a félszéles kártyára nem fért ki a szöveg (a „VÁLASZTHATÓ” 75 px, a hely 67 px).

Csak a kijelölt tanszakok kártyái szerepelnek; üres tanszak-halmaznál az osztály összes foglalkozása.

**Böngészőfüggő korlát:** a böngésző saját fejlécét és láblécét (URL, dátum) az oldal nem tudja kikapcsolni; ezt a felhasználó a nyomtatási párbeszédben teheti meg. iPhone-on a mentés útja: Megosztás → Nyomtatás → Megosztás → Mentés a Fájlokba.

---

## 7. Akadálymentesség (WCAG 2.1 AA)

- `lang="hu"`.
- Mindkét chipcsoport `fieldset`, a `legend` „Osztály” / „Tanszak”. A chipek natív `<button>` elemek `aria-pressed="true|false"` állapottal (osztály: egyszeres választású csoport, tanszak: kapcsolók). A „több is választható” segédszöveg `aria-describedby`-jal kapcsolódik a Tanszak csoporthoz. Mobilon az évfolyamsorok címkéje (pl. „6.”) nem interaktív szöveg; a chipek felirata a teljes osztálynév („6.a”).
- Minden chip, a „?” gomb és a PDF-gomb Tab-bal elérhető, Enterrel vagy Szóközzel aktiválható.
- Látható fókuszgyűrű minden vezérlőn: 2 px `brand-burgundy` körvonal, 2 px eltolással (`:focus-visible`).
- Az eredményterület `aria-live="polite"`: az új cím és darabszám minden változás után felolvasódik.
- A letiltott PDF-gomb natív `disabled`, `aria-describedby` a megjegyzésre.
- A szín mindig a leírt névvel együtt jelenik meg; a kijelölt chip kitöltésben, feliratszínben és pipa ikonban is különbözik.
- Minden szövegpár kontrasztja legalább 4.5:1.
- Chipek és gombok legalább 44 px magasak (mobil PDF-gomb 48 px).
- A fejléc díszkörei és minden ikon `aria-hidden`; minden ikon mellett látható szöveg van.
- A PDF valódi szöveg, dokumentumcíme az eredménycím.

---

## 8. Elfogadási kritériumok

Az 1.1 akkor kész, ha mind teljesül. Mindegyikhez tartozzon automatizált teszt (`node --test`, a tiszta logikára: elemzés, validálás, célzás, szűrés, cím, slug, URL, tanév-rag) vagy dokumentált kézi ellenőrzés (`docs/manual-checks.md`).

**Felület és logika**

1. Betöltéskor osztály és tanszak is „Összes”, a lista minden osztály minden megjelenő óráját mutatja, a PDF-gomb le van tiltva, és látszik mellette a magyarázat.
2. Az osztálychipek egyszeres választásként működnek, a tanszakchipek egymástól függetlenül kapcsolhatók, `aria-pressed` állapottal. Üres tanszak-kijelölésnél az „Összes” kijelölt, és rá kattintva a kijelölés törlődik.
3. A lista, a cím és a darabszám minden kombinációnál az 5.2–5.3 szabályait követi. Évfolyamra szóló óra az évfolyam minden osztályánál megjelenik (az m osztálynál is), konkrét osztályra szóló csak annál (pl. a csak 3.b-nek szóló óra a 3.a-nál nem).
4. Az m osztálynak szóló óra (pl. `7.m`) csak az m osztálynál jelenik meg, a 7.a-nál és a 7.b-nél nem.
5. Osztályváltáskor a tanszak-kijelölés megmarad.
6. A `?o=3.b&f=balett,keramia` link más böngészőben is ugyanazt a nézetet állítja vissza. Ismeretlen osztály vagy kulcs nem okoz hibát.
7. Egy osztály kiválasztásakor az ugyanarra az idősávra eső sorok „Választható” címkét kapnak. A bizonytalan sor képernyőn és PDF-ben is jelölve van, a megjegyzése billentyűzettel is elérhető.
8. Mobilon (< 768 px) az osztálychipek évfolyamonként külön sorban állnak, az „Összes” legfelül; asztalin egy tördelődő sor.

**PDF**

9. Választott osztálynál a „PDF/nyomtatás” megnyitja a nyomtatási párbeszédet. A mentett PDF egy A4 fekvő oldal, pontosan az aktuális választással és a 6.4 elrendezésével. A szöveg kijelölhető, a dokumentumcím az eredménycím, és szürkeárnyalatos nyomtatásban is olvasható.
10. A 9. pont teljesül asztali Chrome-ban, asztali Safariban, iOS Safariban és Androidos Chrome-ban. Ctrl+P-vel nyomtatva is a nyomtatási nézet jelenik meg.

**Megjelenés és akadálymentesség**

11. Asztali (≥ 1024 px) és mobil (< 768 px) nézetben a megjelenés a 4.1–4.5 méreteit, tokenjeit és állapotait követi. A fejléc és a tartalom sosem csúszik egymásra. 768–1023 px között az asztali elrendezés jelenik meg, vízszintes görgetés nélkül.
12. A 7. szakasz minden pontja teljesül.

**Adat és üzem (az 1.0-ból)**

13. A Sheetben átírt sor 10 percen belül megjelenik az oldalon, újratöltés után, deploy nélkül.
14. Egy hibás sor nem töri el az oldalt: kimarad, és az Adathibák panel a táblázatbeli sorszámával mutatja.
15. Ha a Google nem elérhető, vagy egy fül, illetve fejléc hiányzik, az oldal a snapshotból renderel, és kiírja a snapshot dátumát.
16. A napi snapshot-Action érvénytelen adatnál nem commitol, hanem hibával leáll.
17. Nincs npm-függőség és nincs build lépés; a GitHub Pages deploy a `main` ágról működik.
18. Az 1. szakasz „Nincs benne” listájából semmi nem jelenik meg az oldalon.

---

## 9. Vizuális referencia

A `docs/design/` mappa a jóváhagyott v3 dizájn képernyői, Design Component (`.dc.html`) formátumban. Nem futtathatók önállóan (egy szerkesztő-futtatókörnyezethez készültek), de a markup és az inline stílusok pontos méreteket, színeket és elrendezést mutatnak.

| Fájl | Mit mutat | Mire ne hagyatkozz |
| --- | --- | --- |
| `desktop.dc.html` | asztali oldal 1440 px-en: fejléc, választókártya, eredménykártya táblázatszerű sorokkal | 1.m–8.m osztályok, hét tanszak, 12:50-es időpontok, teljes tanárnevek: **mintaadat** |
| `mobil.dc.html` | mobil oldal 390 px-en | ugyanaz; a mobil osztályválasztó itt még **nem** évfolyamonként tagolt – a 4.5 szerinti tagolás az irányadó |
| `pdf-a4-fekvo.dc.html` | a PDF-oldal 1123 × 794 px-en | mintaadat; a Választható-cellák kettéosztása nincs rajta (6.4 az irányadó) |

Ütközés esetén ez a SPEC.md az irányadó, nem a dizájnfájl.

---

## 10. Ismert adatkérdések (az iskolával tisztázandó, nem blokkolja a fejlesztést)

A tábla több ponton ellentmondásos; ezeket a Sheetben **Bizonytalan = igen** jelöli, az oldal pedig bizonytalanként mutatja. A legsúlyosabbak: a kerámia célcsoportja kedden és csütörtökön, valamint a 4. évfolyam kedd 9. órája (választás vagy hiba). A 9. óra 30 perces hossza valószínűleg elírás. A „Nyitott világ” mellett nincs tanár és terem. A Robotika sor `Megjelenik = nem`.

---

## 11. Javasolt fájlszerkezet (ha még nincs 1.0 kód)

```
index.html
config.js                 # PUB_ID, GID-ek
css/tokens.css            # 4.2 tokenek CSS változóként
css/app.css
css/print.css             # @media print, @page
js/main.js                # indulás, állapot, eseménykezelés
js/data.js                # letöltés, CSV-elemzés, fejlécfelismerés, validálás, snapshot-tartalék
js/model.js               # célzás, szűrés, cím, darabszám, Választható, slug, URL, tanév-rag (tiszta függvények)
js/render.js              # képernyős DOM
js/print-view.js          # nyomtatási nézet DOM
data/snapshot.json
scripts/snapshot.mjs      # napi Action: letölt, validál (ugyanazzal a js/data.js-sel), ír
tests/*.test.mjs          # node --test
docs/design/*.dc.html
docs/manual-checks.md
.github/workflows/deploy.yml
.github/workflows/snapshot.yml
```

Ha a repóban már van 1.0 kód, annak szerkezete marad; a fenti csak irány.

---

## 12. Mérföldkövek

1. **Adat:** `js/data.js` és `js/model.js` a 3. és 5. szakasz szerint, tesztekkel (célzás: `6` → 6.m igen; `7.m` → 7.a nem; slug; tanév-rag; cím 0/1/3/4 tanszaknál). Snapshotból fut. CORS-ellenőrzés valódi közzétett táblával, ha a `config.js` ki van töltve.
2. **Képernyő:** fejléc, választók (mobilon tagolt osztálysorok), eredménylista, üres és adatállapotok, URL és localStorage.
3. **PDF:** `print.css` és `print-view.js`, Választható-cellák, bizonytalan-jelölés; kézi ellenőrzés négy böngészőben.
4. **Üzem:** deploy- és snapshot-workflow, `docs/manual-checks.md`, végső elfogadási lista.

---

## 13. Nyitott pontok (fejlesztés közben lezárhatók, a megrendelő dönt)

- **Tanszakszínek:** a 3.6 származtatott tint-szabálya ideiglenes; a megrendelő dönthet úgy, hogy a Sheet két színt ad.
- **Sötét mód:** az 1.0-ban szerepelt, a v3 dizájnban nincs. Az 1.1-ben nincs; ha kell, külön döntés.
- **Hover állapotok:** nincsenek megtervezve. Javaslat: kijelöletlen chip hoverre `bg-page` kitöltés, kijelölt és elsődleges gomb hoverre #4E0B10.
- **PDF-fájlnév:** a `document.title` adja; más konvenció nincs.
- **Adatgazda:** ki tartja naprakészen a táblát félévente.
