# Smiðr (スミズル) — Technical Specification

このドキュメントは、Smiðr プロジェクトの技術的な仕様、設計指針、および操作規定をまとめたものです。

## 1. テックスタック & 構成
- **Framework:** React 19 (SPA)
- **Build Tool:** Vite
- **State Management:** Zustand + zundo (temporal)
- **Styling:** Tailwind CSS v4 + Vanilla CSS (globals.css)
- **Canvas:** react-konva
- **Icons:** Lucide React

## 2. 状態管理 (Zustand) のルール
- **Middleware**: `temporal` (zundo) ミドルウェアを使用して履歴管理を行っている。また、`withConsistency` カスタムミドルウェアにより、キー削除時の選択状態の整合性を自動的に維持している。
- **Undo/Redo**: ストアが提供する `undo()` および `redo()` アクションを使用する。
- **プレビューパターン (Preview Pattern)**:
  - ドラッグ、回転、ピボット移動等の高頻度な更新は `previewKeys` 状態に対して行う。
  - プレビュー中は履歴が保存されず、パフォーマンスが向上する。
  - 操作完了時（MouseUp等）に `commitPreviewKeys()` を呼び出すことで、一連の変更を1つの履歴としてメインの `keys` に確定させる。
- **不変性の維持**: 状態更新時は必ずスプレッド演算子や関数型の更新を用い、元の state を直接変更しないこと。

## 3. 物理レイアウト・物理演算
- **単位系:** 1u = 48px (`UNIT` 定数)。
- **グリッド:** 0.25u 精度。位置更新時は `Math.round(val * 4) / 4` でスナップさせる。
- **数値の丸め (Rounding):** 自由移動時や計算結果の累積誤差を防ぐため、以下の精度で丸めること。
  - 座標・サイズ (x, y, w, h, rx, ry): 小数点以下7桁 (`roundCoord`)
  - 角度 (r): 小数点以下2桁 (`roundRot`)
- **衝突判定:** SAT (分離軸定理) アルゴリズムを使用。ピッタリ隣接するキーを許容するため、0.01u の `EPSILON` を考慮すること。
- **回転:** `transform-origin` は `rx`, `ry` (Pivot) プロパティに依存する。
  - **同期移動:** `Sync Pivot on Key Move` 設定が ON の場合、キー移動時に Pivot も常に同期して移動させる。OFF の場合は Pivot は移動しない。
  - **位置維持:** `Fixed Key on Pivot Move` 設定が ON の場合、Pivot 移動時にキーの見た目の位置が変わらないよう X, Y 座標を自動的に逆算・補正する。

## 4. コンポーネント設計
- **KeyboardCanvas:** メインの編集領域。ドラッグ、回転、複数選択のロジックが集中している。
- **PropertyPanel:** 選択中のキーのプロパティ編集。単一選択と複数選択 (Batch Edit) で表示を切り替える。
- **EditorTools:** キー追加やインポート、Undo/Redo 等のグローバルな操作。

## 5. UI/UX 規約
- **テーマ:** Zinc (900/950) を基調としたダークモード。
- **アクセント:** Amber (500) を選択状態や Pivot の強調に使用。
- **操作性:** 複数選択は `Ctrl/Cmd + Click`。削除は `Delete/Backspace`。Undo は `Ctrl + Z`。ドラッグ・回転時のスナップ無効化は `Alt` キー。
- **モード選択の保持:** 最後に選択したアプリモード（リマップ / 設計）および設計内モード（レイアウト / マトリクス / ハードウェア / キーマップ）は `localStorage` に保存し、次回起動時に復元する。
- **Visual Layout（論理配列）:** キーマップ表示およびキーコードパレットのキートップレジェンドはユーザー設定の `visualLayout` に従って切り替える。値は `qwerty-us` 形式（例: `qwerty-us`, `qwerty-jp`, `qwerty-kr`, `qwerty-es`, `qwertz-de`, `azerty-fr`）で管理し、キーコード自体やエクスポート値は変更しない。この設定はテーマや言語と同様に `localStorage` へ保存し、`.smidr` プロジェクトファイルには保存しない。

## 6. 操作仕様 (Mouse & Keyboard Shortcuts)

### 6.1 基本概念 (Selection vs Focus vs Anchor)
- **選択 (Selection)**: 現在操作対象となっているキーのグループ。アクセントカラー（Amber）の枠で表示されます。
- **フォーカス (Focus)**: 回転の中心（Pivot）およびプロパティパネルの編集対象となる単一のキー。オレンジのブラケットで表示されます（※レイアウトモードの時のみ表示されます）。
- **アンカー (Anchor)**: Shiftクリックによる範囲選択の「起点」。最後に通常クリックまたはCtrlクリックした場所が保持されます。

### 6.2 キーに対する操作 (Mouse on Key)
- **左クリック**: そのキーのみを選択し、フォーカスとアンカーをそこに設定します（既存の選択は解除）。
- **Ctrl/Cmd + 左クリック**: 選択状態を反転（追加/解除）させます。フォーカスとアンカーもそのキーに移動します。
- **Shift + 左クリック**: **アンカーからクリック先までの全キーを選択**します。フォーカスはクリック先に移動しますが、**アンカーは移動しません**（範囲の再調整が可能）。
- **Ctrl + Shift + 左クリック**: アンカーからクリック先までの範囲を、**現在の選択状態に追加**します。
- **Alt + 左クリック**: 選択範囲を変えずに、**フォーカス（回転軸）とアンカーだけをそのキーに移動**させます。
- **中クリック / 右クリック**: キーに対する選択・移動操作は無視されます。

### 6.3 背景に対する操作 (Mouse on Background)
- **左クリック**: 選択をすべて解除します。ただし、**フォーカス（基準点）は維持**されます。
- **左ドラッグ**: 矩形選択。
  - 修飾キーなし: 新しい範囲を選択（既存の選択は解除）。
  - Ctrl または Shift: 既存の選択に枠内のキーを追加。
  - **解除タイミング**: 修飾キーなしのドラッグ開始時、または修飾キーなしのクリック確定時（MouseUp）に既存の選択が解除されます。
- **ホイールボタン (中ボタン) ドラッグ**: キャンバスのパン（平行移動）。
- **マウスホイール**: キャンバスのズーム（拡大・縮小）。

### 6.4 マニピュレーション (Manipulation)
- **キー本体のドラッグ**: 選択中の全キーを移動。
- **回転ハンドルドラッグ**: 選択中の全キーを、**フォーカスキーのピボットを中心**に回転。
- **ピボットハンドルドラッグ**: フォーカスキーの回転中心（Pivot）を移動。
- **Alt + ドラッグ**: 移動・回転・ピボット移動時のスナップ（0.25u / 15度）を一時的に無効化します。

### 6.5 キーボードショートカット
- **Delete / Backspace**: 選択中のキーを削除。
- **Escape**: 選択、フォーカス、アンカーをすべて解除。
- **Ctrl/Cmd + A**: すべてのキーを選択。
- **Ctrl/Cmd + Z / Y**: Undo / Redo。
- **Ctrl/Cmd + C / V**: キーのコピー＆ペースト。
- **矢印キー (↑↓←→)**: 選択中のキーをグリッド単位（gridSnap）で微調整。

### 6.3 キーの並び順 (Physical Sorting Logic)
キーマップの割当順序や Shift クリックによる範囲選択で使用される「物理的な並び順」は、以下のルールに基づき決定されます。
- **基本ルール**: Y座標の昇順（上➔下）、次いでX座標の昇順（左➔右）でソートします。
- **カラムスタッガード対応 (Vertical Tolerance)**: エルゴノミック配列等の列のズレを考慮し、**隣接するキーとの Y 座標の差が 0.25u 以内**であれば、それらを「同じ行」として扱います。
- **共通化**: このソートロジックはプロジェクト内で統一され、編集モードに関わらず一貫した挙動を提供します。

## 7. インポート/エクスポート & レイアウトオプション仕様

Smiðr は、VIA/Vial 規格に準拠したレイアウトオプション設計と高機能なエクスポート処理をサポートします。

### 7.1 座標の自動正規化 (Origin Normalization)
- **仕様**: エクスポート時、キャンバス全体のすべての物理キー（非アクティブなオプションキーも含む）の位置 `(x, y)` 、回転基準点 `(rx, ry)` の最小座標 `(minX, minY)` を計算します。
- **処理**: `minX !== 0` または `minY !== 0` の場合、全キーの位置 `(x, y)` 、回転基準点 `(rx, ry)` に対し一律でオフセット `(-minX, -minY)` を適用して座標を `(0, 0)` を起点とする領域に補正します。
- **目的**: KLE や VIA/Vial でのインポート時に、マイナス座標や不要な巨大余白による表示の見切れ・レイアウトの破綻を防止します。

### 7.2 Yスタック配置とギャップ仕様 (Y-Stacking with y:1 Gap)
- **仕様**: エクスポートする配列（`layouts.keymap`）において、キーの配置順序を以下のようにグループ化します。
  1. **ベースレイアウト**: 常に表示されるキー (`!group`) および各グループのデフォルトキー (`option === 0`)。これらを上部に通常ソートして出力。
  2. **代替オプション（島）**: 非デフォルトの選択肢 (`option > 0`) のキー群。
- **改行・ギャップ処理**: 代替オプションキー群は、オプショングループおよび選択肢ごとに独立した行（配列の要素）として下部に配置します。また、各選択肢ブロックの最初のキーに対し、明示的に `y: 1` ギャップ属性（1行分の空行）を挿入します。
- **目的**: KLE エディタ等の外部ツールで JSON ファイルを開いた際、各オプション用キー群がメインキーボードの下部に美しい「島」として視覚的に整理されて並ぶようにします。

### 7.3 インポート時の自動アライメント (Auto Alignment Pass)
- **仕様**: インポート処理時、プログラム側で各グループのデフォルト `(option: 0)` の最小左上座標と、代替オプション `(option: o)` の最小左上座標を走査します。
- **処理**: その差分 `dx = minX(o) - minX(0)`, `dy = minY(o) - minY(0)` を計算し、代替オプションキー群の座標から `(dx, dy)` を自動的に引き算（シフト）します。
- **目的**: Yスタックや右へのオフセットによって離れた位置に配置されていたキーが、キャンバス展開時およびオプション変更時に本来の重ね合わせ位置に正確に復元されます。
- **デカールの埋め草（スペーサー）仕様**: 選択肢間で左上のアライメントが合わない（隙間を作りたいなど）場合、非表示キー（デカール `decal: true`）をスペーサーとして配置することで、最小 `minX/minY` を強制的に一致させ、意図した相対位置を保ちます。

### 7.4 多行ラベルの動的再構成 (Multiline Label Encoding)
- **仕様**: エクスポート時に、各キーのメタデータを以下の KLE 多行ラベルスロット（デフォルトアライメント `a = 4`）に自動エンコードして結合します。
  - **行 0 (Label 0 / idx 0)**: マトリクス行・列 (`"row,col"`)
  - **行 3 (Label 8 / idx 3)**: レイアウトオプショングループ・選択肢 (`"group,option"`)
  - **行 9 (Label 4 / idx 9)**: エンコーダーインデックス (`"e{index}"`)
- **目的**: Smiðr 内で新規追加したキーや再配置したマトリクス・オプション情報が、エクスポートされた JSON でも完全に復元・動作できるようにします。

### 7.5 分割キーボードのマトリクス座標 (Split Matrix Coordinates)
- **内部表現**: 分割キーボードでは `matrixSide` (`left` / `right`) と、各半分ごとのローカル `row`, `col` を保持する。左右どちらも `0,0` から始まる。
- **編集 UI**: マトリクスエディタは左右を別マトリクスとして扱い、右側キーも右側内のローカル座標で編集する。分割時のペイントモードでは、割り当て先の `left` / `right` をユーザーが明示選択する。
- **QMK/Vial 出力**: QMK/Vial の split matrix では右側を行方向に連結するため、右側キーは `row + leftRows`, `col` に変換して出力する。例: 左右各 `4x6` の場合、内部は左右とも `0..3 x 0..5`、QMK/Vial 出力は `8x6`。
- **ZMK 出力**: ZMK の split shield では左右を別 shield part として生成する。共有 `.dtsi` には左右を横方向に連結した matrix transform を配置し、右側 overlay で `col-offset = <leftCols>` を指定して右側ローカル matrix event を共有 transform の右側列へ対応付ける。`controllerType: 'mcu'` の場合は左右を別 custom board (`<name>_left` / `<name>_right`) として生成し、右側 board DTS で同じ `col-offset` を指定する。`ProjectSettings.zmk.splitTransport` は `ble`（既定）または `wired` を保持する。`ble` は nRF52840 系ターゲットを要求する。`wired` は `zmk,wired-split` ノードを生成し、`ProjectSettings.zmk.wiredSplitDevice`（未指定時は `&pro_micro_serial`）を UART device として出力する。
- **互換性**: 旧データのように右側キーが `col >= leftCols` で保存されている場合は、読み取り・エクスポート時に右側ローカル列へ正規化する。

## 9. デバイス通信 & プロトコル統合仕様 (Device Protocol & ZMK Studio Integration)

Smiðr は、VIA/Vial 接続だけでなく、ZMK Studio (Protobuf RPC) 接続を含むマルチプロトコルに完全に対応した通信層・UI層の結合設計をサポートします。

### 9.1 AST 駆動型キーコード制御 (AST-Driven Keycode Operations)
- **基本仕様**: UI（`KeycodePanel` など）とプロトコルドライバーとの間でのキー設定のやり取りは、テキストの文字列処理ではなく、すべて `UniversalAction` AST データ構造を経由して型安全に行われます。
- **処理の流れ**: UI 上でのキーコード変更 ➔ `qmkStringToAction` 経由で AST 化 ➔ プロトコル抽象層の `protocol.setKey()` を呼び出し ➔ 各ドライバー（ZMK / VIA / Vial）で適切なエンコードを実行。
- **型短縮・正規化 (UniversalAction)**: QMKおよびZMKの標準仕様と一致するよう、以下の通り短縮された型キー名を使用します。また、すべての AST ノードは `type` ではなく `action` を判別子（Discriminator）として使用します。
  - `tap`: 単一キー押下。`keycode` 属性にターゲットキーを保持。`RGB_TOG` などのライティング操作も `UniversalKey` としてこの形式で扱います。`mods: Modifier[]`（オプション）を含めることで修飾キー同時押し（旧 `mod`）も統合されています。なお、選択された修飾キーが0個のときは、データ構造をクリーンに保つため `mods` プロパティはオブジェクトから完全に除外（削除）されます。
  - `trans`: 透過キー。
  - `none`: 無操作キー。
  - `mo`: レイヤーホールド中切り替え（Momentary）。
  - `tg`: レイヤートグル切り替え（Toggle）。
  - `to`: レイヤー置換切り替え（Replace）。
  - `lt`: レイヤータップ（Holdで対象レイヤー、Tapでキー入力）。
  - `mt`: モッドタップ（Holdで修飾キー、Tapでキー入力）。
  - `macro`: マクロ呼び出し。`macroId` でデバイスまたはプロジェクト内のマクロスロットを参照し、QMK/VIA/Vial では `MACRO(n)` / Dynamic Macro キーコード、ZMK では `&macro_n` 相当として扱います。マクロ定義そのものは `MacroAction[]` として別管理します。
  - `td`: タップダンス。`tapDanceId` でプロジェクト内の `tapDances` 定義を参照し、QMK/Vial エクスポート時は `TD(n)` として出力する。
- **マクロ定義への導線**: キーマップ設定パネルで `macro` を選択中かつ接続デバイスがマクロ編集に対応している場合、選択中の `macroId` を Macro パネルで開くボタンを表示する。
- **設計モードの定義編集**: 設計モードの Macro / Combo / Tap Dance パネルは `ProjectSettings.macros`, `ProjectSettings.combos`, `ProjectSettings.tapDances` を編集する。これらは `.smidr` 保存に反映する。Macro は QMK / Vial では `process_record_user()` と `SMIDR_MACRO_N` カスタムキーコード、ZMK では `zmk,behavior-macro` として生成する。Combo は QMK / Vial では QMK Combo、ZMK では `zmk,combos` として生成する。Tap Dance 定義のソース出力は QMK / ZMK を対象とし、Vial ソース出力では Vial Dynamic Tap Dance とのシンボル衝突を避けるため静的定義を生成しない。
- **リマップモードの実機編集**: リマップモードの Macro / Combo / Tap Dance パネルは接続中デバイスの Dynamic Macro / Dynamic Combo / Dynamic Tap Dance を編集する。実機編集内容は接続中デバイスへ書き込むが、ProjectSettings には反映せず、ソース出力にも直接反映しない。Dynamic 定義の初期値流し込みは行わない。
- **Layer-Tap (LT)**: 正規表現による文字列検索を完全に廃止し、AST のノードレベル（`action: 'lt'`）で対象レイヤーとキーコードの書き換えを実行します。
- **システムキーの区別**: `BOOTLOADER` は QMK/VIA では `QK_BOOT` (`0x7C00`) としてブートローダーモードに入り、`SYSTEM_RESET` は `QK_REBOOT` (`0x7C01`) としてブートローダーに入らずキーボードを再起動します。ZMK ではそれぞれ `BOOTLOADER` / `SYS_RESET` に対応します。

### 9.5 タップダンス定義 (Tap Dance)
- **プロジェクト定義**: タップダンス定義は `ProjectSettings.tapDances` に保存する。各定義は Vial の Dynamic Tap Dance 形式を標準モデルとし、`id`, `tapAction`, `holdAction`, `doubleTapAction`, `tapHoldAction`, `tappingTerm` を持つ。
- **Universal Model**: Smiðr 内部では、タップダンス定義をファームウェア固有の種類ではなく Vial 互換の 4 スロット（Tap / Hold / Double Tap / Tap Hold）と Tapping Term として扱う。QMK / Vial / ZMK それぞれの表現差はエクスポート時のコンバーターで吸収する。
- **キーマップ割当**: キー上の割当は `UniversalAction` の `action: 'td'` と `tapDanceId` で保持する。
- **UI 配置**: Macro、Combo、Tap Dance 定義編集はリマップ画面および設計画面右側の個別パネルに分けて配置する。キーマップ設定パネルはキーへの `TD(n)` 割当と、選択中の Tap Dance 定義を開く導線のみを持つ。
- **QMK エクスポート**: `tapDances` が存在する場合、`keymap.c` に `ACTION_TAP_DANCE_FN_ADVANCED_TIME` ベースの `tap_dance_actions[]` と `finished/reset` コールバックを生成し、対象 keymap の `rules.mk` に `TAP_DANCE_ENABLE = yes` を追加する。Tap / Double Tap は `tap_code16()`、Hold / Tap Hold は `register_code16()` と `unregister_code16()` で表現する。
- **Vial エクスポート**: Vial-QMK の `quantum/vial.c` が Dynamic Tap Dance 用の `tap_dance_actions` を定義するため、`keymaps/vial/keymap.c` には `tapDances` の静的定義を生成しない。キー上の `td` 割当は `TD(n)` として出力し、`tapDances` が存在する場合はソース出力時に「Vial では静的 Tap Dance 定義が出力されない」warning を表示する。
- **ZMK エクスポート**: `tapDances` が存在する場合、`.keymap` に `zmk,behavior-tap-dance` を生成する。Hold / Tap Hold が設定されている場合は、必要に応じて `zmk,behavior-hold-tap` を追加生成し、Tap Dance の binding から参照する。キー上の `td` 割当は生成済み behavior ラベル（例: `&smidr_td_0`）を参照する。
- **リマップ時の制限**: Vial 接続では Dynamic Tap Dance プロトコルにより定義そのものを読み書きできる。ZMK Studio 接続では、既存 behavior のキー位置への割当は可能だが、`zmk,behavior-tap-dance` や `zmk,behavior-hold-tap` のノード定義自体はソース出力・再ビルド対象として扱う。ZMK リマップのキーパレットでは、発見済み behavior のうち Smiðr が生成した命名規則 `smidr_td_N` に一致するものだけを `TDN` 候補として表示し、ユーザー定義の任意 Tap Dance behavior は Any / カスタム入力で扱う。

### 9.2 デバイス指向の自己適応型 UI (Device-Oriented Self-Adaptive UI)
- **仕様**: 接続された物理デバイスのケイパビリティフラグ（`DeviceCapability`: `hasMacros`, `hasLighting` など）を監視し、デバイスのサポート状況に応じてエディタの UI を自己適応的に制御します。
- **トグル制御**: 非対応の高度な機能タブ（例：VIA 接続時のマクロやライティング）を自動的にグレーアウト非活性化し、ユーザーに明示するため、スモールデザインの `Off` バッジをトグル部分に付与します。

### 9.3 プロトコル中立トランスポート & ドライバー (Protocol-Agnostic Transport & Drivers)
- **トランスポート契約**: すべての通信メディアは `ITransport` インターフェース（`connect`, `disconnect`, `send`, `receive`）を実装し、WebHID, WebUSB, WebBLE などのブラウザ API の差異を吸収します。
- **ドライバー契約**: 各プロトコルは `IProtocolDriver` インターフェース（`initialize`, `getKey`, `setKey`）に準拠し、エディタコアに対して通信プロトコル中立な API を提供します。

### 9.4 ZMK Studio 統合 (ZMK Studio Integration)
- **トランスポート**: 有線通信用の `ZmkSerialTransport` (Web Serial / CDC ACM) と、Tauri 実行時の無線通信用 `TauriZmkBleTransport` を通じて ZMK Studio 互換デバイスへの接続を扱います。
- **キーマップ取得・更新**: 接続時はデバイス側のメタデータとキーマップを取得して `remoteKeymap` とエディタ表示へ反映します。キーコード変更時は AST から ZMK Studio RPC 向けのバイナリメッセージを生成し、対象レイヤー・ポジションへ送信します。

## 8. 実装時の注意
- 新機能を追加する際は、必ず `KeyboardCanvas` でのインタラクションと `PropertyPanel` での数値編集の両方から操作可能にすること。
- インポート/エクスポートロジックは `src/lib/` 配下に隔離し、KLE (Keyboard Layout Editor) との互換性を常に意識すること。
