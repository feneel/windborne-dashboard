// server/services/openWeatherService.js
const OWM_ENDPOINT = "https://api.openweathermap.org/data/3.0/onecall";

// Simple key for grouping nearby points to reduce calls (0.5° grid)
const keyFor = (lat, lon) => `${Math.round(lat * 2) / 2},${Math.round(lon * 2) / 2}`;

export async function enrichWithWeather(balloons, { limit = 25, apiKey } = {}) {
//console.log(balloons, "Balloons")


  if (!Array.isArray(balloons) || balloons.length === 0) return [];
  if (!apiKey) return balloons; // <— critical: don't drop if no key


  

  // pick up to `limit` representative cells to query
  const cells = new Map();
  for (const b of balloons) {
    const k = keyFor(b.lat, b.lon);
    if (!cells.has(k)) cells.set(k, { lat: b.lat, lon: b.lon });
    if (cells.size >= limit) break;
  }


  

  // fetch weather per cell (best effort)
  const weatherByCell = new Map();
  await Promise.all(
    [...cells.entries()].map(async ([k, { lat, lon }]) => {
      try {
        const url = `${OWM_ENDPOINT}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
        const r = await fetch(url);
        if (!r.ok) return;
        const w = await r.json();
        weatherByCell.set(k, {
          tempC: w?.main?.temp ?? null,
          windMs: w?.wind?.speed ?? null,
          windDeg: w?.wind?.deg ?? null,
          conditions: w?.weather?.[0]?.main ?? null,
        });
      } catch {
        /* swallow and leave cell without weather */
      }
    })
  );

  // attach weather, never remove points
  return balloons.map((b) => {
    const w = weatherByCell.get(keyFor(b.lat, b.lon)) || null;
    return { ...b, weather: w };
  });
}
