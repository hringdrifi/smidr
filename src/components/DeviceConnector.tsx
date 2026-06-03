import React from 'react';
import { Power, Usb, Bluetooth, Loader2 } from 'lucide-react';
import { useKeyboardStore } from '@/lib/store';
import { hidTransport } from '@/lib/transport/hid';
import { isTauriRuntime, listTauriZmkBleDevices, TauriZmkBleTransport } from '@/lib/transport/tauri-zmk-ble';
import { ZmkSerialTransport, zmkProtocol } from '@/lib/protocols/zmk';
import { ViaProtocol } from '@/lib/protocols/via';
import { VialProtocol } from '@/lib/protocols/vial';
import { convertVialToSmidr } from '@/lib/protocols/vial-converter';
import { listProjects, saveProject } from '@/lib/storage';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchViaDefinition } from '@/lib/via-definitions';
import { parseKeyboardDefinition } from '@/lib/parser';

type DeviceCandidate =
  | { id: string; kind: 'hid'; label: string; detail: string; device: any }
  | { id: string; kind: 'serial'; label: string; detail: string; port: any }
  | { id: string; kind: 'ble'; label: string; detail: string; deviceId: string };

const VIA_HID_FILTERS = [{ usagePage: 0xFF60, usage: 0x61 }];

export const DeviceConnector: React.FC = () => {
  const { connectedDevice, setConnectedDevice, loadProject } = useKeyboardStore();
  const { t } = useTranslation();
  const authorizedSerialDeviceLabel = t('remap.authorizedSerialDevice');
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState<string | null>(null);
  const [isLoadingDevices, setIsLoadingDevices] = React.useState(false);
  const [availableDevices, setAvailableDevices] = React.useState<DeviceCandidate[]>([]);

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
      isKeymapSyncing: false,
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

  const finishZmkConnection = React.useCallback(async (
    transport: ZmkSerialTransport | TauriZmkBleTransport,
    deviceInfo: { vid: number; pid: number; productName: string; manufacturerName: string }
  ) => {
    setShowMenu(false);
    useKeyboardStore.getState().setActiveTransport(transport);
    registerDisconnectHandler(transport);
    clearDeviceLayoutState();

    setConnectedDevice({
      vid: deviceInfo.vid,
      pid: deviceInfo.pid,
      productName: deviceInfo.productName,
      manufacturerName: deviceInfo.manufacturerName,
      protocolType: 'zmk'
    });

    const deviceVendorProductId = (deviceInfo.vid << 16) | deviceInfo.pid;
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
  }, [clearDeviceLayoutState, loadProject, registerDisconnectHandler, setConnectedDevice]);

  const loadAvailableDevices = React.useCallback(async () => {
    setIsLoadingDevices(true);
    try {
      const candidates: DeviceCandidate[] = [];

      const hidDevices = await hidTransport.getDevices(VIA_HID_FILTERS);
      hidDevices.forEach((device: any, index: number) => {
        const vid = device.vendorId?.toString(16).toUpperCase().padStart(4, '0') || '0000';
        const pid = device.productId?.toString(16).toUpperCase().padStart(4, '0') || '0000';
        candidates.push({
          id: `hid-${device.vendorId}-${device.productId}-${index}`,
          kind: 'hid',
          label: device.productName || 'QMK Keyboard',
          detail: `QMK (VIA / Vial) - VID 0x${vid} PID 0x${pid}`,
          device,
        });
      });

      const serialPorts = await (navigator as any).serial?.getPorts?.();
      serialPorts?.forEach((port: any, index: number) => {
        const info = port.getInfo?.() || {};
        const vid = info.usbVendorId?.toString(16).toUpperCase().padStart(4, '0');
        const pid = info.usbProductId?.toString(16).toUpperCase().padStart(4, '0');
        candidates.push({
          id: `serial-${info.usbVendorId ?? 'unknown'}-${info.usbProductId ?? 'unknown'}-${index}`,
          kind: 'serial',
          label: vid && pid ? `ZMK Studio USB 0x${vid}:0x${pid}` : 'ZMK Studio USB',
          detail: authorizedSerialDeviceLabel,
          port,
        });
      });

      if (isTauriRuntime()) {
        const bleDevices = await listTauriZmkBleDevices();
        bleDevices.forEach((device, index) => {
          if (!device.id) return;
          candidates.push({
            id: `ble-${device.id}-${index}`,
            kind: 'ble',
            label: device.name || 'ZMK Studio BLE',
            detail: 'ZMK Studio (BLE)',
            deviceId: device.id,
          });
        });
      }

      setAvailableDevices(candidates);
    } catch (err) {
      console.warn('Failed to list available keyboard devices:', err);
      setAvailableDevices([]);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [authorizedSerialDeviceLabel]);

  React.useEffect(() => {
    if (showMenu) {
      void loadAvailableDevices();
    }
  }, [loadAvailableDevices, showMenu]);

  const connectHid = async (knownDevice?: any) => {
    setIsConnecting(true);
    setShowMenu(false);
    setConnectionError(null);
    try {
      const device = knownDevice || await hidTransport.requestDevice(VIA_HID_FILTERS);
      
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
                console.log(`Vial detected (v${version}). Fetching Keyboard UID & definition...`);

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
                isVial = true;
                const current = useKeyboardStore.getState().connectedDevice;
                if (current) {
                  useKeyboardStore.getState().setConnectedDevice({ ...current, protocolType: 'vial' });
                }
                console.log('Vial definition loaded and converted.');
              }
            }
          } catch (err) {
            console.log('Not a Vial keyboard or failed to fetch definition.');
            isVial = false;
            smidrData = null;
            keyboardId = BigInt(0);
            const current = useKeyboardStore.getState().connectedDevice;
            if (current) {
              useKeyboardStore.getState().setConnectedDevice({ ...current, protocolType: 'via' });
            }
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
              console.log('No matching VIA project found in local storage. Fetching VIA definition...');
              try {
                const viaDefinition = await fetchViaDefinition(deviceVendorProductId);
                if (viaDefinition) {
                  const parsed = parseKeyboardDefinition(viaDefinition);
                  const currentSettings = useKeyboardStore.getState().settings;
                  const project = {
                    id: crypto.randomUUID(),
                    updatedAt: Date.now(),
                    ...currentSettings,
                    name: device.productName || parsed.name || viaDefinition.name || 'VIA Keyboard',
                    manufacturer: device.manufacturerName || currentSettings.manufacturer || 'Custom',
                    vendorProductId: parsed.vendorProductId ?? deviceVendorProductId,
                    keys: parsed.keys,
                    layoutOptions: parsed.layoutOptions || {},
                    activeOptions: parsed.activeOptions || {},
                    matrix: parsed.matrix || currentSettings.matrix,
                    pins: parsed.pins ? { ...currentSettings.pins, ...parsed.pins } : currentSettings.pins,
                    hardware: parsed.hardware ? { ...currentSettings.hardware, ...parsed.hardware } : currentSettings.hardware,
                    qmk: parsed.qmk ? { ...(currentSettings.qmk || {}), ...parsed.qmk } : currentSettings.qmk,
                    features: parsed.features ? { ...currentSettings.features, ...parsed.features } : currentSettings.features,
                  };

                  saveProject(project);
                  loadProject(project);
                  console.log(`Auto-loaded VIA definition and saved project: ${project.name}`);
                } else {
                  console.log('No matching VIA definition found on usevia.app.');
                  setConnectionError(t('common.layoutMetadataUnavailableTitle'));
                }
              } catch (definitionErr) {
                console.warn('Failed to fetch or import VIA definition:', definitionErr);
                setConnectionError(t('common.layoutMetadataUnavailableTitle'));
              }
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

  const connectZmkSerial = async (knownPort?: any) => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const transport = new ZmkSerialTransport();
      const success = await transport.connect(knownPort);
      if (success) {
        const portInfo = transport.getPortInfo();
        await finishZmkConnection(transport, {
          vid: portInfo.usbVendorId ?? 0,
          pid: portInfo.usbProductId ?? 0,
          productName: 'ZMK Studio (USB)',
          manufacturerName: 'ZMK',
        });
      } else {
        setConnectionError(t('remap.serialPortError'));
      }
    } catch (err) {
      console.error('ZMK Serial Connection failed:', err);
      setConnectionError(err instanceof Error ? err.message : t('remap.serialPortOpenFailed'));
    } finally {
      setIsConnecting(false);
    }
  };

  const connectZmkNativeBle = async (deviceId?: string) => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const transport = new TauriZmkBleTransport();
      const success = await transport.connect(deviceId);
      if (success) {
        const deviceInfo = transport.getDeviceInfo();
        await finishZmkConnection(transport, {
          vid: 0,
          pid: 0,
          productName: deviceInfo.name || 'ZMK Studio (BLE)',
          manufacturerName: 'ZMK',
        });
      } else {
        setConnectionError('Could not connect via native BLE.');
      }
    } catch (err) {
      console.error('ZMK Native BLE Connection failed:', err);
      setConnectionError(err instanceof Error ? err.message : 'Could not connect via native BLE.');
    } finally {
      setIsConnecting(false);
    }
  };

  const connectAvailableDevice = async (candidate: DeviceCandidate) => {
    if (candidate.kind === 'hid') {
      await connectHid(candidate.device);
      return;
    }
    if (candidate.kind === 'serial') {
      await connectZmkSerial(candidate.port);
      return;
    }
    await connectZmkNativeBle(candidate.deviceId);
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
          <div className="absolute top-full left-0 mt-2 w-72 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
            <div className="p-2 border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 flex justify-between items-center select-none">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">{t('remap.connectionMode')}</span>
            </div>
            <div className="p-1 flex flex-col gap-0.5">
              {connectionError && (
                <div className="mx-1 mb-1 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-semibold leading-snug text-red-300">
                  {connectionError}
                </div>
              )}

              {(isLoadingDevices || availableDevices.length > 0) && (
                <div className="mb-1 border-b border-[var(--border-main)] pb-1">
                  <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('remap.availableDevices')}
                  </div>
                  {isLoadingDevices ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-semibold text-[var(--text-muted)]">
                      <Loader2 size={12} className="animate-spin" />
                      {t('remap.scanningDevices')}
                    </div>
                  ) : (
                    availableDevices.map(candidate => (
                      <button
                        key={candidate.id}
                        onClick={() => connectAvailableDevice(candidate)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all text-left cursor-pointer"
                      >
                        {candidate.kind === 'ble' ? (
                          <Bluetooth size={14} className="text-sky-400 shrink-0" />
                        ) : (
                          <Usb size={14} className="text-amber-500 shrink-0" />
                        )}
                        <div className="min-w-0 flex flex-col">
                          <span className="truncate text-[10px] font-bold uppercase tracking-wider">{candidate.label}</span>
                          <span className="truncate text-[9px] text-[var(--text-muted)]">{candidate.detail}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              <button 
                onClick={() => connectHid()}
                className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all text-left cursor-pointer"
              >
                <Usb size={14} className="text-amber-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider">QMK (VIA / Vial)</span>
                  <span className="text-[9px] text-[var(--text-muted)]">{t('remap.connectWebHid')}</span>
                </div>
              </button>

              <button 
                onClick={() => connectZmkSerial()}
                className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all text-left cursor-pointer"
              >
                <Usb size={14} className="text-amber-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider">ZMK Studio (USB)</span>
                  <span className="text-[9px] text-[var(--text-muted)]">{t('remap.connectWebSerial')}</span>
                </div>
              </button>

              <button 
                onClick={isTauriRuntime() ? () => connectZmkNativeBle() : undefined}
                disabled={!isTauriRuntime()}
                title={isTauriRuntime() ? 'Connect via native Windows BLE' : t('remap.unsupportedBle')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-all ${
                  isTauriRuntime()
                    ? 'hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] cursor-pointer'
                    : 'text-[var(--text-muted)] opacity-45 cursor-not-allowed'
                }`}
              >
                <Bluetooth size={14} className={isTauriRuntime() ? 'text-sky-400 shrink-0' : 'text-[var(--text-muted)] shrink-0'} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider">ZMK Studio (BLE)</span>
                  <span className="text-[9px] text-[var(--text-muted)]">
                    {isTauriRuntime() ? 'Native Windows BLE' : t('remap.useUsbOrNative')}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
