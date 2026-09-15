---
title: アクション / キーコード
---

# アクション / キーコード

Smiðr は、ファームウェア固有の文字列を直接キーマップの中心データにせず、キーの動作を `UniversalAction`、通常キーや機能キーを `UniversalKey` として保持します。出力時または実機への書き込み時に、QMK/VIA、Vial、ZMK、RMKの表現へ変換します。

どの対象で利用できるかは[ファームウェア対応表](/reference/firmware-compatibility)を参照してください。

## UniversalAction

| `action` | 画面上の項目 | 意味 | 例 |
| --- | --- | --- | --- |
| `trans` | 透過 | 下位レイヤーの割り当てを使います。 | `{ action: 'trans' }` |
| `none` | 何もしない | キー入力を行いません。 | `{ action: 'none' }` |
| `tap` | タップキー | `UniversalKey`を押します。`mods`で同時押し修飾を追加できます。 | `{ action: 'tap', keycode: 'A' }` |
| `mo` | レイヤー一時切り替え | 押している間だけ対象レイヤーを有効にします。 | `{ action: 'mo', layerId: 1 }` |
| `tg` | レイヤートグル | 対象レイヤーの有効・無効を切り替えます。 | `{ action: 'tg', layerId: 2 }` |
| `to` | レイヤー置換 | 対象レイヤーへ切り替えます。 | `{ action: 'to', layerId: 3 }` |
| `lt` | レイヤータップ | Holdでレイヤー、Tapで別のアクションを実行します。 | `{ action: 'lt', layerId: 1, tapAction: { action: 'tap', keycode: 'SPC' } }` |
| `mt` | モッドタップ | Holdで修飾キー、Tapで別のアクションを実行します。 | `{ action: 'mt', modifiers: ['LCTL'], tapAction: { action: 'tap', keycode: 'A' } }` |
| `macro` | マクロ | IDでMacroスロットまたは生成定義を参照します。 | `{ action: 'macro', macroId: 0 }` |
| `td` | Tap Dance | IDでTap Dance定義を参照します。 | `{ action: 'td', tapDanceId: 0 }` |
| `custom` | 任意 / Any | 対象固有のRawコードを変換せず保持します。 | `{ action: 'custom', protocol: 'zmk', rawCode: '&caps_word' }` |

## 修飾キーとタップ側アクション

`tap` の `mods` と `mt` の `modifiers` には、`LCTL`、`LSFT`、`LALT`、`LGUI`、`RCTL`、`RSFT`、`RALT`、`RGUI`を指定できます。選択した修飾キーが0個の場合、`tap.mods`は保存データから省略されます。

`lt.tapAction` と `mt.tapAction` も `UniversalAction` です。ただし、実際のファームウェア表現には入れ子にできる動作の制限があります。通常はタップ側に単純な `tap` を指定してください。

## Macro、Combo、Tap Dance

設計モードではMacro、Combo、Tap Danceの定義をプロジェクトへ保存し、対応するファームウェアソースへ変換します。リマップモードでは接続機器が公開するDynamic Macro、Dynamic Combo、Dynamic Tap Danceを直接編集し、プロジェクト側の定義とは分けて扱います。

Vialソース出力はDynamic Tap Dance側が同名シンボルを持つため、プロジェクトの静的Tap Dance定義を生成しません。ZMK Studioでは既存behaviorの割り当てはできますが、behavior定義の追加にはソース出力と再ビルドが必要です。

## UniversalKey

`UniversalKey` は、英数字、記号、ISO/JISキー、ファンクションキー、修飾キー、メディアキー、ライティング、マウス操作、ファームウェア操作を表すSmiðr内部の名前です。たとえば次のアクションは、出力先に応じて `KC_A`、`&kp A`、`A`などへ変換されます。

```ts
{ action: 'tap', keycode: 'A' }
```

主要な分類と対象ごとの可否は[ファームウェア対応表](/reference/firmware-compatibility)にまとめています。画面のパレットは選択中の対象に対する正のカタログであり、非対応キーを含む「ALL」一覧ではありません。

`TRNS` と `NO` はキー名としても存在しますが、通常は `{ action: 'trans' }` と `{ action: 'none' }` を使用します。

## custom

標準モデルにないコードは `custom` で保持できます。

```ts
{
  action: 'custom',
  protocol: 'qmk',
  rawCode: 'QK_USER_0',
  label: 'User 0'
}
```

`protocol` は `qmk`、`via`、`vial`、`zmk`、`rmk` のいずれかです。Rawコードは他のプロトコルへ翻訳されません。VIA実機へ書き込むRawコードは `0x1234` のような16bit値を使用します。
