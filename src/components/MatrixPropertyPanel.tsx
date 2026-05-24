'use client';

import React, { useState } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { CircuitBoard, Settings, MousePointer2, MoveHorizontal, MoveVertical, Trash2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { PropertyInput, PropertySection } from './ui/PropertyComponents';

export const MatrixPropertyPanel = () => {
  const { 
    keys, selectedKeyIds, setMatrixPosition 
  } = useKeyboardStore();
  const { t } = useTranslation();

  const [focusedField, setFocusedField] = useState<string | null>(null);

  if (selectedKeyIds.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 pr-4 shrink-0">
          <div className="flex items-center gap-2 px-4 py-3 border-r border-[var(--border-main)] shrink-0">
            <CircuitBoard size={16} className="text-amber-500" />
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('matrix.propertiesTitle')}</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-50 bg-[var(--bg-app)]/20 p-8">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-button)]/50 flex items-center justify-center text-[var(--text-dim)]">
            <MousePointer2 size={24} />
          </div>
          <p className="text-xs text-[var(--text-dim)] leading-relaxed max-w-[160px]">
            {t('matrix.selectKeysDesc')}
          </p>
        </div>
      </div>
    );
  }

  // Get the first selected key as the reference
  const firstKey = keys.find(k => k.id === selectedKeyIds[0]);
  if (!firstKey) return null;

  const firstKeyMatrix = firstKey.row !== undefined ? { row: firstKey.row, col: firstKey.col! } : null;

  const handleRowChange = (val: number) => {
    selectedKeyIds.forEach(id => {
      const k = keys.find(k => k.id === id);
      setMatrixPosition(id, val, k?.col ?? 0);
    });
  };

  const handleRowFinalize = (val: number) => {
    selectedKeyIds.forEach(id => {
      const k = keys.find(k => k.id === id);
      setMatrixPosition(id, val, k?.col ?? 0);
    });
  };

  const handleColChange = (val: number) => {
    selectedKeyIds.forEach(id => {
      const k = keys.find(k => k.id === id);
      setMatrixPosition(id, k?.row ?? 0, val);
    });
  };

  const handleColFinalize = (val: number) => {
    selectedKeyIds.forEach(id => {
      const k = keys.find(k => k.id === id);
      setMatrixPosition(id, k?.row ?? 0, val);
    });
  };

  const handleClearAssignment = () => {
    selectedKeyIds.forEach(id => {
      setMatrixPosition(id, undefined, undefined);
    });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden animate-in fade-in duration-200" onMouseLeave={() => setFocusedField(null)}>
      {/* Header */}
      <div className="flex items-center border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 pr-4 shrink-0">
        <div className="flex items-center gap-2 px-4 py-3 border-r border-[var(--border-main)] shrink-0">
          <CircuitBoard size={16} className="text-amber-500" />
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('matrix.propertiesTitle')}</span>
        </div>
        {selectedKeyIds.length > 1 && (
          <div className="ml-4 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold">
            {selectedKeyIds.length} {t('properties.keysUnit')}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-x-auto custom-scrollbar bg-[var(--bg-app)]/20 py-4" key={selectedKeyIds.join(',')}>
        <div className="flex items-stretch w-fit min-w-max h-full">
          {/* Routing */}
          <PropertySection 
            title={t('matrix.routing')} 
            icon={Settings}
            className="w-[300px]"
          >
            <div className="space-y-4">
              <div className="flex gap-3">
                <PropertyInput 
                  label={t('matrix.row')} 
                  value={firstKeyMatrix?.row ?? 0} 
                  step="1" 
                  min="0"
                  icon={MoveVertical} 
                  onFocus={() => setFocusedField('row')} 
                  onChange={handleRowChange} 
                  onFinalize={handleRowFinalize} 
                />
                <PropertyInput 
                  label={t('matrix.col')} 
                  value={firstKeyMatrix?.col ?? 0} 
                  step="1" 
                  min="0"
                  icon={MoveHorizontal} 
                  onFocus={() => setFocusedField('col')} 
                  onChange={handleColChange} 
                  onFinalize={handleColFinalize} 
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleClearAssignment}
                  className="w-full flex items-center justify-center gap-2 p-2 bg-[var(--bg-panel)] hover:bg-red-500/10 rounded border border-[var(--border-main)] hover:border-red-500/30 text-[var(--text-dim)] hover:text-red-500 transition-all text-[10px] font-bold uppercase tracking-wider group"
                >
                  <Trash2 size={12} className="group-hover:scale-110 transition-transform" />
                  {t('matrix.clear')}
                </button>
              </div>
            </div>
          </PropertySection>
        </div>
      </div>
    </div>
  );
};
