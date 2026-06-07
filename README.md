# Smiðr (スミズル) — Keyboard Design & Remap Studio

Smiðr は、カスタムキーボードの **リマップ** と **設計** をひとつの流れで扱うためのツールです。

手元の VIA / Vial / ZMK Studio 互換キーボードに接続してキー割り当てを調整したり、新しいキーボードの物理レイアウト、マトリクス、キーマップ、ハードウェア設定をブラウザ上で組み立てたりできます。

自作キーボードでは、レイアウト作成、配線の整理、レイヤー設計、ファームウェア向けファイルの出力、実機での調整が別々の作業になりがちです。Smiðr はそれらを同じプロジェクトの中で扱い、設計中の情報と実機で触る情報をつなげることを目指しています。

[ベータ版ページを開く](https://hringdrifi.github.io/smidr/)  
[デモページを開く](https://hringdrifi.github.io/smidr/?demo=1)  
[ドキュメントを読む](https://hringdrifi.github.io/smidr/docs/)

## できること

### 実機をリマップする

VIA / Vial / ZMK Studio 互換キーボードに接続し、現在のキーマップを読み込んで編集できます。対応デバイスでは、ファームウェアを再ビルドせずにキー割り当てを変更できます。

- WebHID による VIA / Vial 互換キーボード接続
- Web Serial による ZMK Studio 互換キーボード接続
- Tauri デスクトップ版での Windows ネイティブ BLE 接続
- レイヤー、基本キー、メディアキー、モッドタップ、レイヤータップなどの編集
- デバイス側の対応状況に合わせた UI 表示

### キーボードを設計する

設計モードでは、キーの位置からファームウェア向けの出力までを段階的に編集できます。既存のレイアウトを読み込んで整えることも、プリセットから始めることもできます。

- 2D キャンバス上でのキー配置、サイズ変更、回転、複数選択
- KLE / VIA / Vial / QMK JSON のインポート
- KLE 互換 JSON、QMK / VIA / Vial / ZMK 向けファイルのエクスポート
- row / col のマトリクス割り当てと分割キーボード対応
- MCU、ピン、ダイオード方向などのハードウェア設定
- Macro / Combo / Tap Dance を含むキーマップ設計

### 設計と調整を行き来する

Smiðr は、レイアウト、マトリクス、キーマップ、ハードウェア設定を同じプロジェクトとして扱います。見た目の配置だけでなく、実際にファームウェアへ渡す情報までまとめて確認できるため、設計中のズレに気づきやすくなります。

## こんなときに使えます

- 手元の対応キーボードのキー割り当てを変えたい
- KLE で作ったレイアウトを、ファームウェア向けの情報まで含めて整理したい
- 分割キーボードのマトリクスやピン設定を視覚的に確認したい
- QMK / Vial / ZMK 向けの出力をひとつの設計データから作りたい
- レイアウト、レイヤー、マクロ、コンボ、タップダンスをまとめて設計したい

## 使いはじめる

まず試す場合は、ブラウザでベータ版またはデモページを開いてください。

- [ベータ版](https://hringdrifi.github.io/smidr/): 実際の接続やプロジェクト編集に使うページです。
- [デモ](https://hringdrifi.github.io/smidr/?demo=1): 仮想キーボードで画面の雰囲気を確認できます。
- [ドキュメント](https://hringdrifi.github.io/smidr/docs/): リマップ、設計、入出力、ショートカットの説明があります。

### リマップの流れ

1. キーボードを PC に接続します。
2. Smiðr のリマップモードを開きます。
3. `接続` からデバイスに合った方式を選びます。
4. 読み込まれたキーマップをキャンバス上で確認します。
5. キーを選び、下部のキーパレットや設定パネルから割り当てを変更します。

### 設計の流れ

1. 新規プロジェクトを作成します。
2. プリセット、または既存の KLE / VIA / Vial / QMK JSON を読み込みます。
3. レイアウトでキーの位置、サイズ、回転を整えます。
4. マトリクスで row / col を割り当てます。
5. キーマップでレイヤーやキーコードを編集します。
6. ハードウェア設定で MCU、ピン、ダイオード方向などを設定します。
7. 用途に合わせてプロジェクトファイルやファームウェア向けファイルを書き出します。

## 開発

### 必要なもの

- Node.js
- npm
- Rust / Cargo (Tauri デスクトップ版を使う場合)

### 依存関係のインストール

```bash
npm install
```

### 開発サーバー

```bash
npm run dev
```

ブラウザで [http://localhost:5173](http://localhost:5173) を開きます。

### ビルド

```bash
npm run build
```

### テスト

```bash
npm run test
npm run test:gui
```

### ドキュメント

```bash
npm run docs:dev
npm run docs:build
```

## デスクトップ版 / Tauri

Windows ネイティブ BLE 接続は Tauri デスクトップ版で利用できます。

開発時は、先に Vite 開発サーバーを起動します。

```bash
npm run dev
```

その後、別のターミナルでデスクトップ版を起動します。

```bash
npm run desktop:dev
```

デスクトップ版の exe をビルドする場合は、Tauri のビルドコマンドを実行します。内部で Web 版のビルドも実行されます。

```bash
npm run desktop:build
```

生成された exe は `src-tauri/target/release/smidr.exe` に出力されます。

`cargo tauri` が見つからない場合は、Tauri CLI をインストールしてください。

```bash
cargo install tauri-cli --version "^2"
```

## 技術構成

- React 19
- Vite
- Zustand + zundo
- Tailwind CSS v4
- react-konva
- Tauri

## 関連ドキュメント

- [SPECIFICATION.md](./SPECIFICATION.md): 技術仕様とコアロジック
- [GEMINI.md](./GEMINI.md): 開発ルールと UI/UX 規約
- [AGENTS.md](./AGENTS.md): AI エージェント向けのガイド

## ライセンス

MIT License
