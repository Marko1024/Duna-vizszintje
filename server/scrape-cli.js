import { fetchLiveData } from "./scrape.js";

const data = await fetchLiveData({ force: true });
console.log(
  JSON.stringify(
    {
      mode: data.mode,
      source: data.source,
      auth: data.auth,
      observedAt: data.observedAt,
      warning: data.warning,
      stations: data.stations.map((s) => ({
        name: s.name,
        levelCm: s.levelCm,
        change24hCm: s.change24hCm,
        change7dCm: s.change7dCm,
        status: s.status,
        historyPoints: s.historySeries?.length ?? 0,
        dataSource: s.source,
      })),
    },
    null,
    2
  )
);
