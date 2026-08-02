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

A más weboldalakon látott automatikus bannerek **nem** kézzel kerülnek fel: egy
hirdetési hálózat (legtöbbször **Google AdSense**) tölti be őket.

### 1) Google AdSense (mint a legtöbb oldalon)

1. Regisztráció: https://www.google.com/adsense/
2. Add hozzá a domainedet, várj a jóváhagyásra (néha napok / hetek).
3. Hozz létre hirdetési egységeket (Display / reszponzív).
4. Írd be a kiadóazonosítót és a slot ID-kat a `data/ads.json`-ba:

```json
"adsense": {
  "enabled": true,
  "client": "ca-pub-XXXXXXXXXXXXXXXX",
  "units": {
    "mid": "1234567890",
    "footer": "0987654321"
  }
}
```

Alternatíva környezeti változókkal:

```bash
ADSENSE_ENABLED=true
ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
ADSENSE_SLOT_MID=1234567890
ADSENSE_SLOT_FOOTER=0987654321
```

Ha az AdSense egy sloton be van kapcsolva, ott a partner-banner helyett a Google
hirdetése jelenik meg.

### 2) Partner hirdetés (`data/ads.json` → `ads` tömb)

Közvetlen, saját szöveges megjelenés (pl. szponzor):

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
- Kapcsolati e-mail: `contactEmail`, vagy `ADS_CONTACT_EMAIL`

### 3) Hirdetésfeladás az oldalról

A látogatók a **Hirdetés** szekcióban (`/#hirdetes`) kérhetnek partner-megjelenést.
A beküldések a `data/ad-inquiries.json` fájlba kerülnek (gitben nincs nyomon követve).

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
