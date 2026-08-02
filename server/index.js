import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPublicAds, saveInquiry } from "./ads.js";
import { fetchLiveData, getCacheInfo } from "./scrape.js";
import { STATIONS } from "./stations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, cache: getCacheInfo() });
});

app.get("/api/stations", (_req, res) => {
  res.json({ stations: STATIONS });
});

app.get("/api/levels", async (req, res) => {
  try {
    const force = req.query.force === "1" || req.query.refresh === "1";
    const data = await fetchLiveData({ force });
    res.json(data);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: String(err.message || err),
    });
  }
});

app.get("/api/ads", async (_req, res) => {
  try {
    const data = await getPublicAds();
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: String(err.message || err),
    });
  }
});

app.post("/api/ads/inquiry", async (req, res) => {
  try {
    const entry = await saveInquiry(req.body || {});
    res.status(201).json({
      ok: true,
      id: entry.id,
      message: "Köszönjük! Hamarosan felvesszük veled a kapcsolatot.",
    });
  } catch (err) {
    res.status(err.status || 500).json({
      ok: false,
      error: String(err.message || err),
    });
  }
});

app.use(express.static(publicDir, { extensions: ["html"] }));

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Duna vízállás → http://localhost:${PORT}`);
});
