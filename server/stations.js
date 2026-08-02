/**
 * Fő Duna-mérőállomások metaadatai.
 * hydroCode: OVF/hydroinfo.hu állomáskód (tables/dunhid.html)
 * Küszöbök: közzétett árvízvédelmi fokozatok + jellegzetes vízállások (LKV/KV/LNV).
 * Győr: a városi vízmérce a Rábán van; a Dunai szakaszhoz a Gönyű állomást használjuk.
 */

export const STATIONS = [
  {
    id: "gyor",
    name: "Győr (Gönyű)",
    shortName: "Győr",
    river: "Duna",
    hydroCode: "442521",
    vraTorzsszam: 4,
    lat: 47.7328,
    lon: 17.8256,
    riverKm: 1790.7,
    thresholds: {
      lkv: -90,
      kv: 180,
      lnv: 780,
      iFok: 550,
      iiFok: 650,
      iiiFok: 750,
    },
    history: {
      flood2002: 720,
      flood2013: 760,
    },
  },
  {
    id: "esztergom",
    name: "Esztergom",
    shortName: "Esztergom",
    river: "Duna",
    hydroCode: "442025",
    vraTorzsszam: 8,
    lat: 47.7925,
    lon: 18.7403,
    riverKm: 1718.2,
    thresholds: {
      lkv: -80,
      kv: 160,
      lnv: 760,
      iFok: 500,
      iiFok: 600,
      iiiFok: 700,
    },
    history: {
      flood2002: 710,
      flood2013: 770,
    },
  },
  {
    id: "nagymaros",
    name: "Nagymaros",
    shortName: "Nagymaros",
    river: "Duna",
    hydroCode: "442527",
    vraTorzsszam: 1020,
    lat: 47.7894,
    lon: 18.9542,
    riverKm: 1694.6,
    thresholds: {
      lkv: -100,
      kv: 140,
      lnv: 740,
      iFok: 500,
      iiFok: 600,
      iiiFok: 700,
    },
    history: {
      flood2002: 690,
      flood2013: 745,
    },
  },
  {
    id: "budapest",
    name: "Budapest",
    shortName: "Budapest",
    river: "Duna",
    hydroCode: "442027",
    vraTorzsszam: 1026,
    lat: 47.4955,
    lon: 19.0488,
    riverKm: 1646.5,
    thresholds: {
      lkv: -51,
      kv: 250,
      lnv: 1035,
      iFok: 620,
      iiFok: 700,
      iiiFok: 800,
    },
    history: {
      flood2002: 848,
      flood2013: 891,
      quayFlood: 645,
    },
  },
  {
    id: "dunaujvaros",
    name: "Dunaújváros",
    shortName: "Dunaújváros",
    river: "Duna",
    hydroCode: "442028",
    vraTorzsszam: 547,
    lat: 46.9642,
    lon: 18.9353,
    riverKm: 1580.6,
    thresholds: {
      lkv: -150,
      kv: 120,
      lnv: 780,
      iFok: 550,
      iiFok: 650,
      iiiFok: 750,
    },
    history: {
      flood2002: 720,
      flood2013: 770,
    },
  },
  {
    id: "baja",
    name: "Baja",
    shortName: "Baja",
    river: "Duna",
    hydroCode: "442031",
    vraTorzsszam: 1344,
    lat: 46.1828,
    lon: 18.9536,
    riverKm: 1478.7,
    thresholds: {
      lkv: -50,
      kv: 280,
      lnv: 980,
      iFok: 650,
      iiFok: 800,
      iiiFok: 900,
    },
    history: {
      flood2002: 910,
      flood2013: 970,
    },
  },
  {
    id: "mohacs",
    name: "Mohács",
    shortName: "Mohács",
    river: "Duna",
    hydroCode: "442032",
    vraTorzsszam: 831,
    lat: 45.9931,
    lon: 18.6831,
    riverKm: 1446.9,
    thresholds: {
      lkv: -40,
      kv: 300,
      lnv: 984,
      iFok: 700,
      iiFok: 850,
      iiiFok: 950,
    },
    history: {
      flood2002: 930,
      flood2013: 984,
    },
  },
];

export const STATION_BY_CODE = Object.fromEntries(
  STATIONS.map((s) => [s.hydroCode, s])
);

export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

/** Vízállás státusz a küszöbök alapján. */
export function classifyLevel(levelCm, thresholds) {
  if (levelCm == null || Number.isNaN(levelCm)) {
    return { status: "unknown", label: "Nincs adat", degree: null };
  }

  if (levelCm >= thresholds.iiiFok) {
    return { status: "flood3", label: "III. fokú árvíz", degree: 3 };
  }
  if (levelCm >= thresholds.iiFok) {
    return { status: "flood2", label: "II. fokú árvíz", degree: 2 };
  }
  if (levelCm >= thresholds.iFok) {
    return { status: "flood1", label: "I. fokú árvíz", degree: 1 };
  }
  if (levelCm <= thresholds.lkv + 30 || levelCm < thresholds.kv * 0.35) {
    return { status: "low", label: "Kisvíz", degree: null };
  }
  return { status: "normal", label: "Normál", degree: null };
}

export function trendFromChange(change24h) {
  if (change24h == null || Number.isNaN(change24h)) {
    return { trend: "unknown", trendLabel: "—", arrow: "•" };
  }
  if (change24h >= 5) {
    return { trend: "rising", trendLabel: "Emelkedik", arrow: "↑" };
  }
  if (change24h <= -5) {
    return { trend: "falling", trendLabel: "Csökken", arrow: "↓" };
  }
  return { trend: "stable", trendLabel: "Stabil", arrow: "→" };
}
