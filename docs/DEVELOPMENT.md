# 開発ガイド

## 開発環境のセットアップ

### 1. Rustのインストール

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### 2. Node.js依存関係のインストール

```bash
npm install
```

### 3. Swiftスキャナーのビルド

```bash
cd src-swift
swift build -c release
cp .build/release/wifi-scanner ../src-tauri/binaries/wifi-scanner-aarch64-apple-darwin
cd ..
```

## 開発コマンド

```bash
# 開発サーバー起動（ホットリロード対応）
npm run tauri dev

# プロダクションビルド
npm run tauri build

# フロントエンドのみビルド
npm run build

# TypeScriptの型チェック
npx tsc --noEmit
```

## コードの構成

### フロントエンド (React + TypeScript)

- `src/App.tsx` - メインコンポーネント、スキャン処理
- `src/components/WifiList.tsx` - WiFi一覧の表示
- `src/styles.css` - スタイル定義

### バックエンド (Rust)

- `src-tauri/src/lib.rs` - Tauriコマンド `scan_wifi` の実装
- `src-tauri/tauri.conf.json` - Tauri設定

### WiFiスキャナー (Swift)

- `src-swift/Sources/wifi-scanner/main.swift` - CoreWLAN APIを使用したスキャン

## データフロー

1. フロントエンドが `invoke('scan_wifi')` を呼び出し
2. Rustが `wifi-scanner` バイナリを実行
3. Swiftが CoreWLAN API でスキャンし、JSON を出力
4. Rustが JSON をパースしてフロントエンドに返す
5. React が一覧を更新

## JSON形式

```json
{
  "networks": [
    {
      "ssid": "MyNetwork",
      "rssi": -45,
      "channel": 6,
      "security": "WPA2"
    }
  ],
  "locationPermission": "authorized"
}
```

### locationPermission の値

- `authorized` - 位置情報が許可されている
- `denied` - 位置情報が拒否されている
- `not_determined` - まだ確認されていない
- `restricted` - 制限されている

## トラブルシューティング

### 開発モードで「応答なし」になる

Swiftスキャナーのバイナリが存在しない可能性があります。

```bash
cd src-swift
swift build -c release
cp .build/release/wifi-scanner ../src-tauri/binaries/wifi-scanner-aarch64-apple-darwin
```

### SSIDが「(非公開)」と表示される

位置情報サービスの許可が必要です。開発モードではターミナルに、ビルド後は WiFi Monitor.app に許可を付与してください。

### ビルド時に "unknown path" エラー

`resource_dir()` の代わりに `current_exe()` を使用するようにlib.rsが修正されています。最新のコードを使用してください。
