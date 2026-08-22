export type QmkMcu =
  | 'AT32F415'
  | 'at90usb1286'
  | 'at90usb1287'
  | 'at90usb162'
  | 'at90usb646'
  | 'at90usb647'
  | 'atmega16u2'
  | 'atmega16u4'
  | 'atmega328'
  | 'atmega328p'
  | 'atmega32a'
  | 'atmega32u2'
  | 'atmega32u4'
  | 'attiny85'
  | 'GD32VF103'
  | 'HY0020'
  | 'MK20DX128'
  | 'MK20DX256'
  | 'MK64FX512'
  | 'MK66FX1M0'
  | 'MKL26Z64'
  | 'RP2040'
  | 'STM32F042'
  | 'STM32F072'
  | 'STM32F103'
  | 'STM32F303'
  | 'STM32F401'
  | 'STM32F405'
  | 'STM32F407'
  | 'STM32F411'
  | 'STM32F446'
  | 'STM32G0B1'
  | 'STM32G431'
  | 'STM32G474'
  | 'STM32H723'
  | 'STM32H733'
  | 'STM32L412'
  | 'STM32L422'
  | 'STM32L432'
  | 'STM32L433'
  | 'STM32L442'
  | 'STM32L443'
  | 'WB32F3G71'
  | 'WB32FQ95';

type PinSet =
  | 'rp2040'
  | 'hy0020'
  | 'nrf52840'
  | 'avr_u4'
  | 'avr_usb2'
  | 'avr_usb_big'
  | 'avr_328'
  | 'avr_32a'
  | 'attiny85'
  | 'at32f415'
  | 'gd32vf103'
  | 'kinetis'
  | 'stm32f042'
  | 'stm32f072'
  | 'stm32f103'
  | 'stm32f303'
  | 'stm32f401'
  | 'stm32f405_407'
  | 'stm32f411'
  | 'stm32f446'
  | 'stm32g0b1'
  | 'stm32g4'
  | 'stm32h7'
  | 'stm32l4'
  | 'wb32fq95'
  | 'wb32f3g71';
export type ZmkTarget = 'rp2040' | 'nrf52832' | 'nrf52840';

export const QMK_DEVELOPMENT_BOARDS = [
  'bit_c_pro',
  'blackpill_f401',
  'blackpill_f411',
  'blok',
  'bluepill',
  'bonsai_c4',
  'elite_c',
  'elite_pi',
  'helios',
  'imera',
  'kb2040',
  'liatris',
  'michi',
  'promicro',
  'promicro_rp2040',
  'proton_c',
  'stemcell',
  'svlinky',
] as const;

export const ZMK_DEVELOPMENT_BOARDS = [
  'adafruit_kb2040',
  'boardsource_blok',
  'seeeduino_xiao_ble',
  'nrfmicro_nrf52833',
  'nrfmicro_nrf52840_flipped',
  'nrfmicro_nrf52840',
  'bluemicro840',
  'puchi_ble',
  'nice_nano',
  'proton_c',
  'sparkfun_pro_micro_rp2040',
  'mikoto',
] as const;

export type DevelopmentBoardOption = {
  value: string;
  label: string;
  qmkBoard?: string;
  zmkBoard?: string;
  zmkInterconnect?: 'pro_micro' | 'seeed_xiao';
  pinSet?: DevelopmentBoardPinSet;
};

type DevelopmentBoardPinSet =
  | 'promicro_avr'
  | 'promicro_avr_plus'
  | 'rp2040_full'
  | 'nrf52840_promicro'
  | 'stm32_blackpill'
  | 'stm32_bluepill';

export const DEVELOPMENT_BOARD_OPTIONS: DevelopmentBoardOption[] = [
  { value: 'bit_c_pro', label: 'Bit-C Pro', qmkBoard: 'bit_c_pro', pinSet: 'promicro_avr_plus' },
  { value: 'blackpill_f401', label: 'Blackpill F401', qmkBoard: 'blackpill_f401', pinSet: 'stm32_blackpill' },
  { value: 'blackpill_f411', label: 'Blackpill F411', qmkBoard: 'blackpill_f411', pinSet: 'stm32_blackpill' },
  { value: 'blok', label: 'Boardsource Blok', qmkBoard: 'blok', zmkBoard: 'boardsource_blok', pinSet: 'nrf52840_promicro' },
  { value: 'bluepill', label: 'Bluepill', qmkBoard: 'bluepill', pinSet: 'stm32_bluepill' },
  { value: 'bonsai_c4', label: 'Bonsai C4', qmkBoard: 'bonsai_c4', pinSet: 'promicro_avr' },
  { value: 'elite_c', label: 'Elite-C', qmkBoard: 'elite_c', pinSet: 'promicro_avr_plus' },
  { value: 'elite_pi', label: 'Elite-Pi', qmkBoard: 'elite_pi', pinSet: 'rp2040_full' },
  { value: 'helios', label: 'Helios', qmkBoard: 'helios', pinSet: 'rp2040_full' },
  { value: 'imera', label: 'Imera', qmkBoard: 'imera', pinSet: 'promicro_avr' },
  { value: 'kb2040', label: 'Adafruit KB2040', qmkBoard: 'kb2040', zmkBoard: 'adafruit_kb2040', pinSet: 'rp2040_full' },
  { value: 'liatris', label: 'Liatris', qmkBoard: 'liatris', pinSet: 'promicro_avr' },
  { value: 'michi', label: 'Michi', qmkBoard: 'michi', pinSet: 'rp2040_full' },
  { value: 'promicro', label: 'Pro Micro', qmkBoard: 'promicro', pinSet: 'promicro_avr' },
  { value: 'promicro_rp2040', label: 'SparkFun Pro Micro RP2040', qmkBoard: 'promicro_rp2040', zmkBoard: 'sparkfun_pro_micro_rp2040', pinSet: 'rp2040_full' },
  { value: 'proton_c', label: 'QMK Proton-C', qmkBoard: 'proton_c', zmkBoard: 'proton_c', pinSet: 'stm32_blackpill' },
  { value: 'stemcell', label: 'Stemcell', qmkBoard: 'stemcell', pinSet: 'stm32_blackpill' },
  { value: 'svlinky', label: 'Svlinky', qmkBoard: 'svlinky', pinSet: 'rp2040_full' },
  { value: 'xiao_ble', label: 'Seeed XIAO nRF52840', zmkBoard: 'seeeduino_xiao_ble', zmkInterconnect: 'seeed_xiao', pinSet: 'nrf52840_promicro' },
  { value: 'nrfmicro_nrf52833', label: 'nRFMicro (nRF52833)', zmkBoard: 'nrfmicro_nrf52833', pinSet: 'nrf52840_promicro' },
  { value: 'nrfmicro_nrf52840_flipped', label: 'nRFMicro nRF52840 (flipped)', zmkBoard: 'nrfmicro_nrf52840_flipped', pinSet: 'nrf52840_promicro' },
  { value: 'nrfmicro_nrf52840', label: 'nRFMicro (nRF52840) 1.1/1.2/1.3', zmkBoard: 'nrfmicro_nrf52840', pinSet: 'nrf52840_promicro' },
  { value: 'bluemicro840', label: 'BlueMicro840 v1', zmkBoard: 'bluemicro840', pinSet: 'nrf52840_promicro' },
  { value: 'puchi_ble', label: 'Puchi-BLE V1', zmkBoard: 'puchi_ble', pinSet: 'nrf52840_promicro' },
  { value: 'nice_nano', label: 'nice!nano', zmkBoard: 'nice_nano', pinSet: 'nrf52840_promicro' },
  { value: 'mikoto', label: 'Mikoto', zmkBoard: 'mikoto', pinSet: 'nrf52840_promicro' },
];

export const getQmkDevelopmentBoard = (board: string | undefined) =>
  DEVELOPMENT_BOARD_OPTIONS.find(option => option.value === board)?.qmkBoard || board || 'promicro';

export const getZmkDevelopmentBoard = (board: string | undefined) =>
  DEVELOPMENT_BOARD_OPTIONS.find(option => option.value === board)?.zmkBoard || board || 'nice_nano';

export const getZmkDevelopmentBoardInterconnect = (board: string | undefined) => {
  const option = DEVELOPMENT_BOARD_OPTIONS.find(candidate => candidate.value === board || candidate.zmkBoard === board);
  return option?.zmkInterconnect || 'pro_micro';
};

export const getZmkDevelopmentBoardTarget = (board: string | undefined): ZmkTarget | undefined => {
  const option = DEVELOPMENT_BOARD_OPTIONS.find(candidate => candidate.value === board || candidate.zmkBoard === board);
  if (!option) return undefined;
  if (option.pinSet === 'nrf52840_promicro') return 'nrf52840';
  if (option.pinSet === 'rp2040_full') return 'rp2040';
  return undefined;
};

export const getZmkHardwareTarget = (
  hardware: { controllerType?: 'mcu' | 'development_board'; mcu?: string; board?: string } | undefined
) => {
  if ((hardware?.controllerType || 'development_board') === 'development_board') {
    return getZmkDevelopmentBoardTarget(hardware?.board) || getZmkTarget(hardware?.mcu);
  }
  return getZmkTarget(hardware?.mcu);
};

export const isQmkDevelopmentBoardSupported = (board: string | undefined) => {
  const option = DEVELOPMENT_BOARD_OPTIONS.find(candidate => candidate.value === board);
  return option ? !!option.qmkBoard : QMK_DEVELOPMENT_BOARDS.includes(board as any);
};

export const isZmkDevelopmentBoardSupported = (board: string | undefined) => {
  const option = DEVELOPMENT_BOARD_OPTIONS.find(candidate => candidate.value === board);
  return option ? !!option.zmkBoard : ZMK_DEVELOPMENT_BOARDS.includes(board as any);
};

export const isQmkMcuSupported = (mcu: string | undefined) => {
  const preset = getMcuPreset(mcu);
  return !!preset && preset.qmkProcessor !== 'unknown';
};

export const isQmkSourceExportSupported = (hardware: { controllerType?: 'mcu' | 'development_board'; mcu?: string; board?: string } | undefined) => {
  if ((hardware?.controllerType || 'development_board') === 'development_board') {
    return isQmkDevelopmentBoardSupported(hardware?.board);
  }
  return isQmkMcuSupported(hardware?.mcu);
};

export const isZmkSourceExportSupported = (hardware: { controllerType?: 'mcu' | 'development_board'; mcu?: string; board?: string } | undefined) => {
  if ((hardware?.controllerType || 'development_board') === 'development_board') {
    return isZmkDevelopmentBoardSupported(hardware?.board);
  }
  return isZmkExportSupported(hardware?.mcu);
};

export const getDefaultDevelopmentBoard = (mcu: string | undefined) => {
  const normalized = (mcu || '').toLowerCase();
  if (normalized === 'rp2040') return 'promicro_rp2040';
  if (normalized === 'stm32f401') return 'blackpill_f401';
  if (normalized === 'stm32f411') return 'blackpill_f411';
  if (normalized === 'stm32f103') return 'bluepill';
  return 'promicro';
};

export const getDefaultZmkBoard = (mcu: string | undefined) => {
  const target = getMcuPreset(mcu)?.zmkTarget;
  if (target === 'nrf52840') return 'nice_nano';
  if (target === 'rp2040') return 'promicro_rp2040';
  return getDefaultDevelopmentBoard(mcu);
};

export interface McuPreset {
  value: QmkMcu | 'nRF52840';
  label: string;
  bootloader: string;
  pinSet: PinSet;
  splitSerialDriver: 'bitbang' | 'vendor';
  qmkProcessor?: string;
  zmkTarget?: ZmkTarget;
}

const range = (prefix: string, start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => `${prefix}${start + index}`);

const port = (name: string, start = 0, end = 15) => range(name, start, end);

const ports = (names: string[], start = 0, end = 15) =>
  names.flatMap(name => port(name, start, end));

const nrfPortPins = (port: 0 | 1, start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => `P${port}.${String(start + index).padStart(2, '0')}`);

const pins = {
  rp2040: range('GP', 0, 29),
  nrf52840: [
    ...nrfPortPins(0, 0, 31),
    ...nrfPortPins(1, 0, 15),
  ],
  hy0020: [
    'P0.02', 'P0.03', 'P0.04', 'P0.05', 'P0.06', 'P0.07', 'P0.08',
    'P0.09', 'P0.10', 'P0.12', 'P0.16', 'P0.18', 'P0.20', 'P0.21',
    'P0.28', 'P0.30',
  ],
  avr_u4: [
    ...range('B', 0, 7),
    'C6', 'C7',
    ...range('D', 0, 7),
    'E2', 'E6',
    'F0', 'F1', 'F4', 'F5', 'F6', 'F7',
  ],
  avr_usb2: [
    ...range('B', 0, 7),
    'C2', 'C4', 'C5', 'C6', 'C7',
    ...range('D', 0, 7),
  ],
  avr_328: [
    ...range('B', 0, 7),
    ...range('C', 0, 6),
    ...range('D', 0, 7),
  ],
  avr_usb_big: [
    ...range('A', 0, 7),
    ...range('B', 0, 7),
    ...range('C', 0, 7),
    ...range('D', 0, 7),
    ...range('E', 0, 7),
    ...range('F', 0, 7),
  ],
  avr_32a: [
    ...range('A', 0, 7),
    ...range('B', 0, 7),
    ...range('C', 0, 7),
    ...range('D', 0, 7),
  ],
  attiny85: range('B', 0, 5),
  at32f415: [
    ...ports(['A', 'B', 'C']),
    'D0', 'D1', 'D2',
    'F4', 'F5', 'F6', 'F7',
  ],
  gd32vf103: ports(['A', 'B', 'C', 'D', 'E']),
  kinetis: ports(['A', 'B', 'C', 'D', 'E'], 0, 31),
  stm32f042: [
    ...ports(['A', 'B']),
    'C13', 'C14', 'C15',
    'F0', 'F1',
  ],
  stm32f072: [
    ...ports(['A', 'B', 'C']),
    'D2',
    'F0', 'F1',
  ],
  stm32f103: [
    ...ports(['A', 'B', 'C']),
    'D0', 'D1', 'D2',
    ...port('E'),
  ],
  stm32f303: [
    ...ports(['A', 'B', 'C']),
    'D2',
    ...port('E'),
    'F0', 'F1',
  ],
  stm32f401: [
    ...ports(['A', 'B', 'C']),
    'D2',
    ...port('E'),
    'H0', 'H1',
  ],
  stm32f405_407: ports(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']),
  stm32f411: [
    ...ports(['A', 'B', 'C']),
    'D2',
    ...port('E'),
    'H0', 'H1',
  ],
  stm32f446: ports(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
  stm32g0b1: ports(['A', 'B', 'C', 'D', 'E', 'F']),
  stm32g4: ports(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
  stm32h7: ports(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']),
  stm32l4: ports(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
  wb32fq95: ports(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
  wb32f3g71: ports(['A', 'B', 'C', 'D', 'E', 'F']),
} satisfies Record<PinSet, string[]>;

const developmentBoardPins = {
  promicro_avr: [
    'D3', 'D2', 'D1', 'D0',
    'D4', 'C6', 'D7', 'E6',
    'B4', 'B5', 'B6', 'B2',
    'B3', 'B1', 'F7', 'F6',
    'F5', 'F4',
  ],
  promicro_avr_plus: [
    'D3', 'D2', 'D1', 'D0',
    'D4', 'C6', 'D7', 'E6',
    'B4', 'B5', 'B6', 'B2',
    'B3', 'B1', 'F7', 'F6',
    'F5', 'F4', 'B0', 'D5',
  ],
  rp2040_full: range('GP', 0, 29),
  nrf52840_promicro: [
    'P0.02', 'P0.06', 'P0.08', 'P0.09',
    'P0.10', 'P0.11', 'P0.17', 'P0.20',
    'P0.22', 'P0.24', 'P0.29', 'P0.31',
    'P1.00', 'P1.04', 'P1.06', 'P1.11',
    'P1.13', 'P1.15',
  ],
  stm32_blackpill: [
    ...ports(['A', 'B']),
    'C13', 'C14', 'C15',
  ],
  stm32_bluepill: [
    ...ports(['A', 'B']),
    'C13', 'C14', 'C15',
  ],
} satisfies Record<DevelopmentBoardPinSet, string[]>;

export const QMK_MCU_PRESETS: McuPreset[] = [
  { value: 'AT32F415', label: 'AT32F415', bootloader: 'at32-dfu', pinSet: 'at32f415', splitSerialDriver: 'bitbang' },
  { value: 'at90usb1286', label: 'AT90USB1286', bootloader: 'atmel-dfu', pinSet: 'avr_usb_big', splitSerialDriver: 'bitbang' },
  { value: 'at90usb1287', label: 'AT90USB1287', bootloader: 'atmel-dfu', pinSet: 'avr_usb_big', splitSerialDriver: 'bitbang' },
  { value: 'at90usb162', label: 'AT90USB162', bootloader: 'atmel-dfu', pinSet: 'avr_usb2', splitSerialDriver: 'bitbang' },
  { value: 'at90usb646', label: 'AT90USB646', bootloader: 'atmel-dfu', pinSet: 'avr_usb_big', splitSerialDriver: 'bitbang' },
  { value: 'at90usb647', label: 'AT90USB647', bootloader: 'atmel-dfu', pinSet: 'avr_usb_big', splitSerialDriver: 'bitbang' },
  { value: 'atmega16u2', label: 'ATmega16U2', bootloader: 'atmel-dfu', pinSet: 'avr_usb2', splitSerialDriver: 'bitbang' },
  { value: 'atmega16u4', label: 'ATmega16U4', bootloader: 'atmel-dfu', pinSet: 'avr_u4', splitSerialDriver: 'bitbang' },
  { value: 'atmega328', label: 'ATmega328', bootloader: 'usbasploader', pinSet: 'avr_328', splitSerialDriver: 'bitbang' },
  { value: 'atmega328p', label: 'ATmega328P', bootloader: 'usbasploader', pinSet: 'avr_328', splitSerialDriver: 'bitbang' },
  { value: 'atmega32a', label: 'ATmega32A', bootloader: 'bootloadhid', pinSet: 'avr_32a', splitSerialDriver: 'bitbang' },
  { value: 'atmega32u2', label: 'ATmega32U2', bootloader: 'atmel-dfu', pinSet: 'avr_usb2', splitSerialDriver: 'bitbang' },
  { value: 'atmega32u4', label: 'ATmega32U4', bootloader: 'atmel-dfu', pinSet: 'avr_u4', splitSerialDriver: 'bitbang' },
  { value: 'attiny85', label: 'ATtiny85', bootloader: 'custom', pinSet: 'attiny85', splitSerialDriver: 'bitbang' },
  { value: 'GD32VF103', label: 'GD32VF103', bootloader: 'gd32v-dfu', pinSet: 'gd32vf103', splitSerialDriver: 'bitbang' },
  { value: 'MK20DX128', label: 'MK20DX128', bootloader: 'halfkay', pinSet: 'kinetis', splitSerialDriver: 'bitbang' },
  { value: 'MK20DX256', label: 'MK20DX256', bootloader: 'halfkay', pinSet: 'kinetis', splitSerialDriver: 'bitbang' },
  { value: 'MK64FX512', label: 'MK64FX512', bootloader: 'custom', pinSet: 'kinetis', splitSerialDriver: 'bitbang' },
  { value: 'MK66FX1M0', label: 'MK66FX1M0', bootloader: 'halfkay', pinSet: 'kinetis', splitSerialDriver: 'bitbang' },
  { value: 'MKL26Z64', label: 'MKL26Z64', bootloader: 'halfkay', pinSet: 'kinetis', splitSerialDriver: 'bitbang' },
  { value: 'nRF52840', label: 'nRF52840', bootloader: 'custom', pinSet: 'nrf52840', splitSerialDriver: 'bitbang', qmkProcessor: 'unknown', zmkTarget: 'nrf52840' },
  { value: 'HY0020', label: 'HY0020 (nRF52832)', bootloader: 'custom', pinSet: 'hy0020', splitSerialDriver: 'bitbang', qmkProcessor: 'unknown', zmkTarget: 'nrf52832' },
  { value: 'RP2040', label: 'RP2040', bootloader: 'rp2040', pinSet: 'rp2040', splitSerialDriver: 'vendor', zmkTarget: 'rp2040' },
  { value: 'STM32F042', label: 'STM32F042', bootloader: 'stm32-dfu', pinSet: 'stm32f042', splitSerialDriver: 'bitbang' },
  { value: 'STM32F072', label: 'STM32F072', bootloader: 'stm32-dfu', pinSet: 'stm32f072', splitSerialDriver: 'bitbang' },
  { value: 'STM32F103', label: 'STM32F103', bootloader: 'stm32duino', pinSet: 'stm32f103', splitSerialDriver: 'bitbang' },
  { value: 'STM32F303', label: 'STM32F303', bootloader: 'stm32-dfu', pinSet: 'stm32f303', splitSerialDriver: 'bitbang' },
  { value: 'STM32F401', label: 'STM32F401', bootloader: 'stm32-dfu', pinSet: 'stm32f401', splitSerialDriver: 'bitbang' },
  { value: 'STM32F405', label: 'STM32F405', bootloader: 'stm32-dfu', pinSet: 'stm32f405_407', splitSerialDriver: 'bitbang' },
  { value: 'STM32F407', label: 'STM32F407', bootloader: 'stm32-dfu', pinSet: 'stm32f405_407', splitSerialDriver: 'bitbang' },
  { value: 'STM32F411', label: 'STM32F411', bootloader: 'stm32-dfu', pinSet: 'stm32f411', splitSerialDriver: 'bitbang' },
  { value: 'STM32F446', label: 'STM32F446', bootloader: 'stm32-dfu', pinSet: 'stm32f446', splitSerialDriver: 'bitbang' },
  { value: 'STM32G0B1', label: 'STM32G0B1', bootloader: 'stm32-dfu', pinSet: 'stm32g0b1', splitSerialDriver: 'bitbang' },
  { value: 'STM32G431', label: 'STM32G431', bootloader: 'stm32-dfu', pinSet: 'stm32g4', splitSerialDriver: 'bitbang' },
  { value: 'STM32G474', label: 'STM32G474', bootloader: 'stm32-dfu', pinSet: 'stm32g4', splitSerialDriver: 'bitbang' },
  { value: 'STM32H723', label: 'STM32H723', bootloader: 'stm32-dfu', pinSet: 'stm32h7', splitSerialDriver: 'bitbang' },
  { value: 'STM32H733', label: 'STM32H733', bootloader: 'stm32-dfu', pinSet: 'stm32h7', splitSerialDriver: 'bitbang' },
  { value: 'STM32L412', label: 'STM32L412', bootloader: 'stm32-dfu', pinSet: 'stm32l4', splitSerialDriver: 'bitbang' },
  { value: 'STM32L422', label: 'STM32L422', bootloader: 'stm32-dfu', pinSet: 'stm32l4', splitSerialDriver: 'bitbang' },
  { value: 'STM32L432', label: 'STM32L432', bootloader: 'stm32-dfu', pinSet: 'stm32l4', splitSerialDriver: 'bitbang' },
  { value: 'STM32L433', label: 'STM32L433', bootloader: 'stm32-dfu', pinSet: 'stm32l4', splitSerialDriver: 'bitbang' },
  { value: 'STM32L442', label: 'STM32L442', bootloader: 'stm32-dfu', pinSet: 'stm32l4', splitSerialDriver: 'bitbang' },
  { value: 'STM32L443', label: 'STM32L443', bootloader: 'stm32-dfu', pinSet: 'stm32l4', splitSerialDriver: 'bitbang' },
  { value: 'WB32F3G71', label: 'WB32F3G71', bootloader: 'wb32-dfu', pinSet: 'wb32f3g71', splitSerialDriver: 'bitbang' },
  { value: 'WB32FQ95', label: 'WB32FQ95', bootloader: 'wb32-dfu', pinSet: 'wb32fq95', splitSerialDriver: 'bitbang' },
];

export const getMcuPreset = (mcu: string | undefined) =>
  QMK_MCU_PRESETS.find(preset => preset.value.toLowerCase() === (mcu || '').toLowerCase());

export const getDefaultBootloader = (mcu: string | undefined) =>
  getMcuPreset(mcu)?.bootloader || 'custom';

export const getQmkProcessor = (mcu: string | undefined) =>
  getMcuPreset(mcu)?.qmkProcessor || getMcuPreset(mcu)?.value || mcu || 'RP2040';

export const getMcuPins = (mcu: string | undefined) =>
  pins[getMcuPreset(mcu)?.pinSet || 'stm32h7'];

export const getDevelopmentBoardPins = (board: string | undefined, fallbackMcu?: string) => {
  const pinSet = DEVELOPMENT_BOARD_OPTIONS.find(option => option.value === board)?.pinSet;
  return pinSet ? developmentBoardPins[pinSet] : getMcuPins(fallbackMcu);
};

export const getDevelopmentBoardLabel = (board: string | undefined) =>
  DEVELOPMENT_BOARD_OPTIONS.find(option => option.value === board)?.label || board || 'Development Board';

export const getSplitSerialDriver = (mcu: string | undefined) =>
  getMcuPreset(mcu)?.splitSerialDriver || 'bitbang';

export const isZmkExportSupported = (mcu: string | undefined) =>
  !!getMcuPreset(mcu)?.zmkTarget;

export const getZmkTarget = (mcu: string | undefined) =>
  getMcuPreset(mcu)?.zmkTarget;
