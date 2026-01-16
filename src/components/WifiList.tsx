import { rssiToPercent } from "../utils/wifiNotification";
import { categorizeNetworks } from "../utils/knownNetworks";

interface WifiNetwork {
  ssid: string;
  rssi: number;
  channel: number;
  security: string;
}

interface WifiListProps {
  networks: WifiNetwork[];
  knownSsids: string[];
}

export function getSignalStrength(rssi: number): { label: string; className: string } {
  if (rssi >= -50) return { label: "非常に良い", className: "signal-excellent" };
  if (rssi >= -60) return { label: "良い", className: "signal-good" };
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

function NetworkItem({ network }: { network: WifiNetwork }) {
  const { label, className } = getSignalStrength(network.rssi);
  return (
    <div className="wifi-item">
      <span className="col-signal">
        <SignalBars rssi={network.rssi} />
        <span className={`signal-label ${className}`}>{label} ({rssiToPercent(network.rssi)}%)</span>
      </span>
      <span className="col-ssid" title={network.ssid}>
        {network.ssid || "(非公開ネットワーク)"}
      </span>
    </div>
  );
}

export default function WifiList({ networks, knownSsids }: WifiListProps) {
  if (networks.length === 0) {
    return <p className="no-networks">ネットワークが見つかりません</p>;
  }

  const { known, other } = categorizeNetworks(networks, knownSsids);

  return (
    <div className="wifi-list">
      {known.length > 0 && (
        <div className="wifi-section">
          <div className="section-header">既知のネットワーク</div>
          {known.map((network, index) => (
            <NetworkItem
              key={`known-${network.ssid}-${index}`}
              network={network}
            />
          ))}
        </div>
      )}
      {other.length > 0 && (
        <div className="wifi-section">
          <div className="section-header">その他のネットワーク</div>
          {other.map((network, index) => (
            <NetworkItem
              key={`other-${network.ssid}-${index}`}
              network={network}
            />
          ))}
        </div>
      )}
    </div>
  );
}
