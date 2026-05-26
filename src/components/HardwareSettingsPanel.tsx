'use client';

import React from 'react';
import { useKeyboardStore } from '@/lib/store';
import { Settings, Cpu, HardDrive, Hash, Lightbulb, Gauge, Monitor, ShieldCheck, ChevronRight, ChevronDown, Database, X, Check, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from '@/hooks/useTranslation';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Section = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
  <div className="bg-[var(--bg-panel)]/50 border border-[var(--border-main)] rounded-lg overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-main)] bg-[var(--bg-panel)]/80">
      <Icon size={16} className="text-amber-500" />
      <h2 className="text-xs font-bold text-[var(--text-highlight)] uppercase tracking-wider">{title}</h2>
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
);

const PinInput = ({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string }) => (
  <div className="space-y-1">
    <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase">{label}</label>
    <input 
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-amber-500 font-mono transition-all"
    />
  </div>
);

const InteractivePinSlot = ({
  label,
  value,
  isFocused,
  onFocus,
  onClear
}: {
  label: string;
  value: string;
  isFocused: boolean;
  onFocus: () => void;
  onClear: () => void;
}) => {
  return (
    <div className="space-y-1">
      <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase">{label}</label>
      <div 
        onClick={onFocus}
        className={cn(
          "w-full h-8 flex items-center justify-between bg-[var(--bg-app)] border rounded px-2 text-xs font-mono cursor-pointer transition-all duration-200",
          isFocused 
            ? "border-amber-500 ring-1 ring-amber-500 text-amber-500" 
            : value 
            ? "border-[var(--border-main)] text-[var(--text-highlight)] hover:border-amber-500/50" 
            : "border-dashed border-[var(--border-main)] text-[var(--text-muted)] hover:border-amber-500/50 hover:text-[var(--text-main)]"
        )}
      >
        <span className="truncate">{value || '+ Assign'}</span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="p-0.5 rounded hover:bg-zinc-750 text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            <X size={10} />
          </button>
        )}
      </div>
    </div>
  );
};

const PinTagInput = ({
  type,
  pins,
  isActive,
  onFocus,
  onUpdatePins
}: {
  type: 'row' | 'col';
  pins: string[];
  isActive: boolean;
  onFocus: () => void;
  onUpdatePins: (newPins: string[]) => void;
}) => {
  const [inputValue, setInputValue] = React.useState('');
  const [draggedIdx, setDraggedIdx] = React.useState<number | null>(null);

  const handleAddFromText = (text: string) => {
    if (!text.trim()) return;
    const parts = text.split(/[\s,]+/).map(p => p.trim().toUpperCase()).filter(Boolean);
    onUpdatePins([...pins, ...parts]);
    setInputValue('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(' ') || val.includes(',')) {
      handleAddFromText(val);
    } else {
      setInputValue(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFromText(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && pins.length > 0) {
      onUpdatePins(pins.slice(0, -1));
    }
  };

  const handleInputBlur = () => {
    handleAddFromText(inputValue);
  };

  const handleRemovePin = (idxToRemove: number) => {
    onUpdatePins(pins.filter((_, idx) => idx !== idxToRemove));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) return;
    
    const newPins = [...pins];
    const [movedPin] = newPins.splice(draggedIdx, 1);
    newPins.splice(targetIndex, 0, movedPin);
    
    onUpdatePins(newPins);
    setDraggedIdx(null);
  };

  return (
    <div className="space-y-1 w-full">
      <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase font-bold tracking-wider">
        {type === 'row' ? 'Row Pins (行)' : 'Col Pins (列)'}
      </label>
      <div 
        onClick={onFocus}
        className={cn(
          "w-full min-h-12 flex flex-wrap gap-1.5 items-center bg-[var(--bg-app)] border rounded-lg p-2 cursor-text transition-all duration-200",
          isActive 
            ? "border-amber-500 ring-1 ring-amber-500 text-amber-500" 
            : "border-[var(--border-main)] hover:border-amber-500/30"
        )}
      >
        {pins.map((pinName, index) => {
          const isDragging = draggedIdx === index;
          return (
            <div
              key={`${pinName}-${index}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => setDraggedIdx(null)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-main)] text-xs font-mono select-none cursor-grab active:cursor-grabbing transition-all",
                isDragging ? "opacity-35 border-dashed border-amber-500/50" : "hover:border-amber-500/50 text-[var(--text-highlight)]"
              )}
            >
              <span className="text-[10px] text-amber-500 font-bold">{index}:</span>
              <span className="text-[var(--text-highlight)]">{pinName}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePin(index);
                }}
                className="p-0.5 rounded hover:bg-zinc-700/50 text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          onFocus={onFocus}
          placeholder={pins.length === 0 ? "Type or click pins..." : "+ Add"}
          className="flex-1 min-w-[100px] bg-transparent outline-none border-none text-xs text-[var(--text-highlight)] font-mono py-0.5"
        />
      </div>
    </div>
  );
};

export const HardwareSettingsPanel = () => {
  const { settings, updateSettings, setPin } = useKeyboardStore();
  const { t } = useTranslation();

  const [activeBox, setActiveBox] = React.useState<'row' | 'col' | 'feature' | null>(null);
  const [focusedFeature, setFocusedFeature] = React.useState<string | null>(null);
  const [preventDuplicates, setPreventDuplicates] = React.useState<boolean>(true);
  const [customPinText, setCustomPinText] = React.useState<string>('');

  const rp2040Pins = [
    'GP0', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5', 'GP6', 'GP7',
    'GP8', 'GP9', 'GP10', 'GP11', 'GP12', 'GP13', 'GP14', 'GP15',
    'GP16', 'GP17', 'GP18', 'GP19', 'GP20', 'GP21', 'GP22',
    'GP23', 'GP24', 'GP25', 'GP26', 'GP27', 'GP28', 'GP29'
  ];

  const atmega32u4Pins = [
    'B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7',
    'C6', 'C7',
    'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D7',
    'E6',
    'F0', 'F1', 'F4', 'F5', 'F6', 'F7'
  ];

  const genericPins = Array.from({ length: 20 }, (_, i) => `P${i}`);

  const getPinPool = () => {
    if (settings.hardware.mcu === 'rp2040') return rp2040Pins;
    if (settings.hardware.mcu === 'atmega32u4') return atmega32u4Pins;
    return genericPins;
  };

  const getAssignedPins = () => {
    const pins = new Set<string>();
    settings.pins.rows.forEach(p => p && pins.add(p));
    settings.pins.cols.forEach(p => p && pins.add(p));
    if (settings.pins.rgb) pins.add(settings.pins.rgb);
    if (settings.pins.sda) pins.add(settings.pins.sda);
    if (settings.pins.scl) pins.add(settings.pins.scl);
    if (settings.pins.encoderA) pins.add(settings.pins.encoderA);
    if (settings.pins.encoderB) pins.add(settings.pins.encoderB);
    if (settings.pins.splitSerial) pins.add(settings.pins.splitSerial);
    return pins;
  };

  const assignedPins = getAssignedPins();

  const handleAssignPin = (pinName: string) => {
    if (activeBox === 'row') {
      if (preventDuplicates && assignedPins.has(pinName)) {
        if (!settings.pins.rows.includes(pinName)) return;
      }
      const newPins = [...settings.pins.rows, pinName];
      updateSettings({
        matrix: { ...settings.matrix, rows: newPins.length },
        pins: { ...settings.pins, rows: newPins }
      });
    } else if (activeBox === 'col') {
      if (preventDuplicates && assignedPins.has(pinName)) {
        if (!settings.pins.cols.includes(pinName)) return;
      }
      const newPins = [...settings.pins.cols, pinName];
      updateSettings({
        matrix: { ...settings.matrix, cols: newPins.length },
        pins: { ...settings.pins, cols: newPins }
      });
    } else if (activeBox === 'feature' && focusedFeature) {
      if (preventDuplicates && assignedPins.has(pinName)) {
        const currentVal = (settings.pins as any)[focusedFeature];
        if (currentVal !== pinName) return;
      }
      setPin('feature', focusedFeature, pinName);
    }
  };

  const handleClearAllPins = () => {
    updateSettings({
      matrix: { ...settings.matrix, rows: 0, cols: 0 },
      pins: {
        rows: [],
        cols: [],
        rgb: '',
        sda: '',
        scl: '',
        encoderA: '',
        encoderB: '',
        splitSerial: ''
      }
    });
    setActiveBox(null);
    setFocusedFeature(null);
  };

  const updateHardware = (updates: Partial<typeof settings.hardware>) => {
    updateSettings({ hardware: { ...settings.hardware, ...updates } });
  };

  const toggleFeature = (key: keyof typeof settings.features) => {
    updateSettings({ features: { ...settings.features, [key]: !settings.features[key] } });
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* General & USB */}
      <Section title={t('hardware.identity')} icon={Settings}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.kbName')}</label>
              <input type="text" value={settings.name} onChange={(e) => updateSettings({ name: e.target.value })} className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.manufacturer')}</label>
              <input type="text" value={settings.manufacturer} onChange={(e) => updateSettings({ manufacturer: e.target.value })} className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PinInput 
              label={t('hardware.vidHex')} 
              value={`0x${(settings.vendorProductId >>> 16).toString(16).toUpperCase().padStart(4, '0')}`} 
              onChange={(v) => {
                const vid = parseInt(v.replace('0x', ''), 16) || 0;
                const pid = settings.vendorProductId & 0xFFFF;
                updateSettings({ vendorProductId: (vid << 16) | pid });
              }} 
              placeholder="0xFEED" 
            />
            <PinInput 
              label={t('hardware.pidHex')} 
              value={`0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`} 
              onChange={(v) => {
                const pid = parseInt(v.replace('0x', ''), 16) || 0;
                const vid = settings.vendorProductId >>> 16;
                updateSettings({ vendorProductId: (vid << 16) | pid });
              }} 
              placeholder="0x0001" 
            />
          </div>
        </div>
      </Section>

      {/* Controller & Matrix */}
      <Section title={t('hardware.mcu')} icon={Cpu}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.controller')}</label>
            <select 
              value={settings.hardware.mcu}
              onChange={(e) => updateHardware({ mcu: e.target.value as any })}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]"
            >
              <option value="rp2040">Raspberry Pi RP2040</option>
              <option value="atmega32u4">ATmega32U4 (Pro Micro)</option>
              <option value="other">{t('hardware.otherMcu')}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.diodeDir')}</label>
            <div className="flex bg-[var(--bg-app)] p-1 rounded border border-[var(--border-main)]">
              {(['COL2ROW', 'ROW2COL'] as const).map(dir => (
                <button
                  key={dir}
                  onClick={() => updateHardware({ diodeDirection: dir })}
                  className={cn(
                    "flex-1 py-1 text-[10px] font-bold rounded transition-all",
                    settings.hardware.diodeDirection === dir ? "bg-amber-500 text-[var(--bg-button)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  )}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Features Toggles */}
      <Section title={t('hardware.features')} icon={ShieldCheck}>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'rgb', label: t('hardware.rgb'), icon: Lightbulb },
            { id: 'encoder', label: t('hardware.encoder'), icon: Gauge },
            { id: 'oled', label: t('hardware.oled'), icon: Monitor },
            { id: 'via', label: t('hardware.via'), icon: Database },
            { id: 'split', label: t('hardware.split'), icon: HardDrive },
          ].map(feat => (
            <React.Fragment key={feat.id}>
              <button
                onClick={() => toggleFeature(feat.id as any)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                  settings.features[feat.id as keyof typeof settings.features]
                    ? "bg-amber-500/10 border-amber-500/50 text-amber-500"
                    : "bg-[var(--bg-app)] border-[var(--border-main)] text-[var(--text-muted)] grayscale opacity-60"
                )}
              >
                <feat.icon size={18} />
                <span className="text-xs font-bold leading-none">{feat.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </Section>

      {/* Vial Settings */}
      <Section title={t('hardware.vialSpec')} icon={ShieldCheck}>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{t('hardware.vialSpec')}</span>
            <button 
              onClick={() => {
                const p1 = Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0');
                const p2 = Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0');
                updateSettings({ vialUid: `0x${p1}${p2}` });
              }}
              className="text-[9px] text-[var(--text-muted)] hover:text-amber-500 transition-colors"
            >
              {t('hardware.genId')}
            </button>
          </div>
          <PinInput 
            label={t('hardware.vialUid')} 
            value={settings.vialUid || '0x0000000000000000'} 
            onChange={(v) => {
              const cleanHex = v.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
              updateSettings({ vialUid: `0x${cleanHex}` });
            }} 
            placeholder="e.g. 0xFB23... (Automatically derived)"
          />
          <p className="text-[9px] text-[var(--text-muted)] leading-relaxed italic">
            {t('hardware.vialDesc')}
          </p>
        </div>
      </Section>

      {/* Dynamic Pin Assignments */}
      <Section title={t('hardware.pins')} icon={Hash}>
        <div className="space-y-6">
          {/* Grid setup with dynamic sizing label */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-[var(--text-main)] uppercase tracking-wider">{t('hardware.matrixGrid')}</h3>
              <div className="flex items-center gap-3">
                {/* Dynamic Size Indicator - Borderless & Clean */}
                <div className="flex gap-1 items-center text-xs text-[var(--text-highlight)] font-mono font-bold select-none animate-in fade-in zoom-in duration-200">
                  <span>{settings.matrix.rows}</span>
                  <span className="text-[var(--text-dim)] font-sans font-normal mx-0.5">×</span>
                  <span>{settings.matrix.cols}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-sans font-normal ml-1">({settings.matrix.rows * settings.matrix.cols} keys)</span>
                </div>

                {/* Clear All Pins Button */}
                <button
                  type="button"
                  onClick={handleClearAllPins}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 hover:border-red-500/40 text-[9px] font-bold cursor-pointer transition-all active:scale-95"
                >
                  <Trash2 size={10} />
                  <span>全ピンをクリア</span>
                </button>
              </div>
            </div>
            
            {/* Rows Tag Input Box */}
            <PinTagInput
              type="row"
              pins={settings.pins.rows}
              isActive={activeBox === 'row'}
              onFocus={() => {
                setActiveBox('row');
                setFocusedFeature(null);
              }}
              onUpdatePins={(newPins) => {
                updateSettings({
                  matrix: { ...settings.matrix, rows: newPins.length },
                  pins: { ...settings.pins, rows: newPins }
                });
              }}
            />

            {/* Cols Tag Input Box */}
            <PinTagInput
              type="col"
              pins={settings.pins.cols}
              isActive={activeBox === 'col'}
              onFocus={() => {
                setActiveBox('col');
                setFocusedFeature(null);
              }}
              onUpdatePins={(newPins) => {
                updateSettings({
                  matrix: { ...settings.matrix, cols: newPins.length },
                  pins: { ...settings.pins, cols: newPins }
                });
              }}
            />
          </div>

          {/* Special Pin Slots */}
          {(settings.features.rgb || settings.features.encoder || settings.features.oled || settings.features.split) && (
            <div className="space-y-3 border-t border-[var(--border-main)] pt-4">
              <h3 className="text-[10px] font-bold text-[var(--text-main)] uppercase tracking-wider">{t('hardware.specialPins')}</h3>
              <div className="grid grid-cols-2 gap-4">
                {settings.features.rgb && (
                  <InteractivePinSlot 
                    label={t('hardware.rgbData')} 
                    value={settings.pins.rgb || ''} 
                    isFocused={activeBox === 'feature' && focusedFeature === 'rgb'}
                    onFocus={() => {
                      setActiveBox('feature');
                      setFocusedFeature('rgb');
                    }}
                    onClear={() => setPin('feature', 'rgb', '')}
                  />
                )}
                {settings.features.oled && (
                  <>
                    <InteractivePinSlot 
                      label={t('hardware.i2cSda')} 
                      value={settings.pins.sda || ''} 
                      isFocused={activeBox === 'feature' && focusedFeature === 'sda'}
                      onFocus={() => {
                        setActiveBox('feature');
                        setFocusedFeature('sda');
                      }}
                      onClear={() => setPin('feature', 'sda', '')}
                    />
                    <InteractivePinSlot 
                      label={t('hardware.i2cScl')} 
                      value={settings.pins.scl || ''} 
                      isFocused={activeBox === 'feature' && focusedFeature === 'scl'}
                      onFocus={() => {
                        setActiveBox('feature');
                        setFocusedFeature('scl');
                      }}
                      onClear={() => setPin('feature', 'scl', '')}
                    />
                  </>
                )}
                {settings.features.encoder && (
                  <>
                    <InteractivePinSlot 
                      label={t('hardware.encA')} 
                      value={settings.pins.encoderA || ''} 
                      isFocused={activeBox === 'feature' && focusedFeature === 'encoderA'}
                      onFocus={() => {
                        setActiveBox('feature');
                        setFocusedFeature('encoderA');
                      }}
                      onClear={() => setPin('feature', 'encoderA', '')}
                    />
                    <InteractivePinSlot 
                      label={t('hardware.encB')} 
                      value={settings.pins.encoderB || ''} 
                      isFocused={activeBox === 'feature' && focusedFeature === 'encoderB'}
                      onFocus={() => {
                        setActiveBox('feature');
                        setFocusedFeature('encoderB');
                      }}
                      onClear={() => setPin('feature', 'encoderB', '')}
                    />
                  </>
                )}
                {settings.features.split && (
                  <InteractivePinSlot 
                    label={t('hardware.splitSerial')} 
                    value={settings.pins.splitSerial || ''} 
                    isFocused={activeBox === 'feature' && focusedFeature === 'splitSerial'}
                    onFocus={() => {
                      setActiveBox('feature');
                      setFocusedFeature('splitSerial');
                    }}
                    onClear={() => setPin('feature', 'splitSerial', '')}
                  />
                )}
              </div>
            </div>
          )}

          {/* MCU Pin Pool Panel */}
          <div className="space-y-3 border-t border-[var(--border-main)] pt-4 bg-[var(--bg-app)]/30 p-3 rounded-lg border border-[var(--border-main)]/30">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  Available Pins Pool ({settings.hardware.mcu.toUpperCase()})
                </span>
                {activeBox && (
                  <span className="text-[9px] text-[var(--text-muted)] mt-0.5">
                    Appending to <span className="font-mono text-amber-500 font-bold uppercase">{activeBox === 'row' ? 'Rows (行)' : activeBox === 'col' ? 'Cols (列)' : focusedFeature}</span>. Click a pin below to set it.
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {/* Duplicate Prevention Toggle */}
                <button
                  type="button"
                  onClick={() => setPreventDuplicates(!preventDuplicates)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-panel)] border border-[var(--border-main)] text-[9px] font-bold text-[var(--text-main)] hover:border-amber-500/50 cursor-pointer transition-all active:scale-95"
                >
                  <div className={cn(
                    "w-3 h-3 flex items-center justify-center border rounded-sm transition-colors",
                    preventDuplicates ? "bg-amber-500 border-amber-500 text-zinc-950" : "border-[var(--border-main)]"
                  )}>
                    {preventDuplicates && <Check size={8} strokeWidth={3} />}
                  </div>
                  <span>重複アサイン防止</span>
                </button>
              </div>
            </div>

            {/* Pins Grid */}
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-[var(--bg-app)]/50 rounded border border-[var(--border-main)]/30">
              {getPinPool().map(pinName => {
                const isAssigned = assignedPins.has(pinName);
                
                // Determine focused slot's current pin value
                let isCurrentSlotPin = false;
                if (activeBox === 'row') {
                  isCurrentSlotPin = settings.pins.rows.includes(pinName);
                } else if (activeBox === 'col') {
                  isCurrentSlotPin = settings.pins.cols.includes(pinName);
                } else if (activeBox === 'feature' && focusedFeature) {
                  isCurrentSlotPin = (settings.pins as any)[focusedFeature] === pinName;
                }

                const isClickable = !isAssigned || !preventDuplicates || isCurrentSlotPin;

                return (
                  <button
                    key={pinName}
                    type="button"
                    disabled={!activeBox || !isClickable}
                    onClick={() => handleAssignPin(pinName)}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-mono font-bold transition-all relative",
                      !activeBox 
                        ? "bg-zinc-800/40 border border-zinc-800 text-[var(--text-muted)] cursor-not-allowed opacity-50"
                        : isCurrentSlotPin
                        ? "bg-amber-500 text-zinc-950 border border-amber-500"
                        : isAssigned
                        ? preventDuplicates
                          ? "bg-zinc-800/20 border border-zinc-800/40 text-zinc-600 cursor-not-allowed line-through"
                          : "bg-zinc-800 text-[var(--text-main)] border border-zinc-700/60 pl-4.5"
                        : "bg-zinc-800 hover:bg-zinc-700 hover:border-amber-500/50 text-[var(--text-highlight)] border border-zinc-700 active:scale-95 cursor-pointer"
                    )}
                  >
                    {/* Small amber dot for duplicate pins when preventDuplicates is off */}
                    {!preventDuplicates && isAssigned && !isCurrentSlotPin && (
                      <span className="absolute left-1.5 top-[7px] w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                    {pinName}
                  </button>
                );
              })}
            </div>

            {/* Custom pin override textbox */}
            <div className="flex gap-2 items-center justify-between border-t border-[var(--border-main)]/30 pt-3">
              <span className="text-[9px] text-[var(--text-muted)] font-mono">Custom Pin Override</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPinText}
                  onChange={(e) => setCustomPinText(e.target.value.toUpperCase())}
                  placeholder="e.g. GP99"
                  disabled={!activeBox}
                  className="w-20 bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-amber-500 font-mono transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={!activeBox || !customPinText}
                  onClick={() => {
                    handleAssignPin(customPinText);
                    setCustomPinText('');
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      </Section>
      
      {/* Developer Settings */}
      <Section title={t('hardware.developer')} icon={Settings}>
        <div className="flex items-center justify-between p-3 bg-[var(--bg-app)]/50 rounded-lg border border-[var(--border-main)]/50">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[var(--text-main)] leading-none">{t('hardware.debugMode')}</span>
            <span className="text-[9px] text-[var(--text-dim)] font-medium mt-1">{t('hardware.debugModeDesc')}</span>
          </div>
          <div 
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
              useKeyboardStore.getState().editorSettings.debugMode ? "bg-amber-500" : "bg-[var(--bg-button)]"
            )}
            onClick={() => useKeyboardStore.getState().updateEditorSettings({ debugMode: !useKeyboardStore.getState().editorSettings.debugMode })}
          >
            <div className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
              useKeyboardStore.getState().editorSettings.debugMode ? "left-[18px]" : "left-[2px]"
            )} />
          </div>
        </div>
      </Section>
    </div>
  );
};
