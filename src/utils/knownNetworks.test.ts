import { describe, expect, it } from "vitest";
import { categorizeNetworks } from "./knownNetworks";

interface WifiNetwork {
  ssid: string;
  rssi: number;
  channel: number;
  security: string;
}

describe("categorizeNetworks", () => {
  it("既知のSSIDリストに含まれるネットワークをknownに分類する", () => {
    const networks: WifiNetwork[] = [
      { ssid: "MyHomeWiFi", rssi: -45, channel: 6, security: "WPA2" },
      { ssid: "OfficeNetwork", rssi: -55, channel: 11, security: "WPA2" },
      { ssid: "Neighbor_5G", rssi: -65, channel: 36, security: "WPA3" },
    ];
    const knownSsids = ["MyHomeWiFi", "OfficeNetwork"];

    const result = categorizeNetworks(networks, knownSsids);

    expect(result.known).toHaveLength(2);
    expect(result.known.map((n) => n.ssid)).toEqual([
      "MyHomeWiFi",
      "OfficeNetwork",
    ]);
    expect(result.other).toHaveLength(1);
    expect(result.other[0].ssid).toBe("Neighbor_5G");
  });

  it("既知のSSIDリストが空の場合、全てotherに分類する", () => {
    const networks: WifiNetwork[] = [
      { ssid: "Network1", rssi: -50, channel: 1, security: "WPA2" },
      { ssid: "Network2", rssi: -60, channel: 6, security: "WPA2" },
    ];
    const knownSsids: string[] = [];

    const result = categorizeNetworks(networks, knownSsids);

    expect(result.known).toHaveLength(0);
    expect(result.other).toHaveLength(2);
  });

  it("ネットワークリストが空の場合、空の結果を返す", () => {
    const networks: WifiNetwork[] = [];
    const knownSsids = ["SomeNetwork"];

    const result = categorizeNetworks(networks, knownSsids);

    expect(result.known).toHaveLength(0);
    expect(result.other).toHaveLength(0);
  });

  it("RSSI順序を保持する（入力がソート済みの場合）", () => {
    // 入力は既にRSSI順にソートされている（実際のスキャン結果と同じ）
    const networks: WifiNetwork[] = [
      { ssid: "StrongKnown", rssi: -30, channel: 1, security: "WPA2" },
      { ssid: "StrongUnknown", rssi: -35, channel: 36, security: "WPA2" },
      { ssid: "MediumKnown", rssi: -55, channel: 11, security: "WPA2" },
      { ssid: "WeakUnknown", rssi: -80, channel: 6, security: "WPA2" },
    ];
    const knownSsids = ["StrongKnown", "MediumKnown"];

    const result = categorizeNetworks(networks, knownSsids);

    // known内でRSSI順を保持
    expect(result.known[0].ssid).toBe("StrongKnown");
    expect(result.known[1].ssid).toBe("MediumKnown");
    // other内でRSSI順を保持
    expect(result.other[0].ssid).toBe("StrongUnknown");
    expect(result.other[1].ssid).toBe("WeakUnknown");
  });

  it("非公開ネットワーク（空SSID）はotherに分類する", () => {
    const networks: WifiNetwork[] = [
      { ssid: "", rssi: -50, channel: 1, security: "WPA2" },
      { ssid: "KnownNetwork", rssi: -60, channel: 6, security: "WPA2" },
    ];
    const knownSsids = ["KnownNetwork"];

    const result = categorizeNetworks(networks, knownSsids);

    expect(result.known).toHaveLength(1);
    expect(result.known[0].ssid).toBe("KnownNetwork");
    expect(result.other).toHaveLength(1);
    expect(result.other[0].ssid).toBe("");
  });
});
