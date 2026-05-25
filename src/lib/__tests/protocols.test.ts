import { describe, it, expect } from 'vitest';
import { viaCodeToAction, actionToViaCode, actionToQmkString, qmkStringToAction } from '../protocols/via-action-converter';
import { zmkStringToAction, actionToZmkString } from '../protocols/zmk-action-converter';
import { UniversalAction } from '@/types/actions';

describe('protocols conversion tests', () => {
  describe('QMK/VIA Dynamic Keycode Converter', () => {
    it('should convert transparent and none keycodes', () => {
      expect(viaCodeToAction(0x0001)).toEqual({ type: 'trans' });
      expect(viaCodeToAction(0x0000)).toEqual({ type: 'none' });

      expect(actionToViaCode({ type: 'trans' })).toBe(0x0001);
      expect(actionToViaCode({ type: 'none' })).toBe(0x0000);
    });

    it('should convert ordinary keys', () => {
      expect(viaCodeToAction(0x0004)).toEqual({ type: 'tap', keycode: 'A' });
      expect(actionToViaCode({ type: 'tap', keycode: 'A' })).toBe(0x0004);
    });

    it('should convert modifier combination keycodes', () => {
      // LCTL (0x01) + LSFT (0x02) = 0x03. Inner key C (0x0006). Value = (0x03 << 8) | 0x06 = 0x0306
      expect(viaCodeToAction(0x0306)).toEqual({
        type: 'mod',
        modifiers: ['LCTL', 'LSFT'],
        keycode: 'C'
      });
      expect(actionToViaCode({
        type: 'mod',
        modifiers: ['LCTL', 'LSFT'],
        keycode: 'C'
      })).toBe(0x0306);
    });

    it('should convert layer actions (momentary, toggle, to)', () => {
      // layer momentary
      expect(viaCodeToAction(0x5201)).toEqual({ type: 'mo', layerId: 1 });
      expect(actionToViaCode({ type: 'mo', layerId: 1 })).toBe(0x5201);

      // layer toggle
      expect(viaCodeToAction(0x5212)).toEqual({ type: 'tg', layerId: 2 });
      expect(actionToViaCode({ type: 'tg', layerId: 2 })).toBe(0x5212);

      // layer to
      expect(viaCodeToAction(0x5223)).toEqual({ type: 'to', layerId: 3 });
      expect(actionToViaCode({ type: 'to', layerId: 3 })).toBe(0x5223);
    });

    it('should convert layer tap LT(layer, key) and mod tap MT(mod, key)', () => {
      // LT(2, KC_SPC) where KC_SPC is 0x2C. Value = 0x4000 | (2 << 8) | 0x2C = 0x422C
      expect(viaCodeToAction(0x422C)).toEqual({
        type: 'lt',
        layerId: 2,
        tapAction: { type: 'tap', keycode: 'SPC' }
      });
      expect(actionToViaCode({
        type: 'lt',
        layerId: 2,
        tapAction: { type: 'tap', keycode: 'SPC' }
      })).toBe(0x422C);

      // MT(MOD_LCTL | MOD_LSFT, KC_SPC). LCTL | LSFT = 0x03. Value = 0x2000 | (0x03 << 8) | 0x2C = 0x232C
      expect(viaCodeToAction(0x232C)).toEqual({
        type: 'mt',
        modifiers: ['LCTL', 'LSFT'],
        tapAction: { type: 'tap', keycode: 'SPC' }
      });
      expect(actionToViaCode({
        type: 'mt',
        modifiers: ['LCTL', 'LSFT'],
        tapAction: { type: 'tap', keycode: 'SPC' }
      })).toBe(0x232C);
    });

    it('should convert macro calls and lighting actions', () => {
      expect(viaCodeToAction(0x7701)).toEqual({ type: 'macro', macroId: 1 });
      expect(actionToViaCode({ type: 'macro', macroId: 1 })).toBe(0x7701);

      expect(viaCodeToAction(0x7C00)).toEqual({ type: 'lighting', command: 'TOGGLE' });
      expect(actionToViaCode({ type: 'lighting', command: 'TOGGLE' })).toBe(0x7C00);
    });
  });

  describe('QMK C-String notation Parser and Formatter', () => {
    it('should parse and format basic key expressions', () => {
      expect(qmkStringToAction('KC_TRNS')).toEqual({ type: 'trans' });
      expect(qmkStringToAction('KC_NO')).toEqual({ type: 'none' });
      expect(qmkStringToAction('KC_A')).toEqual({ type: 'tap', keycode: 'A' });

      expect(actionToQmkString({ type: 'trans' })).toBe('KC_TRNS');
      expect(actionToQmkString({ type: 'none' })).toBe('KC_NO');
      expect(actionToQmkString({ type: 'tap', keycode: 'A' })).toBe('KC_A');
    });

    it('should parse and format nested modifiers and shortcuts', () => {
      expect(qmkStringToAction('C(S(KC_A))')).toEqual({
        type: 'mod',
        modifiers: ['LCTL', 'LSFT'],
        keycode: 'A'
      });
      // actionToQmkString wraps modifiers sequentially: A -> LCTL(KC_A) -> LSFT(LCTL(KC_A))
      expect(actionToQmkString({
        type: 'mod',
        modifiers: ['LCTL', 'LSFT'],
        keycode: 'A'
      })).toBe('LSFT(LCTL(KC_A))');
    });

    it('should parse multi-modifier shorthand macros', () => {
      expect(qmkStringToAction('LCA(KC_A)')).toEqual({
        type: 'mod',
        modifiers: ['LCTL', 'LALT'],
        keycode: 'A'
      });
      expect(qmkStringToAction('MEH(KC_A)')).toEqual({
        type: 'mod',
        modifiers: ['LCTL', 'LSFT', 'LALT'],
        keycode: 'A'
      });
      expect(qmkStringToAction('HYPR(KC_A)')).toEqual({
        type: 'mod',
        modifiers: ['LCTL', 'LSFT', 'LALT', 'LGUI'],
        keycode: 'A'
      });
    });

    it('should parse and format layer tap and mod tap C-macro strings', () => {
      expect(qmkStringToAction('LT(1, KC_SPC)')).toEqual({
        type: 'lt',
        layerId: 1,
        tapAction: { type: 'tap', keycode: 'SPC' }
      });
      expect(actionToQmkString({
        type: 'lt',
        layerId: 1,
        tapAction: { type: 'tap', keycode: 'SPC' }
      })).toBe('LT(1, KC_SPC)');

      expect(qmkStringToAction('MT(MOD_LCTL | MOD_LSFT, KC_SPC)')).toEqual({
        type: 'mt',
        modifiers: ['LCTL', 'LSFT'],
        tapAction: { type: 'tap', keycode: 'SPC' }
      });
      expect(actionToQmkString({
        type: 'mt',
        modifiers: ['LCTL', 'LSFT'],
        tapAction: { type: 'tap', keycode: 'SPC' }
      })).toBe('MT(MOD_LCTL | MOD_LSFT, KC_SPC)');
    });
  });

  describe('ZMK DTS Notation Parser and Formatter', () => {
    it('should parse and format ZMK standard key actions', () => {
      expect(zmkStringToAction('&trans')).toEqual({ type: 'trans' });
      expect(zmkStringToAction('&none')).toEqual({ type: 'none' });
      expect(zmkStringToAction('&kp A')).toEqual({ type: 'tap', keycode: 'A' });

      expect(actionToZmkString({ type: 'trans' })).toBe('&trans');
      expect(actionToZmkString({ type: 'none' })).toBe('&none');
      expect(actionToZmkString({ type: 'tap', keycode: 'A' })).toBe('&kp A');
    });

    it('should parse and format ZMK layer operations', () => {
      expect(zmkStringToAction('&mo 1')).toEqual({ type: 'mo', layerId: 1 });
      expect(actionToZmkString({ type: 'mo', layerId: 1 })).toBe('&mo 1');

      expect(zmkStringToAction('&tog 2')).toEqual({ type: 'tg', layerId: 2 });
      expect(actionToZmkString({ type: 'tg', layerId: 2 })).toBe('&tog 2');

      expect(zmkStringToAction('&to 3')).toEqual({ type: 'to', layerId: 3 });
      expect(actionToZmkString({ type: 'to', layerId: 3 })).toBe('&to 3');
    });

    it('should parse and format ZMK layer tap and mod tap actions', () => {
      expect(zmkStringToAction('&lt 1 SPACE')).toEqual({
        type: 'lt',
        layerId: 1,
        tapAction: { type: 'tap', keycode: 'SPC' }
      });
      expect(actionToZmkString({
        type: 'lt',
        layerId: 1,
        tapAction: { type: 'tap', keycode: 'SPC' }
      })).toBe('&lt 1 SPACE');

      expect(zmkStringToAction('&mt LCTRL SPACE')).toEqual({
        type: 'mt',
        modifiers: ['LCTL'],
        tapAction: { type: 'tap', keycode: 'SPC' }
      });
      expect(actionToZmkString({
        type: 'mt',
        modifiers: ['LCTL'],
        tapAction: { type: 'tap', keycode: 'SPC' }
      })).toBe('&mt LCTRL SPACE');
    });

    it('should parse and format ZMK mouse movements and clicks', () => {
      expect(zmkStringToAction('&mkp LCLK')).toEqual({ type: 'tap', keycode: 'MOUSE_BTN1' });
      expect(actionToZmkString({ type: 'tap', keycode: 'MOUSE_BTN1' })).toBe('&mkp LCLK');

      expect(zmkStringToAction('&mmv MOVE_UP')).toEqual({ type: 'tap', keycode: 'MOUSE_UP' });
      expect(actionToZmkString({ type: 'tap', keycode: 'MOUSE_UP' })).toBe('&mmv MOVE_UP');
    });

    it('should parse and format ZMK modifier combinations', () => {
      expect(zmkStringToAction('&kp LC(LS(A))')).toEqual({
        type: 'mod',
        modifiers: ['LCTL', 'LSFT'],
        keycode: 'A'
      });
      expect(actionToZmkString({
        type: 'mod',
        modifiers: ['LCTL', 'LSFT'],
        keycode: 'A'
      })).toBe('&kp LS(LC(A))');
    });
  });
});
