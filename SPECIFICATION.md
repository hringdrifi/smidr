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
- **レイアウト入力単位 (Layout Input Unit):** レイアウト設定パネルにおいて、座標や寸法の単位を `u`（既定）と `mm`（ミリメートル）から切り替え可能。
  - **ミリメートル換算:** `1u = 19.05 mm` を基準とする。
  - **精度と丸め:** UIで `mm` を選択した場合、表示・入力値はミリメートル換算され、内部状態 (keys) には `19.05` で割った `u` 単位で保存される。表示値は小数点以下5桁まで丸められ、内部状態への変換時には小数点以下7桁まで丸められて誤差の累積を防止する。
- **グリッド:** 0.25u 精度。位置更新時は `Math.round(val * 4) / 4` でスナップさせる。
- **数値の丸め (Rounding):** 自由移動時や計算結果の累積誤差を防ぐため、以下の精度で丸めること。
  - 座標・サイズ (x, y, w, h, rx, ry): 小数点以下7桁 (`roundCoord`)
  - 角度 (r): 小数点以下3桁 (`roundRot`)
- **衝突判定:** SAT (分離軸定理) アルゴリズムを使用。ピッタリ隣接するキーを許容するため、0.6mm (約 0.0315u) の `EPSILON` を考慮すること。
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
- **モード選択の保持:** ハードウェア／ファームウェア内の最後の工程は `localStorage` に保存できるが、通常起動時はプロジェクトホームを入口とする。
- **Visual Layout（論理配列）:** キーマップ表示およびキーコードパレットのキートップレジェンドはユーザー設定の `visualLayout` に従って切り替える。値は `qwerty-us` 形式（例: `qwerty-us`, `qwerty-jp`, `qwerty-kr`, `qwerty-es`, `qwertz-de`, `azerty-fr`）で管理し、キーコード自体やエクスポート値は変更しない。この設定はテーマや言語と同様に `localStorage` へ保存し、`.smidr` プロジェクトファイルには保存しない。
- **キーコードパレットの対象モード:** 設計時はプロジェクトで選択したファームウェア、リマップ時は接続した機器のプロトコルを表示・対応可否判定の対象として自動適用する。対象が未選択または未接続の場合のみ `ALL` とする。
- **0.5 ワークスペース:** 起動時はプロジェクトホームを表示し、トップレベルの作業を「ハードウェア」「ファームウェア」「リマップ」に分ける。プロジェクト編集では名称付き左工程ナビ、中央キャンバス、右編集パネルを使用する。ハードウェア工程は「基本設定」「ピン設定」「レイアウト」「マトリクス」「基板出力」の順とする。ハードウェア／ファームウェアの基本設定、ファームウェアの詳細設定、プロジェクト全体に関わるピン設定は工程ナビからモーダルで開き、キー単位のマトリクス割り当ては右編集パネルで行う。新規プロジェクトの作成直後はハードウェア基本設定モーダルを表示する。基本設定と詳細設定の変更は入力時に即時反映し、Xボタン、背景クリック、Escはいずれも変更を保持したままモーダルを閉じる。ハードウェア基本設定のフッターは「ピン設定へ進む」のみを表示し、ピン設定のフッターは「基本設定へ戻る」と「レイアウトへ進む」を表示する。ピン設定モーダルはヘッダーとフッターを固定し、その間の設定領域をモーダル内でスクロール可能にする。ファームウェア基本設定のフッターは開いた経路にかかわらず「ファームを選択へ戻る」と「詳細設定へ進む」を表示する。詳細設定は選択したファーム固有の設定項目を表示し、フッターに「基本設定へ戻る」と「キーマップへ進む」を表示する。ファーム選択モーダルはキャンセルボタンを表示せず、「基本設定へ進む」のみを表示する。選択済みのファームを変更するために開いた場合は、右上のXボタンで閉じられる。上部ツールバーの出力メニューはプロジェクトファイル、KLE JSON、キャンバス画像のみを扱い、KiCadデータは「基板出力」、ファームウェアソースは各ファームウェアの出力工程に集約する。
- **ファームウェア工程:** ファームウェア対象が未選択の状態でファームウェア作業へ切り替えた場合に中央モーダルを表示し、`QMK/VIA`、`Vial`、`ZMK`、`RMK` から対象を選択する。対象が選択済みの場合、ファームウェア作業への切り替えだけでは選択モーダルを表示しない。未選択時は対象を確定するまでモーダルを閉じられず、選択済みの場合は工程ナビまたは出力画面から同じモーダルを再表示して変更できる。選択値は確定時にプロジェクトへ保存し、工程ナビ、基本設定、詳細設定、利用可能な機能、ヘッダーのファームウェア出力、出力画面を対象別に切り替える。ファーム固有の詳細設定を持たない対象では詳細設定工程を省略する。対象を切り替えても別ファーム向けに入力済みの設定は保持する。新規プロジェクトは未選択から開始し、対象指定後に後続工程を表示する。対象情報を持たない既存の 0.5 プロジェクトは `QMK/VIA` として読み込む。工程の最終段階はソース生成と書き出しを行う「{ファーム名}出力」とし、ローカルでのファームウェアコンパイルを行う「ビルド」とは表記しない。
- **ファームウェア工程の状態:** ボード/MCUの対象ファーム対応可否は「ファーム選択」と「ファーム出力」に反映し、非対応ならオレンジとする。「詳細設定」は対応可否から独立し、明示入力された Bootmagic・Vial 解除キーの行/列（0〜255の整数）、Vial UID（任意の0x接頭辞と16桁の16進数）、表示対象の旧ZMK有線デバイス参照（&ラベル）の形式で判定する。空欄は出力時の既定値を使用するため完了として扱い、無効化された設定値や別ファーム向けの設定は判定しない。
- **レスポンシブ:** 1280px以上では左右パネルを常設する。768〜1279pxでは工程ナビと編集パネルをオーバーレイドロワーとして開閉可能にする。768px未満はプロジェクトホームと閲覧を優先する。
- **操作サイズ:** 主要な操作対象は40px以上、本文は14px、補助ラベルは12pxを基準とする。キーボードフォーカスにはアクセント色の可視リングを表示する。
- **保存と復元用ドラフト:** 編集内容は保存ボタンを押すまで正式なプロジェクトへ反映しない。確定済み変更は800msのデバウンス後、正式データとは別の復元用ドラフトとしてローカルに保持し、`previewKeys` と一時的UI状態は含めない。保存済みプロジェクトを次回開く際、対応するドラフトがあれば未保存変更を復元するか保存版を開くか確認する。正式保存時または保存版を選択した時点でドラフトを削除し、ヘッダーには保存中・保存済み・未保存・保存失敗を表示する。

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
- **反転コピー**: レイアウトモードで複数キー選択時、PropertyPanel の反転コピー操作から反転軸指定モードに入る。キャンバス上で左クリックした位置の X 座標を垂直反転軸として、選択中キーを左右反転したコピーを作成する。コピー後は新規コピーのみを選択し、反転軸指定モードを終了する。
  - **座標計算**: 反転軸はレイアウト単位 (`u`) で扱い、`copied.x = axisX * 2 - original.x - original.w`、`copied.rx = axisX * 2 - original.rx` とする。Y 座標および `ry` は維持し、回転角 `r` は符号反転する。
  - **反転軸のスナップ**: 反転軸の X 座標は通常 `gridSnap` に従ってスナップする。`Alt` を押しながら指定した場合はスナップを一時的に無効化する。
  - **キャンセル**: `Escape`、PropertyPanel の同操作の再押下、選択が2キー未満になる操作、アプリモード・エディタモード変更で反転軸指定モードを終了する。

### 6.5 キーボードショートカット
- **Delete / Backspace**: 選択中のキーを削除。
- **Escape**: 選択、フォーカス、アンカーをすべて解除。
- **Ctrl/Cmd + A**: すべてのキーを選択。
- **Ctrl/Cmd + Z / Y**: Undo / Redo。
- **Ctrl/Cmd + C / V**: キーのコピー＆ペースト。
- **矢印キー (↑↓←→)**: 選択中のキーをグリッド単位（gridSnap）で微調整。

### 6.3 キーの並び順 (Physical Sorting Logic)
キーマップの割当順序や Shift クリックによる範囲選択で使用される「物理的な並び順」は、以下のルールに基づき決定されます。
- **基本ルール**: 回転後の見た目上の中心位置を基準に、未処理キーのうち最も上（同値なら左）のキーを行の起点とします。起点から右方向へ、現在キーより X が大きく、現在キーとの Y 差がしきい値以内のキーのうち最も X が小さいキーを次キーとして末尾に追加し、見つからなくなるまで繰り返します。その後、行の先頭から左方向へ、現在キーより X が小さく、現在キーとの Y 差がしきい値以内のキーのうち最も X が大きいキーを先頭に追加し、見つからなくなるまで繰り返します。行が確定したら、残りの未処理キーで同じ処理を繰り返します。
- **カラムスタッガード対応 (Vertical Tolerance)**: エルゴノミック配列等の列のズレを考慮し、**行を伸ばす際の現在キーとの見た目上の Y 座標の差が 0.25u 以内**であれば、それらを「同じ行」として扱います。
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
- **ピン範囲と完了判定**: 分割マトリクスでは左側キーを `pins.rows` / `pins.cols`、右側キーを `pins.splitRows` / `pins.splitCols` の範囲で個別に検証する。対応する行・列ピンが未設定または範囲外のキーは警告表示とし、そのキーが残る間はマトリクス工程を完了扱いにしない。ピン設定工程は左右両方の行・列ピンが設定された場合のみ完了扱いにする。
- **QMK/Vial 出力**: QMK/Vial の split matrix では右側を行方向に連結するため、右側キーは `row + leftRows`, `col` に変換して出力する。例: 左右各 `4x6` の場合、内部は左右とも `0..3 x 0..5`、QMK/Vial 出力は `8x6`。
- **QMK/Vial ソースのレイアウトオプション**: `keyboard.json` の `layouts.LAYOUT.layout`、`keymap.c`、direct pin 配列などの firmware 実体は現在の `activeOptions` で表示されているキーだけを対象にする。VIA/Vial JSON 定義は外部アプリ上で選択肢を保持するため、全レイアウトオプションを出力する。
- **QMK/Vial Matrix Mask**: `qmk.matrixMasked` が有効な場合、`matrix_mask` は現在の `activeOptions` ではなく全レイアウトオプションで使われる matrix position の union から生成する。どのレイアウトでも使われないセルは mask し、row pin と column pin が同じ物理ピンになるセルも mask する。
- **ZMK 出力**: ZMK の split shield では左右を別 shield part として生成する。共有 `.dtsi` には左右を横方向に連結した matrix transform を配置し、右側 overlay で `col-offset = <leftCols>` を指定して右側ローカル matrix event を共有 transform の右側列へ対応付ける。`controllerType: 'mcu'` の場合は左右を別 custom board (`<name>_left` / `<name>_right`) として生成し、右側 board DTS で同じ `col-offset` を指定する。生成する custom board の `board.yml` は board 名・vendor・SoC のみを定義し、`zmk` バリアントは定義しない。current ZMK の HWMv2 規約に従って `Kconfig.<board>` に `ZMK_BOARD_COMPAT` と retention の依存関係を定義し、split board ごとの `<board>.keymap` から共通 `<name>.keymap` を include する。nRF52840 custom board は UF2 boot mode、GPIOTE、USB device を DTS で有効化し、USBのKconfig既定値は中央側だけに設定する。エンコーダーやPMW3610のKconfigは、その周辺機器が配置された側の `_defconfig` のみに出力する。ZIPには `build.yaml` に加えて `.github/workflows/build.yml`、`config/west.yml`、`zephyr/module.yml` を含め、そのままZMK user configリポジトリとしてGitHub Actionsビルドできる構成にする。`build.yaml` と README には board 名をそのまま出力する。出力時は通常構成と ZMK Studio 対応構成を選択できる。Studio 対応時は、matrix transform・kscan・キー順に対応する `zmk,physical-layout` を生成し、各スイッチの幅、高さ、正規化した X/Y 座標、回転角、回転原点を centi-keyunit / centi-degree で `keys` に出力する。`chosen` は `zmk,matrix-transform` ではなく `zmk,physical-layout` を参照し、metadata に `studio` feature を追加する。`build.yaml` は単体または split central 側だけに `studio-rpc-usb-uart` snippet と `-DCONFIG_ZMK_STUDIO=y` を設定する。通常構成ではこれらを出力せず従来構成を維持する。`ProjectSettings.zmk.splitTransport` は `ble`（既定）または `wired` を保持する。`ble` は nRF52 系ターゲットを要求する。`wired` は `zmk,wired-split` ノードを生成し、`ProjectSettings.zmk.wiredSplitDevice`（未指定時は `&pro_micro_serial`）を UART device として出力する。HY0020 は nRF52832 ベースのBLE専用モジュールとして扱い、露出する16 GPIOとSWD書き込み用のHEX出力を使用する。
- **ZMK Devicetree 分割**: split custom board の左右 DTS は共通 `<keyboard>.dtsi` を読み込み、`default_transform` はこの共通ファイルで一度だけ定義する。右側固有の `col-offset` は右側 DTS に置く。ZMK Studio 用の `zmk,physical-layout` ノードと `keys` は `<keyboard>-layouts.dtsi` に分離し、matrix transform と kscan の割り当てはそれらを定義する `<keyboard>.dtsi`、board DTS、または overlay 側で行う。
- **UI 配置**: ハードウェア設定は「分割キーボード」の有効/無効のみを持つ。分割時の通信設定はピン設定内の独立した「分割通信」セクションにまとめ、QMK/Vial の物理シリアルピンと、ZMK の Bluetooth / 有線 UART 方式および有線 UART デバイスをファームウェア別に表示する。分割通信ピンは汎用の「特殊ピン」には含めない。
- **互換性**: 旧データのように右側キーが `col >= leftCols` で保存されている場合は、読み取り・エクスポート時に右側ローカル列へ正規化する。

### 7.5.1 ダイレクトピン配線 (Direct Pin Wiring)
- **配線方式**: `ProjectSettings.matrix.wiring` は `matrix`（既定）または `direct` を保持する。`direct` の場合、ピン設定で実 GPIO を `pins.direct`（分割右手は `pins.splitDirect`）へ順序付きで登録し、各 `PhysicalKey.directIndex` に論理番号 `D0`、`D1`…を割り当てる。画面上の表示・ペイント・自動割り当てはこの論理番号を使い、ファームウェアや KiCad の出力時に同じ側のピン配列から実 GPIO を解決する。
- **キーへの割り当て**: 非分割では `pins.direct` を候補一覧として使う。分割では左側を `pins.direct`、右側を `pins.splitDirect` で管理し、`PhysicalKey.matrixSide` (`left` / `right`) に対応する候補だけを割り当てる。同じピン名でも左右の基板では別 GPIO として扱う。
- **方式切り替え**: `matrix` から `direct` へ切り替えると行・列ピンとキーの行列位置をクリアする。`direct` から `matrix` へ切り替えるとダイレクトピン候補とキーのダイレクトピン割り当てをクリアし、旧方式のピンを使用可能な候補へ戻す。
- **旧データの移行**: `PhysicalKey.directPin` に実 GPIO を保持する既存の direct pin プロジェクトは、読み込み時に `directPin` と `matrixSide` から左右の候補一覧を復元し、対応する `directIndex` へ変換する。以後の保存では `directPin` を出力しない。
- **マトリクス位置**: 既存の `row` / `col` はキーマップ上の位置として残す。`row` / `col` が未設定の direct pin キーは、各 side 内の物理ソート順に `0,n` としてエクスポートする。
- **QMK/Vial 出力**: 非分割では `matrix_pins.direct` を出力する。分割では左側をトップレベル `matrix_pins.direct`、右側を `split.matrix_pins.right.direct` として出力し、右側キーの matrix position は QMK/Vial split と同様に行方向へ連結する。未割り当ての direct pin は `NO_PIN` として埋める。
- **ZMK 出力**: `zmk,kscan-gpio-direct` の `input-gpios` として出力する。分割では左右それぞれの shield / board が side ごとの `input-gpios` を持ち、右側は matrix transform 上で左側の direct pin 数だけ `col-offset` する。行/列未設定の通常マトリクスでは任意GPIOへフォールバックせず `kscan` を無効化する。ダイレクト配線では、ピン未設定の個別スイッチとエンコーダー／トラックボールは `kscan`・matrix transform の対象外とし、残るスイッチ入力がある側だけ `kscan` を有効化する。

### 7.6 ロータリーエンコーダー (Rotary Encoders)
- **追加操作**: エンコーダーとトラックボールの新規追加はレイアウト工程でのみ行う。マトリクス工程のキー配線には追加操作を表示せず、レイアウトで追加済みのデバイスに対するピン設定のみ編集できる。
- **自動有効化**: エンコーダー機能はレイアウトから参照される `ProjectSettings.encoders[]` の有無で決定し、独立したファームウェア機能トグルを持たない。エンコーダーが追加されている場合、対応する QMK/Vial/ZMK 出力を自動的に有効化する。旧 `.smidr` の `features.encoder` は読み込み互換性のため受け入れるが、出力判断には使用しない。
- **内部表現**: アプリ実行中は `ProjectSettings.encoders[]` の各要素に runtime-only の `id` を付与し、物理配置上の `PhysicalKey.encoderId` から参照する。`.smidr` 保存時は runtime `id` を保存せず、`encoders[]` の配列添字を `keys[].encoderIndex` として保存する。読み込み時は `encoderIndex` から新しい `encoderId` を復元する。
- **物理位置**: ボタン付きエンコーダーは通常キーと同じ `PhysicalKey` に `row` / `col` / `keymap` と `encoderId` を併せ持つ。ボタン無しエンコーダーは `row` / `col` を持たず、物理位置と `encoderId` のみを持つ `PhysicalKey` として扱う。エンコーダー物理位置は `kind: "encoder"` で明示できる。
- **レイアウト表示**: `kind: "encoder"` またはエンコーダー参照を持つ `PhysicalKey` は、`w` / `h` だけでサイズを指定し、中心に短辺サイズの円として描画する。`w2` / `h2` / `x2` / `y2` / `stepped` はエンコーダーには適用せず、保存・KLE/VIA 出力時にも除外する。
- **ピン設定**: エンコーダーの A/B ピンはグローバルな row / col ピン設定ではなく、選択中のエンコーダー物理位置に紐付く `ProjectSettings.encoders[]` で管理する。複数エンコーダーでは各 encoder 定義が独立した `pinA` / `pinB` を持つ。
- **ZMK 未設定ピン**: A/B のいずれかが未設定のエンコーダーは、ZMK node・sensor binding・Kconfig を出力しない。
- **KLE/VIA ラベル**: VIA/Vial 互換 JSON へ出力する際は、エンコーダー位置の KLE ラベルに `e{index}` を埋め込む。`row,col` がある場合は押し込みスイッチのマトリクス位置として同じキーに保持し、`e{index}` は回転部の位置メタデータとして併記する。
- **QMK/Vial 出力**: エンコーダーの物理ピンは `keyboard.json` の `encoder.rotary` に配列で出力する。回転時のレイヤー別アクションは `keymap.c` の `encoder_map[][NUM_ENCODERS][NUM_DIRECTIONS]` として生成し、対象 keymap の `rules.mk` に `ENCODER_MAP_ENABLE = yes` を出力する。

### 7.7 PMW3610 トラックボール
- **内部表現**: トラックボールは `ProjectSettings.trackballs[]` で保持し、実行中は runtime-only の `id` と `PhysicalKey.trackballId` で物理配置を参照する。保存時は `trackballIndex` に変換し、読み込み時に新しい `trackballId` を復元する。
- **設定**: 各 PMW3610 は `SCLK`、単線 SPI の `SDIO`、`CS`、`MOTION` (IRQ)、CPI、軸交換、X/Y 反転を持つ。4ピンはピンプールおよびハードウェアの使用済みピンとして扱う。
- **ZMK 出力**: PMW3610 は Zephyr 標準ドライバを使用し、外部PMW3610モジュールは追加しない。自己完結ビルド用の `config/west.yml` はZMK本体だけを参照する。`pixart,pmw3610` node と `CONFIG_SPI`、`CONFIG_ZMK_POINTING`、`CONFIG_INPUT_PMW3610` を生成する。Zephyr Input基盤の `CONFIG_INPUT` は `CONFIG_ZMK_POINTING` が自動選択するため明示出力しない。node には unit addressと一致する `pmw3610@<reg>` 名、`spi-max-frequency`、`motion-gpios`、`zephyr,axis-x`、`zephyr,axis-y`、`res-cpi` を設定する。初期対応は Nordic nRF52 の pinctrl 出力に限定する。非分割またはcentral側のトラックボールは `zmk,input-listener` へ直接接続する。split peripheral側のトラックボールは、左右共通の `zmk,input-split` nodeを経由してcentralへ転送し、central側でのみsplit deviceを参照する `zmk,input-listener` を有効化する。この場合は `CONFIG_ZMK_POINTING` を左右両方で有効化し、`CONFIG_SPI` と `CONFIG_INPUT_PMW3610` は実デバイスが配置されたperipheral側だけで有効化する。分割では物理PMW3610 nodeを配置側の overlay / board DTS のみに出力する。SCLK/SDIO/CS/MOTION のいずれかが未設定なら、これらの出力を生成しない。
- **QMK/Vial 出力**: 初期実装では対象外とし、ZMK 専用の周辺機器として扱う。

### 7.7 RGB Matrix
- **ピン設定ステップの状態**: デカール以外のキーに RGB または単色 LED が設定され、対応する RGB データピンまたはバックライト制御ピンが未設定・無効（使用不可・競合）なら、「ピン設定」ステップの状態マークをオレンジにする。全レイアウトオプションのキーを判定対象とし、ピン修正や LED 種別変更後は既存のマトリクス用ピン設定と合わせて完了状態を再判定する。
- **キー単位のバックライト種別**: レイアウトのキープロパティで「なし・単色・RGB」を選択する。`PhysicalKey.backlight` は `none` / `single` / `rgb` を保持し、未設定（新規キー・既存ファイル）は「なし」として表示する。複数選択時は一括変更でき、値が異なる場合は「混在」を表示する。選択値は `.smidr` に保存し、Undo/Redo に対応する。KiCad の LED 配置はこの種別に従う。RGB 選択時には未設定の LED 番号へ空き番号を初期設定し、単一キー選択時にハードウェアのキープロパティで 1〜1000 の番号を編集できる。RGB 以外への変更時は番号と Matrix 用の配置情報を消去する。
- **内部表現**: RGB Matrix は RGB アンダーグローとは別に `ProjectSettings.features.rgbMatrix` で有効化する。RGB アンダーグローは `ProjectSettings.features.rgb` で管理し、QMK/Vial では `rgblight`、ZMK では `CONFIG_ZMK_RGB_UNDERGLOW` / `CONFIG_WS2812_STRIP` に対応する。各キーは `PhysicalKey.ledIndex`, `ledX`, `ledY`, `ledFlags` を保持する。`ledIndex` は `.smidr` 保存値およびファーム出力用の 0 始まり添字とし、画面表示および KiCad の部品リファレンスでは `ledIndex + 1` の 1 始まり番号を表示する。
- **UI 配置**: RGB Matrix の有効/無効は RGB Matrix パネルで設定し、ハードウェア設定には重複トグルを置かない。特殊ピン設定では「RGBライティング」「単色バックライト」「OLED（I2C）」をそれぞれ別の行に表示する。RGBライティングはデータピン、単色バックライトは制御ピン、OLED（I2C）は SDA/SCL を横並びに配置する。各欄は常時表示し、有効/無効スイッチは置かない。設計時の RGB アンダーグローと単色バックライトは各ピンが有効なら、OLED は SDA/SCL の両方が有効なら自動で有効化する。有効なピンは選択中のボード/MCUで使用でき、マトリクス・ダイレクト入力・使用中の分割通信・エンコーダー・トラックボール・他の特殊ピンと重複しない GPIO とする。ピン消去、ハードウェア変更、プロジェクト読み込み時も再判定し、保存・出力用の `features.rgb/backlight/oled` に反映する。RGB Matrix とキー単位のバックライト種別は別の設定として保持する。
- **バックライト**: 単色 LED バックライトは `ProjectSettings.features.backlight` で有効化し、制御ピンは `ProjectSettings.pins.backlight` に保持する。QMK/Vial では `features.backlight`, `backlight.pin`, `BACKLIGHT_PIN`, `BACKLIGHT_LEVELS` を出力する。ZMK では `CONFIG_ZMK_BACKLIGHT` を出力し、具体的な LED/PWM デバイス定義は後続段階の対象とする。
- **編集 UI**: ライティング画面では RGB を設定したキーのみ、QMK/Vial RGB Matrix 座標 (`x: 0..224`, `y: 0..64`) と flags を編集できる。LED 番号はハードウェア側で設定し、この画面では読み取り専用とする。RGB Matrix を無効にすると全キーの座標・flags とキャンバス上の配置表示を消去し、LED 種別・番号は保持する。無効中は配置操作不可。自動配置は現在表示中の RGB キーだけを対象とし、キー中心から座標を正規化する。LED 番号を変更したり RGB Matrix を自動で有効化したりしない。クリア操作も座標・flags のみを消去する。
- **KLE/VIA ラベル**: KLE ラベルの LED index は `l{index}` 形式で扱う。インポート時は該当ラベルから `ledIndex` を復元し、VIA/Vial JSON エクスポート時もラベルへ再出力する。
- **VIA/Vial JSON メニュー**: `menus` / `keycodes` は有効なライティング機能に応じて出力する。`features.backlight` が有効な場合のみ `qmk_backlight`、`features.rgbMatrix` が有効な場合のみ `qmk_rgb_matrix` を `menus` に含める。`qmk_lighting` keycode グループは RGB / RGB Matrix / Backlight のいずれかが有効な場合のみ出力する。
- **QMK/Vial 出力**: `features.rgbMatrix` が有効で LED index が割り当てられている場合、QMK/Vial ソース出力は `keyboard.json` の `features.rgb_matrix`、`config.h` の `RGB_MATRIX_LED_COUNT`、および `keymap.c` の `g_led_config` を生成する。番号はハードウェアの LED 番号を使用し、RGB 以外のキーは対象外とする。座標未設定の RGB LED と番号の空き部分は flags=0、マトリクス割り当てなしとして扱う。RGB Matrix 用のデータピンは `pins.rgb` を使用する。
- **ZMK 出力**: 現時点では ZMK RGB Matrix には対応しない。ZMK ソース出力では `features.rgb` の RGB underglow 設定のみを扱い、`features.rgbMatrix` およびキーごとの LED 座標は出力しない。

### 7.7.1 RMK ソース出力
- **出力形式**: RMK データは ZIP として出力し、`keyboard.toml`, `vial.json`, `Cargo.toml`, `README.md`, `rmk.project.json` を含める。`keyboard.toml` は RMK の設定方式に合わせ、`[keyboard]`, `[host]`, `[matrix]`, `[layout]` を生成し、`[layout].keymap` は `layer -> row -> col` の3次元配列として出力する。
- **キーコード**: Smiðr の `UniversalAction` から RMK の keymap 文字列へ変換する。通常キーは RMK の `KeyCode` 名（例: `A`, `Kc1`, `Escape`）、レイヤー操作は `MO(n)`, `TG(n)`, `TO(n)`, `LT(n, key)`, `MT(key, modifier)`、Tap Dance は `TD(n)`、Macro 割当は `Macro(n)` として出力する。
- **Vial 連携**: RMK の Vial サポート向けに、Smiðr の既存 VIA/Vial レイアウト定義と同じ `vial.json` を ZIP ルートに出力する。`keyboard.toml` の `serial_number` は Vial 認識用プレフィックスを持つ値を設定し、`[host].vial_enabled = true` と unlock keys を出力する。
- **マトリクス**: 通常マトリクスでは `row_pins`, `col_pins`, `row2col` を出力する。ダイレクトピン配線では `matrix_type = "direct_pin"` と `direct_pins` の2次元配列を出力する。GPIO 名は RP2040 (`GPn`/`GPIOn` -> `PIN_n`) と nRF52 (`P0.nn`/`P1.nn` -> `P0_nn`/`P1_nn`) を RMK/Embassy 形式へ正規化する。
- **Bidirectional Matrix**: RMK は Rust API では bidirectional matrix を扱えるが、初期実装の TOML export では表現しない。通常マトリクスで row pin と column pin に同じ物理ピンが含まれる場合は `RMK TOML export cannot represent bidirectional matrix yet. Use Rust API or change wiring.` warning を出す。
- **レイアウトオプション**: `keyboard.toml` の firmware layout / keymap は現在の `activeOptions` で表示されているキーだけを対象にする。`vial.json` は Vial レイアウト定義として全オプションを保持する。
- **制限**: 初期実装では Split の central/peripheral matrix、Encoder、RGB/Backlight、Combo 定義、Macro 定義の RMK 固有コード生成は警告対象とし、キー上の `TD(n)` / `Macro(n)` 参照のみを出力する。

### 7.8 KiCad MVP 出力
- **出力形式**: KiCad データは ZIP として出力し、`<project>.kicad_pro`, `<project>.kicad_sch`, `<project>.kicad_pcb`, `<project>_plate.kicad_pcb`, `sym-lib-table`, `fp-lib-table`, `README.md`, `smidr.kicad_sym`, `smidr.pretty/*.kicad_mod` を含める。
- **フットプリント選択**: 出力直前に footprint を選択できるダイアログを表示する。選択値は当該エクスポートにのみ適用し、`.smidr` プロジェクト設定には保存しない。スイッチは `Smidr:SW_Smidr_MX_Solder`, `Smidr:SW_Smidr_MX_Hotswap`, `Smidr:SW_Smidr_Choc_Solder`, `Smidr:SW_Smidr_Choc_Hotswap` を選択肢とする。`matrix.wiring === 'matrix'` の場合のみダイオード設定を表示し、ダイオードは `Smidr:D_Smidr_SOD123`, `Smidr:D_Smidr_SOD323`, `Smidr:D_Smidr_DO35` を選択肢とする。
- **ライブラリ**: 回路図シンボルは KiCad 標準ライブラリの `Switch:SW_Push`, `Device:D`, `Device:LED`, `power:GND` を基本とし、KiCad 10 以前の互換性を保つため SK6812MINI-E のみ `Smidr:SK6812MINI_E` を使用する。SK6812MINI-E のピン割りは `1=VDD`, `2=DOUT`, `3=GND`, `4=DIN` とする。ZIP 内には SK6812MINI-E のみを含む `smidr.kicad_sym` と `smidr.pretty` を同梱する。`sym-lib-table` は `${KIPRJMOD}/smidr.kicad_sym`、`fp-lib-table` は `${KIPRJMOD}/smidr.pretty` を `Smidr` ライブラリとして参照する。追加の git submodule やサードパーティライセンス同梱ファイルは生成しない。
- **スイッチ外形の生成**: スイッチ footprint はキー中心を origin とし、電気パッドおよびスイッチ本体形状は選択した方式に応じて生成する。`PhysicalKey.w/h` に応じて keycap, `F.Fab`, `F.CrtYd` の外形をキーごとに可変生成する。
- **SMD footprint の裏面配置**: MX/Choc の hot-swap、SOD123/SOD323、SK6812MINI-E は `attr smd` の footprint として扱う。テンプレート上では `F.Cu` / `F.Paste` / `F.Mask` 側に定義し、`.kicad_pcb` へ直接展開する際は footprint layer と各要素を `B.Cu` / `B.Paste` / `B.Mask` / `B.SilkS` / `B.Fab` / `B.CrtYd` へ切り替えて裏面配置する。THT の MX/Choc solder と DO-35 は表面配置のままとする。
- **PCB 初期表示**: `.kicad_pcb` には `src/lib/kicad-assets/smidr.pretty/*.kicad_mod` を読み込んで board footprint として直接展開する。KiCad 側の footprint 更新なしで初期表示できることを優先しつつ、`smidr.kicad_sym` と `smidr.pretty` は後から更新/差し替えしやすいテンプレートとして同梱する。
- **LED 出力**: `backlight === 'rgb'` の表示キーに対して、RGB Matrix の有効/無効や RGB ピン設定に関わらず、選択中のスイッチ footprint 種別に応じたLED中心位置へ `Smidr:LED_Smidr_SK6812MINI_E` を配置し、`VCC`, `GND`, `RGB_DIN`, `RGB_DOUT_<index>` ネットを生成する。`RGB_DOUT_<index>` の `<index>` は保存値と同じ 0 始まりとし、KiCad の表示用 Reference / Value は `LED<index+1>` / `RGB<index+1>` とする。`backlight === 'single'` の表示キーにのみ単色バックライトLEDを配置し、`BACKLIGHT` と `GND` の間へ並列接続する。MXでは砲弾型の `Smidr:LED_Smidr_Backlight`、Choc/Gateron LPでは裏面実装・透光用基板開口付きの `Smidr:LED_Smidr_Backlight_1206_Reverse` を使用する。LED位置はRGB LEDと共通で、スイッチ中心から MX では下方向へ5.08mm、Chocでは上方向へ4.7mm、Gateron LPでは上方向へ5.175mmとし、キー回転に追従する。
- **RGB LED 番号検証**: 表示中の RGB キーに LED 番号の未設定・範囲外・重複がある場合は KiCad 出力を停止し、ハードウェアのキープロパティで修正するよう表示する。RGB Matrix スイッチの状態は KiCad 出力判定に使用しない。
- **ダイオード配置**: `matrix.wiring === 'matrix'` の KiCad 出力ダイアログでは、ダイオード footprint のキー中心からの X/Y オフセットと追加回転を設定できる。オフセットはキー中心を原点とする純粋な mm 指定で、キー回転に追従する。初期値は X=6.746875mm, Y=3.96875mm, 追加回転=-90度とする。ダイアログには 1u キーとダイオード位置を示す簡易プレビューを表示する。`matrix.wiring === 'direct'` の場合、ダイオード設定とダイオード位置プレビューは表示しない。
- **プレート PCB 出力**: `<project>_plate.kicad_pcb` には `Smidr:Plate_Smidr_Key_Hole` を各キー中心へ配置する。プレート用 footprint はネットを持たず、キー穴はテンプレート内の `Edge.Cuts` として定義する。`PhysicalKey.w/h` に応じて keycap, `F.Fab`, `F.CrtYd` の外形をキーごとに可変生成する。
- **物理配置**: PCB 上のスイッチ footprint は `PhysicalKey.x/y/w/h/r/rx/ry` から算出した物理レイアウトに合わせて配置する。単位変換は `1u = 19.05mm` とする。PCB footprint の回転角は KiCad の座標系に合わせ、Smiðr 上の回転値を反転して出力する。
- **回路図**: `.kicad_sch` には各キーのスイッチ、マトリクス配線時のダイオード、および `ROWn` / `COLn` / `KEY_Rn_Cn` ネットラベルを出力する。回路図上の部品配置は読みやすさ優先の自動整列とし、物理レイアウトとは一致させない。
- **マトリクス配線**: `matrix.wiring === 'matrix'` の場合、スイッチとダイオードを `hardware.diodeDirection` に従って `ROWn` / `COLn` / `KEY_Rn_Cn` ネットへ接続する。
- **ダイレクトピン配線**: `matrix.wiring === 'direct'` の場合、各スイッチの `directIndex` を同じ側のダイレクトピン配列で実 GPIO に解決し、`PIN_<実GPIO>` と `GND` の間に接続する。ダイオードは出力しない。
- **基板外形**: MVP では、表示対象キーの配置範囲に一定余白を加えた簡易矩形を `Edge.Cuts` として出力する。キー形状に沿った外形生成、自動配線、MCU/コネクタの実装は次段階の対象とする。

### 分割通信のハードウェア設定
- ピン設定の分割通信はファームウェア名を表示せず、最初に「有線／無線」を選択する。有線では UART の「半二重／全二重」を選択し、半二重は TX/RX 共用ピン1本、全二重は TX と RX の2本を割り当てる。左右は同じピン番号を使用し、全二重の配線は左TX↔右RX、左RX↔右TXとする。
- 共通設定は実行時・0.5保存形式ともに `hardware.splitCommunication: { transport: 'wired' | 'wireless', duplex: 'half' | 'full' }`、ピンは `pins.splitSerial`（TXまたは共用）、`pins.splitSerialRx`（RX）で保持する。新規プロジェクトは有線・半二重を初期値とする。旧設定は読み込み時に従来のファーム対象と通信設定から解決する。
- 無線選択中はUARTピンを表示・予約しない。半二重選択中はRXを予約しない。切り替えても入力済みのピン値は保持する。通信ピンは左右両方のマトリクス、ダイレクトピン、周辺機能と重複できない。全二重は異なるTX/RXが必須。
- QMK/Vialは従来の半二重出力に加え、全二重では `SERIAL_USART_FULL_DUPLEX` とTX/RX定義を生成する。全二重出力はRP2040（vendor/PIO）とSTM32（usart）が対象。STM32のUARTインスタンス・代替機能設定は生成後の確認が必要。無線は出力エラーとする。
- ZMKは共通設定からBLE／有線を選び、有線全二重ではRP2040 PIOまたはnRF52 UARTのpinctrlを生成する。単線半二重の生成は未対応のため出力エラーとし、全二重へ暗黙変換しない。旧ファイルのUARTデバイス指定は旧方式での直接出力時に保持する。
- RMKの共通設定付き分割出力はcentral/peripheralの行オフセット付きマトリクスと通信設定を生成する。有線はRP2040 PIOで同一TX/RXなら半二重、別ピンなら全二重、無線はnRF52が対象。各側のRustエントリーポイントとCargo機能設定は引き続き生成対象外。

### 7.9 Smiðr 0.5 プロジェクト形式
- `.smidr` は `schemaVersion: "0.5"` を持ち、`metadata`、`layout`、`hardware`、`firmware` の用途別オブジェクトへ設定を保存する。
- 保存DTOと実行時の `ProjectSettings` は変換層で分離し、各ファームウェア／KiCadエクスポーターは共通の実行時モデルを利用する。
- バージョンなしの旧 `.smidr` は読込時に実行時モデルへ変換する。書き出しは常に0.5形式とする。
- 旧localStorageは初回読込時に元JSONを `smidr_projects_backup_pre_0_5` へ退避し、`smidr_projects_v0_5` へ自動移行する。

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
