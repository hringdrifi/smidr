import { getSplitCommunication } from './split-communication';
import JSZip from 'jszip';
import { UniversalAction, UniversalKey, Modifier } from '@/types/actions';
import { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { generateViaJson } from './export';
import { getDefaultDevelopmentBoard } from './mcu-presets';
import { getDirectMatrixSide, getDirectSideDimensions, getQmkMatrixFromPins, getDirectLocalMatrixPosition, getFirmwareMatrixPosition, isDirectPinMatrix, resolveDirectPin } from './matrix-utils';
import { sortKeys } from './sorting';
import { getRmkChip, normalizeRmkPin, getRmkTrackballs, getRmkHardwareErrors, RmkExportFormat } from './rmk-hardware';
import { addRmkProjectFiles } from './rmk-project';
import { generateRustKeymap, generateRustMain } from './rmk-rust';

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

const tomlStringArray = (values: string[]) => '[' + values.map(value => quoteToml(normalizeRmkPin(value))).join(', ') + ']';

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
  EXEC: 'Execute', HELP: 'Help', MENU: 'Menu', SELECT: 'Select', STOP: 'Stop', AGAIN: 'Again',
  UNDO: 'Undo', CUT: 'Cut', COPY: 'Copy', PASTE: 'Paste', FIND: 'Find',
  LCTL: 'LCtrl', LSFT: 'LShift', LALT: 'LAlt', LGUI: 'LGui', RCTL: 'RCtrl', RSFT: 'RShift', RALT: 'RAlt', RGUI: 'RGui',
  MPLY: 'MediaPlayPause', MSTP: 'MediaStop', MNXT: 'MediaNextTrack', MPRV: 'MediaPrevTrack', VOLU: 'AudioVolUp', VOLD: 'AudioVolDown', MUTE: 'AudioMute',
  BRIU: 'BrightnessUp', BRID: 'BrightnessDown',
  MSEL: 'MediaSelect', EJCT: 'MediaEject', MFFD: 'MediaFastForward', MRWD: 'MediaRewind',
  MAIL: 'Mail', CALC: 'Calculator', MYCM: 'MyComputer', WSCH: 'WwwSearch', WHOM: 'WwwHome',
  WBAK: 'WwwBack', WFWD: 'WwwForward', WSTP: 'WwwStop', WREF: 'WwwRefresh', WFAV: 'WwwFavorites',
  MOUSE_UP: 'MouseUp', MOUSE_DOWN: 'MouseDown', MOUSE_LEFT: 'MouseLeft', MOUSE_RIGHT: 'MouseRight',
  MOUSE_BTN1: 'MouseBtn1', MOUSE_BTN2: 'MouseBtn2', MOUSE_BTN3: 'MouseBtn3', MOUSE_BTN4: 'MouseBtn4', MOUSE_BTN5: 'MouseBtn5',
  BOOTLOADER: 'Bootloader', SYSTEM_RESET: 'Reboot', CAPS_WORD: 'CapsWordToggle', KEY_REPEAT: 'Again', TRNS: '_', NO: 'No',
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
    const left = getDirectSideDimensions(settings, keys, 'left');
    const right = settings.features.split ? getDirectSideDimensions(settings, keys, 'right') : { rows: 0, cols: 0 };
    return { rows: left.rows + right.rows, cols: Math.max(left.cols, right.cols) };
  }
  return getQmkMatrixFromPins(settings.pins, settings.features.split) || settings.matrix;
};

const getVisibleKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => (
  keys.filter(key => !key.group || (settings.activeOptions[key.group] ?? 0) === key.option)
);

const getValidMatrixKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  keys = keys.filter(key => !key.decal && (
    key.kind !== 'trackball' && key.kind !== 'encoder' && !key.trackballId && key.trackballIndex === undefined && !key.encoderId && key.encoderIndex === undefined
    || (isDirectPinMatrix(settings) ? !!key.directPin || key.directIndex !== undefined : key.row !== undefined && key.col !== undefined)
  ));
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

const generateTrackballToml = (settings: ProjectSettings, keys: PhysicalKey[], side?: 'left' | 'right') =>
  getRmkTrackballs(settings, keys).filter(trackball => !side || trackball.side === side).map(trackball => `
[[${side ? `split.${side === 'left' ? 'central' : 'peripheral'}.` : ''}input_device.pmw3610]]
name = "trackball${trackball.index}"
id = ${trackball.index}
spi = { instance = "bitbang${trackball.index}", sck = ${quoteToml(normalizeRmkPin(trackball.sclk))}, mosi = ${quoteToml(normalizeRmkPin(trackball.sdio))}, miso = ${quoteToml(normalizeRmkPin(trackball.sdio))}, cs = ${quoteToml(normalizeRmkPin(trackball.cs))} }
${trackball.motion?.trim() ? `motion = ${quoteToml(normalizeRmkPin(trackball.motion))}\n` : ''}cpi = ${trackball.cpi ?? 1200}
invert_x = ${!!trackball.invertX}
invert_y = ${!!trackball.invertY}
swap_xy = ${!!trackball.swapXy}
`).join('\n');

const generateSplitToml = (settings: ProjectSettings, keys: PhysicalKey[], allKeys: PhysicalKey[]) => {
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
${generateTrackballToml(settings, allKeys, side)}
`;
  };
  return '[split]\nconnection = ' + quoteToml(transport === 'wired' ? 'serial' : 'ble') + '\n\n' + section('left') + '\n' + section('right');
};

const generateKeyboardToml = (settings: ProjectSettings, keys: PhysicalKey[], allKeys: PhysicalKey[]) => {
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
chip = ${quoteToml(getRmkChip(settings))}
usb_enable = ${getRmkChip(settings) !== 'nrf52832'}

[host]
vial_enabled = true
unlock_keys = [[${unlockKeys[0].join(', ')}], [${unlockKeys[1].join(', ')}]]

${settings.features.split ? generateSplitToml(settings, keys, allKeys) : `[matrix]
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
map = ${quoteToml(keys.map(key => { const pos = getFirmwareMatrixPosition(settings, key, keys)!; return '(' + pos.row + ',' + pos.col + ')'; }).join(' '))}

[keymap]
layers = ${layers}
${Array.from({ length: layers }, (_, layer) => '\n[[keymap.layer]]\nkeys = ' + quoteToml(keys.map(key => actionToRmkString(key.keymap?.[layer] || { action: 'trans' })).join(' '))).join('\n')}
${settings.features.split ? '' : generateTrackballToml(settings, allKeys)}
${['nrf52840', 'nrf52833'].includes(getRmkChip(settings)) ? `\n[storage]\nstart_addr = ${getRmkChip(settings) === 'nrf52833' ? 491520 : 917504}\nnum_sectors = 8\n` : ''}
`;
};

export const generateRmkZip = async (
  state: { settings: ProjectSettings; keys: PhysicalKey[] },
  options: { format?: RmkExportFormat } = {},
) => {
  const { settings, keys } = state;
  const format = options.format ?? 'toml';
  const errors = getRmkHardwareErrors(settings, keys, format);
  if (errors.length) throw new Error(errors.join('\n'));
  const visibleKeys = getVisibleKeys(settings, keys);
  const validKeys = getValidMatrixKeys(settings, visibleKeys);
  if (!validKeys.length) throw new Error('Cannot export RMK firmware: no keys have valid matrix row/col assignments.');
  const sortedKeys = sortKeys(validKeys, 0.25);
  const zip = new JSZip();
  const projectName = sanitizeIdentifier(settings.name, 'smidr_keyboard');
  zip.file('keyboard.toml', generateKeyboardToml(settings, sortedKeys, keys));
  zip.file('vial.json', JSON.stringify(generateViaJson({ settings, keys }), null, 2));
  addRmkProjectFiles(zip, settings, projectName, format);
  if (format === 'rust') {
    zip.file('src/keymap.rs', generateRustKeymap(settings, sortedKeys, getRmkMatrixDimensions(settings, sortedKeys),
      (key, layer) => actionToRmkString(key.keymap?.[layer] || { action: 'trans' })));
    const unlock = getUnlockKeys(settings, sortedKeys);
    zip.file(settings.features.split ? 'src/central.rs' : 'src/main.rs', generateRustMain(settings, sortedKeys, keys, unlock));
    if (settings.features.split) zip.file('src/peripheral.rs', generateRustMain(settings, sortedKeys, keys, unlock, 'right'));
  }
  zip.file('rmk.project.json', JSON.stringify({
    generator: 'Smidr', target: 'rmk', version: '0.9.0', format,
    chip: getRmkChip(settings),
    board: settings.hardware.controllerType === 'development_board' ? settings.hardware.board || getDefaultDevelopmentBoard(settings.hardware.mcu) : undefined,
    splitCommunication: settings.features.split ? { ...getSplitCommunication(settings), txPin: settings.pins.splitSerial, rxPin: settings.pins.splitSerialRx } : undefined,
  }, null, 2));
  return zip.generateAsync({ type: 'blob' });
};
