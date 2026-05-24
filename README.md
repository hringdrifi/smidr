# Smiðr (スミズル) — Custom Keyboard Designer

Smiðr は、直感的な操作でカスタムキーボードの物理レイアウト、マトリックス配線、およびハードウェア構成を設計できる次世代のウェブベース・キーボードエディタです。

[🚀 デモページを開く (GitHub Pages)](https://hringdrifi.github.io/smidr/)

## 特徴

- **直感的なキャンバス操作**: `react-konva` を使用したスムーズな 2D キャンバス上でのキー配置、回転、複数選択。
- **強力な履歴管理**: `zundo` による完全な Undo/Redo サポート。
- **精密な設計**: 0.25u 単位のグリッドスナップと、物理演算に基づいた衝突判定。
- **KLE 互換**: Keyboard Layout Editor (KLE) の JSON インポート/エクスポートをサポート。
- **マトリックス・ハードウェア設計**: 配線順序のペイント機能や、MCU/ピンアサインの設定。

## テックスタック

- **Framework**: React 19 (SPA)
- **Build Tool**: Vite
- **State Management**: Zustand + zundo (Temporal history)
- **Styling**: Tailwind CSS v4 + Vanilla CSS
- **Canvas**: react-konva

## はじめかた

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:5173](http://localhost:5173) を開いて確認してください。

### 3. ビルド

```bash
npm run build
```

## 開発ガイドライン

開発の詳細については、以下のドキュメントを参照してください。
- [SPECIFICATION.md](./SPECIFICATION.md): 技術仕様とコアロジック
- [GEMINI.md](./GEMINI.md): 開発ルールと UI/UX 規約
- [AGENTS.md](./AGENTS.md): AI エージェント向けのガイド

## ライセンス

MIT License
