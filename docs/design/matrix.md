---
title: マトリックス編集
---

<script setup>
import { withBase } from 'vitepress'
</script>

# マトリックス編集

Matrix では、各キーに row と col を設定します。見た目の並びと配線上の行列は一致しないことがあるため、Smiðr では物理レイアウトと同じキャンバス上で対応関係を確認しながら編集できます。

<figure>
  <img :src="withBase('/assets/smidr-editor-matrix.png')" alt="Matrix エディタで row と col を編集している画面">
  <figcaption>キーボードの見た目を確認しながら、配線上の対応を整理できます。</figcaption>
</figure>

## 割り当ての確認

割り当て済みのキーはキャンバス上に行列情報が表示されます。未設定や重複がある場合は、エクスポート前に Matrix で確認します。
