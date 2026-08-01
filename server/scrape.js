import { parse } from "node-html-parser";
import {
  STATIONS,
  STATION_BY_CODE,
  classifyLevel,
  trendFromChange,
} from "./stations.js";

const HYDROINFO_TABLE =
  "https://www.hydroinfo.hu/tables/dunhid.html";
const YEARLY_URL = (code) =>
  `https://www.hydroinfo.hu/Html/hidinfo/AktualisEvesTb/tb${code}.htm`;

const UA =
  "Mozilla/5.0 (compatible; DunaVizszint/1.0; +https://github.com/duna-vizszint)";

let cache = {
  fetchedAt: 0,
  payload: null,
  error: null,
};

const CACHE_TTL_MS = 10 * 60 * 1000;

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const utf8 = buf.toString("utf8");
      // Prefer UTF-8 when the page declares it or content looks clean.
      if (
        !utf8.includes("�") &&
        /charset\s*=\s*utf-8|Állomás|NAP\s+JAN|Duna/i.test(utf8)
      ) {
        return utf8;
      }
      return buf.toString("latin1");
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(250 * attempt);
    }
  }
  throw lastErr;
}

/** Hydroinfo néha eldobja a párhuzamos kapcsolatokat — korlátozott párhuzamosság. */
async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => run()
  );
  await Promise.all(runners);
  return results;
}

function parseNumber(raw) {
  if (raw == null) return null;
  const s = String(raw)
    .replace(/\u00a0/g, " ")
    .replace(",", ".")
    .trim();
  if (!s || s === "//" || s === "…" || s === "..." || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&ouml;/g, "ö")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&aacute;/g, "á")
    .replace(/&Aacute;/g, "Á")
    .replace(/&eacute;/g, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&iacute;/g, "í")
    .replace(/&Iacute;/g, "Í")
    .replace(/&oacute;/g, "ó")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&#369;/g, "ű")
    .replace(/&#367;/g, "ű")
    .replace(/&#337;/g, "ő")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Napi tábla scrape – aktuális + tegnapi vízállás, 24h változás. */
export function parseDailyTable(html) {
  const root = parse(html);
  const observedMatch =
    html.match(/Észlelés:\s*([^<]+)/i) ||
    html.match(/&Eacute;szlel&eacute;s:\s*([^<]+)/i) ||
    html.match(/szlel[^:]*:\s*([0-9]{4}\.[^<]+)/i);
  const observedAt = observedMatch
    ? decodeEntities(observedMatch[1]).trim()
    : null;

  const rows = root.querySelectorAll("tr");
  const byCode = {};

  for (const row of rows) {
    const cells = row.querySelectorAll("td").map((td) =>
      decodeEntities(td.text.replace(/\s+/g, " "))
    );
    if (cells.length < 7) continue;
    const code = cells[0];
    if (!/^\d{6}$/.test(code)) continue;
    if (!STATION_BY_CODE[code]) continue;

    // Állomáskód | Név | Folyó | tegnap | este? | ma | változás | hozam | hő | jég
    const yesterday = parseNumber(cells[3]);
    const eveningOrMid = parseNumber(cells[4]);
    const today = parseNumber(cells[5]);
    const change24h = parseNumber(cells[6]);
    const discharge = parseNumber(cells[7]);
    const temperature = parseNumber(cells[8]);

    byCode[code] = {
      hydroCode: code,
      nameRaw: cells[1],
      river: cells[2],
      levelYesterdayCm: yesterday,
      levelEveningCm: eveningOrMid,
      levelCm: today ?? eveningOrMid ?? yesterday,
      change24hCm: change24h,
      dischargeM3s: discharge,
      temperatureC: temperature,
    };
  }

  return { observedAt, byCode };
}

/** Éves reggeli vízállás tábla → napi idősor. */
export function parseYearlyTable(html, hydroCode) {
  const yearMatch = html.match(/ÉV:\s*(\d{4})/i);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

  const lines = html
    .replace(/<[^>]+>/g, "\n")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const headerIdx = lines.findIndex((l) => /^NAP\s+JAN/i.test(l));
  if (headerIdx < 0) return { year, series: [] };

  const series = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^(Min\.|Átlag|Max\.|ÉVES)/i.test(line)) break;
    const parts = line.split(/\s+/).filter(Boolean);
    if (!parts.length || !/^\d{1,2}$/.test(parts[0])) continue;
    const day = Number(parts[0]);
    const monthKeys = [
      "JAN",
      "FEB",
      "MÁR",
      "ÁPR",
      "MÁJ",
      "JÚN",
      "JÚL",
      "AUG",
      "SZE",
      "OKT",
      "NOV",
      "DEC",
    ];
    for (let m = 0; m < 12; m++) {
      const raw = parts[m + 1];
      if (raw == null || raw === "..." || raw === "…") continue;
      const value = parseNumber(raw);
      if (value == null) continue;
      const month = m + 1;
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      // skip invalid calendar dates
      const dt = new Date(`${date}T12:00:00Z`);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getUTCMonth() + 1 !== month) continue;
      series.push({ date, valueCm: value });
    }
  }

  series.sort((a, b) => a.date.localeCompare(b.date));
  return { year, hydroCode, series };
}

function weeklyChange(series, levelCm) {
  if (levelCm == null || !series?.length) return null;
  const target = new Date();
  target.setDate(target.getDate() - 7);
  const targetMs = Date.parse(`${target.toISOString().slice(0, 10)}T12:00:00Z`);
  let best = null;
  let bestDist = Infinity;
  for (const p of series) {
    const ms = Date.parse(`${p.date}T12:00:00Z`);
    const dist = Math.abs(ms - targetMs);
    // accept points within ~3 days of the 7-day mark
    if (dist < bestDist && dist <= 3 * 86400000) {
      best = p;
      bestDist = dist;
    }
  }
  if (!best) {
    const key = target.toISOString().slice(0, 10);
    best = [...series].reverse().find((p) => p.date <= key) ?? null;
  }
  if (!best) return null;
  return Math.round((levelCm - best.valueCm) * 10) / 10;
}

function buildMockStations() {
  const base = [
    ["gyor", -70],
    ["esztergom", -39],
    ["nagymaros", -83],
    ["budapest", 17],
    ["dunaujvaros", -101],
    ["baja", -13],
    ["mohacs", 2],
  ];
  const today = new Date();
  return base.map(([id, level], idx) => {
    const meta = STATIONS.find((s) => s.id === id);
    const change24h = [-5, -3, -3, -2, -3, -4, -4][idx];
    const series = [];
    for (let d = 29; d >= 0; d--) {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - d);
      const wobble = Math.round(Math.sin(d / 3 + idx) * 12 + (30 - d) * 0.4);
      series.push({
        date: dt.toISOString().slice(0, 10),
        valueCm: level + wobble,
      });
    }
    const classification = classifyLevel(level, meta.thresholds);
    const trend = trendFromChange(change24h);
    return {
      ...meta,
      levelCm: level,
      levelYesterdayCm: level - change24h,
      change24hCm: change24h,
      change7dCm: weeklyChange(series, level),
      dischargeM3s: null,
      temperatureC: null,
      ...classification,
      ...trend,
      historySeries: series,
      source: "mock",
    };
  });
}

export async function fetchLiveData({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache.payload && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { ...cache.payload, cached: true };
  }

  try {
    const tableHtml = await fetchText(HYDROINFO_TABLE);
    const { observedAt, byCode } = parseDailyTable(tableHtml);

    const yearlyResults = await mapPool(STATIONS, 2, async (station) => {
      try {
        const html = await fetchText(YEARLY_URL(station.hydroCode));
        return parseYearlyTable(html, station.hydroCode);
      } catch (err) {
        return {
          year: new Date().getFullYear(),
          hydroCode: station.hydroCode,
          series: [],
          error: String(err.message || err),
        };
      }
    });

    const yearlyByCode = Object.fromEntries(
      yearlyResults.map((y) => [y.hydroCode, y])
    );

    const stations = STATIONS.map((meta) => {
      const live = byCode[meta.hydroCode] || {};
      const yearly = yearlyByCode[meta.hydroCode];
      const series = yearly?.series ?? [];
      const levelCm = live.levelCm ?? null;
      const change24hCm = live.change24hCm ?? null;
      const classification = classifyLevel(levelCm, meta.thresholds);
      const trend = trendFromChange(change24hCm);

      // last 30 days of yearly series
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffKey = cutoff.toISOString().slice(0, 10);
      const historySeries = series.filter((p) => p.date >= cutoffKey);

      return {
        ...meta,
        levelCm,
        levelYesterdayCm: live.levelYesterdayCm ?? null,
        change24hCm,
        change7dCm: weeklyChange(series, levelCm),
        dischargeM3s: live.dischargeM3s ?? null,
        temperatureC: live.temperatureC ?? null,
        ...classification,
        ...trend,
        historySeries,
        source: "hydroinfo",
      };
    });

    const missing = stations.filter((s) => s.levelCm == null).length;
    if (missing === stations.length) {
      throw new Error("A hydroinfo táblából nem sikerült állomásadatot kinyerni");
    }

    const payload = {
      ok: true,
      mode: "live",
      source: "OVF Hydroinfo (hydroinfo.hu/tables/dunhid.html)",
      sourceUrl: HYDROINFO_TABLE,
      observedAt,
      fetchedAt: new Date().toISOString(),
      stations,
      note:
        "Az adatok az Országos Vízügyi Főigazgatóság (OVF) nyilvános Hydroinfo tábláiból származnak. Tájékoztató jellegűek.",
    };

    cache = { fetchedAt: now, payload, error: null };
    return { ...payload, cached: false };
  } catch (err) {
    cache.error = String(err.message || err);
    if (cache.payload) {
      return {
        ...cache.payload,
        cached: true,
        warning: `Élő frissítés sikertelen (${cache.error}), cache használata.`,
      };
    }

    const stations = buildMockStations();
    return {
      ok: true,
      mode: "mock",
      source: "mock (hydroinfo nem elérhető)",
      sourceUrl: HYDROINFO_TABLE,
      observedAt: null,
      fetchedAt: new Date().toISOString(),
      stations,
      warning: `Élő adatlekérés sikertelen: ${cache.error}. Demó/mock adatok jelennek meg.`,
      note:
        "Állítsd helyre a hydroinfo.hu elérést, vagy használd a /api/levels?force=1 végpontot újrapróbáláshoz.",
      cached: false,
    };
  }
}

export function getCacheInfo() {
  return {
    hasCache: Boolean(cache.payload),
    fetchedAt: cache.payload?.fetchedAt ?? null,
    lastError: cache.error,
    ttlMs: CACHE_TTL_MS,
  };
}
