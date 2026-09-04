import type { ProjectSettings } from '@/types/keyboard';

/** Read legacy settings until the common hardware setting is saved. */
export const getSplitCommunication = (settings: ProjectSettings, target = settings.firmwareTarget) => {
  if (settings.hardware.splitCommunication) return settings.hardware.splitCommunication;
  const legacyZmk = target === 'zmk' || (!settings.pins.splitSerial && !!settings.zmk?.splitTransport);
  return {
    transport: legacyZmk && settings.zmk?.splitTransport !== 'wired' ? 'wireless' as const : 'wired' as const,
    duplex: legacyZmk ? 'full' as const : 'half' as const,
  };
};

export const getActiveSplitPins = (settings: ProjectSettings) => {
  const communication = getSplitCommunication(settings);
  if (!settings.features.split || communication.transport !== 'wired') return [];
  return [settings.pins.splitSerial, ...(communication.duplex === 'full' ? [settings.pins.splitSerialRx] : [])]
    .filter((pin): pin is string => !!pin);
};

export const getQmkSplitSerial = (settings: ProjectSettings, legacyDriver: string) => {
  const { duplex } = getSplitCommunication(settings);
  if (duplex === 'half') return { driver: legacyDriver, pin: settings.pins.splitSerial || 'GP1' };
  return { driver: String(settings.hardware.mcu).toUpperCase() === 'RP2040' ? 'vendor' : 'usart' };
};

export const getQmkSplitConfig = (settings: ProjectSettings) => {
  if (!settings.features.split || getSplitCommunication(settings).duplex !== 'full') return '';
  return '\n/* Full-duplex split UART */\n#define SERIAL_USART_FULL_DUPLEX\n#define SERIAL_USART_TX_PIN ' + settings.pins.splitSerial
    + '\n#define SERIAL_USART_RX_PIN ' + settings.pins.splitSerialRx + '\n';
};

export const assertQmkSplitSupported = (settings: ProjectSettings) => {
  if (!settings.features.split) return;
  const { transport, duplex } = getSplitCommunication(settings);
  if (transport === 'wireless') throw new Error('QMK/Vial source export does not support wireless split communication.');
  if (duplex === 'full') {
    if (String(settings.hardware.mcu).toUpperCase() !== 'RP2040' && !String(settings.hardware.mcu).toUpperCase().startsWith('STM32'))
      throw new Error('Full-duplex QMK/Vial source export currently supports RP2040 and STM32 targets.');
    if (!settings.pins.splitSerial || !settings.pins.splitSerialRx || settings.pins.splitSerial === settings.pins.splitSerialRx)
      throw new Error('Full-duplex UART requires two different TX and RX pins.');
  }
};
