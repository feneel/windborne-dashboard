// src/api.js
const API_BASE = import.meta.env.VITE_API_BASE

export async function getDashboard(query = "hours=24&weather=1&weatherLimit=25") {
  const r = await fetch(`${API_BASE}/api/dashboard?${query}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
