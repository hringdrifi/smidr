import React from 'react';
import { Power, Usb, Bluetooth, Loader2 } from 'lucide-react';
import { useKeyboardStore } from '@/lib/store';
import { hidTransport } from '@/lib/transport/hid';
import { ZmkSerialTransport, zmkProtocol } from '@/lib/protocols/zmk';
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
  const [connectionError, setConnectionError] = React.useState<string | null>(null);

  const clearDeviceLayoutState = React.useCallback(() => {
    zmkProtocol.resetRuntimeState();
    useKeyboardStore.setState({
      keys: [],
      baseKeys: [],
      selectedKeyIds: [],
      focusedKeyId: null,
      selectionAnchorId: null,
      currentLayer: 0,
      currentProjectId: null,
      isProjectOpen: false,
      remoteKeymap: {},
      remoteMacros: Array(16).fill(null).map(() => []),
      remoteCombos: [],
      zmkLocked: false,
      zmkUnsavedChanges: false,
    });
  }, []);

  const clearConnectedDevice = React.useCallback(() => {
    const { setActiveTransport } = useKeyboardStore.getState();
    console.warn('Keyboard disconnected.');
    clearDeviceLayoutState();
    setConnectedDevice(null);
    useKeyboardStore.getState().setDeviceCapabilities(null);
    setActiveTransport(null);
  }, [clearDeviceLayoutState, setConnectedDevice]);

  const registerDisconnectHandler = React.useCallback((transport: { onDisconnect?: (callback: () => void) => void }) => {
    transport.onDisconnect?.(clearConnectedDevice);
  }, [clearConnectedDevice]);

  const connectHid = async () => {
    setIsConnecting(true);
    setShowMenu(false);
    setConnectionError(null);
    try {
      const filters = [{ usagePage: 0xFF60, usage: 0x61 }];
      const device = await hidTransport.requestDevice(filters);
      
      if (device) {
        const success = await hidTransport.connect(device);
        if (success) {
          // Store active transport
          useKeyboardStore.getState().setActiveTransport(hidTransport);
          registerDisconnectHandler(hidTransport);
          clearDeviceLayoutState();

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

            return p.vendorProductId === deviceVendorProductId;
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
    setConnectionError(null);
    try {
      const transport = new ZmkSerialTransport();
      const success = await transport.connect();
      if (success) {
        const portInfo = transport.getPortInfo();
        const vid = portInfo.usbVendorId ?? 0;
        const pid = portInfo.usbProductId ?? 0;
        setShowMenu(false);
        useKeyboardStore.getState().setActiveTransport(transport);
        registerDisconnectHandler(transport);
        clearDeviceLayoutState();

        // Store ZMK connected device details
        setConnectedDevice({
          vid,
          pid,
          productName: 'ZMK Studio (USB)',
          manufacturerName: 'ZMK',
          protocolType: 'zmk'
        });

        // Match connected device against local storage projects
        const deviceVendorProductId = (vid << 16) | pid;
        const projects = listProjects();
        const match = projects.find(p => {
          if (!deviceVendorProductId) return false;
          return p.vendorProductId === deviceVendorProductId;
        });

        if (match) {
          console.log(`Auto-loading ZMK project: ${match.name}`);
          loadProject({
            ...match,
            name: match.name || 'ZMK Keyboard',
            manufacturer: match.manufacturer || 'ZMK',
          });
        }

        console.log('Fetching initial keymap...');
        await useKeyboardStore.getState().syncKeymap();
      } else {
        setConnectionError('Could not open the serial port. Check that the keyboard is not already open in another app, then try again.');
      }
    } catch (err) {
      console.error('ZMK Serial Connection failed:', err);
      setConnectionError(err instanceof Error ? err.message : 'Could not open the serial port.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const { activeTransport, setActiveTransport } = useKeyboardStore.getState();
    const transport = activeTransport || hidTransport;
    await transport.disconnect();
    clearDeviceLayoutState();
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
        onClick={() => {
          setConnectionError(null);
          setShowMenu(!showMenu);
        }}
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
              {connectionError && (
                <div className="mx-1 mb-1 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-semibold leading-snug text-red-300">
                  {connectionError}
                </div>
              )}

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
                disabled
                title="ZMK Studio BLE editing is not supported in Chrome on Windows. Use USB or the native ZMK Studio app."
                className="w-full flex items-center gap-3 px-3 py-2 rounded text-[var(--text-muted)] opacity-45 text-left cursor-not-allowed"
              >
                <Bluetooth size={14} className="text-[var(--text-muted)] shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider">ZMK Studio (BLE)</span>
                  <span className="text-[9px] text-[var(--text-muted)]">Use USB or native app</span>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
