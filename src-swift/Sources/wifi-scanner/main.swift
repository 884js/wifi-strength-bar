import CoreLocation
import CoreWLAN
import Foundation

struct WifiNetwork: Codable {
    let ssid: String
    let rssi: Int
    let channel: Int
    let security: String
}

struct ScanResult: Codable {
    let networks: [WifiNetwork]
    let locationPermission: String
}

class LocationDelegate: NSObject, CLLocationManagerDelegate {
    var authorizationStatus: CLAuthorizationStatus = .notDetermined
    let semaphore = DispatchSemaphore(value: 0)

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        semaphore.signal()
    }
}

func getSecurityString(_ network: CWNetwork) -> String {
    if network.supportsSecurity(.wpa3Personal) || network.supportsSecurity(.wpa3Enterprise) {
        return "WPA3"
    } else if network.supportsSecurity(.wpa2Personal) || network.supportsSecurity(.wpa2Enterprise) {
        return "WPA2"
    } else if network.supportsSecurity(.wpaPersonal) || network.supportsSecurity(.wpaEnterprise) {
        return "WPA"
    } else if network.supportsSecurity(.dynamicWEP) {
        return "WEP"
    } else if network.supportsSecurity(.none) {
        return "Open"
    }
    return "Unknown"
}

func scanWifi() -> [WifiNetwork] {
    let client = CWWiFiClient.shared()
    guard let interface = client.interface() else {
        fputs("Error: Could not get WiFi interface\n", stderr)
        return []
    }

    do {
        let networks = try interface.scanForNetworks(withName: nil)

        var result: [WifiNetwork] = []
        for network in networks {
            let ssid = network.ssid ?? "(非公開)"
            let rssi = network.rssiValue
            let channel = network.wlanChannel?.channelNumber ?? 0
            let security = getSecurityString(network)

            result.append(WifiNetwork(
                ssid: ssid,
                rssi: rssi,
                channel: channel,
                security: security
            ))
        }

        // Sort by RSSI descending (strongest first)
        result.sort { $0.rssi > $1.rssi }

        return result
    } catch {
        fputs("Error scanning: \(error.localizedDescription)\n", stderr)
        return []
    }
}

func getPermissionString(_ status: CLAuthorizationStatus) -> String {
    switch status {
    case .notDetermined:
        return "not_determined"
    case .restricted:
        return "restricted"
    case .denied:
        return "denied"
    case .authorizedAlways, .authorizedWhenInUse:
        return "authorized"
    @unknown default:
        return "unknown"
    }
}

// Main
let locationManager = CLLocationManager()
let delegate = LocationDelegate()
locationManager.delegate = delegate

// 位置情報の更新を開始（これがトリガーとなり、位置情報サービス一覧に追加される）
locationManager.startUpdatingLocation()

// 少し待ってステータスを確認（最大1秒）
_ = delegate.semaphore.wait(timeout: .now() + 1.0)

locationManager.stopUpdatingLocation()

let permissionStatus = getPermissionString(delegate.authorizationStatus)
let networks = scanWifi()

let result = ScanResult(
    networks: networks,
    locationPermission: permissionStatus
)

let encoder = JSONEncoder()
encoder.outputFormatting = .prettyPrinted

if let jsonData = try? encoder.encode(result),
   let jsonString = String(data: jsonData, encoding: .utf8) {
    print(jsonString)
}
