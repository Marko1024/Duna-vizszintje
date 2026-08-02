const REFRESH_MS = 60 * 60 * 1000;
const ALERTS_KEY = "duna-vizszint-alerts-v1";

const state = {
  data: null,
  selectedId: "budapest",
  days: 7,
  compareFloods: false,
  chart: null,
  map: null,
  markers: [],
};

const $ = (sel) => document.querySelector(sel);

function statusAccent(status) {
  return (
    {
      low: "var(--low)",
      normal: "var(--normal)",
      flood1: "var(--flood1)",
      flood2: "var(--flood2)",
      flood3: "var(--flood3)",
      unknown: "#6b7c84",
    }[status] || "#6b7c84"
  );
}

function fmt(n, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("hu-HU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

function signed(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const v = fmt(n);
  return n > 0 ? `+${v}` : v;
}

function trendClass(trend) {
  return `trend-${trend || "stable"}`;
}

async function loadLevels(force = false) {
  const url = force ? "/api/levels?force=1" : "/api/levels";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`API hiba: ${res.status}`);
  return res.json();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(url) {
  if (!url) return "#";
  const value = String(url).trim();
  if (value.startsWith("#") || value.startsWith("/")) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    /* ignore */
  }
  return "#";
}

function renderAdBanner(ad, slotMeta) {
  const label = slotMeta?.label || "Szponzorált";
  const href = safeUrl(ad.url);
  const external = href.startsWith("http");
  return `
    <article class="ad-banner">
      <p class="ad-banner-label">${escapeHtml(label)}</p>
      <h3>${escapeHtml(ad.title)}</h3>
      ${ad.body ? `<p>${escapeHtml(ad.body)}</p>` : ""}
      <div class="ad-banner-meta">
        ${ad.sponsor ? `<span class="ad-sponsor">${escapeHtml(ad.sponsor)}</span>` : "<span></span>"}
        <a class="btn btn-secondary" href="${escapeHtml(href)}"${
          external ? ' target="_blank" rel="noopener sponsored"' : ""
        }>${escapeHtml(ad.cta || "Megnézem")}</a>
      </div>
    </article>
  `;
}

function renderAdSlots(payload) {
  const bySlot = { mid: [], footer: [] };
  for (const ad of payload.ads || []) {
    if (!bySlot[ad.slot]) bySlot[ad.slot] = [];
    bySlot[ad.slot].push(ad);
  }

  const mid = $("#adSlotMid");
  const footer = $("#adSlotFooter");

  if (mid) {
    if (bySlot.mid?.length) {
      mid.hidden = false;
      mid.innerHTML = bySlot.mid
        .map((ad) => renderAdBanner(ad, payload.slots?.mid))
        .join("");
    } else {
      mid.hidden = true;
      mid.innerHTML = "";
    }
  }

  if (footer) {
    if (bySlot.footer?.length) {
      footer.hidden = false;
      footer.innerHTML = bySlot.footer
        .map((ad) => renderAdBanner(ad, payload.slots?.footer))
        .join("");
    } else {
      footer.hidden = true;
      footer.innerHTML = "";
    }
  }
}

async function loadAds() {
  try {
    const res = await fetch("/api/ads", { cache: "no-store" });
    if (!res.ok) throw new Error(`Ads API hiba: ${res.status}`);
    const data = await res.json();
    renderAdSlots(data);
  } catch {
    const mid = $("#adSlotMid");
    const footer = $("#adSlotFooter");
    if (mid) mid.hidden = true;
    if (footer) footer.hidden = true;
  }
}

async function submitAdInquiry(form) {
  const note = $("#adFormNote");
  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    company: form.company.value.trim(),
    website: form.website.value.trim(),
    message: form.message.value.trim(),
  };
  note.className = "form-note span-2";
  note.textContent = "Küldés…";

  const res = await fetch("/api/ads/inquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Hiba: ${res.status}`);
  }
  form.reset();
  note.className = "form-note span-2 is-ok";
  note.textContent = data.message || "Köszönjük! Hamarosan jelentkezünk.";
}

function renderMeta() {
  const meta = $("#metaLine");
  if (!state.data) return;
  const parts = [];
  if (state.data.observedAt) parts.push(`Észlelés: ${state.data.observedAt}`);
  if (state.data.fetchedAt) {
    parts.push(
      `Frissítve: ${new Date(state.data.fetchedAt).toLocaleString("hu-HU")}`
    );
  }
  parts.push(state.data.mode === "live" ? "Élő adat" : "Demó / mock adat");
  if (state.data.warning) parts.push(state.data.warning);
  meta.textContent = parts.join(" · ");
}

function renderCards() {
  const grid = $("#stationGrid");
  grid.innerHTML = "";
  state.data.stations.forEach((s, i) => {
    const card = document.createElement("article");
    card.className = `station-card${s.id === state.selectedId ? " active" : ""}`;
    card.style.setProperty("--accent", statusAccent(s.status));
    card.style.animationDelay = `${i * 0.05}s`;
    card.tabIndex = 0;
    card.dataset.id = s.id;
    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3>${s.name}</h3>
          <p class="river-km">${s.river} · ${fmt(s.riverKm, 1)} fkm</p>
        </div>
        <span class="pill status-${s.status}">${s.label}</span>
      </div>
      <div class="level-block">
        <span class="value">${fmt(s.levelCm)}</span>
        <span class="unit">cm</span>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="label">24 óra</span>
          <span class="val ${trendClass(s.trend)}">${signed(s.change24hCm)} cm</span>
        </div>
        <div class="stat">
          <span class="label">7 nap</span>
          <span class="val">${signed(s.change7dCm)} cm</span>
        </div>
        <div class="stat">
          <span class="label">Trend</span>
          <span class="val ${trendClass(s.trend)}">${s.arrow} ${s.trendLabel || "—"}</span>
        </div>
      </div>
    `;

    const select = () => {
      state.selectedId = s.id;
      $("#chartStation").value = s.id;
      renderCards();
      renderChart();
      focusMarker(s.id);
    };
    card.addEventListener("click", select);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select();
      }
    });
    grid.appendChild(card);
  });
}

function fillSelects() {
  for (const sel of ["#chartStation", "#alertStation"]) {
    const el = $(sel);
    el.innerHTML = state.data.stations
      .map(
        (s) =>
          `<option value="${s.id}" ${s.id === state.selectedId ? "selected" : ""}>${s.name}</option>`
      )
      .join("");
  }
}

function seriesForStation(station, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const key = cutoff.toISOString().slice(0, 10);
  return (station.historySeries || []).filter((p) => p.date >= key);
}

function renderChart() {
  const station = state.data.stations.find((s) => s.id === state.selectedId);
  if (!station) return;
  const series = seriesForStation(station, state.days);
  const labels = series.map((p) => p.date);
  const values = series.map((p) => p.valueCm);

  const datasets = [
    {
      label: `${station.shortName} vízállás (cm)`,
      data: values,
      borderColor: "#0e5f6d",
      backgroundColor: "rgba(14, 95, 109, 0.15)",
      fill: true,
      tension: 0.28,
      pointRadius: series.length > 20 ? 0 : 3,
      borderWidth: 2.5,
    },
  ];

  if (state.compareFloods) {
    if (station.history?.flood2002 != null) {
      datasets.push({
        label: "2002 árvíz",
        data: labels.map(() => station.history.flood2002),
        borderColor: "#d08a2a",
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        borderWidth: 1.5,
      });
    }
    if (station.history?.flood2013 != null) {
      datasets.push({
        label: "2013 árvíz",
        data: labels.map(() => station.history.flood2013),
        borderColor: "#9b2430",
        borderDash: [2, 4],
        pointRadius: 0,
        fill: false,
        borderWidth: 1.5,
      });
    }
    datasets.push({
      label: "I. fok",
      data: labels.map(() => station.thresholds.iFok),
      borderColor: "rgba(192, 83, 42, 0.7)",
      borderDash: [10, 6],
      pointRadius: 0,
      fill: false,
      borderWidth: 1.2,
    });
  }

  const ctx = $("#levelChart").getContext("2d");
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { font: { family: "Figtree", size: 12 } },
        },
        tooltip: {
          callbacks: {
            label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y)} cm`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 8,
            callback(value, index) {
              const label = this.getLabelForValue(value);
              if (!label) return "";
              const [, m, d] = label.split("-");
              return `${Number(d)}.${Number(m)}.`;
            },
          },
          grid: { color: "rgba(12,31,40,0.06)" },
        },
        y: {
          title: { display: true, text: "cm" },
          grid: { color: "rgba(12,31,40,0.08)" },
        },
      },
    },
  });
}

function initMap() {
  if (state.map) return;
  state.map = L.map("map", { scrollWheelZoom: false }).setView(
    [47.2, 18.9],
    7
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 18,
  }).addTo(state.map);
}

function markerColor(status) {
  return (
    {
      low: "#2a7d8c",
      normal: "#3d8f5a",
      flood1: "#d08a2a",
      flood2: "#c4532a",
      flood3: "#9b2430",
    }[status] || "#6b7c84"
  );
}

function renderMap() {
  initMap();
  state.markers.forEach((m) => m.remove());
  state.markers = [];
  const bounds = [];

  state.data.stations.forEach((s) => {
    const color = markerColor(s.status);
    const icon = L.divIcon({
      className: "",
      html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:${color};border:3px solid #fff;
        box-shadow:0 4px 14px rgba(0,0,0,.35);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    const marker = L.marker([s.lat, s.lon], { icon })
      .addTo(state.map)
      .bindPopup(
        `<strong>${s.name}</strong><br>${fmt(s.levelCm)} cm<br><em>${s.label}</em>`
      );
    marker.on("click", () => {
      state.selectedId = s.id;
      $("#chartStation").value = s.id;
      renderCards();
      renderChart();
    });
    state.markers.push(marker);
    bounds.push([s.lat, s.lon]);
  });

  if (bounds.length) {
    state.map.fitBounds(bounds, { padding: [36, 36] });
  }
}

function focusMarker(id) {
  const station = state.data.stations.find((s) => s.id === id);
  if (!station || !state.map) return;
  state.map.panTo([station.lat, station.lon], { animate: true });
  const marker = state.markers.find((m) => {
    const ll = m.getLatLng();
    return (
      Math.abs(ll.lat - station.lat) < 1e-6 &&
      Math.abs(ll.lng - station.lon) < 1e-6
    );
  });
  marker?.openPopup();
}

function loadAlerts() {
  try {
    return JSON.parse(localStorage.getItem(ALERTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAlerts(alerts) {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

function renderAlerts() {
  const list = $("#alertList");
  const alerts = loadAlerts();
  if (!alerts.length) {
    list.innerHTML =
      "<li>Még nincs mentett riasztás. Állíts be egy küszöböt fent.</li>";
    return;
  }
  list.innerHTML = alerts
    .map(
      (a, idx) => `
      <li>
        <span>
          <strong>${a.stationName}</strong> ≥ <strong>${fmt(a.thresholdCm)}</strong> cm
          ${a.email ? ` · ${a.email}` : ""}
          ${a.notify ? " · böngésző-értesítés" : ""}
        </span>
        <button type="button" data-idx="${idx}">Törlés</button>
      </li>`
    )
    .join("");
  list.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const alertsNow = loadAlerts();
      alertsNow.splice(Number(btn.dataset.idx), 1);
      saveAlerts(alertsNow);
      renderAlerts();
    });
  });
}

async function maybeNotify() {
  if (!state.data || state.data.mode !== "live") return;
  const alerts = loadAlerts();
  if (!alerts.length || !("Notification" in window)) return;

  if (Notification.permission === "default") {
    // wait until user interacts via form
  }
  if (Notification.permission !== "granted") return;

  for (const a of alerts) {
    const station = state.data.stations.find((s) => s.id === a.stationId);
    if (!station || station.levelCm == null) continue;
    if (station.levelCm >= a.thresholdCm) {
      const key = `notified-${a.stationId}-${a.thresholdCm}-${state.data.observedAt}`;
      if (sessionStorage.getItem(key)) continue;
      new Notification("Duna vízállás riasztás", {
        body: `${station.name}: ${fmt(station.levelCm)} cm (≥ ${fmt(a.thresholdCm)} cm)`,
      });
      sessionStorage.setItem(key, "1");
    }
  }
}

async function refresh(force = false) {
  const buttons = [$("#refreshBtn"), $("#heroRefreshBtn")];
  buttons.forEach((b) => {
    b.disabled = true;
    b.textContent = "Frissítés…";
  });
  try {
    state.data = await loadLevels(force);
    if (!state.data.stations.find((s) => s.id === state.selectedId)) {
      state.selectedId = state.data.stations[0]?.id || "budapest";
    }
    renderMeta();
    fillSelects();
    renderCards();
    renderChart();
    renderMap();
    await maybeNotify();
  } catch (err) {
    $("#metaLine").textContent = `Hiba az adatok betöltésekor: ${err.message}`;
  } finally {
    buttons.forEach((b) => {
      b.disabled = false;
    });
    $("#refreshBtn").textContent = "Frissítés";
    $("#heroRefreshBtn").textContent = "Adatok frissítése";
  }
}

function wireUi() {
  $("#refreshBtn").addEventListener("click", () => refresh(true));
  $("#heroRefreshBtn").addEventListener("click", () => refresh(true));

  $("#chartStation").addEventListener("change", (e) => {
    state.selectedId = e.target.value;
    renderCards();
    renderChart();
    focusMarker(state.selectedId);
  });

  document.querySelectorAll(".seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.days = Number(btn.dataset.days);
      renderChart();
    });
  });

  $("#compareFloods").addEventListener("change", (e) => {
    state.compareFloods = e.target.checked;
    renderChart();
  });

  $("#alertForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const stationId = $("#alertStation").value;
    const station = state.data.stations.find((s) => s.id === stationId);
    const thresholdCm = Number($("#alertThreshold").value);
    const email = $("#alertEmail").value.trim();
    let notify = false;
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      notify = perm === "granted";
    }
    const alerts = loadAlerts();
    alerts.push({
      stationId,
      stationName: station?.name || stationId,
      thresholdCm,
      email,
      notify,
      createdAt: new Date().toISOString(),
    });
    saveAlerts(alerts);
    renderAlerts();
    await maybeNotify();
  });

  const adForm = $("#adInquiryForm");
  if (adForm) {
    adForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const note = $("#adFormNote");
      const btn = adForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await submitAdInquiry(adForm);
      } catch (err) {
        note.className = "form-note span-2 is-error";
        note.textContent = err.message || "Nem sikerült elküldeni.";
      } finally {
        btn.disabled = false;
      }
    });
  }
}

wireUi();
renderAlerts();
loadAds();
refresh(false);
setInterval(() => refresh(true), REFRESH_MS);
