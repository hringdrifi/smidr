import { ProjectSettings } from '@/types/keyboard';

type LayoutSelection = Pick<ProjectSettings, 'layoutOptions' | 'activeOptions'>;

export const getRestorableActiveOptions = (
  backup: LayoutSelection,
  current: LayoutSelection,
): Record<string, number> | null => {
  const restored = { ...current.activeOptions };
  let changed = false;

  for (const [id, currentGroup] of Object.entries(current.layoutOptions)) {
    const backupGroup = backup.layoutOptions?.[id];
    const value = backup.activeOptions?.[id];
    if (!backupGroup || backupGroup.name !== currentGroup.name || backupGroup.type !== currentGroup.type) continue;
    if (currentGroup.type === 'list' &&
      JSON.stringify(backupGroup.choices || []) !== JSON.stringify(currentGroup.choices || [])) continue;

    const choiceCount = currentGroup.type === 'toggle' ? 2 : currentGroup.choices?.length ?? 0;
    if (!Number.isInteger(value) || value < 0 || value >= choiceCount) continue;
    if (restored[id] !== value) {
      restored[id] = value;
      changed = true;
    }
  }

  return changed ? restored : null;
};
