use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{
    Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

// show()した時刻を記録
static LAST_SHOW_TIME: std::sync::OnceLock<Mutex<Option<Instant>>> = std::sync::OnceLock::new();

fn get_last_show_time() -> &'static Mutex<Option<Instant>> {
    LAST_SHOW_TIME.get_or_init(|| Mutex::new(None))
}

const FOCUS_GRACE_PERIOD: Duration = Duration::from_millis(500);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WifiNetwork {
    pub ssid: String,
    pub rssi: i32,
    pub channel: i32,
    pub security: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrentNetwork {
    pub ssid: String,
    pub rssi: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub networks: Vec<WifiNetwork>,
    #[serde(rename = "locationPermission")]
    pub location_permission: String,
    #[serde(rename = "currentNetwork")]
    pub current_network: Option<CurrentNetwork>,
    #[serde(rename = "knownSsids")]
    pub known_ssids: Vec<String>,
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

#[cfg(target_os = "macos")]
mod current_wifi {
    use super::CurrentNetwork;
    use objc2_core_wlan::CWWiFiClient;

    pub fn get_current_network() -> Option<CurrentNetwork> {
        unsafe {
            let client = CWWiFiClient::sharedWiFiClient();
            let interface = client.interface()?;

            let ssid_ns = interface.ssid();
            let ssid = ssid_ns.as_deref()?.to_string();

            let rssi = interface.rssiValue();

            Some(CurrentNetwork {
                ssid,
                rssi: rssi as i32,
            })
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod current_wifi {
    use super::CurrentNetwork;

    pub fn get_current_network() -> Option<CurrentNetwork> {
        None
    }
}

#[cfg(target_os = "macos")]
mod known_networks {
    use objc2_core_wlan::{CWWiFiClient, CWNetworkProfile};

    pub fn get_known_ssids() -> Vec<String> {
        unsafe {
            let client = CWWiFiClient::sharedWiFiClient();
            let Some(interface) = client.interface() else {
                return Vec::new();
            };
            let Some(config) = interface.configuration() else {
                return Vec::new();
            };
            let profiles = config.networkProfiles();
            let count = profiles.count();

            let mut ssids = Vec::new();
            for i in 0..count {
                let profile: objc2::rc::Retained<CWNetworkProfile> = profiles.objectAtIndex(i);
                if let Some(ssid) = profile.ssid() {
                    ssids.push(ssid.to_string());
                }
            }
            ssids
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod known_networks {
    pub fn get_known_ssids() -> Vec<String> {
        Vec::new()
    }
}

#[tauri::command]
fn open_location_settings() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices")
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// キャッシュ用のグローバル変数
static SCAN_CACHE: std::sync::OnceLock<Arc<Mutex<Option<ScanResult>>>> = std::sync::OnceLock::new();

fn get_scan_cache() -> &'static Arc<Mutex<Option<ScanResult>>> {
    SCAN_CACHE.get_or_init(|| Arc::new(Mutex::new(None)))
}

// 実際のスキャンを実行する内部関数
fn perform_scan() -> Result<ScanResult, String> {
    // Request location permission first (required for SSID on macOS)
    let permission_status = location::request_location_permission();

    // Get current connected network
    let current_network = current_wifi::get_current_network();

    // Get known network SSIDs
    let known_ssids = known_networks::get_known_ssids();

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

    // 接続中のネットワークのRSSIをリストにも反映（一貫性のため）
    if let Some(ref current) = current_network {
        for network in &mut converted {
            if network.ssid == current.ssid {
                network.rssi = current.rssi;
            }
        }
    }

    // Sort by RSSI descending (strongest first)
    converted.sort_by(|a, b| b.rssi.cmp(&a.rssi));

    Ok(ScanResult {
        networks: converted,
        location_permission: permission_status,
        current_network,
        known_ssids,
    })
}

// バックグラウンドスキャンを開始する関数
fn start_background_scanner() {
    let cache = get_scan_cache().clone();

    thread::spawn(move || {
        loop {
            if let Ok(result) = perform_scan() {
                if let Ok(mut guard) = cache.lock() {
                    *guard = Some(result);
                }
            }
            thread::sleep(Duration::from_secs(3));
        }
    });
}

#[tauri::command]
fn scan_wifi() -> Result<ScanResult, String> {
    // キャッシュから結果を返す（即座）
    let cache = get_scan_cache();
    if let Ok(guard) = cache.lock() {
        if let Some(ref result) = *guard {
            return Ok(result.clone());
        }
    }

    // キャッシュがない場合は実際にスキャン
    perform_scan()
}

#[tauri::command]
fn force_scan_wifi() -> Result<ScanResult, String> {
    // 強制的にスキャンを実行してキャッシュを更新
    let result = perform_scan()?;

    let cache = get_scan_cache();
    if let Ok(mut guard) = cache.lock() {
        *guard = Some(result.clone());
    }

    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            // バックグラウンドスキャナーを開始
            start_background_scanner();

            // macOSでドックアイコンを非表示
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // macOSでウィンドウの角を丸くする
            #[cfg(target_os = "macos")]
            {
                use objc2_app_kit::{NSColor, NSWindow};
                use objc2::rc::Retained;

                if let Some(window) = app.get_webview_window("main") {
                    let ns_window: Retained<NSWindow> = unsafe {
                        Retained::from_raw(window.ns_window().unwrap() as *mut NSWindow).unwrap()
                    };
                    ns_window.setOpaque(false);
                    ns_window.setBackgroundColor(Some(&NSColor::clearColor()));

                    if let Some(content_view) = ns_window.contentView() {
                        content_view.setWantsLayer(true);
                        if let Some(layer) = content_view.layer() {
                            layer.setCornerRadius(16.0);
                            layer.setMasksToBounds(true);
                        }
                    }
                }
            }

            // メニュー作成
            let show_i = MenuItem::with_id(app, "show", "表示", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // トレイアイコン作成
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // トレイ位置をpositionerプラグインに通知
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);

                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                use tauri_plugin_positioner::{WindowExt, Position};
                                let _ = window.move_window(Position::TrayBottomCenter);
                                // タイムスタンプを記録
                                if let Ok(mut guard) = get_last_show_time().lock() {
                                    *guard = Some(Instant::now());
                                }
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let _ = window.hide();
                    api.prevent_close();
                }
                tauri::WindowEvent::Focused(false) => {
                    // 猶予期間内ならhideしない
                    let in_grace_period = get_last_show_time()
                        .lock()
                        .ok()
                        .and_then(|guard| *guard)
                        .map_or(false, |t| t.elapsed() < FOCUS_GRACE_PERIOD);

                    if !in_grace_period {
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![scan_wifi, force_scan_wifi, open_location_settings])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
