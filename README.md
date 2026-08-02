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

## Vercel

Élő URL: **https://duna-vizszint.vercel.app**

```bash
npx vercel --prod --yes
```

Opcionális env a Vercel dashboardon: `VIZUGY_USERNAME`, `VIZUGY_PASSWORD`, `VIZUGY_ACCESS_TOKEN`, `DATA_SOURCE`.

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
