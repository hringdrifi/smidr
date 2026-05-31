import { ITransport } from './types';

type TauriGlobal = {
  core?: {
    invoke?: <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;
  };
  event?: {
    listen?: <T = unknown>(
      event: string,
      handler: (event: { payload: T }) => void
    ) => Promise<() => void>;
  };
};

type PendingResolver = {
  resolve: (data: Uint8Array) => void;
  filter?: (data: Uint8Array) => boolean;
};

type NativeDeviceInfo = {
  name?: string;
  id?: string;
};

const getTauri = (): TauriGlobal | undefined => (window as Window & { __TAURI__?: TauriGlobal }).__TAURI__;

export const isTauriRuntime = (): boolean => {
  const tauri = getTauri();
  return typeof tauri?.core?.invoke === 'function' && typeof tauri?.event?.listen === 'function';
};

export class TauriZmkBleTransport implements ITransport {
  public isConnected = false;
  private receiveQueue: Uint8Array[] = [];
  private pendingResolvers: PendingResolver[] = [];
  private disconnectCallback: (() => void) | null = null;
  private unlistenFrame: (() => void) | null = null;
  private deviceInfo: NativeDeviceInfo = {};

  async connect(nameFilter?: string): Promise<boolean> {
    const tauri = getTauri();
    if (!tauri?.core?.invoke || !tauri.event?.listen) {
      console.warn('Tauri native BLE transport is not available.');
      return false;
    }

    try {
      this.resetQueues();
      this.unlistenFrame?.();
      this.unlistenFrame = await tauri.event.listen<number[]>('zmk-ble-frame', (event) => {
        this.handleFrame(new Uint8Array(event.payload));
      });

      this.deviceInfo = await tauri.core.invoke<NativeDeviceInfo>('zmk_ble_connect', {
        nameFilter: nameFilter?.trim() || null,
      });
      this.isConnected = true;
      console.log('ZMK Native BLE Transport Connected', this.deviceInfo);
      return true;
    } catch (err) {
      console.error('ZMK Native BLE Connection failed:', err);
      this.unlistenFrame?.();
      this.unlistenFrame = null;
      this.isConnected = false;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    const tauri = getTauri();
    try {
      await tauri?.core?.invoke?.('zmk_ble_disconnect');
    } finally {
      this.unlistenFrame?.();
      this.unlistenFrame = null;
      this.resetQueues();
      this.isConnected = false;
      this.disconnectCallback?.();
      console.log('ZMK Native BLE Transport Disconnected');
    }
  }

  async send(data: Uint8Array): Promise<void> {
    const tauri = getTauri();
    if (!this.isConnected || !tauri?.core?.invoke) {
      throw new Error('Device not connected');
    }
    await tauri.core.invoke('zmk_ble_send', { data: Array.from(data) });
  }

  async receive(filter?: (data: Uint8Array) => boolean, timeoutMs?: number): Promise<Uint8Array> {
    if (!this.isConnected) throw new Error('Device not connected');

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

    const actualTimeout = timeoutMs || 3000;
    return new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.pendingResolvers.findIndex(r => r.resolve === resolveAndClear);
        if (idx !== -1) {
          this.pendingResolvers.splice(idx, 1);
        }
        reject(new Error('ZMK Native BLE Receive Timeout'));
      }, actualTimeout);

      const resolveAndClear = (data: Uint8Array) => {
        clearTimeout(timeout);
        resolve(data);
      };

      this.pendingResolvers.push({ resolve: resolveAndClear, filter });
    });
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }

  getDeviceInfo(): NativeDeviceInfo {
    return this.deviceInfo;
  }

  private handleFrame(payload: Uint8Array): void {
    const resolverIndex = this.pendingResolvers.findIndex(r => !r.filter || r.filter(payload));
    if (resolverIndex !== -1) {
      const { resolve } = this.pendingResolvers[resolverIndex];
      this.pendingResolvers.splice(resolverIndex, 1);
      resolve(payload);
    } else {
      this.receiveQueue.push(payload);
    }
  }

  private resetQueues(): void {
    this.receiveQueue = [];
    this.pendingResolvers = [];
  }
}
