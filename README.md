# Duna Vízállás

Élő weboldal a Duna magyarországi vízállásáról — Budapest, Nagymaros, Mohács, Baja, Dunaújváros, Győr (Gönyű) és Esztergom mérőállomásokkal.

## Funkciók

- Kártyás nézet: aktuális vízállás (cm), 24 órás / 7 napos változás, trend nyíllal
- Színkódolás: kisvíz / normál / I–III. árvízfokozat (LKV, KV, LNV és készültségi küszöbök alapján)
- Interaktív grafikon (7 / 30 nap), opcionális 2002-es és 2013-as árvíz-szintekkel
- Leaflet térkép az állomásokkal
- Automatikus óránkénti frissítés + manuális frissítés gomb
- Reszponzív, mobilbarát felület
- Böngésző-riasztás küszöbre (localStorage); e-mail mező helyi mentéssel (küldéshez külön szolgáltatás kell)

## Adatforrás

Az API az OVF **Hydroinfo** nyilvános HTML tábláit olvassa be:

- Napi tábla: https://www.hydroinfo.hu/tables/dunhid.html
- Éves reggeli sorok: `https://www.hydroinfo.hu/Html/hidinfo/AktualisEvesTb/tb{ÁLLOMÁSKÓD}.htm`

A hivatalos **VRAQuery** API (`https://vmservice.vizugy.hu/vraquery`) autentikált hozzáférést igényel. Amíg nincs token bekötve, a Hydroinfo scraping a működő nyilvános út. Ha a scrape sikertelen, az API demó/mock adatokra esik vissza.

### Győr megjegyzés

A „Győr” városi vízmérce a Rábán van. A Dunai szakaszhoz az oldal a **Gönyű** állomást használja (`Győr (Gönyű)`).

## Indítás

```bash
npm install
npm start
```

Megnyitás: http://localhost:3000

Fejlesztői mód (auto-reload):

```bash
npm run dev
```

Gyors scrape-teszt terminálban:

```bash
npm run scrape
```

## Vercel deploy

Élő production URL: **https://duna-vizszint.vercel.app**

A gyökér `server.js` Express belépési pontot exportál (Vercel Node backend).

```bash
npx vercel login
npx vercel --prod --yes
```

Vagy a GitHub repo összekötése után a Vercel dashboardon: **Add New Project** → `Duna-vizszintje`.

## API

| Végpont | Leírás |
| --- | --- |
| `GET /api/levels` | Aktuális állomásadatok + 30 napos történet |
| `GET /api/levels?force=1` | Cache megkerülése, azonnali újraolvasás |
| `GET /api/stations` | Állomás metaadatok (küszöbök, koordináták) |
| `GET /api/health` | Egészség / cache infó |

## Technológia

- Node.js + Express backend (scrape + 10 perces cache)
- Statikus HTML / CSS / JS frontend
- Leaflet + Chart.js (CDN)

## Jogi / felelősség

Az adatok tájékoztató jellegűek. Döntésekhez mindig az OVF / vizugy.hu / hydroinfo.hu hivatalos közléseit ellenőrizd.
