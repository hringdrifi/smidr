---
title: ファームウェア対応表
description: UniversalAction と UniversalKey が QMK/VIA、Vial、ZMK、RMKでどのように扱われるかを確認できます。
---

# ファームウェア対応表

Smiðr はキー割り当てを `UniversalAction` と `UniversalKey` で共通化し、選択したファームウェアまたは接続中のプロトコルに合わせて変換します。ただし、共通モデルに存在するすべての機能を、すべての出力先で同じように利用できるわけではありません。

設計モードではプロジェクトで選択したファームウェア、リマップモードでは接続したプロトコルが判定基準です。対象が未選択・未接続の場合は、複数ファームウェアを混ぜたパレットを表示しません。

## 表の見方

| 記号 | 意味 |
| --- | --- |
| ○ | Smiðr が変換・出力または実機への割り当てに対応しています。 |
| △ | 条件または制限があります。表の注記を確認してください。 |
| — | Smiðr の対象パレットには表示されず、標準変換にも対応していません。 |

「ソース」はSmiðrから生成するファームウェアソース、「実機」は接続中のキーボードへ直接書き込むリマップを表します。実機側の機能数やロック状態によって、○の項目でも利用できない場合があります。

## UniversalAction

| UniversalAction | QMK/VIA ソース | VIA 実機 | Vial ソース | Vial 実機 | ZMK ソース | ZMK Studio実機 | RMKソース | 補足 |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| `trans` / `none` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | 透過と無操作です。 |
| `tap` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | `UniversalKey` ごとの制限は後述します。 |
| `tap` + `mods` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | 1つ以上の修飾キーを通常キーと組み合わせます。 |
| `mo` / `tg` / `to` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | 対象レイヤーは接続機器・ファームウェアの上限内に限ります。 |
| `lt` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | タップ側のキーも対象ファームウェアで表現できる必要があります。 |
| `mt` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | 少なくとも1つのHold修飾キーが必要です。 |
| `macro` の割り当て | ○ | △ | ○ | ○ | ○ | △ | — | VIA/Vial実機はDynamic Macroスロット、ZMK Studioは発見済みbehaviorが必要です。RMKは定義出力を行いません。 |
| Macro定義の編集・生成 | ○ | — | ○ | ○ | ○ | — | — | 設計モードではQMK/Vial/ZMK用定義を生成します。実機の定義編集はVialに限ります。 |
| `td` の割り当て | ○ | △ | ○ | ○ | ○ | △ | — | VIAは既存のTap Danceキーコード、ZMK Studioは発見済みの `smidr_td_N` behaviorに限ります。 |
| Tap Dance定義の編集・生成 | ○ | — | △ | ○ | ○ | — | — | VialソースではDynamic Tap Danceとの衝突を避けるため静的定義を生成しません。 |
| Combo定義 | ○ | — | ○ | ○ | ○ | — | — | 実機編集はVial機器がDynamic Comboを公開している場合のみ利用できます。 |
| `custom` | ○ | △ | ○ | ○ | ○ | ○ | ○ | Raw actionは対象と同じプロトコルだけで使用できます。VIA実機では16bitの `0x....` 形式が必要です。 |

### QMK、VIA、Vialの違い

QMK/VIAソース出力はQMKソースとVIA対応keymapを生成します。VIA実機リマップでは、デバイスが受け付ける16bitのDynamic Keymapキーコードだけを書き込めます。

VialはQMKを基盤にしていますが、Dynamic Tap Dance、Dynamic Combo、Dynamic Macroなどの実機編集機能を持ちます。Smiðrは接続時に取得したケイパビリティに応じて、利用できない編集パネルを無効化します。

ZMKソース出力ではbehavior定義を生成できます。一方、ZMK Studio実機リマップはデバイスにコンパイル済みのbehaviorへ割り当てる操作であり、新しいbehaviorノードそのものは追加できません。

## UniversalKey：共通キー

次のグループは、QMK/VIA、Vial、ZMK、RMKのすべてで標準変換の対象です。

| グループ | UniversalKey |
| --- | --- |
| 英数字 | `A`〜`Z`、`0`〜`9` |
| ファンクション | `F1`〜`F24` |
| 基本・記号 | `ESC`、`TAB`、`ENT`、`BSPC`、`SPC`、各種記号キー |
| ISO/JIS | `NUHS`、`NUBS`、`YEN`、`RO`、`MHEN`、`HENK`、`KANA`、`EISU` |
| ナビゲーション | 矢印、`INS`、`DEL`、`HOME`、`END`、`PGUP`、`PGDN` |
| ロック・テンキー | `NLCK`、`SCRL`、`PSCR`、`PAUS`、`P0`〜`P9`、テンキー演算キー |
| 修飾 | `LCTL`、`LSFT`、`LALT`、`LGUI`、`RCTL`、`RSFT`、`RALT`、`RGUI` |
| メディア・アプリ | 再生、音量、明るさ、メール、電卓、ブラウザー、編集操作 |

`UniversalKey` が共通でも、実機がそのHID Usageや機能を実装していることまでは保証しません。

## UniversalKey：ファームウェア機能

| UniversalKey | QMK/VIA | Vial | ZMK | RMK | 変換・制限 |
| --- | :---: | :---: | :---: | :---: | --- |
| `BOOTLOADER` | ○ | ○ | ○ | ○ | QMK系は `QK_BOOT`、ZMKは `&bootloader`。 |
| `SYSTEM_RESET` | ○ | ○ | ○ | ○ | QMK系は `QK_REBOOT`、ZMKは `&sys_reset`。 |
| `CAPS_WORD` | ○ | ○ | ○ | ○ | QMK/Vialソースは必要な機能を自動で有効化します。 |
| `KEY_REPEAT` | ○ | ○ | ○ | △ | RMKでは同じHID用途の `Again` として出力します。 |
| `GRAVE_ESCAPE` | ○ | ○ | ○ | — | RMKに同等の組み込みキーがありません。 |
| `STUDIO_UNLOCK` | — | — | ○ | — | ZMK Studio固有です。 |
| `OUTPUT_USB` | ○ | ○ | ○ | — | QMK系とZMKで出力先をUSBへ切り替えます。 |
| `OUTPUT_BLUETOOTH` | ○ | ○ | ○ | — | 対応するBluetooth出力へ切り替えます。 |
| `PWR` / `SLEEP` / `WAKE` | ○ | ○ | ○ | — | RMKの標準キー一覧に対応項目がありません。 |

## UniversalKey：ライティング

| グループ | QMK/VIA | Vial | ZMK | RMK | 制限 |
| --- | :---: | :---: | :---: | :---: | --- |
| RGB Underglow `UG_*` | ○ | ○ | ○ | — | ZMKでは `&rgb_ug` に変換します。 |
| Backlight `BL_ON/OFF/TOGG/DOWN/UP/STEP` | ○ | ○ | ○ | — | ZMKでは `&bl` に変換します。 |
| Backlight `BL_BRTG` | ○ | ○ | — | — | ZMKにSmiðrが対応する同等操作がありません。 |
| LED Matrix `LM_*` | ○ | ○ | — | — | QMK系のみです。 |
| RGB Matrix `RM_*` | ○ | ○ | — | — | QMK系のみです。 |

機能キーを割り当てられても、対応するLED機能・Devicetree・QMK機能がファームウェア側で有効になっている必要があります。

## UniversalKey：ポインティング

| グループ | QMK/VIA | Vial | ZMK | RMK | 制限 |
| --- | :---: | :---: | :---: | :---: | --- |
| マウス移動 `MOUSE_UP/DOWN/LEFT/RIGHT` | ○ | ○ | ○ | ○ | ZMKは `&mmv`。 |
| ボタン `MOUSE_BTN1`〜`5` | ○ | ○ | ○ | ○ | ZMKは `&mkp`。 |
| ホイール `MOUSE_WHEEL_*` | ○ | ○ | ○ | — | ZMKは `&msc`。 |
| 加速 `MOUSE_ACCEL0`〜`2` | ○ | ○ | — | — | QMK Mouse Keys固有の操作です。 |

## パレットに表示されない場合

設計モードでは先に「ファームウェアを選択」でQMK/VIA、Vial、ZMK、RMKのいずれかを確定してください。リマップモードでは対象デバイスへ接続してください。対象で表現できないキーは非表示になり、対象では利用できるものの実機機能や現在の選択状態が不足している項目だけが無効表示になります。

標準一覧にない機能を使う場合は `custom`（画面上の「任意」または「Any」）を利用できます。ただしRaw actionはファームウェア間で自動変換されず、別の対象へ切り替えた場合は非対応になります。
