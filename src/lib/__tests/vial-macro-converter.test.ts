import { describe, it, expect } from 'vitest';
import { deserializeMacro, serializeMacro, deserializeMacros, serializeMacros } from '../protocols/vial-macro-converter';
import { MacroAction } from '@/types/actions';

describe('vial-macro-converter', () => {
  describe('serialize and deserialize single macro', () => {
    it('should convert text actions', () => {
      const actions: MacroAction[] = [
        { type: 'text', text: 'Hello!' }
      ];
      
      const serialized = serializeMacro(actions, 2);
      const deserialized = deserializeMacro(serialized, 2);
      
      expect(deserialized).toEqual(actions);
    });

    it('should convert tap actions', () => {
      const actions: MacroAction[] = [
        { type: 'tap', keys: ['A', 'B'] }
      ];
      
      const serialized = serializeMacro(actions, 2);
      const deserialized = deserializeMacro(serialized, 2);
      
      expect(deserialized).toEqual(actions);
    });

    it('should convert down and up key actions', () => {
      const actions: MacroAction[] = [
        { type: 'down', keys: ['LCTL'] },
        { type: 'tap', keys: ['C'] },
        { type: 'up', keys: ['LCTL'] }
      ];
      
      const serialized = serializeMacro(actions, 2);
      const deserialized = deserializeMacro(serialized, 2);
      
      expect(deserialized).toEqual(actions);
    });

    it('should convert delay actions in advanced protocol v2', () => {
      const actions: MacroAction[] = [
        { type: 'tap', keys: ['A'] },
        { type: 'delay', duration: 150 },
        { type: 'tap', keys: ['B'] }
      ];
      
      const serialized = serializeMacro(actions, 2);
      const deserialized = deserializeMacro(serialized, 2);
      
      expect(deserialized).toEqual(actions);
    });

    it('should serialize basic protocol v1 actions', () => {
      const actions: MacroAction[] = [
        { type: 'down', keys: ['A'] },
        { type: 'up', keys: ['A'] }
      ];
      
      const serialized = serializeMacro(actions, 1);
      const deserialized = deserializeMacro(serialized, 1);
      
      expect(deserialized).toEqual(actions);
    });
  });

  describe('serialize and deserialize multiple macros', () => {
    it('should correctly serialize and deserialize an array of macros separated by NUL', () => {
      const macros: MacroAction[][] = [
        [
          { type: 'text', text: 'M0' }
        ],
        [
          { type: 'down', keys: ['LSFT'] },
          { type: 'tap', keys: ['A'] },
          { type: 'up', keys: ['LSFT'] }
        ],
        []
      ];

      const serialized = serializeMacros(macros, 2);
      // We expect at least count = 3
      const deserialized = deserializeMacros(serialized, 3, 2);
      
      expect(deserialized).toHaveLength(3);
      expect(deserialized[0]).toEqual(macros[0]);
      expect(deserialized[1]).toEqual(macros[1]);
      expect(deserialized[2]).toEqual([]);
    });
  });
});
