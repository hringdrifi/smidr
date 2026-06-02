---
title: アクション / キーコード
---

# アクション / キーコード

Smiðr は、QMK / VIA / Vial / ZMK のキー割り当てをそのまま文字列として扱うのではなく、内部では `UniversalAction` という共通のデータ構造として扱います。`UniversalAction` は、ファームウェアごとのキーコード表記やレイヤー操作の違いを吸収する中間レイヤです。

UI はこの中間レイヤを編集し、接続先や出力先に応じて QMK / VIA / Vial / ZMK 向けの形式へ変換します。これにより、設計モードのキーマップ、リマップモードの実機通信、各ファームウェア向けの出力を同じ考え方で扱えます。

キーコードそのものは `UniversalKey` として表します。ユーザー向けには「キーコード」と呼べますが、コード上の型名は `UniversalKey` です。

## UniversalAction

`UniversalAction` は、キーに割り当てる動作を表します。

| action | 意味 | 例 |
| --- | --- | --- |
| `trans` | 透過。下位レイヤーの割り当てを使います。 | `{ action: 'trans' }` |
| `none` | 何もしないキーです。 | `{ action: 'none' }` |
| `tap` | 通常のキー入力です。修飾キー同時押しも `mods` で表します。 | `{ action: 'tap', keycode: 'A' }` |
| `mo` | 押している間だけ指定レイヤーへ移動します。 | `{ action: 'mo', layerId: 1 }` |
| `tg` | 指定レイヤーの有効/無効を切り替えます。 | `{ action: 'tg', layerId: 2 }` |
| `to` | 指定レイヤーへ直接切り替えます。 | `{ action: 'to', layerId: 3 }` |
| `lt` | ホールドでレイヤー、タップで別アクションを実行します。 | `{ action: 'lt', layerId: 1, tapAction: { action: 'tap', keycode: 'SPC' } }` |
| `mt` | ホールドで修飾キー、タップで別アクションを実行します。 | `{ action: 'mt', modifiers: ['LCTL'], tapAction: { action: 'tap', keycode: 'A' } }` |
| `macro` | マクロを呼び出します。 | `{ action: 'macro', macroId: 0 }` |
| `lighting` | ライティング操作です。 | `{ action: 'lighting', command: 'TOGGLE' }` |
| `custom` | プロトコル固有の任意コードです。 | `{ action: 'custom', protocol: 'qmk', rawCode: 'RGB_TOG' }` |

## tap

`tap` は通常のキー入力です。`keycode` に `UniversalKey` を指定します。

```ts
{ action: 'tap', keycode: 'A' }
{ action: 'tap', keycode: 'SPC' }
```

修飾キーを同時に押す場合は `mods` を使います。

```ts
{ action: 'tap', keycode: 'A', mods: ['LCTL', 'LSFT'] }
```

## レイヤー操作

レイヤー操作は、対象レイヤーを `layerId` で指定します。

```ts
{ action: 'mo', layerId: 1 }
{ action: 'tg', layerId: 2 }
{ action: 'to', layerId: 3 }
```

`lt` は、ホールド時のレイヤー移動とタップ時の動作を組み合わせます。

```ts
{
  action: 'lt',
  layerId: 1,
  tapAction: { action: 'tap', keycode: 'SPC' }
}
```

## モッドタップ

`mt` は、ホールド時の修飾キーとタップ時の動作を組み合わせます。

```ts
{
  action: 'mt',
  modifiers: ['LCTL'],
  tapAction: { action: 'tap', keycode: 'A' }
}
```

複数の修飾キーを指定することもできます。

```ts
{
  action: 'mt',
  modifiers: ['LCTL', 'LSFT'],
  tapAction: { action: 'tap', keycode: 'SPC' }
}
```

## Modifier

`Modifier` は修飾キーを表します。

| 値 | 意味 |
| --- | --- |
| `LCTL` | 左 Control |
| `LSFT` | 左 Shift |
| `LALT` | 左 Alt |
| `LGUI` | 左 GUI |
| `RCTL` | 右 Control |
| `RSFT` | 右 Shift |
| `RALT` | 右 Alt |
| `RGUI` | 右 GUI |

## UniversalKey

`UniversalKey` は、Smiðr 内部で使うキーコード名です。QMK の `KC_` 接頭辞は外した形で表します。

たとえば、QMK の `KC_A` は `A`、`KC_SPC` は `SPC`、`KC_BSPC` は `BSPC` です。

### 英数字

```text
A B C ... Z
1 2 3 ... 0
```

### ファンクションキー

```text
F1 F2 ... F24
```

### 基本キー

```text
ESC TAB CAPS ENT BSPC SPC
```

### 記号

```text
MINS EQL LBRC RBRC BSLS
SCLN QUOT GRV COMM DOT SLSH NUHS NUBS
```

### JIS 固有キー

```text
YEN RO MHEN HENK KANA EISU
```

### ナビゲーション

```text
UP DOWN LEFT RIGHT
INS DEL HOME END PGUP PGDN
```

### 修飾キー

```text
LCTL LSFT LALT LGUI
RCTL RSFT RALT RGUI
```

### メディア / システム

```text
MPLY MSTP MNXT MPRV
VOLU VOLD MUTE
BRIU BRID
BOOTLOADER SYSTEM_RESET
```

### マウスキー

```text
MOUSE_UP MOUSE_DOWN MOUSE_LEFT MOUSE_RIGHT
MOUSE_BTN1 MOUSE_BTN2 MOUSE_BTN3 MOUSE_BTN4 MOUSE_BTN5
```

### 特別なキー

```text
TRNS NO
```

`TRNS` は透過、`NO` は無操作を表すキーコードです。`UniversalAction` として扱う場合は、通常は `{ action: 'trans' }` または `{ action: 'none' }` を使います。

## custom

`custom` は、Smiðr が標準の `UniversalAction` として解釈しないコードを保持するための逃げ道です。

```ts
{
  action: 'custom',
  protocol: 'qmk',
  rawCode: 'RGB_TOG',
  label: 'RGB Toggle'
}
```

`protocol` には `qmk`、`via`、`vial`、`zmk` のいずれかを指定します。
