/**
 * SEO / SSR: a kezdőlap HTML-jébe beágyazza az aktuális vízállást,
 * hogy a keresők (és JS nélküli kliensek) is lássák az adatokat.
 */

import fs from "node:fs/promises";
import path from "node:path";

export const SITE_URL = (
  process.env.SITE_URL || "https://duna-vizszint.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "Duna Vízállás";
export const DEFAULT_TITLE =
  "Duna vízállás élőben – Budapest, Nagymaros, Mohács, Baja | Aktuális vízszint";
export const DEFAULT_DESCRIPTION =
  "Élő Duna vízállás Magyarországon: Budapest, Nagymaros, Esztergom, Győr (Gönyű), Dunaújváros, Baja és Mohács. Aktuális vízszint cm-ben, trend, grafikon és térkép – OVF adatok alapján.";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtCm(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("hu-HU").format(n)} cm`;
}

function buildJsonLd(data) {
  const stations = data?.stations || [];
  const budapest = stations.find((s) => s.id === "budapest");
  const dateModified = data?.fetchedAt || new Date().toISOString();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: [
          "Duna vízszint",
          "Duna vízállás élőben",
          "Budapest Duna vízállás",
        ],
        inLanguage: "hu-HU",
        description: DEFAULT_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#org` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: SITE_URL,
      },
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: DEFAULT_TITLE,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: {
          "@type": "BodyOfWater",
          name: "Duna",
          alternateName: "Danube",
        },
        dateModified,
        inLanguage: "hu-HU",
        description: budapest
          ? `Aktuális Duna vízállás Budapesten: ${fmtCm(budapest.levelCm)}. Élő adatok további magyar mérőállomásokról.`
          : DEFAULT_DESCRIPTION,
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: `${SITE_URL}/og.svg`,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Mennyi most a Duna vízállása Budapesten?",
            acceptedAnswer: {
              "@type": "Answer",
              text: budapest
                ? `A Duna aktuális vízállása Budapesten ${fmtCm(budapest.levelCm)} (${budapest.label || "státusz frissül"}). Az adat az OVF hivatalos forrásaiból származik.`
                : "A budapesti Duna vízállás az oldalon élőben frissül az OVF adatai alapján.",
            },
          },
          {
            "@type": "Question",
            name: "Hol nézhetem meg a Duna vízszintjét Magyarországon?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `A ${SITE_URL} oldalon élőben követheted a Duna vízállását Budapest, Nagymaros, Esztergom, Győr (Gönyű), Dunaújváros, Baja és Mohács mérőállomásain.`,
            },
          },
          {
            "@type": "Question",
            name: "Honnan származnak a vízállás adatok?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Az adatok az Országos Vízügyi Főigazgatóság (OVF) VRAQuery API-jából és a Hydroinfo nyilvános tábláiból származnak. Tájékoztató jellegűek.",
            },
          },
        ],
      },
      ...stations.map((s) => ({
        "@type": "Place",
        name: `Duna vízmérce – ${s.name}`,
        description: `Aktuális Duna vízállás ${s.name} állomáson: ${fmtCm(s.levelCm)}.`,
        geo: {
          "@type": "GeoCoordinates",
          latitude: s.lat,
          longitude: s.lon,
        },
      })),
    ],
  };
}

function buildSeoTable(stations) {
  if (!stations?.length) {
    return `<p>Az aktuális Duna vízállás adatok betöltése folyamatban van.</p>`;
  }
  const rows = stations
    .map(
      (s) => `<tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(fmtCm(s.levelCm))}</td>
      <td>${escapeHtml(s.label || "—")}</td>
      <td>${escapeHtml(s.trendLabel || "—")}</td>
    </tr>`
    )
    .join("");
  return `<table>
    <caption>Aktuális Duna vízállás Magyarországon</caption>
    <thead><tr><th>Állomás</th><th>Vízállás</th><th>Státusz</th><th>Trend</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildDynamicDescription(data) {
  const bp = data?.stations?.find((s) => s.id === "budapest");
  if (!bp || bp.levelCm == null) return DEFAULT_DESCRIPTION;
  return `Duna vízállás élőben: Budapest most ${fmtCm(bp.levelCm)}. További állomások: Nagymaros, Esztergom, Baja, Mohács, Dunaújváros, Győr. Friss OVF adatok, grafikon és térkép.`;
}

function buildDynamicTitle(data) {
  const bp = data?.stations?.find((s) => s.id === "budapest");
  if (!bp || bp.levelCm == null) return DEFAULT_TITLE;
  return `Duna vízállás Budapest: ${fmtCm(bp.levelCm)} – élő vízszint Magyarországon`;
}

function buildAdSlot(slotId, extraClass = "") {
  const id = String(slotId || "").trim();
  if (!/^\d{5,20}$/.test(id)) return "";
  const cls = extraClass ? `ad-slot ${extraClass}` : "ad-slot";
  return `<aside class="${cls}" aria-label="Hirdetés">
  <p class="ad-label">Hirdetés</p>
  <ins
    class="adsbygoogle"
    style="display:block"
    data-ad-client="ca-pub-9316553426322212"
    data-ad-slot="${escapeHtml(id)}"
    data-ad-format="auto"
    data-full-width-responsive="true"
  ></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</aside>`;
}

/**
 * @param {string} templateHtml
 * @param {object|null} data
 */
export function injectSeo(templateHtml, data) {
  const title = buildDynamicTitle(data);
  const description = buildDynamicDescription(data);
  const jsonLd = JSON.stringify(buildJsonLd(data));
  const table = buildSeoTable(data?.stations);
  const initial = data
    ? `<script>window.__INITIAL_DATA__=${JSON.stringify(data).replace(/</g, "\\u003c")};</script>`
    : "";

  const observed = data?.observedAt
    ? `<p class="seo-observed">Utolsó észlelés: ${escapeHtml(data.observedAt)}</p>`
    : "";

  let html = templateHtml;

  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );

  if (html.includes('name="description"')) {
    html = html.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );
  }

  // OG / Twitter dynamic bits
  html = html.replace(
    /property="og:title"\s+content="[^"]*"/i,
    `property="og:title" content="${escapeHtml(title)}"`
  );
  html = html.replace(
    /property="og:description"\s+content="[^"]*"/i,
    `property="og:description" content="${escapeHtml(description)}"`
  );
  html = html.replace(
    /name="twitter:title"\s+content="[^"]*"/i,
    `name="twitter:title" content="${escapeHtml(title)}"`
  );
  html = html.replace(
    /name="twitter:description"\s+content="[^"]*"/i,
    `name="twitter:description" content="${escapeHtml(description)}"`
  );

  html = html.replace(
    "<!--JSON_LD-->",
    `<script type="application/ld+json">${jsonLd}</script>`
  );
  html = html.replace("<!--INITIAL_DATA-->", initial);
  html = html.replace(
    "<!--SEO_LIVE_TABLE-->",
    `${observed}${table}`
  );

  // Manual AdSense units (optional). Auto ads still work from the head script
  // when enabled in the AdSense dashboard for this site.
  const midSlot =
    process.env.ADSENSE_SLOT_MID || process.env.ADSENSE_AD_SLOT_MID || "";
  const footerSlot =
    process.env.ADSENSE_SLOT_FOOTER ||
    process.env.ADSENSE_AD_SLOT_FOOTER ||
    "";
  html = html.replace("<!--AD_SLOT_MID-->", buildAdSlot(midSlot));
  html = html.replace(
    "<!--AD_SLOT_FOOTER-->",
    buildAdSlot(footerSlot, "ad-slot-footer")
  );

  return html;
}

export async function loadTemplate(publicDir) {
  return fs.readFile(path.join(publicDir, "index.html"), "utf8");
}
