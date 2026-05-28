import { describe, it, expect } from 'vitest';
import { viaCodeToAction, actionToViaCode, actionToQmkString, qmkStringToAction } from '../protocols/via-action-converter';
import { zmkStringToAction, actionToZmkString } from '../protocols/zmk-action-converter';
import { UniversalAction } from '@/types/actions';
import { ZmkProtocol } from '../protocols/zmk';
import { ITransport } from '../transport/types';

describe('protocols conversion tests', () => {
  describe('QMK/VIA Dynamic Keycode Converter', () => {
    it('should convert transparent and none keycodes', () => {
      expect(viaCodeToAction(0x0001)).toEqual({ action: 'trans' });
      expect(viaCodeToAction(0x0000)).toEqual({ action: 'none' });

      expect(actionToViaCode({ action: 'trans' })).toBe(0x0001);
      expect(actionToViaCode({ action: 'none' })).toBe(0x0000);
    });

    it('should convert ordinary keys', () => {
      expect(viaCodeToAction(0x0004)).toEqual({ action: 'tap', keycode: 'A' });
      expect(actionToViaCode({ action: 'tap', keycode: 'A' })).toBe(0x0004);
    });

    it('should convert modifier combination keycodes', () => {
      // LCTL (0x01) + LSFT (0x02) = 0x03. Inner key C (0x0006). Value = (0x03 << 8) | 0x06 = 0x0306
      expect(viaCodeToAction(0x0306)).toEqual({
        action: 'tap',
        mods: ['LCTL', 'LSFT'],
        keycode: 'C'
      });
      expect(actionToViaCode({
        action: 'tap',
        mods: ['LCTL', 'LSFT'],
        keycode: 'C'
      })).toBe(0x0306);
    });

    it('should convert layer actions (momentary, toggle, to)', () => {
      // layer momentary
      expect(viaCodeToAction(0x5201)).toEqual({ action: 'mo', layerId: 1 });
      expect(actionToViaCode({ action: 'mo', layerId: 1 })).toBe(0x5201);

      // layer toggle
      expect(viaCodeToAction(0x5212)).toEqual({ action: 'tg', layerId: 2 });
      expect(actionToViaCode({ action: 'tg', layerId: 2 })).toBe(0x5212);

      // layer to
      expect(viaCodeToAction(0x5223)).toEqual({ action: 'to', layerId: 3 });
      expect(actionToViaCode({ action: 'to', layerId: 3 })).toBe(0x5223);
    });

    it('should convert layer tap LT(layer, key) and mod tap MT(mod, key)', () => {
      // LT(2, KC_SPC) where KC_SPC is 0x2C. Value = 0x4000 | (2 << 8) | 0x2C = 0x422C
      expect(viaCodeToAction(0x422C)).toEqual({
        action: 'lt',
        layerId: 2,
        tapAction: { action: 'tap', keycode: 'SPC' }
      });
      expect(actionToViaCode({
        action: 'lt',
        layerId: 2,
        tapAction: { action: 'tap', keycode: 'SPC' }
      })).toBe(0x422C);

      // MT(MOD_LCTL | MOD_LSFT, KC_SPC). LCTL | LSFT = 0x03. Value = 0x2000 | (0x03 << 8) | 0x2C = 0x232C
      expect(viaCodeToAction(0x232C)).toEqual({
        action: 'mt',
        modifiers: ['LCTL', 'LSFT'],
        tapAction: { action: 'tap', keycode: 'SPC' }
      });
      expect(actionToViaCode({
        action: 'mt',
        modifiers: ['LCTL', 'LSFT'],
        tapAction: { action: 'tap', keycode: 'SPC' }
      })).toBe(0x232C);
    });

    it('should convert macro calls and lighting actions', () => {
      expect(viaCodeToAction(0x7701)).toEqual({ action: 'macro', macroId: 1 });
      expect(actionToViaCode({ action: 'macro', macroId: 1 })).toBe(0x7701);

      expect(viaCodeToAction(0x7C00)).toEqual({ action: 'lighting', command: 'TOGGLE' });
      expect(actionToViaCode({ action: 'lighting', command: 'TOGGLE' })).toBe(0x7C00);
    });
  });

  describe('QMK C-String notation Parser and Formatter', () => {
    it('should parse and format basic key expressions', () => {
      expect(qmkStringToAction('KC_TRNS')).toEqual({ action: 'trans' });
      expect(qmkStringToAction('KC_NO')).toEqual({ action: 'none' });
      expect(qmkStringToAction('KC_A')).toEqual({ action: 'tap', keycode: 'A' });

      expect(actionToQmkString({ action: 'trans' })).toBe('KC_TRNS');
      expect(actionToQmkString({ action: 'none' })).toBe('KC_NO');
      expect(actionToQmkString({ action: 'tap', keycode: 'A' })).toBe('KC_A');
    });

    it('should parse and format nested modifiers and shortcuts', () => {
      expect(qmkStringToAction('C(S(KC_A))')).toEqual({
        action: 'tap',
        mods: ['LCTL', 'LSFT'],
        keycode: 'A'
      });
      // actionToQmkString wraps modifiers sequentially: A -> LCTL(KC_A) -> LSFT(LCTL(KC_A))
      expect(actionToQmkString({
        action: 'tap',
        mods: ['LCTL', 'LSFT'],
        keycode: 'A'
      })).toBe('LSFT(LCTL(KC_A))');
    });

    it('should parse multi-modifier shorthand macros', () => {
      expect(qmkStringToAction('LCA(KC_A)')).toEqual({
        action: 'tap',
        mods: ['LCTL', 'LALT'],
        keycode: 'A'
      });
      expect(qmkStringToAction('MEH(KC_A)')).toEqual({
        action: 'tap',
        mods: ['LCTL', 'LSFT', 'LALT'],
        keycode: 'A'
      });
      expect(qmkStringToAction('HYPR(KC_A)')).toEqual({
        action: 'tap',
        mods: ['LCTL', 'LSFT', 'LALT', 'LGUI'],
        keycode: 'A'
      });
    });

    it('should parse and format layer tap and mod tap C-macro strings', () => {
      expect(qmkStringToAction('LT(1, KC_SPC)')).toEqual({
        action: 'lt',
        layerId: 1,
        tapAction: { action: 'tap', keycode: 'SPC' }
      });
      expect(actionToQmkString({
        action: 'lt',
        layerId: 1,
        tapAction: { action: 'tap', keycode: 'SPC' }
      })).toBe('LT(1, KC_SPC)');

      expect(qmkStringToAction('MT(MOD_LCTL | MOD_LSFT, KC_SPC)')).toEqual({
        action: 'mt',
        modifiers: ['LCTL', 'LSFT'],
        tapAction: { action: 'tap', keycode: 'SPC' }
      });
      expect(actionToQmkString({
        action: 'mt',
        modifiers: ['LCTL', 'LSFT'],
        tapAction: { action: 'tap', keycode: 'SPC' }
      })).toBe('MT(MOD_LCTL | MOD_LSFT, KC_SPC)');
    });
  });

  describe('ZMK DTS Notation Parser and Formatter', () => {
    it('should parse and format ZMK standard key actions', () => {
      expect(zmkStringToAction('&trans')).toEqual({ action: 'trans' });
      expect(zmkStringToAction('&none')).toEqual({ action: 'none' });
      expect(zmkStringToAction('&kp A')).toEqual({ action: 'tap', keycode: 'A' });

      expect(actionToZmkString({ action: 'trans' })).toBe('&trans');
      expect(actionToZmkString({ action: 'none' })).toBe('&none');
      expect(actionToZmkString({ action: 'tap', keycode: 'A' })).toBe('&kp A');
    });

    it('should parse and format ZMK layer operations', () => {
      expect(zmkStringToAction('&mo 1')).toEqual({ action: 'mo', layerId: 1 });
      expect(actionToZmkString({ action: 'mo', layerId: 1 })).toBe('&mo 1');

      expect(zmkStringToAction('&tog 2')).toEqual({ action: 'tg', layerId: 2 });
      expect(actionToZmkString({ action: 'tg', layerId: 2 })).toBe('&tog 2');

      expect(zmkStringToAction('&to 3')).toEqual({ action: 'to', layerId: 3 });
      expect(actionToZmkString({ action: 'to', layerId: 3 })).toBe('&to 3');
    });

    it('should parse and format ZMK layer tap and mod tap actions', () => {
      expect(zmkStringToAction('&lt 1 SPACE')).toEqual({
        action: 'lt',
        layerId: 1,
        tapAction: { action: 'tap', keycode: 'SPC' }
      });
      expect(actionToZmkString({
        action: 'lt',
        layerId: 1,
        tapAction: { action: 'tap', keycode: 'SPC' }
      })).toBe('&lt 1 SPACE');

      expect(zmkStringToAction('&mt LCTRL SPACE')).toEqual({
        action: 'mt',
        modifiers: ['LCTL'],
        tapAction: { action: 'tap', keycode: 'SPC' }
      });
      expect(actionToZmkString({
        action: 'mt',
        modifiers: ['LCTL'],
        tapAction: { action: 'tap', keycode: 'SPC' }
      })).toBe('&mt LCTRL SPACE');
    });

    it('should parse and format ZMK mouse movements and clicks', () => {
      expect(zmkStringToAction('&mkp LCLK')).toEqual({ action: 'tap', keycode: 'MOUSE_BTN1' });
      expect(actionToZmkString({ action: 'tap', keycode: 'MOUSE_BTN1' })).toBe('&mkp LCLK');

      expect(zmkStringToAction('&mmv MOVE_UP')).toEqual({ action: 'tap', keycode: 'MOUSE_UP' });
      expect(actionToZmkString({ action: 'tap', keycode: 'MOUSE_UP' })).toBe('&mmv MOVE_UP');
    });

    it('should parse and format ZMK modifier combinations', () => {
      expect(zmkStringToAction('&kp LC(LS(A))')).toEqual({
        action: 'tap',
        mods: ['LCTL', 'LSFT'],
        keycode: 'A'
      });
      expect(actionToZmkString({
        action: 'tap',
        mods: ['LCTL', 'LSFT'],
        keycode: 'A'
      })).toBe('&kp LS(LC(A))');
    });
  });

  describe('ZmkProtocol Lock State Detection', () => {
    it('should throw an error indicating lock state when metadata meta error is returned', async () => {
      const zmk = new ZmkProtocol();
      const mockTransport: ITransport = {
        isConnected: true,
        connect: async () => true,
        disconnect: async () => {},
        send: async (data: Uint8Array) => {},
        receive: async (predicate?: (data: Uint8Array) => boolean) => {
          // Construct Response containing RequestResponse with requestId: 1, and meta simpleError: 1 (UNLOCK_REQUIRED)
          // 0a 06 08 01 12 02 10 01
          const payload = new Uint8Array([0x0a, 0x06, 0x08, 0x01, 0x12, 0x02, 0x10, 0x01]);
          return payload;
        }
      };

      await zmk.initialize(mockTransport);

      // We expect sendRequest to throw the locked error when it encounters meta simpleError = 1
      await expect(async () => {
        await zmk['sendRequest'](new Uint8Array([0x08, 0x01]));
      }).rejects.toThrow('Device is locked. Please trigger the Studio Unlock key on your keyboard to unlock.');
    });
  });
});
