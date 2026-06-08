/**
 * Vial Protocol Implementation (Extended from VIA)
 * 
 * Response parsing follows the Vial reference implementation (keyboard_comm.py, macro.py):
 * - No response filtering — first report is always the response
 * - VIA commands: response echoes command byte at data[0], payload at fixed offsets
 * - Vial commands (0xFE prefix): response data starts at data[0] (no echo of prefix)
 * - Buffer commands: data always at data[4:4+sz] (reference: macro.py line 154)
 */
import { ViaProtocol } from './via';
import { XzReadableStream } from 'xz-decompress';
import { ITransport } from '../transport/types';
import { UniversalAction, ComboEntry, MacroAction, TapDanceEntry } from '@/types/actions';
import { vialCodeToAction, actionToVialCode } from './vial-action-converter';

export enum VialCommand {
  GetKeyboardId = 0x00,
  GetSize = 0x01,
  GetDef = 0x02,
  GetEncoder = 0x03,
  SetEncoder = 0x04,
  GetUnlockStatus = 0x05,
  UnlockStart = 0x06,
  UnlockPoll = 0x07,
  Lock = 0x08,
}

export class VialProtocol extends ViaProtocol {
  constructor() {
    super();
  }

  // Agnostic initialization with capability discovery & graceful fallback to VIA
  async initialize(transport: ITransport): Promise<boolean> {
    this.transport = transport;
    try {
      const vialVer = await this.getVialVersion();
      console.log(`[Vial Handshake] Device connected. Vial Protocol Version: 0x${vialVer.toString(16)}`);
      
      // Auto-detect Vial capabilities (Vial supports all advanced features natively)
      this.capabilities = {
        hasTapDance: true,
        hasMacros: true,
        hasCombos: true,
        hasMouseKeys: true,
        hasLighting: true,
        hasRotaryEncoder: true
      };
      return true;
    } catch (err) {
      console.warn('[Vial Handshake] Failed. Attempting graceful degradation to basic QMK/VIA...', err);
      try {
        const viaVer = await this.getProtocolVersion();
        console.log(`[Vial Fallback to VIA] Connected. VIA Protocol Version: 0x${viaVer.toString(16)}`);
        
        // Downgrade capabilities to standard VIA
        this.capabilities = {
          hasTapDance: false,
          hasMacros: true,
          hasCombos: false,
          hasMouseKeys: false,
          hasLighting: true,
          hasRotaryEncoder: false
        };
        return true;
      } catch (viaErr) {
        console.error('[Vial Fallback to VIA] Handshake failed completely:', viaErr);
        return false;
      }
    }
  }

  // Overriding key accessors to utilize vial-specific action encoders/decoders
  async getKey(layer: number, row: number, col: number): Promise<UniversalAction> {
    const rawCode = await this.getKeycode(layer, row, col);
    return vialCodeToAction(rawCode);
  }

  async setKey(layer: number, row: number, col: number, action: UniversalAction): Promise<void> {
    const rawCode = actionToVialCode(action);
    await this.setKeycode(layer, row, col, rawCode);
  }

  // Reference: keyboard_comm.py line 126 — struct.unpack("<IQ", data[0:12])
  // Vial commands: response has no prefix echo, data starts at [0]
  async getVialVersion(): Promise<number> {
    const data = new Uint8Array(32);
    data[0] = 0xFE; // Vial Prefix (CMD_VIA_VIAL_PREFIX)
    data[1] = VialCommand.GetKeyboardId; // 0x00
    await this.sendReport(data);
    const resp = await this.waitForReport();
    // Reference: vial_protocol = uint32 LE at data[0:4]
    return (resp[3] << 24) | (resp[2] << 16) | (resp[1] << 8) | resp[0];
  }

  // Reference: keyboard_comm.py line 452
  async getUnlockStatus(): Promise<number> {
    const data = new Uint8Array(32);
    data[0] = 0xFE; // CMD_VIA_VIAL_PREFIX
    data[1] = VialCommand.GetUnlockStatus; // 0x05
    await this.sendReport(data);
    const resp = await this.waitForReport();
    return resp[0];
  }

  // Reference: keyboard_comm.py line 458
  async unlockStart(): Promise<void> {
    const data = new Uint8Array(32);
    data[0] = 0xFE; // CMD_VIA_VIAL_PREFIX
    data[1] = VialCommand.UnlockStart; // 0x06
    await this.sendReport(data);
    await this.waitForReport(); // ACK
  }

  // Reference: keyboard_comm.py line 462
  async unlockPoll(): Promise<{ unlocked: number; unlockCounterMax: number; unlockCounter: number }> {
    const data = new Uint8Array(32);
    data[0] = 0xFE; // CMD_VIA_VIAL_PREFIX
    data[1] = VialCommand.UnlockPoll; // 0x07
    await this.sendReport(data);
    const resp = await this.waitForReport();
    return {
      unlocked: resp[0],
      unlockCounterMax: resp[1],
      unlockCounter: resp[2]
    };
  }

  // Reference: keyboard_comm.py line 455
  async lock(): Promise<void> {
    const data = new Uint8Array(32);
    data[0] = 0xFE; // CMD_VIA_VIAL_PREFIX
    data[1] = VialCommand.Lock; // 0x08
    await this.sendReport(data);
    await this.waitForReport(); // ACK
  }

  // Reference: keyboard_comm.py line 469
  async getUnlockKeys(): Promise<{ row: number; col: number }[]> {
    const data = new Uint8Array(32);
    data[0] = 0xFE; // CMD_VIA_VIAL_PREFIX
    data[1] = VialCommand.GetUnlockStatus; // 0x05
    await this.sendReport(data);
    const resp = await this.waitForReport();
    
    const keys: { row: number; col: number }[] = [];
    for (let x = 0; x < 15; x++) {
      const row = resp[2 + x * 2];
      const col = resp[3 + x * 2];
      if (row !== 255 && col !== 255) {
        keys.push({ row, col });
      }
    }
    return keys;
  }

  // Reference: keyboard_comm.py line 126 — keyboard_id = uint64 LE at data[4:12]
  async getKeyboardId(): Promise<bigint> {
    const data = new Uint8Array(32);
    data[0] = 0xFE;
    data[1] = VialCommand.GetKeyboardId;
    await this.sendReport(data);
    const resp = await this.waitForReport();
    
    const view = new DataView(resp.buffer, resp.byteOffset, resp.byteLength);
    return view.getBigUint64(4, true);
  }

  // Reference: keyboard_comm.py line 130 — struct.unpack("<I", data[0:4])
  async getDefinitionSize(): Promise<number> {
    const data = new Uint8Array(32);
    data[0] = 0xFE;
    data[1] = VialCommand.GetSize;
    await this.sendReport(data);
    const resp = await this.waitForReport();
    console.log('Vial GetSize Raw:', Array.from(resp.slice(0, 8)));
    
    // uint32 LE at data[0:4]
    const view = new DataView(resp.buffer, resp.byteOffset, resp.byteLength);
    return view.getUint32(0, true);
  }

  // Reference: keyboard_comm.py line 228 — struct.unpack(">I", data[2:6])
  async getLayoutOptions(): Promise<number> {
    const data = new Uint8Array(32);
    data[0] = 0x02; // CMD_VIA_GET_KEYBOARD_VALUE
    data[1] = 0x02; // VIA_LAYOUT_OPTIONS
    
    console.log('Vial: Fetching Layout Options bitmask...');
    await this.sendReport(data);
    const resp = await this.waitForReport();
    
    // uint32 BE at data[2:6]
    const view = new DataView(resp.buffer, resp.byteOffset, resp.byteLength);
    const val = view.getUint32(2, false);
    console.log('Vial: Layout Options bitmask received:', val);
    return val;
  }

  async setLayoutOptions(value: number): Promise<void> {
    const data = new Uint8Array(32);
    data[0] = 0x03; // CMD_VIA_SET_KEYBOARD_VALUE
    data[1] = 0x02; // VIA_LAYOUT_OPTIONS
    
    data[2] = (value >>> 24) & 0xFF;
    data[3] = (value >>> 16) & 0xFF;
    data[4] = (value >>> 8) & 0xFF;
    data[5] = value & 0xFF;
    
    console.log(`Vial: Sending Layout Options mask: 0x${(value >>> 0).toString(16).toUpperCase()}`);
    
    if (typeof window !== 'undefined' && (window as any).setAppDebug) {
      (window as any).setAppDebug({
        type: 'vial_send',
        cmd: 'setLayoutOptions',
        mask: `0x${(value >>> 0).toString(16).toUpperCase()}`
      });
    }

    await this.sendReport(data);
    await this.waitForReport(); // ACK
  }

  // Reference: keyboard_comm.py line 206 — data[4:4+sz]
  async getKeymapBuffer(offset: number, length: number): Promise<Uint8Array> {
    const data = new Uint8Array(32);
    data[0] = 0x12; // CMD_VIA_KEYMAP_GET_BUFFER
    data[1] = (offset >> 8) & 0xFF;
    data[2] = offset & 0xFF;
    data[3] = length;
    
    await this.sendReport(data);
    const resp = await this.waitForReport();
    
    // Reference always reads from data[4:4+sz]
    return resp.slice(4, 4 + length);
  }

  // Reference: keyboard_comm.py lines 133-142 — entire response is payload
  async getDefinition(): Promise<any> {
    const size = await this.getDefinitionSize();
    console.log('Vial Definition Size:', size);
    if (size <= 0 || size > 65536) {
      throw new Error(`Invalid definition size: ${size}`);
    }
    
    let remaining = size;
    const payload = new Uint8Array(size);

    console.log(`Vial: Starting fetch of ${size} bytes in 32-byte chunks...`);

    let blockIndex = 0;
    while (remaining > 0) {
      const data = new Uint8Array(32);
      data[0] = 0xFE;
      data[1] = VialCommand.GetDef;
      data[2] = blockIndex & 0xFF;
      data[3] = (blockIndex >> 8) & 0xFF;
      data[4] = (blockIndex >> 16) & 0xFF;
      data[5] = (blockIndex >> 24) & 0xFF;
      
      await this.sendReport(data);
      const resp = await this.waitForReport();
      
      // Reference: entire response is payload data (no header)
      const chunkSize = Math.min(remaining, 32);
      payload.set(resp.slice(0, chunkSize), blockIndex * 32);
      
      remaining -= chunkSize;
      blockIndex++;
    }

    console.log(`Vial: Concatenated payload size: ${payload.length} bytes.`);

    try {
      const blob = new Blob([payload]);
      const decompressedStream = new XzReadableStream(blob.stream());
      const reader = decompressedStream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const decompressed = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
      let pos = 0;
      for (const c of chunks) {
        decompressed.set(c, pos);
        pos += c.length;
      }
      
      console.log('Vial: Decoding decompressed JSON...');
      const jsonStr = new TextDecoder().decode(decompressed);
      console.log('Vial: JSON string length:', jsonStr.length);
      const vialJson = JSON.parse(jsonStr);
      console.log('Vial: JSON parse successful.');
      return vialJson;
    } catch (err) {
      console.error('Vial: Decompression or Parse failed:', err);
      throw err;
    }
  }

  // --- Macros Protocol Support ---
  // Reference: macro.py line 142-143 — data[1]
  async getMacrosCount(): Promise<number> {
    const data = new Uint8Array(32);
    data[0] = 0x0C; // CMD_VIA_MACRO_GET_COUNT
    await this.sendReport(data);
    const resp = await this.waitForReport();
    return resp[1];
  }

  // Reference: macro.py line 144-145 — struct.unpack(">H", data[1:3])
  async getMacroMemorySize(): Promise<number> {
    const data = new Uint8Array(32);
    data[0] = 0x0D; // CMD_VIA_MACRO_GET_BUFFER_SIZE
    await this.sendReport(data);
    const resp = await this.waitForReport();
    return (resp[1] << 8) | resp[2];
  }

  // Reference: macro.py line 154 — data[4:4+sz]
  async getMacrosBuffer(memorySize: number, macroCount: number): Promise<Uint8Array> {
    let macroBuffer = new Uint8Array(0);
    const BUFFER_FETCH_CHUNK = 28;
    
    for (let x = 0; x < memorySize; x += BUFFER_FETCH_CHUNK) {
      const sz = Math.min(BUFFER_FETCH_CHUNK, memorySize - x);
      const data = new Uint8Array(32);
      data[0] = 0x0E; // CMD_VIA_MACRO_GET_BUFFER
      data[1] = (x >> 8) & 0xFF;
      data[2] = x & 0xFF;
      data[3] = sz;
      
      await this.sendReport(data);
      const resp = await this.waitForReport();
      
      // Reference: always data[4:4+sz]
      const newChunk = resp.slice(4, 4 + sz);
      const temp = new Uint8Array(macroBuffer.length + newChunk.length);
      temp.set(macroBuffer, 0);
      temp.set(newChunk, macroBuffer.length);
      macroBuffer = temp;
      
      // Count NULs to break early if we have retrieved all expected macros
      let nulCount = 0;
      for (let i = 0; i < macroBuffer.length; i++) {
        if (macroBuffer[i] === 0) nulCount++;
      }
      if (nulCount >= macroCount) {
        break;
      }
    }
    
    return macroBuffer;
  }

  // Reference: macro.py line 174 — same format as GET
  async setMacrosBuffer(buffer: Uint8Array, memorySize: number): Promise<void> {
    if (buffer.length > memorySize) {
      throw new Error(`Macro is too big: got ${buffer.length} bytes, max memory is ${memorySize} bytes`);
    }
    
    const BUFFER_FETCH_CHUNK = 28;
    for (let x = 0; x < buffer.length; x += BUFFER_FETCH_CHUNK) {
      const chunk = buffer.slice(x, x + BUFFER_FETCH_CHUNK);
      const data = new Uint8Array(32);
      data[0] = 0x0F; // CMD_VIA_MACRO_SET_BUFFER
      data[1] = (x >> 8) & 0xFF;
      data[2] = x & 0xFF;
      data[3] = chunk.length;
      data.set(chunk, 4);
      
      await this.sendReport(data);
      await this.waitForReport(); // ACK
    }
  }

  // --- Combos Protocol Support (Dynamic Entries) ---
  // Reference: dynamic.py — response data starts at data[0] for Vial commands
  async getDynamicEntriesCount(): Promise<{ tapDance: number; combos: number; keyOverrides: number }> {
    const data = new Uint8Array(32);
    data[0] = 0xFE; // CMD_VIA_VIAL_PREFIX
    data[1] = 0x0D; // CMD_VIAL_DYNAMIC_ENTRY_OP
    data[2] = 0x00; // DYNAMIC_VIAL_GET_NUMBER_OF_ENTRIES
    
    await this.sendReport(data);
    const resp = await this.waitForReport();
    
    return {
      tapDance: resp[0] || 0,
      combos: resp[1] || 0,
      keyOverrides: resp[2] || 0
    };
  }

  // Reference: combo.py — response keycodes start at data[0]
  async getCombos(count: number): Promise<ComboEntry[]> {
    const combos: ComboEntry[] = [];
    for (let i = 0; i < count; i++) {
      const data = new Uint8Array(32);
      data[0] = 0xFE;
      data[1] = 0x0D;
      data[2] = 0x03; // DYNAMIC_VIAL_COMBO_GET
      data[3] = i;
      
      await this.sendReport(data);
      const resp = await this.waitForReport();
      
      // Vial command response: data starts at [0], no prefix echo
      const view = new DataView(resp.buffer, resp.byteOffset);
      const k1 = view.getUint16(0, true);
      const k2 = view.getUint16(2, true);
      const k3 = view.getUint16(4, true);
      const k4 = view.getUint16(6, true);
      const out = view.getUint16(8, true);
      
      const inputs = [
        vialCodeToAction(k1),
        vialCodeToAction(k2),
        vialCodeToAction(k3),
        vialCodeToAction(k4)
      ].filter(act => act.action !== 'none');

      combos.push({
        inputs,
        output: vialCodeToAction(out)
      });
    }
    return combos;
  }

  async setCombo(idx: number, combo: ComboEntry): Promise<void> {
    const data = new Uint8Array(32);
    data[0] = 0xFE;
    data[1] = 0x0D;
    data[2] = 0x04; // DYNAMIC_VIAL_COMBO_SET
    data[3] = idx;
    
    const view = new DataView(data.buffer, data.byteOffset);
    view.setUint16(4, actionToVialCode(combo.inputs[0] || { action: 'none' }), true);
    view.setUint16(6, actionToVialCode(combo.inputs[1] || { action: 'none' }), true);
    view.setUint16(8, actionToVialCode(combo.inputs[2] || { action: 'none' }), true);
    view.setUint16(10, actionToVialCode(combo.inputs[3] || { action: 'none' }), true);
    view.setUint16(12, actionToVialCode(combo.output), true);
    
    await this.sendReport(data);
    await this.waitForReport(); // ACK
  }

  async getTapDances(count: number): Promise<TapDanceEntry[]> {
    const tapDances: TapDanceEntry[] = [];
    for (let i = 0; i < count; i++) {
      const data = new Uint8Array(32);
      data[0] = 0xFE;
      data[1] = 0x0D;
      data[2] = 0x01; // DYNAMIC_VIAL_TAP_DANCE_GET
      data[3] = i;

      await this.sendReport(data);
      const resp = await this.waitForReport();

      if (resp[0] !== 0) {
        throw new Error(`Failed to read Vial Tap Dance ${i}: status ${resp[0]}`);
      }

      const view = new DataView(resp.buffer, resp.byteOffset + 1, resp.byteLength - 1);
      const tap = view.getUint16(0, true);
      const hold = view.getUint16(2, true);
      const doubleTap = view.getUint16(4, true);
      const tapHold = view.getUint16(6, true);

      tapDances.push({
        id: i,
        tapAction: vialCodeToAction(tap),
        holdAction: vialCodeToAction(hold),
        doubleTapAction: vialCodeToAction(doubleTap),
        tapHoldAction: vialCodeToAction(tapHold),
        tappingTerm: view.getUint16(8, true)
      });
    }
    return tapDances;
  }

  async setTapDance(idx: number, tapDance: TapDanceEntry): Promise<void> {
    const data = new Uint8Array(32);
    data[0] = 0xFE;
    data[1] = 0x0D;
    data[2] = 0x02; // DYNAMIC_VIAL_TAP_DANCE_SET
    data[3] = idx;

    const view = new DataView(data.buffer, data.byteOffset);
    view.setUint16(4, actionToVialCode(tapDance.tapAction || { action: 'none' }), true);
    view.setUint16(6, actionToVialCode(tapDance.holdAction || { action: 'none' }), true);
    view.setUint16(8, actionToVialCode(tapDance.doubleTapAction || { action: 'none' }), true);
    view.setUint16(10, actionToVialCode(tapDance.tapHoldAction || { action: 'none' }), true);
    view.setUint16(12, tapDance.tappingTerm ?? 200, true);

    await this.sendReport(data);
    await this.waitForReport(); // ACK
  }
}
