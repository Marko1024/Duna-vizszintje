import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const adsPath = path.join(dataDir, "ads.json");
const inquiriesPath = path.join(dataDir, "ad-inquiries.json");

const DEFAULT_ADS = {
  contactEmail: process.env.ADS_CONTACT_EMAIL || "",
  adsense: {
    enabled: false,
    client: "",
    units: { mid: "", footer: "" },
  },
  slots: {
    mid: { label: "Szponzorált", enabled: true },
    footer: { label: "Partner", enabled: true },
  },
  ads: [],
};

function resolveAdsense(parsed = {}) {
  const fromFile = parsed.adsense || {};
  const client =
    process.env.ADSENSE_CLIENT_ID ||
    fromFile.client ||
    DEFAULT_ADS.adsense.client;
  const units = {
    ...DEFAULT_ADS.adsense.units,
    ...(fromFile.units || {}),
  };
  if (process.env.ADSENSE_SLOT_MID) units.mid = process.env.ADSENSE_SLOT_MID;
  if (process.env.ADSENSE_SLOT_FOOTER) {
    units.footer = process.env.ADSENSE_SLOT_FOOTER;
  }

  const envEnabled = process.env.ADSENSE_ENABLED;
  let enabled = Boolean(fromFile.enabled);
  if (envEnabled === "1" || envEnabled === "true") enabled = true;
  if (envEnabled === "0" || envEnabled === "false") enabled = false;

  // Only expose a usable AdSense config when client id is present.
  if (!client || !String(client).startsWith("ca-pub-")) {
    return { enabled: false, client: "", units: { mid: "", footer: "" } };
  }

  return {
    enabled,
    client: String(client).trim(),
    units: {
      mid: String(units.mid || "").trim(),
      footer: String(units.footer || "").trim(),
    },
  };
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export async function readAdsConfig() {
  try {
    const raw = await fs.readFile(adsPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_ADS,
      ...parsed,
      contactEmail:
        process.env.ADS_CONTACT_EMAIL ||
        parsed.contactEmail ||
        DEFAULT_ADS.contactEmail,
      adsense: resolveAdsense(parsed),
      slots: { ...DEFAULT_ADS.slots, ...(parsed.slots || {}) },
      ads: Array.isArray(parsed.ads) ? parsed.ads : [],
    };
  } catch (err) {
    if (err.code === "ENOENT") {
      return { ...DEFAULT_ADS, adsense: resolveAdsense(), ads: [] };
    }
    throw err;
  }
}

export async function getPublicAds() {
  const config = await readAdsConfig();
  const now = Date.now();
  const adsenseOn = Boolean(config.adsense?.enabled && config.adsense?.client);

  const ads = config.ads.filter((ad) => {
    if (!ad || ad.active === false) return false;
    // When AdSense fills a slot, skip manual partner creative there.
    if (adsenseOn && config.adsense.units?.[ad.slot]) return false;
    const slot = config.slots[ad.slot];
    if (!slot || slot.enabled === false) return false;
    if (ad.startsAt && Date.parse(ad.startsAt) > now) return false;
    if (ad.endsAt && Date.parse(ad.endsAt) < now) return false;
    return true;
  });

  return {
    contactEmail: config.contactEmail || null,
    adsense: config.adsense,
    slots: config.slots,
    ads: ads.map((ad) => ({
      id: ad.id,
      slot: ad.slot,
      title: ad.title,
      body: ad.body || "",
      cta: ad.cta || "Megnézem",
      url: ad.url,
      image: ad.image || null,
      sponsor: ad.sponsor || null,
    })),
  };
}

export async function saveInquiry(payload) {
  await ensureDataDir();
  let list = [];
  try {
    const raw = await fs.readFile(inquiriesPath, "utf8");
    list = JSON.parse(raw);
    if (!Array.isArray(list)) list = [];
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  const entry = {
    id: `inq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    name: String(payload.name || "").trim().slice(0, 120),
    email: String(payload.email || "").trim().slice(0, 180),
    company: String(payload.company || "").trim().slice(0, 160),
    message: String(payload.message || "").trim().slice(0, 2000),
    website: String(payload.website || "").trim().slice(0, 300),
  };

  if (!entry.name || !entry.email || !entry.message) {
    const error = new Error("Név, e-mail és üzenet kötelező.");
    error.status = 400;
    throw error;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)) {
    const error = new Error("Érvénytelen e-mail cím.");
    error.status = 400;
    throw error;
  }

  list.push(entry);
  await fs.writeFile(inquiriesPath, JSON.stringify(list, null, 2), "utf8");
  return entry;
}
