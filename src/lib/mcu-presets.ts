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

type PinFamily = 'rp2040' | 'nrf52840' | 'avr_u4' | 'avr_usb2_328' | 'avr_usb_big' | 'avr_32a' | 'attiny85' | 'chibios';
export type ZmkTarget = 'rp2040' | 'nrf52840';

export interface McuPreset {
  value: QmkMcu | 'nRF52840';
  label: string;
  bootloader: string;
  pinFamily: PinFamily;
  splitSerialDriver: 'bitbang' | 'vendor';
  qmkProcessor?: string;
  zmkTarget?: ZmkTarget;
}

const range = (prefix: string, start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => `${prefix}${start + index}`);

const nrfPortPins = (port: 0 | 1, start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => `P${port}.${String(start + index).padStart(2, '0')}`);

const pins = {
  rp2040: range('GP', 0, 30),
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
  avr_usb2_328: [
    ...range('B', 0, 7),
    ...range('C', 0, 7),
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
  chibios: [
    ...range('A', 0, 15),
    ...range('B', 0, 15),
    ...range('C', 0, 15),
    ...range('D', 0, 15),
    ...range('E', 0, 15),
    ...range('F', 0, 15),
    ...range('G', 0, 15),
    ...range('H', 0, 15),
    ...range('I', 0, 15),
    ...range('J', 0, 15),
  ],
} satisfies Record<PinFamily, string[]>;

export const QMK_MCU_PRESETS: McuPreset[] = [
  { value: 'AT32F415', label: 'AT32F415', bootloader: 'at32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'at90usb1286', label: 'AT90USB1286', bootloader: 'atmel-dfu', pinFamily: 'avr_usb_big', splitSerialDriver: 'bitbang' },
  { value: 'at90usb1287', label: 'AT90USB1287', bootloader: 'atmel-dfu', pinFamily: 'avr_usb_big', splitSerialDriver: 'bitbang' },
  { value: 'at90usb162', label: 'AT90USB162', bootloader: 'atmel-dfu', pinFamily: 'avr_usb2_328', splitSerialDriver: 'bitbang' },
  { value: 'at90usb646', label: 'AT90USB646', bootloader: 'atmel-dfu', pinFamily: 'avr_usb_big', splitSerialDriver: 'bitbang' },
  { value: 'at90usb647', label: 'AT90USB647', bootloader: 'atmel-dfu', pinFamily: 'avr_usb_big', splitSerialDriver: 'bitbang' },
  { value: 'atmega16u2', label: 'ATmega16U2', bootloader: 'atmel-dfu', pinFamily: 'avr_usb2_328', splitSerialDriver: 'bitbang' },
  { value: 'atmega16u4', label: 'ATmega16U4', bootloader: 'atmel-dfu', pinFamily: 'avr_u4', splitSerialDriver: 'bitbang' },
  { value: 'atmega328', label: 'ATmega328', bootloader: 'usbasploader', pinFamily: 'avr_usb2_328', splitSerialDriver: 'bitbang' },
  { value: 'atmega328p', label: 'ATmega328P', bootloader: 'usbasploader', pinFamily: 'avr_usb2_328', splitSerialDriver: 'bitbang' },
  { value: 'atmega32a', label: 'ATmega32A', bootloader: 'bootloadhid', pinFamily: 'avr_32a', splitSerialDriver: 'bitbang' },
  { value: 'atmega32u2', label: 'ATmega32U2', bootloader: 'atmel-dfu', pinFamily: 'avr_usb2_328', splitSerialDriver: 'bitbang' },
  { value: 'atmega32u4', label: 'ATmega32U4', bootloader: 'atmel-dfu', pinFamily: 'avr_u4', splitSerialDriver: 'bitbang' },
  { value: 'attiny85', label: 'ATtiny85', bootloader: 'custom', pinFamily: 'attiny85', splitSerialDriver: 'bitbang' },
  { value: 'GD32VF103', label: 'GD32VF103', bootloader: 'gd32v-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'MK20DX128', label: 'MK20DX128', bootloader: 'halfkay', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'MK20DX256', label: 'MK20DX256', bootloader: 'halfkay', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'MK64FX512', label: 'MK64FX512', bootloader: 'custom', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'MK66FX1M0', label: 'MK66FX1M0', bootloader: 'halfkay', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'MKL26Z64', label: 'MKL26Z64', bootloader: 'halfkay', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'nRF52840', label: 'nRF52840 (ZMK custom board)', bootloader: 'custom', pinFamily: 'nrf52840', splitSerialDriver: 'bitbang', qmkProcessor: 'unknown', zmkTarget: 'nrf52840' },
  { value: 'RP2040', label: 'RP2040', bootloader: 'rp2040', pinFamily: 'rp2040', splitSerialDriver: 'vendor', zmkTarget: 'rp2040' },
  { value: 'STM32F042', label: 'STM32F042', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32F072', label: 'STM32F072', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32F103', label: 'STM32F103', bootloader: 'stm32duino', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32F303', label: 'STM32F303', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32F401', label: 'STM32F401', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32F405', label: 'STM32F405', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32F407', label: 'STM32F407', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32F411', label: 'STM32F411', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32F446', label: 'STM32F446', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32G0B1', label: 'STM32G0B1', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32G431', label: 'STM32G431', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32G474', label: 'STM32G474', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32H723', label: 'STM32H723', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32H733', label: 'STM32H733', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32L412', label: 'STM32L412', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32L422', label: 'STM32L422', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32L432', label: 'STM32L432', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32L433', label: 'STM32L433', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32L442', label: 'STM32L442', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'STM32L443', label: 'STM32L443', bootloader: 'stm32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'WB32F3G71', label: 'WB32F3G71', bootloader: 'wb32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
  { value: 'WB32FQ95', label: 'WB32FQ95', bootloader: 'wb32-dfu', pinFamily: 'chibios', splitSerialDriver: 'bitbang' },
];

export const getMcuPreset = (mcu: string | undefined) =>
  QMK_MCU_PRESETS.find(preset => preset.value.toLowerCase() === (mcu || '').toLowerCase());

export const getDefaultBootloader = (mcu: string | undefined) =>
  getMcuPreset(mcu)?.bootloader || 'custom';

export const getQmkProcessor = (mcu: string | undefined) =>
  getMcuPreset(mcu)?.qmkProcessor || getMcuPreset(mcu)?.value || mcu || 'RP2040';

export const getMcuPins = (mcu: string | undefined) =>
  pins[getMcuPreset(mcu)?.pinFamily || 'chibios'];

export const getSplitSerialDriver = (mcu: string | undefined) =>
  getMcuPreset(mcu)?.splitSerialDriver || 'bitbang';

export const isZmkExportSupported = (mcu: string | undefined) =>
  !!getMcuPreset(mcu)?.zmkTarget;

export const getZmkTarget = (mcu: string | undefined) =>
  getMcuPreset(mcu)?.zmkTarget;
