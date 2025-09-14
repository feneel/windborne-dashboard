import { useEffect, useState } from "react";
import MapView from "./components/MapView";
import { getDashboard } from "./utils/api"; // your existing fetcher
import "./index.css";

export default function App() {
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await getDashboard({ hours: 24, weather: 0, weatherLimit: 0 });
      setPayload(data);
    })();
  }, []);

  return (
    <div className="app">
      <div className="header">
        WindBorne Dashboard (Backend-Powered)
      </div>
      <div className="main">
        <MapView data={payload} />
      </div>
    </div>
  );
}
