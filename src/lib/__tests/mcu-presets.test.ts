import { describe, expect, it } from 'vitest';
import { getMcuPins, isQmkSourceExportSupported, isZmkSourceExportSupported } from '../mcu-presets';

describe('MCU pin presets', () => {
  it('limits RP2040 to the GPIOs exposed by the MCU spec', () => {
    const pins = getMcuPins('RP2040');

    expect(pins).toContain('GP0');
    expect(pins).toContain('GP29');
    expect(pins).not.toContain('GP30');
  });

  it('uses the ATmega328 digital port bits instead of the USB AVR superset', () => {
    const pins = getMcuPins('atmega328p');

    expect(pins).toContain('C6');
    expect(pins).not.toContain('C7');
    expect(pins).not.toContain('F0');
  });

  it('uses the ATmega32U2 USB AVR port C subset', () => {
    const pins = getMcuPins('atmega32u2');

    expect(pins).toContain('C2');
    expect(pins).toContain('C7');
    expect(pins).not.toContain('C0');
    expect(pins).not.toContain('C1');
  });

  it('uses AT32F415 specific GPIOs', () => {
    const pins = getMcuPins('AT32F415');

    expect(pins).toContain('D2');
    expect(pins).toContain('F7');
    expect(pins).not.toContain('D3');
    expect(pins).not.toContain('F0');
  });

  it('keeps STM32F103 within the documented A-E port range', () => {
    const pins = getMcuPins('STM32F103');

    expect(pins).toContain('E15');
    expect(pins).not.toContain('F0');
    expect(pins).not.toContain('J15');
  });

  it('includes the STM32H7 high port range', () => {
    const pins = getMcuPins('STM32H723');

    expect(pins).toContain('K15');
  });

  it('gates source exports by selected controller type', () => {
    expect(isQmkSourceExportSupported({ controllerType: 'mcu', mcu: 'STM32F103' })).toBe(true);
    expect(isZmkSourceExportSupported({ controllerType: 'mcu', mcu: 'STM32F103' })).toBe(false);
    expect(isQmkSourceExportSupported({ controllerType: 'mcu', mcu: 'nRF52840' })).toBe(false);
    expect(isZmkSourceExportSupported({ controllerType: 'mcu', mcu: 'nRF52840' })).toBe(true);

    expect(isQmkSourceExportSupported({ controllerType: 'development_board', board: 'kb2040' })).toBe(true);
    expect(isZmkSourceExportSupported({ controllerType: 'development_board', board: 'kb2040' })).toBe(true);
    expect(isQmkSourceExportSupported({ controllerType: 'development_board', board: 'nice_nano' })).toBe(false);
    expect(isZmkSourceExportSupported({ controllerType: 'development_board', board: 'nice_nano' })).toBe(true);
    expect(isQmkSourceExportSupported({ board: 'nice_nano', mcu: 'RP2040' })).toBe(false);
    expect(isZmkSourceExportSupported({ board: 'nice_nano', mcu: 'RP2040' })).toBe(true);
  });
});
