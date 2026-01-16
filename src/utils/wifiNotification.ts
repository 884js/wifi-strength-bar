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

export function rssiToPercent(_rssi: number): number {
  // TODO: 実装
  return 0;
}

export function findStrongerNetworks(
  _networks: WifiNetwork[],
  _current: CurrentNetwork | null
): WifiNetwork[] {
  // TODO: 実装
  return [];
}

export function shouldNotify(
  _strongest: WifiNetwork | null,
  _current: CurrentNetwork | null,
  _threshold: number
): boolean {
  // TODO: 実装
  return false;
}
