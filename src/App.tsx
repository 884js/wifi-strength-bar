import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import WifiList from "./components/WifiList";
import {
  WifiNetwork,
  CurrentNetwork,
  findStrongerNetworks,
  shouldNotify,
  rssiToPercent,
} from "./utils/wifiNotification";

interface ScanResult {
  networks: WifiNetwork[];
  locationPermission: string;
  currentNetwork: CurrentNetwork | null;
}

const NOTIFICATION_THRESHOLD = 10;

function App() {
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [currentNetwork, setCurrentNetwork] = useState<CurrentNetwork | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [locationPermission, setLocationPermission] = useState<string>("");
  const lastNotifiedSsid = useRef<string | null>(null);

  const checkAndNotify = useCallback(
    async (networks: WifiNetwork[], current: CurrentNetwork | null) => {
      const strongerNetworks = findStrongerNetworks(networks, current);
      if (strongerNetworks.length === 0 || !current) {
        return;
      }

      const strongest = strongerNetworks[0];
      if (!shouldNotify(strongest, current, NOTIFICATION_THRESHOLD)) {
        return;
      }

      if (lastNotifiedSsid.current === strongest.ssid) {
        return;
      }

      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }

      if (permissionGranted) {
        lastNotifiedSsid.current = strongest.ssid;
        await sendNotification({
          title: "より強いWiFiが見つかりました",
          body: `${strongest.ssid} (${rssiToPercent(strongest.rssi)}%) - 現在の接続より強力です`,
        });
      }
    },
    []
  );

  const scanNetworks = useCallback(async () => {
    try {
      const result = await invoke<ScanResult>("scan_wifi");
      setNetworks(result.networks);
      setCurrentNetwork(result.currentNetwork);
      setLocationPermission(result.locationPermission);
      setError(null);
      setLastUpdate(new Date());

      await checkAndNotify(result.networks, result.currentNetwork);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [checkAndNotify]);

  useEffect(() => {
    scanNetworks();
    const interval = setInterval(scanNetworks, 3000);
    return () => clearInterval(interval);
  }, [scanNetworks]);

  const needsPermission = locationPermission === "denied" || locationPermission === "not_determined";

  const openLocationSettings = async () => {
    await invoke("open_location_settings");
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

      {currentNetwork && (
        <div className="current-network">
          <span className="current-label">接続中:</span>
          <span className="current-ssid">{currentNetwork.ssid}</span>
          <span className="current-rssi">
            ({rssiToPercent(currentNetwork.rssi)}%)
          </span>
        </div>
      )}

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
