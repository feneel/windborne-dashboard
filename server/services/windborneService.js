// server/services/windborneService.js
const BASE = "https://a.windbornesystems.com/treasure";

const isNum = (x) => Number.isFinite(x);

function clampLatLon(lat, lon) {
  if (!isNum(lat) || !isNum(lon)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function parsePoints(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // Case A: [[lat, lon, alt?], ...]
  if (Array.isArray(raw[0])) {
    return raw
      .map((row) => {
        if (!Array.isArray(row) || row.length < 2) return null;
        const lat = Number(row[0]);
        const lon = Number(row[1]);
        const altVal = row.length > 2 ? Number(row[2]) : NaN;
        const ll = clampLatLon(lat, lon);
        if (!ll) return null;
        return { lat: ll.lat, lon: ll.lon, alt: isNum(altVal) ? altVal : null };
      })
      .filter(Boolean);
  }

  // Case B: array of objects or mixed
  return raw
    .map((o) => {
      const lat = Number(o.lat ?? o.latitude ?? o[0]);
      const lon = Number(o.lon ?? o.lng ?? o.longitude ?? o[1]);
      const altVal = Number(o.alt ?? o.altitude ?? o[2] ?? NaN);
      const ll = clampLatLon(lat, lon);
      if (!ll) return null;
      return { lat: ll.lat, lon: ll.lon, alt: isNum(altVal) ? altVal : null };
    })
    .filter(Boolean);
}

async function fetchHour(i) {
  const hh = String(i).padStart(2, "0");
  const url = `${BASE}/${hh}.json`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 10000);

  try {
    // Keep headers minimal; some servers are finicky about custom UA/accept
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(t);

    if (!r.ok) {
      console.warn(`Hour ${hh}: HTTP ${r.status}`);
      return [];
    }

    // Be tolerant: read as text then JSON.parse
    const txt = await r.text();
    let data;
    try {
      data = JSON.parse(txt);
    } catch (e) {
      console.warn(`Hour ${hh}: JSON parse failed (${e.message}), len=${txt.length}`);
      return [];
    }

    const pts = parsePoints(data);
    if (!pts.length) {
      console.warn(`Hour ${hh}: parsed 0 points`);
      return [];
    }

    const ts = Date.now() - i * 3600 * 1000;
    return pts.map((p) => ({ ...p, hourOffset: i, timestamp: ts }));
  } catch (e) {
    clearTimeout(t);
    console.warn(`Hour ${hh}: fetch failed (${e.name || e.message})`);
    return [];
  }
}

export async function aggregateWindborne({ hours = 24 } = {}) {
  const clamped = Math.min(Math.max(Number(hours) || 24, 1), 24);

  // Fetch sequentially to be extra reliable with the upstream
  const all = [];
  for (let i = 0; i < clamped; i++) {
    const pts = await fetchHour(i);
    all.push(...pts);
  }

  // Assign a stable-ish id per ~0.01° cell so the UI can group “tracks”
  let seq = 0;
  const grid = new Map();
  const balloons = all.map((p) => {
    const key = `${Math.round(p.lat * 100) / 100},${Math.round(p.lon * 100) / 100}`;
    let id = grid.get(key);
    if (!id) {
      id = `b${(++seq).toString().padStart(4, "0")}`;
      grid.set(key, id);
    }
    return { id, ...p };
  });

  //console.log(`aggregateWindborne: hours=${clamped}, points=${all.length}, balloons=${balloons.length}`);
  return { balloons };
}
