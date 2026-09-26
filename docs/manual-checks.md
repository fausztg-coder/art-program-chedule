# Kézi ellenőrzések (1.1)

A `SPEC.md` 8. szakaszának azok a pontjai, amelyeket a `node --test` nem tud ellenőrizni: megjelenés, böngészőviselkedés, akadálymentesség, nyomtatás. Minden pontot pipálj ki böngészőnként; ha valami eltér, írd mellé a böngészőt, a szélességet és egy képernyőképet.

A logikai részeket (célzás, szűrés, cím, darabszám, Választható, slug, URL, tanév-rag, CSV-validálás) a `tests/` automatikusan ellenőrzi; ezeket itt csak a felületen kell visszanézni.

## Előkészítés

- Helyben: a repó gyökerében `python3 -m http.server 8000`, majd `http://localhost:8000/`. (`file://` nem működik, az ES moduloknak szerver kell.)
- Élesben: `https://fausztg-coder.github.io/art-program-chedule/`.
- A mintaadat helyben: `http://localhost:8000/?forras=minta` (a `data/sample/` CSV-i, a teljes élő feldolgozáson át).
- Szélességek: **390 px** (telefon), **800 px** (táblagép), **1440 px** (asztali). Asztali böngészőben a fejlesztői eszközök eszköz-nézetével állítsd be; határesetnek nézd meg a 767, 768, 1023 és 1024 px-et is.
- Böngészők: **asztali Chrome**, **asztali Safari**, **iOS Safari**, **Androidos Chrome**.
- Asztali Safariban a Tab alapból kihagyja a gombokat: a billentyűzetes pontokhoz kapcsold be a Beállítások → Haladó → „A Tab billentyű megnyomásával a weboldal minden eleme kiemelhető” opciót (vagy használd az Option+Tab-ot).

| | 390 px | 800 px | 1440 px |
| --- | --- | --- | --- |
| Asztali Chrome | ☐ | ☐ | ☐ |
| Asztali Safari | ☐ | ☐ | ☐ |
| iOS Safari | ☐ | ☐ (fekvő iPad vagy iPhone fekve) | – |
| Androidos Chrome | ☐ | ☐ (táblagép) | – |

## A. Első betöltés (8.1)

1. ☐ Nyisd meg az oldalt URL-paraméter nélkül, üres böngészőadatokkal (privát ablak).
2. ☐ Rövid ideig „Betöltés…” látszik, legfeljebb kb. 8 másodpercig.
3. ☐ Osztálynál és tanszaknál is az „Összes” chip kijelölt (bordó kitöltés, világos felirat; a tanszak-„Összes” előtt pipa).
4. ☐ A cím „Minden osztály · minden tanszak”, mellette „{n} foglalkozás hetente”.
5. ☐ A lista minden osztály minden órája, napok szerint csoportosítva, hétfőtől; csak az órás napok látszanak.
6. ☐ A „PDF/nyomtatás” gomb le van tiltva (halvány kitöltés), és látszik mellette: „PDF/nyomtatás csak egy osztály kiválasztásakor érhető el.”
7. ☐ Egy adatsor egyszer szerepel, akkor is, ha több osztálynak szól (az Osztály oszlopban pl. „4. évf., 5. évf.”).

## B. Osztályválasztó (8.2, 8.5, 8.8)

1. ☐ Kattints a „3.b” chipre: csak ez lesz kijelölt, az „Összes” kijelölése megszűnik.
2. ☐ A cím „3.b osztály · minden tanszak”, a PDF-gomb aktív, a magyarázó szöveg eltűnik.
3. ☐ Kattints egy másik osztályra: mindig pontosan egy osztály kijelölt.
4. ☐ Jelölj ki előbb egy tanszakot, aztán válts osztályt: a tanszak-kijelölés megmarad.
5. ☐ **390 px:** az „Összes” legfelül külön sorban áll, alatta évfolyamonként egy sor; a sor elején az évfolyam száma („6.”), mellette az osztályok (6.a, 6.b, 6.m). Az évfolyamszám nem kattintható.
6. ☐ **800 és 1440 px:** az osztálychipek egyetlen, tördelődő sorban állnak, évfolyamszámok nélkül.

## C. Tanszakválasztó (8.2)

1. ☐ A „Tanszak” címke alatt (mobilon mellette) „több is választható”.
2. ☐ A chipek sorrendje a Sheet Foglalkozástípusok fülének sorrendje, mindegyik előtt színes pötty.
3. ☐ Kattints a „Balett”-re: kijelölt lesz (pipa + pötty világos gyűrűvel), az „Összes” kijelölése megszűnik.
4. ☐ Kattints a „Kerámia”-ra is: mindkettő kijelölt; a cím „… · Balett, Kerámia” (a chipsor sorrendjében).
5. ☐ Kattints újra a „Balett”-re: kikerül; ha az utolsót is kiveszed, az „Összes” újra kijelölt.
6. ☐ Jelölj ki négy tanszakot: a cím „… · 4 tanszak”.
7. ☐ Jelölj ki néhányat, majd kattints az „Összes”-re: minden kijelölés törlődik.

## D. Lista, cím, darabszám (8.3, 8.4)

1. ☐ Asztali sor: időpont (pl. „14:00–14:45”) és mellette kisebben az órasorszám („7. óra”, „7–8. óra”) · tanszak-pill (halvány háttér + pötty + név) · tanár személy-ikonnal · terem tű-ikonnal · osztály.
2. ☐ Az első nap fölött oszlopfejléc-sor: „IDŐPONT · TANSZAK · TANÁR · TEREM · OSZTÁLY”.
3. ☐ Mobil kártya: 1. sor időpont balra, osztály jobbra; 2. sor a tanszak-pill; 3. sor tanár és terem.
4. ☐ Ahol a Sheetben nincs tanár vagy terem, ott az elem az ikonjával együtt hiányzik.
5. ☐ Egy évfolyamra szóló óra (pl. „6. évf.”) a 6.a-nál, a 6.b-nél és a 6.m-nél is megjelenik.
6. ☐ Csak a 7.m-nek szóló óra a 7.m-nél látszik, a 7.a-nál és a 7.b-nél nem.
7. ☐ Csak egy osztálynak (pl. 3.b) szóló óra a szomszéd osztálynál (3.a) nem látszik.
8. ☐ Olyan választásnál, amelyre nincs óra: „Erre a választásra nincs foglalkozás.”, középen; mobilon szaggatott keretes kártyában. Az oszlopfejléc eltűnik.
9. ☐ A darabszám minden változás után a látható listaelemek száma.

## E. URL és megjegyzett választás (8.6)

1. ☐ Válaszd a 3.b-t, a Balettet és a Kerámiát: a címsor `?o=3.b&f=balett,keramia` (vessző, nem `%2C`).
2. ☐ Másold a linket egy **másik böngészőbe** (vagy privát ablakba): ugyanaz a nézet jelenik meg.
3. ☐ Nyisd meg a `?o=9.x&f=nincs-ilyen,balett` linket: nincs hiba, az osztály „Összes”, a tanszak Balett.
4. ☐ Válassz valamit, zárd be a lapot, és nyisd meg az oldalt paraméter nélkül: az utolsó választás visszajön.
5. ☐ Paraméteres link megnyitásakor az URL felülírja a megjegyzett választást.
6. ☐ Safari privát módban (vagy letiltott sütikkel/tárolóval) az oldal hiba nélkül működik, csak nem jegyzi meg a választást.

## F. Választható és bizonytalan adat, képernyőn (8.7)

1. ☐ Válassz egy osztályt, ahol két óra ugyanarra a napra és órára esik: mindkét sor mellett „VÁLASZTHATÓ” kis címke.
2. ☐ Szűrd le az egyik tanszakra: ha már csak egy sor marad az idősávban, a címke eltűnik.
3. ☐ „Összes” osztálynál nincs Választható-címke.
4. ☐ A bizonytalan sor szaggatott keretes; a név után kör alakú „?”.
5. ☐ **Egér / érintés:** a „?”-re kattintva (koppintva) megjelenik a sor alatt a Megjegyzés szövege, újabb kattintásra eltűnik. Máshová kattintva nyitva marad.
6. ☐ **Érintés:** a „?” körül a koppintási terület legalább 44 px (a kör mellé koppintva is működik).
7. ☐ **Billentyűzet:** Tab-bal a „?”-re lépve a megjegyzés magától megjelenik, továbblépve eltűnik. Enterrel vagy Szóközzel rögzíthető: így továbblépés után is nyitva marad; újabb Enter bezárja.
8. ☐ Az utolsó sor szaggatott kerete mind a négy oldalon látszik, asztalin az eredménykártya alján, mobilon az utolsó kártyán is (pl. `?o=4.a` vagy `?o=8.m`, péntek). Mobilon az utolsó nem bizonytalan kártyának is van alsó kerete.
9. ☐ Képernyőolvasóval (VoiceOver / TalkBack) a „?” gomb neve „Bizonytalan adat”, állapota „összecsukva/kibontva”, és felolvassa a megjegyzést.
10. ☐ A sorok függőlegesen kiegyensúlyozottak: a tartalom alatt nincs több üres hely, mint fölötte (asztalin a sorban, mobilon a kártyában), akkor sem, ha a kártyán nincs tanár és terem.

## G. Elrendezés (8.11)

Minden szélességen és böngészőben:

1. ☐ Nincs vízszintes görgetés (oldalra húzva sem mozdul az oldal).
2. ☐ A fejléc és a választókártya nem csúszik egymásra; az oldal normálisan görget, belső görgetősáv nincs.
3. ☐ **1440 px:** a tartalom 1100 px széles, középen; a fejlécben arany korong jobbra fent és vékony körvonal. Az Osztály oszlop 150 px: „1. évf., 2. évf., 3. évf., 4. évf.” legfeljebb két sorban (pl. `?o=4.a`, hétfő).
4. ☐ **800 px:** asztali elrendezés (táblázatszerű sorok, oszlopfejléc), a tartalom két oldalán 24 px; az Osztály oszlop itt keskeny (80 px), a fejlécben nincs körvonal.
5. ☐ **390 px:** mobil elrendezés: kártyák soronként, a cím és a darabszám egymás alatt, a PDF-gomb teljes szélességű (48 px magas); a fejlécben kisebb arany korong, körvonal nélkül.
6. ☐ **Fejléc minden szélességen** (fejlesztői eszközökben húzd a szélességet 320 és 1440 px között, különösen 320, 360, 375, 390, 414, 430, 768, 800, 890 px): az iskolanév, a „MŰVÉSZETI KÉPZÉS” és a „Művészeti órarend” cím egyetlen betűje sem kerül az arany korongra.
7. ☐ Hosszú teremnév keskeny oszlopban szótagolva vagy szóhatáron törik, nem lóg ki (pl. „nagytornaterem” 800 px-en). Megjegyzés: szótagolás csak ott van, ahol a böngésző ismeri a magyar elválasztást.
8. ☐ **320 px** (kis telefon) és WCAG szövegtávolság (pl. „Text Spacing” könyvjelző): az időpont egy sorban marad („15:30–16:00”), az osztály szövege a részei között törik, semmi nem csúszik egymásra.
9. ☐ Betűtípusok: a címek Fraunces, a felület Source Sans 3; az ő és ű betűk helyesek. Ha a Google Fonts nem tölt be, az oldal Georgia / rendszerbetűvel is olvasható.
10. ☐ Vesd össze a `docs/design/desktop.dc.html` és `docs/design/mobil.dc.html` méreteivel, színeivel (a mintaadataik nem igazak, csak az elrendezés számít).
11. ☐ Egérrel: a kijelöletlen chip hoverre halvány (`bg-page`) kitöltést kap, a kijelölt chip és az aktív PDF-gomb sötétebb bordót. Érintőképernyőn nincs „beragadt” hover.

## H. Akadálymentesség (8.12, SPEC 7.)

**Csak billentyűzettel** (egér nélkül, az oldal tetejéről indulva):

1. ☐ Tab-bal sorban elérhető: osztálychipek → tanszakchipek → PDF-gomb (ha aktív) → „?” gombok → Adathibák panel (ha van).
2. ☐ Minden vezérlőn látható fókuszgyűrű: 2 px bordó körvonal, 2 px eltolással.
3. ☐ Enter és Szóköz is aktiválja a chipeket; aktiválás után a fókusz ugyanazon a chipen marad (nem ugrik az oldal elejére).
4. ☐ A letiltott PDF-gomb nem kap fókuszt.

**Képernyőolvasóval** (VoiceOver macOS/iOS, TalkBack Android):

5. ☐ A két csoportot „Osztály” és „Tanszak” csoportként olvassa fel; a Tanszaknál a „több is választható” leírást is.
6. ☐ A chipek állapotát „benyomva / nincs benyomva” (vagy „kijelölve”) formában mondja.
7. ☐ Választás után felolvassa az új címet és darabszámot.
8. ☐ A letiltott PDF-gombnál felolvassa a magyarázatot.
9. ☐ A fejléc díszítését és az ikonokat nem olvassa fel; mobilon az évfolyamszámokat („6.”) sem.
10. ☐ Egy listaelemen végighaladva a mezőket címkével olvassa: „Tanár: …”, „Terem: …”, „Osztály: …” (az oszlopfejléc-sort nem olvassa fel külön).

**Egyéb:**

11. ☐ 200 %-os nagyítás (Ctrl/Cmd +) 1440 px-en: minden olvasható, nincs átfedés, nincs vízszintes görgetés.
12. ☐ Windows kontrasztos mód (vagy Chrome DevTools → Rendering → forced-colors: active), világos és sötét kontrasztos témával is: a kijelölt chip megkülönböztethető, egér alatt is olvasható, a fókuszgyűrű rajta is látszik; a PDF-gomb kerete látszik, a „?” látszik.
13. ☐ A kijelölt chip nemcsak színben különbözik: kitöltés, feliratszín és pipa ikon is.

## I. Adatállapotok (8.14, 8.15)

1. ☐ **Adathibák:** a Sheetben írj egy sor Nap oszlopába „Vasárnap”-ot, várj a közzétételre (kb. 5 perc), és töltsd újra az oldalt. A sor kimarad, az oldal alján összecsukott „Adathibák (1)” panel; kinyitva: „Foglalkozások, {sorszám}. sor: ismeretlen nap: ‚Vasárnap’”, a sorszám a táblázatbeli sor. Ha a Beállítások Hibabejelentés mezője ki van töltve, alatta „Hibát jelezz: …” (e-mail címnél kattintható). Utána állítsd vissza a sort.
   - Helyben is kipróbálható: írd át a `data/sample/foglalkozasok.csv` egy sorát, és nyisd meg a `?forras=minta` oldalt (utána `git checkout data/sample`).
2. ☐ **Tartalék üzem:** a fejlesztői eszközökben tiltsd le a `docs.google.com` kéréseket (Network → Request blocking), és töltsd újra: a fejléc alatt sárgás sáv: „Az órarend nem frissült, a {ÉÉÉÉ. HH. NN.} állapotot látod.”, a lista a snapshotból jelenik meg.
3. ☐ **Végzetes hiba:** tiltsd le a `docs.google.com` és a `data/snapshot.json` kérést is: „Az órarend most nem tölthető be. Próbáld újra később.”, választó és lista nélkül.
4. ☐ **Közlemény:** a Sheet Beállítások fülén töltsd ki a Közleményt: a fejléc alatt fehér sáv a szöveggel (sortörésekkel együtt). Üresen nincs sáv.
5. ☐ **Bizonytalan sor:** a Sheetben állíts egy sort `Bizonytalan = igen`-re megjegyzés nélkül: a sor szaggatott keretes, a „?” nem kattintható, de a képernyőolvasó „Bizonytalan adat”-ként olvassa.

## J. PDF és nyomtatás (8.9, 8.10)

Mind a négy böngészőben (asztali Chrome, asztali Safari, iOS Safari, Androidos Chrome) végig kell menni. Minta: `?o=3.b` (egyszerű hét), `?o=4.a` (átfedő, „Választható” órák, bizonytalan sor), `?o=5.a&f=keramia,enekkar,modern-tanc` (szűrt választás).

**Indítás:**

1. ☐ Válassz egy osztályt, és kattints a „PDF/nyomtatás” gombra: megnyílik a nyomtatási párbeszéd.
2. ☐ A előnézetben egyetlen A4 fekvő oldal látszik; a képernyős felület (fejléc, választó, lista, gombok, sávok, Adathibák) nincs rajta.
3. ☐ **Ctrl+P / Cmd+P** (vagy a böngésző menüjéből Nyomtatás): ugyanez a nyomtatási nézet jelenik meg, az aktuális választással. Válts osztályt, és nyomtass újra Ctrl+P-vel: az új osztály látszik.
4. ☐ „Összes” osztálynál a gomb le van tiltva; Ctrl+P-re a lapon csak ez áll: „Válassz egy osztályt a nyomtatáshoz.”
5. ☐ Mentés PDF-ként: a javasolt fájlnév / dokumentumcím „Művészeti órarend – {cím}” (pl. „Művészeti órarend – 4.a osztály · minden tanszak”). A PDF-olvasó Tulajdonságok/Dokumentum-infó ablakában is ez a cím.
6. ☐ A párbeszéd bezárása után a böngészőfül címe visszaáll: „Hunyadi művészeti órarend”.
7. ☐ **iPhone:** Megosztás → Nyomtatás → (két ujjal széthúzva az előnézetet) Megosztás → Mentés a Fájlokba. A mentett PDF megfelel a lenti pontoknak. Ha itt a fájlnév nem a cím, írd fel (a Safari nem mindig küld nyomtatás előtti eseményt).

**A PDF-oldal (SPEC 6.4):**

8. ☐ Levélfej: „Hunyadi Mátyás Általános Iskola · Művészeti képzés”, jobbra a tanév („2026/2027-es tanév”), alatta bordó vonal. Ha a Sheetben üres a Tanév, a tanév kimarad.
9. ☐ Cím: „MŰVÉSZETI ÓRAREND”, alatta a képernyős eredménycím, jobbra a darabszám („{n} foglalkozás hetente”, ugyanannyi, mint a képernyőn).
10. ☐ Rács: bal oldalt az órák („7. ÓRA”, kezdés, vége), felül Hétfő–Péntek; az Órák fül minden órájára egy egyforma magas sor, akkor is, ha az osztálynak abban az órában nincs foglalkozása (szaggatott üres cella).
11. ☐ Az órakártyák a tanszak színével (halvány kitöltés, sötétebb keret), dupla óra két sort fog át. Szöveg: név, időpont, alul tanár és terem (ami a Sheetben hiányzik, az kimarad).
12. ☐ Csak a kijelölt tanszakok kártyái vannak rajta; tanszak-„Összes”-nél az osztály minden foglalkozása.
13. ☐ Átfedő órák (pl. 4.a kedd 8–9. és 9. óra, csütörtök 7–8. és 8–9. óra): a kártyák a nap oszlopában **egymás mellett**, egyforma széles sávokban állnak, mindegyik a saját óráin. A csoport fölött egyetlen „VÁLASZTHATÓ” felirat fut a nap oszlopán, vékony zárójellel. A keskeny kártyákon nincs időpont (az óraoszlop mutatja). Semmilyen szöveg nincs levágva; a hosszú szó csak szótaghatáron, kötőjellel törik („Képző-művészet”, „nagytornate-rem”), betű közben soha.
14. ☐ Bizonytalan sor: a név után „?”, és a lábléc fölött: „? = az adat pontosítás alatt”. Bizonytalan sor nélkül ez a sor nincs ott.
15. ☐ Lábléc: „Hunyadi Mátyás Általános Iskola · Művészeti képzés”.
16. ☐ A PDF-ben a szöveg kijelölhető és kereshető (pl. keress rá: „Kerámia”).
17. ☐ A tanszakszínek megmaradnak (a „Háttérgrafika” / „Background graphics” opció nélkül is).
18. ☐ **Szürkeárnyalatos nyomtatás** (a párbeszédben Színes → Fekete-fehér, vagy valódi nyomtató): minden kártya olvasható, a tanszak nevéből azonosítható; a keretek és a szaggatott üres cellák látszanak.
19. ☐ A böngésző saját fejléce/lábléce (URL, dátum) a párbeszédben kikapcsolható („Fejlécek és láblécek”); bekapcsolva sem tolja a tartalmat második oldalra.

Ismert korlát: ha egy osztálynál egy idősávba **három vagy több** foglalkozás esik (a mostani adatban legfeljebb kettő), a sávok nagyon keskenyek; hosszú teljes tanárnévvel egy-egy sor levágódhat. Ilyenkor nézd meg az adott osztály PDF-jét.

## K. Ami nem lehet az oldalon (8.18)

1. ☐ Nincs (SPEC 1. „Nincs benne”): navigációs menü, eseménynaptár, hírek, kapcsolat oldal, oldalsó vagy alsó lábléc-menü, belépés, jelentkezés; több gyerek (gyerekprofilok, családi nézet), időütközés-jelzés, naptár-feliratkozás (.ics); tanári és teremnézet; sötét mód (sötét rendszertémában is világos marad az oldal). Analitika és külső script sincs (CLAUDE.md).
2. ☐ A tanárok neve csak keresztnév (ahogy a Sheetben áll). Ha teljes név jelenik meg, azt a Sheetben kell javítani, nem a kódban.
