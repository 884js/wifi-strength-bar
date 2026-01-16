import { describe, it, expect } from "vitest";
import {
  findStrongerNetworks,
  shouldNotify,
  rssiToPercent,
  WifiNetwork,
  CurrentNetwork,
} from "./wifiNotification";

describe("wifiNotification", () => {
  describe("rssiToPercent", () => {
    it("-30dBmは100%として表示される", () => {
      expect(rssiToPercent(-30)).toBe(100);
    });

    it("-90dBmは0%として表示される", () => {
      expect(rssiToPercent(-90)).toBe(0);
    });

    it("-60dBmは50%として表示される", () => {
      expect(rssiToPercent(-60)).toBe(50);
    });

    it("境界値を超える場合はクランプされる", () => {
      expect(rssiToPercent(-20)).toBe(100);
      expect(rssiToPercent(-100)).toBe(0);
    });
  });

  describe("findStrongerNetworks", () => {
    it("現在接続中より強いネットワークを見つける", () => {
      const networks: WifiNetwork[] = [
        { ssid: "Network1", rssi: -50, channel: 1, security: "WPA2" },
        { ssid: "Network2", rssi: -60, channel: 6, security: "WPA2" },
        { ssid: "Network3", rssi: -70, channel: 11, security: "WPA2" },
      ];
      const current: CurrentNetwork = { ssid: "Network2", rssi: -60 };

      const stronger = findStrongerNetworks(networks, current);

      expect(stronger).toHaveLength(1);
      expect(stronger[0].ssid).toBe("Network1");
    });

    it("同じSSIDのネットワークは除外する", () => {
      const networks: WifiNetwork[] = [
        { ssid: "CurrentNetwork", rssi: -50, channel: 1, security: "WPA2" },
        { ssid: "OtherNetwork", rssi: -65, channel: 6, security: "WPA2" },
      ];
      const current: CurrentNetwork = { ssid: "CurrentNetwork", rssi: -60 };

      const stronger = findStrongerNetworks(networks, current);

      // 同じSSIDのCurrentNetworkは除外され、OtherNetworkは弱いので返されない
      expect(stronger).toHaveLength(0);
    });

    it("より強いネットワークがない場合は空配列を返す", () => {
      const networks: WifiNetwork[] = [
        { ssid: "Network1", rssi: -70, channel: 1, security: "WPA2" },
        { ssid: "Network2", rssi: -80, channel: 6, security: "WPA2" },
      ];
      const current: CurrentNetwork = { ssid: "CurrentNetwork", rssi: -60 };

      const stronger = findStrongerNetworks(networks, current);

      expect(stronger).toHaveLength(0);
    });

    it("現在の接続がnullの場合は空配列を返す", () => {
      const networks: WifiNetwork[] = [
        { ssid: "Network1", rssi: -50, channel: 1, security: "WPA2" },
      ];

      const stronger = findStrongerNetworks(networks, null);

      expect(stronger).toHaveLength(0);
    });
  });

  describe("shouldNotify", () => {
    it("閾値を超える強さの差がある場合にtrueを返す", () => {
      const strongest: WifiNetwork = {
        ssid: "StrongNetwork",
        rssi: -50,
        channel: 1,
        security: "WPA2",
      };
      const current: CurrentNetwork = { ssid: "CurrentNetwork", rssi: -65 };
      const threshold = 10;

      expect(shouldNotify(strongest, current, threshold)).toBe(true);
    });

    it("閾値以下の差の場合にfalseを返す", () => {
      const strongest: WifiNetwork = {
        ssid: "StrongNetwork",
        rssi: -55,
        channel: 1,
        security: "WPA2",
      };
      const current: CurrentNetwork = { ssid: "CurrentNetwork", rssi: -60 };
      const threshold = 10;

      expect(shouldNotify(strongest, current, threshold)).toBe(false);
    });

    it("ちょうど閾値の場合にfalseを返す", () => {
      const strongest: WifiNetwork = {
        ssid: "StrongNetwork",
        rssi: -50,
        channel: 1,
        security: "WPA2",
      };
      const current: CurrentNetwork = { ssid: "CurrentNetwork", rssi: -60 };
      const threshold = 10;

      expect(shouldNotify(strongest, current, threshold)).toBe(false);
    });

    it("currentがnullの場合にfalseを返す", () => {
      const strongest: WifiNetwork = {
        ssid: "StrongNetwork",
        rssi: -50,
        channel: 1,
        security: "WPA2",
      };

      expect(shouldNotify(strongest, null, 10)).toBe(false);
    });

    it("strongestがnullの場合にfalseを返す", () => {
      const current: CurrentNetwork = { ssid: "CurrentNetwork", rssi: -60 };

      expect(shouldNotify(null, current, 10)).toBe(false);
    });
  });
});
