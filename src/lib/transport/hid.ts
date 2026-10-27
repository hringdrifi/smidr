/**
 * WebHID Transport for VIA/Vial and other HID-based protocols.
 * 
 * Design follows the Vial reference implementation (util.py hid_send):
 * - Simple send → receive pattern with no response filtering
 * - Retry mechanism for resilience (retries parameter)
 * - Device always responds to the last command sent
 */
import { ITransport } from './types';

const HID_TIMEOUT_MS = 2000;

export class HidTransport implements ITransport {
  private device: any = null;
  private disconnectCallback: (() => void) | null = null;
  private disconnectNotified = false;

  private handleDeviceDisconnect = (event: any) => {
    if (event.device && this.device && event.device !== this.device) return;
    this.handleUnexpectedDisconnect();
  };

  private handleUnexpectedDisconnect() {
    if (this.disconnectNotified) return;
    this.disconnectNotified = true;
    this.device = null;
    this.disconnectCallback?.();
  }

  async requestDevice(filters: any[]): Promise<any> {
    try {
      const devices = await (navigator as any).hid.requestDevice({ filters });
      if (devices && devices.length > 0) {
        return devices[0];
      }
    } catch (err) {
      console.error('HID Request Device Error:', err);
    }
    return null;
  }

  async getDevices(filters: any[] = []): Promise<any[]> {
    try {
      const devices = await (navigator as any).hid?.getDevices?.();
      if (!devices) return [];

      if (filters.length === 0) return devices;
      return devices.filter((device: any) => {
        return device.collections?.some((collection: any) => {
          return filters.some(filter => {
            const usagePageMatches = filter.usagePage === undefined || filter.usagePage === collection.usagePage;
            const usageMatches = filter.usage === undefined || filter.usage === collection.usage;
            return usagePageMatches && usageMatches;
          });
        });
      });
    } catch (err) {
      console.error('HID Get Devices Error:', err);
      return [];
    }
  }

  // ITransport connection contract (allows dynamic device mapping)
  async connect(device?: any): Promise<boolean> {
    try {
      const targetDevice = device || this.device;
      if (!targetDevice) {
        console.warn('HID Connect: No device supplied or currently cached.');
        return false;
      }
      
      if (!targetDevice.opened) {
        await targetDevice.open();
      }
      this.device = targetDevice;
      this.disconnectNotified = false;
      (navigator as any).hid?.removeEventListener?.('disconnect', this.handleDeviceDisconnect);
      (navigator as any).hid?.addEventListener?.('disconnect', this.handleDeviceDisconnect);
      return true;
    } catch (err) {
      console.error('HID Connect Error:', err);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    (navigator as any).hid?.removeEventListener?.('disconnect', this.handleDeviceDisconnect);
    if (this.device) {
      await this.device.close();
      this.device = null;
    }
    this.disconnectNotified = true;
  }

  // Agnostic send method supporting general raw arrays
  async send(data: Uint8Array): Promise<void> {
    if (!this.device) throw new Error('Device not connected');
    await this.device.sendReport(0, data); // Report ID 0 is standard for raw HID
  }

  /**
   * Receive the next HID input report from the device.
   * 
   * Following the Vial reference implementation, this accepts the FIRST report
   * that arrives — no filtering. The filter parameter is accepted for interface
   * compatibility but is intentionally ignored.
   */
  async receive(_filter?: (data: Uint8Array) => boolean, timeoutMs?: number): Promise<Uint8Array> {
    if (!this.device) throw new Error('Device not connected');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.device) this.device.oninputreport = null;
        reject(new Error('HID Timeout'));
      }, timeoutMs || HID_TIMEOUT_MS);

      this.device.oninputreport = (event: any) => {
        clearTimeout(timeout);
        const data = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
        if (this.device) this.device.oninputreport = null;
        resolve(data);
      };
    });
  }

  // Compatibility and utility methods for direct backward references
  async sendReport(reportId: number, data: Uint8Array): Promise<void> {
    if (!this.device) throw new Error('Device not connected');
    await this.device.sendReport(reportId, data);
  }

  onInputReport(callback: (event: any) => void) {
    if (!this.device) return;
    this.device.oninputreport = callback;
  }

  async waitForReport(_filter?: (data: Uint8Array) => boolean): Promise<Uint8Array> {
    return this.receive();
  }

  get isConnected(): boolean {
    return !!this.device && this.device.opened;
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }
}

export const hidTransport = new HidTransport();
