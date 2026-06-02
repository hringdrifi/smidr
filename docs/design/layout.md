---
title: レイアウト編集
---

<script setup>
import { withBase } from 'vitepress'
</script>

# レイアウト編集

レイアウトでは、キーを追加し、ドラッグで位置を調整します。座標は 1u を基準にしており、通常操作では 0.25u 単位にスナップします。

<figure>
  <img :src="withBase('/assets/smidr-editor-layout.png')" alt="レイアウトエディタでキー配置を編集している画面">
  <figcaption>分割キーボードや親指クラスタのような、傾きのある配置も扱えます。</figcaption>
</figure>

## 選択と移動

- クリック: 1つのキーを選択します。
- Ctrl / Cmd + クリック: 選択を追加または解除します。
- Shift + クリック: 範囲選択します。
- ドラッグ: 選択中のキーをまとめて移動します。
- Alt + ドラッグ: スナップを一時的に無効にします。

## レイアウトオプション

ISO / ANSI の差分や、分割スペースバー、複数の親指キー構成のように、同じキーボード内で選択式の形を持つ場合はレイアウトオプションを使います。

<figure>
  <img :src="withBase('/assets/smidr-editor-layout-options.png')" alt="レイアウトオプションパネルを開いた画面">
  <figcaption>レイアウトオプションは、VIA / Vial 系の layout option と対応させるための情報としても使います。</figcaption>
</figure>
