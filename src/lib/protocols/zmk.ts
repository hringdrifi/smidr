import { IProtocolDriver, DeviceCapability, ITransport } from '../transport/types';
import { UniversalAction } from '@/types/actions';
import { actionToZmkString, zmkStringToAction } from './zmk-action-converter';

export function framePayload(payload: Uint8Array): Uint8Array {
  const result: number[] = [];
  result.push(0xAB); // SoF
  for (let i = 0; i < payload.length; i++) {
    const byte = payload[i];
    if (byte === 0xAB || byte === 0xAC || byte === 0xAD) {
      result.push(0xAC); // Esc
    }
    result.push(byte);
  }
  result.push(0xAD); // EoF
  return new Uint8Array(result);
}

export function tryExtractFrame(buffer: number[]): { payload: Uint8Array, consumedCount: number } | null {
  const sofIdx = buffer.indexOf(0xAB);
  if (sofIdx === -1) {
    // Discard leading garbage before first SoF to keep buffer clean
    buffer.splice(0, buffer.length);
    return null;
  }
  
  if (sofIdx > 0) {
    buffer.splice(0, sofIdx);
  }
  
  let isEscaped = false;
  for (let i = 1; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte === 0xAD && !isEscaped) {
      const unframed: number[] = [];
      let tempEscaped = false;
      for (let j = 1; j < i; j++) {
        const b = buffer[j];
        if (b === 0xAC && !tempEscaped) {
          tempEscaped = true;
          continue;
        }
        unframed.push(b);
        tempEscaped = false;
      }
      
      const payload = new Uint8Array(unframed);
      const consumedCount = i + 1;
      return { payload, consumedCount };
    }
    
    if (byte === 0xAC && !isEscaped) {
      isEscaped = true;
    } else {
      isEscaped = false;
    }
  }
  
  return null;
}

export function encodeVarint(value: number): number[] {
  const result: number[] = [];
  let temp = Math.floor(value);
  while (temp >= 0x80) {
    result.push((temp & 0x7F) | 0x80);
    temp = temp >>> 7;
  }
  result.push(temp & 0x7F);
  return result;
}

/**
 * ZmkSerialTransport handles physical Web Serial communication (CDC ACM) for ZMK Studio.
 */
export class ZmkSerialTransport implements ITransport {
  public isConnected: boolean = false;
  private port: any = null;
  private rxBuffer: number[] = [];
  private receiveQueue: Uint8Array[] = [];
  private pendingResolvers: { resolve: (data: Uint8Array) => void; filter?: (data: Uint8Array) => boolean }[] = [];
  private keepReading: boolean = false;
  private readerPromise: Promise<void> | null = null;
  private activeReader: any = null;

  async connect(port?: any): Promise<boolean> {
    try {
      if (port) {
        this.port = port;
      } else {
        this.port = await (navigator as any).serial.requestPort({
          filters: [{ usbVendorId: 0x1D50, usbProductId: 0x615E }] // Standard ZMK USB CDC ACM VID/PID
        });
      }
      if (!this.port) return false;

      await this.port.open({ baudRate: 115200 });
      this.isConnected = true;
      this.rxBuffer = [];
      this.receiveQueue = [];
      this.pendingResolvers = [];
      this.keepReading = true;
      this.readerPromise = this.startReadLoop();
      console.log('ZMK Serial Transport Connected');
      return true;
    } catch (err) {
      console.error('ZMK Serial Connection failed:', err);
      this.isConnected = false;
      return false;
    }
  }

  private async startReadLoop(): Promise<void> {
    while (this.keepReading && this.port && this.port.readable) {
      try {
        this.activeReader = this.port.readable.getReader();
        try {
          while (this.keepReading) {
            const { value, done } = await this.activeReader.read();
            if (done) break;
            if (value) {
              for (let i = 0; i < value.length; i++) {
                this.rxBuffer.push(value[i]);
              }
              this.processAccumulatedFrames();
            }
          }
        } finally {
          this.activeReader.releaseLock();
          this.activeReader = null;
        }
      } catch (err) {
        if (this.keepReading) {
          console.error('Serial read loop error:', err);
        }
        break;
      }
    }
  }

  private processAccumulatedFrames() {
    while (true) {
      const extracted = tryExtractFrame(this.rxBuffer);
      if (!extracted) break;
      
      this.rxBuffer.splice(0, extracted.consumedCount);
      const payload = extracted.payload;
      
      const resolverIndex = this.pendingResolvers.findIndex(r => !r.filter || r.filter(payload));
      if (resolverIndex !== -1) {
        const { resolve } = this.pendingResolvers[resolverIndex];
        this.pendingResolvers.splice(resolverIndex, 1);
        resolve(payload);
      } else {
        this.receiveQueue.push(payload);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.keepReading = false;
    
    if (this.activeReader) {
      try {
        await this.activeReader.cancel();
      } catch (e) {
        console.warn('Failed to cancel active serial reader:', e);
      }
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {
        console.warn('Serial port close error:', e);
      }
      this.port = null;
    }
    this.rxBuffer = [];
    this.receiveQueue = [];
    this.pendingResolvers = [];
    this.isConnected = false;
    console.log('ZMK Serial Transport Disconnected');
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.port || !this.port.writable) throw new Error('Device not connected');
    const framed = framePayload(data);
    const writer = this.port.writable.getWriter();
    await writer.write(framed);
    writer.releaseLock();
  }

  async receive(filter?: (data: Uint8Array) => boolean): Promise<Uint8Array> {
    if (!this.port) throw new Error('Device not connected');
    
    // First, check the queue for any matching message
    if (filter) {
      const index = this.receiveQueue.findIndex(filter);
      if (index !== -1) {
        const data = this.receiveQueue[index];
        this.receiveQueue.splice(index, 1);
        return data;
      }
    } else if (this.receiveQueue.length > 0) {
      return this.receiveQueue.shift()!;
    }

    // If no matching message is in the queue, wait with a 3-second timeout
    return new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.pendingResolvers.findIndex(r => r.resolve === resolveAndClear);
        if (idx !== -1) {
          this.pendingResolvers.splice(idx, 1);
        }
        reject(new Error('ZMK Serial Receive Timeout'));
      }, 3000);

      const resolveAndClear = (data: Uint8Array) => {
        clearTimeout(timeout);
        resolve(data);
      };

      this.pendingResolvers.push({ resolve: resolveAndClear, filter });
    });
  }
}

/**
 * ZmkBleTransport handles physical WebBLE communication for ZMK Studio.
 */
export class ZmkBleTransport implements ITransport {
  public isConnected: boolean = false;
  private device: any = null;
  private rxCharacteristic: any = null;
  private txCharacteristic: any = null;
  private rxBuffer: number[] = [];
  private receiveQueue: Uint8Array[] = [];
  private pendingResolvers: { resolve: (data: Uint8Array) => void; filter?: (data: Uint8Array) => boolean }[] = [];

  private handleNotification = (event: any) => {
    const value = event.target.value;
    const data = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    
    // Accumulate in BLE receive buffer
    for (let i = 0; i < data.length; i++) {
      this.rxBuffer.push(data[i]);
    }
    
    // Process accumulated buffer and extract complete frames
    this.processAccumulatedFrames();
  };

  private processAccumulatedFrames() {
    while (true) {
      const extracted = tryExtractFrame(this.rxBuffer);
      if (!extracted) break;
      
      this.rxBuffer.splice(0, extracted.consumedCount);
      const payload = extracted.payload;
      
      const resolverIndex = this.pendingResolvers.findIndex(r => !r.filter || r.filter(payload));
      if (resolverIndex !== -1) {
        const { resolve } = this.pendingResolvers[resolverIndex];
        this.pendingResolvers.splice(resolverIndex, 1);
        resolve(payload);
      } else {
        this.receiveQueue.push(payload);
      }
    }
  }

  async connect(device?: any): Promise<boolean> {
    try {
      if (device) {
        this.device = device;
      } else {
        this.device = await (navigator as any).bluetooth.requestDevice({
          filters: [{ services: ['00000000-0196-6107-c967-c5cfb1c2482a'] }]
        });
      }
      if (!this.device || !this.device.gatt) return false;

      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService('00000000-0196-6107-c967-c5cfb1c2482a');
      const characteristic = await service.getCharacteristic('00000001-0196-6107-c967-c5cfb1c2482a');
      this.txCharacteristic = characteristic;
      this.rxCharacteristic = characteristic;

      // Subscribe to GATT indications/notifications
      await this.rxCharacteristic.startNotifications();
      this.rxCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotification);
      
      this.isConnected = true;
      this.rxBuffer = [];
      this.receiveQueue = [];
      console.log('ZMK WebBLE Transport Connected');
      return true;
    } catch (err) {
      console.error('ZMK WebBLE Connection failed:', err);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.rxCharacteristic) {
      try {
        this.rxCharacteristic.removeEventListener('characteristicvaluechanged', this.handleNotification);
        if (this.device && this.device.gatt?.connected) {
          await this.rxCharacteristic.stopNotifications();
        }
      } catch (e) {
        console.warn('Error stopping BLE notifications:', e);
      }
    }
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.rxBuffer = [];
    this.receiveQueue = [];
    this.pendingResolvers = [];
    this.isConnected = false;
    console.log('ZMK WebBLE Transport Disconnected');
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.txCharacteristic) throw new Error('Device not connected');
    const framed = framePayload(data);
    await this.txCharacteristic.writeValueWithoutResponse(framed);
  }

  async receive(filter?: (data: Uint8Array) => boolean): Promise<Uint8Array> {
    if (!this.rxCharacteristic) throw new Error('Device not connected');
    
    // First, check the queue for any matching message
    if (filter) {
      const index = this.receiveQueue.findIndex(filter);
      if (index !== -1) {
        const data = this.receiveQueue[index];
        this.receiveQueue.splice(index, 1);
        return data; // already unframed by tryExtractFrame
      }
    } else if (this.receiveQueue.length > 0) {
      return this.receiveQueue.shift()!; // already unframed by tryExtractFrame
    }

    // If no matching message is in the queue, wait with a 3-second timeout
    return new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.pendingResolvers.findIndex(r => r.resolve === resolveAndClear);
        if (idx !== -1) {
          this.pendingResolvers.splice(idx, 1);
        }
        reject(new Error('ZMK BLE Receive Timeout'));
      }, 3000);

      const resolveAndClear = (data: Uint8Array) => {
        clearTimeout(timeout);
        resolve(data);
      };

      this.pendingResolvers.push({ resolve: resolveAndClear, filter });
    });
  }
}

/**
 * Conforming ZMK Protocol Driver implementation.
 */
export class ZmkProtocol implements IProtocolDriver {
  public capabilities: DeviceCapability = {
    hasTapDance: false, // ZMK does not natively use standard VIA/Vial Tap Dance
    hasMacros: true,
    hasCombos: true,
    hasMouseKeys: true,
    hasLighting: true,
    hasRotaryEncoder: true
  };

  private transport: ITransport | null = null;
  // Simulates ZMK's persistent onboard flash keymap memory
  private simulatedKeymap: Record<number, Record<number, Record<number, UniversalAction>>> = {};

  constructor() {
    this.initializeDefaultSimulatedKeymap();
  }

  private initializeDefaultSimulatedKeymap() {
    // Populate some cool default keys in layers 0 and 1
    const layers = [0, 1, 2];
    layers.forEach(l => {
      this.simulatedKeymap[l] = {};
      for (let r = 0; r < 6; r++) {
        this.simulatedKeymap[l][r] = {};
        for (let c = 0; c < 32; c++) {
          if (l === 0) {
            if (r === 2 && c === 4) {
              this.simulatedKeymap[l][r][c] = { action: 'tap', keycode: 'A' };
            } else if (r === 2 && c === 5) {
              this.simulatedKeymap[l][r][c] = { action: 'tap', keycode: 'B' };
            } else if (r === 3 && c === 8) {
              this.simulatedKeymap[l][r][c] = { 
                action: 'lt', 
                layerId: 1, 
                tapAction: { action: 'tap', keycode: 'SPC' } 
              };
            } else {
              this.simulatedKeymap[l][r][c] = { action: 'trans' };
            }
          } else {
            this.simulatedKeymap[l][r][c] = { action: 'trans' };
          }
        }
      }
    });
  }

  async initialize(transport: ITransport): Promise<boolean> {
    this.transport = transport;
    console.log('ZMK Protocol Driver Initialized with Transport Capabilities:', this.capabilities);
    return true;
  }

  async getLayerCount(): Promise<number> {
    return 3; // Simulates a ZMK keymap with 3 active layers
  }

  async getKey(layer: number, row: number, col: number): Promise<UniversalAction> {
    if (this.transport) {
      try {
        // Conforming ZMK Studio Protobuf RPC GetKeymapRequest wrapper structure:
        // Request Wrapper: field 1 (id) = 1, field 2 (get_keymap submessage)
        const submessageList: number[] = [];
        
        // Field 1: layer index (tag 1, varint)
        submessageList.push(0x08);
        submessageList.push(...encodeVarint(layer));
        
        // Field 2: key position index (tag 2, varint)
        const keyPos = (row << 8) | col;
        submessageList.push(0x10);
        submessageList.push(...encodeVarint(keyPos));
        
        const submessageBytes = new Uint8Array(submessageList);

        const getRpcMsg = new Uint8Array([
          0x08, 0x01, // Request ID: 1 (tag 1, value 1)
          0x12, ...encodeVarint(submessageBytes.length), // GetKeymapRequest submessage tag (0x12) and length varint
          ...submessageBytes
        ]);

        console.log(`[ZMK Protobuf RPC Read] Request -> Layer:${layer} Row:${row} Col:${col}`);
        await this.transport.send(getRpcMsg);

        // Receive response payload containing UTF-8 encoded DTS path
        const responseData = await this.transport.receive();
        
        // ZMK Protobuf dynamic keymap response contains:
        // Tag 0x1a (length-delimited UTF-8 string for DTS representation)
        // Let's parse the string from the response payload
        let dtsStr = '&trans'; // default fallback
        
        for (let i = 0; i < responseData.length - 1; i++) {
          if (responseData[i] === 0x1a) {
            const len = responseData[i + 1];
            if (i + 2 + len <= responseData.length) {
              const strBytes = responseData.slice(i + 2, i + 2 + len);
              dtsStr = new TextDecoder().decode(strBytes);
              break;
            }
          }
        }

        console.log(`[ZMK Protobuf RPC Read] Response -> Layer:${layer} Row:${row} Col:${col} -> DTS:"${dtsStr}"`);
        const action = zmkStringToAction(dtsStr);
        
        // Keep our simulatedKeymap in sync for local state consistency
        if (!this.simulatedKeymap[layer]) this.simulatedKeymap[layer] = {};
        if (!this.simulatedKeymap[layer][row]) this.simulatedKeymap[layer][row] = {};
        this.simulatedKeymap[layer][row][col] = action;

        return action;
      } catch (err) {
        console.error(`[ZMK Protobuf RPC Read Error] Failed to read Layer:${layer} Row:${row} Col:${col}:`, err);
        throw err; // Proactively throw during real active transport remap mode
      }
    }

    // Fallback to local simulated keymap ONLY when not physically connected
    const action = this.simulatedKeymap[layer]?.[row]?.[col];
    if (action) return action;
    return { action: 'trans' };
  }

  async setKey(layer: number, row: number, col: number, action: UniversalAction): Promise<void> {
    if (this.transport) {
      try {
        const zmkDtsStr = actionToZmkString(action);
        
        // Conforming ZMK Studio Protobuf RPC SetBehaviorInKeymapRequest structure:
        const submessageList: number[] = [];
        
        // Field 1: layer index (tag 1, varint)
        submessageList.push(0x08);
        submessageList.push(...encodeVarint(layer));
        
        // Field 2: key position index (tag 2, varint)
        const keyPos = (row << 8) | col;
        submessageList.push(0x10);
        submessageList.push(...encodeVarint(keyPos));
        
        // Field 3: behavior binding string (tag 3, length-delimited)
        const dtsBytes = new TextEncoder().encode(zmkDtsStr);
        submessageList.push(0x1a);
        submessageList.push(...encodeVarint(dtsBytes.length));
        for (let i = 0; i < dtsBytes.length; i++) {
          submessageList.push(dtsBytes[i]);
        }
        
        const submessageBytes = new Uint8Array(submessageList);

        const rpcMsg = new Uint8Array([
          0x08, 0x01, // Request ID: 1 (tag 1, value 1)
          0x1a, ...encodeVarint(submessageBytes.length), // SetBehaviorInKeymapRequest field tag (0x1a) and length varint
          ...submessageBytes
        ]);

        console.log(`[ZMK Protobuf RPC Write] Layer:${layer} Row:${row} Col:${col} -> DTS:"${zmkDtsStr}"`, {
          serializedHex: Array.from(rpcMsg).map(b => b.toString(16).padStart(2, '0')).join(' ')
        });

        await this.transport.send(rpcMsg);
        // Wait for RPC ACK response
        await this.transport.receive();

        // Update local state ONLY after successful ACK from physical hardware
        if (!this.simulatedKeymap[layer]) this.simulatedKeymap[layer] = {};
        if (!this.simulatedKeymap[layer][row]) this.simulatedKeymap[layer][row] = {};
        this.simulatedKeymap[layer][row][col] = action;
      } catch (err) {
        console.error(`[ZMK Protobuf RPC Write Error] Failed to write Layer:${layer} Row:${row} Col:${col}:`, err);
        throw err;
      }
    } else {
      // Offline mode: update simulated keymap immediately
      if (!this.simulatedKeymap[layer]) this.simulatedKeymap[layer] = {};
      if (!this.simulatedKeymap[layer][row]) this.simulatedKeymap[layer][row] = {};
      this.simulatedKeymap[layer][row][col] = action;
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }
    console.log('ZMK Protocol Driver Disconnected');
  }
}

export const zmkProtocol = new ZmkProtocol();
