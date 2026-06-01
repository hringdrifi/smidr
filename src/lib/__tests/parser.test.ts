import { describe, expect, it } from 'vitest';
import { parseKeyboardDefinition } from '../parser';

describe('parseKeyboardDefinition', () => {
  it('reads VIA vendor/product IDs and initializes layout option selections', () => {
    const result = parseKeyboardDefinition({
      name: 'Test VIA',
      vendorId: '0x1234',
      productId: '0xABCD',
      matrix: { rows: 2, cols: 3 },
      layouts: {
        labels: ['Split Backspace'],
        keymap: [
          [{ a: 4 }, '0,0\n\n\n\n\n\n\n\n0,0'],
        ],
      },
    });

    expect(result.vendorProductId).toBe((0x1234 << 16) | 0xABCD);
    expect(result.layoutOptions).toEqual({
      '0': { name: 'Split Backspace', type: 'toggle' },
    });
    expect(result.activeOptions).toEqual({ '0': 0 });
    expect(result.matrix).toEqual({ rows: 2, cols: 3 });
  });
});
