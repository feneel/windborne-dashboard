import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 0); }, [map]);
  return null;
}

export default function MapView({ data }) {


    console.log(data, "DAta")
  // sample to keep UI snappy
  const points = useMemo(() => {
    const arr = data?.balloons ?? [];
    const max = 300;
    if (arr.length <= max) return arr;
    const step = Math.ceil(arr.length / max);
    const out = [];
    for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
    return out;
  }, [data]);

  const fmt = (n, d = 3) => (typeof n === "number" ? n.toFixed(d) : "—");
  const when = (ts) => (ts ? new Date(ts).toLocaleString() : "—");
  const band = (alt) =>
    alt < 5 ? "low" : alt < 12 ? "mid" : "stratosphere";
  const colorForAlt = (alt) =>
    alt < 5 ? "#10b981" : alt < 12 ? "#f59e0b" : "#ef4444"; // green / amber / red

  return (
    <div className="map-wrap">
      <MapContainer center={[20, 0]} zoom={2} minZoom={2} worldCopyJump preferCanvas>
        <InvalidateOnMount />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((b, i) => {
          const alt = Number(b.alt ?? 0);
          const wx = b.weather || b.wx; // show if enrichment ran
          return (
            <CircleMarker
              key={b.id ?? i}
              center={[b.lat, b.lon]}
              radius={2}
              pathOptions={{ color: colorForAlt(alt), opacity: 0.8 }}
            >
              <Tooltip direction="top" offset={[0, -2]} opacity={0.95}>
                <div style={{ fontSize: 12 }}>
                  <div><b>Altitude:</b> {fmt(alt, 1)} km <i>({band(alt)})</i></div>
                  <div><b>Age:</b> {b.hourOffset ? `${b.hourOffset}h ago` : "now"}</div>
                  <div><b>Time:</b> {when(b.timestamp)}</div>
                  <div><b>Coords:</b> {fmt(b.lat)}, {fmt(b.lon)}</div>
                  {wx && (
                    <div style={{ marginTop: 4 }}>
                      <b>Weather:</b>{" "}
                      {wx.summary ?? wx.desc ?? ""}{" "}
                      {wx.tempC != null ? `• ${wx.tempC}°C` : ""}{" "}
                      {wx.windKts != null ? `• ${wx.windKts} kts` : ""}
                    </div>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
