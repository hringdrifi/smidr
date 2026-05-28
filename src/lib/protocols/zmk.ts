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

const ZMK_STUDIO_LOCK_STATE_UNLOCKED = 1;
const ZMK_BLE_WRITE_CHUNK_SIZE = 20;

const isZmkStudioLocked = (lockState: number) => lockState !== ZMK_STUDIO_LOCK_STATE_UNLOCKED;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  private disconnectCallback: (() => void) | null = null;
  private disconnectNotified = false;

  private handleSerialDisconnect = (event: any) => {
    if (event.target && this.port && event.target !== this.port) return;
    this.handleUnexpectedDisconnect();
  };

  private handleUnexpectedDisconnect() {
    if (this.disconnectNotified) return;
    this.disconnectNotified = true;
    this.keepReading = false;
    this.port = null;
    this.rxBuffer = [];
    this.receiveQueue = [];
    this.pendingResolvers = [];
    this.isConnected = false;
    this.disconnectCallback?.();
  }

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
      this.disconnectNotified = false;
      (navigator as any).serial?.removeEventListener?.('disconnect', this.handleSerialDisconnect);
      (navigator as any).serial?.addEventListener?.('disconnect', this.handleSerialDisconnect);
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
    if (this.keepReading) {
      this.handleUnexpectedDisconnect();
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
    this.disconnectNotified = true;
    (navigator as any).serial?.removeEventListener?.('disconnect', this.handleSerialDisconnect);
    
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

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.port || !this.port.writable) throw new Error('Device not connected');
    const framed = framePayload(data);
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(framed);
    } finally {
      writer.releaseLock();
    }
  }

  async receive(filter?: (data: Uint8Array) => boolean, timeoutMs?: number): Promise<Uint8Array> {
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

    // If no matching message is in the queue, wait with a timeout
    const actualTimeout = timeoutMs || 3000;
    return new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.pendingResolvers.findIndex(r => r.resolve === resolveAndClear);
        if (idx !== -1) {
          this.pendingResolvers.splice(idx, 1);
        }
        reject(new Error('ZMK Serial Receive Timeout'));
      }, actualTimeout);

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
  private disconnectCallback: (() => void) | null = null;
  private disconnectNotified = false;

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

  private handleGattDisconnect = () => {
    this.handleUnexpectedDisconnect();
  };

  private handleUnexpectedDisconnect() {
    if (this.disconnectNotified) return;
    this.disconnectNotified = true;
    if (this.rxCharacteristic) {
      this.rxCharacteristic.removeEventListener?.('characteristicvaluechanged', this.handleNotification);
    }
    if (this.device) {
      this.device.removeEventListener?.('gattserverdisconnected', this.handleGattDisconnect);
    }
    this.device = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.rxBuffer = [];
    this.receiveQueue = [];
    this.pendingResolvers = [];
    this.isConnected = false;
    this.disconnectCallback?.();
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
      this.device.removeEventListener?.('gattserverdisconnected', this.handleGattDisconnect);
      this.device.addEventListener?.('gattserverdisconnected', this.handleGattDisconnect);
      
      this.isConnected = true;
      this.disconnectNotified = false;
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
    this.disconnectNotified = true;
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
    if (this.device) {
      this.device.removeEventListener?.('gattserverdisconnected', this.handleGattDisconnect);
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

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.txCharacteristic) throw new Error('Device not connected');
    const framed = framePayload(data);
    for (let offset = 0; offset < framed.length; offset += ZMK_BLE_WRITE_CHUNK_SIZE) {
      const chunk = framed.slice(offset, offset + ZMK_BLE_WRITE_CHUNK_SIZE);
      await this.txCharacteristic.writeValueWithoutResponse(chunk);
    }
  }

  async receive(filter?: (data: Uint8Array) => boolean, timeoutMs?: number): Promise<Uint8Array> {
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

    // If no matching message is in the queue, wait with a timeout
    const actualTimeout = timeoutMs || 3000;
    return new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.pendingResolvers.findIndex(r => r.resolve === resolveAndClear);
        if (idx !== -1) {
          this.pendingResolvers.splice(idx, 1);
        }
        reject(new Error('ZMK BLE Receive Timeout'));
      }, actualTimeout);

      const resolveAndClear = (data: Uint8Array) => {
        clearTimeout(timeout);
        resolve(data);
      };

      this.pendingResolvers.push({ resolve: resolveAndClear, filter });
    });
  }
}

class ProtoDecoder {
  private buffer: Uint8Array;
  private pos: number = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
  }

  hasMore(): boolean {
    return this.pos < this.buffer.length;
  }

  readVarint(): number {
    let result = 0;
    let shift = 0;
    while (true) {
      if (this.pos >= this.buffer.length) {
        throw new Error("Varint exceeded buffer");
      }
      const byte = this.buffer[this.pos++];
      result |= (byte & 0x7F) << shift;
      if ((byte & 0x80) === 0) {
        break;
      }
      shift += 7;
    }
    return result;
  }

  readSint32(): number {
    const raw = this.readVarint();
    return (raw >>> 1) ^ -(raw & 1);
  }

  readBytes(): Uint8Array {
    const len = this.readVarint();
    if (this.pos + len > this.buffer.length) {
      throw new Error("Bytes length exceeded buffer");
    }
    const bytes = this.buffer.slice(this.pos, this.pos + len);
    this.pos += len;
    return bytes;
  }

  readString(): string {
    const bytes = this.readBytes();
    return new TextDecoder().decode(bytes);
  }

  skipType(wireType: number) {
    if (wireType === 0) {
      this.readVarint();
    } else if (wireType === 1) {
      this.pos += 8;
    } else if (wireType === 2) {
      const len = this.readVarint();
      this.pos += len;
    } else if (wireType === 5) {
      this.pos += 4;
    } else {
      throw new Error(`Unsupported wire type: ${wireType}`);
    }
  }

  readFields(): Array<{ fieldNumber: number; wireType: number; value: any }> {
    const fields: Array<{ fieldNumber: number; wireType: number; value: any }> = [];
    while (this.hasMore()) {
      const tag = this.readVarint();
      const fieldNumber = tag >>> 3;
      const wireType = tag & 7;
      let value: any;
      if (wireType === 0) {
        value = this.readVarint();
      } else if (wireType === 2) {
        value = this.readBytes();
      } else {
        this.skipType(wireType);
        continue;
      }
      fields.push({ fieldNumber, wireType, value });
    }
    return fields;
  }
}

class ProtoEncoder {
  private bytes: number[] = [];

  writeVarint(value: number) {
    let temp = Math.floor(value);
    while (temp >= 0x80) {
      this.bytes.push((temp & 0x7F) | 0x80);
      temp = temp >>> 7;
    }
    this.bytes.push(temp & 0x7F);
  }

  writeTag(fieldNumber: number, wireType: number) {
    this.writeVarint((fieldNumber << 3) | wireType);
  }

  writeBool(fieldNumber: number, value: boolean) {
    if (value) {
      this.writeTag(fieldNumber, 0);
      this.writeVarint(1);
    }
  }

  writeUint32(fieldNumber: number, value: number) {
    this.writeTag(fieldNumber, 0);
    this.writeVarint(value);
  }

  writeInt32(fieldNumber: number, value: number) {
    this.writeTag(fieldNumber, 0);
    if (value < 0) {
      let temp = value;
      for (let i = 0; i < 9; i++) {
        this.bytes.push((temp & 0x7F) | 0x80);
        temp = temp >> 7;
      }
      this.bytes.push(temp & 0x7F);
    } else {
      this.writeVarint(value);
    }
  }

  writeSint32(fieldNumber: number, value: number) {
    this.writeTag(fieldNumber, 0);
    this.writeVarint((value << 1) ^ (value >> 31));
  }

  writeBytes(fieldNumber: number, value: Uint8Array) {
    this.writeTag(fieldNumber, 2);
    this.writeVarint(value.length);
    for (let i = 0; i < value.length; i++) {
      this.bytes.push(value[i]);
    }
  }

  writeString(fieldNumber: number, value: string) {
    const encoded = new TextEncoder().encode(value);
    this.writeBytes(fieldNumber, encoded);
  }

  getUint8Array(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

interface DecodedMetaResponse {
  noResponse?: boolean;
  simpleError?: number;
}

interface DecodedRequestResponse {
  requestId: number;
  meta?: DecodedMetaResponse;
  core?: DecodedCoreResponse;
  behaviors?: DecodedBehaviorsResponse;
  keymap?: DecodedKeymapResponse;
}

interface DecodedCoreResponse {
  getDeviceInfo?: { name: string; serialNumber: Uint8Array };
  getLockState?: number;
}

interface DecodedBehaviorsResponse {
  listAllBehaviors?: { behaviors: number[] };
  getBehaviorDetails?: { id: number; displayName: string };
}

interface DecodedKeymapResponse {
  getKeymap?: DecodedKeymap;
  getPhysicalLayouts?: DecodedPhysicalLayouts;
  setLayerBinding?: number;
  saveChanges?: { ok?: boolean; err?: number };
}

interface DecodedKeymap {
  layers: DecodedLayer[];
  availableLayers: number;
  maxLayerNameLength: number;
}

interface DecodedLayer {
  id: number;
  name: string;
  bindings: DecodedBehaviorBinding[];
}

interface DecodedBehaviorBinding {
  behaviorId: number;
  param1: number;
  param2: number;
}

interface DecodedPhysicalLayouts {
  activeLayoutIndex: number;
  layouts: DecodedPhysicalLayout[];
}

interface DecodedPhysicalLayout {
  name: string;
  keys: DecodedKeyPhysicalAttrs[];
}

interface DecodedKeyPhysicalAttrs {
  width: number;
  height: number;
  x: number;
  y: number;
  r: number;
  rx: number;
  ry: number;
}

function decodeResponse(buffer: Uint8Array): { requestResponse?: DecodedRequestResponse } {
  const decoder = new ProtoDecoder(buffer);
  let requestResponse: DecodedRequestResponse | undefined;

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 2) {
      requestResponse = decodeRequestResponse(field.value);
    }
  }
  return { requestResponse };
}

function decodeRequestResponse(buffer: Uint8Array): DecodedRequestResponse {
  const decoder = new ProtoDecoder(buffer);
  let requestId = 0;
  let meta: DecodedMetaResponse | undefined;
  let core: DecodedCoreResponse | undefined;
  let behaviors: DecodedBehaviorsResponse | undefined;
  let keymap: DecodedKeymapResponse | undefined;

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 0) {
      requestId = field.value;
    } else if (field.fieldNumber === 2 && field.wireType === 2) {
      meta = decodeMetaResponse(field.value);
    } else if (field.fieldNumber === 3 && field.wireType === 2) {
      core = decodeCoreResponse(field.value);
    } else if (field.fieldNumber === 4 && field.wireType === 2) {
      behaviors = decodeBehaviorsResponse(field.value);
    } else if (field.fieldNumber === 5 && field.wireType === 2) {
      keymap = decodeKeymapResponse(field.value);
    }
  }
  return { requestId, meta, core, behaviors, keymap };
}

function decodeMetaResponse(buffer: Uint8Array): DecodedMetaResponse {
  const decoder = new ProtoDecoder(buffer);
  let noResponse = false;
  let simpleError: number | undefined;

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 0) {
      noResponse = !!field.value;
    } else if (field.fieldNumber === 2 && field.wireType === 0) {
      simpleError = field.value;
    }
  }
  return { noResponse, simpleError };
}

function decodeCoreResponse(buffer: Uint8Array): DecodedCoreResponse {
  const decoder = new ProtoDecoder(buffer);
  let getDeviceInfo: { name: string; serialNumber: Uint8Array } | undefined;
  let getLockState: number | undefined;

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 2) {
      getDeviceInfo = decodeGetDeviceInfoResponse(field.value);
    } else if (field.fieldNumber === 2 && field.wireType === 0) {
      getLockState = field.value;
    }
  }
  return { getDeviceInfo, getLockState };
}

function decodeGetDeviceInfoResponse(buffer: Uint8Array): { name: string; serialNumber: Uint8Array } {
  const decoder = new ProtoDecoder(buffer);
  let name = "";
  let serialNumber = new Uint8Array(0);

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 2) {
      name = new TextDecoder().decode(field.value);
    } else if (field.fieldNumber === 2 && field.wireType === 2) {
      serialNumber = field.value;
    }
  }
  return { name, serialNumber };
}

function decodeBehaviorsResponse(buffer: Uint8Array): DecodedBehaviorsResponse {
  const decoder = new ProtoDecoder(buffer);
  let listAllBehaviors: { behaviors: number[] } | undefined;
  let getBehaviorDetails: { id: number; displayName: string } | undefined;

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 2) {
      listAllBehaviors = decodeListAllBehaviorsResponse(field.value);
    } else if (field.fieldNumber === 2 && field.wireType === 2) {
      getBehaviorDetails = decodeGetBehaviorDetailsResponse(field.value);
    }
  }
  return { listAllBehaviors, getBehaviorDetails };
}

function decodeListAllBehaviorsResponse(buffer: Uint8Array): { behaviors: number[] } {
  const decoder = new ProtoDecoder(buffer);
  const behaviors: number[] = [];

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1) {
      if (field.wireType === 0) {
        behaviors.push(field.value);
      } else if (field.wireType === 2) {
        const packedDecoder = new ProtoDecoder(field.value);
        while (packedDecoder.hasMore()) {
          behaviors.push(packedDecoder.readVarint());
        }
      }
    }
  }
  return { behaviors };
}

function decodeGetBehaviorDetailsResponse(buffer: Uint8Array): { id: number; displayName: string } {
  const decoder = new ProtoDecoder(buffer);
  let id = 0;
  let displayName = "";

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 0) {
      id = field.value;
    } else if (field.fieldNumber === 2 && field.wireType === 2) {
      displayName = new TextDecoder().decode(field.value);
    }
  }
  return { id, displayName };
}

function decodeSaveChangesResponse(buffer: Uint8Array): { ok?: boolean; err?: number } {
  const decoder = new ProtoDecoder(buffer);
  let ok: boolean | undefined;
  let err: number | undefined;

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 0) {
      ok = !!field.value;
    } else if (field.fieldNumber === 2 && field.wireType === 0) {
      err = field.value;
    }
  }
  return { ok, err };
}

function decodeKeymapResponse(buffer: Uint8Array): DecodedKeymapResponse {
  const decoder = new ProtoDecoder(buffer);
  let getKeymap: DecodedKeymap | undefined;
  let getPhysicalLayouts: DecodedPhysicalLayouts | undefined;
  let setLayerBinding: number | undefined;
  let saveChanges: { ok?: boolean; err?: number } | undefined;

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 2) {
      getKeymap = decodeKeymap(field.value);
    } else if (field.fieldNumber === 2 && field.wireType === 0) {
      setLayerBinding = field.value;
    } else if (field.fieldNumber === 4 && field.wireType === 2) {
      saveChanges = decodeSaveChangesResponse(field.value);
    } else if (field.fieldNumber === 6 && field.wireType === 2) {
      getPhysicalLayouts = decodePhysicalLayouts(field.value);
    }
  }
  return { getKeymap, getPhysicalLayouts, setLayerBinding, saveChanges };
}

function decodePhysicalLayouts(buffer: Uint8Array): DecodedPhysicalLayouts {
  const decoder = new ProtoDecoder(buffer);
  let activeLayoutIndex = 0;
  const layouts: DecodedPhysicalLayout[] = [];

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 0) {
      activeLayoutIndex = field.value;
    } else if (field.fieldNumber === 2 && field.wireType === 2) {
      layouts.push(decodePhysicalLayout(field.value));
    }
  }
  return { activeLayoutIndex, layouts };
}

function decodePhysicalLayout(buffer: Uint8Array): DecodedPhysicalLayout {
  const decoder = new ProtoDecoder(buffer);
  let name = "";
  const keys: DecodedKeyPhysicalAttrs[] = [];

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 2) {
      name = new TextDecoder().decode(field.value);
    } else if (field.fieldNumber === 2 && field.wireType === 2) {
      keys.push(decodeKeyPhysicalAttrs(field.value));
    }
  }
  return { name, keys };
}

function decodeKeyPhysicalAttrs(buffer: Uint8Array): DecodedKeyPhysicalAttrs {
  const decoder = new ProtoDecoder(buffer);
  let width = 0;
  let height = 0;
  let x = 0;
  let y = 0;
  let r = 0;
  let rx = 0;
  let ry = 0;

  for (const field of decoder.readFields()) {
    const val = field.value;
    const zigZagVal = (val >>> 1) ^ -(val & 1);
    if (field.fieldNumber === 1) width = zigZagVal;
    else if (field.fieldNumber === 2) height = zigZagVal;
    else if (field.fieldNumber === 3) x = zigZagVal;
    else if (field.fieldNumber === 4) y = zigZagVal;
    else if (field.fieldNumber === 5) r = zigZagVal;
    else if (field.fieldNumber === 6) rx = zigZagVal;
    else if (field.fieldNumber === 7) ry = zigZagVal;
  }
  return { width, height, x, y, r, rx, ry };
}

function decodeKeymap(buffer: Uint8Array): DecodedKeymap {
  const decoder = new ProtoDecoder(buffer);
  const layers: DecodedLayer[] = [];
  let availableLayers = 0;
  let maxLayerNameLength = 0;

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 2) {
      layers.push(decodeLayer(field.value));
    } else if (field.fieldNumber === 2 && field.wireType === 0) {
      availableLayers = field.value;
    } else if (field.fieldNumber === 3 && field.wireType === 0) {
      maxLayerNameLength = field.value;
    }
  }
  return { layers, availableLayers, maxLayerNameLength };
}

function decodeLayer(buffer: Uint8Array): DecodedLayer {
  const decoder = new ProtoDecoder(buffer);
  let id = 0;
  let name = "";
  const bindings: DecodedBehaviorBinding[] = [];

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 0) {
      id = field.value;
    } else if (field.fieldNumber === 2 && field.wireType === 2) {
      name = new TextDecoder().decode(field.value);
    } else if (field.fieldNumber === 3 && field.wireType === 2) {
      bindings.push(decodeBehaviorBinding(field.value));
    }
  }
  return { id, name, bindings };
}

function decodeBehaviorBinding(buffer: Uint8Array): DecodedBehaviorBinding {
  const decoder = new ProtoDecoder(buffer);
  let behaviorId = 0;
  let param1 = 0;
  let param2 = 0;

  for (const field of decoder.readFields()) {
    if (field.fieldNumber === 1 && field.wireType === 0) {
      const val = field.value;
      behaviorId = (val >>> 1) ^ -(val & 1);
    } else if (field.fieldNumber === 2 && field.wireType === 0) {
      param1 = field.value;
    } else if (field.fieldNumber === 3 && field.wireType === 0) {
      param2 = field.value;
    }
  }
  return { behaviorId, param1, param2 };
}

function encodeRequest(requestId: number, submessage: { core?: Uint8Array; behaviors?: Uint8Array; keymap?: Uint8Array }): Uint8Array {
  const encoder = new ProtoEncoder();
  encoder.writeUint32(1, requestId);
  if (submessage.core) {
    encoder.writeBytes(3, submessage.core);
  }
  if (submessage.behaviors) {
    encoder.writeBytes(4, submessage.behaviors);
  }
  if (submessage.keymap) {
    encoder.writeBytes(5, submessage.keymap);
  }
  return encoder.getUint8Array();
}

function encodeGetDeviceInfoRequest(requestId: number): Uint8Array {
  const coreEncoder = new ProtoEncoder();
  coreEncoder.writeBool(1, true); // getDeviceInfo
  return encodeRequest(requestId, { core: coreEncoder.getUint8Array() });
}

function encodeListAllBehaviorsRequest(requestId: number): Uint8Array {
  const behaviorsEncoder = new ProtoEncoder();
  behaviorsEncoder.writeBool(1, true); // listAllBehaviors
  return encodeRequest(requestId, { behaviors: behaviorsEncoder.getUint8Array() });
}

function encodeGetBehaviorDetailsRequest(requestId: number, behaviorId: number): Uint8Array {
  const detailsRequestEncoder = new ProtoEncoder();
  detailsRequestEncoder.writeUint32(1, behaviorId);

  const behaviorsEncoder = new ProtoEncoder();
  behaviorsEncoder.writeBytes(2, detailsRequestEncoder.getUint8Array()); // getBehaviorDetails

  return encodeRequest(requestId, { behaviors: behaviorsEncoder.getUint8Array() });
}

function encodeGetPhysicalLayoutsRequest(requestId: number): Uint8Array {
  const keymapEncoder = new ProtoEncoder();
  keymapEncoder.writeBool(6, true); // getPhysicalLayouts
  return encodeRequest(requestId, { keymap: keymapEncoder.getUint8Array() });
}

function encodeGetKeymapRequest(requestId: number): Uint8Array {
  const keymapEncoder = new ProtoEncoder();
  keymapEncoder.writeBool(1, true); // getKeymap
  return encodeRequest(requestId, { keymap: keymapEncoder.getUint8Array() });
}

function encodeSetLayerBindingRequest(
  requestId: number,
  layerId: number,
  keyPosition: number,
  behaviorId: number,
  param1: number,
  param2: number
): Uint8Array {
  const bindingEncoder = new ProtoEncoder();
  bindingEncoder.writeSint32(1, behaviorId);
  bindingEncoder.writeUint32(2, param1);
  bindingEncoder.writeUint32(3, param2);

  const setLayerBindingEncoder = new ProtoEncoder();
  setLayerBindingEncoder.writeUint32(1, layerId);
  setLayerBindingEncoder.writeInt32(2, keyPosition);
  setLayerBindingEncoder.writeBytes(3, bindingEncoder.getUint8Array());

  const keymapEncoder = new ProtoEncoder();
  keymapEncoder.writeBytes(2, setLayerBindingEncoder.getUint8Array()); // setLayerBinding

  return encodeRequest(requestId, { keymap: keymapEncoder.getUint8Array() });
}

function encodeGetLockStateRequest(requestId: number): Uint8Array {
  const coreEncoder = new ProtoEncoder();
  coreEncoder.writeBool(2, true); // getLockState (field 2 in core Request)
  return encodeRequest(requestId, { core: coreEncoder.getUint8Array() });
}

function encodeSaveChangesRequest(requestId: number): Uint8Array {
  const keymapEncoder = new ProtoEncoder();
  keymapEncoder.writeBool(4, true); // saveChanges
  return encodeRequest(requestId, { keymap: keymapEncoder.getUint8Array() });
}

import { ZMK_TO_UNIVERSAL, ZMK_KEY_MAP, parseZmkModifiedKey } from './zmk-action-converter';
import { KEY_MAP, HID_TO_UNIVERSAL } from './via-action-converter';
import { UniversalKey, Modifier } from '@/types/actions';

function hidToZmkKeyName(hid: number): string {
  const uKey = HID_TO_UNIVERSAL[hid];
  if (uKey) {
    return ZMK_KEY_MAP[uKey] || uKey;
  }
  return `0x${hid.toString(16)}`;
}

function decodeZmkUsageToZmkKeyName(encodedUsage: number): string {
  const usagePage = (encodedUsage >>> 16) & 0xff;
  const usageId = encodedUsage & 0xffff;

  if (usagePage === 0x07) {
    return hidToZmkKeyName(usageId);
  } else if (usagePage === 0x0C) {
    const consumerMap: Record<number, string> = {
      0x00B5: "C_NEXT",
      0x00B6: "C_PREV",
      0x00B9: "C_VOL_UP",
      0x00BA: "C_VOL_DN",
      0x00CD: "C_PP",   // Play/Pause
      0x00CC: "C_STOP",
      0x00E2: "C_MUTE",
      0x006F: "C_BRI_UP",
      0x0070: "C_BRI_DN",
      0x00E9: "C_VOL_UP", // Consumer Volume Up
      0x00EA: "C_VOL_DN", // Consumer Volume Down
    };
    return consumerMap[usageId] || `C_0x${usageId.toString(16).toUpperCase()}`;
  } else if (usagePage === 0x00) {
    return hidToZmkKeyName(usageId);
  }
  return `0x${encodedUsage.toString(16).toUpperCase()}`;
}

function encodeZmkKeyNameToUsage(name: string): number {
  const uKey = ZMK_TO_UNIVERSAL[name] || name;

  const consumerKeys: Record<string, number> = {
    "C_NEXT": 0x00B5,
    "C_PREV": 0x00B6,
    "C_VOL_UP": 0x00B9,
    "C_VOL_DN": 0x00BA,
    "C_PP": 0x00CD,
    "C_STOP": 0x00CC,
    "C_MUTE": 0x00E2,
    "C_BRI_UP": 0x006F,
    "C_BRI_DN": 0x0070
  };

  if (consumerKeys[uKey]) {
    return (0x0C << 16) | consumerKeys[uKey];
  }

  const entry = KEY_MAP[uKey as UniversalKey];
  if (entry) {
    if (entry.hid >= 0x00 && entry.hid <= 0xFF) {
      return (0x07 << 16) | entry.hid;
    }
    return entry.hid;
  }

  if (name.startsWith("0x")) {
    const parsed = parseInt(name.slice(2), 16);
    if (!isNaN(parsed)) return parsed;
  }

  const parsed = parseInt(name);
  return isNaN(parsed) ? 0 : parsed;
}

function zmkModifierToFlag(mod: string): number {
  const clean = (ZMK_TO_UNIVERSAL[mod] || mod).toUpperCase();
  if (clean === "LCTL" || clean === "LCTRL") return 0x01;
  if (clean === "LSFT" || clean === "LSHIFT") return 0x02;
  if (clean === "LALT") return 0x04;
  if (clean === "LGUI") return 0x08;
  if (clean === "RCTL" || clean === "RCTRL") return 0x10;
  if (clean === "RSFT" || clean === "RSHIFT") return 0x20;
  if (clean === "RALT") return 0x40;
  if (clean === "RGUI") return 0x80;
  return 0;
}

function encodeZmkModifiedUsage(modifiers: string[], keyName: string): number {
  const modFlags = modifiers.reduce((flags, mod) => flags | zmkModifierToFlag(mod), 0);
  const usage = encodeZmkKeyNameToUsage(keyName);
  return ((modFlags * 0x01000000) + usage) >>> 0;
}

function decodeZmkModifiedUsage(encodedUsage: number): { modFlags: number; usage: number } {
  return {
    modFlags: Math.floor(encodedUsage / 0x01000000) & 0xff,
    usage: encodedUsage & 0x00ffffff
  };
}

function zmkModifiedUsageToString(encodedUsage: number): string {
  const { modFlags, usage } = decodeZmkModifiedUsage(encodedUsage);
  const baseKeyName = decodeZmkUsageToZmkKeyName(usage);
  if (modFlags === 0) return baseKeyName;

  let result = baseKeyName;
  const shortcutMap: Record<string, string> = {
    'LCTRL': 'LC', 'LSHIFT': 'LS', 'LALT': 'LA', 'LGUI': 'LG',
    'RCTRL': 'RC', 'RSHIFT': 'RS', 'RALT': 'RA', 'RGUI': 'RG'
  };
  for (const mod of parseZmkModifiers(modFlags)) {
    const sh = shortcutMap[mod] || mod;
    result = `${sh}(${result})`;
  }
  return result;
}

function resolveBehaviorId(behaviorIds: Record<string, number>, shortName: string): number {
  const normShort = shortName.toLowerCase().replace(/[\s_-]+/g, '');

  if (behaviorIds[shortName] !== undefined) return behaviorIds[shortName];
  if (behaviorIds[normShort] !== undefined) return behaviorIds[normShort];

  for (const [key, value] of Object.entries(behaviorIds)) {
    const normKey = key.toLowerCase().replace(/[\s_-]+/g, '');
    if (normKey === normShort) return value;

    if (normShort === "kp" && (normKey === "keypress" || normKey === "key")) return value;
    if (normShort === "mo" && (normKey === "momentary" || normKey === "momentarylayer")) return value;
    if (normShort === "tog" && (normKey === "toggle" || normKey === "toglayer" || normKey === "togglelayer")) return value;
    if (normShort === "to" && normKey === "tolayer") return value;
    if (normShort === "lt" && normKey === "layertap") return value;
    if (normShort === "mt" && (normKey === "modtap" || normKey === "holdtap")) return value;
  }

  // Fallback defaults if not found dynamically from device
  if (normShort === "kp") return 3;
  if (normShort === "none") return 16;
  if (normShort === "trans" || normShort === "transparent") return 19;
  if (normShort === "lt" || normShort === "layertap") return 14;
  if (normShort === "mt" || normShort === "modtap" || normShort === "holdtap") return 15;

  return 0;
}

function parseZmkModifiers(mask: number): string[] {
  const mods: string[] = [];
  if (mask & 0x01) mods.push("LCTRL");
  if (mask & 0x02) mods.push("LSHIFT");
  if (mask & 0x04) mods.push("LALT");
  if (mask & 0x08) mods.push("LGUI");
  if (mask & 0x10) mods.push("RCTRL");
  if (mask & 0x20) mods.push("RSHIFT");
  if (mask & 0x40) mods.push("RALT");
  if (mask & 0x80) mods.push("RGUI");
  return mods;
}

function bindingToZmkString(
  binding: { behaviorId: number; param1: number; param2: number },
  behaviorNames: Record<number, string>
): string {
  const rawName = behaviorNames[binding.behaviorId] || `behavior_${binding.behaviorId}`;
  const name = rawName.toLowerCase().replace(/[\s_-]+/g, '');
  
  if (name === "none") {
    return "&none";
  }
  if (name === "trans" || name === "transparent") {
    return "&trans";
  }
  if (name === "kp" || name === "keypress" || name === "key") {
    return `&kp ${zmkModifiedUsageToString(binding.param1)}`;
  }
  if (name === "mo" || name === "momentary" || name === "momentarylayer") {
    return `&mo ${binding.param1}`;
  }
  if (name === "tog" || name === "toglayer" || name === "toggle" || name === "togglelayer") {
    return `&tog ${binding.param1}`;
  }
  if (name === "to" || name === "tolayer") {
    return `&to ${binding.param1}`;
  }
  if (name === "lt" || name === "layertap") {
    const tapKey = decodeZmkUsageToZmkKeyName(binding.param2);
    return `&lt ${binding.param1} ${tapKey}`;
  }
  if (name === "mt" || name === "modtap" || name === "holdtap") {
    const tapKey = decodeZmkUsageToZmkKeyName(binding.param2);
    const holdKey = zmkModifiedUsageToString(binding.param1);
    const { modFlags, usage } = decodeZmkModifiedUsage(binding.param1);
    const usagePage = (usage >>> 16) & 0xff;
    const usageId = usage & 0xffff;
    
    if (modFlags === 0 && usagePage === 0x07 && usageId >= 0xE0 && usageId <= 0xE7) {
      const directMods: Record<number, string> = {
        0xE0: "LCTRL",
        0xE1: "LSHIFT",
        0xE2: "LALT",
        0xE3: "LGUI",
        0xE4: "RCTRL",
        0xE5: "RSHIFT",
        0xE6: "RALT",
        0xE7: "RGUI"
      };
      const resolvedMod = directMods[usageId];
      return `&mt ${resolvedMod} ${tapKey}`;
    }
    
    return `&mt ${holdKey} ${tapKey}`;
  }
  if (name === "rgbug") {
    const cmdMap: Record<number, string> = {
      0: "RGB_TOG",
      1: "RGB_ON",
      2: "RGB_OFF",
      3: "RGB_HUI",
      4: "RGB_HUD",
      5: "RGB_SAI",
      6: "RGB_SAD",
      7: "RGB_BRI",
      8: "RGB_BRD",
      9: "RGB_SPI",
      10: "RGB_SPD",
      11: "RGB_EFF",
      12: "RGB_EFR"
    };
    return `&rgb_ug ${cmdMap[binding.param1] || "RGB_TOG"}`;
  }
  
  const dtsName = rawName.replace(/[\s_]+/g, '_');
  return `&${dtsName} ${binding.param1} ${binding.param2}`.trim();
}

function zmkStringToBinding(
  zmkStr: string,
  behaviorIds: Record<string, number>
): { behaviorId: number; param1: number; param2: number } {
  const trimmed = zmkStr.trim();
  
  if (trimmed === "&trans") {
    return { behaviorId: resolveBehaviorId(behaviorIds, "trans"), param1: 0, param2: 0 };
  }
  if (trimmed === "&none") {
    return { behaviorId: resolveBehaviorId(behaviorIds, "none"), param1: 0, param2: 0 };
  }
  
  let match = trimmed.match(/^&kp\s+([^\s]+)$/);
  if (match) {
    const keyName = match[1];
    const parsedMod = parseZmkModifiedKey(keyName);
    if (parsedMod) {
      return {
        behaviorId: resolveBehaviorId(behaviorIds, "kp"),
        param1: encodeZmkModifiedUsage(parsedMod.modifiers, parsedMod.keycode),
        param2: 0
      };
    } else {
      const usage = encodeZmkKeyNameToUsage(keyName);
      return {
        behaviorId: resolveBehaviorId(behaviorIds, "kp"),
        param1: usage,
        param2: 0
      };
    }
  }
  
  match = trimmed.match(/^&mo\s+(\d+)$/);
  if (match) {
    return {
      behaviorId: resolveBehaviorId(behaviorIds, "mo"),
      param1: parseInt(match[1]),
      param2: 0
    };
  }
  
  match = trimmed.match(/^&(tog|toggle|tog_layer)\s+(\d+)$/);
  if (match) {
    return {
      behaviorId: resolveBehaviorId(behaviorIds, "tog"),
      param1: parseInt(match[2]),
      param2: 0
    };
  }
  
  match = trimmed.match(/^&to\s+(\d+)$/);
  if (match) {
    return {
      behaviorId: resolveBehaviorId(behaviorIds, "to"),
      param1: parseInt(match[1]),
      param2: 0
    };
  }
  
  match = trimmed.match(/^&lt\s+(\d+)\s+([^\s]+)$/);
  if (match) {
    return {
      behaviorId: resolveBehaviorId(behaviorIds, "lt"),
      param1: parseInt(match[1]),
      param2: encodeZmkKeyNameToUsage(match[2])
    };
  }

  match = trimmed.match(/^&mt\s+([^\s]+)$/);
  if (match) {
    return {
      behaviorId: resolveBehaviorId(behaviorIds, "kp"),
      param1: encodeZmkKeyNameToUsage(match[1]),
      param2: 0
    };
  }
  
  match = trimmed.match(/^&mt\s+(.+)\s+([^\s]+)$/);
  if (match) {
    const modsStr = match[1];
    const keyName = match[2];
    
    const mods = modsStr.split(/\s+/).map(mod => mod.trim()).filter(Boolean);
    const holdKey = mods.pop();
    if (!holdKey) {
      return {
        behaviorId: resolveBehaviorId(behaviorIds, "kp"),
        param1: encodeZmkKeyNameToUsage(keyName),
        param2: 0
      };
    }
    
    return {
      behaviorId: resolveBehaviorId(behaviorIds, "mt"),
      param1: encodeZmkModifiedUsage(mods, holdKey),
      param2: encodeZmkKeyNameToUsage(keyName)
    };
  }
  
  match = trimmed.match(/^&rgb_ug\s+([^\s]+)$/);
  if (match) {
    const cmd = match[1];
    const cmdMap: Record<string, number> = {
      "RGB_TOG": 0,
      "RGB_ON": 1,
      "RGB_OFF": 2,
      "RGB_HUI": 3,
      "RGB_HUD": 4,
      "RGB_SAI": 5,
      "RGB_SAD": 6,
      "RGB_BRI": 7,
      "RGB_BRD": 8,
      "RGB_SPI": 9,
      "RGB_SPD": 10,
      "RGB_EFF": 11,
      "RGB_EFR": 12
    };
    return {
      behaviorId: behaviorIds["rgb_ug"] || 0,
      param1: cmdMap[cmd] !== undefined ? cmdMap[cmd] : 0,
      param2: 0
    };
  }
  
  match = trimmed.match(/^&([^\s]+)\s*(.*)$/);
  if (match) {
    const name = match[1];
    const params = match[2].trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
    return {
      behaviorId: behaviorIds[name] || 0,
      param1: params[0] || 0,
      param2: params[1] || 0
    };
  }
  
  return { behaviorId: 0, param1: 0, param2: 0 };
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
  private currentRequestId: number = 1;
  private behaviorNames: Record<number, string> = {};
  private behaviorIds: Record<string, number> = {};
  private fetchedKeymap: DecodedKeymap | null = null;
  private requestQueue: Promise<void> = Promise.resolve();

  private uiKeysProvider: (() => any[]) | null = null;

  registerUiKeysProvider(provider: () => any[]) {
    this.uiKeysProvider = provider;
  }

  resolveZmkPosition(row: number, col: number): number {
    let resolvedIndex = -1;
    let method = '';

    // 1. Try to find the matching key from the active project keys in the store
    if (this.uiKeysProvider) {
      try {
        const uiKeys = this.uiKeysProvider();
        if (uiKeys && uiKeys.length > 0) {
          const uiKey = uiKeys.find((k: any) => k.row === row && k.col === col);
          if (uiKey) {
            // Find the physical key with the closest coordinates (x, y)
            let closestIndex = -1;
            let minDistance = Infinity;
            
            for (let i = 0; i < this.physicalKeys.length; i++) {
              const pk = this.physicalKeys[i];
              const dx = pk.x - uiKey.x;
              const dy = pk.y - uiKey.y;
              const dist = dx * dx + dy * dy;
              if (dist < minDistance) {
                minDistance = dist;
                closestIndex = i;
              }
            }
            
            if (closestIndex !== -1 && minDistance < 1.0) { // Keep safety threshold of 1.0 unit (key width)
              resolvedIndex = closestIndex;
              method = `UI Coordinate Match (distance: ${Math.sqrt(minDistance).toFixed(3)})`;
            }
          }
        }
      } catch (err) {
        console.warn('[ZMK Position Resolve] Error during coordinate matching:', err);
      }
    }

    // 2. Fallback to physicalPositions mapping (works when no project is loaded)
    if (resolvedIndex === -1) {
      const pos = this.physicalPositions.find(p => p.row === row && p.col === col);
      if (pos) {
        resolvedIndex = pos.index;
        method = 'physicalPositions array fallback';
      }
    }

    // 3. Ultimate fallback: default to 0
    if (resolvedIndex === -1) {
      resolvedIndex = 0;
      method = 'Default ultimate fallback (0)';
    }

    // Spec Verification Logging for Row0 Col0
    if (row === 0 && col === 0) {
      console.log(`[ZMK Verify Specification] Row0 Col0 ZMK Position ID: ${resolvedIndex} (resolved via ${method})`);
    } else {
      console.log(`[ZMK Position Resolve] R${row}C${col} mapped to ZMK Position ID: ${resolvedIndex} (resolved via ${method})`);
    }

    return resolvedIndex;
  }

  constructor() {}

  public keyboardName: string = 'ZMK Keyboard';
  public layerCount: number = 3;
  public selectedLayoutName: string = 'Default Layout';
  public physicalPositions: Array<{ row: number; col: number; index: number }> = [];
  public physicalKeys: Array<{ x: number; y: number; w: number; h: number; row: number; col: number }> = [];
  public isLayoutAvailable: boolean = false;
  public keyboardInfoAvailable: boolean = false;
  public behaviorsAvailable: boolean = false;
  public physicalLayoutsAvailable: boolean = false;
  public keymapAvailable: boolean = false;

  resetRuntimeState() {
    this.currentRequestId = 1;
    this.behaviorNames = {};
    this.behaviorIds = {};
    this.fetchedKeymap = null;
    this.keyboardName = 'ZMK Keyboard';
    this.layerCount = 3;
    this.selectedLayoutName = 'Default Layout';
    this.physicalPositions = [];
    this.physicalKeys = [];
    this.isLayoutAvailable = false;
    this.keyboardInfoAvailable = false;
    this.behaviorsAvailable = false;
    this.physicalLayoutsAvailable = false;
    this.keymapAvailable = false;
  }

  private getNextRequestId(): number {
    return this.currentRequestId++;
  }

  private async sendRequest(requestNameOrData: string | Uint8Array, maybeData?: Uint8Array, timeoutMs?: number): Promise<Uint8Array> {
    const previousRequest = this.requestQueue;
    let releaseRequest!: () => void;
    this.requestQueue = new Promise(resolve => {
      releaseRequest = resolve;
    });

    await previousRequest;
    try {
      return await this.sendRequestUnlocked(requestNameOrData, maybeData, timeoutMs);
    } finally {
      releaseRequest();
    }
  }

  private async sendRequestUnlocked(requestNameOrData: string | Uint8Array, maybeData?: Uint8Array, timeoutMs?: number): Promise<Uint8Array> {
    const hex = (data: Uint8Array) => Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');

    let requestName = 'UnknownRequest';
    let reqData: Uint8Array;
    if (requestNameOrData instanceof Uint8Array) {
      reqData = requestNameOrData;
    } else {
      requestName = requestNameOrData;
      reqData = maybeData!;
    }

    if (!this.transport) {
      throw new Error('Transport not connected');
    }
    const expectedId = this.getNextRequestId();
    
    const decoder = new ProtoDecoder(reqData);
    let originalSubmsg: { core?: Uint8Array; behaviors?: Uint8Array; keymap?: Uint8Array } = {};
    for (const field of decoder.readFields()) {
      if (field.fieldNumber === 3) originalSubmsg.core = field.value;
      else if (field.fieldNumber === 4) originalSubmsg.behaviors = field.value;
      else if (field.fieldNumber === 5) originalSubmsg.keymap = field.value;
    }
    const correctlyPagedMsg = encodeRequest(expectedId, originalSubmsg);
    
    console.log('[ZMK tx]', {
      requestName,
      requestId: expectedId,
      raw: hex(correctlyPagedMsg)
    });

    await this.transport.send(correctlyPagedMsg);
    
    let responseData: Uint8Array;
    try {
      responseData = await this.transport.receive((payload) => {
        try {
          const decoded = decodeResponse(payload);
          return decoded.requestResponse?.requestId === expectedId;
        } catch {
          return false;
        }
      }, timeoutMs);
    } catch (err: any) {
      if (err.message && err.message.includes('Timeout')) {
        const enrichedError = new Error(`ZMK Timeout: Request "${requestName}" (ID: ${expectedId}, TX: ${hex(correctlyPagedMsg)}) timed out`);
        console.error('[ZMK timeout]', {
          requestName,
          requestId: expectedId,
          rawTx: hex(correctlyPagedMsg),
          error: err.message
        });
        throw enrichedError;
      }
      throw err;
    }

    console.log('[ZMK rx]', {
      requestName,
      requestId: expectedId,
      raw: hex(responseData)
    });

    const decoded = decodeResponse(responseData);
    if (decoded.requestResponse?.meta) {
      const { noResponse, simpleError } = decoded.requestResponse.meta;
      if (noResponse) {
        throw new Error('No RPC response from device');
      }
      if (simpleError !== undefined) {
        if (simpleError === 1) {
          throw new Error('Device is locked. Please trigger the Studio Unlock key on your keyboard to unlock.');
        } else {
          const errorNames: Record<number, string> = {
            0: 'GENERIC',
            1: 'UNLOCK_REQUIRED',
            2: 'RPC_NOT_FOUND',
            3: 'MSG_DECODE_FAILED',
            4: 'MSG_ENCODE_FAILED'
          };
          throw new Error(`RPC Meta Error: ${errorNames[simpleError] || 'UNKNOWN'} (code ${simpleError})`);
        }
      }
    }

    return responseData;
  }

  async fetchMetadata(): Promise<boolean> {
    const hex = (data: Uint8Array) => Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');

    if (!this.transport) {
      console.warn('[ZmkProtocol] Cannot fetch metadata: Transport is not connected.');
      return false;
    }

    console.log('[ZmkProtocol] Querying device metadata...');
    this.resetRuntimeState();

    const isLockError = (err: any) => err && err.message && (err.message.includes('locked') || err.message.includes('Unlock'));

    // 1. Send GetKeyboardInfoRequest
    try {
      const getInfoMsg = encodeGetDeviceInfoRequest(1);
      const infoResponse = await this.sendRequest('GetKeyboardInfo', getInfoMsg);
      const decodedInfo = decodeResponse(infoResponse);
      const infoMsg = decodedInfo.requestResponse?.core?.getDeviceInfo;
      if (infoMsg) {
        this.keyboardName = infoMsg.name || this.keyboardName;
      }
      this.keyboardInfoAvailable = true;
    } catch (err: any) {
      if (isLockError(err)) throw err;
      console.error('[ZmkProtocol] Failed to retrieve mandatory keyboard info from physical device:', err);
      return false;
    }

    // 2. Send GetPhysicalLayoutsRequest (PRIORITIZED with timing delay, custom timeout & retry!)
    await sleep(200); // Timing delay after connection handshake
    let layoutSuccess = false;
    try {
      const getLayoutsMsg = encodeGetPhysicalLayoutsRequest(1);
      // Attempt 1: 10000ms timeout!
      const layoutsResponse = await this.sendRequest('GetPhysicalLayouts', getLayoutsMsg, 10000);
      layoutSuccess = this.parseLayoutsResponse(layoutsResponse);
    } catch (layoutErr: any) {
      if (isLockError(layoutErr)) throw layoutErr;
      console.warn('[ZmkProtocol] GetPhysicalLayouts attempt 1 timed out or failed:', layoutErr);
      // Retry 1: Delay 100ms then retry with 10000ms timeout!
      await sleep(100);
      try {
        console.log('[ZmkProtocol] Retrying GetPhysicalLayouts query (Attempt 2)...');
        const getLayoutsMsg = encodeGetPhysicalLayoutsRequest(1);
        const layoutsResponse = await this.sendRequest('GetPhysicalLayouts', getLayoutsMsg, 10000);
        layoutSuccess = this.parseLayoutsResponse(layoutsResponse);
      } catch (retryErr: any) {
        if (isLockError(retryErr)) throw retryErr;
        console.warn('[ZmkProtocol] GetPhysicalLayouts attempt 2 (retry) timed out or failed:', retryErr);
      }
    }

    // 4. Discover Behaviors dynamically (POSTPONED!)
    await sleep(30);
    try {
      const listBehaviorsMsg = encodeListAllBehaviorsRequest(1);
      const listBehaviorsRes = await this.sendRequest('ListAllBehaviors', listBehaviorsMsg);
      const decodedList = decodeResponse(listBehaviorsRes);
      const behaviorList = decodedList.requestResponse?.behaviors?.listAllBehaviors?.behaviors || [];
      
      for (const bId of behaviorList) {
        await sleep(30);
        const getDetailsMsg = encodeGetBehaviorDetailsRequest(1, bId);
        const detailsRes = await this.sendRequest('GetBehaviorDetails', getDetailsMsg);
        const decodedDetails = decodeResponse(detailsRes);
        const details = decodedDetails.requestResponse?.behaviors?.getBehaviorDetails;
        if (details) {
          const cleanName = details.displayName.toLowerCase().replace(/_behavior$/, '');
          this.behaviorNames[details.id] = cleanName;
          this.behaviorIds[cleanName] = details.id;
        }
      }
      this.behaviorsAvailable = true;
      console.log('[ZmkProtocol] Discovered behaviors dynamically:', JSON.stringify(this.behaviorIds));
    } catch (err: any) {
      if (isLockError(err)) throw err;
      console.warn('[ZmkProtocol] Discovering behaviors failed dynamically:', err);
    }

    // 5. Final fallback retry if layout is still missing (at the very end of metadata sequence!)
    if (!this.physicalLayoutsAvailable) {
      console.log('[ZmkProtocol] Dynamic behaviors query completed. Executing final fallback GetPhysicalLayouts retry...');
      await sleep(100);
      try {
        const getLayoutsMsg = encodeGetPhysicalLayoutsRequest(1);
        const layoutsResponse = await this.sendRequest('GetPhysicalLayouts', getLayoutsMsg, 10000);
        this.parseLayoutsResponse(layoutsResponse);
      } catch (finalErr: any) {
        if (isLockError(finalErr)) throw finalErr;
        console.error('[ZmkProtocol] Final fallback GetPhysicalLayouts retry failed:', finalErr);
      }
    }

    // 6. Fetch Keymap dynamically via GetKeymapRequest
    try {
      await this.fetchKeymap();
    } catch (err: any) {
      if (isLockError(err)) throw err;
      console.warn('[ZmkProtocol] Failed to retrieve keymap from physical device (device may be locked or unsupported):', err.message || err);
    }

    return true;
  }

  parseLayoutsResponse(layoutsResponse: Uint8Array): boolean {
    const decodedLayouts = decodeResponse(layoutsResponse);
    const physicalLayouts = decodedLayouts.requestResponse?.keymap?.getPhysicalLayouts;
    if (physicalLayouts && physicalLayouts.layouts.length > 0) {
      const activeIdx = physicalLayouts.activeLayoutIndex || 0;
      const activeLayout = physicalLayouts.layouts[activeIdx] || physicalLayouts.layouts[0];
      this.selectedLayoutName = activeLayout.name || this.selectedLayoutName;
      
      this.physicalPositions = [];
      this.physicalKeys = [];
      const ZMK_LAYOUT_UNIT = 100;
      for (let i = 0; i < activeLayout.keys.length; i++) {
        const keyAttrs = activeLayout.keys[i];
        const rx = keyAttrs.x / ZMK_LAYOUT_UNIT;
        const ry = keyAttrs.y / ZMK_LAYOUT_UNIT;
        const rw = keyAttrs.width / ZMK_LAYOUT_UNIT || 1.0;
        const rh = keyAttrs.height / ZMK_LAYOUT_UNIT || 1.0;
        
        let row = Math.round(ry);
        let col = Math.round(rx);
        
        while (this.physicalPositions.some(p => p.row === row && p.col === col)) {
          col++;
        }
        
        this.physicalPositions.push({ row, col, index: i });
        this.physicalKeys.push({ x: rx, y: ry, w: rw, h: rh, row, col });
      }
    }

    if (this.physicalPositions.length > 0) {
      this.physicalLayoutsAvailable = true;
      this.isLayoutAvailable = true;
      return true;
    }
    return false;
  }

  async getKeyPositions(): Promise<Array<{ row: number; col: number; index: number }>> {
    return this.physicalPositions;
  }

  async testReadBinding(layer: number, position: number): Promise<boolean> {
    if (!this.transport) {
      throw new Error('Device not connected');
    }

    const testMsg = encodeGetLockStateRequest(1);
    console.log('[ZMK Test Probe TX]: Querying Lock State...');

    try {
      const response = await this.sendRequest('GetLockState', testMsg);
      const decoded = decodeResponse(response);
      const lockState = decoded.requestResponse?.core?.getLockState;
      
      if (lockState !== undefined) {
        const isLocked = isZmkStudioLocked(lockState);
        console.log(`[ZMK Test Probe RX]: Lock State is ${isLocked ? 'LOCKED' : 'UNLOCKED'} (${lockState})`);
        if (isLocked) {
          throw new Error('ZMK Studio is locked. Please trigger the Studio Unlock key on your keyboard to unlock.');
        }
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('[ZMK Test Probe RX Error]: Lock check timed out or failed:', err);
      if (err.message && (err.message.includes('locked') || err.message.includes('Unlock'))) {
        throw err;
      }
      return false;
    }
  }

  async initialize(transport: ITransport): Promise<boolean> {
    this.transport = transport;
    console.log('ZMK Protocol Driver Initialized with Transport Capabilities:', this.capabilities);
    return true;
  }

  async getLayerCount(): Promise<number> {
    return this.layerCount;
  }

  async getKey(layer: number, row: number, col: number): Promise<UniversalAction> {
    if (!this.keymapAvailable) {
      throw new Error('Operation not supported: Device keymap is not available.');
    }
    if (!this.fetchedKeymap) {
      throw new Error('Device keymap not fetched or cache empty');
    }

    const keyIndex = this.resolveZmkPosition(row, col);
    const lyr = this.fetchedKeymap.layers[layer];
    if (!lyr) {
      throw new Error(`Layer ${layer} not found in fetched keymap`);
    }

    const binding = lyr.bindings[keyIndex];
    if (!binding) {
      return { action: 'none' };
    }

    const hex = (data: Uint8Array) => Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
    
    const bindingEncoder = new ProtoEncoder();
    bindingEncoder.writeSint32(1, binding.behaviorId);
    bindingEncoder.writeUint32(2, binding.param1);
    bindingEncoder.writeUint32(3, binding.param2);
    const bindingBytes = bindingEncoder.getUint8Array();

    const dtsStr = bindingToZmkString(binding, this.behaviorNames);
    const action = zmkStringToAction(dtsStr);

    console.log('[ZMK read] raw:', hex(bindingBytes));
    console.log('[ZMK read] decoded:', action);

    const behaviorName = this.behaviorNames[binding.behaviorId] || `behavior_${binding.behaviorId}`;
    console.log(`[ZMK Decoded Log]`, {
      behaviorId: binding.behaviorId,
      behaviorName,
      rawParams: [binding.param1, binding.param2],
      paramsHex: [
        `0x${binding.param1.toString(16).toUpperCase()}`,
        `0x${binding.param2.toString(16).toUpperCase()}`
      ],
      param1: {
        paramHex: `0x${binding.param1.toString(16).toUpperCase()}`,
        usagePage: binding.param1 >>> 16,
        usageId: binding.param1 & 0xffff,
        maybeMaskedUsagePage: (binding.param1 >>> 16) & 0xff
      },
      param2: {
        paramHex: `0x${binding.param2.toString(16).toUpperCase()}`,
        usagePage: binding.param2 >>> 16,
        usageId: binding.param2 & 0xffff,
        maybeMaskedUsagePage: (binding.param2 >>> 16) & 0xff
      },
      convertedAction: action
    });

    return action;
  }

  async fetchKeymap(): Promise<boolean> {
    if (!this.transport) {
      throw new Error('Transport not connected');
    }
    try {
      console.log('[ZmkProtocol] Fetching full keymap via GetKeymapRequest...');
      const getKeymapMsg = encodeGetKeymapRequest(1);
      const keymapResponse = await this.sendRequest('GetKeymap', getKeymapMsg, 10000);
      const decodedKeymapRes = decodeResponse(keymapResponse);
      const keymapMsg = decodedKeymapRes.requestResponse?.keymap?.getKeymap;
      if (keymapMsg && keymapMsg.layers && keymapMsg.layers.length > 0) {
        this.fetchedKeymap = keymapMsg;
        this.layerCount = keymapMsg.layers.length;
        this.keymapAvailable = true;
        console.log(`[ZmkProtocol] Successfully fetched keymap with ${this.layerCount} layers.`);
        return true;
      } else {
        console.warn('[ZmkProtocol] Keymap response was empty or invalid.');
        this.keymapAvailable = false;
        return false;
      }
    } catch (err: any) {
      console.warn('[ZmkProtocol] Failed to retrieve keymap from physical device:', err.message || err);
      this.keymapAvailable = false;
      throw err;
    }
  }

  async setKey(layer: number, row: number, col: number, action: UniversalAction): Promise<void> {
    if (!this.keymapAvailable) {
      throw new Error('Operation not supported: Device keymap is not available.');
    }
    if (!this.transport) {
      throw new Error('Device not connected');
    }
    if (!this.fetchedKeymap) {
      throw new Error('Device keymap not cached');
    }

    const keyIndex = this.resolveZmkPosition(row, col);

    const zmkDtsStr = actionToZmkString(action);
    console.log(`[ZMK setKey] Mapping action "${zmkDtsStr}" using behaviorIds:`, JSON.stringify(this.behaviorIds));
    const binding = zmkStringToBinding(zmkDtsStr, this.behaviorIds);
    console.log(`[ZMK setKey] Resolved binding: behaviorId=${binding.behaviorId}, param1=${binding.param1}, param2=${binding.param2}`);

    const getSetLayerBindingResponseEnumName = (s: number): string => {
      switch (s) {
        case 0: return 'SET_LAYER_BINDING_RESP_OK';
        case 1: return 'SET_LAYER_BINDING_RESP_INVALID_LOCATION';
        case 2: return 'SET_LAYER_BINDING_RESP_INVALID_BEHAVIOR';
        case 3: return 'SET_LAYER_BINDING_RESP_INVALID_PARAMETERS';
        default: return `UNKNOWN_STATUS_CODE_${s}`;
      }
    };

    const getSaveChangesErrorCodeName = (err: number): string => {
      switch (err) {
        case 0: return 'SAVE_CHANGES_ERR_OK';
        case 1: return 'SAVE_CHANGES_ERR_GENERIC';
        case 2: return 'SAVE_CHANGES_ERR_NOT_SUPPORTED';
        case 3: return 'SAVE_CHANGES_ERR_NO_SPACE';
        default: return `UNKNOWN_SAVE_ERR_${err}`;
      }
    };

    // 1. Query lock state before writing
    console.log('[ZMK Write Pre-check] Querying Lock State from device...');
    try {
      const lockRequestMsg = encodeGetLockStateRequest(1);
      const lockResponse = await this.sendRequest('GetLockState', lockRequestMsg);
      const decodedLock = decodeResponse(lockResponse);
      const lockState = decodedLock.requestResponse?.core?.getLockState;
      if (lockState !== undefined) {
        const isLocked = isZmkStudioLocked(lockState);
        console.log(`[ZMK Write Pre-check] Lock State: ${isLocked ? 'LOCKED' : 'UNLOCKED'} (value: ${lockState})`);
        if (isLocked) {
          throw new Error('ZMK Studio is locked. Please trigger the Studio Unlock key on your keyboard to unlock.');
        }
      }
    } catch (err: any) {
      if (err?.message && (err.message.includes('locked') || err.message.includes('Unlock'))) {
        console.warn('[ZMK Write Pre-check] Device is locked:', err);
        throw err;
      }
      console.warn('[ZMK Write Pre-check] Failed to query lock state:', err);
    }

    // 2. Send SetLayerBinding
    const setMsg = encodeSetLayerBindingRequest(
      1,
      layer,
      keyIndex,
      binding.behaviorId,
      binding.param1,
      binding.param2
    );

    console.log(`[ZMK Protobuf RPC Write] Sending SetLayerBinding: Layer:${layer} Position:${keyIndex} behaviorId:${binding.behaviorId} param1:${binding.param1} param2:${binding.param2}`);
    
    const setResponse = await this.sendRequest('SetLayerBinding', setMsg);
    const decoded = decodeResponse(setResponse);
    const status = decoded.requestResponse?.keymap?.setLayerBinding;
    if (status !== undefined) {
      const enumName = getSetLayerBindingResponseEnumName(status);
      console.log(`[ZMK SetLayerBinding RX] Response Status: ${enumName} (${status})`);
      if (status !== 0) { // 0: SET_LAYER_BINDING_RESP_OK
        throw new Error(`SetLayerBinding failed: ${enumName} (status ${status})`);
      }
    } else {
      throw new Error('SetLayerBinding response did not contain status field');
    }

    // 3. Send SaveChanges
    console.log('[ZMK SaveChanges TX] Requesting SaveChanges...');
    try {
      const saveMsg = encodeSaveChangesRequest(1);
      const saveResponse = await this.sendRequest('SaveChanges', saveMsg);
      const decodedSave = decodeResponse(saveResponse);
      const saveChangesResult = decodedSave.requestResponse?.keymap?.saveChanges;
      if (saveChangesResult) {
        if (saveChangesResult.ok) {
          console.log('[ZMK SaveChanges RX] Status: SAVE_CHANGES_ERR_OK (ok=true)');
        } else if (saveChangesResult.err !== undefined) {
          const errName = getSaveChangesErrorCodeName(saveChangesResult.err);
          console.log(`[ZMK SaveChanges RX] Status: ${errName} (err=${saveChangesResult.err})`);
        }
      }
    } catch (err) {
      console.warn('[ZMK SaveChanges ERROR] Request failed:', err);
    }

    // 4. Re-fetch full keymap and verify state
    console.log('[ZMK Sync & Verify] Re-fetching keymap to verify change...');
    await sleep(200);
    await this.fetchKeymap();

    const updatedLyr = this.fetchedKeymap?.layers[layer];
    const updatedBinding = updatedLyr?.bindings[keyIndex];
    if (updatedBinding) {
      const match = updatedBinding.behaviorId === binding.behaviorId &&
                    updatedBinding.param1 === binding.param1 &&
                    updatedBinding.param2 === binding.param2;

      if (match) {
        console.log(`[ZMK Verification SUCCESS] Expected behaviorId:${binding.behaviorId}/param1:${binding.param1}/param2:${binding.param2} matches physical device keymap at index ${keyIndex}!`);
      } else {
        console.warn(
          `[ZMK Verification FAILURE] Keymap mismatch at position ${keyIndex}:\n` +
          `  Expected: behaviorId=${binding.behaviorId}, param1=${binding.param1}, param2=${binding.param2}\n` +
          `  Actual on Device: behaviorId=${updatedBinding.behaviorId}, param1=${updatedBinding.param1}, param2=${updatedBinding.param2}`
        );
      }
    } else {
      console.warn(`[ZMK Verify WARNING] Could not verify the new binding on physical device.`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }
    this.resetRuntimeState();
    console.log('ZMK Protocol Driver Disconnected');
  }
}

export const zmkProtocol = new ZmkProtocol();
