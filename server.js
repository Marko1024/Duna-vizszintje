import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLiveData, getCacheInfo } from "./server/scrape.js";
import { STATIONS } from "./server/stations.js";
import { getTokenInfo } from "./server/vra.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    cache: getCacheInfo(),
    vra: getTokenInfo(),
    dataSource: process.env.DATA_SOURCE || "auto",
    runtime: process.env.VERCEL ? "vercel-express" : "node",
  });
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

app.use(
  express.static(publicDir, {
    extensions: ["html"],
    maxAge: process.env.VERCEL ? "1h" : 0,
  })
);

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Duna vízállás → http://localhost:${PORT}`);
  });
}

export default app;
