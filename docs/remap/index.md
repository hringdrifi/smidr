---
title: リマップモード
---

<script setup>
import { withBase } from 'vitepress'
</script>

# リマップモード

リマップモードでは、VIA / Vial または ZMK Studio 互換のキーボードに接続し、現在のキーマップを読み込んで編集します。接続方式はキーボードの対応状況により、WebHID、WebUSB、WebBLE などを使います。

<figure>
  <img :src="withBase('/assets/smidr-remap-before-connect.png')" alt="リマップモードの接続待ち画面">
  <figcaption>接続前は、対応キーボードを接続してから上部の接続ボタンを使います。</figcaption>
</figure>

<figure>
  <img :src="withBase('/assets/smidr-remap-connect.png')" alt="リマップモードの接続メニュー">
  <figcaption>接続メニューから、キーボードが対応している方式を選びます。</figcaption>
</figure>

## 接続後の編集

Vial などの定義情報を取得できる場合は、レイアウトとキーマップを読み込んだ状態で編集できます。ZMK Studio ではロック状態や保存状態など、デバイス側の制約に従って操作します。

接続済み画面のスクリーンショットは実機環境に依存します。差し替え用の画像を追加する場合は、Vial または ZMK Studio 対応キーボードを接続した状態で撮影します。
