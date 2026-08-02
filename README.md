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
- Szponzorált hirdetések + hirdetésfeladási űrlap

## Adatforrás

Az API az OVF **Hydroinfo** nyilvános HTML tábláit olvassa be:

- Napi tábla: https://www.hydroinfo.hu/tables/dunhid.html
- Éves reggeli sorok: `https://www.hydroinfo.hu/Html/hidinfo/AktualisEvesTb/tb{ÁLLOMÁSKÓD}.htm`

A hivatalos **VRAQuery** API (`https://vmservice.vizugy.hu/vraquery`) autentikált hozzáférést igényel. Amíg nincs token bekötve, a Hydroinfo scraping a működő nyilvános út. Ha a scrape sikertelen, az API demó/mock adatokra esik vissza.

### Győr megjegyzés

A „Győr” városi vízmérce a Rábán van. A Dunai szakaszhoz az oldal a **Gönyű** állomást használja (`Győr (Gönyű)`).

## Hirdetések

Két mód van hirdetés megjelenítésére:

### 1) Partner hirdetés (`data/ads.json`)

Szerkeszd a `data/ads.json` fájlt, majd indítsd újra / frissítsd az oldalt:

```json
{
  "id": "partner-1",
  "slot": "mid",
  "active": true,
  "title": "Címsor",
  "body": "Rövid szöveg",
  "cta": "Megnézem",
  "url": "https://pelda.hu",
  "sponsor": "Partner neve",
  "startsAt": "2026-08-01T00:00:00Z",
  "endsAt": "2026-09-01T00:00:00Z"
}
```

- `slot`: `mid` (állomások után) vagy `footer` (lábléc előtt)
- `active: false` → ideiglenes kikapcsolás
- `startsAt` / `endsAt` → opcionális időablak (ISO dátum)
- Kapcsolati e-mail: `contactEmail` a JSON-ban, vagy `ADS_CONTACT_EMAIL` környezeti változó

### 2) Hirdetésfeladás az oldalról

A látogatók a **Hirdetés** szekcióban (`/#hirdetes`) kérhetnek megjelenést. A beküldések a szerveren a `data/ad-inquiries.json` fájlba kerülnek (ez a gitben nincs nyomon követve).

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

## API

| Végpont | Leírás |
| --- | --- |
| `GET /api/levels` | Aktuális állomásadatok + 30 napos történet |
| `GET /api/levels?force=1` | Cache megkerülése, azonnali újraolvasás |
| `GET /api/stations` | Állomás metaadatok (küszöbök, koordináták) |
| `GET /api/health` | Egészség / cache infó |
| `GET /api/ads` | Aktív hirdetések a slotokra |
| `POST /api/ads/inquiry` | Hirdetésfeladási érdeklődés (JSON: name, email, message, …) |

## Technológia

- Node.js + Express backend (scrape + 10 perces cache)
- Statikus HTML / CSS / JS frontend
- Leaflet + Chart.js (CDN)

## Jogi / felelősség

Az adatok tájékoztató jellegűek. Döntésekhez mindig az OVF / vizugy.hu / hydroinfo.hu hivatalos közléseit ellenőrizd.
