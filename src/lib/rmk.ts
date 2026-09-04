import { getSplitCommunication } from './split-communication';
import JSZip from 'jszip';
import { UniversalAction, UniversalKey, Modifier } from '@/types/actions';
import { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { generateViaJson } from './export';
import { getDefaultDevelopmentBoard, getZmkHardwareTarget } from './mcu-presets';
import { getDirectMatrixSide, getDirectSideDimensions, getQmkMatrixFromPins, getDirectLocalMatrixPosition, getFirmwareMatrixPosition, getMatrixDimensionsFromPositions, getMatrixFromPins, isDirectPinMatrix, resolveDirectPin } from './matrix-utils';
import { sortKeys } from './sorting';

const sanitizeIdentifier = (value: string, fallback: string) => {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
};

const quoteToml = (value: string) => JSON.stringify(value);

const formatHex16 = (value: number) => `0x${(value & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`;

const normalizeRmkPin = (pin: string | undefined, fallback: string) => {
  const raw = pin?.trim();
  if (!raw) return fallback;
  const rp = raw.match(/^(?:GP|GPIO)(\d+)$/i);
  if (rp) return `PIN_${Number(rp[1])}`;
  const nrf = raw.match(/^P([01])\.(\d{1,2})$/i);
  if (nrf) return `P${nrf[1]}_${nrf[2].padStart(2, '0')}`;
  return raw;
};

const tomlStringArray = (values: string[]) => `[${values.map(value => quoteToml(normalizeRmkPin(value, '_'))).join(', ')}]`;

const getRmkChip = (settings: ProjectSettings) => {
  const target = getZmkHardwareTarget(settings.hardware);
  if (target) return target;
  const mcu = String(settings.hardware.mcu || '').toLowerCase();
  if (mcu.includes('nrf52840')) return 'nrf52840';
  if (mcu.includes('stm32f4')) return 'stm32f4';
  if (mcu.includes('stm32f1')) return 'stm32f1';
  return mcu || 'rp2040';
};

const RMK_KEY_NAMES: Partial<Record<UniversalKey, string>> = {
  A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', H: 'H', I: 'I', J: 'J', K: 'K', L: 'L', M: 'M',
  N: 'N', O: 'O', P: 'P', Q: 'Q', R: 'R', S: 'S', T: 'T', U: 'U', V: 'V', W: 'W', X: 'X', Y: 'Y', Z: 'Z',
  '1': 'Kc1', '2': 'Kc2', '3': 'Kc3', '4': 'Kc4', '5': 'Kc5', '6': 'Kc6', '7': 'Kc7', '8': 'Kc8', '9': 'Kc9', '0': 'Kc0',
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6', F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
  F13: 'F13', F14: 'F14', F15: 'F15', F16: 'F16', F17: 'F17', F18: 'F18', F19: 'F19', F20: 'F20', F21: 'F21', F22: 'F22', F23: 'F23', F24: 'F24',
  ESC: 'Escape', TAB: 'Tab', CAPS: 'CapsLock', ENT: 'Enter', BSPC: 'Backspace', SPC: 'Space',
  MINS: 'Minus', EQL: 'Equal', LBRC: 'LeftBracket', RBRC: 'RightBracket', BSLS: 'Backslash', SCLN: 'Semicolon',
  QUOT: 'Quote', GRV: 'Grave', COMM: 'Comma', DOT: 'Dot', SLSH: 'Slash', NUHS: 'NonusHash', NUBS: 'NonusBackslash',
  YEN: 'International3', RO: 'International1', MHEN: 'International5', HENK: 'International4', KANA: 'Language3', EISU: 'Language2',
  UP: 'Up', DOWN: 'Down', LEFT: 'Left', RIGHT: 'Right', INS: 'Insert', DEL: 'Delete', HOME: 'Home', END: 'End', PGUP: 'PageUp', PGDN: 'PageDown',
  NLCK: 'NumLock', SCRL: 'ScrollLock', PSCR: 'PrintScreen', PAUS: 'Pause',
  P0: 'Kp0', P1: 'Kp1', P2: 'Kp2', P3: 'Kp3', P4: 'Kp4', P5: 'Kp5', P6: 'Kp6', P7: 'Kp7', P8: 'Kp8', P9: 'Kp9',
  PSLS: 'KpSlash', PAST: 'KpAsterisk', PMNS: 'KpMinus', PPLS: 'KpPlus', PENT: 'KpEnter', PDOT: 'KpDot', PCMM: 'KpComma', PEQL: 'KpEqual', APP: 'Menu',
  LCTL: 'LCtrl', LSFT: 'LShift', LALT: 'LAlt', LGUI: 'LGui', RCTL: 'RCtrl', RSFT: 'RShift', RALT: 'RAlt', RGUI: 'RGui',
  MPLY: 'MediaPlayPause', MSTP: 'MediaStop', MNXT: 'MediaNextTrack', MPRV: 'MediaPrevTrack', VOLU: 'AudioVolUp', VOLD: 'AudioVolDown', MUTE: 'AudioMute',
  BRIU: 'BrightnessUp', BRID: 'BrightnessDown',
  MOUSE_UP: 'MouseUp', MOUSE_DOWN: 'MouseDown', MOUSE_LEFT: 'MouseLeft', MOUSE_RIGHT: 'MouseRight',
  MOUSE_BTN1: 'MouseBtn1', MOUSE_BTN2: 'MouseBtn2', MOUSE_BTN3: 'MouseBtn3', MOUSE_BTN4: 'MouseBtn4', MOUSE_BTN5: 'MouseBtn5',
  BOOTLOADER: 'Bootloader', SYSTEM_RESET: 'SystemReset', TRNS: '_', NO: 'No',
};

const rmkMod = (mod: Modifier) => RMK_KEY_NAMES[mod] || mod;

export const actionToRmkString = (action: UniversalAction): string => {
  switch (action.action) {
    case 'trans':
      return '_';
    case 'none':
      return 'No';
    case 'tap': {
      const key = RMK_KEY_NAMES[action.keycode] || action.keycode;
      if (!action.mods?.length) return key;
      return `WM(${key}, ${action.mods.map(rmkMod).join(' | ')})`;
    }
    case 'mo':
      return `MO(${action.layerId})`;
    case 'tg':
      return `TG(${action.layerId})`;
    case 'to':
      return `TO(${action.layerId})`;
    case 'lt':
      return `LT(${action.layerId}, ${actionToRmkString(action.tapAction)})`;
    case 'mt':
      return `MT(${actionToRmkString(action.tapAction)}, ${action.modifiers.map(rmkMod).join(' | ')})`;
    case 'macro':
      return `Macro(${action.macroId})`;
    case 'td':
      return `TD(${action.tapDanceId})`;
    case 'custom':
      return action.rawCode;
  }
};

const getRmkMatrixDimensions = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  if (isDirectPinMatrix(settings)) {
    const positions = keys
      .map(key => getFirmwareMatrixPosition(settings, key, keys))
      .filter((pos): pos is { row: number; col: number } => !!pos);
    return getMatrixDimensionsFromPositions(positions, settings.matrix);
  }
  return (settings.hardware.splitCommunication ? getQmkMatrixFromPins(settings.pins, settings.features.split) : getMatrixFromPins(settings.pins, settings.features.split)) || settings.matrix;
};

const getVisibleKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => (
  keys.filter(key => !key.group || (settings.activeOptions[key.group] ?? 0) === key.option)
);

const getValidMatrixKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const matrix = getRmkMatrixDimensions(settings, keys);
  return keys.filter((key, idx) => {
    if (!isDirectPinMatrix(settings) && (key.row === undefined || key.col === undefined)) return false;
    const pos = getFirmwareMatrixPosition(settings, key, keys);
    if (!pos || pos.row < 0 || pos.col < 0) return false;
    if (pos.row >= matrix.rows || pos.col >= matrix.cols) return false;
    const firstIdx = keys.findIndex(candidate => {
      const other = getFirmwareMatrixPosition(settings, candidate, keys);
      return other?.row === pos.row && other?.col === pos.col;
    });
    return firstIdx === idx;
  });
};

const generateDirectPins = (settings: ProjectSettings, keys: PhysicalKey[], matrix = getRmkMatrixDimensions(settings, keys)) => {
  const direct = Array.from({ length: matrix.rows }, () => Array.from({ length: matrix.cols }, () => '_'));
  keys.forEach(key => {
    const pos = getDirectLocalMatrixPosition(settings, key, keys);
    if (!pos || pos.row >= matrix.rows || pos.col >= matrix.cols) return;
    direct[pos.row][pos.col] = normalizeRmkPin(resolveDirectPin(settings, key, keys), '_');
  });
  return direct.map(row => `    [${row.map(quoteToml).join(', ')}]`).join(',\n');
};

const generateKeymapToml = (settings: ProjectSettings, keys: PhysicalKey[], matrix: ProjectSettings['matrix'], layers: number) => {
  const layerMaps = Array.from({ length: layers }, () =>
    Array.from({ length: matrix.rows }, () =>
      Array.from({ length: matrix.cols }, () => '_')
    )
  );

  keys.forEach(key => {
    const pos = getFirmwareMatrixPosition(settings, key, keys);
    if (!pos || pos.row < 0 || pos.col < 0 || pos.row >= matrix.rows || pos.col >= matrix.cols) return;
    for (let layer = 0; layer < layers; layer += 1) {
      layerMaps[layer][pos.row][pos.col] = actionToRmkString(key.keymap?.[layer] || { action: 'trans' });
    }
  });

  const layersToml = layerMaps.map(layer => {
    const rows = layer.map(row => `        [${row.map(quoteToml).join(', ')}]`);
    return `    [\n${rows.join(',\n')}\n    ]`;
  });

  return `[\n${layersToml.join(',\n')}\n]`;
};

const getUnlockKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const first = keys[0];
  const last = keys[keys.length - 1] || first;
  const firstPos = first ? getFirmwareMatrixPosition(settings, first, keys) : undefined;
  const lastPos = last ? getFirmwareMatrixPosition(settings, last, keys) : undefined;
  return [
    [
      settings.vial?.unlockCombo?.key1?.row ?? firstPos?.row ?? 0,
      settings.vial?.unlockCombo?.key1?.col ?? firstPos?.col ?? 0,
    ],
    [
      settings.vial?.unlockCombo?.key2?.row ?? lastPos?.row ?? 0,
      settings.vial?.unlockCombo?.key2?.col ?? lastPos?.col ?? 1,
    ],
  ];
};

const generateSplitToml = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const { transport, duplex } = getSplitCommunication(settings);
  const chip = getRmkChip(settings);
  if (transport === 'wired' && chip !== 'rp2040')
    throw new Error('RMK wired split config export currently supports RP2040 (PIO).');
  if (transport === 'wireless' && !chip.startsWith('nrf52'))
    throw new Error('RMK wireless split config export currently supports nRF52 targets.');
  const tx = settings.pins.splitSerial;
  const rx = duplex === 'half' ? tx : settings.pins.splitSerialRx;
  if (transport === 'wired' && (!tx || !rx || (duplex === 'full' && tx === rx)))
    throw new Error('Assign valid UART pins before exporting RMK split configuration.');
  const direct = isDirectPinMatrix(settings);
  const leftRows = direct ? getDirectSideDimensions(settings, keys, 'left').rows : settings.pins.rows.length;
  const section = (side: 'left' | 'right') => {
    const rows = side === 'right' && settings.pins.splitRows?.length ? settings.pins.splitRows : settings.pins.rows;
    const cols = side === 'right' && settings.pins.splitCols?.length ? settings.pins.splitCols : settings.pins.cols;
    const dimensions = direct ? getDirectSideDimensions(settings, keys, side) : { rows: rows.length, cols: cols.length };
    const name = side === 'left' ? 'central' : 'peripheral';
    const sideKeys = keys.filter(key => getDirectMatrixSide(settings, key, keys) === side);
    return `${side === 'left' ? '[split.central]' : '[[split.peripheral]]'}
rows = ${dimensions.rows}
cols = ${dimensions.cols}
row_offset = ${side === 'left' ? 0 : leftRows}
col_offset = 0
${transport === 'wired' ? 'serial = [{ instance = "PIO0", tx_pin = ' + quoteToml(normalizeRmkPin(tx, '_')) + ', rx_pin = ' + quoteToml(normalizeRmkPin(rx, '_')) + ' }]' : 'ble_addr = ' + (side === 'left' ? '[0x18, 0xe2, 0x21, 0x80, 0xc0, 0xc7]' : '[0x7e, 0xfe, 0x73, 0x9e, 0x11, 0xe3]')}

[split.${name}.matrix]
${direct ? 'matrix_type = "direct_pin"\ndirect_pins = [\n' + generateDirectPins(settings, sideKeys, dimensions) + '\n]\ndirect_pin_low_active = true' : 'matrix_type = "normal"\nrow_pins = ' + tomlStringArray(rows) + '\ncol_pins = ' + tomlStringArray(cols) + (settings.hardware.diodeDirection === 'ROW2COL' ? '\nrow2col = true' : '')}
`;
  };
  return '[split]\nconnection = ' + quoteToml(transport === 'wired' ? 'serial' : 'ble') + '\n\n' + section('left') + '\n' + section('right');
};

const generateKeyboardToml = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const matrix = getRmkMatrixDimensions(settings, keys);
  const layers = settings.layers || 4;
  const useDirectPins = isDirectPinMatrix(settings);
  const unlockKeys = getUnlockKeys(settings, keys);
  const vid = (settings.vendorProductId >>> 16) & 0xFFFF;
  const pid = settings.vendorProductId & 0xFFFF;

  return `[keyboard]
name = ${quoteToml(settings.name || 'Smidr Keyboard')}
product_name = ${quoteToml(settings.name || 'Smidr Keyboard')}
manufacturer = ${quoteToml(settings.manufacturer || 'Smidr User')}
vendor_id = ${formatHex16(vid)}
product_id = ${formatHex16(pid)}
serial_number = "vial:f64c2b3c:000001"
chip = ${quoteToml(getRmkChip(settings))}
usb_enable = true

[host]
vial_enabled = true
unlock_keys = [[${unlockKeys[0].join(', ')}], [${unlockKeys[1].join(', ')}]]

${settings.features.split && settings.hardware.splitCommunication ? generateSplitToml(settings, keys) : `[matrix]
${useDirectPins ? `matrix_type = "direct_pin"
direct_pins = [
${generateDirectPins(settings, keys)}
]
direct_pin_low_active = true` : `row_pins = ${tomlStringArray(settings.pins.rows || [])}
col_pins = ${tomlStringArray(settings.pins.cols || [])}
${settings.hardware.diodeDirection === 'ROW2COL' ? 'row2col = true' : ''}`}`}

[layout]
rows = ${matrix.rows}
cols = ${matrix.cols}
layers = ${layers}
keymap = ${generateKeymapToml(settings, keys, matrix, layers)}
`;
};

const generateReadme = (settings: ProjectSettings) => `# RMK firmware for ${settings.name}

This source bundle was generated by Smidr.

## Files
- \`keyboard.toml\`: RMK keyboard, matrix, layout, and default keymap configuration.
- \`vial.json\`: Vial layout definition generated from the same Smidr layout.
- \`Cargo.toml\`: Minimal dependency manifest using RMK default features.

## Notes
- RMK expects \`keyboard.toml\` and \`vial.json\` to describe the same key order.
- GPIO names are normalized for common RP2040 and nRF52 formats. Verify the pin names against the RMK/Embassy target before flashing.
- Split configuration includes central/peripheral matrices and communication pins when configured in hardware settings. Separate firmware entry points and chip/split Cargo features still need to be supplied for each half.
- Encoder, RGB Matrix, combo, and project macro definitions may require RMK-specific follow-up code beyond this initial config export.
`;

const generateCargoToml = (name: string) => `[package]
name = ${quoteToml(name)}
version = "0.1.0"
edition = "2021"

[dependencies]
rmk = "0.8"
`;

export const generateRmkZip = async (state: { settings: ProjectSettings; keys: PhysicalKey[] }) => {
  const { settings, keys } = state;
  const visibleKeys = getVisibleKeys(settings, keys);
  const validKeys = getValidMatrixKeys(settings, visibleKeys);
  if (validKeys.length === 0) {
    throw new Error('Cannot export RMK firmware: no keys have valid matrix row/col assignments.');
  }

  const sortedKeys = sortKeys(validKeys, 0.25);
  const zip = new JSZip();
  const projectName = sanitizeIdentifier(settings.name, 'smidr_keyboard');
  zip.file('keyboard.toml', generateKeyboardToml(settings, sortedKeys));
  zip.file('vial.json', JSON.stringify(generateViaJson({ settings, keys }), null, 2));
  zip.file('Cargo.toml', generateCargoToml(projectName));
  zip.file('README.md', generateReadme(settings));
  zip.file('rmk.project.json', JSON.stringify({
    splitCommunication: settings.features.split ? { ...getSplitCommunication(settings), txPin: settings.pins.splitSerial, rxPin: settings.pins.splitSerialRx } : undefined,
    generator: 'Smidr',
    target: 'rmk',
    board: settings.hardware.controllerType === 'development_board'
      ? settings.hardware.board || getDefaultDevelopmentBoard(settings.hardware.mcu)
      : undefined,
    chip: getRmkChip(settings),
  }, null, 2));
  return await zip.generateAsync({ type: 'blob' });
};
