/**
 * OVF VRAQuery kliens.
 *
 * Auth lehetőségek (sorrendben):
 * 1. VIZUGY_ACCESS_TOKEN — kész JWT
 * 2. VIZUGY_USERNAME + VIZUGY_PASSWORD — /Login/Authenticate
 * 3. Nyilvános open-data token — data.vizugy.hu/AuthApi/auth/token
 *    (opendatauser, Origin: https://data.vizugy.hu)
 *
 * Swagger: https://vmservice.vizugy.hu/vraquery/swagger/index.html
 */

import { STATIONS, classifyLevel, trendFromChange } from "./stations.js";

const VRA_BASE =
  process.env.VIZUGY_VRA_URL || "https://vmservice.vizugy.hu/vraquery";
const TOKEN_URL =
  process.env.VIZUGY_TOKEN_URL || "https://data.vizugy.hu/AuthApi/auth/token";

/** Felszíni vízállás (cm) */
export const ADAT_FAJTA_VIZALLAS = 68;
/** Operatív idősor */
export const ADAT_TIPUS_OPERATIV = 100;

const UA = "Mozilla/5.0 (compatible; DunaVizszint/1.0)";

let tokenCache = { token: null, expiresAt: 0 };

function decodeJwtExp(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8")
    );
    return payload.exp ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${url}: ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Hivatalos felhasználónév/jelszó → JWT */
async function loginWithCredentials(username, password) {
  const data = await fetchJson(`${VRA_BASE}/Login/Authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Username: username, Password: password }),
  });
  const token = data?.Token || data?.token;
  if (!token) throw new Error("Login/Authenticate nem adott Token mezőt");
  return token;
}

/** Nyilvános open-data token (opendatauser) */
async function loginWithOpenDataToken() {
  const res = await fetch(TOKEN_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Origin: "https://data.vizugy.hu",
      Referer: "https://data.vizugy.hu/",
      "User-Agent": UA,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Open-data token HTTP ${res.status}`);
  const data = await res.json();
  const token = data.access_token || data.Token || data.token;
  if (!token) throw new Error("Open-data válaszban nincs access_token");
  return token;
}

export async function getAccessToken({ force = false } = {}) {
  const now = Date.now();
  if (!force && tokenCache.token && now < tokenCache.expiresAt - 30_000) {
    return tokenCache.token;
  }

  let token = process.env.VIZUGY_ACCESS_TOKEN || null;
  let source = "env:VIZUGY_ACCESS_TOKEN";

  if (!token && process.env.VIZUGY_USERNAME && process.env.VIZUGY_PASSWORD) {
    token = await loginWithCredentials(
      process.env.VIZUGY_USERNAME,
      process.env.VIZUGY_PASSWORD
    );
    source = "Login/Authenticate";
  }

  if (!token) {
    token = await loginWithOpenDataToken();
    source = "data.vizugy.hu open-data";
  }

  const exp = decodeJwtExp(token) || now + 14 * 60 * 1000;
  tokenCache = { token, expiresAt: exp, source };
  return token;
}

export function getTokenInfo() {
  return {
    hasToken: Boolean(tokenCache.token),
    source: tokenCache.source || null,
    expiresAt: tokenCache.expiresAt
      ? new Date(tokenCache.expiresAt).toISOString()
      : null,
  };
}

function changeAt(seriesHourly, levelCm, hoursAgo) {
  if (levelCm == null || !seriesHourly?.length) return null;
  const target = Date.now() - hoursAgo * 3600 * 1000;
  let best = null;
  let bestDist = Infinity;
  for (const p of seriesHourly) {
    const ms = Date.parse(p.at);
    const dist = Math.abs(ms - target);
    if (dist < bestDist && dist <= 6 * 3600 * 1000) {
      best = p;
      bestDist = dist;
    }
  }
  if (!best) return null;
  return Math.round((levelCm - best.valueCm) * 10) / 10;
}

/** Órás sor → napi átlagolt történet a grafikonhoz. */
function toDailySeries(hourly, days = 30) {
  const cutoff = Date.now() - days * 86400000;
  const byDay = new Map();
  for (const p of hourly) {
    const ms = Date.parse(p.at);
    if (ms < cutoff) continue;
    const day = p.at.slice(0, 10);
    const bucket = byDay.get(day) || [];
    bucket.push(p.valueCm);
    byDay.set(day, bucket);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      valueCm: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
    }));
}

/**
 * VRA operatív vízállás lekérés mind a 7 állomásra.
 * @returns {Promise<{stations: object[], meta: object}>}
 */
export async function fetchVraLevels({ days = 30 } = {}) {
  const token = await getAccessToken();
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);

  const body = {
    TorzsszamList: STATIONS.map((s) => s.vraTorzsszam),
    AdatFajtaKod: ADAT_FAJTA_VIZALLAS,
    AdatTipusKod: ADAT_TIPUS_OPERATIV,
    StartTime: start.toISOString(),
    EndTime: end.toISOString(),
  };

  const raw = await fetchJson(`${VRA_BASE}/TS/TsShortList`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const byTorzs = new Map();
  for (const item of raw || []) {
    const list = item.TsItemList || [];
    const hourly = list
      .filter((x) => x.Adat != null && x.UTCTime)
      .map((x) => ({ at: x.UTCTime, valueCm: Number(x.Adat) }))
      .sort((a, b) => a.at.localeCompare(b.at));
    byTorzs.set(item.ItemId, hourly);
  }

  let latestAt = null;
  const stations = STATIONS.map((meta) => {
    const hourly = byTorzs.get(meta.vraTorzsszam) || [];
    const last = hourly[hourly.length - 1] || null;
    const levelCm = last ? last.valueCm : null;
    if (last?.at && (!latestAt || last.at > latestAt)) latestAt = last.at;

    const change24hCm = changeAt(hourly, levelCm, 24);
    const change7dCm = changeAt(hourly, levelCm, 24 * 7);
    const historySeries = toDailySeries(hourly, days);
    const classification = classifyLevel(levelCm, meta.thresholds);
    const trend = trendFromChange(change24hCm);

    return {
      ...meta,
      levelCm,
      levelYesterdayCm:
        levelCm != null && change24hCm != null
          ? Math.round((levelCm - change24hCm) * 10) / 10
          : null,
      change24hCm,
      change7dCm,
      dischargeM3s: null,
      temperatureC: null,
      ...classification,
      ...trend,
      historySeries,
      lastObservationAt: last?.at ?? null,
      source: "vraquery",
    };
  });

  const withData = stations.filter((s) => s.levelCm != null).length;
  if (withData === 0) {
    throw new Error("VRAQuery nem adott vissza vízállás-adatot");
  }

  return {
    stations,
    meta: {
      mode: "live",
      source: "OVF VRAQuery (vmservice.vizugy.hu) — operatív felszíni vízállás",
      sourceUrl: `${VRA_BASE}/swagger/index.html`,
      auth: getTokenInfo().source,
      observedAt: latestAt
        ? new Date(latestAt).toLocaleString("hu-HU", { timeZone: "Europe/Budapest" })
        : null,
      note:
        "Az adatok az OVF VRAQuery nyilvános / open-data API-jából származnak (AdatFajta 68, AdatTipus 100). Tájékoztató jellegűek.",
    },
  };
}

export function isVraEnabled() {
  // Alapból bekapcsolva; kikapcsolható DATA_SOURCE=hydroinfo|mock
  const src = (process.env.DATA_SOURCE || "auto").toLowerCase();
  return src === "auto" || src === "vra" || src === "vraquery";
}
