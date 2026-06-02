---
title: ハードウェア設定
---

<script setup>
import { withBase } from 'vitepress'
</script>

# ハードウェア設定

Hardware Settings では、キーボード名、MCU または開発ボード、row / col ピン、ダイオード方向などを設定します。QMK / VIA / Vial / ZMK 向けの出力では、この情報が生成されるファイルに反映されます。

<figure>
  <img :src="withBase('/assets/smidr-editor-hardware.png')" alt="Hardware Settings で MCU とマトリックス設定を編集している画面">
  <figcaption>ピン割り当てが未設定のままでも編集はできますが、ソース出力にはハードウェア設定が必要です。</figcaption>
</figure>

## Vial 設定

Vial 向けに出力する場合は、Vial UID や unlock combo などの設定も確認します。実機と接続してリマップする場合、定義情報とデバイス情報の対応が重要になります。
