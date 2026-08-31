'use client';

import React from 'react';
import { CircleDot, Gauge, MousePointer2, PlugZap, Trash2 } from 'lucide-react';
import { useKeyboardStore } from '@/lib/store';
import { getLocalMatrixPosition, inferMatrixSideFromGeometry, MatrixSide } from '@/lib/matrix-utils';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { RightPanelEmptyState } from './RightPanelEmptyState';
import { AvailablePinPool } from './AvailablePinPool';
import {
  getDefaultDevelopmentBoard,
  getDevelopmentBoardLabel,
  getDevelopmentBoardPins,
  getMcuPins,
} from '@/lib/mcu-presets';

export const MatrixPainter = () => {
  const {
    settings,
    selectedKeyIds,
    keys,
    updateKey,
    setMatrixPosition,
    addEncoderToKey,
    updateEncoder,
    addTrackballToKey,
    updateTrackball,
  } = useKeyboardStore();
  const { t } = useTranslation();
  const [focusedEncoderPin, setFocusedEncoderPin] = React.useState<'pinA' | 'pinB'>('pinA');
  const [focusedPinTarget, setFocusedPinTarget] = React.useState<'direct' | 'encoder'>('direct');
  const [preventDuplicatePins, setPreventDuplicatePins] = React.useState<boolean>(true);
  const [customEncoderPinText, setCustomEncoderPinText] = React.useState<string>('');

  const selectedKeyId = selectedKeyIds[0];
  const selectedKey = selectedKeyId ? keys.find(k => k.id === selectedKeyId) : null;
  const selectedMatrixPos = selectedKey ? getLocalMatrixPosition(settings, selectedKey, keys) : null;
  const selectedMatrixSide = selectedMatrixPos?.side || selectedKey?.matrixSide || 'left';
  const selectedEncoder = selectedKey?.encoderId
    ? (settings.encoders || []).find(encoder => encoder.id === selectedKey.encoderId)
    : null;
  const selectedEncoderIndex = selectedEncoder
    ? (settings.encoders || []).findIndex(encoder => encoder.id === selectedEncoder.id)
    : -1;
  const selectedTrackball = selectedKey?.trackballId
    ? (settings.trackballs || []).find(trackball => trackball.id === selectedKey.trackballId)
    : null;
  const selectedTrackballIndex = selectedTrackball
    ? (settings.trackballs || []).findIndex(trackball => trackball.id === selectedTrackball.id)
    : -1;

  const selectedMcu = settings.hardware.mcu || 'RP2040';
  const controllerType = settings.hardware.controllerType || 'development_board';
  const selectedDevelopmentBoard = settings.hardware.board || getDefaultDevelopmentBoard(selectedMcu);
  const pinPoolLabel = controllerType === 'development_board'
    ? getDevelopmentBoardLabel(selectedDevelopmentBoard)
    : selectedMcu.toUpperCase();
  const pinPool = controllerType === 'development_board'
    ? getDevelopmentBoardPins(selectedDevelopmentBoard, selectedMcu)
    : getMcuPins(selectedMcu);
  const wiringMode = settings.matrix?.wiring || 'matrix';
  const isDirectMode = wiringMode === 'direct';

  const assignedPins = React.useMemo(() => {
    const pins = new Set<string>();
    if (isDirectMode) {
      keys.forEach(key => {
        const keySide = settings.features.split
          ? key.matrixSide || inferMatrixSideFromGeometry(key, keys)
          : 'left';
        if (keySide === selectedMatrixSide && key.directPin) pins.add(key.directPin);
        if (key.trackballId) {
          const trackball = (settings.trackballs || []).find(item => item.id === key.trackballId);
          if (trackball) [trackball.sclk, trackball.sdio, trackball.cs, trackball.motion].forEach(pin => pin && pins.add(pin));
        }
        if (!key.encoderId) return;
        const encoderSide = settings.features.split
          ? keySide
          : selectedMatrixSide;
        if (settings.features.split && encoderSide !== selectedMatrixSide) return;
        const encoder = (settings.encoders || []).find(item => item.id === key.encoderId);
        if (!encoder) return;
        if (encoder.pinA) pins.add(encoder.pinA);
        if (encoder.pinB) pins.add(encoder.pinB);
      });
      if (settings.pins.rgb) pins.add(settings.pins.rgb);
      if (settings.pins.backlight) pins.add(settings.pins.backlight);
      if (settings.pins.sda) pins.add(settings.pins.sda);
      if (settings.pins.scl) pins.add(settings.pins.scl);
      if (settings.pins.splitSerial) pins.add(settings.pins.splitSerial);
      return pins;
    }

    if (settings.features.split && selectedMatrixSide === 'right') {
      settings.pins.splitRows?.forEach(p => p && pins.add(p));
      settings.pins.splitCols?.forEach(p => p && pins.add(p));
    } else {
      settings.pins.rows.forEach(p => p && pins.add(p));
      settings.pins.cols.forEach(p => p && pins.add(p));
    }

    keys.forEach(key => {
      if (key.directPin) pins.add(key.directPin);
      if (key.trackballId) {
        const trackball = (settings.trackballs || []).find(item => item.id === key.trackballId);
        if (trackball) [trackball.sclk, trackball.sdio, trackball.cs, trackball.motion].forEach(pin => pin && pins.add(pin));
      }
      if (!key.encoderId) return;
      const encoderSide = settings.features.split
        ? getLocalMatrixPosition(settings, key, keys)?.side || key.matrixSide || inferMatrixSideFromGeometry(key, keys)
        : selectedMatrixSide;
      if (settings.features.split && encoderSide !== selectedMatrixSide) return;
      const encoder = (settings.encoders || []).find(item => item.id === key.encoderId);
      if (!encoder) return;
      if (encoder.pinA) pins.add(encoder.pinA);
      if (encoder.pinB) pins.add(encoder.pinB);
    });
    return pins;
  }, [isDirectMode, keys, selectedMatrixSide, settings]);

  const encoderPinPlaceholder = t('matrix.encoderPinPlaceholder');
  const currentEncoderPin = focusedEncoderPin === 'pinA' ? selectedEncoder?.pinA : selectedEncoder?.pinB;
  const activePinTarget = isDirectMode && (focusedPinTarget === 'direct' || !selectedEncoder) ? 'direct' : 'encoder';
  const activePinValue = activePinTarget === 'direct' ? selectedKey?.directPin : currentEncoderPin;

  const assignEncoderPin = (pinName: string) => {
    if (!selectedEncoder) return;
    if (preventDuplicatePins && assignedPins.has(pinName) && currentEncoderPin !== pinName) return;
    updateEncoder(selectedEncoder.id!, {
      [focusedEncoderPin]: pinName,
    });
  };

  const assignDirectPin = (pinName: string) => {
    if (!selectedKeyId) return;
    if (preventDuplicatePins && assignedPins.has(pinName) && selectedKey?.directPin !== pinName) return;
    updateKey(selectedKeyId, { directPin: pinName, row: undefined, col: undefined });
  };

  const assignActivePin = (pinName: string) => {
    if (activePinTarget === 'direct') {
      assignDirectPin(pinName);
      return;
    }
    assignEncoderPin(pinName);
  };

  const isCurrentActivePin = (pinName: string) => activePinValue === pinName;

  const setSelectedSide = (side: MatrixSide) => {
    if (!selectedKeyId) return;
    if (isDirectMode) {
      updateKey(selectedKeyId, { matrixSide: side, row: undefined, col: undefined });
      return;
    }
    setMatrixPosition(selectedKeyId, selectedMatrixPos?.row, selectedMatrixPos?.col, side);
  };

  const setSelectedRow = (value: string) => {
    if (!selectedKeyId) return;
    setMatrixPosition(selectedKeyId, parseInt(value, 10) || 0, selectedMatrixPos?.col ?? 0, selectedMatrixSide);
  };

  const setSelectedCol = (value: string) => {
    if (!selectedKeyId) return;
    setMatrixPosition(selectedKeyId, selectedMatrixPos?.row ?? 0, parseInt(value, 10) || 0, selectedMatrixSide);
  };

  if (!selectedKeyId || !selectedKey) {
    return (
      <RightPanelEmptyState message={t('common.selectKeysDesc')} icon={MousePointer2} />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-panel)] animate-in fade-in slide-in-from-right-1 duration-200">
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-4 pb-4 pt-4 custom-scrollbar">
        {isDirectMode ? (
          <>
          {settings.features.split && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('matrix.half')}
              </div>
              <div className="grid grid-cols-2 gap-1 rounded border border-[var(--border-main)] bg-[var(--bg-app)] p-0.5">
                {(['left', 'right'] as const).map(side => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setSelectedSide(side)}
                    className={cn(
                      "h-8 rounded text-[10px] font-bold uppercase transition-all",
                      selectedMatrixSide === side
                        ? "bg-amber-500 text-zinc-950"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    )}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded border border-[var(--border-main)] bg-[var(--bg-app)]/40 p-3">
            <div className="mb-3 flex items-center gap-2">
              <PlugZap size={14} className="text-[var(--text-dim)]" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('matrix.directPin')}
                </div>
              </div>
            </div>
            <input
              type="text"
              value={selectedKey.directPin || ''}
              onFocus={() => setFocusedPinTarget('direct')}
              onChange={(e) => updateKey(selectedKeyId, { directPin: e.target.value.toUpperCase(), row: undefined, col: undefined })}
              placeholder={t('matrix.directPinPlaceholder')}
              className="h-9 w-full rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 font-mono text-xs font-bold text-[var(--text-highlight)] outline-none transition-all placeholder:text-[var(--text-dim)] focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
            />
            <button
              onClick={() => updateKey(selectedKeyId, { directPin: undefined })}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-500 transition-colors hover:bg-red-500 hover:text-white"
            >
              <Trash2 size={13} />
              {t('matrix.clearAssignment')}
            </button>
          </div>
          </>
        ) : (
          <>
        {settings.features.split && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('matrix.half')}
            </div>
            <div className="grid grid-cols-2 gap-1 rounded border border-[var(--border-main)] bg-[var(--bg-app)] p-0.5">
              {(['left', 'right'] as const).map(side => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setSelectedSide(side)}
                  className={cn(
                    "h-8 rounded text-[10px] font-bold uppercase transition-all",
                    selectedMatrixSide === side
                      ? "bg-amber-500 text-zinc-950"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  )}
                >
                  {side}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('matrix.row')}
            </span>
            <div className="rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 py-2">
              <input
                type="number"
                min="0"
                value={selectedMatrixPos?.row ?? ''}
                onChange={(e) => setSelectedRow(e.target.value)}
                className="h-7 w-full bg-transparent font-mono text-sm font-bold text-[var(--text-highlight)] outline-none focus:text-amber-500"
              />
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('matrix.col')}
            </span>
            <div className="rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 py-2">
              <input
                type="number"
                min="0"
                value={selectedMatrixPos?.col ?? ''}
                onChange={(e) => setSelectedCol(e.target.value)}
                className="h-7 w-full bg-transparent font-mono text-sm font-bold text-[var(--text-highlight)] outline-none focus:text-amber-500"
              />
            </div>
          </label>
        </div>

        <button
          onClick={() => setMatrixPosition(selectedKeyId, undefined, undefined)}
          className="flex w-full items-center justify-center gap-2 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-500 transition-colors hover:bg-red-500 hover:text-white"
        >
          <Trash2 size={13} />
          {t('matrix.clearAssignment')}
        </button>
          </>
        )}

        <div className="rounded border border-[var(--border-main)] bg-[var(--bg-app)]/40 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Gauge size={14} className="text-[var(--text-dim)]" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('matrix.encoder')}
                </div>
                {selectedEncoder && (
                  <div className="mt-0.5 font-mono text-[10px] text-amber-500">
                    ENC{selectedEncoderIndex}
                  </div>
                )}
              </div>
            </div>
            {!selectedEncoder && (
              <button
                type="button"
                onClick={() => addEncoderToKey(selectedKeyId)}
                className="h-8 rounded border border-amber-500/25 bg-amber-500/10 px-3 text-[10px] font-bold uppercase text-amber-500 transition-all hover:bg-amber-500 hover:text-zinc-950"
              >
                {t('matrix.addEncoder')}
              </button>
            )}
          </div>

          {selectedEncoder && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('matrix.encoderPinA')}
                  </span>
                  <input
                    type="text"
                    value={selectedEncoder.pinA || ''}
                    onFocus={() => {
                      setFocusedPinTarget('encoder');
                      setFocusedEncoderPin('pinA');
                    }}
                    onChange={(e) => updateEncoder(selectedEncoder.id!, { pinA: e.target.value })}
                    className={cn(
                      "h-9 w-full rounded border bg-[var(--bg-app)] px-3 font-mono text-xs font-bold text-[var(--text-highlight)] outline-none transition-all placeholder:text-[var(--text-dim)]",
                      focusedPinTarget === 'encoder' && focusedEncoderPin === 'pinA'
                        ? "border-amber-500/50 ring-1 ring-amber-500/50"
                        : "border-[var(--border-main)] focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                    )}
                    placeholder={encoderPinPlaceholder}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('matrix.encoderPinB')}
                  </span>
                  <input
                    type="text"
                    value={selectedEncoder.pinB || ''}
                    onFocus={() => {
                      setFocusedPinTarget('encoder');
                      setFocusedEncoderPin('pinB');
                    }}
                    onChange={(e) => updateEncoder(selectedEncoder.id!, { pinB: e.target.value })}
                    className={cn(
                      "h-9 w-full rounded border bg-[var(--bg-app)] px-3 font-mono text-xs font-bold text-[var(--text-highlight)] outline-none transition-all placeholder:text-[var(--text-dim)]",
                      focusedPinTarget === 'encoder' && focusedEncoderPin === 'pinB'
                        ? "border-amber-500/50 ring-1 ring-amber-500/50"
                        : "border-[var(--border-main)] focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                    )}
                    placeholder={encoderPinPlaceholder}
                  />
                </label>
              </div>
              <button
                onClick={() => updateEncoder(selectedEncoder.id!, { pinA: undefined, pinB: undefined })}
                className="flex w-full items-center justify-center gap-2 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-500 transition-colors hover:bg-red-500 hover:text-white"
              >
                <Trash2 size={13} />
                {t('matrix.clearAssignment')}
              </button>
            </div>
          )}
        </div>

        <div className="rounded border border-[var(--border-main)] bg-[var(--bg-app)]/40 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CircleDot size={14} className="text-[var(--text-dim)]" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('matrix.trackball')}</div>
                {selectedTrackball && <div className="mt-0.5 font-mono text-[10px] text-amber-500">TRK{selectedTrackballIndex}</div>}
              </div>
            </div>
            {!selectedTrackball && <button type="button" onClick={() => addTrackballToKey(selectedKeyId)} className="h-8 rounded border border-amber-500/25 bg-amber-500/10 px-3 text-[10px] font-bold uppercase text-amber-500 transition-all hover:bg-amber-500 hover:text-zinc-950">{t('matrix.addTrackball')}</button>}
          </div>
          {selectedTrackball && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {(['sclk', 'sdio', 'cs', 'motion'] as const).map(field => <label key={field} className="space-y-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t(`matrix.trackball${field[0].toUpperCase()}${field.slice(1)}` as any)}</span><input type="text" value={selectedTrackball[field] || ''} onChange={e => updateTrackball(selectedTrackball.id!, { [field]: e.target.value.toUpperCase() })} placeholder={t('matrix.encoderPinPlaceholder')} className="h-9 w-full rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 font-mono text-xs font-bold text-[var(--text-highlight)] outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50" /></label>)}
            </div>
            <label className="block space-y-1.5"><span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('matrix.trackballCpi')}</span><input type="number" min="100" step="100" value={selectedTrackball.cpi || 1200} onChange={e => updateTrackball(selectedTrackball.id!, { cpi: Number(e.target.value) || 1200 })} className="h-9 w-full rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 font-mono text-xs font-bold text-[var(--text-highlight)] outline-none" /></label>
            <div className="grid grid-cols-3 gap-2">{(['swapXy', 'invertX', 'invertY'] as const).map(field => <label key={field} className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]"><input type="checkbox" checked={!!selectedTrackball[field]} onChange={e => updateTrackball(selectedTrackball.id!, { [field]: e.target.checked })} />{t(`matrix.trackball${field[0].toUpperCase()}${field.slice(1)}` as any)}</label>)}</div>
          </div>}
        </div>
      </div>

      {(isDirectMode || selectedEncoder) && (
        <AvailablePinPool
          title={`${t('matrix.availablePins')} (${pinPoolLabel})`}
          activeLabel={activePinTarget === 'direct'
            ? t('matrix.directPin')
            : focusedEncoderPin === 'pinA' ? t('matrix.encoderPinA') : t('matrix.encoderPinB')}
          pins={pinPool}
          assignedPins={assignedPins}
          preventDuplicates={preventDuplicatePins}
          onPreventDuplicatesChange={setPreventDuplicatePins}
          onAssignPin={assignActivePin}
          isCurrentPin={isCurrentActivePin}
          isActive={activePinTarget === 'direct' || !!selectedEncoder}
          isListTarget={false}
          customPinText={customEncoderPinText}
          onCustomPinTextChange={(value) => setCustomEncoderPinText(value.toUpperCase())}
          showCustomPinInput
          className="sticky bottom-0 z-10"
          pinListClassName="max-h-36 p-2"
        />
      )}
    </div>
  );
};
