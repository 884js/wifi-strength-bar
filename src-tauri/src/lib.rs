use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WifiNetwork {
    pub ssid: String,
    pub rssi: i32,
    pub channel: i32,
    pub security: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub networks: Vec<WifiNetwork>,
    #[serde(rename = "locationPermission")]
    pub location_permission: String,
}

#[cfg(target_os = "macos")]
mod location {
    use objc2_core_location::{CLLocationManager, CLAuthorizationStatus};

    pub fn request_location_permission() -> String {
        let manager = unsafe { CLLocationManager::new() };

        // Request permission - this triggers the system to show the app in Location Services
        unsafe {
            manager.requestWhenInUseAuthorization();
            manager.startUpdatingLocation();
            manager.stopUpdatingLocation();
        }

        // Get current authorization status
        let status = unsafe { manager.authorizationStatus() };

        match status {
            CLAuthorizationStatus::NotDetermined => "not_determined".to_string(),
            CLAuthorizationStatus::Restricted => "restricted".to_string(),
            CLAuthorizationStatus::Denied => "denied".to_string(),
            CLAuthorizationStatus::AuthorizedAlways => "authorized".to_string(),
            CLAuthorizationStatus::AuthorizedWhenInUse => "authorized".to_string(),
            _ => "unknown".to_string(),
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod location {
    pub fn request_location_permission() -> String {
        "not_supported".to_string()
    }
}

#[tauri::command]
fn scan_wifi() -> Result<ScanResult, String> {
    // Request location permission first (required for SSID on macOS)
    let permission_status = location::request_location_permission();

    let networks = wifi_scan::scan()
        .map_err(|e| format!("WiFi スキャン失敗: {}", e))?;

    let mut converted: Vec<WifiNetwork> = networks
        .into_iter()
        .map(|w| WifiNetwork {
            ssid: w.ssid.clone(),
            rssi: w.signal_level as i32,
            channel: w.channel as i32,
            security: format!("{:?}", w.security),
        })
        .collect();

    // Sort by RSSI descending (strongest first)
    converted.sort_by(|a, b| b.rssi.cmp(&a.rssi));

    Ok(ScanResult {
        networks: converted,
        location_permission: permission_status,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![scan_wifi])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
