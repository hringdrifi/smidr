---
title: キーマップ編集
---

<script setup>
import { withBase } from 'vitepress'
</script>

# キーマップ編集

キーマップでは、現在のレイヤーを選び、選択中のキーにキーコードを割り当てます。通常キーだけでなく、透過、無効、Momentary、Toggle、Layer Tap、Mod Tap などのアクションも扱います。

<figure>
  <img :src="withBase('/assets/smidr-editor-keymap.png')" alt="キーマップエディタでキーコードを編集している画面">
  <figcaption>設計時のキーマップは、リマップモードやエクスポート時の元データになります。</figcaption>
</figure>

## キーコードの割り当て

キーを選択してから、下部のキーコードパネルで割り当てたいアクションを選びます。Smiðr 内部では QMK / ZMK の違いを直接文字列で扱うのではなく、共通のアクションとして保持します。
