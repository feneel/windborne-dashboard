const API_BASE = import.meta.env.VITE_API_BASE || ""; // empty = same origin

// src/api.js
export async function getDashboard(query = "hours=24&weather=1&weatherLimit=25") {
  const r = await fetch(`/api/dashboard?${query}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
