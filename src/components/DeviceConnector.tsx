import React from 'react';
import { Power, Usb, Bluetooth, Loader2 } from 'lucide-react';
import { useKeyboardStore } from '@/lib/store';
import { hidTransport } from '@/lib/transport/hid';
import { ZmkSerialTransport, ZmkBleTransport, ZmkProtocol } from '@/lib/protocols/zmk';
import { ViaProtocol } from '@/lib/protocols/via';
import { VialProtocol } from '@/lib/protocols/vial';
import { convertVialToSmidr } from '@/lib/protocols/vial-converter';
import { listProjects } from '@/lib/storage';
import { useTranslation } from '@/hooks/useTranslation';

export const DeviceConnector: React.FC = () => {
  const { connectedDevice, setConnectedDevice, loadProject } = useKeyboardStore();
  const { t } = useTranslation();
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);

  const connectHid = async () => {
    setIsConnecting(true);
    setShowMenu(false);
    try {
      const filters = [{ usagePage: 0xFF60, usage: 0x61 }];
      const device = await hidTransport.requestDevice(filters);
      
      if (device) {
        const success = await hidTransport.connect(device);
        if (success) {
          // Store active transport
          useKeyboardStore.getState().setActiveTransport(hidTransport);

          // Initialize connected device in store
          setConnectedDevice({
            vid: device.vendorId,
            pid: device.productId,
            productName: device.productName,
            manufacturerName: device.manufacturerName,
            protocolType: 'via'
          });

          // Check for Vial compatibility & fetch UID
          const vial = new VialProtocol();
          let isVial = false;
          let smidrData: any = null;
          let keyboardId = BigInt(0);

          try {
            const initSuccess = await vial.initialize(hidTransport);
            if (initSuccess) {
              useKeyboardStore.getState().setDeviceCapabilities(vial.capabilities);
              const version = await vial.getVialVersion();
              if (version > 0) {
                isVial = true;
                console.log(`Vial detected (v${version}). Fetching Keyboard UID & definition...`);
                
                const current = useKeyboardStore.getState().connectedDevice;
                if (current) {
                  useKeyboardStore.getState().setConnectedDevice({ ...current, protocolType: 'vial' });
                }
                
                try {
                  keyboardId = await vial.getKeyboardId();
                  console.log('Vial Unique ID:', keyboardId.toString(16).toUpperCase());
                } catch (uidErr) {
                  console.warn('Failed to fetch Vial Keyboard UID:', uidErr);
                }
                
                const vialJson = await vial.getDefinition();
                
                let layoutOptions = 0;
                try {
                  layoutOptions = await vial.getLayoutOptions();
                  console.log('Vial Layout Options Mask:', layoutOptions);
                } catch (e) {
                  console.warn('Failed to fetch layout options, defaulting to 0');
                }

                smidrData = convertVialToSmidr(vialJson, layoutOptions);
                console.log('Vial definition loaded and converted.');
              }
            }
          } catch (err) {
            console.log('Not a Vial keyboard or failed to fetch definition.');
          }

          // Match connected device against local storage projects
          const deviceVendorProductId = (device.vendorId << 16) | device.productId;
          const projects = listProjects();
          
          const match = projects.find(p => {
            if (isVial && keyboardId > BigInt(0) && p.vialUid) {
              const hexUid = `0x${keyboardId.toString(16).toUpperCase()}`;
              if (hexUid === p.vialUid.toUpperCase()) return true;
            }

            let projectVpid = p.vendorProductId;
            if (!projectVpid && p.vid && p.pid) {
              const parsedVid = parseInt(String(p.vid).replace(/0[xX]/, ''), 16) || 0;
              const parsedPid = parseInt(String(p.pid).replace(/0[xX]/, ''), 16) || 0;
              projectVpid = (parsedVid << 16) | parsedPid;
            }
            return projectVpid === deviceVendorProductId;
          });

          if (isVial && smidrData) {
            if (match) {
              console.log(`Auto-loading project: ${match.name} (matching Vial keyboard)`);
            } else {
              console.log('No matching project in storage. Creating new Vial project...');
            }

            const currentSettings = useKeyboardStore.getState().settings;
            loadProject({
              id: match?.id || crypto.randomUUID(),
              updatedAt: Date.now(),
              ...currentSettings,
              ...smidrData.settings,
              name: device.productName || smidrData.settings.name || 'Vial Keyboard',
              manufacturer: device.manufacturerName || smidrData.settings.manufacturer || 'Custom',
              vendorProductId: deviceVendorProductId,
              vialUid: keyboardId > BigInt(0) ? `0x${keyboardId.toString(16).toUpperCase()}` : undefined,
              keys: smidrData.keys,
            });
          } else {
            if (match) {
              console.log(`Auto-loading VIA project: ${match.name}`);
              loadProject({
                ...match,
                name: device.productName || match.name || 'VIA Keyboard',
                manufacturer: device.manufacturerName || match.manufacturer || 'Custom',
              });
            } else {
              console.log('No matching VIA project found in local storage.');
            }
          }

          console.log('Fetching initial keymap...');
          await useKeyboardStore.getState().syncKeymap();
        }
      }
    } catch (err) {
      console.error('Connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectZmkSerial = async () => {
    setIsConnecting(true);
    setShowMenu(false);
    try {
      const transport = new ZmkSerialTransport();
      const success = await transport.connect();
      if (success) {
        useKeyboardStore.getState().setActiveTransport(transport);

        // Store ZMK connected device details
        setConnectedDevice({
          vid: 0x1D50,
          pid: 0x615E,
          productName: 'ZMK Studio (USB)',
          manufacturerName: 'ZMK',
          protocolType: 'zmk'
        });

        // Initialize ZmkProtocol to load capabilities
        const zmk = new ZmkProtocol();
        await zmk.initialize(transport);
        useKeyboardStore.getState().setDeviceCapabilities(zmk.capabilities);
      }
    } catch (err) {
      console.error('ZMK Serial Connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectZmkBle = async () => {
    setIsConnecting(true);
    setShowMenu(false);
    try {
      const transport = new ZmkBleTransport();
      const success = await transport.connect();
      if (success) {
        useKeyboardStore.getState().setActiveTransport(transport);

        // Store ZMK connected device details
        setConnectedDevice({
          vid: 0,
          pid: 0,
          productName: 'ZMK Studio (BLE)',
          manufacturerName: 'ZMK',
          protocolType: 'zmk'
        });

        // Initialize ZmkProtocol to load capabilities
        const zmk = new ZmkProtocol();
        await zmk.initialize(transport);
        useKeyboardStore.getState().setDeviceCapabilities(zmk.capabilities);
      }
    } catch (err) {
      console.error('ZMK BLE Connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const { activeTransport, setActiveTransport } = useKeyboardStore.getState();
    const transport = activeTransport || hidTransport;
    await transport.disconnect();
    setConnectedDevice(null);
    useKeyboardStore.getState().setDeviceCapabilities(null);
    setActiveTransport(null);
  };

  if (connectedDevice) {
    return (
      <button 
        onClick={handleDisconnect}
        className="flex items-center gap-2 px-3 h-8 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-all active:scale-95 uppercase tracking-wider cursor-pointer"
      >
        <Power size={14} />
        {t('remap.disconnect') || 'Disconnect'}
      </button>
    );
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setShowMenu(!showMenu)}
        disabled={isConnecting}
        className="flex items-center gap-2 px-3 h-8 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
      >
        {isConnecting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Usb size={14} />
        )}
        {isConnecting ? (t('remap.connecting') || 'Connecting...') : (t('remap.connect') || 'Connect')}
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-[45]" onClick={() => setShowMenu(false)} />
          <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
            <div className="p-2 border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 flex justify-between items-center select-none">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">Connection Mode</span>
            </div>
            <div className="p-1 flex flex-col gap-0.5">
              <button 
                onClick={connectHid}
                className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all text-left cursor-pointer"
              >
                <Usb size={14} className="text-amber-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider">QMK (VIA / Vial)</span>
                  <span className="text-[9px] text-[var(--text-muted)]">Connect via WebHID</span>
                </div>
              </button>

              <button 
                onClick={connectZmkSerial}
                className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all text-left cursor-pointer"
              >
                <Usb size={14} className="text-amber-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider">ZMK Studio (USB)</span>
                  <span className="text-[9px] text-[var(--text-muted)]">Connect via WebSerial / COM Port</span>
                </div>
              </button>

              <button 
                onClick={connectZmkBle}
                className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all text-left cursor-pointer"
              >
                <Bluetooth size={14} className="text-amber-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider">ZMK Studio (BLE)</span>
                  <span className="text-[9px] text-[var(--text-muted)]">Connect via WebBLE / Bluetooth</span>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
