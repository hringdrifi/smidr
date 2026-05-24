import React from 'react';
import { Power, Usb } from 'lucide-react';
import { useKeyboardStore } from '@/lib/store';
import { hidTransport } from '@/lib/transport/hid';
import { ViaProtocol } from '@/lib/protocols/via';
import { VialProtocol } from '@/lib/protocols/vial';
import { convertVialToSmidr, unpackLayoutOptions } from '@/lib/protocols/vial-converter';
import { listProjects } from '@/lib/storage';
import { useTranslation } from '@/hooks/useTranslation';

export const DeviceConnector: React.FC = () => {
  const { connectedDevice, setConnectedDevice, setRemoteKeymap, keys, loadProject } = useKeyboardStore();
  const { t } = useTranslation();
  const [isConnecting, setIsConnecting] = React.useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const filters = [{ usagePage: 0xFF60, usage: 0x61 }];
      const device = await hidTransport.requestDevice(filters);
      
      if (device) {
        const success = await hidTransport.connect(device);
        if (success) {
          // Initialize connected device in store
          setConnectedDevice({
            vid: device.vendorId,
            pid: device.productId,
            productName: device.productName,
            manufacturerName: device.manufacturerName
          });

          // Check for Vial compatibility & fetch UID
          const vial = new VialProtocol();
          let isVial = false;
          let smidrData: any = null;
          let vialJson: any = null;
          let keyboardId = BigInt(0);

          try {
            const initSuccess = await vial.initialize(hidTransport);
            if (initSuccess) {
              useKeyboardStore.getState().setDeviceCapabilities(vial.capabilities);
              const version = await vial.getVialVersion();
            if (version > 0) {
              isVial = true;
              console.log(`Vial detected (v${version}). Fetching Keyboard UID & definition...`);
              
              try {
                keyboardId = await vial.getKeyboardId();
                console.log('Vial Unique ID:', keyboardId.toString(16).toUpperCase());
              } catch (uidErr) {
                console.warn('Failed to fetch Vial Keyboard UID:', uidErr);
              }
              
              vialJson = await vial.getDefinition();
              
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
            // 1. If we have a Vial UID from the physical device, match by UID (highly precise)
            if (isVial && keyboardId > BigInt(0) && p.vialUid) {
              const hexUid = `0x${keyboardId.toString(16).toUpperCase()}`;
              if (hexUid === p.vialUid.toUpperCase()) return true;
            }

            // 2. Otherwise, fall back to matching by vendorProductId
            let projectVpid = p.vendorProductId;
            if (!projectVpid && p.vid && p.pid) {
              const parsedVid = parseInt(String(p.vid).replace(/0[xX]/, ''), 16) || 0;
              const parsedPid = parseInt(String(p.pid).replace(/0[xX]/, ''), 16) || 0;
              projectVpid = (parsedVid << 16) | parsedPid;
            }
            return projectVpid === deviceVendorProductId;
          });

          // Perform load action based on matched project & Vial detection
          if (isVial && smidrData) {
            // Load from Vial keyboard (the absolute source of truth), matching project ID if found
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
            // VIA or non-Vial keyboard: load the matched local storage project directly
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

          // Fetch current keymap (sync physical keybindings)
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

  const handleDisconnect = async () => {
    await hidTransport.disconnect();
    setConnectedDevice(null);
    useKeyboardStore.getState().setDeviceCapabilities(null);
  };

  if (connectedDevice) {
    return (
      <button 
        onClick={handleDisconnect}
        className="flex items-center gap-2 px-3 h-8 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-all active:scale-95 uppercase tracking-wider"
      >
        <Power size={14} />
        {t('remap.disconnect') || 'Disconnect'}
      </button>
    );
  }

  return (
    <button 
      onClick={handleConnect}
      disabled={isConnecting}
      className="flex items-center gap-2 px-3 h-8 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95 disabled:opacity-50"
    >
      <Usb size={14} />
      {isConnecting ? (t('remap.connecting') || 'Connecting...') : (t('remap.connect') || 'Connect')}
    </button>
  );
};
