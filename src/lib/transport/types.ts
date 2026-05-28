import { UniversalAction } from '@/types/actions';

// 自己検出されたデバイス対応機能のフラグ定義
export interface DeviceCapability {
  hasTapDance: boolean;
  hasMacros: boolean;
  hasCombos: boolean;
  hasMouseKeys: boolean;
  hasLighting: boolean;
  hasRotaryEncoder: boolean;
}

// 物理通信メディア（WebHID, WebUSB, WebBLE）を統一するインターフェース
export interface ITransport {
  isConnected: boolean;
  connect(device?: any): Promise<boolean>;
  disconnect(): Promise<void>;
  send(data: Uint8Array): Promise<void>;
  receive(filter?: (data: Uint8Array) => boolean, timeoutMs?: number): Promise<Uint8Array>;
  onDisconnect?(callback: () => void): void;
}

// 通信プロトコル（VIA, Vial, ZMK RPC）を統一するインターフェース
export interface IProtocolDriver {
  capabilities: DeviceCapability;
  initialize(transport: ITransport): Promise<boolean>;
  getLayerCount(): Promise<number>;
  getKey(layer: number, row: number, col: number): Promise<UniversalAction>;
  setKey(layer: number, row: number, col: number, action: UniversalAction): Promise<void>;
  getKeymapBuffer?(offset: number, length: number): Promise<Uint8Array>; // Vial等の高速一括フェッチ用 (オプション)
  getKeyPositions?(): Promise<Array<{ row: number; col: number; index: number }>>;
  disconnect(): Promise<void>;
}
