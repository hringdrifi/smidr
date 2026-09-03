import React from 'react';
import { Cpu, LayoutTemplate, SplitSquareHorizontal } from 'lucide-react';
import { useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { DEVELOPMENT_BOARD_OPTIONS } from '@/lib/mcu-presets';
import { PRESET_LAYOUTS } from '@/lib/presets';

interface NewProjectSetupProps {
  preset: string;
  onPresetChange: (preset: string) => void;
}

export const NewProjectSetup: React.FC<NewProjectSetupProps> = ({ preset, onPresetChange }) => {
  const { settings, updateSettings } = useKeyboardStore();
  const { t } = useTranslation();
  const board = settings.hardware.board || 'promicro';

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[var(--text-muted)]">{t('hardware.kbName')}</label>
        <input autoFocus type="text" value={settings.name} onChange={event => updateSettings({ name: event.target.value })} className="h-11 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-highlight)] outline-none focus:border-amber-500" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]"><LayoutTemplate size={15} className="text-amber-500" />{t('tools.loadPreset')}</span>
          <select value={preset} onChange={event => onPresetChange(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-highlight)] outline-none focus:border-amber-500">
            {Object.keys(PRESET_LAYOUTS).map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>

        <label className="space-y-2">
          <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]"><Cpu size={15} className="text-amber-500" />{t('hardware.developmentBoard')}</span>
          <select value={board} onChange={event => updateSettings({ hardware: { ...settings.hardware, controllerType: 'development_board', board: event.target.value } })} className="h-11 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-highlight)] outline-none focus:border-amber-500">
            {DEVELOPMENT_BOARD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <button type="button" aria-pressed={settings.features.split} onClick={() => updateSettings({ features: { ...settings.features, split: !settings.features.split } })} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-[var(--border-main)] bg-[var(--bg-app)] px-4 text-left transition-colors hover:border-amber-500/40">
        <span className="flex items-center gap-3"><SplitSquareHorizontal size={19} className="text-amber-500" /><span><span className="block text-sm font-semibold text-[var(--text-highlight)]">{t('hardware.split')}</span><span className="mt-0.5 block text-xs text-[var(--text-muted)]">{t('workspace.advancedLater')}</span></span></span>
        <span className={`relative h-6 w-11 rounded-full transition-colors ${settings.features.split ? 'bg-amber-500' : 'bg-[var(--bg-button)]'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${settings.features.split ? 'left-6' : 'left-1'}`} /></span>
      </button>

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-[var(--text-muted)]">{t('workspace.setupHint')}</p>
    </div>
  );
};
