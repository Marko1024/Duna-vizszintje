# Duna Vízállás

Élő weboldal a Duna magyarországi vízállásáról — Budapest, Nagymaros, Mohács, Baja, Dunaújváros, Győr (Gönyű) és Esztergom mérőállomásokkal.

## Funkciók

- Kártyás nézet: aktuális vízállás (cm), 24 órás / 7 napos változás, trend nyíllal
- Színkódolás: kisvíz / normál / I–III. árvízfokozat (LKV, KV, LNV és készültségi küszöbök alapján)
- Interaktív grafikon (7 / 30 nap), opcionális 2002-es és 2013-as árvíz-szintekkel
- Leaflet térkép az állomásokkal
- Automatikus óránkénti frissítés + manuális frissítés gomb
- Reszponzív, mobilbarát felület
- Böngésző-riasztás küszöbre (localStorage)

## Adatforrás — hogyan van bekötve az API?

**Elsődleges:** OVF **VRAQuery** API (`https://vmservice.vizugy.hu/vraquery`)

| Lépés | Mit csinál |
| --- | --- |
| 1. Token | Nyilvános open-data JWT a `https://data.vizugy.hu/AuthApi/auth/token` végpontról (`Origin: https://data.vizugy.hu`) |
| 2. Idősor | `POST /TS/TsShortList` — `AdatFajtaKod=68` (Felszíni vízállás), `AdatTipusKod=100` (operatív) |
| 3. Állomások | VRA törzsszámok: Gönyű `4`, Esztergom `8`, Nagymaros `1020`, Budapest `1026`, Dunaújváros `547`, Baja `1344`, Mohács `831` |

**Fallback:** Hydroinfo HTML scrape → ha az is elbukik: mock adatok.

Swagger: https://vmservice.vizugy.hu/vraquery/swagger/index.html

### Hivatalos felhasználó (opcionális)

Ha kapsz OVF / vizügy fiókot:

```bash
# .env.local / Vercel Environment Variables
VIZUGY_USERNAME=...
VIZUGY_PASSWORD=...
# vagy kész token:
VIZUGY_ACCESS_TOKEN=eyJ...
```

A kliens sorrendje: `VIZUGY_ACCESS_TOKEN` → username/password Login → open-data token.

Adatforrás kényszerítése:

```bash
DATA_SOURCE=auto        # alapértelmezett: VRA → hydroinfo → mock
DATA_SOURCE=vra         # csak VRAQuery
DATA_SOURCE=hydroinfo   # csak HTML scrape
```

### Győr megjegyzés

A „Győr” városi vízmérce a Rábán van. A Dunai szakaszhoz az oldal a **Gönyű** állomást használja (`Győr (Gönyű)`).

## Indítás

```bash
npm install
npm start
```

Megnyitás: http://localhost:3000

```bash
npm run scrape   # élő forrás teszt terminálban
```

## Keresőoptimalizálás (SEO)

Az élő oldal:
- dinamikus `<title>` / description (pl. „Duna vízállás Budapest: 11 cm”)
- JSON-LD (WebSite, FAQ, állomások)
- `robots.txt` + `sitemap.xml`
- szerveroldali HTML-tábla a crawlernek (JS nélkül is indexelhető)

**Google Search Console** (egyszeri, a saját fiókodban):
1. Nyisd meg: https://search.google.com/search-console
2. Add hozzá a tulajdont: `https://duna-vizszint.vercel.app`
3. Küldd be a sitemapet: `https://duna-vizszint.vercel.app/sitemap.xml`
4. Opcionálisan kérj indexelést a kezdőlapra

Saját domain (pl. `dunavizallas.hu`) a Vercel Domains menüben tovább erősíti a keresési láthatóságot.

## Google AdSense (hirdetések)

A verifikációs script és az `ads.txt` bent van az oldalon. **A verifikáció önmagában még nem jelenít meg hirdetést.**

### 1) Automatikus hirdetések (legegyszerűbb)

1. AdSense → **Ads** → **By site** → `duna-vizszint.vercel.app`
2. Kapcsold be az **Auto ads** kapcsolót, mentsd
3. Várj (gyakran órák–napok), amíg a Google elkezd kitölteni

Ellenőrzés: https://duna-vizszint.vercel.app/ads.txt  
tartalmaznia kell: `google.com, pub-9316553426322212, DIRECT, f08c47fec0942fa0`

### 2) Manuális Display egységek (opcionális)

1. AdSense → Ads → **By ad unit** → Display → hozd létre
2. Másold a **slot ID** számot (csak számok)
3. Vercel → Project → Settings → Environment Variables:

```bash
ADSENSE_SLOT_MID=1234567890
ADSENSE_SLOT_FOOTER=0987654321
```

4. Redeploy / Promote to Production

Ha mégsem látszik: kapcsold ki az adblockert, nézd inkognitóban, és ellenőrizd az AdSense-ben, hogy a site státusza **Ready** (ne „Getting ready”).

## Vercel

Élő URL: **https://duna-vizszint.vercel.app**

```bash
npx vercel --prod --yes
```

Opcionális env a Vercel dashboardon: `VIZUGY_USERNAME`, `VIZUGY_PASSWORD`, `VIZUGY_ACCESS_TOKEN`, `DATA_SOURCE`, `ADSENSE_SLOT_MID`, `ADSENSE_SLOT_FOOTER`.

## API

| Végpont | Leírás |
| --- | --- |
| `GET /api/levels` | Aktuális állomásadatok + 30 napos történet |
| `GET /api/levels?force=1` | Cache megkerülése |
| `GET /api/stations` | Állomás metaadatok |
| `GET /api/health` | Cache + VRA token állapot |

## Technológia

- Node.js + Express (`server.js` + `server/vra.js` + `server/scrape.js`)
- Leaflet + Chart.js frontend

## Jogi / felelősség

Az adatok tájékoztató jellegűek. Döntésekhez mindig az OVF / vizugy.hu / hydroinfo.hu hivatalos közléseit ellenőrizd.
