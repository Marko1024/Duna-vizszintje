import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLiveData, getCacheInfo } from "./server/scrape.js";
import { STATIONS } from "./server/stations.js";
import { getTokenInfo } from "./server/vra.js";
import { injectSeo, loadTemplate, SITE_URL } from "./server/seo.js";

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
    siteUrl: SITE_URL,
    runtime: process.env.VERCEL ? "vercel-express" : "node",
  });
});

app.get("/api/stations", (_req, res) => {
  res.json({ stations: STATIONS });
});

app.get("/ads.txt", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.type("text/plain").sendFile(path.join(publicDir, "ads.txt"));
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

/** Dinamikus sitemap lastmod-dal */
app.get("/sitemap.xml", async (_req, res) => {
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
  res.type("application/xml").send(xml);
});

async function renderHome(_req, res) {
  try {
    const [template, data] = await Promise.all([
      loadTemplate(publicDir),
      fetchLiveData({ force: false }).catch(() => null),
    ]);
    const html = injectSeo(template, data);
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    res.type("html").send(html);
  } catch (err) {
    console.error("SSR hiba:", err);
    res.sendFile(path.join(publicDir, "index.html"));
  }
}

app.get("/", renderHome);
app.get("/index.html", renderHome);

// Google Search Console HTML-file verification (must not fall through to SSR)
app.get("/google93a8ec78c8a76b70.html", (_req, res) => {
  res
    .type("text/html")
    .send("google-site-verification: google93a8ec78c8a76b70.html\n");
});

app.use(
  express.static(publicDir, {
    extensions: ["html"],
    maxAge: process.env.VERCEL ? "1h" : 0,
    index: false,
  })
);

// Unknown paths → 404 (ne SSR homepage legyen a verifikációs URL-eken)
app.use((req, res) => {
  if (req.accepts("html")) {
    res.status(404).type("html").send("<!doctype html><title>404</title><h1>404</h1>");
    return;
  }
  res.status(404).json({ ok: false, error: "Not found" });
});


if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Duna vízállás → http://localhost:${PORT}`);
  });
}

export default app;
