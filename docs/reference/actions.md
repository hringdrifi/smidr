---
title: アクション / キーコード・ファームウェア対応表
description: 全アクション・キーコードのQMK/VIA、Vial、ZMK、RMKへの変換結果と制限を比較します。
---

# アクション / キーコード・ファームウェア対応表

Smiðrで割り当てる動作（UniversalAction）とキーコード（UniversalKey）が、各ファームウェアでどのように表現されるかをまとめています。

## 表の見方

- **ソース出力**はSmiðrが生成するファームウェアソースの表記です。同じ表記になるQMK/VIAとVialは列をまとめています。
- **実機リマップ**は接続中の機器へ書き込む値です。VIA/Vialは16bitキーコード、ZMK Studioは機器から取得したbehavior IDと引数へ変換します。
- **—**はSmiðrの標準変換・対象パレットでは非対応です。ファームウェア自体の全機能の有無を示すものではありません。
- **△**は条件付き対応です。定義や機器側機能などの条件を併記します。

幅の広い表は横にスクロールできます。キー名はブラウザーのページ内検索でも探せます。

## アクションの変換

以下はレイヤー番号1、キーA、Hold修飾キーLCTL、定義ID 0を使ったソース出力の例です。

<div class="firmware-table" tabindex="0" role="region" aria-label="アクションのソース変換">

| アクション | 動作・例 | QMK/VIA・Vial | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `trans` | 透過：下位レイヤーの割り当てを使用 | `KC_TRNS` | `&trans` | `_` |
| `none` | 無操作：入力しない | `KC_NO` | `&none` | `No` |
| `tap` | 通常キー A | `KC_A` | `&kp A` | `A` |
| `tap + mods` | Ctrlを押しながら A | `LCTL(KC_A)` | `&kp LC(A)` | `WM(A, LCtrl)` |
| `mo` | 押している間だけレイヤー1を有効化 | `MO(1)` | `&mo 1` | `MO(1)` |
| `tg` | レイヤー1の有効・無効を切り替え | `TG(1)` | `&tog 1` | `TG(1)` |
| `to` | レイヤー1へ置換 | `TO(1)` | `&to 1` | `TO(1)` |
| `lt` | Tapで A、Holdでレイヤー1 | `LT(1, KC_A)` | `&lt 1 A` | `LT(1, A)` |
| `mt` | Tapで A、Holdで左Ctrl | `MT(MOD_LCTL, KC_A)` | `&mt LCTRL A` | `MT(A, LCtrl)` |
| `macro` | 定義済みMacro 0 | `SMIDR_MACRO_0` | `&smidr_macro_0` | — |
| `td` | Tap Dance 0 | `TD(0)` ※ | `&smidr_td_0` | — |
| `custom` | 対象固有のRawコード | 対象に適合する `rawCode` | ZMK用 `rawCode` | RMK用 `rawCode` |

</div>

※ Vialは割り当てを出力しますが、プロジェクトの静的Tap Dance定義は生成しません。

### 実機リマップの変換

同じ例を実機へ書き込む際の表現です。ZMK欄はbehaviorの読みやすい表記で、送信時には機器固有のIDと数値引数になります。

<div class="firmware-table" tabindex="0" role="region" aria-label="実機リマップの変換">

| アクション | VIA | Vial | ZMK Studio |
| --- | --- | --- | --- |
| `trans` | `0x0001` | `0x0001` | `&trans` |
| `none` | `0x0000` | `0x0000` | `&none` |
| `tap` | `0x0004` | `0x0004` | `&kp A` |
| `tap + mods` | `0x0104` | `0x0104` | `&kp LC(A)` |
| `mo` | `0x5201` | `0x5201` | `&mo 1` |
| `tg` | `0x5211` | `0x5211` | `&tog 1` |
| `to` | `0x5221` | `0x5221` | `&to 1` |
| `lt` | `0x4104` | `0x4104` | `&lt 1 A` |
| `mt` | `0x2104` | `0x2104` | `&mt LCTRL A` |
| `macro`（ID 0） | △ `0x7700`：既存スロット | △ `0x7700`：既存スロット | △ `&macro_0`：発見済みbehavior |
| `td`（ID 0） | △ `0x5700`：既存定義 | △ `0x5800`：Dynamic Tap Dance | △ `&smidr_td_0`：発見済みbehavior |
| `custom` | `0x1234`などの16bit値 | 16bit値／`TD(n)` | 既存behaviorと引数 |

</div>

### 修飾キーとタップ側アクション

`tap` の `mods` と `mt` の `modifiers` には、`LCTL`、`LSFT`、`LALT`、`LGUI`、`RCTL`、`RSFT`、`RALT`、`RGUI`を指定できます。選択した修飾キーが0個の場合、`tap.mods`は保存データから省略されます。

`mt`には少なくとも1つのHold修飾キーが必要です。

`lt.tapAction` と `mt.tapAction` も `UniversalAction` です。ただし、実際のファームウェア表現には入れ子にできる動作の制限があります。通常はタップ側に単純な `tap` を指定してください。

VIA/Vialの修飾付きキー・LT・MTはタップ側を下位8bitに収める形式のため、拡張機能キーをそのまま組み合わせる用途には使えません。レイヤー番号と定義IDは対象機器の範囲内で指定してください。現在のVIA/Vial変換ではレイヤー番号は下位4bit、Macro IDは下位5bitを使用します。VialのTap Dance IDは0〜31です。ZMK Studioは機器が公開するbehaviorと引数の制約に従います。

## キーコードの変換

`{ action: "tap", keycode: "A" }`のように、修飾なしでキーを割り当てた場合の全キーコードを掲載します。QMK/VIA・Vial、ZMK、RMK列はソース出力、VIA/Vial実機列は現在のSmiðrの変換値です。実機のプロトコル・バージョンや有効な機能によって利用可否は異なります。

ZMK StudioではZMK列の表記に対応する既存behaviorを機器上で解決して割り当てます。表示する文字を変える論理配列設定は、出力値を変更しません。

### アルファベット

<div class="firmware-table" tabindex="0" role="region" aria-label="アルファベットのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `A` | `KC_A` | `0x0004` | `&kp A` | `A` |
| `B` | `KC_B` | `0x0005` | `&kp B` | `B` |
| `C` | `KC_C` | `0x0006` | `&kp C` | `C` |
| `D` | `KC_D` | `0x0007` | `&kp D` | `D` |
| `E` | `KC_E` | `0x0008` | `&kp E` | `E` |
| `F` | `KC_F` | `0x0009` | `&kp F` | `F` |
| `G` | `KC_G` | `0x000A` | `&kp G` | `G` |
| `H` | `KC_H` | `0x000B` | `&kp H` | `H` |
| `I` | `KC_I` | `0x000C` | `&kp I` | `I` |
| `J` | `KC_J` | `0x000D` | `&kp J` | `J` |
| `K` | `KC_K` | `0x000E` | `&kp K` | `K` |
| `L` | `KC_L` | `0x000F` | `&kp L` | `L` |
| `M` | `KC_M` | `0x0010` | `&kp M` | `M` |
| `N` | `KC_N` | `0x0011` | `&kp N` | `N` |
| `O` | `KC_O` | `0x0012` | `&kp O` | `O` |
| `P` | `KC_P` | `0x0013` | `&kp P` | `P` |
| `Q` | `KC_Q` | `0x0014` | `&kp Q` | `Q` |
| `R` | `KC_R` | `0x0015` | `&kp R` | `R` |
| `S` | `KC_S` | `0x0016` | `&kp S` | `S` |
| `T` | `KC_T` | `0x0017` | `&kp T` | `T` |
| `U` | `KC_U` | `0x0018` | `&kp U` | `U` |
| `V` | `KC_V` | `0x0019` | `&kp V` | `V` |
| `W` | `KC_W` | `0x001A` | `&kp W` | `W` |
| `X` | `KC_X` | `0x001B` | `&kp X` | `X` |
| `Y` | `KC_Y` | `0x001C` | `&kp Y` | `Y` |
| `Z` | `KC_Z` | `0x001D` | `&kp Z` | `Z` |

</div>

### 数字

<div class="firmware-table" tabindex="0" role="region" aria-label="数字のキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `1` | `KC_1` | `0x001E` | `&kp N1` | `Kc1` |
| `2` | `KC_2` | `0x001F` | `&kp N2` | `Kc2` |
| `3` | `KC_3` | `0x0020` | `&kp N3` | `Kc3` |
| `4` | `KC_4` | `0x0021` | `&kp N4` | `Kc4` |
| `5` | `KC_5` | `0x0022` | `&kp N5` | `Kc5` |
| `6` | `KC_6` | `0x0023` | `&kp N6` | `Kc6` |
| `7` | `KC_7` | `0x0024` | `&kp N7` | `Kc7` |
| `8` | `KC_8` | `0x0025` | `&kp N8` | `Kc8` |
| `9` | `KC_9` | `0x0026` | `&kp N9` | `Kc9` |
| `0` | `KC_0` | `0x0027` | `&kp N0` | `Kc0` |

</div>

### ファンクションキー

<div class="firmware-table" tabindex="0" role="region" aria-label="ファンクションキーのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `F1` | `KC_F1` | `0x003A` | `&kp F1` | `F1` |
| `F2` | `KC_F2` | `0x003B` | `&kp F2` | `F2` |
| `F3` | `KC_F3` | `0x003C` | `&kp F3` | `F3` |
| `F4` | `KC_F4` | `0x003D` | `&kp F4` | `F4` |
| `F5` | `KC_F5` | `0x003E` | `&kp F5` | `F5` |
| `F6` | `KC_F6` | `0x003F` | `&kp F6` | `F6` |
| `F7` | `KC_F7` | `0x0040` | `&kp F7` | `F7` |
| `F8` | `KC_F8` | `0x0041` | `&kp F8` | `F8` |
| `F9` | `KC_F9` | `0x0042` | `&kp F9` | `F9` |
| `F10` | `KC_F10` | `0x0043` | `&kp F10` | `F10` |
| `F11` | `KC_F11` | `0x0044` | `&kp F11` | `F11` |
| `F12` | `KC_F12` | `0x0045` | `&kp F12` | `F12` |
| `F13` | `KC_F13` | `0x0068` | `&kp F13` | `F13` |
| `F14` | `KC_F14` | `0x0069` | `&kp F14` | `F14` |
| `F15` | `KC_F15` | `0x006A` | `&kp F15` | `F15` |
| `F16` | `KC_F16` | `0x006B` | `&kp F16` | `F16` |
| `F17` | `KC_F17` | `0x006C` | `&kp F17` | `F17` |
| `F18` | `KC_F18` | `0x006D` | `&kp F18` | `F18` |
| `F19` | `KC_F19` | `0x006E` | `&kp F19` | `F19` |
| `F20` | `KC_F20` | `0x006F` | `&kp F20` | `F20` |
| `F21` | `KC_F21` | `0x0070` | `&kp F21` | `F21` |
| `F22` | `KC_F22` | `0x0071` | `&kp F22` | `F22` |
| `F23` | `KC_F23` | `0x0072` | `&kp F23` | `F23` |
| `F24` | `KC_F24` | `0x0073` | `&kp F24` | `F24` |

</div>

### コントロールキー

<div class="firmware-table" tabindex="0" role="region" aria-label="コントロールキーのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `ESC` | `KC_ESC` | `0x0029` | `&kp ESC` | `Escape` |
| `TAB` | `KC_TAB` | `0x002B` | `&kp TAB` | `Tab` |
| `CAPS` | `KC_CAPS` | `0x0039` | `&kp CLCK` | `CapsLock` |
| `ENT` | `KC_ENT` | `0x0028` | `&kp RET` | `Enter` |
| `BSPC` | `KC_BSPC` | `0x002A` | `&kp BSPC` | `Backspace` |
| `SPC` | `KC_SPC` | `0x002C` | `&kp SPACE` | `Space` |

</div>

### 記号・パンクチュエーション

<div class="firmware-table" tabindex="0" role="region" aria-label="記号・パンクチュエーションのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `MINS` | `KC_MINS` | `0x002D` | `&kp MINUS` | `Minus` |
| `EQL` | `KC_EQL` | `0x002E` | `&kp EQUAL` | `Equal` |
| `LBRC` | `KC_LBRC` | `0x002F` | `&kp LBKT` | `LeftBracket` |
| `RBRC` | `KC_RBRC` | `0x0030` | `&kp RBKT` | `RightBracket` |
| `BSLS` | `KC_BSLS` | `0x0031` | `&kp BSLH` | `Backslash` |
| `SCLN` | `KC_SCLN` | `0x0033` | `&kp SEMI` | `Semicolon` |
| `QUOT` | `KC_QUOT` | `0x0034` | `&kp SQT` | `Quote` |
| `GRV` | `KC_GRV` | `0x0035` | `&kp GRAV` | `Grave` |
| `COMM` | `KC_COMM` | `0x0036` | `&kp COMMA` | `Comma` |
| `DOT` | `KC_DOT` | `0x0037` | `&kp DOT` | `Dot` |
| `SLSH` | `KC_SLSH` | `0x0038` | `&kp FSLH` | `Slash` |
| `NUHS` | `KC_NUHS` | `0x0032` | `&kp NON_US_HASH` | `NonusHash` |
| `NUBS` | `KC_NUBS` | `0x0031` | `&kp NON_US_BSLH` | `NonusBackslash` |

</div>

### 日本語 JIS 配列固有キー

<div class="firmware-table" tabindex="0" role="region" aria-label="日本語 JIS 配列固有キーのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `YEN` | `KC_INT3` | `0x0089` | `&kp JIS_YEN` | `International3` |
| `RO` | `KC_INT1` | `0x0087` | `&kp JIS_UNDERSCORE` | `International1` |
| `MHEN` | `KC_MHEN` | `0x008B` | `&kp JIS_MUHENKAN` | `International5` |
| `HENK` | `KC_HENK` | `0x008A` | `&kp JIS_HENKAN` | `International4` |
| `KANA` | `KC_KANA` | `0x0088` | `&kp JIS_KANA` | `Language3` |
| `EISU` | `KC_LNG2` | `0x0091` | `&kp JIS_EISU` | `Language2` |

</div>

### カーソル・ナビゲーション

<div class="firmware-table" tabindex="0" role="region" aria-label="カーソル・ナビゲーションのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `UP` | `KC_UP` | `0x0052` | `&kp UP` | `Up` |
| `DOWN` | `KC_DOWN` | `0x0051` | `&kp DOWN` | `Down` |
| `LEFT` | `KC_LEFT` | `0x0050` | `&kp LEFT` | `Left` |
| `RIGHT` | `KC_RGHT` | `0x004F` | `&kp RIGHT` | `Right` |
| `INS` | `KC_INS` | `0x0049` | `&kp INS` | `Insert` |
| `DEL` | `KC_DEL` | `0x004C` | `&kp DEL` | `Delete` |
| `HOME` | `KC_HOME` | `0x004A` | `&kp HOME` | `Home` |
| `END` | `KC_END` | `0x004D` | `&kp END` | `End` |
| `PGUP` | `KC_PGUP` | `0x004B` | `&kp PG_UP` | `PageUp` |
| `PGDN` | `KC_PGDN` | `0x004E` | `&kp PG_DN` | `PageDown` |

</div>

### ロックキー

<div class="firmware-table" tabindex="0" role="region" aria-label="ロックキーのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `NLCK` | `KC_NLCK` | `0x0053` | `&kp KP_NUM` | `NumLock` |
| `SCRL` | `KC_SCRL` | `0x0047` | `&kp SLCK` | `ScrollLock` |
| `PSCR` | `KC_PSCR` | `0x0046` | `&kp PSCRN` | `PrintScreen` |
| `PAUS` | `KC_PAUS` | `0x0048` | `&kp PAUSE_BREAK` | `Pause` |

</div>

### テンキー・アプリケーションキー

<div class="firmware-table" tabindex="0" role="region" aria-label="テンキー・アプリケーションキーのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `P0` | `KC_P0` | `0x0062` | `&kp KP_N0` | `Kp0` |
| `P1` | `KC_P1` | `0x0059` | `&kp KP_N1` | `Kp1` |
| `P2` | `KC_P2` | `0x005A` | `&kp KP_N2` | `Kp2` |
| `P3` | `KC_P3` | `0x005B` | `&kp KP_N3` | `Kp3` |
| `P4` | `KC_P4` | `0x005C` | `&kp KP_N4` | `Kp4` |
| `P5` | `KC_P5` | `0x005D` | `&kp KP_N5` | `Kp5` |
| `P6` | `KC_P6` | `0x005E` | `&kp KP_N6` | `Kp6` |
| `P7` | `KC_P7` | `0x005F` | `&kp KP_N7` | `Kp7` |
| `P8` | `KC_P8` | `0x0060` | `&kp KP_N8` | `Kp8` |
| `P9` | `KC_P9` | `0x0061` | `&kp KP_N9` | `Kp9` |
| `PSLS` | `KC_PSLS` | `0x0054` | `&kp KP_SLASH` | `KpSlash` |
| `PAST` | `KC_PAST` | `0x0055` | `&kp KP_ASTERISK` | `KpAsterisk` |
| `PMNS` | `KC_PMNS` | `0x0056` | `&kp KP_MINUS` | `KpMinus` |
| `PPLS` | `KC_PPLS` | `0x0057` | `&kp KP_PLUS` | `KpPlus` |
| `PENT` | `KC_PENT` | `0x0058` | `&kp KP_ENTER` | `KpEnter` |
| `PDOT` | `KC_PDOT` | `0x0063` | `&kp KP_DOT` | `KpDot` |
| `PCMM` | `KC_PCMM` | `0x0085` | `&kp KP_COMMA` | `KpComma` |
| `PEQL` | `KC_PEQL` | `0x0067` | `&kp KP_EQUAL` | `KpEqual` |
| `APP` | `KC_APP` | `0x0065` | `&kp K_APP` | `Menu` |

</div>

### 編集・アプリケーションキー

<div class="firmware-table" tabindex="0" role="region" aria-label="編集・アプリケーションキーのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `EXEC` | `KC_EXEC` | `0x0074` | `&kp K_EXEC` | `Execute` |
| `HELP` | `KC_HELP` | `0x0075` | `&kp K_HELP` | `Help` |
| `MENU` | `KC_MENU` | `0x0076` | `&kp K_MENU` | `Menu` |
| `SELECT` | `KC_SLCT` | `0x0077` | `&kp K_SELECT` | `Select` |
| `STOP` | `KC_STOP` | `0x0078` | `&kp K_STOP` | `Stop` |
| `AGAIN` | `KC_AGIN` | `0x0079` | `&kp K_AGAIN` | `Again` |
| `UNDO` | `KC_UNDO` | `0x007A` | `&kp K_UNDO` | `Undo` |
| `CUT` | `KC_CUT` | `0x007B` | `&kp K_CUT` | `Cut` |
| `COPY` | `KC_COPY` | `0x007C` | `&kp K_COPY` | `Copy` |
| `PASTE` | `KC_PSTE` | `0x007D` | `&kp K_PASTE` | `Paste` |
| `FIND` | `KC_FIND` | `0x007E` | `&kp K_FIND` | `Find` |

</div>

### 統一された修飾キー

<div class="firmware-table" tabindex="0" role="region" aria-label="統一された修飾キーのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `LCTL` | `KC_LCTL` | `0x00E0` | `&kp LCTRL` | `LCtrl` |
| `LSFT` | `KC_LSFT` | `0x00E1` | `&kp LSHIFT` | `LShift` |
| `LALT` | `KC_LALT` | `0x00E2` | `&kp LALT` | `LAlt` |
| `LGUI` | `KC_LGUI` | `0x00E3` | `&kp LGUI` | `LGui` |
| `RCTL` | `KC_RCTL` | `0x00E4` | `&kp RCTRL` | `RCtrl` |
| `RSFT` | `KC_RSFT` | `0x00E5` | `&kp RSHIFT` | `RShift` |
| `RALT` | `KC_RALT` | `0x00E6` | `&kp RALT` | `RAlt` |
| `RGUI` | `KC_RGUI` | `0x00E7` | `&kp RGUI` | `RGui` |

</div>

### 消費者・メディアコントロール

<div class="firmware-table" tabindex="0" role="region" aria-label="消費者・メディアコントロールのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `MPLY` | `KC_MPLY` | `0x00AE` | `&kp C_PP` | `MediaPlayPause` |
| `MSTP` | `KC_MSTP` | `0x00AD` | `&kp C_STOP` | `MediaStop` |
| `MNXT` | `KC_MNXT` | `0x00AB` | `&kp C_NEXT` | `MediaNextTrack` |
| `MPRV` | `KC_MPRV` | `0x00AC` | `&kp C_PREV` | `MediaPrevTrack` |
| `VOLU` | `KC_VOLU` | `0x00A9` | `&kp C_VOL_UP` | `AudioVolUp` |
| `VOLD` | `KC_VOLD` | `0x00AA` | `&kp C_VOL_DN` | `AudioVolDown` |
| `MUTE` | `KC_MUTE` | `0x00A8` | `&kp C_MUTE` | `AudioMute` |
| `BRIU` | `KC_BRIU` | `0x00BD` | `&kp C_BRI_UP` | `BrightnessUp` |
| `BRID` | `KC_BRID` | `0x00BE` | `&kp C_BRI_DN` | `BrightnessDown` |
| `MSEL` | `KC_MSEL` | `0x00AF` | `&kp C_AL_CCC` | `MediaSelect` |
| `EJCT` | `KC_EJCT` | `0x00B0` | `&kp C_EJECT` | `MediaEject` |
| `MFFD` | `KC_MFFD` | `0x00BB` | `&kp C_FF` | `MediaFastForward` |
| `MRWD` | `KC_MRWD` | `0x00BC` | `&kp C_RW` | `MediaRewind` |
| `MAIL` | `KC_MAIL` | `0x00B1` | `&kp C_AL_MAIL` | `Mail` |
| `CALC` | `KC_CALC` | `0x00B2` | `&kp C_AL_CALC` | `Calculator` |
| `MYCM` | `KC_MYCM` | `0x00B3` | `&kp C_AL_MY_COMPUTER` | `MyComputer` |
| `WSCH` | `KC_WSCH` | `0x00B4` | `&kp C_AC_SEARCH` | `WwwSearch` |
| `WHOM` | `KC_WHOM` | `0x00B5` | `&kp C_AC_HOME` | `WwwHome` |
| `WBAK` | `KC_WBAK` | `0x00B6` | `&kp C_AC_BACK` | `WwwBack` |
| `WFWD` | `KC_WFWD` | `0x00B7` | `&kp C_AC_FORWARD` | `WwwForward` |
| `WSTP` | `KC_WSTP` | `0x00B8` | `&kp C_AC_STOP` | `WwwStop` |
| `WREF` | `KC_WREF` | `0x00B9` | `&kp C_AC_REFRESH` | `WwwRefresh` |
| `WFAV` | `KC_WFAV` | `0x00BA` | `&kp C_AC_BOOKMARKS` | `WwwFavorites` |
| `PWR` | `KC_PWR` | `0x00A5` | `&kp SYS_PWR` | — |
| `SLEEP` | `KC_SLEP` | `0x00A6` | `&kp SYS_SLEEP` | — |
| `WAKE` | `KC_WAKE` | `0x00A7` | `&kp SYS_WAKE` | — |

</div>

### ライティング

<div class="firmware-table" tabindex="0" role="region" aria-label="ライティングのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `UG_TOGG` | `UG_TOGG` | `0x7820` | `&rgb_ug UG_TOGG` | — |
| `UG_NEXT` | `UG_NEXT` | `0x7821` | `&rgb_ug UG_NEXT` | — |
| `UG_PREV` | `UG_PREV` | `0x7822` | `&rgb_ug UG_PREV` | — |
| `UG_VALU` | `UG_VALU` | `0x7827` | `&rgb_ug UG_VALU` | — |
| `UG_VALD` | `UG_VALD` | `0x7828` | `&rgb_ug UG_VALD` | — |
| `UG_HUEU` | `UG_HUEU` | `0x7823` | `&rgb_ug UG_HUEU` | — |
| `UG_HUED` | `UG_HUED` | `0x7824` | `&rgb_ug UG_HUED` | — |
| `UG_SATU` | `UG_SATU` | `0x7825` | `&rgb_ug UG_SATU` | — |
| `UG_SATD` | `UG_SATD` | `0x7826` | `&rgb_ug UG_SATD` | — |
| `UG_SPDU` | `UG_SPDU` | `0x7829` | `&rgb_ug UG_SPDU` | — |
| `UG_SPDD` | `UG_SPDD` | `0x782A` | `&rgb_ug UG_SPDD` | — |
| `BL_ON` | `BL_ON` | `0x7800` | `&bl BL_ON` | — |
| `BL_OFF` | `BL_OFF` | `0x7801` | `&bl BL_OFF` | — |
| `BL_TOGG` | `BL_TOGG` | `0x7802` | `&bl BL_TOG` | — |
| `BL_DOWN` | `BL_DOWN` | `0x7803` | `&bl BL_DEC` | — |
| `BL_UP` | `BL_UP` | `0x7804` | `&bl BL_INC` | — |
| `BL_STEP` | `BL_STEP` | `0x7805` | `&bl BL_CYCLE` | — |
| `BL_BRTG` | `BL_BRTG` | `0x7806` | — | — |
| `LM_ON` | `LM_ON` | `0x7810` | — | — |
| `LM_OFF` | `LM_OFF` | `0x7811` | — | — |
| `LM_TOGG` | `LM_TOGG` | `0x7812` | — | — |
| `LM_NEXT` | `LM_NEXT` | `0x7813` | — | — |
| `LM_PREV` | `LM_PREV` | `0x7814` | — | — |
| `LM_BRIU` | `LM_BRIU` | `0x7815` | — | — |
| `LM_BRID` | `LM_BRID` | `0x7816` | — | — |
| `LM_SPDU` | `LM_SPDU` | `0x7817` | — | — |
| `LM_SPDD` | `LM_SPDD` | `0x7818` | — | — |
| `LM_FLGN` | `LM_FLGN` | `0x7819` | — | — |
| `LM_FLGP` | `LM_FLGP` | `0x781A` | — | — |
| `RM_ON` | `RM_ON` | `0x7840` | — | — |
| `RM_OFF` | `RM_OFF` | `0x7841` | — | — |
| `RM_TOGG` | `RM_TOGG` | `0x7842` | — | — |
| `RM_NEXT` | `RM_NEXT` | `0x7843` | — | — |
| `RM_PREV` | `RM_PREV` | `0x7844` | — | — |
| `RM_HUEU` | `RM_HUEU` | `0x7845` | — | — |
| `RM_HUED` | `RM_HUED` | `0x7846` | — | — |
| `RM_SATU` | `RM_SATU` | `0x7847` | — | — |
| `RM_SATD` | `RM_SATD` | `0x7848` | — | — |
| `RM_VALU` | `RM_VALU` | `0x7849` | — | — |
| `RM_VALD` | `RM_VALD` | `0x784A` | — | — |
| `RM_SPDU` | `RM_SPDU` | `0x784B` | — | — |
| `RM_SPDD` | `RM_SPDD` | `0x784C` | — | — |
| `RM_FLGN` | `RM_FLGN` | `0x784D` | — | — |
| `RM_FLGP` | `RM_FLGP` | `0x784E` | — | — |

</div>

### マウスキー

<div class="firmware-table" tabindex="0" role="region" aria-label="マウスキーのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `MOUSE_UP` | `KC_MS_U` | `0x00CD` | `&mmv MOVE_UP` | `MouseUp` |
| `MOUSE_DOWN` | `KC_MS_D` | `0x00CE` | `&mmv MOVE_DOWN` | `MouseDown` |
| `MOUSE_LEFT` | `KC_MS_L` | `0x00CF` | `&mmv MOVE_LEFT` | `MouseLeft` |
| `MOUSE_RIGHT` | `KC_MS_R` | `0x00D0` | `&mmv MOVE_RIGHT` | `MouseRight` |
| `MOUSE_BTN1` | `KC_BTN1` | `0x00D1` | `&mkp LCLK` | `MouseBtn1` |
| `MOUSE_BTN2` | `KC_BTN2` | `0x00D2` | `&mkp RCLK` | `MouseBtn2` |
| `MOUSE_BTN3` | `KC_BTN3` | `0x00D3` | `&mkp MCLK` | `MouseBtn3` |
| `MOUSE_BTN4` | `KC_BTN4` | `0x00D4` | `&mkp MB4` | `MouseBtn4` |
| `MOUSE_BTN5` | `KC_BTN5` | `0x00D5` | `&mkp MB5` | `MouseBtn5` |
| `MOUSE_WHEEL_UP` | `KC_WH_U` | `0x00D9` | `&msc SCRL_UP` | — |
| `MOUSE_WHEEL_DOWN` | `KC_WH_D` | `0x00DA` | `&msc SCRL_DOWN` | — |
| `MOUSE_WHEEL_LEFT` | `KC_WH_L` | `0x00DB` | `&msc SCRL_LEFT` | — |
| `MOUSE_WHEEL_RIGHT` | `KC_WH_R` | `0x00DC` | `&msc SCRL_RIGHT` | — |
| `MOUSE_ACCEL0` | `KC_ACL0` | `0x00DD` | — | — |
| `MOUSE_ACCEL1` | `KC_ACL1` | `0x00DE` | — | — |
| `MOUSE_ACCEL2` | `KC_ACL2` | `0x00DF` | — | — |

</div>

### システム・ファームウェア

<div class="firmware-table" tabindex="0" role="region" aria-label="システム・ファームウェアのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `BOOTLOADER` | `QK_BOOT` | `0x7C00` | `&bootloader` | `Bootloader` |
| `SYSTEM_RESET` | `QK_REBOOT` | `0x7C01` | `&sys_reset` | `SystemReset` |
| `CAPS_WORD` | `CW_TOGG` | `0x7C73` | `&caps_word` | `CapsWordToggle` |
| `KEY_REPEAT` | `QK_REP` | `0x7C79` | `&key_repeat` | `Again` |
| `GRAVE_ESCAPE` | `QK_GESC` | `0x7C16` | `&gresc` | — |
| `STUDIO_UNLOCK` | — | — | `&studio_unlock` | — |
| `OUTPUT_USB` | `QK_OUTPUT_USB` | `0x7784` | `&out OUT_USB` | — |
| `OUTPUT_BLUETOOTH` | `QK_OUTPUT_BLUETOOTH` | `0x7786` | `&out OUT_BLE` | — |

</div>

### 特別・透過・なし

<div class="firmware-table" tabindex="0" role="region" aria-label="特別・透過・なしのキーコード変換">

| キーコード | QMK/VIA・Vial | VIA/Vial実機 | ZMK | RMK |
| --- | --- | --- | --- | --- |
| `TRNS` | `KC_TRNS` | `0x0001` | `&kp TRANS` | `_` |
| `NO` | `KC_NO` | `0x0000` | `&kp NONE` | `No` |

</div>

### キーコード固有の補足

- `KEY_REPEAT`のRMK出力は`Again`です。直前のキーを繰り返す専用behaviorと同じ動作を保証するものではありません。
- `BOOTLOADER`はブートローダーへ入り、`SYSTEM_RESET`は通常の再起動を行います。
- ライティング・マウス操作・出力先切り替えは、ファームウェア側で対応機能が有効である必要があります。
- `TRNS`と`NO`はキー名にもありますが、通常は`trans`と`none`アクションを使います。表は`tap`として変換した場合の値です。

## Macro、Combo、Tap Dance

設計モードではMacro、Combo、Tap Danceの定義をプロジェクトへ保存し、対応するファームウェアソースへ変換します。リマップモードでは接続機器が公開するDynamic Macro、Dynamic Combo、Dynamic Tap Danceを直接編集し、プロジェクト側の定義とは分けて扱います。

Vialソース出力はDynamic Tap Dance側が同名シンボルを持つため、プロジェクトの静的Tap Dance定義を生成しません。ZMK Studioでは既存behaviorの割り当てはできますが、behavior定義の追加にはソース出力と再ビルドが必要です。

<div class="firmware-table" tabindex="0" role="region" aria-label="動作定義の生成">

| 定義 | QMK/VIAソース | Vialソース | ZMKソース | RMKソース |
| --- | --- | --- | --- | --- |
| Macro | `process_record_user()`と`SMIDR_MACRO_n` | QMK/VIAと同じ | `zmk,behavior-macro`と`&smidr_macro_n` | — |
| Combo | QMK Combo | QMK Combo | `zmk,combos` | — |
| Tap Dance | `tap_dance_actions[]`とコールバック | △ 静的定義は生成しない | `zmk,behavior-tap-dance`と必要に応じてHold-Tap | — |

</div>

<div class="firmware-table" tabindex="0" role="region" aria-label="実機の定義編集">

| 定義編集 | VIA実機 | Vial実機 | ZMK Studio |
| --- | --- | --- | --- |
| Macro | — | △ Dynamic Macro対応機器 | — |
| Combo | — | △ Dynamic Combo対応機器 | — |
| Tap Dance | — | △ Dynamic Tap Dance対応機器 | — |

</div>

Macroソース出力の`SMIDR_MACRO_n`／`&smidr_macro_n`は、対応する空でないプロジェクト定義がある場合の名前です。定義がない参照の単純変換は`MACRO(n)`／`&macro_n`になるため、割り当てだけで定義が生成されるわけではありません。ZMK StudioのTap Danceパレット候補は、発見済みの`smidr_td_N`に限ります。

## 任意のコード（custom / Any）

標準モデルにないコードは `custom` で保持できます。

```ts
{
  action: 'custom',
  protocol: 'qmk',
  rawCode: 'QK_USER_0',
  label: 'User 0'
}
```

`protocol` は `qmk`、`via`、`vial`、`zmk`、`rmk` のいずれかです。Rawコードは他のファームウェアへ翻訳されません。VIA実機へ書き込むRawコードは `0x1234` のような16bit値を使用します。

QMK対象は`qmk`、VIA対象は`qmk`／`via`、Vial対象は`qmk`／`via`／`vial`、ZMK・RMK対象はそれぞれ同名のプロトコルを受け入れます。ソースではRaw文字列を出力しますが、VIA/Vial実機で任意のC式が評価されるわけではありません。Vial実機も16bit値を使用し、`TD(n)`は専用変換を利用できます。

## パレットに表示されない場合

設計モードでは先にファームウェア対象を選び、リマップモードでは対象デバイスへ接続してください。未選択・未接続時に全ファームのキーを混ぜたパレットは表示しません。

対象で表現できないキーは非表示になります。対象では利用可能でも、機器の機能不足・ロック状態・編集対象未選択などで現在割り当てられない項目は無効になります。

<style>
.firmware-table { overflow-x: auto; margin: 16px 0; }
.firmware-table:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
.vp-doc .firmware-table table { width: max-content; min-width: 100%; margin: 0; }
</style>
