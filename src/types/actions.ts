// src/types/actions.ts

// QMK語彙から接頭辞"KC_"を一貫して除去し、JIS配列キー等も網羅した極めて合理的なキー定義
export type UniversalKey =
  // アルファベット
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z"
  // 数字
  | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "0"
  // ファンクションキー
  | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "F11" | "F12"
  | "F13" | "F14" | "F15" | "F16" | "F17" | "F18" | "F19" | "F20" | "F21" | "F22" | "F23" | "F24"
  // コントロールキー (KC_ を除去)
  | "ESC" | "TAB" | "CAPS" | "ENT" | "BSPC" | "SPC"
  // 記号・パンクチュエーション (KC_ を除去した短縮名に完全統一)
  | "MINS" | "EQL" | "LBRC" | "RBRC" | "BSLS"
  | "SCLN" | "QUOT" | "GRV" | "COMM" | "DOT" | "SLSH" | "NUHS" | "NUBS"
  // 日本語 JIS 配列固有キー
  | "YEN"           // ¥キー
  | "RO"            // _キー
  | "MHEN"          // 無変換 (KC_MHEN)
  | "HENK"          // 変換 (KC_HENK)
  | "KANA"          // かな
  | "EISU"          // 英数
  // カーソル・ナビゲーション (KC_ を除去)
  | "UP" | "DOWN" | "LEFT" | "RIGHT"
  | "INS" | "DEL" | "HOME" | "END" | "PGUP" | "PGDN"
  // ロックキー (KC_ を除去)
  | "NLCK" | "SLCK" | "PSCR" | "PAUS"
  // 統一された修飾キー
  | "LCTL" | "LSFT" | "LALT" | "LGUI"
  | "RCTL" | "RSFT" | "RALT" | "RGUI"
  // 消費者・メディアコントロール (KC_ を除去)
  | "MPLY" | "MSTP" | "MNXT" | "MPRV"
  | "VOLU" | "VOLD" | "MUTE"
  | "BRIU" | "BRID"
  // マウスキー (QMK / ZMK 共通)
  | "MOUSE_UP" | "MOUSE_DOWN" | "MOUSE_LEFT" | "MOUSE_RIGHT"
  | "MOUSE_BTN1" | "MOUSE_BTN2" | "MOUSE_BTN3" | "MOUSE_BTN4" | "MOUSE_BTN5"
  // システム・ファームウェア
  | "BOOTLOADER" | "SYSTEM_RESET"
  // 特別・透過・なし
  | "TRNS" | "NO";

// 統一されたモディファイア（修飾キー）定義 (UniversalKey と完全一致)
export type Modifier = "LCTL" | "LSFT" | "LALT" | "LGUI" | "RCTL" | "RSFT" | "RALT" | "RGUI";

export type UniversalAction =
  | { type: "trans" }                                              // ▽ (レイヤー継承)
  | { type: "none" }                                                     // キー割り当てなし
  | { type: "tap"; keycode: UniversalKey }                                 // 通常キー単体押し (例: "A", "SPC")
  | { type: "mod"; modifiers: Modifier[]; keycode: UniversalKey }       // 修飾キー+キー同時押し
  | { type: "mo"; layerId: number }                                     // 一時レイヤー遷移 (MO)
  | { type: "tg"; layerId: number }                                        // レイヤー有効化トグル (TG)
  | { type: "to"; layerId: number }                                            // レイヤー直接切り替え (TO)
  | { type: "lt"; layerId: number; tapAction: UniversalAction }   // レイヤータップ (LT)
  | { type: "mt"; modifiers: Modifier[]; tapAction: UniversalAction } // モディファイアタップ (MT)
  | { type: "macro"; macroId: number }                                   // マクロ
  | { type: "lighting"; command: "TOGGLE" | "MODE_UP" | "MODE_DOWN" | "BRIGHTNESS_UP" | "BRIGHTNESS_DOWN" } // 統一ライティング操作
  | { type: "custom"; protocol: "qmk" | "zmk"; rawCode: string };        // エスケープハッチ

export interface MacroAction {
  action: 'text' | 'tap' | 'down' | 'up' | 'delay';
  text?: string;
  keycodes?: string[]; // UniversalKey or custom raw code strings like "0x1234"
  duration?: number; // Delay in milliseconds
}

export interface ComboEntry {
  inputs: UniversalAction[];
  output: UniversalAction;
}

