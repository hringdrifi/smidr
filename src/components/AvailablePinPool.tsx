'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface AvailablePinPoolProps {
  title: string;
  activeLabel?: string | null;
  pins: string[];
  assignedPins: Set<string>;
  preventDuplicates: boolean;
  onPreventDuplicatesChange: (value: boolean) => void;
  onAssignPin: (pinName: string) => void;
  isCurrentPin: (pinName: string) => boolean;
  isActive?: boolean;
  isListTarget?: boolean;
  customPinText?: string;
  onCustomPinTextChange?: (value: string) => void;
  showCustomPinInput?: boolean;
  className?: string;
  pinListClassName?: string;
}

export const AvailablePinPool: React.FC<AvailablePinPoolProps> = ({
  title,
  activeLabel,
  pins,
  assignedPins,
  preventDuplicates,
  onPreventDuplicatesChange,
  onAssignPin,
  isCurrentPin,
  isActive = true,
  isListTarget = false,
  customPinText = '',
  onCustomPinTextChange,
  showCustomPinInput = false,
  className,
  pinListClassName,
}) => {
  const { t } = useTranslation();

  return (
    <div className={cn("shrink-0 space-y-3 border-t border-[var(--border-main)] bg-[var(--bg-panel)] px-4 py-3", className)}>
      <div className="flex w-full flex-col gap-2">
        <span className="block w-full text-[10px] font-bold text-amber-500 uppercase tracking-wider">
          {title}
        </span>
        <div className="flex min-h-6 w-full items-center justify-between gap-2">
          <div className="min-w-0">
            {activeLabel && (
              <span className="block max-w-full truncate rounded border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] text-[var(--text-muted)]">
                {t('hardware.settingPinGroup')} <span className="font-mono text-amber-500 font-bold uppercase">
                  {activeLabel}
                </span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onPreventDuplicatesChange(!preventDuplicates)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-panel)] border border-[var(--border-main)] text-[9px] font-bold text-[var(--text-main)] hover:border-amber-500/50 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <div className={cn(
              "w-3 h-3 flex items-center justify-center border rounded-sm transition-colors",
              preventDuplicates ? "bg-amber-500 border-amber-500 text-zinc-950" : "border-[var(--border-main)]"
            )}>
              {preventDuplicates && <Check size={8} strokeWidth={3} />}
            </div>
            <span>{t('hardware.preventDuplicatePins')}</span>
          </button>
        </div>
      </div>

      <div className={cn("flex flex-wrap gap-1.5 max-h-[82px] overflow-y-auto p-1 bg-[var(--bg-app)]/50 rounded border border-[var(--border-main)]/30 custom-scrollbar", pinListClassName)}>
        {pins.map((pinName) => {
          const isAssigned = assignedPins.has(pinName);
          const isCurrent = isCurrentPin(pinName);
          const isClickable = !isAssigned || !preventDuplicates || (isCurrent && !isListTarget);

          return (
            <button
              key={pinName}
              type="button"
              disabled={!isActive || !isClickable}
              onClick={() => onAssignPin(pinName)}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-mono font-bold transition-all relative",
                !isActive
                  ? "bg-[var(--bg-button)]/60 border border-[var(--border-main)] text-[var(--text-muted)] cursor-not-allowed opacity-50"
                  : isCurrent
                  ? "bg-amber-500 text-zinc-950 border border-amber-500"
                  : isAssigned
                  ? preventDuplicates
                    ? "bg-[var(--bg-button)]/50 border border-[var(--border-main)] text-[var(--text-dim)] cursor-not-allowed line-through"
                    : "bg-[var(--bg-button)] text-[var(--text-main)] border border-[var(--border-main)] pl-4.5"
                  : "bg-[var(--bg-button)] hover:bg-[var(--bg-hover)] hover:border-amber-500/50 text-[var(--text-highlight)] border border-[var(--border-main)] active:scale-95 cursor-pointer"
              )}
            >
              {!preventDuplicates && isAssigned && !isCurrent && (
                <span className="absolute left-1.5 top-[7px] w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
              {pinName}
            </button>
          );
        })}
      </div>

      {showCustomPinInput && (
        <div className="flex gap-2 items-center justify-between border-t border-[var(--border-main)]/30 pt-2">
          <span className="text-[9px] text-[var(--text-muted)] font-mono">{t('hardware.customPinOverride')}</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={customPinText}
              onChange={(e) => onCustomPinTextChange?.(e.target.value)}
              placeholder="GPxx"
              className="w-20 px-2 py-1 rounded bg-[var(--bg-app)] border border-[var(--border-main)] text-[10px] font-mono text-[var(--text-highlight)] outline-none focus:border-amber-500/50"
            />
            <button
              type="button"
              disabled={!isActive || !customPinText}
              onClick={() => {
                onAssignPin(customPinText);
                onCustomPinTextChange?.('');
              }}
              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-[var(--bg-button)] disabled:text-[var(--text-dim)] disabled:border disabled:border-[var(--border-main)] text-zinc-950 text-[10px] font-bold transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {t('hardware.assign')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
