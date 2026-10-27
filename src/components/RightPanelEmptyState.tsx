'use client';

import React from 'react';
import { LucideIcon, MousePointer2 } from 'lucide-react';

type RightPanelEmptyStateProps = {
  message: string;
  icon?: LucideIcon;
};

export const RightPanelEmptyState = ({
  message,
  icon: Icon = MousePointer2,
}: RightPanelEmptyStateProps) => {
  return (
    <div className="flex h-full min-h-[360px] flex-col overflow-hidden bg-[var(--bg-panel)]">
      <div className="flex flex-1 -translate-y-10 flex-col items-center justify-center space-y-4 bg-[var(--bg-app)]/20 p-8 text-center opacity-50">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-button)]/50 text-[var(--text-dim)]">
          <Icon size={24} />
        </div>
        <p className="max-w-[170px] text-xs leading-relaxed text-[var(--text-dim)]">
          {message}
        </p>
      </div>
    </div>
  );
};
