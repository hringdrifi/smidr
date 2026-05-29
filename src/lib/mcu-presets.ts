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
export type ZmkTarget = 'rp2040' | 'nrf52840';

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
  { value: 'nRF52840', label: 'nRF52840 (ZMK custom board)', bootloader: 'custom', pinSet: 'nrf52840', splitSerialDriver: 'bitbang', qmkProcessor: 'unknown', zmkTarget: 'nrf52840' },
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

export const getSplitSerialDriver = (mcu: string | undefined) =>
  getMcuPreset(mcu)?.splitSerialDriver || 'bitbang';

export const isZmkExportSupported = (mcu: string | undefined) =>
  !!getMcuPreset(mcu)?.zmkTarget;

export const getZmkTarget = (mcu: string | undefined) =>
  getMcuPreset(mcu)?.zmkTarget;
