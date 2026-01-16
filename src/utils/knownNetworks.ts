interface WifiNetwork {
  ssid: string;
  rssi: number;
  channel: number;
  security: string;
}

export interface CategorizedNetworks {
  known: WifiNetwork[];
  other: WifiNetwork[];
}

export function categorizeNetworks(
  networks: WifiNetwork[],
  knownSsids: string[]
): CategorizedNetworks {
  const knownSet = new Set(knownSsids);
  const known: WifiNetwork[] = [];
  const other: WifiNetwork[] = [];

  for (const network of networks) {
    if (network.ssid && knownSet.has(network.ssid)) {
      known.push(network);
    } else {
      other.push(network);
    }
  }

  return { known, other };
}
