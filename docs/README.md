# WiFi Strength Bar

macOS向けのWiFi電波強度モニターアプリ。周囲のWiFiネットワークをスキャンし、電波強度順にリアルタイムで表示します。

## 技術スタック

- **フレームワーク**: Tauri v2
- **フロントエンド**: React + TypeScript (Vite)
- **バックエンド**: Rust
- **WiFiスキャン**: Swift (CoreWLAN API)

## アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│  React/TypeScript (UI)                          │
│  - WiFiネットワーク一覧表示                       │
│  - 電波強度のビジュアル表示                       │
│  - 3秒間隔でリアルタイム更新                      │
└─────────────────┬───────────────────────────────┘
                  │ invoke('scan_wifi')
┌─────────────────▼───────────────────────────────┐
│  Rust (Tauri Commands)                          │
│  - フロントエンドとの橋渡し                       │
│  - Swiftバイナリの実行                           │
└─────────────────┬───────────────────────────────┘
                  │ subprocess
┌─────────────────▼───────────────────────────────┐
│  Swift CLI (wifi-scanner)                       │
│  - CoreWLAN APIでネットワークスキャン             │
│  - JSON形式で結果を出力                          │
└─────────────────────────────────────────────────┘
```

## プロジェクト構成

```
wifi-monitor/
├── src/                      # React フロントエンド
│   ├── App.tsx               # メインコンポーネント
│   ├── components/
│   │   └── WifiList.tsx      # WiFi一覧表示
│   ├── styles.css            # スタイル
│   └── main.tsx              # エントリーポイント
├── src-tauri/                # Tauri バックエンド
│   ├── src/
│   │   ├── main.rs           # Rustエントリーポイント
│   │   └── lib.rs            # scan_wifi コマンド
│   ├── binaries/             # Swiftバイナリ
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src-swift/                # WiFiスキャナー (Swift)
│   ├── Package.swift
│   └── Sources/
│       └── wifi-scanner/
│           └── main.swift
├── docs/                     # ドキュメント
├── package.json
└── .gitignore
```

## セットアップ

### 必要条件

- Node.js 18+
- Rust (rustup)
- Xcode Command Line Tools (Swift)

### インストール

```bash
# 依存関係のインストール
npm install

# Swiftスキャナーのビルド
cd src-swift
swift build -c release
cp .build/release/wifi-scanner ../src-tauri/binaries/wifi-scanner-aarch64-apple-darwin
cd ..
```

## 開発

```bash
# 開発サーバー起動
npm run tauri dev
```

## ビルド

```bash
# プロダクションビルド
npm run tauri build
```

ビルド成果物:
- `src-tauri/target/release/bundle/macos/WiFi Strength Bar.app`
- `src-tauri/target/release/bundle/dmg/WiFi Strength Bar_0.1.0_aarch64.dmg`

## 位置情報サービスについて

macOSでWiFiのSSID（ネットワーク名）を取得するには、**位置情報サービス**の許可が必要です。

### 許可の付与方法

1. アプリ（.app）をビルドして実行
2. システム設定 → プライバシーとセキュリティ → 位置情報サービス
3. 「WiFi Strength Bar」を探してチェックを入れる

許可がない場合、SSIDは「(非公開)」と表示されますが、電波強度（RSSI）は正常に取得できます。

## 機能

- 電波強度（RSSI）の降順でソート
- SSID、RSSI、チャンネル、セキュリティタイプを表示
- RSSIに応じた色分け表示
  - 緑: -50 dBm 以上（非常に良好）
  - 黄緑: -60 dBm 以上（良好）
  - 黄: -70 dBm 以上（普通）
  - 赤: -70 dBm 未満（弱い）
- 3秒間隔でリアルタイム更新
