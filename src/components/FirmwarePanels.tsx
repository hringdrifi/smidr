import { AlertTriangle, Check, ChevronRight, Code2, Download, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { FirmwareTarget, ProjectSettings } from '@/types/keyboard';
import { FIRMWARE_TARGETS, getFirmwareTargetLabel, isFirmwareTargetSupported } from '@/lib/firmware-targets';

const targetDescriptionKey = (target: FirmwareTarget) => `firmwareFlow.${target}Description`;

export const FirmwareTargetPanel = ({
  selected,
  hardware,
  onSelect,
  onContinue,
  onCancel,
}: {
  selected: FirmwareTarget | null;
  hardware: ProjectSettings['hardware'];
  onSelect: (target: FirmwareTarget) => void;
  onContinue: () => void;
  onCancel?: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-2">
        {FIRMWARE_TARGETS.map((target) => {
          const active = selected === target;
          const supported = isFirmwareTargetSupported(target, hardware);
          return (
            <button
              key={target}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(target)}
              className={`w-full rounded-xl border p-4 text-left transition-all ${active
                ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]'
                : 'border-[var(--border-main)] bg-[var(--bg-app)]/50 hover:border-amber-500/40 hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-amber-500 text-zinc-950' : 'bg-[var(--bg-button)] text-[var(--text-muted)]'}`}>
                  <Code2 size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[var(--text-highlight)]">{getFirmwareTargetLabel(target)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${supported ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {t(supported ? 'firmwareFlow.compatible' : 'firmwareFlow.incompatible')}
                    </span>
                  </span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">{t(targetDescriptionKey(target))}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className={`grid gap-3 ${onCancel ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex min-h-11 items-center justify-center rounded-lg border border-[var(--border-main)] px-4 text-xs font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-bold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            {t('firmwareFlow.continueSetup')}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export const FirmwareBuildPanel = ({
  target,
  supported,
  onBuild,
  onChangeTarget,
}: {
  target: FirmwareTarget;
  supported: boolean;
  onBuild: () => void;
  onChangeTarget: () => void;
}) => {
  const { t } = useTranslation();
  const label = getFirmwareTargetLabel(target);

  return (
    <div className="space-y-5 p-4 pb-24">
      <div className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-app)]/50 p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-zinc-950">
          <Download size={22} />
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">{label}</p>
        <h2 className="mt-1 text-base font-bold text-[var(--text-highlight)]">{t('firmwareFlow.buildTitle')}</h2>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {t('firmwareFlow.buildDescription').replace('{target}', label)}
        </p>
      </div>

      <div className={`flex items-start gap-3 rounded-lg border p-3 ${supported ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/10'}`}>
        {supported ? <ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-400" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-400" />}
        <div>
          <p className={`text-xs font-bold ${supported ? 'text-emerald-400' : 'text-amber-400'}`}>{t(supported ? 'firmwareFlow.ready' : 'firmwareFlow.blocked')}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">{t(supported ? 'firmwareFlow.readyDescription' : 'firmwareFlow.blockedDescription')}</p>
        </div>
      </div>

      <button
        type="button"
        disabled={!supported}
        onClick={onBuild}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-xs font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {supported ? <Download size={16} /> : <AlertTriangle size={16} />}
        {t('firmwareFlow.exportSelected').replace('{target}', label)}
      </button>
      <button type="button" onClick={onChangeTarget} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-main)] text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]">
        <Check size={15} />
        {t('firmwareFlow.changeTarget')}
      </button>
    </div>
  );
};
