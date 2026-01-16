export interface WifiNetwork {
  ssid: string;
  rssi: number;
  channel: number;
  security: string;
}

export interface CurrentNetwork {
  ssid: string;
  rssi: number;
}

const RSSI_MIN = -90;
const RSSI_MAX = -30;

export function rssiToPercent(rssi: number): number {
  const clamped = Math.max(RSSI_MIN, Math.min(RSSI_MAX, rssi));
  return Math.round(((clamped - RSSI_MIN) / (RSSI_MAX - RSSI_MIN)) * 100);
}

export function findStrongerNetworks(
  networks: WifiNetwork[],
  current: CurrentNetwork | null
): WifiNetwork[] {
  if (!current) {
    return [];
  }
  return networks.filter(
    (network) => network.ssid !== current.ssid && network.rssi > current.rssi
  );
}

export function shouldNotify(
  strongest: WifiNetwork | null,
  current: CurrentNetwork | null,
  threshold: number
): boolean {
  if (!strongest || !current) {
    return false;
  }
  return strongest.rssi > current.rssi + threshold;
}
