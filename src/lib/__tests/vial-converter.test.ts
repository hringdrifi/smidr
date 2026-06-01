import { describe, expect, it } from 'vitest';
import { convertVialToSmidr } from '../protocols/vial-converter';

if (!globalThis.crypto) {
  globalThis.crypto = require('node:crypto').webcrypto as any;
}

describe('convertVialToSmidr', () => {
  it('reads Vial vendor/product IDs without emitting vid/pid settings', () => {
    const result = convertVialToSmidr({
      name: 'Test Vial',
      vendorId: '0xFEED',
      productId: '0x0007',
      matrix: { rows: 1, cols: 1 },
      layouts: {
        labels: ['Split Backspace'],
        keymap: [
          [{ a: 4 }, '0,0\n\n\n\n\n\n\n\n0,0'],
        ],
      },
    });

    expect(result.settings.vendorProductId).toBe((0xFEED << 16) | 0x0007);
    expect(result.settings).not.toHaveProperty('vid');
    expect(result.settings).not.toHaveProperty('pid');
    expect(result.settings.activeOptions).toEqual({ '0': 0 });
  });
});
