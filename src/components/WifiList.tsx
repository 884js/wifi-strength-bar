import { rssiToPercent } from "../utils/wifiNotification";

interface WifiNetwork {
  ssid: string;
  rssi: number;
  channel: number;
  security: string;
}

interface WifiListProps {
  networks: WifiNetwork[];
}

function getSignalStrength(rssi: number): { label: string; className: string } {
  if (rssi >= -50) return { label: "非常に良好", className: "signal-excellent" };
  if (rssi >= -60) return { label: "良好", className: "signal-good" };
  if (rssi >= -70) return { label: "普通", className: "signal-fair" };
  return { label: "弱い", className: "signal-weak" };
}

function getSignalBars(rssi: number): number {
  if (rssi >= -50) return 4;
  if (rssi >= -60) return 3;
  if (rssi >= -70) return 2;
  return 1;
}

function SignalBars({ rssi }: { rssi: number }) {
  const bars = getSignalBars(rssi);
  const { className } = getSignalStrength(rssi);

  return (
    <div className={`signal-bars ${className}`}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`bar ${i <= bars ? "active" : ""}`} />
      ))}
    </div>
  );
}

function formatSecurity(security: string): string {
  // "Wpa2Personal" -> "WPA2" のように変換
  if (security.toLowerCase().includes("wpa3")) return "WPA3";
  if (security.toLowerCase().includes("wpa2")) return "WPA2";
  if (security.toLowerCase().includes("wpa")) return "WPA";
  if (security.toLowerCase().includes("wep")) return "WEP";
  if (security.toLowerCase() === "none" || security === "") return "なし";
  return security;
}

export default function WifiList({ networks }: WifiListProps) {
  if (networks.length === 0) {
    return <p className="no-networks">ネットワークが見つかりません</p>;
  }

  return (
    <div className="wifi-list">
      <div className="wifi-header">
        <span className="col-signal">電波強度</span>
        <span className="col-ssid">ネットワーク名</span>
        <span className="col-channel">チャンネル</span>
        <span className="col-security">セキュリティ</span>
      </div>
      {networks.map((network, index) => {
        const { label, className } = getSignalStrength(network.rssi);
        return (
          <div key={`${network.ssid}-${index}`} className={`wifi-item ${className}`}>
            <span className="col-signal">
              <SignalBars rssi={network.rssi} />
              <span className="signal-label">{label} ({rssiToPercent(network.rssi)}%)</span>
            </span>
            <span className="col-ssid" title={network.ssid}>
              {network.ssid || "(非公開ネットワーク)"}
            </span>
            <span className="col-channel">{network.channel}</span>
            <span className="col-security">{formatSecurity(network.security)}</span>
          </div>
        );
      })}
    </div>
  );
}
