/**
 * VIA Protocol Implementation
 * 
 * Response parsing follows the Vial reference implementation (keyboard_comm.py):
 * - No response filtering — first report is always the response
 * - Fixed offsets for data extraction (command echo at data[0], payload follows)
 */
import { IProtocolDriver, ITransport, DeviceCapability } from '../transport/types';
import { UniversalAction } from '@/types/actions';
import { viaCodeToAction, actionToViaCode } from './via-action-converter';

export enum ViaCommand {
  GetProtocolVersion = 0x01,
  GetKeyboardDefinition = 0x02,
  GetDeviceSignature = 0x03,
  
  DynamicKeymapGetLayerCount = 0x11,
  DynamicKeymapGetBuffer = 0x12,
  DynamicKeymapGetKeycode = 0x04,
  DynamicKeymapSetKeycode = 0x05,
  
  DynamicKeymapReset = 0x14,
  
  LightingGetMode = 0x41,
  LightingSetMode = 0x42,
}

export class ViaProtocol implements IProtocolDriver {
  protected transport: ITransport | null = null;
  public capabilities: DeviceCapability = {
    hasTapDance: false,
    hasMacros: false,
    hasCombos: false,
    hasMouseKeys: false,
    hasLighting: false,
    hasRotaryEncoder: false
  };

  constructor() {}

  // Agnostic initialization with capability discovery handshake
  async initialize(transport: ITransport): Promise<boolean> {
    this.transport = transport;
    try {
      const version = await this.getProtocolVersion();
      console.log(`[VIA Handshake] Device connected. Protocol version: 0x${version.toString(16)}`);
      
      // Standard VIA capabilities
      this.capabilities = {
        hasTapDance: false,
        hasMacros: true,
        hasCombos: false,
        hasMouseKeys: false,
        hasLighting: true,
        hasRotaryEncoder: false
      };
      return true;
    } catch (err) {
      console.error('VIA Handshake Failed:', err);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
    }
  }

  protected async sendReport(data: Uint8Array): Promise<void> {
    if (!this.transport) throw new Error('Transport not bound');
    await this.transport.send(data);
  }

  protected async waitForReport(): Promise<Uint8Array> {
    if (!this.transport) throw new Error('Transport not bound');
    return await this.transport.receive();
  }

  // IProtocolDriver key access contracts with automatic translation
  async getKey(layer: number, row: number, col: number): Promise<UniversalAction> {
    const rawCode = await this.getKeycode(layer, row, col);
    return viaCodeToAction(rawCode);
  }

  async setKey(layer: number, row: number, col: number, action: UniversalAction): Promise<void> {
    const rawCode = actionToViaCode(action);
    await this.setKeycode(layer, row, col, rawCode);
  }

  // Reference: data[1:3] big-endian uint16
  async getProtocolVersion(): Promise<number> {
    const data = new Uint8Array(32);
    data[0] = ViaCommand.GetProtocolVersion;
    await this.sendReport(data);
    const resp = await this.waitForReport();
    return (resp[1] << 8) | resp[2];
  }

  // Reference: data[1]
  async getLayerCount(): Promise<number> {
    const data = new Uint8Array(32);
    data[0] = ViaCommand.DynamicKeymapGetLayerCount;
    await this.sendReport(data);
    const resp = await this.waitForReport();
    return resp[1];
  }

  // Reference: data[4:6] big-endian uint16
  async getKeycode(layer: number, row: number, col: number): Promise<number> {
    const data = new Uint8Array(32);
    data[0] = ViaCommand.DynamicKeymapGetKeycode;
    data[1] = layer;
    data[2] = row;
    data[3] = col;
    await this.sendReport(data);
    const resp = await this.waitForReport();
    return (resp[4] << 8) | resp[5];
  }

  async setKeycode(layer: number, row: number, col: number, keycode: number): Promise<void> {
    const data = new Uint8Array(32);
    data[0] = ViaCommand.DynamicKeymapSetKeycode;
    data[1] = layer;
    data[2] = row;
    data[3] = col;
    data[4] = (keycode >> 8) & 0xFF;
    data[5] = keycode & 0xFF;
    
    console.log(`[VIA Telegram Write]`, Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '));
    await this.sendReport(data);
    await this.waitForReport(); // ACK
  }

  async getKeymapBuffer(offset: number, length: number): Promise<Uint8Array> {
    const data = new Uint8Array(32);
    data[0] = ViaCommand.DynamicKeymapGetBuffer;
    data[1] = (offset >> 8) & 0xFF;
    data[2] = offset & 0xFF;
    data[3] = length;

    await this.sendReport(data);
    const resp = await this.waitForReport();
    return resp.slice(4, 4 + length);
  }
}
