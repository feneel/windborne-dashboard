// server/server.js
// import "dotenv/config";                    // <-- load .env
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateWindborne } from "./services/windborneService.js";
import { enrichWithWeather } from "./services/openWeatherService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const app = express();
const PORT = process.env.PORT || 8080;
const DEV_ORIGIN = process.env.DEV_ORIGIN || "http://localhost:5173";
const PROD_ORIGIN = process.env.FRONTEND_ORIGIN || "https://windborne-dashboard.vercel.app";

app.use(express.json());

app.use((req, res, next) => {
  // Pick origin based on environment
  const allowedOrigin = PROD_ORIGIN;

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Health
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true }));

// Cache recent aggregation (avoid hammering upstream)
let cache = { at: 0, hours: null, payload: null };
const AGG_TTL_MS = 60_000;

// GET /api/dashboard?hours=24&weather=1&weatherLimit=25&debug=1
app.get("/api/dashboard", async (req, res) => {
  try {
    // //console.log(req.query)
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 24);
    // treat ?weather, ?weather=1, ?weather=true, ?weather=yes as TRUE
    // only false when explicitly 0/false/no/off
    const asBool = (v) => {
      if (v === undefined) return false; // param absent
      const s = String(v).trim().toLowerCase();
      if (s === "") return true; // ?weather
      return !["0", "false", "no", "off"].includes(s);
    };

    const useWeather = asBool(req.query.weather);

    const weatherLimit = Number(req.query.weatherLimit) || 25;
    const wantDebug = ["1", "true", "yes"].includes(
      String(req.query.debug).toLowerCase()
    );

    // //console.log(hours, useWeather, weatherLimit)

    const now = Date.now();
    const cacheValid =
      cache.payload &&
      now - cache.at < AGG_TTL_MS &&
      cache.hours === hours &&
      !wantDebug;

    let aggregated = cacheValid
      ? cache.payload
      : await aggregateWindborne({ hours, debug: wantDebug });

    // Only cache if we actually got some points and not in debug mode
    if (!wantDebug && aggregated?.balloons?.length) {
      cache = { at: now, hours, payload: aggregated };
    }

    let balloons = aggregated.balloons || [];

    // if (process.env.VITE_OWM_KEY) {
    //     //console.log("In if")
    try {
      //console.log("In try")
      balloons = await enrichWithWeather(balloons, {
        limit: weatherLimit,
        apiKey: process.env.VITE_OWM_KEY,
      });
    } catch (err) {
      console.warn("Weather enrichment failed, returning raw balloons:", err);
      // keep the original balloons array
    }
    // }

    res.setHeader("Cache-Control", "public, max-age=30");
    res.status(200).json({
      fetchedAt: new Date().toISOString(),
      hours,
      count: balloons.length,
      balloons,
      ...(wantDebug ? { _debug: aggregated._debug ?? null } : {}),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch/process data" });
  }
});

/** (Optional) Relay job application so frontend never hits third-party directly */
app.post("/api/apply", async (req, res) => {
  try {
    const r = await fetch(
      "https://windbornesystems.com/career_applications.json",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      }
    );
    const text = await r.text();
    res
      .status(r.status)
      .type(r.headers.get("content-type") || "application/json")
      .send(text);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Upstream submission failed" });
  }
});

// ---- Serve built frontend (single origin) ----
const distDir = path.resolve(ROOT, "dist");
app.use(express.static(distDir)); // JS/CSS/images

// SPA fallback for everything NOT starting with /api/
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  //console.log(`Server listening on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  //console.log(`Health: http://localhost:${PORT}/api/health`);
});
