import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import WifiList from "./components/WifiList";

interface WifiNetwork {
  ssid: string;
  rssi: number;
  channel: number;
  security: string;
}

interface ScanResult {
  networks: WifiNetwork[];
  locationPermission: string;
}

function App() {
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [locationPermission, setLocationPermission] = useState<string>("");

  const scanNetworks = async () => {
    try {
      const result = await invoke<ScanResult>("scan_wifi");
      setNetworks(result.networks);
      setLocationPermission(result.locationPermission);
      setError(null);
      setLastUpdate(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scanNetworks();
    const interval = setInterval(scanNetworks, 3000);
    return () => clearInterval(interval);
  }, []);

  const needsPermission = locationPermission === "denied" || locationPermission === "not_determined";

  const openLocationSettings = async () => {
    await open("x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices");
  };

  return (
    <div className="container">
      <header>
        <h1>WiFi Monitor</h1>
        {lastUpdate && (
          <span className="last-update">
            最終更新: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </header>

      {needsPermission && (
        <div className="permission-notice">
          <p>SSIDを表示するには位置情報の許可が必要です</p>
          <button onClick={openLocationSettings} className="open-settings-btn">
            位置情報の設定を開く
          </button>
        </div>
      )}

      {loading && <p className="loading">スキャン中...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && <WifiList networks={networks} />}
    </div>
  );
}

export default App;
