import { describe, expect, it } from 'vitest';
import { getRestorableActiveOptions } from '../remap-backup';

describe('remap backup layout selection', () => {
  it('restores compatible choices while retaining selections absent from the backup', () => {
    const current = {
      layoutOptions: {
        '0': { name: 'Split Backspace', type: 'toggle' as const },
        '1': { name: 'Bottom Row', type: 'list' as const, choices: ['ANSI', 'ISO'] },
        '2': { name: 'Encoder', type: 'toggle' as const },
      },
      activeOptions: { '0': 0, '1': 0, '2': 1 },
    };
    const backup = {
      layoutOptions: {
        '0': { name: 'Split Backspace', type: 'toggle' as const },
        '1': { name: 'Bottom Row', type: 'list' as const, choices: ['ANSI', 'ISO'] },
      },
      activeOptions: { '0': 1, '1': 1 },
    };

    expect(getRestorableActiveOptions(backup, current)).toEqual({ '0': 1, '1': 1, '2': 1 });
  });

  it('ignores incompatible definitions and invalid choice indexes', () => {
    const current = {
      layoutOptions: {
        '0': { name: 'Split Backspace', type: 'toggle' as const },
        '1': { name: 'Bottom Row', type: 'list' as const, choices: ['ANSI', 'ISO'] },
        '2': { name: 'Encoder', type: 'toggle' as const },
      },
      activeOptions: { '0': 0, '1': 0, '2': 0 },
    };
    const backup = {
      layoutOptions: {
        '0': { name: 'Different Option', type: 'toggle' as const },
        '1': { name: 'Bottom Row', type: 'list' as const, choices: ['ISO', 'ANSI'] },
        '2': { name: 'Encoder', type: 'toggle' as const },
      },
      activeOptions: { '0': 1, '1': 1, '2': 2 },
    };

    expect(getRestorableActiveOptions(backup, current)).toBeNull();
  });
});
