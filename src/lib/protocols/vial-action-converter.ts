import { UniversalAction } from '@/types/actions';
import { 
  viaCodeToAction as baseViaCodeToAction, 
  actionToViaCode as baseActionToViaCode,
  actionToQmkString as baseActionToQmkString,
  qmkStringToAction as baseQmkStringToAction
} from './via-action-converter';

// Decodes Vial-specific keycodes (including Vial extensions like dynamic Tap Dance)
export function vialCodeToAction(value: number): UniversalAction {
  // Vial dynamic Tap Dance range: 0x5800 - 0x581F (TD 0 to 31)
  if (value >= 0x5800 && value <= 0x581F) {
    return { type: 'custom', protocol: 'qmk', rawCode: `TD(${value - 0x5800})` }; // Tap dance representation
  }

  // Fallback to standard QMK/VIA decoder for everything else
  return baseViaCodeToAction(value);
}

// Encodes UniversalAction back into Vial-specific dynamic keycodes
export function actionToVialCode(action: UniversalAction): number {
  if (action.type === 'custom' && action.protocol === 'qmk') {
    // Check if it's dynamic Tap Dance TD(n)
    const match = action.rawCode.match(/^TD\((\d+)\)$/);
    if (match) {
      const tdId = parseInt(match[1]);
      return 0x5800 + (tdId & 0x1F);
    }
  }

  // Fallback to standard QMK/VIA encoder
  return baseActionToViaCode(action);
}

// Converts UniversalAction into Vial-specific QMK C-macro string representations
export function actionToVialString(action: UniversalAction): string {
  // Vial specific expansions if needed
  return baseActionToQmkString(action);
}

// Parses Vial C-macro string notations back into UniversalAction AST
export function vialStringToAction(vialStr: string): UniversalAction {
  const trimmed = vialStr.trim();
  
  // Parse dynamic Tap Dance string TD(n)
  const match = trimmed.match(/^TD\((\d+)\)$/);
  if (match) {
    return { type: 'custom', protocol: 'qmk', rawCode: trimmed };
  }

  // Fallback to standard QMK/VIA parser
  return baseQmkStringToAction(vialStr);
}
