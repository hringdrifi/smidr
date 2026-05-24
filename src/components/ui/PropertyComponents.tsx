import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export const PropertyInput = ({ 
  label, 
  value, 
  onChange, 
  onFinalize,
  onFocus,
  min,
  max,
  step = "1",
  icon: Icon
}: { 
  label: string, 
  value: number, 
  onChange: (val: number) => void,
  onFinalize?: (val: number) => void,
  onFocus?: () => void,
  min?: string,
  max?: string,
  step?: string,
  icon?: any
}) => {
  const [localValue, setLocalValue] = useState(value?.toString() ?? '');

  useEffect(() => {
    setLocalValue(value?.toString() ?? '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    const num = parseFloat(e.target.value);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  const handleBlur = () => {
    const num = parseFloat(localValue);
    if (!isNaN(num)) {
      onFinalize?.(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="space-y-1.5 flex-1 min-w-[70px]">
      <div className="flex items-center gap-1.5 px-0.5">
        {Icon && <Icon size={10} className="text-[var(--text-muted)]" />}
        <label className="text-[9px] uppercase text-[var(--text-muted)] font-bold tracking-wider leading-none">{label}</label>
      </div>
      <input 
        type="number" 
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
        className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none text-[var(--text-highlight)] transition-all placeholder:text-[var(--text-muted)] font-mono" 
      />
    </div>
  );
};

export const PropertySection = ({ title, icon: Icon, summary, children, className = "" }: any) => {
  return (
    <div className={cn("flex flex-col shrink-0 px-6", className)}>
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-[var(--text-dim)]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {title}
          </span>
        </div>
        {summary && (
          <span className="text-[10px] text-[var(--text-dim)] font-mono tracking-wider">
            {summary}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
        {children}
      </div>
    </div>
  );
};

export const Divider = () => <div className="w-px bg-[var(--border-main)]/50 shrink-0 my-2" />;
